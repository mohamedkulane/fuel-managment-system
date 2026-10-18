"use client";

import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { Banknote, Clock3, PackageCheck, Receipt, ShieldAlert, Wallet } from "lucide-react";
import { ActionButton, ActionLink, FormLabel } from "./controls";
import { PdfButton } from "./pdf-button";
import { PaymentDialog } from "./simple-forms";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, SubmitButton } from "./ui";
import { api, ApiError, mutationKey, type Actor } from "../lib/api";
import { businessDate, dateTime, decimal, formatFuel, formatStatus, orderStatusTone } from "../lib/format";
import { notifyError, notifySuccess } from "../lib/toast";
import { so } from "../lib/so";

type Customer = { id: string; name: string; primaryPhone: string | null; status: string; notes: string | null; addresses: { addressText: string }[] };
type AccountPayment = { id: string; paymentNo: string; displayReference: string; paymentDate: string; method: string; amount: string; status: "POSTED" | "REVERSED"; relationLabel: string; relatedOrders: { id: string; orderNo: string }[]; recordedBy: string; accountName:string; reversalReason: string | null; reversedAt: string | null };
type OrderPayment = { id: string; paymentId: string; date: string; amount: string; method: string; status: "POSTED" | "REVERSED"; reference: string; kind: string; recordedBy: string; reversalReason: string | null };
type AccountOrder = { id: string; orderNo: string; orderDate: string; status: string; fuel: string; requestedFuusto: string; acceptedFuusto: string; agreedTotal: string; deliveredTotal: string; paidOnOrder: string; pendingRemaining: string; debt: string; moneyToReview: string; stage: "PENDING" | "PARTIAL" | "DELIVERED"; payments: OrderPayment[] };
type Account = {
  customer: { id: string; code: string; name: string; phone: string | null; location: string | null; status: string };
  summary: { totalSales: string; totalPaid: string; appliedToDeliveredSales: string; remainingDebt: string; pendingOrderRemaining: string; orderPaymentsAwaitingDelivery: string; moneyToReview: string; openingBalance: string; closingBalance: string };
  orders: AccountOrder[];
  payments: AccountPayment[];
};

const isPositive = (value: string | undefined) => new Decimal(value ?? "0").gt(0);
const statusTone = (status: string) => orderStatusTone(status);

function OrderCards({ orders, compact = false }: { orders: AccountOrder[]; compact?: boolean }) {
  if (!orders.length) return <Empty>Ma jiraan dalabyo la helay.</Empty>;
  return <div className="account-orders">{orders.map(order => {
    const pending = new Decimal(order.pendingRemaining).gt(0);
    return <article className="account-order-card" key={order.id}>
      <div className="account-order-head"><div><ActionLink href={`/orders/${order.id}`} className="strong">{order.orderNo}</ActionLink><p>{dateTime(order.orderDate)} · {formatFuel(order.fuel)} · {order.requestedFuusto} Fuusto</p></div><Badge tone={statusTone(order.status)}>{formatStatus(order.status)}</Badge></div>
      <div className="account-order-grid">
        <div><span>{so("Agreed Total")}</span><b>${decimal(order.agreedTotal)}</b></div>
        <div><span>{so("Delivered")}</span><b>{order.acceptedFuusto} Fuusto · ${decimal(order.deliveredTotal)}</b></div>
        <div><span>{so("Paid on Order")}</span><b>${decimal(order.paidOnOrder)}</b></div>
        <div className={pending ? "pending" : "debt"}><span>{pending ? so("Order Remaining") : so("Debt")}</span><b>${decimal(pending ? order.pendingRemaining : order.debt)}</b></div>
      </div>
      {isPositive(order.moneyToReview) && <p className="notice warn"><ShieldAlert size={16} /> {so("Owner review needed")}: ${decimal(order.moneyToReview)}</p>}
      {!compact && <details className="order-payment-disclosure"><summary>{so("View Payments")} ({order.payments.length})</summary>{!order.payments.length ? <p className="muted">Ma jiraan lacag-bixinno dalabkan ku saabsan.</p> : <div className="payment-mini-list">{order.payments.map(payment => <div key={payment.id}><span>{dateTime(payment.date)} · {formatStatus(payment.kind)}</span><strong>${decimal(payment.amount)}</strong><Badge tone={statusTone(payment.status)}>{formatStatus(payment.status)}</Badge><small>{payment.reference}{payment.reversalReason ? ` · ${payment.reversalReason}` : ""}</small></div>)}</div>}</details>}
    </article>;
  })}</div>;
}

