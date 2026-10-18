"use client";
import { useEffect, useState } from "react";
import { ActionLink, ActionButton, FormLabel } from "../../../components/controls";
import { OrderDelivery } from "../../../components/order-delivery";
import { OrderInvoicePreview } from "../../../components/order-invoice-preview";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { ShoppingBag, Boxes, Truck, AlertCircle, Ban } from "lucide-react";
import { dateTime, sum, decimal, formatStatus, formatFuel, fuustoQuantity } from "../../../lib/format";
import { useParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { api, type Actor } from "../../../lib/api";
import { MetricCard, Badge, Card, CardHead, ErrorState, PageHeader, Modal, SubmitButton } from "../../../components/ui";
import { notifyError, notifySuccess } from "../../../lib/toast";

type OrderLine = {
  id: string;
  requestedUnits: string;
  amendedUnits?: string;
  cancelledUnits?: string;
  amendmentReason?: string | null;
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
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  addressSnapshot: string;
  subtotal: string | null;
  fixedDiscountAmount: string;
  totalAmount: string | null;
  discountReason: string | null;
  discountApprovedById: string | null;
  discountApprovedByName: string | null;
  customer: { name: string };
  lines: OrderLine[];
  events: Array<{ id: string; kind: string; occurredAt: string; reason?: string | null }>;
  payments?: Array<{
    id: string;
    amount: string;
    unappliedAmount: string;
    paymentDate: string;
    status: string;
  }>;
};

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelRemainderModalOpen, setCancelRemainderModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundAccount, setRefundAccount] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  useEffect(() => {
    setInvoiceOpen(new URLSearchParams(window.location.search).get("invoice") === "1");
  }, []);

  const query = useQuery({ queryKey: ["order", id], queryFn: () => api<Order>(`/orders/${id}`) });
  const client = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const accountsQuery = useQuery({
    queryKey: ["financial-accounts", "selectable"],
    queryFn: () => api<Array<{ id: string; name: string }>>("/financial-accounts/selectable"),
    enabled: me.data?.role === "OWNER"
  });

  const approveDiscount = useMutation({
    mutationFn: () => api(`/orders/${id}/approve-discount`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: async () => {
      await client.invalidateQueries();
      notifySuccess("Lacag-dhimista waa la ansixiyay");
    },
    onError: (error) => notifyError(error, "Ansixintu way fashilantay")
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (reason: string) => api(`/orders/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: async () => {
      await client.invalidateQueries();
      setCancelModalOpen(false);
      setCancelReason("");
      notifySuccess("Dalabka si guul leh ayaa loo joojiyay");
    },
    onError: (error) => notifyError(error, "Joojinta dalabka way fashilantay")
  });

  const cancelRemainderMutation = useMutation({
    mutationFn: (reason: string) => api(`/orders/${id}/cancel-remainder`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: async () => {
      await client.invalidateQueries();
      setCancelRemainderModalOpen(false);
      setCancelReason("");
      notifySuccess("Intii harsanayd ee dalabka waa la joojiyay");
    },
    onError: (error) => notifyError(error, "Joojinta inta harsan way fashilantay")
  });

  const keepCreditMutation = useMutation({
    mutationFn: () => api(`/simple/orders/${id}/excess-credit/keep`, { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries();
      notifySuccess("Lacagta dheeraadka ah waxaa loo haynayaa macmiilka");
    },
    onError: (err) => notifyError(err, "Hawshu way fashilantay")
  });

  const refundCreditMutation = useMutation({
    mutationFn: () => api(`/simple/orders/${id}/excess-credit/refund`, {
      method: "POST",
      body: JSON.stringify({
        amount: refundAmount || undefined,
        financialAccountId: refundAccount,
        reason: refundReason
      })
    }),
    onSuccess: async () => {
      await client.invalidateQueries();
      setRefundModalOpen(false);
      notifySuccess("Lacagta dheeraadka ah si guul leh ayaa loo celiyay");
    },
    onError: (err) => notifyError(err, "Lacag celintu way fashilantay")
  });

  if (query.isError)
    return (
      <main className="page detail-page">
        <ErrorState message={(query.error as Error).message} />
      </main>
    );

  const row = query.data;

  const isDraft = row?.status === "DRAFT";
  const isPartiallyFulfilled = row?.status === "PARTIALLY_FULFILLED";
  const isCancellable = row && ["DRAFT", "CONFIRMED", "SCHEDULED"].includes(row.status);
  const hasPriceChangeNotice = isDraft && row?.lines.some((l) => l.currentActiveUnitPrice);
  const fixedDiscountNum = row?.fixedDiscountAmount || "0";
  const hasDiscount = new Decimal(fixedDiscountNum).gt(0);
  const unappliedCredit = row?.payments?.filter(p => p.status === "POSTED").reduce((sum, p) => sum + Number(p.unappliedAmount), 0) ?? 0;

  return (
    <main className="page detail-page">
      <PageHeader
        eyebrow="Faahfaahinta dalabka"
        title={row?.orderNo ?? "Raraya dalabka…"}
        description={row ? `${row.customer.name} · ${row.addressSnapshot}` : ""}
        actions={
          <>
            <ActionLink className="btn" href="/orders">
              Dib ugu noqo
            </ActionLink>
            {row && (
              <ActionButton className="btn secondary" type="button" onClick={() => setInvoiceOpen((open) => !open)}>
                {invoiceOpen ? "Qari Rasiidka" : "Eeg Rasiidka"}
              </ActionButton>
            )}
            {row && ["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "PARTIALLY_FULFILLED"].includes(row.status) && (
              <OrderDelivery orderId={row.id} lines={row.lines} />
            )}
            {isPartiallyFulfilled && (
              <ActionButton className="btn warn" type="button" onClick={() => setCancelRemainderModalOpen(true)}>
                Jooji inta Harsan
              </ActionButton>
            )}
            {isCancellable && (
              <ActionButton className="btn danger" type="button" onClick={() => setCancelModalOpen(true)}>
                Jooji Dalabka
              </ActionButton>
            )}
          </>
        }
      />

      {row && (
        <>
          <OrderInvoicePreview orderId={row.id} orderNo={row.orderNo} open={invoiceOpen} />

          {/* Modal: Cancel Order */}
          <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Jooji Dalabka">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                cancelOrderMutation.mutate(cancelReason);
              }}
              className="space-y-4"
            >
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-600 dark:text-red-400">
                <p className="font-semibold flex items-center gap-1.5">
                  <Ban size={16} /> Ma hubtaa inaad joojiso dalabkan?
                </p>
                <p className="text-xs mt-1">
                  Haddii horey lacag looga qabtay dalabkan (Paid Now), lacagtaas lama lumin doono balse waxay ku xirnaan doontaa xallinta Milkiilaha.
                </p>
              </div>

              <div className="field">
                <FormLabel htmlFor="cancel-order-reason">Sababta Joojinta (Waa qasab)</FormLabel>
                <textarea
                  id="cancel-order-reason"
                  className="input w-full min-h-[80px]"
                  placeholder="Tusaale: Macmiilku wuxuu codsaday baajinta dalabka"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                />
              </div>

              {cancelOrderMutation.isError && <ErrorState message={cancelOrderMutation.error.message} />}

              <div className="form-actions flex justify-end gap-2 pt-2">
                <ActionButton className="btn" type="button" onClick={() => setCancelModalOpen(false)}>
                  Ka noqo
                </ActionButton>
                <SubmitButton busy={cancelOrderMutation.isPending} className="btn danger">
                  Xaqiiji Joojinta
                </SubmitButton>
              </div>
            </form>
          </Modal>

          {/* Modal: Cancel Remainder */}
          <Modal isOpen={cancelRemainderModalOpen} onClose={() => setCancelRemainderModalOpen(false)} title="Jooji inta Harsan ee Dalabka">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                cancelRemainderMutation.mutate(cancelReason);
              }}
              className="space-y-4"
            >
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-700 dark:text-amber-400">
                <p className="font-semibold">Ma hubtaa inaad xirto inta harsan?</p>
                <p className="text-xs mt-1">
                  Shidaalkii horay loo geeyey iyo rasiidhkoodu way sideedooda ahaanayaan. Inta aan la geynin ayaa la tirtirayaa dalabkuna wuxuu noqonayaa mid dhammeystiran (Fulfilled).
                </p>
              </div>

              <div className="field">
                <FormLabel htmlFor="cancel-remainder-reason">Sababta (Waa qasab)</FormLabel>
                <textarea
                  id="cancel-remainder-reason"
                  className="input w-full min-h-[80px]"
                  placeholder="Tusaale: Macmiilku wuxuu qaatay qeyb, inta dhimanna uma baahna"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                />
              </div>

              {cancelRemainderMutation.isError && <ErrorState message={cancelRemainderMutation.error.message} />}

              <div className="form-actions flex justify-end gap-2 pt-2">
                <ActionButton className="btn" type="button" onClick={() => setCancelRemainderModalOpen(false)}>
                  Ka noqo
                </ActionButton>
                <SubmitButton busy={cancelRemainderMutation.isPending} className="btn warn">
                  Jooji inta Harsan
                </SubmitButton>
              </div>
            </form>
          </Modal>

          {/* Modal: Refund Excess Credit */}
          <Modal isOpen={refundModalOpen} onClose={() => setRefundModalOpen(false)} title="U Celi Lacagta Dheeraadka ah Macmiilka">
            <form onSubmit={(e) => { e.preventDefault(); refundCreditMutation.mutate(); }}>
              <div className="notice warn" style={{ marginBottom: 12 }}>
                Waxaad macmiilka u celinaysaa lacag dhan <strong>${decimal(refundAmount || String(unappliedCredit))}</strong> oo ah lacag hore loo bixiyey oo aan shidaal lagu qaadan.
              </div>
              <div className="form-grid">
                <div className="field full">
                  <FormLabel htmlFor="refund-amount">Qadarka Lacagta la Celinayo ($) *</FormLabel>
                  <input
                    id="refund-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={unappliedCredit}
                    className="input"
                    required
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                  />
                  <small className="text-muted" style={{ display: "block", marginTop: 2 }}>
                    Wadarta lacagta celinta u furan: <strong>${decimal(String(unappliedCredit))}</strong>
                  </small>
                </div>
                <div className="field full">
                  <FormLabel htmlFor="refund-account">Akoonka Lacagta Laga Celinayo *</FormLabel>
                  <select id="refund-account" className="select" required value={refundAccount} onChange={(e) => setRefundAccount(e.target.value)}>
                    <option value="">Dooro akoonka lacagta laga celinayo</option>
                    {accountsQuery.data?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="field full">
                  <FormLabel htmlFor="refund-reason">Sababta Celinta *</FormLabel>
                  <input id="refund-reason" className="input" required value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="tusaale: Shidaal aan la geynin oo lacagtiisii dib loogu celiyay macmiilka" />
                </div>
              </div>
              {refundCreditMutation.isError && <ErrorState message={refundCreditMutation.error.message} />}
              <div className="form-actions" style={{ marginTop: 16 }}>
                <ActionButton type="button" className="btn" onClick={() => setRefundModalOpen(false)}>Ka noqo</ActionButton>
                <SubmitButton busy={refundCreditMutation.isPending} className="btn danger" disabled={!refundAmount || Number(refundAmount) <= 0 || Number(refundAmount) > unappliedCredit}>Xaqiiji Celinta</SubmitButton>
              </div>
            </form>
          </Modal>

          {unappliedCredit > 0 && (
            <div className="notice warn" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <strong>Lacag Dheeraad ah oo Xallin u Baahan:</strong> Waxaa dalabkan ku taal <b>${decimal(String(unappliedCredit))}</b> oo horey loo bixiyey balse aan shidaal lagu qaadan.
              </div>
              {me.data?.role === "OWNER" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <ActionButton className="btn primary small" disabled={keepCreditMutation.isPending} onClick={() => keepCreditMutation.mutate()}>
                    U Hay Macmiilka
                  </ActionButton>
                  <ActionButton className="btn secondary small" onClick={() => { setRefundModalOpen(true); setRefundAmount(String(unappliedCredit)); setRefundReason(`Soo celinta hadhaaga dalabka ${row.orderNo}`); }}>
                    U Celi Macmiilka
                  </ActionButton>
                </div>
              )}
            </div>
          )}

          {row.status === "CANCELLED" && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded mb-4 text-red-600 dark:text-red-400">
              <strong className="block text-sm">Dalabkan waa la joojiyay:</strong>
              <p className="text-xs mt-1">{row.cancellationReason || "Sabab lama sheegin"}</p>
            </div>
          )}

          {isDraft && hasDiscount && (
            <div className="notice">
              <p>Dhimistan waxay sugaysaa oggolaanshaha milkiilaha.</p>
              {me.data?.role === "OWNER" && (
                <ActionButton className="btn primary" disabled={approveDiscount.isPending} onClick={() => approveDiscount.mutate()}>
                  Oggolow Dhimista
                </ActionButton>
              )}
              {approveDiscount.isError && <ErrorState message={approveDiscount.error.message} />}
            </div>
          )}

          {isDraft && !hasDiscount && (
            <div className="notice warn">
              <p>Qabyadan hore waxay u baahan tahay dib u eegis milkiile. Dalabyada cusub isla markiiba waa la xaqiijiyaa.</p>
            </div>
          )}

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
              Xaaladda: <Badge tone={isDraft ? "warn" : row.status === "CANCELLED" ? "danger" : "info"}>{formatStatus(row.status)}</Badge>. Qiimayaasha iyo kuleetarka la xaqiijiyay dib isulama beddelaan marka qiimaha guud uu beddelmo.
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
                  ? `$${decimal(Decimal.max(0, new Decimal(sum(row.lines.map((l) => new Decimal(l.requestedUnits).times(l.currentActiveUnitPrice!).toString()))).minus(fixedDiscountNum)).toString())} (Qiyaas)`
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
              <CardHead title="Shidaalka dalabka & faahfaahinta" description="Tirada la codsaday, wax-ka-beddelka, qiimaha la xaqiijiyay, iyo inta la geeyey." />
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Shidaalka</th>
                      <th>La Codsaday</th>
                      <th>Kordhin / Joojin</th>
                      <th>Qiimaha Fuustada</th>
                      <th>Loo diray / La aqbalay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.lines.map((line) => {
                      const dispatched = fuustoQuantity(sum(line.dispatchLines.map((x) => x.dispatchedUnits)));
                      const accepted = fuustoQuantity(sum(line.dispatchLines.flatMap((x) => x.confirmations).map((x) => x.acceptedUnits)));
                      const hasAmended = line.amendedUnits && new Decimal(line.amendedUnits).gt(0);
                      const hasCancelled = line.cancelledUnits && new Decimal(line.cancelledUnits).gt(0);

                      return (
                        <tr key={line.id}>
                          <td className="strong">{formatFuel(line.fuel.displayName)}</td>
                          <td className="strong mono">{fuustoQuantity(line.requestedUnits)} Fuusto</td>
                          <td>
                            {hasAmended && (
                              <Badge tone="ok">+{fuustoQuantity(line.amendedUnits!)} Dheeraad</Badge>
                            )}
                            {hasCancelled && (
                              <Badge tone="warn">-{fuustoQuantity(line.cancelledUnits!)} La joojiyay</Badge>
                            )}
                            {!hasAmended && !hasCancelled && <span className="muted">—</span>}
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
                          <td className="mono muted">
                            {dispatched} loo diray / {accepted} la qaatay
                          </td>
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
                      {event.reason && <p className="text-xs text-muted mt-0.5">{event.reason}</p>}
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
