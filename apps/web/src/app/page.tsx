"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Badge, Card, CardHead, ErrorState, PageHeader } from "../components/ui";

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

export default function HomePage() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const overview = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => api<OverviewData>("/dashboard/overview")
  });

  const analytics = useQuery({
    queryKey: ["dashboard", "analytics", fromDate, toDate],
    queryFn: () => api<AnalyticsData>(`/dashboard/analytics?fromDate=${fromDate}&toDate=${toDate}`)
  });

  if (overview.isError) {
    return (
      <main className="page">
        <ErrorState message={(overview.error as Error).message} retry={() => void overview.refetch()} />
      </main>
    );
  }

  const ov = overview.data;
  const an = analytics.data;

  return (
    <main className="page">
      <PageHeader
        eyebrow="Executive Workspace & Operations"
        title="Business Intelligence Dashboard"
        description="Real-time fuel wholesale metrics, canonical stock levels, financial exposure, and Mogadishu date range analytics."
        actions={
          <>
            <Link className="btn" href="/stock/receive">
              Receive Tanker
            </Link>
            <Link className="btn" href="/payments">
              Record Payment
            </Link>
            <Link className="btn primary" href="/orders/new">
              New Order
            </Link>
          </>
        }
      />

      {/* Date Filter Header */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, background: "var(--card-bg, #fff)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-color, #e2e8f0)" }}>
        <strong style={{ fontSize: 14 }}>Date Filter (Mogadishu UTC+3):</strong>
        <label style={{ fontSize: 13 }}>From: </label>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc" }} />
        <label style={{ fontSize: 13 }}>To: </label>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc" }} />
        <Link className="btn small" href={`/reports`} style={{ marginLeft: "auto" }}>
          View Reports Hub →
        </Link>
      </div>

      {/* Top Level KPIs */}
      <div className="grid">
        <Card className="kpi">
          <small>Total Outstanding Debt</small>
          <strong className="mono" style={{ color: "#dc2626" }}>
            ${ov?.financials.totalOutstandingDebt ?? "0.0000"}
          </strong>
          <span>Unpaid Accounts Receivable</span>
        </Card>
        <Card className="kpi">
          <small>Total Unapplied Credit</small>
          <strong className="mono" style={{ color: "#16a34a" }}>
            ${ov?.financials.totalUnappliedCredit ?? "0.0000"}
          </strong>
          <span>Unallocated Customer Deposits</span>
        </Card>
        <Card className="kpi">
          <small>Diesel Stock (Warehouse)</small>
          <strong className="mono">{ov?.stock.warehouse.DIESEL ?? "0.000"} L</strong>
          <span>In-transit: {ov?.stock.inTransit.DIESEL ?? "0.000"} L</span>
        </Card>
        <Card className="kpi">
          <small>Petrol Stock (Warehouse)</small>
          <strong className="mono">{ov?.stock.warehouse.PETROL ?? "0.000"} L</strong>
          <span>In-transit: {ov?.stock.inTransit.PETROL ?? "0.000"} L</span>
        </Card>
        <Card className="kpi">
          <small>Operational Pipeline</small>
          <strong className="mono">{ov?.operations.pendingOrders ?? 0} Pending</strong>
          <span>{ov?.operations.unbilledDeliveries ?? 0} Unbilled Deliveries</span>
        </Card>
      </div>

      {/* Two Column Section */}
      <div className="two-col" style={{ marginTop: 20 }}>
        {/* Top 5 Revenue Customers */}
        <Card>
          <CardHead title="Top Customers by Revenue" description="Confirmed invoice totals in selected date range" action={<Link href="/reports" className="btn small">View All</Link>} />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th style={{ textAlign: "right" }}>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {an?.topRevenue.length ? (
                  an.topRevenue.map((c, i) => (
                    <tr key={i}>
                      <td className="strong">{c.name}</td>
                      <td className="mono" style={{ textAlign: "right" }}>${c.revenue}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="muted">No sales recorded in this date range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Top 5 Debt Customers */}
        <Card>
          <CardHead title="Top Customers by Outstanding Debt" description="Highest unpaid balance due" action={<Link href="/debts" className="btn small">AR Aging</Link>} />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th style={{ textAlign: "right" }}>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {an?.topDebt.length ? (
                  an.topDebt.map((c, i) => (
                    <tr key={i}>
                      <td className="strong">{c.name}</td>
                      <td className="mono" style={{ textAlign: "right", color: "#dc2626", fontWeight: "bold" }}>${c.debt}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="muted">No outstanding debts found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Analytics Summary */}
      <div className="two-col" style={{ marginTop: 20 }}>
        <Card>
          <CardHead title="Fuel Volume Fulfllment (Accepted)" description="Actual delivered fuel in liters" />
          <div className="card-body">
            {an?.fuelBreakdown.length ? (
              an.fuelBreakdown.map((f, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span><strong>{f.fuel}:</strong></span>
                  <strong className="mono">{f.acceptedLiters} Liters</strong>
                </div>
              ))
            ) : (
              <p className="muted">No completed deliveries in date range.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="System Invariants & Governance" description="Mandatory operational rules" />
          <div className="card-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
            <p style={{ marginBottom: 8 }}><strong>✓ Immutable Pricing:</strong> Invoice prices snapshot at confirmation time and never fluctuate with price list updates.</p>
            <p style={{ marginBottom: 8 }}><strong>✓ Confirmed Delivery Invoicing:</strong> Billing strictly relies on confirmed accepted physical liters.</p>
            <p style={{ marginBottom: 8 }}><strong>✓ Confidential Manifests:</strong> Driver/delivery sheets strictly isolate financial data.</p>
            <p><strong>✓ Non-destructive Ledger:</strong> Financial transactions are strictly immutable with full reversal audit trails.</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