export default function CustomerAccount() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();
  const [tab, setTab] = useState<"account" | "orders" | "payments">("account");
  const [edit, setEdit] = useState(false);
  const [pay, setPay] = useState(false);
  const [reverse, setReverse] = useState<AccountPayment | null>(null);
  const [from, setFrom] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Mogadishu", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() - 89 * 86400000)));
  const [to, setTo] = useState(businessDate);
  const accountRange = new URLSearchParams();
  if (from) accountRange.set("fromDate", from);
  if (to) accountRange.set("toDate", to);
  const accountRangeQuery = accountRange.toString();
  const customer = useQuery({ queryKey: ["customer", id], queryFn: () => api<Customer>(`/customers/${id}`) });
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const account = useQuery({
    queryKey: ["customer-account", id, from, to],
    queryFn: () => api<Account>(`/customers/${id}/account${accountRangeQuery ? `?${accountRangeQuery}` : ""}`)
  });
  const update = useMutation({ mutationFn: (body: object) => api(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) }), onSuccess: async () => { await client.invalidateQueries(); setEdit(false); notifySuccess("Xogta macmiilka waa la cusbooneysiiyey"); }, onError: error => notifyError(error, "Cusbooneysiinta way fashilantay") });
  const reversal = useMutation({ mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => api(`/payments/${paymentId}/reverse`, { method: "POST", headers: { "idempotency-key": mutationKey() }, body: JSON.stringify({ reason }) }), onSuccess: async () => { await client.invalidateQueries(); setReverse(null); notifySuccess("Lacag-bixinta waa la laalay"); }, onError: error => notifyError(error, "Ka-noqoshada lacag-bixinta way fashilantay") });

  function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (update.isPending) return; const form = new FormData(event.currentTarget); update.mutate({ name: form.get("name"), primaryPhone: form.get("phone"), address: form.get("address"), status: form.get("status"), notes: form.get("notes") }); }
  function reversePayment(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!reverse || reversal.isPending) return; const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim(); if (reason) reversal.mutate({ paymentId: reverse.id, reason }); }

  if (customer.isPending || account.isPending) return <main className="page"><LoadingState /></main>;
  const customerNotFound = [customer.error, account.error].some(error => error instanceof ApiError && error.status === 404);
  if (customerNotFound) {
    return <main className="page"><ErrorState title="Macmiilka lama helin" message="Macmiilkan kuma jiro diiwaanka hadda jira. Waxaa laga yaabaa in xogtiisa hore la tirtiray." /><ActionLink className="btn" href="/customers">Ku noqo liiska macaamiisha</ActionLink></main>;
  }
  if (customer.isError || !customer.data || account.isError || !account.data) {
    const error = customer.error ?? account.error;
    return <main className="page"><ErrorState message={error instanceof Error ? error.message : "Xogta macaamiisha lama soo rari karin."} retry={() => { void customer.refetch(); void account.refetch(); }} /></main>;
  }
  const cust = customer.data;
  const data = account.data;
  const filters = `?fromDate=${from}&toDate=${to}`;

  return <main className="page customer-account-page">
    <PageHeader eyebrow="" title={cust.name} description={[cust.primaryPhone, cust.addresses[0]?.addressText].filter(Boolean).join(" · ")} actions={<><ActionButton className="btn" onClick={() => setEdit(true)}>Wax ka beddel</ActionButton><ActionButton className="btn primary" disabled={!isPositive(data.summary.remainingDebt)} onClick={() => setPay(true)}>Bixi Lacag</ActionButton><PdfButton path={`/customers/${id}/statement/pdf${filters}`}>Bayaan (Statement)</PdfButton></>} />
    <PaymentDialog customerId={id} customerName={cust.name} open={pay} onClose={() => setPay(false)} />
    <Modal isOpen={edit} onClose={() => { if (!update.isPending) setEdit(false); }} title="Wax ka beddel Macmiilka"><form onSubmit={save}><div className="form-grid"><div className="field"><FormLabel htmlFor="edit-name">Magaca</FormLabel><input id="edit-name" name="name" className="input" defaultValue={cust.name} required /></div><div className="field"><FormLabel htmlFor="edit-phone">Telefoonka</FormLabel><input id="edit-phone" name="phone" className="input" defaultValue={cust.primaryPhone ?? ""} /></div><div className="field full"><FormLabel htmlFor="edit-location">Goobta</FormLabel><input id="edit-location" name="address" className="input" defaultValue={cust.addresses[0]?.addressText ?? ""} /></div></div><details className="simple-disclosure"><summary>Faahfaahin dheeraad ah</summary><div className="field"><FormLabel htmlFor="edit-status">Xaaladda</FormLabel><select id="edit-status" name="status" className="select" defaultValue={cust.status}><option value="ACTIVE">Shaqaynaya</option><option value="HOLD">Hakadka ku jira</option><option value="INACTIVE">Aan shaqaynayn</option></select></div><div className="field"><FormLabel htmlFor="edit-notes">Faahfaahin kooban</FormLabel><textarea id="edit-notes" name="notes" className="textarea" defaultValue={cust.notes ?? ""} /></div></details><div className="form-actions"><ActionButton type="button" className="btn" disabled={update.isPending} onClick={() => setEdit(false)}>Ka noqo</ActionButton><SubmitButton busy={update.isPending}>Keydi</SubmitButton></div></form></Modal>
    <Modal isOpen={Boolean(reverse)} onClose={() => { if (!reversal.isPending) setReverse(null); }} title="Ka noqo Lacag-bixinta"><form onSubmit={reversePayment}>{reverse && <div className="payment-summary"><strong>{reverse.displayReference}</strong><div className="info-pair"><span>{so("Customer")}</span><b>{cust.name}</b></div><div className="info-pair"><span>{so("Amount")}</span><b>${decimal(reverse.amount)}</b></div><div className="info-pair"><span>{so("Order")}</span><b>{reverse.relationLabel}</b></div></div>}<div className="field"><FormLabel htmlFor="reverse-reason">Sababta</FormLabel><textarea id="reverse-reason" name="reason" className="textarea" required minLength={3} autoFocus /></div><p className="notice warn">{so("The original payment stays visible as Reversed.")}</p><div className="form-actions"><ActionButton type="button" className="btn" disabled={reversal.isPending} onClick={() => setReverse(null)}>Ka noqo</ActionButton><SubmitButton busy={reversal.isPending}>Ka noqo</SubmitButton></div></form></Modal>

    <div className="grid account-summary-grid"><MetricCard label="Wadarta Iibka" value={`$${decimal(data.summary.totalSales)}`} icon={Receipt} /><MetricCard label="Wadarta La Bixiyey" value={`$${decimal(data.summary.totalPaid)}`} icon={Wallet} /><MetricCard label="Haraaga Deynta" value={`$${decimal(data.summary.remainingDebt)}`} icon={Banknote} dark />{isPositive(data.summary.pendingOrderRemaining) && <MetricCard label="Dalabyada Socda" value={`$${decimal(data.summary.pendingOrderRemaining)}`} icon={Clock3} />}{isPositive(data.summary.orderPaymentsAwaitingDelivery) && <MetricCard label="La Bixiyey · Sugaya Gaarsiin" value={`$${decimal(data.summary.orderPaymentsAwaitingDelivery)}`} icon={PackageCheck} />}{isPositive(data.summary.moneyToReview) && <MetricCard label="Lacagta U Baahan Hubin" value={`$${decimal(data.summary.moneyToReview)}`} icon={ShieldAlert} />}</div>
    <div className="tabs-header" aria-label="Xisaabta macmiilka">{([['account', 'Xisaabta'], ['orders', 'Dalabyada'], ['payments', 'Lacag-bixinnada']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === "account" && <Card><CardHead title="Xisaabta Dalabyada" description="Dalab kasta wuxuu muujinayaa shidaalka la geeyey, lacagta la bixiyey iyo haraaga." /><div className="statement-filter-bar"><label>Laga bilaabo<input aria-label="Laga bilaabo" className="input" type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label><label>Ilaa<input aria-label="Ilaa" className="input" type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label></div>{me.data?.role === "OWNER" && isPositive(data.summary.moneyToReview) && <p className="notice warn">Hubin ayaa loo baahan yahay: fur lacag-bixinnada oo eeg diiwaannada u baahan hubin ka hor sixitaan.</p>}<OrderCards orders={data.orders} /></Card>}
    {tab === "orders" && <Card><CardHead title="Dalabyada" description="Shidaalka la codsaday iyo inta la aqbalay." /><OrderCards orders={data.orders} compact /></Card>}
    {tab === "payments" && <Card><CardHead title="Lacag-bixinnada" description="Diiwaan taariikhaysan oo muujinaya lacagaha la qabtay iyo sixitaannada." /><div className="table-wrap"><table className="data-table responsive-table"><thead><tr><th>{so("Date")}</th><th>{so("Reference")}</th><th>{so("Amount")}</th><th>{so("Related Order")}</th><th>{so("Account")}</th><th>{so("Status")}</th><th>{so("Recorded by")}</th><th aria-label="Hawlaha" /></tr></thead><tbody>{data.payments.map(payment => <tr key={payment.id}><td data-label={so("Date")}>{dateTime(payment.paymentDate)}</td><td data-label={so("Reference")}>{payment.displayReference}</td><td data-label={so("Amount")}><strong>${decimal(payment.amount)}</strong></td><td data-label={so("Order")}>{payment.relationLabel}</td><td data-label={so("Account")}>{payment.accountName}</td><td data-label={so("Status")}><Badge tone={statusTone(payment.status)}>{formatStatus(payment.status)}</Badge>{payment.reversalReason && <small className="balance-label">{payment.reversalReason}</small>}</td><td data-label={so("Recorded by")}>{payment.recordedBy}</td><td data-label=""><div className="actions"><PdfButton className="btn small" path={`/payments/${payment.id}/receipt-pdf`} failure="Receipt unavailable">{so("Receipt")}</PdfButton>{me.data?.role === "OWNER" && payment.status === "POSTED" && <ActionButton className="btn small danger" onClick={() => setReverse(payment)}>Ka noqo</ActionButton>}</div></td></tr>)}</tbody></table>{!data.payments.length && <Empty>Ma jiraan lacag-bixinno la helay.</Empty>}</div></Card>}
  </main>;
}
