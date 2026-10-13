"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { AlertCircle, Fuel, Wallet } from "lucide-react";
import { api, type PaginatedResponse } from "../lib/api";
import { decimal, formatFuel, formatStatus, businessDate, fuustoQuantity } from "../lib/format";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, PageHeader } from "../components/ui";
import { ActionLink } from "../components/controls";
type Overview = { stock: { warehouse: Record<string,string> }; financials: { totalOutstandingDebt: string; collectedToday: string }; operations: { pendingOrders: number } };
type Analytics = { salesTrend: { date:string; amount:string }[]; collectionsTrend: { date:string; amount:string }[] };
type Order = { id: string; status: string; customer: { name: string }; lines: { requestedUnits: string; fuel: { displayName: string } }[] };

function monthlyTotals(analytics: Analytics, year: number) {
  const months = Array.from({ length: 12 }, () => ({ sales: new Decimal(0), collections: new Decimal(0) }));
  const yearPrefix = `${year}-`;
  for (const row of analytics.salesTrend) {
    if (!row.date.startsWith(yearPrefix)) continue;
    const month = Number(row.date.slice(5, 7)) - 1;
    if (month >= 0 && month < 12) months[month]!.sales = months[month]!.sales.add(row.amount);
  }
  for (const row of analytics.collectionsTrend) {
    if (!row.date.startsWith(yearPrefix)) continue;
    const month = Number(row.date.slice(5, 7)) - 1;
    if (month >= 0 && month < 12) months[month]!.collections = months[month]!.collections.add(row.amount);
  }
  return months;
}

