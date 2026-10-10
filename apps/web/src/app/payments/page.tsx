"use client";
import { FinanceMetrics } from "../../components/finance-metrics";
import { PageHeader, CardHead, Badge } from "../../components/ui";
import Decimal from "decimal.js";
import { decimal, formatStatus } from "../../lib/format";
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
      setFormError("Macmiilka, lacagta, iyo taariikhda bixinta waa in la buuxiyaa.");
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
      <PageHeader
        eyebrow="Xisaabta Macaamiisha"
        title="Lacag-bixinnada"
        description="Diiwaangeli lacagaha ay bixiyeen macaamiishu oo u qaybi biilasha furan."
        actions={<button className="btn primary" onClick={() => setOpenModal(true)}>Diiwaangeli Lacag-bixin</button>}
      />

      <FinanceMetrics kind="payments" />
      <section className="card">
        <CardHead title="Diiwaanka Lacag-bixinnada" description="Eeg diiwaanka oo guji si aad u aragto faahfaahinta Rasiidhka." />
        <div className="filter-bar">
          <input
            type="search"
            placeholder="Kala shaandhee lambarka rasiidhka, macmiilka ama tixraaca..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input search-input"
          />

          <div className="tabs">
            {[
              ["", "Dhammaan Qaababka"],
              ["CASH", "Lacag Gacanta Ah (Cash)"],
              ["BANK_TRANSFER", "Xawaalad Bank"],
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
          <div className="callout error">Waa la ku guuldareystay soo rarida diiwaanka lacag-bixinnada.</div>
        ) : !paymentsQuery.data?.items.length ? (
          <div className="empty-state">Ma jiraan diiwaanno lacag-bixin oo laga helay.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lambar Rasiidh</th>
                    <th>Macmiilka</th>
                    <th>Taariikhda</th>
                    <th>Qaabka Bixinta</th>
                    <th>Tixraaca (Ref)</th>
                    <th>Lacagta Bixinta</th>
                    <th>Qadarka Loo Qaybiyay</th>
                    <th>Lacagta Dheeraadka ah</th>
                    <th>Xaaladda</th>
                    <th>Hawlaha</th>
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
                        <Badge tone={p.status === "POSTED" ? "ok" : "danger"}>
                          {formatStatus(p.status)}
                        </Badge>
                      </td>
                      <td>
                        <Link href={`/payments/${p.id}`} className="btn ghost sm">
                          Eeg faahfaahinta
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
      <Modal isOpen={openModal} onClose={() => setOpenModal(false)} title="Diiwaangeli Lacag-bixin Macmiil">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="callout error">{formError}</div>}

          <div>
            <label className="label">Macmiilka *</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                setAllocationsInput({});
              }}
              className="input"
              required
            >
              <option value="">-- Dooro Macmiilka --</option>
              {customersQuery.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Lacagta La Bixiyay ($) *</label>
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
              <label className="label">Taariikhda Bixinta *</label>
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
              <label className="label">Qaabka Bixinta *</label>
              <select
                value={methodInput}
                onChange={(e) => setMethodInput(e.target.value as typeof methodInput)}
                className="input"
                required
              >
                <option value="CASH">Lacag Gacanta Ah (Cash)</option>
                <option value="BANK_TRANSFER">Xawaalad Bank</option>
                <option value="EVC_PLUS">EVC Plus</option>
                <option value="EDAHAB">eDahab</option>
                <option value="OTHER">Koo Kale</option>
              </select>
            </div>
            <div>
              <label className="label">Tixraaca / Lambar Transaksi (Waa Ikhtiyaari)</label>
              <input
                type="text"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="tusaale: EVC-994433"
                className="input"
              />
            </div>
          </div>

          {/* Manual Invoice Allocations optional list */}
          {selectedCustomerId && customerInvoicesQuery.data?.items.length ? (
            <div className="space-y-2 border-t border-border pt-3">
              <label className="label">U Qaybi Biilasha Furan (Waa Ikhtiyaari — ka tag maran si loogu qaybiyo tan ugu horeysa)</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded p-2">
                {customerInvoicesQuery.data.items.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm p-2 rounded bg-card-hover">
                    <div>
                      <strong>{inv.invoiceNo}</strong> ({inv.issueDate.slice(0, 10)})
                      <div className="text-xs text-amber-400 font-mono">
                        Deynta Harsan: ${decimal(inv.balanceDue, 2)}
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
            <label className="label">Xusuusin (Waa Ikhtiyaari)</label>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="tusaale: Bixin qayb ka mid ah shidaalkii July..."
              className="input"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setOpenModal(false)}>
              Ka Noqo
            </button>
            <button type="submit" className="btn primary" disabled={recordPaymentMutation.isPending || !selectedCustomerId}>
              {recordPaymentMutation.isPending ? "Waa la diiwaangelinayaa..." : "Diiwaangeli Lacag-bixinta"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
