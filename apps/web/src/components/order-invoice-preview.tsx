"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { ActionButton } from "./controls";
import { Card, CardHead } from "./ui";
import { apiBase, ApiError } from "../lib/api";
import { notifyError } from "../lib/toast";

type Props = {
  orderId: string;
  orderNo: string;
  open: boolean;
};

async function invoiceBlob(orderId: string): Promise<Blob> {
  const response = await fetch(`${apiBase}/orders/${orderId}/invoice-pdf`, { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(response.status, body?.message ?? "Invoice unavailable");
  }
  if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("Invoice unavailable");
  return response.blob();
}

export function OrderInvoicePreview({ orderId, orderNo, open }: Props) {
  const [busy, setBusy] = useState<"download" | "print" | null>(null);
  if (!open) return null;

  async function download() {
    if (busy) return;
    setBusy("download");
    try {
      const blob = await invoiceBlob(orderId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${orderNo}-invoice.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      notifyError(error, "Invoice download failed");
    } finally {
      setBusy(null);
    }
  }

  async function print() {
    if (busy) return;
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setBusy("print");
    try {
      if (!tab) throw new Error("Oggolow daaqadaha soo baxa si aad u daabacdo biilka.");
      const blob = await invoiceBlob(orderId);
      const url = URL.createObjectURL(blob);
      tab.location.replace(url);
      window.setTimeout(() => {
        try {
          tab.focus();
          tab.print();
        } catch {
          // The browser PDF viewer can require a manual print action.
        }
      }, 900);
      window.setTimeout(() => URL.revokeObjectURL(url), 300_000);
    } catch (error) {
      tab?.close();
      notifyError(error, "Invoice print failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="invoice-preview-card">
      <CardHead
        title="Eegista Biilka"
        description="Halkan ka eeg biilka PDF-ga A4, kuna daabac ama soo dejiso isla faylka."
        action={
          <div className="actions invoice-preview-actions">
            <ActionButton type="button" className="btn" disabled={busy !== null} onClick={() => void print()}>
              {busy === "print" ? "Waa la diyaarinayaa…" : "Daabac Biilka"}
            </ActionButton>
            <ActionButton type="button" className="btn primary" disabled={busy !== null} onClick={() => void download()}>
              {busy === "download" ? "Waa la diyaarinayaa…" : "Soo dejiso Biilka"}
            </ActionButton>
          </div>
        }
      />
      <div className="invoice-preview-body">
        <iframe
          title={`Eegista biilka ${orderNo}`}
          className="invoice-preview-frame"
          src={`${apiBase}/orders/${orderId}/invoice-pdf`}
        />
        <p className="invoice-preview-help"><Printer size={15} /> Daabacashadu waxay PDF-ga ku furaysaa bog cusub. <Download size={15} /> Soo dejintu waxay faylka PDF A4 ku kaydinaysaa qalabkaaga.</p>
      </div>
    </Card>
  );
}
