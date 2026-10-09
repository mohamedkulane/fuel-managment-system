import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) { return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>; }
export function Card({ children, className = "", style, onClick }: { children: ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) { return <section className={`card ${className}`} style={style} onClick={onClick}>{children}</section>; }
export function CardHead({ title, description, action }: { title: string; description?: string; action?: ReactNode }) { return <div className="card-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>; }
export function CardBody({ children }: { children: ReactNode }) { return <div className="card-body">{children}</div>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "ok" | "warn" | "info" | "danger" | "neutral" }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div>; }
export function ErrorState({ title, message, retry }: { title?: string; message: string; retry?: () => void }) { return <div className="error-state"><strong>{title ?? "Something needs attention"}</strong><span>{message}</span>{retry && <button className="btn secondary" onClick={retry}>Try again</button>}</div>; }
export function SubmitButton({ busy, children }: { busy?: boolean; children: ReactNode }) { return <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : children}</button>; }

export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(17, 27, 46, 0.7)", backdropFilter: "blur(2px)" }}>
      <div style={{ background: "white", borderRadius: "17px", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflow: "auto", border: "1px solid #e8e8e5", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #eeeff1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", fontSize: "20px", color: "#87909f", cursor: "pointer", padding: "4px" }}>&times;</button>
        </div>
        <div style={{ padding: "24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (newPage: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: "1px solid #eff0f2", fontSize: "12px", color: "#687489" }}>
      <span>Page {page} of {totalPages}</span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button className="btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
        <button className="btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

