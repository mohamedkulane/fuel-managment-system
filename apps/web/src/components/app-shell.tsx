"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, type Actor } from "../lib/api";

const groups = [
  { label: "Workspace", links: [["/", "Overview"], ["/customers", "Customers"], ["/orders", "Sales orders"], ["/deliveries", "Delivery lists"], ["/dispatches", "Dispatches"]] },
  { label: "Finances & Billing", links: [["/invoices", "Invoices"], ["/payments", "Payments"], ["/debts", "Accounts receivable"], ["/reports", "Reports Hub"]] },
  { label: "Inventory & pricing", links: [["/stock", "Fuel inventory"], ["/stock/receive", "Tanker receipts"], ["/pricing", "Price book"]] },
  { label: "Administration", links: [["/settings", "Settings"], ["/audits", "Audit logs"]] }
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false); const login = path === "/login";
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me"), enabled: !login, retry: false });
  useEffect(() => { if (!login && me.isError) router.replace("/login"); }, [login, me.isError, router]);
  if (login) return children;
  return <div className="app-shell">
    <button className={`backdrop ${open ? "open" : ""}`} aria-label="Close navigation" onClick={() => setOpen(false)} />
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand"><span className="brand-mark">F</span><div><strong>fueldesk.</strong><small>Wholesale system</small></div></div>
      <nav className="side-nav" aria-label="Primary navigation">{groups.map((group) => <div key={group.label}><p>{group.label}</p>{group.links.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={(href === "/" ? path === "/" : path.startsWith(href)) ? "active" : ""}>{label}</Link>)}</div>)}</nav>
      <div className="sidebar-note"><strong>Built for daily operations.</strong><span>Stock, orders and reconciliation in one workspace.</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open navigation">Menu</button><div className="crumb">Workspace <b>/ {path === "/" ? "Overview" : path.split("/").filter(Boolean).join(" / ")}</b></div><div className="user"><span>{me.data?.displayName ?? "Loading…"}</span><small>{me.data?.role === "OWNER" ? "Business Owner" : "Office Employee"}</small></div></header>
      {me.isLoading ? <main className="page"><div className="skeleton tall" /></main> : children}
    </div>
  </div>;
}
