"use client";
import { ClipboardList, Clock3, CircleCheck, Truck } from "lucide-react";
import { sum, formatStatus } from "../../lib/format";
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
        eyebrow="Dhaqdhaqaaqa rasmiga ah"
        title="Dhaqdhaqaaqa Dirista"
        description="La soco dhaqdhaqaaqa rasmiga ah ee shidaalka oo diiwaangeli aqbalada gaarsiinta."
      />

      <div className="grid"><MetricCard label="Diiwaannada dirista" value={query.data?.length ?? "—"} note="Dhammaan dirisyada la diiwaangeliyay" icon={ClipboardList}/><MetricCard label="Sugaya dirista" value={query.data?.filter(d=>d.status==="PREPARED").length ?? "—"} note="Loo diyaariyay dhaqdhaqaaqa rasmiga ah" icon={Clock3}/><MetricCard label="Sugaya heshiisiinta" value={query.data?.filter(d=>["POSTED","PARTIALLY_RECONCILED"].includes(d.status)).length ?? "—"} note="U baahan tirada la aqbalay iyo tan lagu soo celiyay" icon={Truck} dark/><MetricCard label="La heshiisiyay" value={query.data?.filter(d=>d.status==="RECONCILED").length ?? "—"} note="Tirada gaarsiinta ee la xaqiijiyay" icon={CircleCheck}/></div>
      <Card>
        <CardHead title="Dhammaan Dirisyada" description="Shidaalku wuxuu ka baxaa bakhaarka rasmiga ah kaliya marka dirista la diiwaangeliyo" />
        {query.isLoading ? <LoadingState /> : query.isError ? (
          <ErrorState message={(query.error as Error).message} retry={() => void query.refetch()} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lambarka Dirista</th>
                  <th>Waraaqda Gaarsiinta</th>
                  <th>Wadarta Loo Diray</th>
                  <th>Xaaladda</th>
                  <th style={{ textAlign: "right" }}>Hawgallada</th>
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
                    <td>{row.deliverySheet?.sheetNo ?? "Toos"}</td>
                    <td className="strong mono">
                      {sum(row.lines.map(l => l.dispatchedUnits))} Fuusto (
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
                        {formatStatus(row.status)}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="btn" href={`/dispatches/${row.id}`}>
                        Eeg Faahfaahinta
                      </Link>
                      {["POSTED", "PARTIALLY_RECONCILED"].includes(row.status) && (
                        <Link className="btn primary" href={`/dispatches/${row.id}/reconcile`} style={{ marginLeft: 6 }}>
                          Heshiisii
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {query.data?.length === 0 && <Empty>Weli wax diris ah lagama diiwaangelin.</Empty>}
          </div>
        )}
      </Card>
    </main>
  );
}

