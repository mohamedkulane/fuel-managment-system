"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, mutationKey } from "../../../lib/api";
import { Badge, Card, CardHead, ErrorState, PageHeader } from "../../../components/ui";

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

  if (query.isError) return <main className="page"><ErrorState message={(query.error as Error).message} /></main>;

  const row = query.data;

  return (
    <main className="page">
      <PageHeader
        eyebrow="Dispatch details"
        title={row?.dispatchNo ?? "Loading dispatch…"}
        description={row ? `Status: ${row.status} · ${row.deliverySheet ? `Sheet: ${row.deliverySheet.sheetNo}` : "Direct Dispatch"}` : ""}
        actions={
          row ? (
            <>
              {row.status === "PREPARED" && (
                <button className="btn primary" disabled={post.isPending} onClick={() => post.mutate()}>
                  {post.isPending ? "Posting…" : "Post Physical Dispatch"}
                </button>
              )}
              {["POSTED", "PARTIALLY_RECONCILED"].includes(row.status) && (
                <Link className="btn primary" href={`/dispatches/${id}/reconcile`}>
                  Reconcile Delivery
                </Link>
              )}
              <Link className="btn" href="/dispatches">
                Back to Dispatches
              </Link>
            </>
          ) : undefined
        }
      />

      {row && (
        <>
          <div className="notice warn">
            <b>Operational Inventory Invariant:</b> Posting dispatch reduces Warehouse stock and increases In-Transit stock.
          </div>

          <Card>
            <CardHead title="Dispatched Order Lines" description="Dispatched fuel quantities in fuusto and actual liters" />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Customer</th>
                    <th>Fuel</th>
                    <th>Dispatched Units</th>
                    <th>Dispatched Liters</th>
                    <th>Reconciled (Accepted / Returned)</th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((line) => {
                    const totalAccepted = line.confirmations.reduce((s, c) => s + Number(c.acceptedUnits), 0);
                    const totalReturned = line.confirmations.reduce((s, c) => s + Number(c.physicalReturnedLiters), 0);
                    return (
                      <tr key={line.id}>
                        <td>
                          <span className="strong">{line.orderLine.order.orderNo}</span>
                        </td>
                        <td>{line.orderLine.order.customer.name}</td>
                        <td>{line.orderLine.fuel.displayName}</td>
                        <td className="mono strong">{line.dispatchedUnits} fuusto</td>
                        <td className="mono">{line.dispatchedLiters} L</td>
                        <td>
                          {line.confirmations.length > 0 ? (
                            <Badge tone="ok">
                              {totalAccepted} fuusto accepted / {totalReturned} L returned
                            </Badge>
                          ) : (
                            <Badge tone="warn">Unreconciled</Badge>
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
