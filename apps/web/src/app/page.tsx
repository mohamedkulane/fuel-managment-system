"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { ArrowRight, Boxes, Plus, Receipt, Truck, Wallet } from "lucide-react";
import { api, type Actor, type PaginatedResponse } from "../lib/api";
import { businessDate, decimal, sum, formatStatus, formatFuel } from "../lib/format";
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
type RecentOrder = {
  id: string;
  orderNo: string;
  customer: { name: string };
  status: string;
  lines: Array<{ requestedUnits: string; fuel: { displayName: string } }>;
};

function SalesChart({ data }: { data: AnalyticsData }) {
  const dates = [...new Set([...data.salesTrend, ...data.collectionsTrend].map((p) => p.date))].sort();
  if (!dates.length) return <Empty>Ma jiraan iib ama lacag-bixin xilligan.</Empty>;
  const points = dates.map((date) => ({
    date,
    sales: data.salesTrend.find((p) => p.date === date)?.amount ?? "0",
    collections: data.collectionsTrend.find((p) => p.date === date)?.amount ?? "0"
  }));
  const max = Decimal.max(1, ...points.flatMap((p) => [p.sales, p.collections]));
  return (
    <div className="chart">
      <div className="chart-scroll">
        <div className="chart-bars" role="img" aria-label="Iibka biilasha iyo lacagaha la ururiyay marka loo eego taariikhda.">
          {points.map((p) => (
            <div
              className="chart-day"
              key={p.date}
              title={`${p.date}: iibka $${decimal(p.sales)}, lacag-bixinta $${decimal(p.collections)}`}
            >
              <div className="chart-bar" style={{ height: `${new Decimal(p.sales).div(max).times(95).toString()}%` }} />
              <div className="chart-bar collections" style={{ height: `${new Decimal(p.collections).div(max).times(95).toString()}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span><i />Dakhliga biilasha</span>
        <span><i />Lacagaha la ururiyay</span>
      </div>
      <details className="chart-data">
        <summary>Eeg qadarka maalinlaha ah ee saxda ah</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Taariikhda</th>
                <th>Iibka</th>
                <th>Lacag-bixinnada</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td>${decimal(p.sales)}</td>
                  <td>${decimal(p.collections)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default function HomePage() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(businessDate);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const overview = useQuery({ queryKey: ["dashboard", "overview"], queryFn: () => api<OverviewData>("/dashboard/overview") });
  const analytics = useQuery({
    queryKey: ["dashboard", "analytics", fromDate, toDate],
    queryFn: () => api<AnalyticsData>(`/dashboard/analytics?fromDate=${fromDate}&toDate=${toDate}`)
  });
  const orders = useQuery({ queryKey: ["orders", "dashboard"], queryFn: () => api<PaginatedResponse<RecentOrder>>("/orders?page=1&limit=5") });
  const ov = overview.data;
  const an = analytics.data;

  return (
    <main className="page dashboard-page">
      <PageHeader
        eyebrow="Guudmaradaada maalinlaha ah"
        title={`Kusoo dhawoow${me.data ? `, ${me.data.displayName.split(" ")[0]}` : ""}.`}
        description="Halkan ka eeg halka ay marayso ganacsigaaga shidaalka maanta."
        actions={
          <>
            <Link className="btn" href="/stock/receive">
              Shidaal Soo Gelin
            </Link>
            <Link className="btn primary" href="/orders/new">
              <Plus size={15} /> Dalab Cusub
            </Link>
          </>
        }
      />
      <div className="date-range">
        <label>
          Ka soo bilaabato
          <input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label>
          Ku dhamaato
          <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <span className="range-caption">Taariikhaha ganacsiga · Africa/Mogadishu</span>
      </div>
      {overview.isError ? (
        <ErrorState message={overview.error.message} retry={() => void overview.refetch()} />
      ) : overview.isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid">
          <MetricCard
            label="Iibka biilasha lagu jaray"
            value={an ? `$${decimal(sum(an.salesTrend.map((p) => p.amount)))}` : "—"}
            note="Xilliga la doortay"
            icon={Receipt}
          />
          <MetricCard
            label="Deynta macaamiisha"
            value={`$${decimal(ov?.financials.totalOutstandingDebt)}`}
            note="Biilasha la diiwaangeliyay ee harsan"
            icon={Wallet}
          />
          <MetricCard
            label="Lacagaha la ururiyay"
            value={an ? `$${decimal(sum(an.collectionsTrend.map((p) => p.amount)))}` : "—"}
            note="Xilliga la doortay"
            icon={Receipt}
          />
          <MetricCard
            label="Dirista firfircoon"
            value={ov?.operations.dispatched ?? "—"}
            note="Dhaqdhaqaaqa shidaalka"
            icon={Truck}
            dark
          />
        </div>
      )}
      <div className="dashboard-grid">
        <Card>
          <CardHead
            title="Iibka & Lacag-bixinnada"
            description="Lacagta la ururiyay waxaa lagu muujiyay si gaar ah xagga dakhliga biilasha."
            action={
              <Link className="btn small" href="/reports">
                Eeg warbixinnada <ArrowRight size={14} />
              </Link>
            }
          />
          {analytics.isError ? (
            <ErrorState message={analytics.error.message} retry={() => void analytics.refetch()} />
          ) : an ? (
            <SalesChart data={an} />
          ) : (
            <LoadingState />
          )}
        </Card>
        <Card>
          <CardHead
            title="Kaydka Shidaalka ee Bakhaarka"
            description="Kaydka bakhaarka, iyadoo aan lagu darin shidaalka jidka ku jira."
            action={
              <Link className="btn small" href="/stock">
                <Boxes size={14} /> Kaydka Shidaalka
              </Link>
            }
          />
          <div className="card-body">
            {["DIESEL", "PETROL"].map((fuel) => (
              <div className="fuel-stock" key={fuel}>
                <h3>{formatFuel(fuel)}</h3>
                <strong className="mono">
                  {decimal(ov?.stock.warehouse[fuel], 3)} <small className="inline-unit">L</small>
                </strong>
                <small>Jidka ku jira: {decimal(ov?.stock.inTransit[fuel], 3)} L</small>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="dashboard-grid">
        <Card>
          <CardHead
            title="Dalabyadii Ugu Dambeeyay"
            description="Dalabyada ugu dambeeyay ee macaamiisha iyo xaaladooda."
            action={
              <Link className="btn small" href="/orders">
                Dhammaan Dalabyada <ArrowRight size={14} />
              </Link>
            }
          />
          {orders.isError ? (
            <ErrorState message={orders.error.message} retry={() => void orders.refetch()} />
          ) : orders.isLoading ? (
            <LoadingState />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dalabka</th>
                    <th>Macmiilka</th>
                    <th>Shidaalka / Tirada</th>
                    <th>Xaaladda</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.data?.items.map((o) => (
                    <tr key={o.id}>
                      <td className="strong">{o.orderNo}</td>
                      <td>{o.customer.name}</td>
                      <td>
                        {o.lines
                          .map((l) => `${formatFuel(l.fuel.displayName)} · ${l.requestedUnits} Fuusto`)
                          .join(", ")}
                      </td>
                      <td>
                        <Badge tone={o.status === "FULFILLED" ? "ok" : "info"}>{formatStatus(o.status)}</Badge>
                      </td>
                      <td>
                        <Link className="btn small" href={`/orders/${o.id}`}>
                          Eeg
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!orders.data?.items.length && <Empty>Weli wax dalab ah ma jiraan.</Empty>}
            </div>
          )}
        </Card>
        <Card>
          <CardHead title="Ugu Horreeyaasha Maanta" description="Hawlaha u baahan fiiro gaar ah." />
          <div className="card-body">
            <Link className="priority-link" href="/dispatches">
              <b>{ov?.operations.dispatched ?? "—"}</b>
              Dirista u baahan eegista
              <ArrowRight size={14} />
            </Link>
            <Link className="priority-link" href="/orders">
              <b>{ov?.operations.pendingOrders ?? "—"}</b>
              Dalabyada sugaya
              <ArrowRight size={14} />
            </Link>
            <Link className="priority-link" href="/invoices">
              <b>{ov?.operations.unbilledDeliveries ?? "—"}</b>
              Gaarsiinta aan biilka loo jarin
              <ArrowRight size={14} />
            </Link>
            <div className="info-pair">
              <span>Deyn-dhaaf/Kireeditka macmiilka aan la isticmaalin</span>
              <b>${decimal(ov?.financials.totalUnappliedCredit)}</b>
            </div>
          </div>
        </Card>
      </div>
      <div className="two-col equal-cols">
        <Card>
          <CardHead title="Macaamiisha ugu iibka badan" description="Wadarta biilasha la xaqiijiyay ee xilliga la doortay." />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Macmiilka</th>
                  <th>Dakhliga</th>
                </tr>
              </thead>
              <tbody>
                {an?.topRevenue.map((c) => (
                  <tr key={c.name}>
                    <td className="strong">{c.name}</td>
                    <td className="mono">${decimal(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {an && !an.topRevenue.length && <Empty>Ma jiraan iib biil leh xilligan.</Empty>}
          </div>
        </Card>
        <Card>
          <CardHead
            title="Deynta Macaamiisha"
            description="Macaamiisha ugu deynta badan."
            action={
              <Link className="btn small" href="/debts">
                Xinta Deynta
              </Link>
            }
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Macmiilka</th>
                  <th>Deynta Harsan</th>
                </tr>
              </thead>
              <tbody>
                {an?.topDebt.map((c) => (
                  <tr key={c.name}>
                    <td className="strong">{c.name}</td>
                    <td className="mono text-rose-400">${decimal(c.debt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {an && !an.topDebt.length && <Empty>Ma jiraan deyn harsan.</Empty>}
          </div>
        </Card>
      </div>
      <Card>
        <CardHead title="Shidaalka la gaarsiiyay ee la aqbalay" description="Litarada rasmiga ah ee la gaarsiiyay xilliga la doortay." />
        <div className="card-body">
          {an?.fuelBreakdown.map((f) => (
            <div className="info-pair" key={f.fuel}>
              <span>{formatFuel(f.fuel)}</span>
              <b>{decimal(f.acceptedLiters, 3)} L</b>
            </div>
          ))}
          {an && !an.fuelBreakdown.length && <Empty>Ma jiraan gaarsiin la aqbalay xilligan.</Empty>}
        </div>
      </Card>
    </main>
  );
}
