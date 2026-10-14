"use client";
import { ActionButton, FormLabel, ActionAnchor, ActionLink } from "../../../components/controls";
import { decimal, formatStatus } from "../../../lib/format";
import { useState } from "react";
import { useParams } from "next/navigation";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiBase, type Actor } from "../../../lib/api";
import { Modal, PageHeader, Badge } from "../../../components/ui";

type PaymentDetail = {
  id: string;
  paymentNo: string;
  paymentDate: string;
  paymentMethod: string;
  orderId: string | null;
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
      <main className="page detail-page">
        <div className="skeleton tall" />
      </main>
    );
  }

  if (paymentQuery.isError || !paymentQuery.data) {
    return (
      <main className="page detail-page">
        <div className="callout error">Diiwaanka lacag-bixinta ma jiraan.</div>
      </main>
    );
  }

  const pay = paymentQuery.data;

  return (
    <main className="page finance-page">
      <PageHeader
        eyebrow="Lacag-bixinta / Faahfaahinta"
        title={`Rasiidhka ${pay.paymentNo}`}
        description={pay.customer.name}
        actions={
          <div className="actions">
            <ActionAnchor href={`${apiBase}/payments/${pay.id}/receipt-pdf`} target="_blank" rel="noreferrer" className="btn secondary">
              Soo Dejiso Rasiidhka (PDF)
            </ActionAnchor>

            {me.data?.role === "OWNER" && pay.status === "POSTED" && (
              <ActionButton className="btn danger" onClick={() => setReverseModal(true)}>
                Kansal Lacag-bixinta
              </ActionButton>
            )}
          </div>
        }
      />

      {/* KPI Summary */}
      <div className="grid finance-metrics">
        <div className="card">
          <span className="text-muted text-xs">Wadarta La Qabtay</span>
          <div className="text-2xl font-mono font-bold text-emerald-400">${decimal(pay.amount, 2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">Paid toward delivered orders</span>
          <div className="text-2xl font-mono font-bold">${decimal(pay.allocatedAmount, 2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">{pay.orderId ? "Paid now — awaiting delivery" : "Needs Owner review"}</span>
          <div className="text-2xl font-mono font-bold text-amber-400">${decimal(pay.unappliedAmount, 2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">Xaaladda</span>
          <div>
            <Badge tone={pay.status === "POSTED" ? "ok" : "danger"}>
              {formatStatus(pay.status)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Information Overview */}
      <section className="card grid detail-information">
        <div>
          <h2 className="section-title">Xogta Macmiilka</h2>
          <div className="space-y-1 mt-2 text-sm">
            <div>
              <strong>Macmiilka:</strong>{" "}
              <ActionLink href={`/customers/${pay.customer.id}`} className="link">
                {pay.customer.name}
              </ActionLink>
            </div>
            <div>
              <strong>Koodhka Macmiilka:</strong> {pay.customer.code}
            </div>
            {pay.customer.primaryPhone && (
              <div>
                <strong>Telefoonka:</strong> {pay.customer.primaryPhone}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="section-title">Faahfaahinta Lacag-bixinta</h2>
          <div className="space-y-1 mt-2 text-sm">
            <div>
              <strong>Taariikhda Bixinta:</strong> {pay.paymentDate.slice(0, 10)}
            </div>
            <div>
              <strong>Qaabka Bixinta:</strong> {pay.paymentMethod}
            </div>
            {pay.reference && (
              <div>
                <strong>Tixraaca / Lambar Transaksi:</strong> {pay.reference}
              </div>
            )}
            <div>
              <strong>Qofka Qabtay:</strong> {pay.recordedBy.displayName}
            </div>
            {pay.notes && (
              <div>
                <strong>Xusuusin:</strong> {pay.notes}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="section-title">Delivered order payments</h2>
        {!pay.allocations.length ? (
          <div className="text-muted text-sm italic">
            {pay.orderId
              ? `Paid Now (${decimal(pay.unappliedAmount, 2)}) stays with its order until delivery.`
              : "This payment has not been matched to a delivered order."}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lambar Biil</th>
                  <th>Wadarta Biilka</th>
                  <th>Paid</th>
                  <th>Deynta Harsan ee Biilka</th>
                </tr>
              </thead>
              <tbody>
                {pay.allocations.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <ActionLink href={`/invoices/${a.invoice.id}`} className="font-mono link">
                        {a.invoice.invoiceNo}
                      </ActionLink>
                    </td>
                    <td className="font-mono">${decimal(a.invoice.totalAmount, 2)}</td>
                    <td className="font-mono font-semibold text-emerald-400">${decimal(a.amount, 2)}</td>
                    <td className="font-mono">${decimal(a.invoice.balanceDue, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reversal Modal */}
      <Modal isOpen={reverseModal} onClose={() => setReverseModal(false)} title="Kansal Lacag-bixinta Macmiilka">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!reasonInput.trim()) {
              setFormError("Fadlan geli sababta kansalaadda");
              return;
            }
            reverseMutation.mutate(reasonInput);
          }}
          className="space-y-4"
        >
          {formError && <div className="callout error">{formError}</div>}

          <div className="callout warning">
            Kansalaadda lacag-bixintu waxay baabi'ineysaa dhammaan qaybintii biilasha, waxay soo celineysaa deyntii furaan, waxayna diiwaangelineysaa nidaamka xisaabta xaqiijinta (counter-entry). Tallaabadan dib looma noqon karo.
          </div>

          <div>
            <FormLabel className="label">Sababta Kansalaadda *</FormLabel>
            <textarea
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="tusaale: Lacag dib loo celiyay ama loo qray macmiil meel kale ka tirsan..."
              className="input"
            />
          </div>

          <div className="modal-actions">
            <ActionButton type="button" className="btn ghost" onClick={() => setReverseModal(false)}>
              Ka Noqo
            </ActionButton>
            <ActionButton type="submit" className="btn danger" disabled={reverseMutation.isPending || !reasonInput.trim()}>
              {reverseMutation.isPending ? "Waa la kansalayay..." : "Xaqiiji Kansalaadda"}
            </ActionButton>
          </div>
        </form>
      </Modal>
    </main>
  );
}
