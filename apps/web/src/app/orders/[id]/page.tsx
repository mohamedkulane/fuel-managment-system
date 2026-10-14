"use client";
import { ActionAnchor, ActionLink, ActionButton } from "../../../components/controls";
import { OrderDelivery } from "../../../components/order-delivery";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { ShoppingBag, Boxes, Truck, AlertCircle } from "lucide-react";
import { dateTime, sum, decimal, formatStatus, formatFuel, fuustoQuantity } from "../../../lib/format";
import { useParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { api, apiBase, type Actor } from "../../../lib/api";
import { MetricCard, Badge, Card, CardHead, ErrorState, PageHeader } from "../../../components/ui";
import { notifyError, notifySuccess } from "../../../lib/toast";

type OrderLine = {
  id: string;
  requestedUnits: string;
  requestedLitersSnapshot: string | null;
  litersPerUnitSnapshot: string | null;
  unitPriceSnapshot: string | null;
  currentActiveUnitPrice?: string | null;
  currencyCode: string;
  fuel: { displayName: string };
  salesUnit: { name: string };
  dispatchLines: Array<{
    id: string;
    dispatchedUnits: string;
    confirmations: Array<{ acceptedUnits: string; physicalReturnedLiters: string }>;
  }>;
};

type Order = {
  id: string;
  orderNo: string;
  status: string;
  addressSnapshot: string;
  subtotal: string | null;
  fixedDiscountAmount: string;
  totalAmount: string | null;
  discountReason: string | null;
  discountApprovedById: string | null;
  discountApprovedByName: string | null;
  customer: { name: string };
  lines: OrderLine[];
  events: Array<{ id: string; kind: string; occurredAt: string }>;
};

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({ queryKey: ["order", id], queryFn: () => api<Order>(`/orders/${id}`) });
  const client = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const approveDiscount = useMutation({ mutationFn: () => api(`/orders/${id}/approve-discount`, { method: "POST", body: JSON.stringify({}) }), onSuccess: async () => { await client.invalidateQueries(); notifySuccess("Discount approved"); }, onError: error => notifyError(error, "Approval failed") });

  if (query.isError)
    return (
      <main className="page detail-page">
        <ErrorState message={(query.error as Error).message} />
      </main>
    );

  const row = query.data;

  const isDraft = row?.status === "DRAFT";
  const hasPriceChangeNotice = isDraft && row?.lines.some((l) => l.currentActiveUnitPrice);
  const fixedDiscountNum = row?.fixedDiscountAmount || "0";
  const hasDiscount = new Decimal(fixedDiscountNum).gt(0);

  return (
    <main className="page detail-page">
      <PageHeader
        eyebrow="Faahfaahinta dalabka"
        title={row?.orderNo ?? "Raraya dalabka…"}
        description={row ? `${row.customer.name} · ${row.addressSnapshot}` : ""}
        actions={<><ActionLink className="btn" href="/orders">Back to Orders</ActionLink>{row && row.status !== "DRAFT" && <ActionAnchor className="btn secondary" href={`${apiBase}/orders/${row.id}/invoice-pdf`} target="_blank" rel="noreferrer">Invoice</ActionAnchor>}{row && ["CONFIRMED","SCHEDULED","IN_PROGRESS","PARTIALLY_FULFILLED"].includes(row.status) && <OrderDelivery orderId={row.id} lines={row.lines}/>}</>}
      />
      {row && (
        <>
          {isDraft && hasDiscount && <div className="notice"><p>Dhimistan waxay sugaysaa oggolaanshaha milkiilaha (Owner approval).</p>{me.data?.role === "OWNER" && <ActionButton className="btn primary" disabled={approveDiscount.isPending} onClick={() => approveDiscount.mutate()}>Approve Discount</ActionButton>}{approveDiscount.isError && <ErrorState message={approveDiscount.error.message}/>}</div>}
          {isDraft && !hasDiscount && <div className="notice warn"><p>This historic draft needs Owner review. New regular orders are saved immediately.</p></div>}
          {hasPriceChangeNotice && (
            <div className="notice warn" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
              <AlertCircle size={18} />
              <div>
                <strong>Eegista Qiimaha Qabyada Ah:</strong> Qiimaha suuqa ee hadda firfircoon waa{" "}
                <b>{row.lines.map((l) => `$${l.currentActiveUnitPrice} / fuusto ee ${formatFuel(l.fuel.displayName)}`).join(", ")}</b>.
                Xaqiijinta dalabkan waxay si joogto ah u kaydin doontaa qiimayaashan.
              </div>
            </div>
          )}

          <div className="notice" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              Xaaladda: <Badge tone={isDraft ? "warn" : "info"}>{formatStatus(row.status)}</Badge>. Qiimayaasha iyo kuleetarka la xaqiijiyay dib isulama beddelaan marka qiimaha guud uu beddelmo.
            </div>
            {hasDiscount && (
              <div>
                Lacag-dhimista Tooska ah: <Badge tone={row.discountApprovedById ? "ok" : "warn"}>
                  {row.discountApprovedById ? `Waxaa ansixiyay ${row.discountApprovedByName}` : "Wuxuu sugayaa ansixinta Milkiilaha"}
                </Badge>
              </div>
            )}
          </div>

          <div className="grid team-metrics">
            <MetricCard
              label="Qiimaha Dalabka (Net)"
              value={
                row.totalAmount != null
                  ? `$${decimal(row.totalAmount)}`
                  : row.lines.every((l) => l.unitPriceSnapshot != null)
                  ? `$${decimal(new Decimal(sum(row.lines.map((l) => new Decimal(l.requestedUnits).times(l.unitPriceSnapshot!).toString()))).minus(fixedDiscountNum).toString())}`
                  : row.lines.every((l) => l.currentActiveUnitPrice != null)
                  ? `$${decimal(Decimal.max(0, new Decimal(sum(row.lines.map((l) => new Decimal(l.requestedUnits).times(l.currentActiveUnitPrice!).toString()))).minus(fixedDiscountNum)).toString())} (Kharashka qiyaasta ah)`
                  : "Aan la xaqiijin"
              }
              note={hasDiscount ? `Wadarta ka hor dhimista minus $${decimal(row.fixedDiscountAmount)} lacag-dhimis` : "Tirada la codsaday ee qiimaha la xaqiijiyay"}
              icon={ShoppingBag}
            />
            <MetricCard
              label="Tirada la codsaday"
              value={`${fuustoQuantity(sum(row.lines.map((l) => l.requestedUnits)))} Fuusto`}
              note="Fuusto la dalbaday"
              icon={Boxes}
            />
            <MetricCard
              label="Tirada la aqbalay"
              value={`${fuustoQuantity(sum(row.lines.flatMap((l) => l.dispatchLines.flatMap((d) => d.confirmations.map((c) => c.acceptedUnits)))))} Fuusto`}
              note="Fuusto uu macmiilku xaqiijiyay"
              icon={Truck}
            />
          </div>

          <div className="two-col">
            <Card>
              <CardHead title="Shidaalka dalabka & lacag-dhimista" description="Tirada la codsaday, qiimaha la xaqiijiyay, iyo lacag-dhimista lagu heshiiyay." />
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Shidaalka</th>
                      <th>La Codsaday</th>
                      <th>Kuleetarka Litarada</th>
                      <th>Qiimaha Fuustadii</th>
                      <th>Loo diray / la aqbalay / lagu soo celiyay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.lines.map((line) => {
                      const dispatched = fuustoQuantity(sum(line.dispatchLines.map((x) => x.dispatchedUnits)));
                      const accepted = fuustoQuantity(sum(line.dispatchLines.flatMap((x) => x.confirmations).map((x) => x.acceptedUnits)));
                      const returnedL = decimal(sum(line.dispatchLines.flatMap((x) => x.confirmations).map((x) => x.physicalReturnedLiters)));
                      return (
                        <tr key={line.id}>
                          <td className="strong">{formatFuel(line.fuel.displayName)}</td>
                          <td className="strong mono">{fuustoQuantity(line.requestedUnits)} Fuusto</td>
                          <td>
                            {line.litersPerUnitSnapshot
                              ? `${decimal(line.litersPerUnitSnapshot)} L / Fuusto`
                              : <span className="muted">Wuxuu noqon doonaa 240 L/fuusto marka la xaqiijiyo</span>}
                          </td>
                          <td className="strong mono">
                            {line.unitPriceSnapshot ? (
                              `${line.currencyCode} $${line.unitPriceSnapshot}`
                            ) : isDraft && line.currentActiveUnitPrice ? (
                              <span className="notice-inline" style={{ fontSize: 13 }}>
                                Qiyaas: ${line.currentActiveUnitPrice} / Fuusto
                              </span>
                            ) : (
                              "Aan la xaqiijin"
                            )}
                          </td>
                          <td className="mono muted">{dispatched} / {accepted} / {returnedL} L lagu soo celiyay</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {hasDiscount && (
                <div className="card-body border-t" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16 }}>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold">Lacag-dhimista Tooska ah ee Order-ka:</span>
                    <span className="font-mono text-emerald-400 font-bold">-${decimal(row.fixedDiscountAmount)}</span>
                  </div>
                  {row.discountReason && (
                    <div className="text-xs text-muted mt-1">
                      Sababta / Xusuusta: {row.discountReason}
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <CardHead title="Taariikhda Hawlaha Dalabka" description="Diiwaanka hawlaha la diiwaangeliyay ee dalabkan." />
              <div className="card-body">
                <ol className="timeline">
                  {row.events.map((event) => (
                    <li key={event.id}>
                      <Badge tone="info">{formatStatus(event.kind)}</Badge> <small>{dateTime(event.occurredAt)}</small>
                    </li>
                  ))}
                </ol>
              </div>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
