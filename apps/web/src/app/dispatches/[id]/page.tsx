"use client";
import { ActionButton, ActionLink } from "../../../components/controls";
import { sum, decimal, formatStatus, formatFuel, fuustoQuantity } from "../../../lib/format";
import { Boxes, Truck, CircleCheck } from "lucide-react";
import { useParams } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, mutationKey } from "../../../lib/api";
import { CascadeSpinner, MetricCard, Badge, Card, CardHead, ErrorState, PageHeader } from "../../../components/ui";

type DispatchLine = {
  id: string;
  dispatchedUnits: string;
  dispatchedLiters: string;
  litersPerUnitSnapshot: string;
  orderLine: {
    fuel: { displayName: string };
    order: { orderNo: string; customer: { name: string } };
  };
  confirmations: Array<{
    id: string;
    acceptedUnits: string;
    acceptedLiters: string;
    physicalReturnedLiters: string;
  }>;
};

type DispatchDetail = {
  id: string;
  dispatchNo: string;
  status: string;
  dispatchedAt: string | null;
  postedAt: string | null;
  deliverySheet: { id: string; sheetNo: string } | null;
  lines: DispatchLine[];
};

export default function DispatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();

  const query = useQuery({
    queryKey: ["dispatch", id],
    queryFn: () => api<DispatchDetail>(`/dispatches/${id}`)
  });

  const post = useMutation({
    mutationFn: () =>
      api(`/dispatches/${id}/post`, {
        method: "POST",
        headers: { "idempotency-key": mutationKey() }
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["dispatch", id] }),
        client.invalidateQueries({ queryKey: ["dispatches"] }),
        client.invalidateQueries({ queryKey: ["stock"] })
      ]);
    }
  });

  if (query.isError) return <main className="page detail-page"><ErrorState message={(query.error as Error).message} /></main>;

  const row = query.data;

  return (
    <main className="page detail-page">
      <PageHeader
        eyebrow="Faahfaahinta dirista"
        title={row?.dispatchNo ?? "Raraya dirista…"}
        description={row ? `Xaaladda: ${formatStatus(row.status)} · ${row.deliverySheet ? `Waraaqda: ${row.deliverySheet.sheetNo}` : "Diris Toos ah"}` : ""}
        actions={
          row ? (
            <>
              {row.status === "PREPARED" && (
                <ActionButton className="btn primary" disabled={post.isPending} onClick={() => post.mutate()}>
                  {post.isPending ? <><CascadeSpinner size={16} /> Diiwaangelinaya…</> : "Diiwaangeli Dirista Rasmiga Ah"}
                </ActionButton>
              )}
              {["POSTED", "PARTIALLY_RECONCILED"].includes(row.status) && (
                <ActionLink className="btn primary" href={`/dispatches/${id}/reconcile`}>
                  Heshiisii Gaarsiinta
                </ActionLink>
              )}
              <ActionLink className="btn" href="/dispatches">
                Dib u laab Dirisyada
              </ActionLink>
            </>
          ) : undefined
        }
      />

      {post.isError && <ErrorState message={post.error.message} />}
      {row && (
        <>
          <div className="notice warn">
            <b>Dirista rasmiga ah:</b> Diiwaangelinta diristu waxay dhintaa Kaydka Bakhaarka waxayna kordhisaa Kaydka Jidka Ku Jira.
          </div>

          <div className="grid team-metrics"><MetricCard label="Litarada loo diray" value={`${decimal(sum(row.lines.map(l=>l.dispatchedLiters)))} L`} note="Shidaalka rasmiga ah ee loo diray" icon={Truck}/><MetricCard label="Litarada la aqbalay" value={`${decimal(sum(row.lines.flatMap(l=>l.confirmations.map(c=>c.acceptedLiters))))} L`} note="Aqbalada macmiilka ee la xaqiijiyay" icon={CircleCheck}/><MetricCard label="Litarada lagu soo celiyay" value={`${decimal(sum(row.lines.flatMap(l=>l.confirmations.map(c=>c.physicalReturnedLiters))))} L`} note="Lagu soo celiyay bakhaarka" icon={Boxes}/></div>
          <Card>
            <CardHead title="Xariijimaha Dalabyada Loo Diray" description="Tirada shidaalka loo diray ee fuustooyinka iyo litarada rasmiga ah" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dalabka #</th>
                    <th>Macmiilka</th>
                    <th>Shidaalka</th>
                    <th>Tirada Loo Diray</th>
                    <th>Litarada Loo Diray</th>
                    <th>La Heshiisiyay (La Aqbalay / Lagu Soo Celiyay)</th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((line) => {
                    const totalAccepted = sum(line.confirmations.map(c=>c.acceptedUnits));
                    const totalReturned = sum(line.confirmations.map(c=>c.physicalReturnedLiters));
                    return (
                      <tr key={line.id}>
                        <td>
                          <span className="strong">{line.orderLine.order.orderNo}</span>
                        </td>
                        <td>{line.orderLine.order.customer.name}</td>
                        <td>{formatFuel(line.orderLine.fuel.displayName)}</td>
                        <td className="mono strong">{fuustoQuantity(line.dispatchedUnits)} Fuusto</td>
                        <td className="mono">{decimal(line.dispatchedLiters)} L</td>
                        <td>
                          {line.confirmations.length > 0 ? (
                            <Badge tone="ok">
                              {fuustoQuantity(totalAccepted)} Fuusto la aqbalay / {decimal(totalReturned)} L lagu soo celiyay
                            </Badge>
                          ) : (
                            <Badge tone="warn">Aan la heshiisiin</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
