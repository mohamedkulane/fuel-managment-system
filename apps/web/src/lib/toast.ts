import toast from "react-hot-toast";

function clearPrevious() { toast.dismiss(); }
export function notifySuccess(message: string) { clearPrevious(); toast.success(message); }

export function notifyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  clearPrevious();
  if (/debt is \$/i.test(message) && /cannot pay more/i.test(message)) { toast.error(message); return; }
  if (/price changed/i.test(message)) { toast.error("Price changed. Review the order."); return; }
  if (/insufficient|not enough stock/i.test(message)) { toast.error("Not enough stock."); return; }
  if (/network|failed to fetch|fetch failed/i.test(message)) { toast.error("Connection problem. Try again."); return; }
  toast.error(fallback);
}
