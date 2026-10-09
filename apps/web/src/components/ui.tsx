import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) { return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>; }
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }
export function CardHead({ title, description, action }: { title: string; description?: string; action?: ReactNode }) { return <div className="card-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "ok" | "warn" | "info" | "danger" | "neutral" }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="error-state"><strong>Something needs attention</strong><span>{message}</span>{retry && <button className="btn secondary" onClick={retry}>Try again</button>}</div>; }
export function SubmitButton({ busy, children }: { busy?: boolean; children: ReactNode }) { return <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : children}</button>; }
