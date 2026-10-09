"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Actor } from "../../../lib/api";
import { Modal } from "../../../components/ui";

type InvoiceDetail = {
  id: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string | null;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "REVERSED";
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  notes: string | null;
  customer: { id: string; name: string; code: string; primaryPhone: string | null };
  createdBy: { displayName: string };
  lines: Array<{
    id: string;
    acceptedUnits: string;
    acceptedLiters: string;
    unitPriceSnapshot: string;
    litersPerUnitSnapshot: string;
    lineTotal: string;
    fuel: { displayName: string };
    salesUnit: { name: string };
  }>;
  allocations: Array<{
    id: string;
    amount: string;
    allocatedAt: string;
    payment: { id: string; paymentNo: string; paymentDate: string; paymentMethod: string };
    createdBy: { displayName: string };
  }>;
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [reverseModal, setReverseModal] = useState(false);
  const [reasonInput, setReasonInput] = useState("");
  const [formError, setFormError] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });

  const invoiceQuery = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api<InvoiceDetail>(`/invoices/${id}`)
  });

  const reverseMutation = useMutation({
    mutationFn: (reason: string) => api(`/invoices/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setReverseModal(false);
      setReasonInput("");
      setFormError("");
    },
    onError: (err: Error) => setFormError(err.message)
  });

  if (invoiceQuery.isLoading) {
    return (
      <main className="page">
        <div className="skeleton tall" />
      </main>
    );
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    return (
      <main className="page">
        <div className="callout error">Invoice not found or could not be loaded.</div>
      </main>
    );
  }

  const inv = invoiceQuery.data;

  return (
    <main className="page space-y-6">
      <header className="page-header">
        <div>
          <div className="crumb">
            <Link href="/invoices">Invoices</Link> / <span>{inv.invoiceNo}</span>
          </div>
          <h1 className="title font-mono">{inv.invoiceNo}</h1>
          <p className="subtitle">Issued {inv.issueDate.slice(0, 10)} for {inv.customer.name}</p>
        </div>

        <div className="actions">
          <a href={`/api/v1/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="btn secondary">
            Download PDF
          </a>

          {me.data?.role === "OWNER" && inv.status !== "REVERSED" && (
            <button className="btn danger" onClick={() => setReverseModal(true)}>
              Reverse Invoice
            </button>
          )}
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <span className="text-muted text-xs">Total Amount</span>
          <div className="text-2xl font-mono font-bold">${parseFloat(inv.totalAmount).toFixed(2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">Paid Amount</span>
          <div className="text-2xl font-mono font-bold text-emerald-400">${parseFloat(inv.paidAmount).toFixed(2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">Balance Due</span>
          <div className="text-2xl font-mono font-bold text-amber-400">${parseFloat(inv.balanceDue).toFixed(2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">Status</span>
          <div>
            <span
              className={`badge ${
                inv.status === "PAID"
                  ? "success"
                  : inv.status === "PARTIALLY_PAID"
                  ? "warning"
                  : inv.status === "REVERSED"
                  ? "danger"
                  : "neutral"
              }`}
            >
              {inv.status.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Customer & Issue Information */}
      <section className="card grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="section-title">Customer Information</h2>
          <div className="space-y-1 mt-2 text-sm">
            <div>
              <strong>Name:</strong>{" "}
              <Link href={`/customers/${inv.customer.id}`} className="link">
                {inv.customer.name}
              </Link>
            </div>
            <div>
              <strong>Account Code:</strong> {inv.customer.code}
            </div>
            {inv.customer.primaryPhone && (
              <div>
                <strong>Phone:</strong> {inv.customer.primaryPhone}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="section-title">Invoice Details</h2>
          <div className="space-y-1 mt-2 text-sm">
            <div>
              <strong>Issue Date:</strong> {inv.issueDate.slice(0, 10)}
            </div>
            <div>
              <strong>Due Date:</strong> {inv.dueDate ? inv.dueDate.slice(0, 10) : "—"}
            </div>
            <div>
              <strong>Issued By:</strong> {inv.createdBy.displayName}
            </div>
            {inv.notes && (
              <div>
                <strong>Notes:</strong> {inv.notes}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Billed Fuel Items */}
      <section className="card space-y-3">
        <h2 className="section-title">Billed Fuel Delivered</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fuel</th>
                <th>Container Unit</th>
                <th>Accepted Units</th>
                <th>Liters / Unit</th>
                <th>Accepted Liters</th>
                <th>Price Snapshot</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.fuel.displayName}</strong>
                  </td>
                  <td>{l.salesUnit.name}</td>
                  <td className="font-mono">{l.acceptedUnits}</td>
                  <td className="font-mono">{parseFloat(l.litersPerUnitSnapshot).toFixed(2)} L</td>
                  <td className="font-mono">{l.acceptedLiters} L</td>
                  <td className="font-mono">${parseFloat(l.unitPriceSnapshot).toFixed(4)}</td>
                  <td className="font-mono font-semibold">${parseFloat(l.lineTotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payment Allocations */}
      <section className="card space-y-3">
        <h2 className="section-title">Payment Allocations History</h2>
        {!inv.allocations.length ? (
          <div className="text-muted text-sm italic">No payments allocated to this invoice yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Payment #</th>
                  <th>Payment Date</th>
                  <th>Method</th>
                  <th>Allocated Amount</th>
                  <th>Recorded Date</th>
                </tr>
              </thead>
              <tbody>
                {inv.allocations.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/payments/${a.payment.id}`} className="font-mono link">
                        {a.payment.paymentNo}
                      </Link>
                    </td>
                    <td>{a.payment.paymentDate.slice(0, 10)}</td>
                    <td>{a.payment.paymentMethod}</td>
                    <td className="font-mono font-semibold text-emerald-400">${parseFloat(a.amount).toFixed(2)}</td>
                    <td>{a.allocatedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reversal Modal */}
      <Modal isOpen={reverseModal} onClose={() => setReverseModal(false)} title="Reverse Commercial Invoice">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!reasonInput.trim()) {
              setFormError("Reason is required");
              return;
            }
            reverseMutation.mutate(reasonInput);
          }}
          className="space-y-4"
        >
          {formError && <div className="callout error">{formError}</div>}

          <div className="callout warning">
            Reversing an invoice will cancel its balance and post an auditable counter-entry in the customer ledger. This action cannot be undone.
          </div>

          <div>
            <label className="label">Reversal Reason *</label>
            <textarea
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="e.g. Invoiced incorrect customer or duplicate entry..."
              className="input"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setReverseModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn danger" disabled={reverseMutation.isPending || !reasonInput.trim()}>
              {reverseMutation.isPending ? "Reversing..." : "Confirm Reversal"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
