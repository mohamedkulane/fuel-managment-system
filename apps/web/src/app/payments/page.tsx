"use client";
import { FinanceMetrics } from "../../components/finance-metrics";
import { PageHeader, CardHead } from "../../components/ui";
import Decimal from "decimal.js";
import { decimal } from "../../lib/format";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PaginatedResponse } from "../../lib/api";
import { Modal, Pagination } from "../../components/ui";

type CustomerOption = { id: string; name: string; code: string };

type OpenInvoiceOption = {
  id: string;
  invoiceNo: string;
  issueDate: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
};

type PaymentItem = {
  id: string;
  paymentNo: string;
  paymentDate: string;
  paymentMethod: string;
  amount: string;
  allocatedAmount: string;
  unappliedAmount: string;
  reference: string | null;
  status: "POSTED" | "REVERSED";
  customer: { name: string; code: string };
  recordedBy: { displayName: string };
};

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [openModal, setOpenModal] = useState(false);

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [methodInput, setMethodInput] = useState<"CASH" | "BANK_TRANSFER" | "EVC_PLUS" | "EDAHAB" | "OTHER">("CASH");
  const [refInput, setRefInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [allocationsInput, setAllocationsInput] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const paymentsQuery = useQuery({
    queryKey: ["payments", page, search, methodFilter],
    queryFn: () =>
      api<PaginatedResponse<PaymentItem>>(
        `/payments?page=${page}&limit=15${search ? `&search=${encodeURIComponent(search)}` : ""}${methodFilter ? `&paymentMethod=${methodFilter}` : ""}`
      )
  });

  const customersQuery = useQuery({
    queryKey: ["customers-list"],
    queryFn: () => api<{ items: CustomerOption[] }>("/customers?limit=100"),
    enabled: openModal
  });

  const customerInvoicesQuery = useQuery({
    queryKey: ["customer-invoices", selectedCustomerId],
    queryFn: () => api<{ items: OpenInvoiceOption[] }>(`/invoices?customerId=${selectedCustomerId}&status=UNPAID`),
    enabled: Boolean(selectedCustomerId)
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (body: {
      customerId: string;
      amount: string;
      paymentDate: string;
      paymentMethod: string;
      reference?: string;
      notes?: string;
      allocations?: Array<{ invoiceId: string; amount: string }>;
    }) => api("/payments", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      setOpenModal(false);
      setSelectedCustomerId("");
      setAmountInput("");
      setRefInput("");
      setNotesInput("");
      setAllocationsInput({});
      setFormError("");
    },
    onError: (err: Error) => setFormError(err.message)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !amountInput || !dateInput) {
      setFormError("Customer, amount, and payment date are required.");
      return;
    }

    const allocs = Object.entries(allocationsInput)
      .filter(([_, val]) => new Decimal(val).gt(0))
      .map(([invId, val]) => ({ invoiceId: invId, amount: val }));

    setFormError("");
    recordPaymentMutation.mutate({
      customerId: selectedCustomerId,
      amount: amountInput,
      paymentDate: dateInput,
      paymentMethod: methodInput,
      reference: refInput || undefined,
      notes: notesInput || undefined,
      allocations: allocs.length ? allocs : undefined
    });
  };

  return (
    <main className="page payments-page">
      <PageHeader eyebrow="Customer finance" title="Payment collections" description="Record customer payments and allocate them to invoices." actions={<button className="btn primary" onClick={() => setOpenModal(true)}>Record payment</button>} />

      <FinanceMetrics kind="payments" />
      <section className="card"><CardHead title="Payment register" description="Review records and open an account for details." />
        <div className="filter-bar">
          <input
            type="search"
            placeholder="Search by payment #, customer or ref..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input search-input"
          />

          <div className="tabs">
            {[
              ["", "All Methods"],
              ["CASH", "Cash"],
              ["BANK_TRANSFER", "Bank Transfer"],
              ["EVC_PLUS", "EVC Plus"],
              ["EDAHAB", "eDahab"]
            ].map(([val, label]) => (
              <button
                key={val}
                className={`tab ${methodFilter === val ? "active" : ""}`}
                onClick={() => {
                  setMethodFilter(val || "");
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {paymentsQuery.isLoading ? (
          <div className="skeleton tall" />
        ) : paymentsQuery.isError ? (
          <div className="callout error">Failed to load payments history.</div>
        ) : !paymentsQuery.data?.items.length ? (
          <div className="empty-state">No payment records found.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Total Amount</th>
                    <th>Allocated</th>
                    <th>Unapplied Credit</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsQuery.data.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/payments/${p.id}`} className="font-mono link">
                          {p.paymentNo}
                        </Link>
                      </td>
                      <td>
                        <strong>{p.customer.name}</strong>
                        <div className="text-muted text-xs">{p.customer.code}</div>
                      </td>
                      <td>{p.paymentDate.slice(0, 10)}</td>
                      <td>
                        <span className="badge neutral">{p.paymentMethod}</span>
                      </td>
                      <td>{p.reference ?? "—"}</td>
                      <td className="font-mono font-bold text-emerald-400">${decimal(p.amount, 2)}</td>
                      <td className="font-mono">${decimal(p.allocatedAmount, 2)}</td>
                      <td className="font-mono text-amber-400">${decimal(p.unappliedAmount, 2)}</td>
                      <td>
                        <span className={`badge ${p.status === "POSTED" ? "success" : "danger"}`}>{p.status}</span>
                      </td>
                      <td>
                        <Link href={`/payments/${p.id}`} className="btn ghost sm">
                          View details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={paymentsQuery.data.page}
              totalPages={paymentsQuery.data.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {/* Record Payment Modal */}
      <Modal isOpen={openModal} onClose={() => setOpenModal(false)} title="Record Customer Payment">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="callout error">{formError}</div>}

          <div>
            <label className="label">Customer *</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                setAllocationsInput({});
              }}
              className="input"
              required
            >
              <option value="">-- Select Customer --</option>
              {customersQuery.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Payment Amount ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Payment Date *</label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Payment Method *</label>
              <select
                value={methodInput}
                onChange={(e) => setMethodInput(e.target.value as typeof methodInput)}
                className="input"
                required
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="EVC_PLUS">EVC Plus</option>
                <option value="EDAHAB">eDahab</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Reference / Tx ID (Optional)</label>
              <input
                type="text"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="e.g. EVC-994433"
                className="input"
              />
            </div>
          </div>

          {/* Manual Invoice Allocations optional list */}
          {selectedCustomerId && customerInvoicesQuery.data?.items.length ? (
            <div className="space-y-2 border-t border-border pt-3">
              <label className="label">Allocate to Open Invoices (Optional — leave blank for FIFO auto-allocation)</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded p-2">
                {customerInvoicesQuery.data.items.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm p-2 rounded bg-card-hover">
                    <div>
                      <strong>{inv.invoiceNo}</strong> ({inv.issueDate.slice(0, 10)})
                      <div className="text-xs text-amber-400 font-mono">
                        Balance Due: ${decimal(inv.balanceDue, 2)}
                      </div>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.01"
                        max={inv.balanceDue}
                        placeholder="0.00"
                        value={allocationsInput[inv.id] || ""}
                        onChange={(e) =>
                          setAllocationsInput((prev) => ({
                            ...prev,
                            [inv.id]: e.target.value
                          }))
                        }
                        className="input text-right font-mono sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="label">Notes (Optional)</label>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="e.g. Partial payment for July delivery..."
              className="input"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setOpenModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={recordPaymentMutation.isPending || !selectedCustomerId}>
              {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
