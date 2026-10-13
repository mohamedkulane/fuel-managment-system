import toast from "react-hot-toast";

const feedbackId = "workflow-feedback";
export function notifySuccess(message: string) { toast.success(message, { id: feedbackId }); }

export function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (/^Debt is \$\d{1,14}\.\d{2}\. You cannot pay more\.$/.test(message)) return message;
  if (message === "No debt to pay" || message === "No orders for this date") return message;
  if (/price changed/i.test(message)) return "Price changed. Review the order.";
  if (/insufficient|not enough stock/i.test(message)) return "Not enough stock.";
  if (/network|failed to fetch|fetch failed/i.test(message)) return "Connection problem. Try again.";
  return fallback;
}
export function notifyError(error: unknown, fallback: string) { toast.error(errorMessage(error, fallback), { id: feedbackId }); }
