"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Actor } from "../../../lib/api";
import { Modal } from "../../../components/ui";

type PaymentDetail = {
  id: string;
  paymentNo: string;
  paymentDate: string;
  paymentMethod: string;
  amount: string;
  allocatedAmount: string;
  unappliedAmount: string;
  reference: string | null;
  notes: string | null;
  status: "POSTED" | "REVERSED";
  customer: { id: string; name: string; code: string; primaryPhone: string | null };
  recordedBy: { displayName: string };
  allocations: Array<{
    id: string;
    amount: string;
    allocatedAt: string;
    invoice: { id: string; invoiceNo: string; totalAmount: string; balanceDue: string };
  }>;
};

export default function PaymentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [reverseModal, setReverseModal] = useState(false);
  const [reasonInput, setReasonInput] = useState("");
  const [formError, setFormError] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });

  const paymentQuery = useQuery({
    queryKey: ["payment", id],
    queryFn: () => api<PaymentDetail>(`/payments/${id}`)
  });

  const reverseMutation = useMutation({
    mutationFn: (reason: string) => api(`/payments/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment", id] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      setReverseModal(false);
      setReasonInput("");
      setFormError("");
    },
    onError: (err: Error) => setFormError(err.message)
  });

  if (paymentQuery.isLoading) {
    return (
      <main className="page">
        <div className="skeleton tall" />
      </main>
    );
  }

  if (paymentQuery.isError || !paymentQuery.data) {
    return (
      <main className="page">
        <div className="callout error">Payment record not found.</div>
      </main>
    );
  }

  const pay = paymentQuery.data;

  return (
    <main className="page space-y-6">
      <header className="page-header">
        <div>
          <div className="crumb">
            <Link href="/payments">Payments</Link> / <span>{pay.paymentNo}</span>
          </div>
          <h1 className="title font-mono">{pay.paymentNo}</h1>
          <p className="subtitle">Received {pay.paymentDate.slice(0, 10)} from {pay.customer.name}</p>
        </div>

        <div className="actions">
          <a href={`/api/v1/payments/${pay.id}/receipt-pdf`} target="_blank" rel="noreferrer" className="btn secondary">
            Print Receipt PDF
          </a>

          {me.data?.role === "OWNER" && pay.status === "POSTED" && (
            <button className="btn danger" onClick={() => setReverseModal(true)}>
              Reverse Payment
            </button>
          )}
        </div>
      </header>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <span className="text-muted text-xs">Total Received</span>
          <div className="text-2xl font-mono font-bold text-emerald-400">${parseFloat(pay.amount).toFixed(2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">Allocated to Invoices</span>
          <div className="text-2xl font-mono font-bold">${parseFloat(pay.allocatedAmount).toFixed(2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">Unapplied Customer Credit</span>
          <div className="text-2xl font-mono font-bold text-amber-400">${parseFloat(pay.unappliedAmount).toFixed(2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">Status</span>
          <div>
            <span className={`badge ${pay.status === "POSTED" ? "success" : "danger"}`}>{pay.status}</span>
          </div>
        </div>
      </div>

      {/* Information Overview */}
      <section className="card grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="section-title">Customer Details</h2>
          <div className="space-y-1 mt-2 text-sm">
            <div>
              <strong>Customer:</strong>{" "}
              <Link href={`/customers/${pay.customer.id}`} className="link">
                {pay.customer.name}
              </Link>
            </div>
            <div>
              <strong>Account Code:</strong> {pay.customer.code}
            </div>
            {pay.customer.primaryPhone && (
              <div>
                <strong>Phone:</strong> {pay.customer.primaryPhone}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="section-title">Payment Information</h2>
          <div className="space-y-1 mt-2 text-sm">
            <div>
              <strong>Payment Date:</strong> {pay.paymentDate.slice(0, 10)}
            </div>
            <div>
              <strong>Payment Method:</strong> {pay.paymentMethod}
            </div>
            {pay.reference && (
              <div>
                <strong>Reference / Tx ID:</strong> {pay.reference}
              </div>
            )}
            <div>
              <strong>Collected By:</strong> {pay.recordedBy.displayName}
            </div>
            {pay.notes && (
              <div>
                <strong>Notes:</strong> {pay.notes}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Allocated Invoices Breakdown */}
      <section className="card space-y-3">
        <h2 className="section-title">Allocated Invoices Breakdown</h2>
        {!pay.allocations.length ? (
          <div className="text-muted text-sm italic">
            This payment has no invoice allocations. The full amount (${parseFloat(pay.unappliedAmount).toFixed(2)}) remains as unapplied customer credit.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Invoice Total</th>
                  <th>Allocated Amount</th>
                  <th>Remaining Invoice Balance</th>
                </tr>
              </thead>
              <tbody>
                {pay.allocations.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/invoices/${a.invoice.id}`} className="font-mono link">
                        {a.invoice.invoiceNo}
                      </Link>
                    </td>
                    <td className="font-mono">${parseFloat(a.invoice.totalAmount).toFixed(2)}</td>
                    <td className="font-mono font-semibold text-emerald-400">${parseFloat(a.amount).toFixed(2)}</td>
                    <td className="font-mono">${parseFloat(a.invoice.balanceDue).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reversal Modal */}
      <Modal isOpen={reverseModal} onClose={() => setReverseModal(false)} title="Reverse Customer Payment">
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
            Reversing a payment will unallocate all applied invoice amounts, restore their balances due, and post an auditable counter-entry in the customer ledger. This action cannot be undone.
          </div>

          <div>
            <label className="label">Reversal Reason *</label>
            <textarea
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="e.g. Bounced check, returned funds, or recorded against wrong customer..."
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
