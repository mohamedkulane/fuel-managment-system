import toast from "react-hot-toast";
import { ApiError } from "./api";
import { so, soError } from "./so";

const feedbackId = "workflow-feedback";
export function notifySuccess(message: string) { toast.success(so(message), { id: feedbackId }); }

export function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof ApiError) return soError(message, error.status);
  if (/network|failed to fetch|fetch failed/i.test(message)) return soError(message, 0);
  if (message && message === fallback) return so(fallback);
  return so(fallback);
}
export function notifyError(error: unknown, fallback: string) { toast.error(errorMessage(error, fallback), { id: feedbackId }); }
