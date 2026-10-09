"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { ArrowRight, Boxes, Plus, Receipt, Truck, Wallet } from "lucide-react";
import { api, type Actor, type PaginatedResponse } from "../lib/api";
import { businessDate, decimal, sum } from "../lib/format";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, PageHeader } from "../components/ui";

type OverviewData = {
  customers: { total: number; active: number; hold: number };
  stock: { warehouse: Record<string, string>; inTransit: Record<string, string> };
  operations: { pendingOrders: number; dispatched: number; unbilledDeliveries: number };
  financials: { totalOutstandingDebt: string; totalUnappliedCredit: string };
};
type AnalyticsData = {
  period: { from: string; to: string };
  salesTrend: Array<{ date: string; amount: string }>;
  collectionsTrend: Array<{ date: string; amount: string }>;
  fuelBreakdown: Array<{ fuel: string; acceptedLiters: string }>;
  topRevenue: Array<{ name: string; revenue: string }>;
  topDebt: Array<{ name: string; debt: string }>;
};
type RecentOrder = { id: string; orderNo: string; customer: { name: string }; status: string; lines: Array<{ requestedUnits: string; fuel: { displayName: string } }> };

function SalesChart({ data }: { data: AnalyticsData }) {
  const dates = [...new Set([...data.salesTrend, ...data.collectionsTrend].map(p => p.date))].sort();
  if (!dates.length) return <Empty>No sales or collections in this period.</Empty>;
  const points = dates.map(date => ({ date, sales: data.salesTrend.find(p => p.date === date)?.amount ?? "0", collections: data.collectionsTrend.find(p => p.date === date)?.amount ?? "0" }));
  const max = Decimal.max(1, ...points.flatMap(p => [p.sales, p.collections]));
  return <div className="chart"><div className="chart-scroll"><div className="chart-bars" role="img" aria-label="Invoice sales and payment collections by date. Exact values are available in the data table below.">{points.map(p => <div className="chart-day" key={p.date} title={`${p.date}: sales $${decimal(p.sales)}, collections $${decimal(p.collections)}`}><div className="chart-bar" style={{ height: `${new Decimal(p.sales).div(max).times(95).toString()}%` }} /><div className="chart-bar collections" style={{ height: `${new Decimal(p.collections).div(max).times(95).toString()}%` }} /></div>)}</div></div><div className="chart-legend"><span><i />Invoice revenue</span><span><i />Collections</span></div><details className="chart-data"><summary>View exact daily values</summary><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Sales</th><th>Collections</th></tr></thead><tbody>{points.map(p => <tr key={p.date}><td>{p.date}</td><td>${decimal(p.sales)}</td><td>${decimal(p.collections)}</td></tr>)}</tbody></table></div></details></div>;
}
export default function HomePage() {
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString().slice(0, 10); });
  const [toDate, setToDate] = useState(businessDate);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const overview = useQuery({ queryKey: ["dashboard", "overview"], queryFn: () => api<OverviewData>("/dashboard/overview") });
  const analytics = useQuery({ queryKey: ["dashboard", "analytics", fromDate, toDate], queryFn: () => api<AnalyticsData>(`/dashboard/analytics?fromDate=${fromDate}&toDate=${toDate}`) });
  const orders = useQuery({ queryKey: ["orders", "dashboard"], queryFn: () => api<PaginatedResponse<RecentOrder>>("/orders?page=1&limit=5") });
  const ov = overview.data; const an = analytics.data;
  return <main className="page dashboard-page"><PageHeader eyebrow="Your daily overview" title={`Welcome back${me.data ? `, ${me.data.displayName.split(" ")[0]}` : ""}.`} description="Here is where your fuel business stands today." actions={<><Link className="btn" href="/stock/receive">Receive tanker</Link><Link className="btn primary" href="/orders/new"><Plus size={15} />Create order</Link></>} />
    <div className="date-range"><label>From<input type="date" value={fromDate} max={toDate} onChange={e => setFromDate(e.target.value)} /></label><label>To<input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)} /></label><span className="range-caption">Business dates · Africa/Mogadishu</span></div>
    {overview.isError ? <ErrorState message={overview.error.message} retry={() => void overview.refetch()} /> : overview.isLoading ? <LoadingState /> : <div className="grid"><MetricCard label="Invoiced sales" value={an ? `$${decimal(sum(an.salesTrend.map(p => p.amount)))}` : "—"} note="In selected period" icon={Receipt} /><MetricCard label="Customer debt" value={`$${decimal(ov?.financials.totalOutstandingDebt)}`} note="Outstanding posted invoices" icon={Wallet} /><MetricCard label="Collected payments" value={an ? `$${decimal(sum(an.collectionsTrend.map(p => p.amount)))}` : "—"} note="In selected period" icon={Receipt} /><MetricCard label="Active dispatches" value={ov?.operations.dispatched ?? "—"} note="Physical fuel movements" icon={Truck} dark /></div>}
    <div className="dashboard-grid"><Card><CardHead title="Sales & collections" description="Money received is shown separately from invoiced revenue." action={<Link className="btn small" href="/reports">View reports <ArrowRight size={14} /></Link>} />{analytics.isError ? <ErrorState message={analytics.error.message} retry={() => void analytics.refetch()} /> : an ? <SalesChart data={an} /> : <LoadingState />}</Card><Card><CardHead title="Fuel on hand" description="Warehouse stock, excluding in-transit fuel." action={<Link className="btn small" href="/stock"><Boxes size={14} />Inventory</Link>} /><div className="card-body">{["DIESEL", "PETROL"].map(fuel => <div className="fuel-stock" key={fuel}><h3>{fuel === "DIESEL" ? "Diesel · Naafto" : "Petrol · Basiin"}</h3><strong className="mono">{decimal(ov?.stock.warehouse[fuel], 3)} <small className="inline-unit">L</small></strong><small>In transit: {decimal(ov?.stock.inTransit[fuel], 3)} L</small></div>)}</div></Card></div>
    <div className="dashboard-grid"><Card><CardHead title="Recent orders" description="Latest customer requests and fulfillment status." action={<Link className="btn small" href="/orders">All orders <ArrowRight size={14} /></Link>} />{orders.isError ? <ErrorState message={orders.error.message} retry={() => void orders.refetch()} /> : orders.isLoading ? <LoadingState /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Fuel / units</th><th>Status</th><th /></tr></thead><tbody>{orders.data?.items.map(o => <tr key={o.id}><td className="strong">{o.orderNo}</td><td>{o.customer.name}</td><td>{o.lines.map(l => `${l.fuel.displayName} · ${l.requestedUnits}`).join(", ")}</td><td><Badge tone={o.status === "FULFILLED" ? "ok" : "info"}>{o.status}</Badge></td><td><Link className="btn small" href={`/orders/${o.id}`}>Open</Link></td></tr>)}</tbody></table>{!orders.data?.items.length && <Empty>No orders recorded yet.</Empty>}</div>}</Card><Card><CardHead title="Daily priorities" description="What needs attention next." /><div className="card-body"><Link className="priority-link" href="/dispatches"><b>{ov?.operations.dispatched ?? "—"}</b>Dispatches to review<ArrowRight size={14} /></Link><Link className="priority-link" href="/orders"><b>{ov?.operations.pendingOrders ?? "—"}</b>Pending orders<ArrowRight size={14} /></Link><Link className="priority-link" href="/invoices"><b>{ov?.operations.unbilledDeliveries ?? "—"}</b>Unbilled deliveries<ArrowRight size={14} /></Link><div className="info-pair"><span>Unapplied customer credit</span><b>${decimal(ov?.financials.totalUnappliedCredit)}</b></div></div></Card></div>
    <div className="two-col equal-cols"><Card><CardHead title="Top customers by revenue" description="Confirmed invoice totals in the selected period." /><div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Revenue</th></tr></thead><tbody>{an?.topRevenue.map(c => <tr key={c.name}><td className="strong">{c.name}</td><td className="mono">${decimal(c.revenue)}</td></tr>)}</tbody></table>{an && !an.topRevenue.length && <Empty>No invoiced sales in this period.</Empty>}</div></Card><Card><CardHead title="Customer balances" description="Highest outstanding amounts." action={<Link className="btn small" href="/debts">Debt center</Link>} /><div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Outstanding</th></tr></thead><tbody>{an?.topDebt.map(c => <tr key={c.name}><td className="strong">{c.name}</td><td className="mono text-rose-400">${decimal(c.debt)}</td></tr>)}</tbody></table>{an && !an.topDebt.length && <Empty>No outstanding balances.</Empty>}</div></Card></div>
    <Card><CardHead title="Accepted fuel deliveries" description="Actual delivered liters in the selected period." /><div className="card-body">{an?.fuelBreakdown.map(f => <div className="info-pair" key={f.fuel}><span>{f.fuel}</span><b>{decimal(f.acceptedLiters, 3)} L</b></div>)}{an && !an.fuelBreakdown.length && <Empty>No accepted deliveries in this period.</Empty>}</div></Card>
  </main>;
}
