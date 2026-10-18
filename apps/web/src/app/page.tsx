"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { AlertCircle, Fuel, Wallet } from "lucide-react";
import { api, type PaginatedResponse } from "../lib/api";
import { decimal, formatFuel, formatStatus, businessDate, fuustoQuantity, orderStatusTone } from "../lib/format";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, PageHeader } from "../components/ui";
import { ActionLink } from "../components/controls";
type Overview = { stock: { warehouse: Record<string,string> }; financials: { totalOutstandingDebt: string; collectedToday: string }; operations: { pendingOrders: number } };
type Analytics = { salesTrend: { date:string; amount:string }[]; collectionsTrend: { date:string; amount:string }[]; fuelBreakdown: { fuel:string; acceptedLiters:string }[] };
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

function pieSlicePath(startAngle: number, sweepAngle: number) {
  const center = 100;
  const outerRadius = 88;
  const innerRadius = 59;
  if (sweepAngle >= 359.99) return `M ${center} ${center - outerRadius} A ${outerRadius} ${outerRadius} 0 1 1 ${center} ${center + outerRadius} A ${outerRadius} ${outerRadius} 0 1 1 ${center} ${center - outerRadius} Z M ${center} ${center - innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 ${center} ${center + innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 ${center} ${center - innerRadius} Z`;
  const start = (startAngle * Math.PI) / 180;
  const end = ((startAngle + sweepAngle) * Math.PI) / 180;
  const outerStartX = center + outerRadius * Math.cos(start);
  const outerStartY = center + outerRadius * Math.sin(start);
  const outerEndX = center + outerRadius * Math.cos(end);
  const outerEndY = center + outerRadius * Math.sin(end);
  const innerEndX = center + innerRadius * Math.cos(end);
  const innerEndY = center + innerRadius * Math.sin(end);
  const innerStartX = center + innerRadius * Math.cos(start);
  const innerStartY = center + innerRadius * Math.sin(start);
  const largeArc = sweepAngle > 180 ? 1 : 0;
  return `M ${outerStartX} ${outerStartY} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStartX} ${innerStartY} Z`;
}

