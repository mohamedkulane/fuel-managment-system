"use client";
import { useRef, useState, type ReactNode } from "react";
import { ActionButton } from "./controls";
import { apiBase, ApiError } from "../lib/api";
import { notifyError } from "../lib/toast";
export function PdfButton({ path, children, failure = "Statement unavailable", className = "btn" }: { path: string; children: ReactNode; failure?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function open() {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      if (!tab) throw new Error("Popup blocked");
      const response = await fetch(`${apiBase}${path}`, { credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new ApiError(response.status, body?.message ?? failure);
      }
      if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error(failure);
      const url = URL.createObjectURL(await response.blob());
      tab.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 300_000);
    } catch (error) { tab?.close(); notifyError(error, failure); }
    finally { pending.current = false; setBusy(false); }
  }
  return <ActionButton type="button" className={className} disabled={busy} onClick={() => void open()}>{busy ? "Opening…" : children}</ActionButton>;
}
