"use client";
import { ClipboardList, Clock3, CircleCheck, Truck } from "lucide-react";
import { sum } from "../../lib/format";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { MetricCard, LoadingState, Badge, Card, CardHead, Empty, ErrorState, PageHeader } from "../../components/ui";

type Dispatch = {
  id: string;
  dispatchNo: string;
  status: string;
  dispatchedAt: string | null;
  deliverySheet: { sheetNo: string } | null;
  lines: Array<{ id: string; dispatchedUnits: string; dispatchedLiters: string }>;
};

export default function DispatchesPage() {
  const query = useQuery({
    queryKey: ["dispatches"],
    queryFn: () => api<Dispatch[]>("/dispatches")
  });

  return (
    <main className="page dispatches-page">
      <PageHeader
        eyebrow="Physical movement"
        title="Dispatch management"
        description="Follow physical fuel movement and record actual delivery acceptance."
      />

      <div className="grid"><MetricCard label="Dispatch records" value={query.data?.length ?? "—"} note="All recorded dispatches" icon={ClipboardList}/><MetricCard label="Awaiting dispatch" value={query.data?.filter(d=>d.status==="PREPARED").length ?? "—"} note="Prepared for physical movement" icon={Clock3}/><MetricCard label="Awaiting reconciliation" value={query.data?.filter(d=>["POSTED","PARTIALLY_RECONCILED"].includes(d.status)).length ?? "—"} note="Accepted and returned quantities needed" icon={Truck} dark/><MetricCard label="Reconciled" value={query.data?.filter(d=>d.status==="RECONCILED").length ?? "—"} note="Physical disposition recorded" icon={CircleCheck}/></div>
      <Card>
        <CardHead title="All Dispatches" description="Physical fuel leaves warehouse stock only when dispatch is posted" />
        {query.isLoading ? <LoadingState /> : query.isError ? (
          <ErrorState message={(query.error as Error).message} retry={() => void query.refetch()} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dispatch No</th>
                  <th>Delivery Sheet</th>
                  <th>Total Dispatched</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="strong mono" href={`/dispatches/${row.id}`}>
                        {row.dispatchNo}
                      </Link>
                    </td>
                    <td>{row.deliverySheet?.sheetNo ?? "Direct"}</td>
                    <td className="strong mono">
                      {sum(row.lines.map(l => l.dispatchedUnits))} fuusto (
                      {sum(row.lines.map(l => l.dispatchedLiters))} L)
                    </td>
                    <td>
                      <Badge
                        tone={
                          row.status === "RECONCILED"
                            ? "ok"
                            : row.status === "POSTED"
                            ? "info"
                            : row.status === "PARTIALLY_RECONCILED"
                            ? "warn"
                            : "neutral"
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="btn" href={`/dispatches/${row.id}`}>
                        View Details
                      </Link>
                      {["POSTED", "PARTIALLY_RECONCILED"].includes(row.status) && (
                        <Link className="btn primary" href={`/dispatches/${row.id}/reconcile`} style={{ marginLeft: 6 }}>
                          Reconcile
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {query.data?.length === 0 && <Empty>No dispatches recorded yet.</Empty>}
          </div>
        )}
      </Card>
    </main>
  );
}
