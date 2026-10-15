"use client";
import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Edit2, Plus, RotateCcw, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { businessDate, dateTime, decimal } from "../lib/format";
import { notifyError, notifySuccess } from "../lib/toast";
import { useWorkflow } from "./simple-forms";
import { ActionButton, FormLabel } from "./controls";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, Modal, SubmitButton } from "./ui";
import { so } from "../lib/so";

type Supplier = { id: string; code: string; name: string; phone: string | null; location: string | null; notes: string | null; status: string; debt: string };
type Account = { id: string; name: string; type: string; identifierMasked: string | null; currentBalance: string | null };
type SupplierDetail = {
  id: string;
  name: string;
  phone: string | null;
  debt: string;
  purchases: Array<{ id: string; purchaseNo: string; purchaseDate: string; totalCost: string; paidAmount: string; balanceDue: string; status: string }>;
  payments: Array<{ id: string; paymentNo: string; paymentDate: string; amount: string; status: string; accountName: string }>;
};

export function SupplierDebt() {
  const client = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [selected, setSelected] = useState("");
  const [reversingPayment, setReversingPayment] = useState<{ id: string; paymentNo: string; amount: string } | null>(null);

  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => api<Supplier[]>("/suppliers") });
  const accounts = useQuery({ queryKey: ["financial-accounts", "selectable"], queryFn: () => api<Account[]>("/financial-accounts/selectable") });
  const detail = useQuery({ queryKey: ["supplier", selected], queryFn: () => api<SupplierDetail>(`/suppliers/${selected}`), enabled: Boolean(selected) });

  const create = useMutation({
    mutationFn: (body: Record<string, string>) => api<{ id: string }>("/suppliers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setAddOpen(false);
      await client.invalidateQueries({ queryKey: ["suppliers"] });
      notifySuccess("Supplier created");
    },
    onError: (error) => notifyError(error, "Supplier not created")
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<{ id: string }>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setEditing(null);
      await client.invalidateQueries({ queryKey: ["suppliers"] });
      if (selected) await client.invalidateQueries({ queryKey: ["supplier", selected] });
      notifySuccess("Supplier updated");
    },
    onError: (error) => notifyError(error, "Supplier not updated")
  });

  const reversePayment = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<{ id: string; status: string }>(`/supplier-payments/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: async () => {
      setReversingPayment(null);
      await client.invalidateQueries({ queryKey: ["suppliers"] });
      if (selected) await client.invalidateQueries({ queryKey: ["supplier", selected] });
      notifySuccess("Supplier payment reversed");
    },
    onError: (error) => notifyError(error, "Reversal failed")
  });

  const payment = useWorkflow<Record<string, string>>(
    paying ? `/suppliers/${paying.id}/payments` : "/suppliers/none/payments",
    () => setPaying(null),
    { success: "Supplier payment recorded", error: "Supplier payment failed" }
  );

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    create.mutate({
      name: String(d.get("name")),
      phone: String(d.get("phone") || ""),
      location: String(d.get("location") || ""),
      notes: String(d.get("notes") || "")
    });
  }

  function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const d = new FormData(event.currentTarget);
    update.mutate({
      id: editing.id,
      name: String(d.get("name")),
      phone: String(d.get("phone") || ""),
      location: String(d.get("location") || ""),
      notes: String(d.get("notes") || ""),
      status: String(d.get("status") || "ACTIVE")
    });
  }

  function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    payment.mutate({
      financialAccountId: String(d.get("financialAccountId")),
      amount: String(d.get("amount")),
      paymentDate: String(d.get("paymentDate")),
      reference: String(d.get("reference") || ""),
      notes: String(d.get("notes") || "")
    });
  }

  function submitReversal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reversingPayment) return;
    const d = new FormData(event.currentTarget);
    reversePayment.mutate({
      id: reversingPayment.id,
      reason: String(d.get("reason"))
    });
  }

  return (
    <Card>
      <CardHead
        title="Keenayaasha iyo deynta aan ku leenahay"
        description="Deynta keenaha waxa la diiwaangeliyaa oo keliya marka shidaalka la soo geliyey uu leeyahay kharash iibsi dhab ah iyo keene la doortay."
        action={
          <ActionButton className="btn" onClick={() => setAddOpen(true)}>
            <Plus size={17} />
            Add Supplier
          </ActionButton>
        }
      />
      {suppliers.isPending ? (
        <LoadingState />
      ) : suppliers.isError ? (
        <ErrorState message={suppliers.error.message} retry={() => void suppliers.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{so("Supplier")}</th>
                <th>{so("Phone")}</th>
                <th>{so("Location")}</th>
                <th>{so("Supplier Debt")}</th>
                <th>{so("Status")}</th>
                <th>{so("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.data?.map((row) => (
                <tr key={row.id}>
                  <td>
                    <b>{row.name}</b>
                    <small className="muted">{row.code}</small>
                  </td>
                  <td>{row.phone ?? "—"}</td>
                  <td>{row.location ?? "—"}</td>
                  <td className="mono strong">${decimal(row.debt)}</td>
                  <td>
                    <Badge tone={row.status === "ACTIVE" ? "ok" : "neutral"}>{row.status}</Badge>
                  </td>
                  <td>
                    <div className="actions">
                      <ActionButton className="btn small" onClick={() => setSelected(row.id)}>
                        View Account
                      </ActionButton>
                      <ActionButton className="btn small" onClick={() => setEditing(row)}>
                        <Edit2 size={14} />
                        {so("Edit")}
                      </ActionButton>
                      {Number(row.debt) > 0 && (
                        <ActionButton className="btn small primary" onClick={() => setPaying(row)}>
                          <Wallet size={15} />
                          Pay Supplier
                        </ActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {suppliers.data?.length === 0 && <Empty>No suppliers yet.</Empty>}
        </div>
      )}

      {selected && (
        <div className="card-body">
          <div className="card-head">
            <div>
              <h3>{detail.data?.name ?? so("Supplier account")}</h3>
              <p>
                {so("Current debt:")} <b>${decimal(detail.data?.debt)}</b>
              </p>
            </div>
            <ActionButton className="btn small" onClick={() => setSelected("")}>
              Close
            </ActionButton>
          </div>
          {detail.isPending ? (
            <LoadingState />
          ) : detail.isError ? (
            <ErrorState message={detail.error.message} />
          ) : (
            <>
              <h4>{so("Supplier Purchases")}</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{so("Date")}</th>
                      <th>{so("Purchase")}</th>
                      <th>{so("Total")}</th>
                      <th>{so("Paid")}</th>
                      <th>{so("Remaining")}</th>
                      <th>{so("Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data?.purchases.map((row) => (
                      <tr key={row.id}>
                        <td>{dateTime(row.purchaseDate)}</td>
                        <td>{row.purchaseNo}</td>
                        <td className="mono">${decimal(row.totalCost)}</td>
                        <td className="mono">${decimal(row.paidAmount)}</td>
                        <td className="mono strong">${decimal(row.balanceDue)}</td>
                        <td>
                          <Badge tone={row.status === "PAID" ? "ok" : "warn"}>{row.status}</Badge>
                        </td>
                      </tr>
                    ))}
                    {detail.data?.purchases.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted text-center">
                          No purchases recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <h4 style={{ marginTop: "1.5rem" }}>{so("Supplier Payments")}</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{so("Date")}</th>
                      <th>{so("Payment No")}</th>
                      <th>{so("Account")}</th>
                      <th>{so("Amount")}</th>
                      <th>{so("Status")}</th>
                      <th>{so("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data?.payments.map((row) => (
                      <tr key={row.id}>
                        <td>{dateTime(row.paymentDate)}</td>
                        <td>{row.paymentNo}</td>
                        <td>{row.accountName}</td>
                        <td className="mono strong">${decimal(row.amount)}</td>
                        <td>
                          <Badge tone={row.status === "POSTED" ? "ok" : "neutral"}>{row.status}</Badge>
                        </td>
                        <td>
                          {row.status === "POSTED" ? (
                            <ActionButton className="btn small danger" onClick={() => setReversingPayment(row)}>
                              <RotateCcw size={14} />
                              {so("Reverse")}
                            </ActionButton>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {detail.data?.payments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted text-center">
                          No payments recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add Supplier Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Supplier">
        <form onSubmit={add}>
          <div className="form-grid">
            <Field name="name" label="Supplier name" required />
            <Field name="phone" label="Phone" />
            <Field name="location" label="Location" />
            <Field name="notes" label="Notes" />
          </div>
          {create.isError && <ErrorState message={create.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </ActionButton>
            <SubmitButton busy={create.isPending}>Save Supplier</SubmitButton>
          </div>
        </form>
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Edit Supplier">
        <form onSubmit={edit}>
          <div className="form-grid">
            <Field name="name" label="Supplier name" defaultValue={editing?.name} required />
            <Field name="phone" label="Phone" defaultValue={editing?.phone ?? ""} />
            <Field name="location" label="Location" defaultValue={editing?.location ?? ""} />
            <div className="field">
              <FormLabel htmlFor="edit-supplier-status">Status</FormLabel>
              <select id="edit-supplier-status" name="status" className="select" defaultValue={editing?.status ?? "ACTIVE"}>
                <option value="ACTIVE">{so("Active")}</option>
                <option value="INACTIVE">{so("Inactive")}</option>
              </select>
            </div>
            <Field name="notes" label="Notes" defaultValue={editing?.notes ?? ""} />
          </div>
          {update.isError && <ErrorState message={update.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setEditing(null)}>
              Cancel
            </ActionButton>
            <SubmitButton busy={update.isPending}>Save Changes</SubmitButton>
          </div>
        </form>
      </Modal>

      {/* Pay Supplier Modal */}
      <Modal isOpen={Boolean(paying)} onClose={() => setPaying(null)} title="Pay Supplier Debt">
        <form onSubmit={pay}>
          <p>
            <Building2 size={17} /> {paying?.name} · Debt ${decimal(paying?.debt)}
          </p>
          <div className="form-grid">
            <div className="field">
              <FormLabel htmlFor="supplierAccount">Financial account</FormLabel>
              <select id="supplierAccount" name="financialAccountId" className="select" required defaultValue="">
                <option value="" disabled>
                  Select account
                </option>
                {accounts.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · ${decimal(row.currentBalance)}
                  </option>
                ))}
              </select>
            </div>
            <Field name="amount" label="Amount ($)" type="number" min="0.01" max={paying?.debt} step="0.01" required />
            <Field name="paymentDate" label="Payment date" type="date" defaultValue={businessDate()} required />
            <Field name="reference" label="Reference" />
            <Field name="notes" label="Notes" />
          </div>
          {payment.isError && <ErrorState message={payment.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setPaying(null)}>
              Cancel
            </ActionButton>
            <SubmitButton busy={payment.isPending}>Pay Supplier</SubmitButton>
          </div>
        </form>
      </Modal>

      {/* Reverse Supplier Payment Modal */}
      <Modal isOpen={Boolean(reversingPayment)} onClose={() => setReversingPayment(null)} title="Reverse Supplier Payment">
        <form onSubmit={submitReversal}>
          <p>
            <b>{reversingPayment?.paymentNo}</b> · Amount: ${decimal(reversingPayment?.amount)}
          </p>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Reversing this payment will restore the supplier payable and record an opposite Money In movement to the financial account.
          </p>
          <div className="form-grid">
            <Field name="reason" label="Reason for reversal" required placeholder="Tusaale: Khalad gelinta lacagta" />
          </div>
          {reversePayment.isError && <ErrorState message={reversePayment.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setReversingPayment(null)}>
              Cancel
            </ActionButton>
            <SubmitButton busy={reversePayment.isPending}>Confirm Reversal</SubmitButton>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function Field({ name, label, ...props }: { name: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <FormLabel htmlFor={`supplier-${name}`}>{label}</FormLabel>
      <input id={`supplier-${name}`} name={name} className="input" {...props} />
    </div>
  );
}
