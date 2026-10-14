import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import PDFDocument from "pdfkit";

export type DocumentBrandingSettings = {
  companyName: string;
  logoUrl: string | null;
  footerText: string | null;
};

export type ResolvedDocumentBranding = DocumentBrandingSettings & {
  logo: Buffer | null;
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const first = parts[0]!;
  const second = parts[1]!;
  const third = parts[2]!;
  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0]!;
  const halves = normalized.split("::");
  if (halves.length > 2) return false;
  const parseHalf = (half: string) => half ? half.split(":").map((part) => Number.parseInt(part, 16)) : [];
  const left = parseHalf(halves[0]!);
  const right = parseHalf(halves[1] ?? "");
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return false;
  const groups = [...left, ...Array(missing).fill(0), ...right];
  if (groups.length !== 8 || groups.some((part) => !Number.isInteger(part) || part < 0 || part > 0xffff)) return false;
  const first = groups[0]!;
  const second = groups[1]!;
  return first >= 0x2000 && first <= 0x3fff &&
    !(first === 0x2001 && second <= 0x01ff) &&
    first !== 0x2002;
}

function publicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export function validateLogoUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Logo URL must be a valid public HTTPS URL");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Logo URL must use HTTPS on the standard port");
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Logo URL must use a public hostname");
  }
  if (isIP(hostname) && !publicAddress(hostname)) throw new Error("Logo URL must use a public internet address");
  if (url.hash || url.href.length > 2048) throw new Error("Logo URL is too long or contains a fragment");
  return url.toString();
}

async function downloadLogo(value: string): Promise<Buffer> {
  const url = new URL(validateLogoUrl(value));
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(hostname);
  const addresses = family
    ? [{ address: hostname, family }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !publicAddress(address))) {
    throw new Error("Logo URL must resolve only to public internet addresses");
  }
  const pinnedAddress = addresses[0]!;

  const response = await new Promise<{ data: Buffer; contentType: string | undefined }>((resolve, reject) => {
    const req = httpsRequest(url, {
      headers: { Accept: "image/png, image/jpeg" },
      lookup: (_hostname, options, callback) => {
        if (options?.all) {
          callback(null, [{ address: pinnedAddress.address, family: pinnedAddress.family }]);
        } else {
          callback(null, pinnedAddress.address, pinnedAddress.family);
        }
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Logo server returned HTTP ${res.statusCode ?? "error"}`));
        return;
      }
      const contentType = res.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
      if (contentType !== "image/png" && contentType !== "image/jpeg") {
        res.resume();
        reject(new Error("Logo must be a PNG or JPEG image"));
        return;
      }
      const contentLength = Number(res.headers["content-length"] ?? 0);
      if (contentLength > MAX_LOGO_BYTES) {
        res.resume();
        reject(new Error("Logo image must be 2 MB or smaller"));
        return;
      }
      const chunks: Buffer[] = [];
      let received = 0;
      res.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_LOGO_BYTES) {
          req.destroy(new Error("Logo image must be 2 MB or smaller"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ data: Buffer.concat(chunks), contentType }));
      res.on("error", reject);
    });
    req.setTimeout(5000, () => req.destroy(new Error("Logo download timed out")));
    req.on("error", reject);
    req.end();
  });

  const isPng = response.contentType === "image/png" &&
    response.data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = response.contentType === "image/jpeg" &&
    response.data[0] === 0xff && response.data[1] === 0xd8 && response.data[2] === 0xff;
  if (!isPng && !isJpeg) throw new Error("Logo response is not a valid PNG or JPEG image");
  return response.data;
}

export async function resolveDocumentBranding(settings: DocumentBrandingSettings | null): Promise<ResolvedDocumentBranding> {
  const logoUrl = settings?.logoUrl ? validateLogoUrl(settings.logoUrl) : null;
  return {
    companyName: settings?.companyName.trim() || "FuelDesk",
    logoUrl,
    footerText: settings?.footerText?.trim() || null,
    logo: logoUrl ? await downloadLogo(logoUrl) : null
  };
}

export function drawDocumentLogo(doc: InstanceType<typeof PDFDocument>, branding: ResolvedDocumentBranding, x = 36, y = 30, width = 104, height = 48): void {
  if (branding.logo) doc.image(branding.logo, x, y, { fit: [width, height] });
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111")
    .text(branding.companyName, branding.logo ? x + width + 9 : x, y + 14, { width: branding.logo ? 170 : 230, height: 30, ellipsis: true });
}

export function addDocumentFooter(doc: InstanceType<typeof PDFDocument>, branding: ResolvedDocumentBranding): void {
  const { start, count } = doc.bufferedPageRange();
  const footer = branding.footerText ?? "Fuel Wholesale Management System";
  for (let page = start; page < start + count; page += 1) {
    doc.switchToPage(page);
    const pageWidth = doc.page.width;
    const footerY = doc.page.height - 46;
    doc.save();
    doc.moveTo(34, footerY).lineTo(pageWidth - 34, footerY).strokeColor("#b8c2bd").lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor("#555555")
      .text(footer, 34, footerY + 7, { width: pageWidth - 68, align: "center", lineBreak: false, ellipsis: true });
    doc.restore();
  }
}
