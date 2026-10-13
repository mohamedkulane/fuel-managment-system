"use client";
import { ActionButton, FormLabel, ActionAnchor, ActionLink } from "../../../components/controls";
import { decimal, formatStatus, formatFuel } from "../../../lib/format";
import { useState } from "react";
import { useParams } from "next/navigation";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiBase, type Actor } from "../../../lib/api";
import { Modal, PageHeader, Badge } from "../../../components/ui";

type InvoiceDetail = {
  id: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string | null;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "REVERSED";
  subtotal: string;
  discountAmount: string;
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
      <main className="page detail-page">
        <div className="skeleton tall" />
      </main>
    );
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    return (
      <main className="page detail-page">
        <div className="callout error">Biilka ma jiraan ama la soo rari waayay.</div>
      </main>
    );
  }

  const inv = invoiceQuery.data;

  return (
    <main className="page finance-page">
      <PageHeader
        eyebrow="Biilka Macmiilka / Faahfaahinta"
        title={`Biilka ${inv.invoiceNo}`}
        description={inv.customer.name}
        actions={
          <div className="actions">
            <ActionAnchor href={`${apiBase}/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="btn secondary">
              Soo Dejiso PDF
            </ActionAnchor>

            {me.data?.role === "OWNER" && inv.status !== "REVERSED" && (
              <ActionButton className="btn danger" onClick={() => setReverseModal(true)}>
                Kansal Biilka
              </ActionButton>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid finance-metrics">
        <div className="card">
          <span className="text-muted text-xs">Wadarta Guud</span>
          <div className="text-2xl font-mono font-bold">${decimal(inv.totalAmount, 2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">La Bixiyay</span>
          <div className="text-2xl font-mono font-bold text-emerald-400">${decimal(inv.paidAmount, 2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">Deynta Harsan</span>
          <div className="text-2xl font-mono font-bold text-amber-400">${decimal(inv.balanceDue, 2)}</div>
        </div>
        <div className="card">
          <span className="text-muted text-xs">Xaaladda</span>
          <div>
            <Badge tone={inv.status === "PAID" ? "ok" : inv.status === "PARTIALLY_PAID" ? "warn" : inv.status === "REVERSED" ? "danger" : "neutral"}>
              {formatStatus(inv.status)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Customer & Issue Information */}
      <section className="card grid detail-information">
        <div>
          <h2 className="section-title">Xogta Macmiilka</h2>
          <div className="space-y-1 mt-2 text-sm">
            <div>
              <strong>Magaca:</strong>{" "}
              <ActionLink href={`/customers/${inv.customer.id}`} className="link">
                {inv.customer.name}
              </ActionLink>
            </div>
            <div>
              <strong>Koodhka Macmiilka:</strong> {inv.customer.code}
            </div>
            {inv.customer.primaryPhone && (
              <div>
                <strong>Telefoonka:</strong> {inv.customer.primaryPhone}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="section-title">Faahfaahinta Biilka</h2>
          <div className="space-y-1 mt-2 text-sm">
            <div>
              <strong>Taariikhda Bixinta:</strong> {inv.issueDate.slice(0, 10)}
            </div>
            <div>
              <strong>Taariikhda Baaqiga:</strong> {inv.dueDate ? inv.dueDate.slice(0, 10) : "—"}
            </div>
            <div>
              <strong>Qofka Soo Saaray:</strong> {inv.createdBy.displayName}
            </div>
            {inv.notes && (
              <div>
                <strong>Xusuusin:</strong> {inv.notes}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Billed Fuel Items */}
      <section className="card space-y-3">
        <h2 className="section-title">Shidaalka La Gaarsiiyay oo Biilka Loo Jaray</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shidaalka</th>
                <th>Qaybta</th>
                <th>Tirada Fuustooyinka</th>
                <th>Litir / Fuusto</th>
                <th>Litirada La Aqbalay</th>
                <th>Qiimaha Fuustadii</th>
                <th>Wadarta Safka</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{formatFuel(l.fuel.displayName)}</strong>
                  </td>
                  <td>{l.salesUnit.name}</td>
                  <td className="font-mono">{l.acceptedUnits} Fuusto</td>
                  <td className="font-mono">{decimal(l.litersPerUnitSnapshot, 2)} Litir</td>
                  <td className="font-mono">{l.acceptedLiters} Litir</td>
                  <td className="font-mono">${decimal(l.unitPriceSnapshot, 4)}</td>
                  <td className="font-mono font-semibold">${decimal(l.lineTotal, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-body border-t" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16 }}>
          <div className="flex flex-col items-end space-y-1 text-sm font-mono">
            <div>Wadarta Ka Hor Dhimista: ${decimal(inv.subtotal, 2)}</div>
            {parseFloat(inv.discountAmount || "0") > 0 && (
              <div className="text-emerald-400 font-bold">Lacag-dhimis: -${decimal(inv.discountAmount, 2)}</div>
            )}
            <div className="text-base font-bold">Wadarta La Bixinayo: ${decimal(inv.totalAmount, 2)}</div>
          </div>
        </div>
      </section>

      {/* Payment Allocations */}
      <section className="card space-y-3">
        <h2 className="section-title">Diiwaanka Qaybinta Lacag-bixinnada</h2>
        {!inv.allocations.length ? (
          <div className="text-muted text-sm italic">Wali ma jiraan lacago loo qaybiyay biilkan.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lambar Rasiidh</th>
                  <th>Taariikhda Bixinta</th>
                  <th>Qaabka Bixinta</th>
                  <th>Qadarka Loo Qaybiyay</th>
                  <th>Taariikhda Diiwaangelinta</th>
                </tr>
              </thead>
              <tbody>
                {inv.allocations.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <ActionLink href={`/payments/${a.payment.id}`} className="font-mono link">
                        {a.payment.paymentNo}
                      </ActionLink>
                    </td>
                    <td>{a.payment.paymentDate.slice(0, 10)}</td>
                    <td>{a.payment.paymentMethod}</td>
                    <td className="font-mono font-semibold text-emerald-400">${decimal(a.amount, 2)}</td>
                    <td>{a.allocatedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reversal Modal */}
      <Modal isOpen={reverseModal} onClose={() => setReverseModal(false)} title="Kansal Biilka Macmiilka">
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
            Kansalaadda biilku waxay baabi'ineysaa baaqiga biilka iyada oo diiwaangelinaysa nidaamka xisaabta xaqiijinta (counter-entry). Tallaabadan dib looma noqon karo.
          </div>

          <div>
            <FormLabel className="label">Sababta Kansalaadda *</FormLabel>
            <textarea
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="tusaale: Biil loo jaray macmiil meel kale ka tirsan ama la meel dhigay laba jeer..."
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