export default function HomePage() {
  const today = businessDate();
  const currentYear = Number(today.slice(0, 4));
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const overview = useQuery({ queryKey:["dashboard","overview"], queryFn:()=>api<Overview>("/dashboard/overview") });
  const orders = useQuery({ queryKey:["orders","dashboard",today], queryFn:()=>api<PaginatedResponse<Order>>("/orders?date="+today+"&limit=5") });
  const fromDate = `${selectedYear}-01-01`;
  const toDate = selectedYear === currentYear ? today : `${selectedYear}-12-31`;
  const analytics = useQuery({
    queryKey:["dashboard","analytics",selectedYear],
    queryFn:()=>api<Analytics>(`/dashboard/analytics?fromDate=${fromDate}&toDate=${toDate}`)
  });
  const months = analytics.data ? monthlyTotals(analytics.data, selectedYear) : [];
  const salesTotal = months.reduce((total, month) => total.add(month.sales), new Decimal(0));
  const collectionsTotal = months.reduce((total, month) => total.add(month.collections), new Decimal(0));
  const peak = months.reduce((maximum, month) => Decimal.max(maximum, month.sales, month.collections), new Decimal(0));
  const monthNames = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(selectedYear, index, 1)))
  );
  const ov = overview.data;
  return <main className="page dashboard-page"><PageHeader eyebrow="" title="Guudmar" description="Shaqada maanta, si fudud." />
    {overview.isError ? <ErrorState message={overview.error.message} retry={()=>void overview.refetch()} /> : overview.isPending ? <LoadingState/> : <div className="grid">
      <MetricCard label="Kaydka Naaftada" value={fuustoQuantity(new Decimal(ov?.stock.warehouse.DIESEL ?? "0").div(240).toFixed(3))+" Fuusto"} note={decimal(ov?.stock.warehouse.DIESEL)+" L"} icon={Fuel}/>
      <MetricCard label="Kaydka Basiinka" value={fuustoQuantity(new Decimal(ov?.stock.warehouse.PETROL ?? "0").div(240).toFixed(3))+" Fuusto"} note={decimal(ov?.stock.warehouse.PETROL)+" L"} icon={Fuel}/>
      <MetricCard label="Lacagta maanta la qabtay" value={"$"+decimal(ov?.financials.collectedToday)} note="Maanta · waqtiga Muqdisho" icon={Wallet}/>
      <MetricCard label="Deynta macaamiisha hadda" value={"$"+decimal(ov?.financials.totalOutstandingDebt)} note="Shidaalka la geeyey ee aan la bixin" icon={Wallet}/>
    </div>}
    <div className="quick-actions"><ActionLink className="btn primary" href="/orders/new">New Order</ActionLink><ActionLink className="btn" href="/customers?new=1">New Customer</ActionLink><ActionLink className="btn" href="/stock/receive">Receive Stock</ActionLink></div>
    {!!ov?.operations.pendingOrders && <div className="simple-alert"><AlertCircle size={23}/><strong>{ov.operations.pendingOrders} dalab ayaa sugaya gaarsiin</strong><ActionLink className="btn" href="/orders">View Orders</ActionLink></div>}
    <Card className="cashflow-card">
      <CardHead
        title="Iibka iyo lacagaha la qabtay"
        description="Xogta dhabta ah ee biilasha la xaqiijiyey iyo lacagaha la diiwaangeliyey"
        action={<label className="cashflow-year">Sanadka <select className="select" aria-label="Sanadka jaantuska" value={selectedYear} onChange={event=>setSelectedYear(Number(event.target.value))}>{Array.from({length:5},(_,index)=>currentYear-index).map(year=><option key={year} value={year}>{year}</option>)}</select></label>}
      />
      {analytics.isError ? <ErrorState message="Chart data unavailable" retry={()=>void analytics.refetch()}/> : analytics.isPending ? <LoadingState/> : <div className="card-body cashflow-body">
        <div className="cashflow-summary">
          <div><span>Lacagaha la qabtay · {selectedYear}</span><strong>${decimal(collectionsTotal.toFixed(4))}</strong></div>
          <div><span>Iibka la biil gareeyay · {selectedYear}</span><strong>${decimal(salesTotal.toFixed(4))}</strong></div>
        </div>
        <div className="cashflow-chart" role="img" aria-label={`Monthly invoiced sales and posted collections for ${selectedYear}`}>
          <div className="cashflow-axis" aria-hidden="true">
            <span>${decimal(peak.toFixed(4))}</span>
            <span>${decimal(peak.div(2).toFixed(4))}</span>
            <span>$0.00</span>
          </div>
          <div className="cashflow-main">
            <div className="cashflow-plot">
              <div className="cashflow-gridline top"/>
              <div className="cashflow-gridline middle"/>
              <div className="cashflow-columns">
                {months.map((month,index)=>{
                  const salesHeight=peak.isZero()?0:month.sales.div(peak).mul(100).toNumber();
                  const collectionsHeight=peak.isZero()?0:month.collections.div(peak).mul(100).toNumber();
                  const monthName=monthNames[index]!;
                  return <div className="cashflow-month" key={index} title={`${monthName}: sales $${decimal(month.sales.toFixed(4))}, collections $${decimal(month.collections.toFixed(4))}`}>
                    <div className="cashflow-bars">
                      <i className="cashflow-sales" style={{height:`${salesHeight}%`}}/>
                      <i className="cashflow-collections" style={{height:`${collectionsHeight}%`}}/>
                    </div>
                    <span>{monthName}</span>
                  </div>;
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="cashflow-legend"><span><i className="cashflow-sales"/>Iibka biilka ah</span><span><i className="cashflow-collections"/>Lacagaha la qabtay</span></div>
        {peak.isZero()&&<Empty>No sales or payments recorded for this year.</Empty>}
      </div>}
    </Card>
    <Card><CardHead title="Dalabyada maanta" action={<ActionLink className="btn" href="/orders">View All Orders</ActionLink>}/>{orders.isPending ? <LoadingState/> : orders.isError ? <ErrorState message={orders.error.message} retry={()=>void orders.refetch()}/> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Macmiil</th><th>Shidaalka</th><th>Fuusto</th><th>Xaaladda</th><th/></tr></thead><tbody>{orders.data?.items.map(row=><tr key={row.id}><td className="strong">{row.customer.name}</td><td>{row.lines.map(line=>formatFuel(line.fuel.displayName)).join(", ")}</td><td>{row.lines.map(line=>fuustoQuantity(line.requestedUnits)).join(", ")}</td><td><Badge tone={row.status==="FULFILLED"?"ok":"warn"}>{formatStatus(row.status)}</Badge></td><td><ActionLink className="btn" href={"/orders/"+row.id}>View</ActionLink></td></tr>)}</tbody></table>{!orders.data?.items.length && <Empty>Ma jiraan dalabyo maanta.</Empty>}</div>}</Card>
  </main>;
}
