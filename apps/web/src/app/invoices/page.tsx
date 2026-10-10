"use client";
import { FinanceMetrics } from "../../components/finance-metrics";
import { PageHeader, CardHead } from "../../components/ui";
import { decimal } from "../../lib/format";
import { useState } from "react";
import Link from "next/link";
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
      setFormError("Please select an unbilled delivery event to generate an invoice.");
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
      <PageHeader eyebrow="Customer finance" title="Invoices" description="Billing follows accepted deliveries. Review posted invoices and outstanding amounts." actions={<button className="btn primary" onClick={() => setOpenModal(true)}>Generate invoice</button>} />

      <FinanceMetrics kind="invoices" />
      <section className="card"><CardHead title="Invoices register" description="Review records and open an account for details." />
        <div className="filter-bar">
          <input
            type="search"
            placeholder="Search by invoice # or customer..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input search-input"
          />

          <div className="tabs">
            {[
              ["", "All"],
              ["UNPAID", "Unpaid"],
              ["PARTIALLY_PAID", "Partially Paid"],
              ["PAID", "Paid"],
              ["REVERSED", "Reversed"]
            ].map(([val, label]) => (
              <button
                key={val}
                className={`tab ${statusFilter === val ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter(val || "");
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {invoicesQuery.isLoading ? (
          <div className="skeleton tall" />
        ) : invoicesQuery.isError ? (
          <div className="callout error">Failed to load invoices.</div>
        ) : !invoicesQuery.data?.items.length ? (
          <div className="empty-state">No commercial invoices found.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Total Amount</th>
                    <th>Paid</th>
                    <th>Balance Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesQuery.data.items.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/invoices/${inv.id}`} className="font-mono link">
                          {inv.invoiceNo}
                        </Link>
                      </td>
                      <td>
                        <strong>{inv.customer.name}</strong>
                        <div className="text-muted text-xs">{inv.customer.code}</div>
                      </td>
                      <td>{inv.issueDate.slice(0, 10)}</td>
                      <td>{inv.dueDate ? inv.dueDate.slice(0, 10) : "—"}</td>
                      <td>
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
                      </td>
                      <td className="font-mono">${decimal(inv.totalAmount, 2)}</td>
                      <td className="font-mono text-emerald-400">${decimal(inv.paidAmount, 2)}</td>
                      <td className="font-mono text-amber-400 font-semibold">${decimal(inv.balanceDue, 2)}</td>
                      <td>
                        <Link href={`/invoices/${inv.id}`} className="btn ghost sm">
                          View details
                        </Link>
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

      <Modal isOpen={openModal} onClose={() => setOpenModal(false)} title="Generate Invoice from Accepted Delivery">
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && <div className="callout error">{formError}</div>}

          <div>
            <label className="label">Select Unbilled Delivery Event *</label>
            {unbilledQuery.isLoading ? (
              <div className="skeleton" />
            ) : !unbilledQuery.data?.length ? (
              <div className="callout info">No unbilled accepted deliveries available for invoicing.</div>
            ) : (
              <div className="select-list space-y-2 max-h-60 overflow-y-auto border border-border rounded p-2">
                {unbilledQuery.data.map((item) => (
                  <label
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
                          Order {item.orderNo} | {item.fuel} ({item.salesUnit})
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold">{item.acceptedUnits} units</div>
                        <div className="text-xs text-emerald-400 font-mono">
                          ${decimal(item.estimatedTotal ?? "0", 2)}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Payment Due Date (Optional)</label>
            <input type="date" value={dueDateInput} onChange={(e) => setDueDateInput(e.target.value)} className="input" />
          </div>

          <div>
            <label className="label">Invoice Notes (Optional)</label>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="e.g. Terms 30 days..."
              className="input"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setOpenModal(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={createInvoiceMutation.isPending || !selectedUnbilledId}
            >
              {createInvoiceMutation.isPending ? "Generating..." : "Generate Invoice"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
