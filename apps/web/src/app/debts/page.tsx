"use client";
import { ActionLink } from "../../components/controls";
import { PageHeader, CardHead } from "../../components/ui";
import { decimal, formatStatus } from "../../lib/format";

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
      <PageHeader eyebrow="Maaliyadda macaamiisha" title="Xinta Deynta & Xisaabaadka" description="La soco deynta harsan, kireeditka aan la isticmaalin iyo meesha ay xisaabta macmiilka joogto." actions={<ActionLink href="/payments" className="btn primary">Diiwaangeli Lacag-bixin</ActionLink>} />

      {debtsQuery.isLoading ? (
        <div className="skeleton tall" />
      ) : debtsQuery.isError || !debtsQuery.data ? (
        <div className="callout error">Cilad ayaa dhacday marka la rarayay xogta deynta.</div>
      ) : (
        <>
          {/* Global Summary KPI Cards */}
          <div className="grid finance-metrics">
            <div className="card">
              <span className="text-muted text-xs">Wadarta Deynta Harsan</span>
              <div className="text-2xl font-mono font-bold text-rose-400">
                ${decimal(debtsQuery.data.totals.outstandingDebt, 2)}
              </div>
            </div>
            <div className="card">
              <span className="text-muted text-xs">Kireeditka Macmiilka ee Aan La Isticmaalin</span>
              <div className="text-2xl font-mono font-bold text-amber-400">
                ${decimal(debtsQuery.data.totals.unappliedCredit, 2)}
              </div>
            </div>
            <div className="card">
              <span className="text-muted text-xs">Xaaladda Netka ee Deynta</span>
              <div className="text-2xl font-mono font-bold text-emerald-400">
                ${decimal(debtsQuery.data.totals.netPosition, 2)}
              </div>
            </div>
            <div className="card">
              <span className="text-muted text-xs">Wadarta Lacagaha La Ururiyay</span>
              <div className="text-2xl font-mono font-bold">
                ${decimal(debtsQuery.data.totals.totalPaid, 2)}
              </div>
            </div>
          </div>

          {/* Customer Receivables & Aging Table */}
          <section className="card"><CardHead title="Deynta Macaamiisha" description="Eeg diiwaannada oo fur koontada si aad u eegto faahfaahinta." />
            
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Macmiilka</th>
                    <th>Xaaladda Koontada</th>
                    <th>Wadarta Biilasha</th>
                    <th>Wadarta La Bixiyay</th>
                    <th>Deynta Harsan</th>
                    <th>Kireeditka Aan La Isticmaalin</th>
                    <th>Baalansiga Netka</th>
                    <th>Hawgallada</th>
                  </tr>
                </thead>
                <tbody>
                  {debtsQuery.data.customers.map((c) => (
                    <tr key={c.customerId}>
                      <td>
                        <ActionLink href={`/customers/${c.customerId}`} className="link font-semibold">
                          {c.name}
                        </ActionLink>
                        <div className="text-xs text-muted">{c.code} {c.primaryPhone ? `| ${c.primaryPhone}` : ""}</div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            c.status === "ACTIVE" ? "success" : c.status === "HOLD" ? "warning" : "neutral"
                          }`}
                        >
                          {formatStatus(c.status)}
                        </span>
                      </td>
                      <td className="font-mono">${decimal(c.totalInvoiced, 2)}</td>
                      <td className="font-mono text-emerald-400">${decimal(c.totalPaid, 2)}</td>
                      <td className="font-mono font-bold text-rose-400">${decimal(c.outstandingDebt, 2)}</td>
                      <td className="font-mono text-amber-400">${decimal(c.unappliedCredit, 2)}</td>
                      <td className="font-mono font-bold text-sky-400">${decimal(c.netBalance, 2)}</td>
                      <td>
                        <ActionLink href={`/customers/${c.customerId}`} className="btn ghost sm">
                          Eeg Warbixinta
                        </ActionLink>
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