export default function HomePage() {
  const today = businessDate();
  const currentYear = Number(today.slice(0, 4));
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showSales, setShowSales] = useState(true);
  const [showCollections, setShowCollections] = useState(true);
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
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
  const fuelSales = (code: string) => new Decimal(analytics.data?.fuelBreakdown.find(row => row.fuel === code)?.acceptedLiters ?? "0");
  const dieselLiters = fuelSales("DIESEL");
  const petrolLiters = fuelSales("PETROL");
  const totalFuelLiters = dieselLiters.add(petrolLiters);
  const dieselShare = totalFuelLiters.isZero() ? new Decimal(0) : dieselLiters.div(totalFuelLiters);
  const petrolShare = totalFuelLiters.isZero() ? new Decimal(0) : petrolLiters.div(totalFuelLiters);
  const leadingFuel = dieselLiters.gt(petrolLiters) ? "DIESEL" : petrolLiters.gt(dieselLiters) ? "PETROL" : null;
  const monthNames = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(selectedYear, index, 1)))
  );
  const chartPoints = months.map((month, index) => ({
    x: 20 + (920 / 11) * index,
    salesY: 190 - (peak.isZero() ? 0 : month.sales.div(peak).toNumber() * 170),
    collectionsY: 190 - (peak.isZero() ? 0 : month.collections.div(peak).toNumber() * 170)
  }));
  function smoothPath(values: { x: number; y: number }[]) {
    if (values.length === 0) return "";
    return values.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = values[index - 1]!;
      const beforePrevious = values[index - 2] ?? previous;
      const next = values[index + 1] ?? point;
      const firstControl = {
        x: previous.x + (point.x - beforePrevious.x) / 6,
        y: previous.y + (point.y - beforePrevious.y) / 6
      };
      const secondControl = {
        x: point.x - (next.x - previous.x) / 6,
        y: point.y - (next.y - previous.y) / 6
      };
      return `${path} C ${firstControl.x} ${firstControl.y}, ${secondControl.x} ${secondControl.y}, ${point.x} ${point.y}`;
    }, "");
  }
  const ov = overview.data;
  return <main className="page dashboard-page"><PageHeader eyebrow="" title="Guudmar" description="Shaqada maanta, si fudud." />
    {overview.isError ? <ErrorState message={overview.error.message} retry={()=>void overview.refetch()} /> : overview.isPending ? <LoadingState/> : <div className="grid">
      <MetricCard label="Kaydka Naaftada" value={fuustoQuantity(new Decimal(ov?.stock.warehouse.DIESEL ?? "0").div(240).toFixed(3))+" Fuusto"} note={decimal(ov?.stock.warehouse.DIESEL)+" L"} icon={Fuel} dark/>
      <MetricCard label="Kaydka Basiinka" value={fuustoQuantity(new Decimal(ov?.stock.warehouse.PETROL ?? "0").div(240).toFixed(3))+" Fuusto"} note={decimal(ov?.stock.warehouse.PETROL)+" L"} icon={Fuel}/>
      <MetricCard label="Lacagta maanta la qabtay" value={"$"+decimal(ov?.financials.collectedToday)} note="Maanta · waqtiga Muqdisho" icon={Wallet} dark/>
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
      {analytics.isError ? <ErrorState message="Chart data unavailable" retry={()=>void analytics.refetch()}/> : analytics.isPending ? <LoadingState/> : <div className="card-body cashflow-body cashflow-dashboard-layout">
        <aside className="fuel-sales-panel">
          <h3>Iibka shidaalka</h3>
          <p>Gaarsiinta la xaqiijiyey · {selectedYear}</p>
          {totalFuelLiters.isZero() ? <Empty>No accepted fuel deliveries recorded for this year.</Empty> : <>
            <div className="fuel-pie-wrap">
              <svg className="fuel-pie" viewBox="0 0 200 200" role="img" aria-label={`Fuel sales by accepted liters: diesel ${decimal(dieselLiters.toFixed(2))} liters, petrol ${decimal(petrolLiters.toFixed(2))} liters`}>
                {dieselLiters.gt(0) && petrolLiters.gt(0) ? <>
                  <path fillRule="evenodd" d={pieSlicePath(-90, dieselShare.mul(360).toNumber())} className="fuel-pie-slice fuel-pie-diesel"><title>Naafto: {decimal(dieselLiters.toFixed(2))} L</title></path>
                  <path fillRule="evenodd" d={pieSlicePath(-90 + dieselShare.mul(360).toNumber(), petrolShare.mul(360).toNumber())} className="fuel-pie-slice fuel-pie-petrol"><title>Basiin: {decimal(petrolLiters.toFixed(2))} L</title></path>
                </> : <path fillRule="evenodd" d={pieSlicePath(-90, 360)} className={`fuel-pie-slice ${dieselLiters.gt(0) ? "fuel-pie-diesel" : "fuel-pie-petrol"}`}><title>{dieselLiters.gt(0) ? "Naafto" : "Basiin"}: {decimal(totalFuelLiters.toFixed(2))} L</title></path>}
              </svg>
              <div className="fuel-pie-total"><strong>{fuustoQuantity(totalFuelLiters.div(240).toFixed(2))}</strong><span>Fuusto</span></div>
            </div>
            <div className="fuel-pie-legend">
              <div className={leadingFuel === "DIESEL" ? "leading" : ""}><span><i className="fuel-pie-diesel"/>Naafto{leadingFuel === "DIESEL" && <b>Ugu iib badan</b>}</span><strong>{decimal(dieselLiters.toFixed(2))} L</strong><small>{dieselShare.mul(100).toFixed(1)}% · {fuustoQuantity(dieselLiters.div(240).toFixed(2))} Fuusto</small></div>
              <div className={leadingFuel === "PETROL" ? "leading" : ""}><span><i className="fuel-pie-petrol"/>Basiin{leadingFuel === "PETROL" && <b>Ugu iib badan</b>}</span><strong>{decimal(petrolLiters.toFixed(2))} L</strong><small>{petrolShare.mul(100).toFixed(1)}% · {fuustoQuantity(petrolLiters.div(240).toFixed(2))} Fuusto</small></div>
            </div>
          </>}
        </aside>
        <section className="cashflow-trend-panel">
        <div className="cashflow-summary">
          <div><span>Lacagaha la qabtay · {selectedYear}</span><strong>${decimal(collectionsTotal.toFixed(4))}</strong></div>
          <div><span>Iibka la biil gareeyay · {selectedYear}</span><strong>${decimal(salesTotal.toFixed(4))}</strong></div>
        </div>
        <div className="cashflow-chart" aria-label={`Monthly invoiced sales and posted collections for ${selectedYear}`}>
          <div className="cashflow-axis" aria-hidden="true">
            <span>${decimal(peak.toFixed(4))}</span>
            <span>${decimal(peak.div(2).toFixed(4))}</span>
            <span>$0.00</span>
          </div>
          <div className="cashflow-main">
            <div className="cashflow-series">
              <button type="button" className={`cashflow-series-toggle ${showSales ? "selected" : ""}`} aria-pressed={showSales} onClick={() => setShowSales(value => !value || !showCollections)}><i className="cashflow-sales"/>Iibka biilka ah</button>
              <button type="button" className={`cashflow-series-toggle ${showCollections ? "selected" : ""}`} aria-pressed={showCollections} onClick={() => setShowCollections(value => !value || !showSales)}><i className="cashflow-collections"/>Lacagaha la qabtay</button>
            </div>
            <div className="cashflow-plot">
              <svg className="cashflow-lines" viewBox="0 0 960 210" preserveAspectRatio="none" role="img" aria-label="Monthly sales and collections trend">
                <line x1="20" x2="940" y1="20" y2="20" className="cashflow-gridline"/>
                <line x1="20" x2="940" y1="105" y2="105" className="cashflow-gridline"/>
                <line x1="20" x2="940" y1="190" y2="190" className="cashflow-gridline"/>
                {showSales && <path pathLength="1" d={smoothPath(chartPoints.map(point => ({ x: point.x, y: point.salesY })))} className="cashflow-line cashflow-sales"/>}
                {showCollections && <path pathLength="1" d={smoothPath(chartPoints.map(point => ({ x: point.x, y: point.collectionsY })))} className="cashflow-line cashflow-collections"/>}
                {chartPoints.map((point, index) => <g key={index}>
                  {showSales && <circle cx={point.x} cy={point.salesY} r="5" className={`cashflow-point cashflow-sales ${activeMonth === index ? "active" : ""}`} onMouseEnter={() => setActiveMonth(index)} onMouseLeave={() => setActiveMonth(null)} onFocus={() => setActiveMonth(index)} onBlur={() => setActiveMonth(null)} tabIndex={0} aria-label={`${monthNames[index]} sales ${decimal(months[index]!.sales.toFixed(2))}`}/>}
                  {showCollections && <circle cx={point.x} cy={point.collectionsY} r="5" className={`cashflow-point cashflow-collections ${activeMonth === index ? "active" : ""}`} onMouseEnter={() => setActiveMonth(index)} onMouseLeave={() => setActiveMonth(null)} onFocus={() => setActiveMonth(index)} onBlur={() => setActiveMonth(null)} tabIndex={0} aria-label={`${monthNames[index]} collections ${decimal(months[index]!.collections.toFixed(2))}`}/>}
                </g>)}
              </svg>
              {activeMonth !== null && <div className={`cashflow-tooltip ${activeMonth < 2 ? "edge-start" : activeMonth > 9 ? "edge-end" : ""}`} style={{left:`${2 + (activeMonth / 11) * 96}%`}}>
                <strong>{monthNames[activeMonth]} {selectedYear}</strong>
                {showSales && <span><i className="cashflow-sales"/>Iibka biilka ah <b>${decimal(months[activeMonth]!.sales.toFixed(2))}</b></span>}
                {showCollections && <span><i className="cashflow-collections"/>Lacagaha la qabtay <b>${decimal(months[activeMonth]!.collections.toFixed(2))}</b></span>}
              </div>}
            </div>
            <div className="cashflow-month-labels" aria-hidden="true">
              {monthNames.map(month => <span key={month}>{month}</span>)}
            </div>
          </div>
        </div>
        {peak.isZero()&&<Empty>No sales or payments recorded for this year.</Empty>}
        </section>
      </div>}
    </Card>
    <Card><CardHead title="Dalabyada maanta" action={<ActionLink className="btn" href="/orders">View All Orders</ActionLink>}/>{orders.isPending ? <LoadingState/> : orders.isError ? <ErrorState message={orders.error.message} retry={()=>void orders.refetch()}/> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Macmiil</th><th>Shidaalka</th><th>Fuusto</th><th>Xaaladda</th><th/></tr></thead><tbody>{orders.data?.items.map(row=><tr key={row.id}><td className="strong">{row.customer.name}</td><td>{row.lines.map(line=>formatFuel(line.fuel.displayName)).join(", ")}</td><td>{row.lines.map(line=>fuustoQuantity(line.requestedUnits)).join(", ")}</td><td><Badge tone={orderStatusTone(row.status)}>{formatStatus(row.status)}</Badge></td><td><ActionLink className="btn" href={"/orders/"+row.id}>View</ActionLink></td></tr>)}</tbody></table>{!orders.data?.items.length && <Empty>Ma jiraan dalabyo maanta.</Empty>}</div>}</Card>
  </main>;
}
