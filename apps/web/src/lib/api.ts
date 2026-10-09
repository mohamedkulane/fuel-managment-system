const envUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
export const apiBase = envUrl
  ? (envUrl.endsWith("/api/v1") ? envUrl : `${envUrl}/api/v1`)
  : "http://localhost:4000/api/v1";
export type Actor = { id: string; displayName: string; email: string; role: "OWNER" | "OFFICE_EMPLOYEE" };

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export class ApiError extends Error { public constructor(public readonly status: number, message: string) { super(message); } }

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!response.ok) { const text = await response.text(); let message = text; try { const parsed = JSON.parse(text) as { message?: string | string[] }; message = Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message ?? text; } catch { /* plain response */ } throw new ApiError(response.status, message || "Request failed"); }
  const body = await response.json() as { data: T };
  return body.data;
}

export const mutationKey = (): string => crypto.randomUUID();

