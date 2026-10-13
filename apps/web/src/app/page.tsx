"use client";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { AlertCircle, Fuel, Wallet } from "lucide-react";
import { api, type PaginatedResponse } from "../lib/api";
import { decimal, formatFuel, formatStatus, businessDate } from "../lib/format";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, PageHeader } from "../components/ui";
import { ActionLink } from "../components/controls";
type Overview = { stock: { warehouse: Record<string,string> }; financials: { totalOutstandingDebt: string; collectedToday: string }; operations: { pendingOrders: number } };
type Analytics = { salesTrend: { date:string; amount:string }[]; collectionsTrend: { date:string; amount:string }[] };
type Order = { id: string; status: string; customer: { name: string }; lines: { requestedUnits: string; fuel: { displayName: string } }[] };
export default function HomePage() {
  const today = businessDate();
  const overview = useQuery({ queryKey:["dashboard","overview"], queryFn:()=>api<Overview>("/dashboard/overview") });
  const orders = useQuery({ queryKey:["orders","dashboard",today], queryFn:()=>api<PaginatedResponse<Order>>("/orders?date="+today+"&limit=5") });
  const analytics = useQuery({ queryKey:["dashboard","analytics"], queryFn:()=>api<Analytics>("/dashboard/analytics?fromDate="+new Date(Date.now()-29*86400000).toISOString().slice(0,10)+"&toDate="+today) });
  const ov = overview.data;
  return <main className="page dashboard-page"><PageHeader eyebrow="" title="Guudmar" description="Shaqada maanta, si fudud." />
    {overview.isError ? <ErrorState message={overview.error.message} retry={()=>void overview.refetch()} /> : overview.isPending ? <LoadingState/> : <div className="grid">
      <MetricCard label="Kaydka Naaftada" value={decimal(new Decimal(ov?.stock.warehouse.DIESEL ?? "0").div(240).toString())+" Fuusto"} note={decimal(ov?.stock.warehouse.DIESEL)+" L"} icon={Fuel}/>
      <MetricCard label="Kaydka Basiinka" value={decimal(new Decimal(ov?.stock.warehouse.PETROL ?? "0").div(240).toString())+" Fuusto"} note={decimal(ov?.stock.warehouse.PETROL)+" L"} icon={Fuel}/>
      <MetricCard label="Lacagta maanta la qabtay" value={"$"+decimal(ov?.financials.collectedToday)} note="Maanta · waqtiga Muqdisho" icon={Wallet}/>
      <MetricCard label="Deynta macaamiisha hadda" value={"$"+decimal(ov?.financials.totalOutstandingDebt)} note="Shidaalka la geeyey ee aan la bixin" icon={Wallet}/>
    </div>}
    <div className="quick-actions"><ActionLink className="btn primary" href="/orders/new">New Order</ActionLink><ActionLink className="btn" href="/customers?new=1">New Customer</ActionLink><ActionLink className="btn" href="/stock/receive">Receive Stock</ActionLink></div>
    {!!ov?.operations.pendingOrders && <div className="simple-alert"><AlertCircle size={23}/><strong>{ov.operations.pendingOrders} dalab ayaa sugaya gaarsiin</strong><ActionLink className="btn" href="/orders">View Orders</ActionLink></div>}
    <Card><CardHead title="Sales vs payments" description="Last 30 days · confirmed invoices and posted collections" />{analytics.isError?<ErrorState message="Chart data unavailable" retry={()=>void analytics.refetch()}/>:analytics.isPending?<LoadingState/>:<div className="card-body"><div className="trend-chart">{Array.from({length:30},(_,i)=>{const date=new Date();date.setDate(date.getDate()-29+i);const key=date.toISOString().slice(0,10);const sales=Number(analytics.data?.salesTrend.find(x=>x.date===key)?.amount??0);const paid=Number(analytics.data?.collectionsTrend.find(x=>x.date===key)?.amount??0);const max=Math.max(1,...(analytics.data?.salesTrend??[]).map(x=>Number(x.amount)),...(analytics.data?.collectionsTrend??[]).map(x=>Number(x.amount)));return <div className="trend-day" key={key} title={`${key}: sales $${sales.toFixed(2)}, payments $${paid.toFixed(2)}`}><span className="trend-bars"><i className="trend-sales" style={{height:`${Math.max(3,sales/max*100)}%`}}/><i className="trend-paid" style={{height:`${Math.max(3,paid/max*100)}%`}}/></span><small>{i%5===0?key.slice(5):""}</small></div>})}</div><div className="trend-legend"><span><i className="legend-sales"/>Sales</span><span><i className="legend-paid"/>Payments</span></div>{!(analytics.data?.salesTrend.length||analytics.data?.collectionsTrend.length)&&<Empty>No sales or payments in this period.</Empty>}</div>}</Card>
    <Card><CardHead title="Dalabyada maanta" action={<ActionLink className="btn" href="/orders">View All Orders</ActionLink>}/>{orders.isPending ? <LoadingState/> : orders.isError ? <ErrorState message={orders.error.message} retry={()=>void orders.refetch()}/> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Macmiil</th><th>Shidaalka</th><th>Fuusto</th><th>Xaaladda</th><th/></tr></thead><tbody>{orders.data?.items.map(row=><tr key={row.id}><td className="strong">{row.customer.name}</td><td>{row.lines.map(line=>formatFuel(line.fuel.displayName)).join(", ")}</td><td>{row.lines.map(line=>decimal(line.requestedUnits)).join(", ")}</td><td><Badge tone={row.status==="FULFILLED"?"ok":"warn"}>{formatStatus(row.status)}</Badge></td><td><ActionLink className="btn" href={"/orders/"+row.id}>View</ActionLink></td></tr>)}</tbody></table>{!orders.data?.items.length && <Empty>Ma jiraan dalabyo maanta.</Empty>}</div>}</Card>
  </main>;
}
