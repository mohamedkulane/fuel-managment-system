"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Boxes, CalendarDays, ChevronRight, ClipboardList, Clock3, Fuel, LayoutGrid, LogOut, Menu, Receipt, Repeat2, Settings, ShoppingBag, TrendingUp, Truck, Users, Wallet, X } from "lucide-react";
import { api, ApiError, type Actor } from "../lib/api";
import { ErrorState, LoadingState } from "./ui";

const groups = [
  { label: "Workspace", links: [{ href: "/", label: "Overview", icon: LayoutGrid }, { href: "/customers", label: "Customers", icon: Users }, { href: "/orders", label: "Sales orders", icon: ShoppingBag }, { href: "/invoices", label: "Invoices", icon: Receipt }, { href: "/payments", label: "Payments", icon: Wallet }, { href: "/debts", label: "Debt center", icon: TrendingUp }] },
  { label: "Operations", links: [{ href: "/stock", label: "Inventory", icon: Boxes }, { href: "/stock/receive", label: "Tanker receipts", icon: Truck }, { href: "/pricing", label: "Fuel pricing", icon: Fuel }, { href: "/deliveries", label: "Delivery sheets", icon: ClipboardList }, { href: "/dispatches", label: "Dispatches", icon: Repeat2 }] },
  { label: "Insights", links: [{ href: "/reports", label: "Reports & exports", icon: BarChart3 }, { href: "/audits", label: "Activity log", icon: Clock3 }] },
  { label: "Administration", links: [{ href: "/settings", label: "Settings & access", icon: Settings }] }
];
export function Brand() { return <div className="brand"><span className="brand-mark">f.</span><div><strong>fueldesk.</strong><small>Wholesale workspace</small></div></div>; }
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const client = useQueryClient(); const [open, setOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null); const menu = useRef<HTMLButtonElement>(null); const login = path === "/login";
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me"), enabled: !login, retry: false });
  const logout = useMutation({ mutationFn: () => api("/auth/logout", { method: "POST" }), onSuccess: () => { client.clear(); router.replace("/login"); } });
  useEffect(() => { if (!login && me.error instanceof ApiError && me.error.status === 401) router.replace("/login"); }, [login, me.error, router]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab") return;
      const items = sidebar.current?.querySelectorAll<HTMLElement>("a, button:not(:disabled)");
      const first = items?.[0]; const last = items?.[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", keydown); menu.current?.focus(); };
  }, [open]);
  if (login) return children;
  const activeLink = groups.flatMap(g => g.links).filter(l => l.href === "/" ? path === "/" : path === l.href || path.startsWith(`${l.href}/`)).sort((a,b) => b.href.length-a.href.length)[0];
  const initials = me.data?.displayName.split(" ").map(n => n[0]).slice(0,2).join("") ?? "";
  return <div className="app-shell"><a href="#workspace-content" className="skip-link">Skip to content</a><button className={`backdrop ${open ? "open" : ""}`} aria-label="Close navigation" onClick={() => setOpen(false)} tabIndex={-1} />
    <aside ref={sidebar} className={`sidebar ${open ? "open" : ""}`} aria-label="Workspace navigation"><div className="brand-row"><Brand /><button className="sidebar-close icon-btn" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={19} /></button></div>
      <nav className="side-nav" aria-label="Primary navigation">{groups.map(group => <div key={group.label}><p>{group.label}</p>{group.links.filter(l => l.href !== "/audits" || me.data?.role === "OWNER").map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={activeLink?.href === href ? "page" : undefined} className={activeLink?.href === href ? "active" : ""}><Icon size={17} strokeWidth={1.7} aria-hidden="true" />{label}</Link>)}</div>)}</nav>
      <div className="sidebar-foot"><div className="avatar">{initials}</div><div className="sidebar-user"><b>{me.data?.displayName ?? "Loading…"}</b><small>{me.data?.role === "OWNER" ? "Business owner" : "Office employee"}</small></div><button className="logout-btn" aria-label="Sign out" title="Sign out" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut size={17} /></button></div>
    </aside>
    <div className="workspace" inert={open ? true : undefined}><header className="topbar"><div className="crumb"><button ref={menu} className="menu-btn icon-btn" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={13} /><b>{activeLink?.label ?? "Overview"}</b>{path.split("/").length > 2 && <span className="detail-crumb"> / Details</span>}</div><div className="top-actions"><span className="business-date"><CalendarDays size={14} />{new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Mogadishu", day: "2-digit", month: "short", year: "numeric" }).format(new Date())}</span><span className="role-label">{me.data?.role === "OWNER" ? "Owner" : "Office"}</span><div className="top-avatar" title={me.data?.displayName}>{initials}</div></div></header>
      <div id="workspace-content" tabIndex={-1}>{logout.isError && <ErrorState message={logout.error.message} />}{me.isLoading ? <main className="page"><LoadingState label="Opening your workspace…" /></main> : me.isError ? <main className="page"><ErrorState message={me.error.message} retry={() => void me.refetch()} /></main> : me.data ? children : null}</div>
    </div></div>;
}
