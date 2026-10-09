"use client";
import { PageHeader, CardHead } from "../../components/ui";
import { decimal } from "../../lib/format";
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
    <main className="page finance-page">
      <PageHeader eyebrow="Customer finance" title="Accounts receivable" description="Follow outstanding balances, unapplied credits and customer exposure." actions={<Link href="/payments" className="btn primary">Receive payment</Link>} />

      {debtsQuery.isLoading ? (
        <div className="skeleton tall" />
      ) : debtsQuery.isError || !debtsQuery.data ? (
        <div className="callout error">Failed to load financial debts summary.</div>
      ) : (
        <>
          {/* Global Summary KPI Cards */}
          <div className="grid finance-metrics">
            <div className="card">
              <span className="text-muted text-xs">Total Outstanding Debt</span>
              <div className="text-2xl font-mono font-bold text-rose-400">
                ${decimal(debtsQuery.data.totals.outstandingDebt, 2)}
              </div>
            </div>
            <div className="card">
              <span className="text-muted text-xs">Unapplied Customer Credit</span>
              <div className="text-2xl font-mono font-bold text-amber-400">
                ${decimal(debtsQuery.data.totals.unappliedCredit, 2)}
              </div>
            </div>
            <div className="card">
              <span className="text-muted text-xs">Net Receivables Position</span>
              <div className="text-2xl font-mono font-bold text-emerald-400">
                ${decimal(debtsQuery.data.totals.netPosition, 2)}
              </div>
            </div>
            <div className="card">
              <span className="text-muted text-xs">Total Payments Collected</span>
              <div className="text-2xl font-mono font-bold">
                ${decimal(debtsQuery.data.totals.totalPaid, 2)}
              </div>
            </div>
          </div>

          {/* Customer Receivables & Aging Table */}
          <section className="card"><CardHead title="Accounts receivable" description="Review records and open an account for details." />
            
            <div className="table-wrap">
              <table className="data-table">
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
                      <td className="font-mono">${decimal(c.totalInvoiced, 2)}</td>
                      <td className="font-mono text-emerald-400">${decimal(c.totalPaid, 2)}</td>
                      <td className="font-mono font-bold text-rose-400">${decimal(c.outstandingDebt, 2)}</td>
                      <td className="font-mono text-amber-400">${decimal(c.unappliedCredit, 2)}</td>
                      <td className="font-mono font-bold text-sky-400">${decimal(c.netBalance, 2)}</td>
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
