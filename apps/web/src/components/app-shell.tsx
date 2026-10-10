"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Boxes, CalendarDays, ChevronRight, ClipboardList, Clock3, Fuel, LayoutGrid, LogOut, Menu, Receipt, Repeat2, Settings, ShoppingBag, TrendingUp, Truck, Users, Wallet, X } from "lucide-react";
import { api, ApiError, type Actor } from "../lib/api";
import { ErrorState, LoadingState } from "./ui";
import { formatRole } from "../lib/format";

const groups = [
  { label: "Goobta Shaqada", links: [{ href: "/", label: "Guudmar", icon: LayoutGrid }, { href: "/customers", label: "Macaamiisha", icon: Users }, { href: "/orders", label: "Dalabyada", icon: ShoppingBag }, { href: "/invoices", label: "Biilasha", icon: Receipt }, { href: "/payments", label: "Lacag-bixinnada", icon: Wallet }, { href: "/debts", label: "Xinta Deynta", icon: TrendingUp }] },
  { label: "Hawgallada", links: [{ href: "/stock", label: "Kaydka Shidaalka", icon: Boxes }, { href: "/stock/receive", label: "Shidaal Soo Gelin", icon: Truck }, { href: "/pricing", label: "Qiimaha Shidaalka", icon: Fuel }, { href: "/deliveries", label: "Waraaqaha Gaarsiinta", icon: ClipboardList }, { href: "/dispatches", label: "Dhaqdhaqaaqa Dirista", icon: Repeat2 }] },
  { label: "Warbixinnada & Xogta", links: [{ href: "/reports", label: "Warbixinnada & Soo Dejinta", icon: BarChart3 }, { href: "/audits", label: "Diiwaanka Hawlaha", icon: Clock3 }] },
  { label: "Maamulka", links: [{ href: "/settings", label: "Dejinta & Ogolaanshaha", icon: Settings }] }
];
export function Brand() { return <div className="brand"><span className="brand-mark">f.</span><div><strong>fueldesk.</strong><small>Hoolka Jumladlaha Shidaalka</small></div></div>; }
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
  return <div className="app-shell"><a href="#workspace-content" className="skip-link">U gudub nuxurka</a><button className={`backdrop ${open ? "open" : ""}`} aria-label="Xir meertada" onClick={() => setOpen(false)} tabIndex={-1} />
    <aside ref={sidebar} className={`sidebar ${open ? "open" : ""}`} aria-label="Meertada goobta shaqada"><div className="brand-row"><Brand /><button className="sidebar-close icon-btn" aria-label="Xir meertada" onClick={() => setOpen(false)}><X size={19} /></button></div>
      <nav className="side-nav" aria-label="Meertada koowaad">{groups.map(group => <div key={group.label}><p>{group.label}</p>{group.links.filter(l => l.href !== "/audits" || me.data?.role === "OWNER").map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={activeLink?.href === href ? "page" : undefined} className={activeLink?.href === href ? "active" : ""}><Icon size={17} strokeWidth={1.7} aria-hidden="true" />{label}</Link>)}</div>)}</nav>
      <div className="sidebar-foot"><div className="avatar">{initials}</div><div className="sidebar-user"><b>{me.data?.displayName ?? "Raraya…"}</b><small>{formatRole(me.data?.role)}</small></div><button className="logout-btn" aria-label="Ka bax" title="Ka bax" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut size={17} /></button></div>
    </aside>
    <div className="workspace" inert={open ? true : undefined}><header className="topbar"><div className="crumb"><button ref={menu} className="menu-btn icon-btn" aria-label="Fur meertada" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={20} /></button><span>Goobta Shaqada</span><ChevronRight size={13} /><b>{activeLink?.label ?? "Guudmar"}</b>{path.split("/").length > 2 && <span className="detail-crumb"> / Faahfaahin</span>}</div><div className="top-actions"><span className="business-date"><CalendarDays size={14} />{new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Mogadishu", day: "2-digit", month: "short", year: "numeric" }).format(new Date())}</span><span className="role-label">{me.data?.role === "OWNER" ? "Milkiile" : "Xafiis"}</span><div className="top-avatar" title={me.data?.displayName}>{initials}</div></div></header>
      <div id="workspace-content" tabIndex={-1}>{logout.isError && <ErrorState message={logout.error.message} />}{me.isLoading ? <main className="page"><LoadingState label="Soo raraya goobtaada shaqada…" /></main> : me.isError ? <main className="page"><ErrorState message={me.error.message} retry={() => void me.refetch()} /></main> : me.data ? children : null}</div>
    </div></div>;
}

