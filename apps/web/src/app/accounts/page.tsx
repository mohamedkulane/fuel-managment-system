"use client";
import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Edit2, Landmark, Plus, Repeat2 } from "lucide-react";
import { api, type Actor } from "../../lib/api";
import { businessDate, dateTime, decimal, formatStatus } from "../../lib/format";
import { notifyError, notifySuccess } from "../../lib/toast";
import { useWorkflow } from "../../components/simple-forms";
import { ActionButton, FormLabel } from "../../components/controls";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, SubmitButton } from "../../components/ui";
import { PdfButton } from "../../components/pdf-button";
import { so } from "../../lib/so";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  identifierMasked: string | null;
  currentBalance: string;
  openingBalance: string;
  openingBalanceAsOf: string;
  overdraftPolicy: string;
  allowOfficePayments: boolean;
  active: boolean;
  movementCount: number;
};
type Detail = {
  id: string;
  name: string;
  currentBalance: string;
  movements: Array<{
    id: string;
    occurredAt: string;
    direction: string;
    kind: string;
    amount: string;
    balanceAfter: string;
    referenceNo: string;
    description: string | null;
    sourceType: string;
    sourceId: string;
  }>;
};

export default function AccountsPage() {
  const client = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selected, setSelected] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const accounts = useQuery({
    queryKey: ["financial-accounts"],
    queryFn: () => api<Account[]>("/financial-accounts"),
    enabled: me.data?.role === "OWNER"
  });
  const detail = useQuery({
    queryKey: ["financial-account", selected],
    queryFn: () => api<Detail>(`/financial-accounts/${selected}`),
    enabled: Boolean(selected) && me.data?.role === "OWNER"
  });

  const create = useWorkflow<Record<string, string | boolean>>(
    "/financial-accounts",
    (result) => {
      setCreateOpen(false);
      setSelected(result.id);
    },
    { success: "Account created", error: "Account not created" }
  );

  const updateAccount = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api(`/financial-accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setEditingAccount(null);
      await client.invalidateQueries({ queryKey: ["financial-accounts"] });
      await client.invalidateQueries({ queryKey: ["financial-accounts", "selectable"] });
      notifySuccess("Account updated");
    },
    onError: (error) => notifyError(error, "Account not updated")
  });

  const transfer = useWorkflow<Record<string, string>>(
    "/financial-accounts/transfers",
    () => setTransferOpen(false),
    { success: "Transfer recorded", error: "Transfer failed" }
  );

  if (me.isPending) return <main className="page"><LoadingState /></main>;
  if (me.data?.role !== "OWNER")
    return (
      <main className="page">
        <PageHeader eyebrow="Maamulka lacagta" title="Accounts" description="Financial account balances are Owner-only." />
        <ErrorState message="Owner permission required" />
      </main>
    );

  const rows = accounts.data ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.currentBalance), 0);

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    create.mutate({
      name: String(data.get("name")),
      type: String(data.get("type")),
      identifierMasked: String(data.get("identifierMasked") || ""),
      openingBalance: String(data.get("openingBalance")),
      openingBalanceAsOf: String(data.get("openingBalanceAsOf")),
      overdraftPolicy: String(data.get("overdraftPolicy")),
      allowOfficePayments: data.get("allowOfficePayments") === "on",
      notes: String(data.get("notes") || "")
    });
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAccount) return;
    const data = new FormData(event.currentTarget);
    updateAccount.mutate({
      id: editingAccount.id,
      name: String(data.get("name")),
      identifierMasked: String(data.get("identifierMasked") || ""),
      overdraftPolicy: String(data.get("overdraftPolicy")),
      allowOfficePayments: data.get("allowOfficePayments") === "on",
      active: data.get("active") === "on"
    });
  }

  function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    transfer.mutate({
      fromAccountId: String(data.get("fromAccountId")),
      toAccountId: String(data.get("toAccountId")),
      amount: String(data.get("amount")),
      transferDate: String(data.get("transferDate")),
      reference: String(data.get("reference") || ""),
      notes: String(data.get("notes") || "")
    });
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Maamulka lacagta"
        title="Accounts"
        description="Tracked cash, mobile money and bank balances with an immutable money-in and money-out ledger."
        actions={
          <>
            <ActionButton className="btn" onClick={() => setTransferOpen(true)}>
              <Repeat2 size={18} />
              Transfer
            </ActionButton>
            <ActionButton className="btn primary" onClick={() => setCreateOpen(true)}>
              <Plus size={18} />
              Add Account
            </ActionButton>
          </>
        }
      />

      {accounts.isPending ? (
        <LoadingState />
      ) : accounts.isError ? (
        <ErrorState message={accounts.error.message} retry={() => void accounts.refetch()} />
      ) : (
        <>
          <div className="grid">
            <MetricCard label="Tracked balance" value={`$${decimal(String(total))}`} note={`${rows.filter((r) => r.active).length} akoon oo shaqaynaya`} icon={Landmark} dark />
            {rows.slice(0, 3).map((row) => (
              <MetricCard key={row.id} label={row.name} value={`$${decimal(row.currentBalance)}`} note={`${formatStatus(row.type)} · ${row.identifierMasked ?? "No identifier"}`} icon={WalletIcon(row.currentBalance)} />
            ))}
          </div>

          <Card>
            <CardHead title="Financial accounts" description="Opening balances are entered by the Owner and never inferred." />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{so("Account")}</th>
                    <th>{so("Type")}</th>
                    <th>{so("Opening balance")}</th>
                    <th>{so("Current balance")}</th>
                    <th>{so("Negative policy")}</th>
                    <th>{so("Status")}</th>
                    <th>{so("Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <b>{row.name}</b>
                        <small className="muted">{row.identifierMasked ?? row.code}</small>
                      </td>
                      <td>{formatStatus(row.type)}</td>
                      <td className="mono">${decimal(row.openingBalance)}</td>
                      <td className="mono strong">${decimal(row.currentBalance)}</td>
                      <td>{formatStatus(row.overdraftPolicy)}</td>
                      <td>
                        <Badge tone={row.active ? "ok" : "neutral"}>{row.active ? "ACTIVE" : "INACTIVE"}</Badge>
                      </td>
                      <td>
                        <div className="actions">
                          <ActionButton className="btn small" onClick={() => setSelected(row.id)}>
                            View Ledger
                          </ActionButton>
                          <ActionButton className="btn small" onClick={() => setEditingAccount(row)}>
                            <Edit2 size={14} />
                            {so("Edit")}
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <Empty>No financial accounts yet. Add the actual business account and its Owner-entered opening balance.</Empty>}
            </div>
          </Card>
        </>
      )}

      {selected && (
        <Card>
          <CardHead
            title={`${detail.data?.name ?? "Account"} ${so("ledger")}`}
            description="Every row is an immutable financial movement."
            action={
              <ActionButton className="btn small" onClick={() => setSelected("")}>
                Close
              </ActionButton>
            }
          />
          {detail.isPending ? (
            <LoadingState />
          ) : detail.isError ? (
            <ErrorState message={detail.error.message} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{so("Date")}</th>
                    <th>{so("Movement")}</th>
                    <th>{so("Reference")}</th>
                    <th>{so("Money In")}</th>
                    <th>{so("Money Out")}</th>
                    <th>{so("Balance")}</th>
                    <th>{so("Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data?.movements.map((row) => (
                    <tr key={row.id}>
                      <td>{dateTime(row.occurredAt)}</td>
                      <td>
                        <span className="movement-kind">{formatStatus(row.kind)}</span>
                        {row.description && <small className="muted">{row.description}</small>}
                      </td>
                      <td>{row.referenceNo}</td>
                      <td className="mono">{row.direction === "MONEY_IN" ? `$${decimal(row.amount)}` : "—"}</td>
                      <td className="mono">{row.direction === "MONEY_OUT" ? `$${decimal(row.amount)}` : "—"}</td>
                      <td className="mono strong">${decimal(row.balanceAfter)}</td>
                      <td>
                        {row.sourceType === "Payment" && (
                          <PdfButton className="btn small" path={`/payments/${row.sourceId}/receipt-pdf`} failure="Receipt unavailable">
                            {so("Receipt")}
                          </PdfButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Add Account Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Financial Account">
        <form onSubmit={submitCreate}>
          <div className="form-grid">
            <Field name="name" label="Account name" required />
            <div className="field">
              <FormLabel htmlFor="account-type">Account type</FormLabel>
              <select id="account-type" name="type" className="select" required defaultValue="">
                <option value="" disabled>{so("Select type")}</option>
                <option value="CASH">{so("Cash")}</option>
                <option value="MOBILE_MONEY">{so("Mobile money")}</option>
                <option value="BANK">{so("Bank")}</option>
                <option value="OTHER">{so("Other")}</option>
              </select>
            </div>
            <Field name="identifierMasked" label="Masked identifier" placeholder="tusaale: **** 4455" />
            <Field name="openingBalance" label="Opening balance ($)" type="number" required step="0.01" />
            <Field name="openingBalanceAsOf" label="Opening balance as of" type="date" required defaultValue={businessDate()} />
            <div className="field">
              <FormLabel htmlFor="overdraftPolicy">Negative balance policy</FormLabel>
              <select id="overdraftPolicy" name="overdraftPolicy" className="select" required defaultValue="">
                <option value="" disabled>{so("Owner must choose")}</option>
                <option value="BLOCK_NEGATIVE">{so("Block negative balance")}</option>
                <option value="ALLOW_NEGATIVE">{so("Allow negative balance")}</option>
              </select>
            </div>
            <label className="field">
              <span>{so("Office payment access")}</span>
              <span>
                <input type="checkbox" name="allowOfficePayments" defaultChecked /> {so("Allow Office Employee to select this account")}
              </span>
            </label>
            <Field name="notes" label="Notes" />
          </div>
          {create.isError && <ErrorState message={create.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </ActionButton>
            <SubmitButton busy={create.isPending}>Create Account</SubmitButton>
          </div>
        </form>
      </Modal>

      {/* Edit Account Modal */}
      <Modal isOpen={Boolean(editingAccount)} onClose={() => setEditingAccount(null)} title="Edit Financial Account">
        <form onSubmit={submitEdit}>
          <div className="form-grid">
            <Field name="name" label="Account name" defaultValue={editingAccount?.name} required />
            <Field name="identifierMasked" label="Masked identifier" defaultValue={editingAccount?.identifierMasked ?? ""} placeholder="tusaale: **** 4455" />
            <div className="field">
              <FormLabel htmlFor="edit-overdraftPolicy">Negative balance policy</FormLabel>
              <select id="edit-overdraftPolicy" name="overdraftPolicy" className="select" defaultValue={editingAccount?.overdraftPolicy ?? "BLOCK_NEGATIVE"}>
                <option value="BLOCK_NEGATIVE">{so("Block negative balance")}</option>
                <option value="ALLOW_NEGATIVE">{so("Allow negative balance")}</option>
              </select>
            </div>
            <label className="field">
              <span>{so("Office payment access")}</span>
              <span>
                <input type="checkbox" name="allowOfficePayments" defaultChecked={editingAccount?.allowOfficePayments ?? true} /> {so("Allow Office Employee to select this account")}
              </span>
            </label>
            <label className="field">
              <span>{so("Status")}</span>
              <span>
                <input type="checkbox" name="active" defaultChecked={editingAccount?.active ?? true} /> {so("Active account")}
              </span>
            </label>
          </div>
          {updateAccount.isError && <ErrorState message={updateAccount.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setEditingAccount(null)}>
              Cancel
            </ActionButton>
            <SubmitButton busy={updateAccount.isPending}>Save Changes</SubmitButton>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal */}
      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer Between Accounts">
        <form onSubmit={submitTransfer}>
          <div className="form-grid">
            <AccountSelect name="fromAccountId" label="From account" rows={rows} />
            <AccountSelect name="toAccountId" label="To account" rows={rows} />
            <Field name="amount" label="Amount ($)" type="number" step="0.01" required />
            <Field name="transferDate" label="Transfer date" type="date" required defaultValue={businessDate()} />
            <Field name="reference" label="Reference" />
            <Field name="notes" label="Notes" />
          </div>
          {transfer.isError && <ErrorState message={transfer.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setTransferOpen(false)}>
              Cancel
            </ActionButton>
            <SubmitButton busy={transfer.isPending}>Save Transfer</SubmitButton>
          </div>
        </form>
      </Modal>
    </main>
  );
}

function WalletIcon(value: string) {
  return Number(value) >= 0 ? ArrowDownLeft : ArrowUpRight;
}

function Field({ name, label, ...props }: { name: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <input id={name} name={name} className="input" {...props} />
    </div>
  );
}

function AccountSelect({ name, label, rows }: { name: string; label: string; rows: Account[] }) {
  return (
    <div className="field">
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <select id={name} name={name} className="select" required defaultValue="">
        <option value="" disabled>{so("Select account")}</option>
        {rows.filter((r) => r.active).map((row) => (
          <option key={row.id} value={row.id}>{row.name} · ${decimal(row.currentBalance)}</option>
        ))}
      </select>
    </div>
  );
}
