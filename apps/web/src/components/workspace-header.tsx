"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, CircleUserRound, LogOut, Search, Settings, ShoppingBag, Users, X } from "lucide-react";
import { api, type Actor, type PaginatedResponse } from "../lib/api";
import { formatRole } from "../lib/format";

type CustomerHit = { id: string; name: string; primaryPhone: string | null };
type OrderHit = { id: string; orderNo: string; customer: { name: string } };
type Overview = { operations: { pendingOrders: number; dispatched: number; unbilledDeliveries: number } };

export function WorkspaceHeader({ actor, onLogout, busy }: { actor?: Actor; onLogout: () => void; busy: boolean }) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [panel, setPanel] = useState<"search" | "notifications" | "profile" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    function outside(event: PointerEvent) { if (event.target instanceof Node && !root.current?.contains(event.target)) setPanel(null); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setPanel(null); }
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const customers = useQuery({ queryKey: ["header-search", "customers", term], queryFn: () => api<PaginatedResponse<CustomerHit>>(`/customers?search=${encodeURIComponent(term)}&limit=5`), enabled: !!actor && term.length >= 2 });
  const orders = useQuery({ queryKey: ["header-search", "orders", term], queryFn: () => api<PaginatedResponse<OrderHit>>(`/orders?search=${encodeURIComponent(term)}&limit=5`), enabled: !!actor && term.length >= 2 });
  const overview = useQuery({ queryKey: ["dashboard", "overview"], queryFn: () => api<Overview>("/dashboard/overview"), enabled: !!actor, refetchInterval: 60000 });
  const ops = overview.data?.operations;
  const attention = (ops?.pendingOrders ?? 0) + (ops?.unbilledDeliveries ?? 0);
  const initials = actor?.displayName.split(" ").map(name => name[0]).slice(0, 2).join("") ?? "";
  return <div className="workspace-tools" ref={root}>
    <div className="global-search"><Search size={20} aria-hidden="true" /><input aria-label="Raadi (Search customers or orders)" placeholder="Raadi / Search customers or orders" value={search} onFocus={() => setPanel("search")} onChange={e => { setSearch(e.target.value); setPanel("search"); }} aria-controls="global-search-results" aria-expanded={panel === "search"} />{search && <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => { setSearch(""); setTerm(""); }}><X size={16} /></button>}
      {panel === "search" && <div className="header-panel search-results" id="global-search-results" aria-label="Search results">
        {term.length < 2 ? <p>Geli ugu yaraan laba xaraf (Enter at least two characters).</p> : customers.isError || orders.isError ? <p role="alert">Raadintu ma shaqayn. Fadlan isku day mar kale.</p> : customers.isFetching || orders.isFetching ? <p role="status">Raadinaya…</p> : <>
          <h3>Macaamiisha</h3>{customers.data?.items.map(row => <Link key={row.id} href={`/customers/${row.id}`} onClick={() => setPanel(null)}><Users size={18} /><span>{row.name}<small>{row.primaryPhone}</small></span></Link>)}
          <h3>Dalabyada</h3>{orders.data?.items.map(row => <Link key={row.id} href={`/orders/${row.id}`} onClick={() => setPanel(null)}><ShoppingBag size={18} /><span>{row.customer.name}<small>{row.orderNo}</small></span></Link>)}
          {!customers.data?.items.length && !orders.data?.items.length && <p>Wax natiijo ah lama helin.</p>}
        </>}
      </div>}
    </div>
    <div className="header-control"><button className="header-action" type="button" aria-expanded={panel === "notifications"} aria-controls="notifications-panel" onClick={() => setPanel(panel === "notifications" ? null : "notifications")}><Bell size={21} /><span className="header-action-label">Notifications</span>{attention > 0 && <span className="notification-count" aria-label={`${attention} items requiring attention`}>{attention}</span>}</button>
      {panel === "notifications" && <section className="header-panel" id="notifications-panel"><h3>Hawlaha sugaya</h3><p>Xogta hadda jirta ee shaqada.</p>{overview.isError ? <p role="alert">Lama soo rari karin ogeysiisyada.</p> : overview.isPending ? <p role="status">Raraya…</p> : <><Link href="/orders" onClick={() => setPanel(null)}><ShoppingBag size={19} /><span>{ops?.pendingOrders ?? 0} dalab ayaa sugaya<small>View orders</small></span></Link><Link href="/invoices" onClick={() => setPanel(null)}><Bell size={19} /><span>{ops?.unbilledDeliveries ?? 0} gaarsiin ayaa sugaya xisaab<small>Review delivered orders</small></span></Link></>}</section>}
    </div>
    <span className="header-divider" aria-hidden="true" />
    <div className="header-control"><button className="profile-trigger" type="button" aria-label="Profile" aria-expanded={panel === "profile"} aria-controls="profile-panel" onClick={() => setPanel(panel === "profile" ? null : "profile")}><span className="avatar">{initials || <CircleUserRound size={20} />}</span><span className="profile-label"><b>{actor?.displayName ?? "Raraya…"}</b><small>{actor?.email ?? formatRole(actor?.role)}</small></span><ChevronDown size={15} /></button>
      {panel === "profile" && <section className="header-panel profile-panel" id="profile-panel"><h3>{actor?.displayName}</h3><p>{actor?.email}</p><Link href="/settings" onClick={() => setPanel(null)}><Settings size={19} />Profile & Settings</Link><button type="button" disabled={busy} onClick={onLogout}><LogOut size={19} />Sign Out</button></section>}
    </div>
  </div>;
}
