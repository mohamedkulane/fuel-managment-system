"use client";
import { ActionButton, FormLabel, ActionLink } from "../../components/controls";
import { FinanceMetrics } from "../../components/finance-metrics";
import { PageHeader, CardHead, Badge } from "../../components/ui";
import { decimal, formatStatus, formatFuel } from "../../lib/format";
import { useState } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PaginatedResponse } from "../../lib/api";
import { Modal, Pagination } from "../../components/ui";

type UnbilledItem = {
  id: string;
  confirmedAt: string;
  customerName: string;
  orderNo: string;
  fuel: string;
  salesUnit: string;
  acceptedUnits: string;
  acceptedLiters: string;
  unitPriceSnapshot: string;
  estimatedTotal: string;
};

type InvoiceItem = {
  id: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string | null;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "REVERSED";
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  customer: { name: string; code: string };
};

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [openModal, setOpenModal] = useState(false);
  const [selectedUnbilledId, setSelectedUnbilledId] = useState("");
  const [dueDateInput, setDueDateInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [formError, setFormError] = useState("");

  const invoicesQuery = useQuery({
    queryKey: ["invoices", page, search, statusFilter],
    queryFn: () =>
      api<PaginatedResponse<InvoiceItem>>(
        `/invoices?page=${page}&limit=15${search ? `&search=${encodeURIComponent(search)}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`
      )
  });

  const unbilledQuery = useQuery({
    queryKey: ["invoices-unbilled"],
    queryFn: () => api<UnbilledItem[]>("/invoices/unbilled"),
    enabled: openModal
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (body: { deliveryConfirmationLineId: string; dueDate?: string; notes?: string }) =>
      api("/invoices", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["invoices-unbilled"] });
      setOpenModal(false);
      setSelectedUnbilledId("");
      setDueDateInput("");
      setNotesInput("");
      setFormError("");
    },
    onError: (err: Error) => setFormError(err.message)
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnbilledId) {
      setFormError("Fadlan dooro shidaal la gaarsiiyay oo aan wali biil loo jarayn.");
      return;
    }
    setFormError("");
    createInvoiceMutation.mutate({
      deliveryConfirmationLineId: selectedUnbilledId,
      dueDate: dueDateInput || undefined,
      notes: notesInput || undefined
    });
  };

  return (
    <main className="page invoices-page">
      <PageHeader
        eyebrow="Xisaabta Macaamiisha"
        title="Biilasha"
        description="Biilal bixintu waxay ka timaadaa shidaalka la gaarsiiyay ee macmiilku hoos u dhigay/aqbalay. Eeg biilasha la soo saaray iyo baaqiga harsan."
        actions={<ActionButton className="btn primary" onClick={() => setOpenModal(true)}>Soo Saar Biil Cusub</ActionButton>}
      />

      <FinanceMetrics kind="invoices" />
      <section className="card">
        <CardHead title="Diiwaanka Biilasha" description="Eeg biilasha oo guji si aad u aragto faahfaahinta xisaabta." />
        <div className="filter-bar">
          <input
            type="search"
            placeholder="Kala shaandhee lambarka biilka ama macmiilka..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input search-input"
          />

          <div className="tabs">
            {[
              ["", "Dhammaan"],
              ["UNPAID", "Aan La Bixin"],
              ["PARTIALLY_PAID", "Qayb La Bixiyay"],
              ["PAID", "La Bixiyay"],
              ["REVERSED", "La Celiyay"]
            ].map(([val, label]) => (
              <ActionButton
                key={val}
                className={`tab ${statusFilter === val ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter(val || "");
                  setPage(1);
                }}
              >
                {label}
              </ActionButton>
            ))}
          </div>
        </div>

        {invoicesQuery.isLoading ? (
          <div className="skeleton tall" />
        ) : invoicesQuery.isError ? (
          <div className="callout error">Waa la ku guuldareystay soo rarida biilasha.</div>
        ) : !invoicesQuery.data?.items.length ? (
          <div className="empty-state">Ma jiraan biilal laga helay diiwaanka.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lambar Biil</th>
                    <th>Macmiilka</th>
                    <th>Taariikhda Bixinta</th>
                    <th>Taariikhda Baaqiga</th>
                    <th>Xaaladda</th>
                    <th>Wadarta Guud</th>
                    <th>La Bixiyay</th>
                    <th>Deynta Harsan</th>
                    <th>Hawlaha</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesQuery.data.items.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <ActionLink href={`/invoices/${inv.id}`} className="font-mono link">
                          {inv.invoiceNo}
                        </ActionLink>
                      </td>
                      <td>
                        <strong>{inv.customer.name}</strong>
                        <div className="text-muted text-xs">{inv.customer.code}</div>
                      </td>
                      <td>{inv.issueDate.slice(0, 10)}</td>
                      <td>{inv.dueDate ? inv.dueDate.slice(0, 10) : "—"}</td>
                      <td>
                        <Badge tone={inv.status === "PAID" ? "ok" : inv.status === "PARTIALLY_PAID" ? "warn" : inv.status === "REVERSED" ? "danger" : "neutral"}>
                          {formatStatus(inv.status)}
                        </Badge>
                      </td>
                      <td className="font-mono">${decimal(inv.totalAmount, 2)}</td>
                      <td className="font-mono text-emerald-400">${decimal(inv.paidAmount, 2)}</td>
                      <td className="font-mono text-amber-400 font-semibold">${decimal(inv.balanceDue, 2)}</td>
                      <td>
                        <ActionLink href={`/invoices/${inv.id}`} className="btn ghost sm">
                          Eeg faahfaahinta
                        </ActionLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={invoicesQuery.data.page}
              totalPages={invoicesQuery.data.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <Modal isOpen={openModal} onClose={() => setOpenModal(false)} title="Soo Saar Biil Shidaal La Gaarsiiyay">
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && <div className="callout error">{formError}</div>}

          <div>
            <FormLabel className="label">Dooro Shidaal La Gaarsiiyay oo aan Biil Loo Jarayn *</FormLabel>
            {unbilledQuery.isLoading ? (
              <div className="skeleton" />
            ) : !unbilledQuery.data?.length ? (
              <div className="callout info">Ma jiraan shidaal la gaarsiiyay oo diyaar u ah biil u jarid.</div>
            ) : (
              <div className="select-list space-y-2 max-h-60 overflow-y-auto border border-border rounded p-2">
                {unbilledQuery.data.map((item) => (
                  <FormLabel
                    key={item.id}
                    className={`block p-3 rounded border cursor-pointer transition ${
                      selectedUnbilledId === item.id ? "border-primary bg-primary/10" : "border-border hover:bg-card-hover"
                    }`}
                  >
                    <input
                      type="radio"
                      name="unbilledId"
                      value={item.id}
                      checked={selectedUnbilledId === item.id}
                      onChange={() => setSelectedUnbilledId(item.id)}
                      className="sr-only"
                    />
                    <div className="flex justify-between items-start">
                      <div>
                        <strong>{item.customerName}</strong>
                        <div className="text-xs text-muted">
                          Dalabka {item.orderNo} | {formatFuel(item.fuel)} ({item.salesUnit})
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold">{item.acceptedUnits} Fuusto</div>
                        <div className="text-xs text-emerald-400 font-mono">
                          ${decimal(item.estimatedTotal ?? "0", 2)}
                        </div>
                      </div>
                    </div>
                  </FormLabel>
                ))}
              </div>
            )}
          </div>

          <div>
            <FormLabel className="label">Taariikhda Bixinta Dambaysa (Waa Ikhtiyaari)</FormLabel>
            <input type="date" value={dueDateInput} onChange={(e) => setDueDateInput(e.target.value)} className="input" />
          </div>

          <div>
            <FormLabel className="label">Xusuusin Biilka (Waa Ikhtiyaari)</FormLabel>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="tusaale: Heshiis 30 maalmood ah..."
              className="input"
            />
          </div>

          <div className="modal-actions">
            <ActionButton type="button" className="btn ghost" onClick={() => setOpenModal(false)}>
              Ka Noqo
            </ActionButton>
            <ActionButton
              type="submit"
              className="btn primary"
              disabled={createInvoiceMutation.isPending || !selectedUnbilledId}
            >
              {createInvoiceMutation.isPending ? "Waa la soo saarayaa..." : "Soo Saar Biilka"}
            </ActionButton>
          </div>
        </form>
      </Modal>
    </main>
  );
}
