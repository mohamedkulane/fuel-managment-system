"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

type DebtSummaryData = {
  totals: {
    totalInvoiced: string;
    totalPaid: string;
    outstandingDebt: string;
    unappliedCredit: string;
    netPosition: string;
  };
  customers: Array<{
    customerId: string;
    code: string;
    name: string;
    primaryPhone: string | null;
    status: string;
    totalInvoiced: string;
    totalPaid: string;
    outstandingDebt: string;
    unappliedCredit: string;
    netBalance: string;
    aging: {
      current: string;
      days31To60: string;
      days61To90: string;
      days90Plus: string;
    };
  }>;
};

export default function DebtsPage() {
  const debtsQuery = useQuery({
    queryKey: ["debts"],
    queryFn: () => api<DebtSummaryData>("/financial/debts")
  });

  return (
    <main className="page space-y-6">
      <header className="page-header">
        <div>
          <h1 className="title">Accounts Receivable & Debt Overview</h1>
          <p className="subtitle">Real-time customer outstanding debt, aging buckets, and unapplied credits</p>
        </div>
        <Link href="/payments" className="btn primary">
          + Record Payment
        </Link>
      </header>

      {debtsQuery.isLoading ? (
        <div className="skeleton tall" />
      ) : debtsQuery.isError || !debtsQuery.data ? (
        <div className="callout error">Failed to load financial debts summary.</div>
      ) : (
        <>
          {/* Global Summary KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <span className="text-muted text-xs">Total Outstanding Debt</span>
              <div className="text-2xl font-mono font-bold text-rose-400">
                ${parseFloat(debtsQuery.data.totals.outstandingDebt).toFixed(2)}
              </div>
            </div>
            <div className="card">
              <span className="text-muted text-xs">Unapplied Customer Credit</span>
              <div className="text-2xl font-mono font-bold text-amber-400">
                ${parseFloat(debtsQuery.data.totals.unappliedCredit).toFixed(2)}
              </div>
            </div>
            <div className="card">
              <span className="text-muted text-xs">Net Receivables Position</span>
              <div className="text-2xl font-mono font-bold text-emerald-400">
                ${parseFloat(debtsQuery.data.totals.netPosition).toFixed(2)}
              </div>
            </div>
            <div className="card">
              <span className="text-muted text-xs">Total Payments Collected</span>
              <div className="text-2xl font-mono font-bold">
                ${parseFloat(debtsQuery.data.totals.totalPaid).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Customer Receivables & Aging Table */}
          <section className="card space-y-4">
            <h2 className="section-title">Customer Subledger Accounts</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Account Status</th>
                    <th>Total Invoiced</th>
                    <th>Total Paid</th>
                    <th>Outstanding Debt</th>
                    <th>Unapplied Credit</th>
                    <th>Net Balance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {debtsQuery.data.customers.map((c) => (
                    <tr key={c.customerId}>
                      <td>
                        <Link href={`/customers/${c.customerId}`} className="link font-semibold">
                          {c.name}
                        </Link>
                        <div className="text-xs text-muted">{c.code} {c.primaryPhone ? `| ${c.primaryPhone}` : ""}</div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            c.status === "ACTIVE" ? "success" : c.status === "HOLD" ? "warning" : "neutral"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="font-mono">${parseFloat(c.totalInvoiced).toFixed(2)}</td>
                      <td className="font-mono text-emerald-400">${parseFloat(c.totalPaid).toFixed(2)}</td>
                      <td className="font-mono font-bold text-rose-400">${parseFloat(c.outstandingDebt).toFixed(2)}</td>
                      <td className="font-mono text-amber-400">${parseFloat(c.unappliedCredit).toFixed(2)}</td>
                      <td className="font-mono font-bold text-sky-400">${parseFloat(c.netBalance).toFixed(2)}</td>
                      <td>
                        <Link href={`/customers/${c.customerId}`} className="btn ghost sm">
                          View Statement
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
