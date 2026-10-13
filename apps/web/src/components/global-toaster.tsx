"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "react-hot-toast";

export function GlobalToaster() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Native dialogs occupy the top layer. Keep one accessible live region
    // inside the active dialog so feedback isn't hidden behind its backdrop.
    const update = () => setContainer(document.querySelector<HTMLDialogElement>("dialog[open]") ?? document.body);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    update();
    return () => observer.disconnect();
  }, []);
  return container && createPortal(<Toaster position="top-right" containerClassName="fuel-toast-container" toastOptions={{
    duration: 3000,
    success: { duration: 3000, iconTheme: { primary: "#99CC33", secondary: "#003333" } },
    error: { duration: 5000 },
    ariaProps: { role: "status", "aria-live": "polite" },
    style: { background: "#003333", color: "#ffffff", border: "1px solid #99CC33", borderRadius: "10px", fontSize: "14px", maxWidth: "min(92vw, 380px)" },
  }} />, container);
}
