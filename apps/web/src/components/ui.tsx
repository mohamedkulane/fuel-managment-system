"use client";
import { ActionButton } from "./controls";
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Inbox, X, type LucideIcon } from "lucide-react";

import { formatStatus } from "../lib/i18n";
import { so } from "../lib/so";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="page-head"><div><div className="eyebrow">{so(eyebrow)}</div><h1>{so(title)}</h1><p>{so(description)}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}
export function Card({ children, className = "", style, onClick }: { children: ReactNode; className?: string; style?: CSSProperties; onClick?: () => void }) {
  return <section className={`card ${className}`} style={style} onClick={onClick}>{children}</section>;
}
export function CardHead({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="card-head"><div><h2>{so(title)}</h2>{description && <p>{so(description)}</p>}</div>{action}</div>;
}
export function CardBody({ children }: { children: ReactNode }) { return <div className="card-body">{children}</div>; }
export function MetricCard({ label, value, note, icon: Icon, dark = false }: { label: string; value: ReactNode; note?: ReactNode; icon?: LucideIcon; dark?: boolean }) {
  return <Card className={`metric ${dark ? "dark" : ""}`}><div className="metric-top"><span>{so(label)}</span>{Icon && <span className="metric-icon"><Icon size={17} aria-hidden="true" /></span>}</div><strong className="metric-num mono">{value}</strong>{note && <div className="metric-meta">{typeof note === "string" ? so(note) : note}</div>}</Card>;
}
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "ok" | "warn" | "info" | "danger" | "neutral" }) {
  const display = typeof children === "string" ? formatStatus(children) : children;
  return <span className={`badge ${tone}`}>{display}</span>;
}
export function Empty({ children }: { children: ReactNode }) { return <div className="empty"><Inbox size={25} aria-hidden="true" /><span>{typeof children === "string" ? so(children) : children}</span></div>; }
export function CascadeSpinner({ size = 48 }: { size?: number }) {
  return (
    <svg className="cascade-spinner" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path className="cascade-arc cascade-arc-one" d="M8 29c8 8 24 8 32 0" />
      <path className="cascade-arc cascade-arc-two" d="M13 21c6 6 16 6 22 0" />
      <path className="cascade-arc cascade-arc-three" d="M18 13c3 3 9 3 12 0" />
    </svg>
  );
}
export function LoadingState({ label = "Waa la soo rarayaa…" }: { label?: string }) { return <div className="loading-state" role="status" aria-live="polite"><CascadeSpinner /><span>{so(label)}</span></div>; }
export function ErrorState({ title, message, retry }: { title?: string; message: string; retry?: () => void }) {
  return <div className="error-state" role="alert"><AlertCircle size={24} /><strong>{so(title ?? "Cilad ayaa dhacday")}</strong><span>{so(message)}</span>{retry && <ActionButton className="btn secondary" onClick={retry}>Mar kale isku day</ActionButton>}</div>;
}
export function SubmitButton({ busy, disabled, children }: { busy?: boolean; disabled?: boolean; children: ReactNode }) { return <ActionButton className="btn primary" type="submit" disabled={busy || disabled} aria-busy={busy || undefined}>{busy ? <><CascadeSpinner size={17} /> Kaydinaya…</> : children}</ActionButton>; }

// Native dialogs contain focus, make background content inert, and support Escape.
export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!isOpen || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previous; trigger?.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  return <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); onClose(); }}><div className="modal-top"><h2 id={titleId}>{so(title)}</h2><ActionButton className="btn icon-btn ghost" type="button" onClick={onClose} aria-label="Xir daaqadda"><X size={18} /></ActionButton></div><div className="modal-body">{children}</div></dialog>;
}
export function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (newPage: number) => void }) {
  if (totalPages <= 1) return null;
  return <nav className="pagination" aria-label="Bogagga shaxda"><span>Bogga <b>{page}</b> ee {totalPages}</span><div className="actions"><ActionButton className="btn small" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ArrowLeft size={14} />Hore</ActionButton><ActionButton className="btn small" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Xiga<ArrowRight size={14} /></ActionButton></div></nav>;
}
