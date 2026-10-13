"use client";
import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { Receipt, Wallet } from "lucide-react";
import { ActionButton, FormLabel } from "./controls";
import { PdfButton } from "./pdf-button";
import { PaymentDialog } from "./simple-forms";
import { CustomerOrdersTab, CustomerPaymentsTab } from "./customer-history";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, SubmitButton } from "./ui";
import { api } from "../lib/api";
import { dateTime, decimal, businessDate } from "../lib/format";
import { payableDebt } from "../lib/payment-validation";
import { notifyError, notifySuccess } from "../lib/toast";

type Customer = { id: string; name: string; primaryPhone: string | null; status: string; notes: string | null; addresses: { addressText: string }[] };
type Financial = { totalInvoiced: string; totalPaid: string; outstandingDebt: string; unappliedCredit: string };
type Statement = { openingBalance: string; closingBalance: string; entries: { id: string; occurredAt: string; entryType: string; debitAmount: string; creditAmount: string; runningBalance: string }[] };
function balance(value: string) { const amount = new Decimal(value); return amount.lt(0) ? `Lacag u taalla $${amount.abs().toFixed(2)}` : `$${amount.toFixed(2)}`; }

export default function CustomerAccount() {
  const { id } = useParams<{ id: string }>(); const client = useQueryClient();
  const [tab, setTab] = useState<"ledger" | "orders" | "payments">("ledger");
  const [edit, setEdit] = useState(false); const [pay, setPay] = useState(false);
  const [from, setFrom] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Mogadishu", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() - 89 * 86400000)));
  const [to, setTo] = useState(businessDate);
  const customer = useQuery({ queryKey: ["customer", id], queryFn: () => api<Customer>(`/customers/${id}`) });
  const financial = useQuery({ queryKey: ["customer-financial", id], queryFn: () => api<Financial>(`/customers/${id}/financial`) });
  const filters = `?fromDate=${from}&toDate=${to}`;
  const statement = useQuery({ queryKey: ["customer-statement", id, from, to], queryFn: () => api<Statement>(`/customers/${id}/statement${filters}`), enabled: tab === "ledger" });
  const update = useMutation({ mutationFn: (body: object) => api(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) }), onSuccess: async () => { await client.invalidateQueries(); setEdit(false); notifySuccess("Customer updated"); }, onError: error => notifyError(error, "Update failed") });
  function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (update.isPending) return; const data = new FormData(event.currentTarget); update.mutate({ name: data.get("name"), primaryPhone: data.get("phone"), address: data.get("address"), status: data.get("status"), notes: data.get("notes") }); }
  const cust = customer.data; const fin = financial.data;
  const debt = payableDebt(fin?.outstandingDebt ?? "0", fin?.unappliedCredit ?? "0");
  const credit = Decimal.max(0, new Decimal(fin?.unappliedCredit ?? "0").sub(fin?.outstandingDebt ?? "0"));
  if (customer.isPending) return <main className="page"><LoadingState /></main>;
  if (customer.isError || !cust) return <main className="page"><ErrorState message="Customer unavailable" retry={() => void customer.refetch()} /></main>;
  return <main className="page customer-account-page">
    <PageHeader eyebrow="" title={cust.name} description={[cust.primaryPhone, cust.addresses[0]?.addressText].filter(Boolean).join(" · ")} actions={<><ActionButton className="btn" onClick={() => setEdit(true)}>Edit</ActionButton><ActionButton className="btn primary" disabled={!fin || debt.lte(0)} onClick={() => setPay(true)}>Pay</ActionButton><PdfButton path={`/customers/${id}/statement/pdf${filters}`}>Statement</PdfButton></>} />
    <PaymentDialog customerId={id} customerName={cust.name} open={pay} onClose={() => setPay(false)} />
    <Modal isOpen={edit} onClose={() => { if (!update.isPending) setEdit(false); }} title="Edit customer"><form onSubmit={save}>
      <div className="form-grid"><div className="field"><FormLabel htmlFor="edit-name">Magaca (Name)</FormLabel><input id="edit-name" name="name" className="input" defaultValue={cust.name} required /></div><div className="field"><FormLabel htmlFor="edit-phone">Telefoonka (Phone)</FormLabel><input id="edit-phone" name="phone" className="input" defaultValue={cust.primaryPhone ?? ""} /></div><div className="field full"><FormLabel htmlFor="edit-location">Goobta (Location)</FormLabel><input id="edit-location" name="address" className="input" defaultValue={cust.addresses[0]?.addressText ?? ""} /></div></div>
      <details className="simple-disclosure"><summary>More details</summary><div className="field"><FormLabel htmlFor="edit-status">Xaaladda (Status)</FormLabel><select id="edit-status" name="status" className="select" defaultValue={cust.status}><option value="ACTIVE">Active</option><option value="HOLD">Hold</option><option value="INACTIVE">Inactive</option></select></div><div className="field"><FormLabel htmlFor="edit-notes">Xusuus (Notes)</FormLabel><textarea id="edit-notes" name="notes" className="textarea" defaultValue={cust.notes ?? ""} /></div></details>
      {update.isError && <p className="validation-error">Update failed. Check the details and try again.</p>}<div className="form-actions"><ActionButton type="button" className="btn" disabled={update.isPending} onClick={() => setEdit(false)}>Cancel</ActionButton><SubmitButton busy={update.isPending}>Save</SubmitButton></div>
    </form></Modal>
    {financial.isError ? <ErrorState message="Balance unavailable" retry={() => void financial.refetch()} /> : financial.isPending ? <LoadingState /> : <><div className="grid team-metrics"><MetricCard label="Total Sales" value={`$${decimal(fin?.totalInvoiced)}`} icon={Receipt} /><MetricCard label="Total Paid" value={`$${decimal(fin?.totalPaid)}`} icon={Wallet} /><MetricCard label="Debt" value={`$${debt.toFixed(2)}`} icon={Wallet} dark /></div>{credit.gt(0) && <p className="notice">Lacag u taalla: ${credit.toFixed(2)}</p>}</>}
    <div className="tabs-header" aria-label="Customer account">{([['ledger', 'Xisaab'], ['orders', 'Orders'], ['payments', 'Payments']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === "orders" && <CustomerOrdersTab customerId={id} />}{tab === "payments" && <CustomerPaymentsTab customerId={id} />}
    {tab === "ledger" && <Card><CardHead title="Xisaab" /><div className="toolbar"><label>From<input aria-label="From" className="input" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label><label>To<input aria-label="To" className="input" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label></div>
      {statement.isPending ? <LoadingState /> : statement.isError ? <ErrorState message="Statement unavailable" retry={() => void statement.refetch()} /> : <><div className="statement-balances"><span>Bilow: <b>{balance(statement.data?.openingBalance ?? "0")}</b></span><span>Hadda: <b>{balance(statement.data?.closingBalance ?? "0")}</b></span></div><div className="table-wrap"><table className="data-table responsive-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance</th></tr></thead><tbody>{statement.data?.entries.map(entry => <tr key={entry.id}><td data-label="Date">{dateTime(entry.occurredAt)}</td><td data-label="Type">{entry.entryType === "INVOICE" ? "Iib" : entry.entryType === "PAYMENT" ? "Lacag" : entry.entryType === "REVERSAL" ? "Reversal" : "Adjustment"}</td><td data-label="Amount">${decimal(new Decimal(entry.debitAmount).sub(entry.creditAmount).abs().toString())}</td><td data-label="Balance">{balance(entry.runningBalance)}</td></tr>)}</tbody></table>{!statement.data?.entries.length && <Empty>No activity in this period.</Empty>}</div></>}
    </Card>}
  </main>;
}
