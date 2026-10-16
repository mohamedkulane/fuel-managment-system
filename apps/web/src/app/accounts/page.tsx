"use client";
import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Edit2, Landmark, Plus, Repeat2, RotateCcw } from "lucide-react";
import { api, type Actor, type PaginatedResponse } from "../../lib/api";
import { businessDate, dateTime, decimal, formatStatus } from "../../lib/format";
import { notifyError, notifySuccess } from "../../lib/toast";
import { useWorkflow } from "../../components/simple-forms";
import { ActionButton, FormLabel } from "../../components/controls";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, Pagination, SubmitButton } from "../../components/ui";
import { PdfButton } from "../../components/pdf-button";

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

type Movement = {
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
};

type TransferItem = {
  id: string;
  transferNo: string;
  fromAccountName: string;
  toAccountName: string;
  amount: string;
  transferDate: string;
  reference: string | null;
  status: string;
};

export default function AccountsPage() {
  const client = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selected, setSelected] = useState("");
  const [movementPage, setMovementPage] = useState(1);
  const [movementFrom, setMovementFrom] = useState("");
  const [movementTo, setMovementTo] = useState("");
  const [reverseTransferTarget, setReverseTransferTarget] = useState<TransferItem | null>(null);
  const [reverseTransferReason, setReverseTransferReason] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const accounts = useQuery({
    queryKey: ["financial-accounts"],
    queryFn: () => api<Account[]>("/financial-accounts"),
    enabled: me.data?.role === "OWNER"
  });

  const movementsQuery = useQuery({
    queryKey: ["financial-account-movements", selected, movementPage, movementFrom, movementTo],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(movementPage), limit: "25" });
      if (movementFrom) p.set("fromDate", movementFrom);
      if (movementTo) p.set("toDate", movementTo);
      return api<PaginatedResponse<Movement>>(`/financial-accounts/${selected}/movements?${p.toString()}`);
    },
    enabled: Boolean(selected) && me.data?.role === "OWNER"
  });

  const transfersQuery = useQuery({
    queryKey: ["financial-accounts-transfers"],
    queryFn: () => api<TransferItem[]>("/financial-accounts/transfers"),
    enabled: me.data?.role === "OWNER"
  });

  const create = useWorkflow<Record<string, string | boolean>>(
    "/financial-accounts",
    (result) => {
      setCreateOpen(false);
      setSelected(result.id);
      notifySuccess("Akoonka cusub si guul leh ayaa loo furay");
    },
    { success: "Akoonka waa la abuuray", error: "Akoonka lama abuuri karin" }
  );

  const updateAccount = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api(`/financial-accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setEditingAccount(null);
      await client.invalidateQueries({ queryKey: ["financial-accounts"] });
      await client.invalidateQueries({ queryKey: ["financial-accounts", "selectable"] });
      notifySuccess("Xogta akoonka si guul leh ayaa loo cusbooneysiiyay");
    },
    onError: (error) => notifyError(error, "Akoonka lama beddeli karin")
  });

  const transfer = useWorkflow<Record<string, string>>(
    "/financial-accounts/transfers",
    async () => {
      setTransferOpen(false);
      await client.invalidateQueries({ queryKey: ["financial-accounts"] });
      await client.invalidateQueries({ queryKey: ["financial-accounts-transfers"] });
      notifySuccess("Lacagta si guul leh ayaa loo kala wareejiyay");
    },
    { success: "Lacagta waa la wareejiyay", error: "Wareejintu way fashilantay" }
  );

  const reverseTransferMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/financial-accounts/transfers/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: async () => {
      setReverseTransferTarget(null);
      setReverseTransferReason("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["financial-accounts"] }),
        client.invalidateQueries({ queryKey: ["financial-accounts-transfers"] }),
        client.invalidateQueries({ queryKey: ["financial-account-movements"] })
      ]);
      notifySuccess("Wareejintii lacagta waa laga noqday");
    },
    onError: (error) => notifyError(error, "Ka noqoshada wareejinta way fashilantay")
  });

  if (me.isPending) return <main className="page"><LoadingState /></main>;
  if (me.data?.role !== "OWNER")
    return (
      <main className="page">
        <PageHeader eyebrow="Maamulka lacagta" title="Xisaabaadka Lacagta" description="Hadhaaga akoonnada waxaa eegi kara milkiilaha oo keliya." />
        <ErrorState message="Ogolaanshaha Milkiilaha ayaa loo baahan yahay" />
      </main>
    );

  const rows = accounts.data ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.currentBalance), 0);
  const selectedAccountObj = rows.find(r => r.id === selected);

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
        title="Xisaabaadka Lacagta"
        description="Dheelitirka lacagta caddaanka ah, lacagaha moobiilka iyo xisaabaadka bangiyada oo leh diiwaan sax ah oo aan dib laga beddeli karin."
        actions={
          <>
            <ActionButton className="btn" onClick={() => setTransferOpen(true)}>
              <Repeat2 size={18} />
              Wareeji Lacag
            </ActionButton>
            <ActionButton className="btn primary" onClick={() => setCreateOpen(true)}>
              <Plus size={18} />
              Ku Dar Akoon
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
            <MetricCard label="Wadarta Lacagta Guud" value={`$${decimal(String(total))}`} note={`${rows.filter((r) => r.active).length} akoon oo firfircoon`} icon={Landmark} dark />
            {rows.slice(0, 3).map((row) => (
              <MetricCard key={row.id} label={row.name} value={`$${decimal(row.currentBalance)}`} note={`${formatStatus(row.type)} · ${row.identifierMasked ?? "Lambarka lama cayimin"}`} icon={WalletIcon(row.currentBalance)} />
            ))}
          </div>

          <Card>
            <CardHead title="Akoonnada Ganacsiga" description="Hadhaaga bilowga waxaa gala Milkiilaha lamana qiyaaso." />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Akoonka</th>
                    <th>Nooca</th>
                    <th>Hadhaaga Bilowga</th>
                    <th>Hadhaaga Hadda</th>
                    <th>Shuruucda Hadhaaga Taban</th>
                    <th>Xaaladda</th>
                    <th style={{ textAlign: "right" }}>Hawgallada</th>
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
                        <Badge tone={row.active ? "ok" : "neutral"}>{row.active ? "FIRFIRCOON" : "AAN SHAQEYN"}</Badge>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="actions" style={{ justifyContent: "flex-end" }}>
                          <ActionButton className="btn small" onClick={() => { setSelected(row.id); setMovementPage(1); }}>
                            Eeg Dhaqdhaqaaqa
                          </ActionButton>
                          <ActionButton className="btn small" onClick={() => setEditingAccount(row)}>
                            <Edit2 size={14} />
                            Wax Ka Beddel
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <Empty>Ma jiraan akoonno weli la diiwaangeliyay. Guji 'Ku Dar Akoon' si aad akoon ugu darto.</Empty>}
            </div>
          </Card>
        </>
      )}

      {selected && (
        <Card>
          <CardHead
            title={`Diiwaanka Dhaqdhaqaaqa — ${selectedAccountObj?.name ?? "Akoonka"}`}
            description="Saf kasta waa dhaqdhaqaaq lacageed oo rasmi ah oo aan la tirtiri karin."
            action={
              <ActionButton className="btn small" onClick={() => setSelected("")}>
                Xir
              </ActionButton>
            }
          />
          <div className="toolbar" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", padding: "12px 20px" }}>
            <div>
              <FormLabel htmlFor="m-from" style={{ fontSize: 11, marginBottom: 2 }}>Laga bilaabo</FormLabel>
              <input id="m-from" type="date" className="input" value={movementFrom} onChange={(e) => { setMovementFrom(e.target.value); setMovementPage(1); }} />
            </div>
            <div>
              <FormLabel htmlFor="m-to" style={{ fontSize: 11, marginBottom: 2 }}>Ilaa</FormLabel>
              <input id="m-to" type="date" className="input" value={movementTo} onChange={(e) => { setMovementTo(e.target.value); setMovementPage(1); }} />
            </div>
            {(movementFrom || movementTo) && (
              <ActionButton className="btn small" onClick={() => { setMovementFrom(""); setMovementTo(""); setMovementPage(1); }}>
                Nadiifi Shaandhada
              </ActionButton>
            )}
          </div>
          {movementsQuery.isPending ? (
            <LoadingState />
          ) : movementsQuery.isError ? (
            <ErrorState message={movementsQuery.error.message} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Taariikhda</th>
                    <th>Nooca Dhaqdhaqaaqa</th>
                    <th>Tixraaca</th>
                    <th>Lacag Soo Gashay</th>
                    <th>Lacag Baxday</th>
                    <th>Hadhaaga Kadib</th>
                    <th style={{ textAlign: "right" }}>Rasiid</th>
                  </tr>
                </thead>
                <tbody>
                  {movementsQuery.data?.items.map((row) => (
                    <tr key={row.id}>
                      <td>{dateTime(row.occurredAt)}</td>
                      <td>
                        <span className="movement-kind">{formatStatus(row.kind)}</span>
                        {row.description && <small className="muted">{row.description}</small>}
                      </td>
                      <td>{row.referenceNo}</td>
                      <td className="mono" style={{ color: row.direction === "MONEY_IN" ? "var(--lime, #22c55e)" : "inherit" }}>
                        {row.direction === "MONEY_IN" ? `+$${decimal(row.amount)}` : "—"}
                      </td>
                      <td className="mono" style={{ color: row.direction === "MONEY_OUT" ? "var(--red, #ef4444)" : "inherit" }}>
                        {row.direction === "MONEY_OUT" ? `-$${decimal(row.amount)}` : "—"}
                      </td>
                      <td className="mono strong">${decimal(row.balanceAfter)}</td>
                      <td style={{ textAlign: "right" }}>
                        {row.sourceType === "Payment" && (
                          <PdfButton className="btn small" path={`/payments/${row.sourceId}/receipt-pdf`} failure="Rasiidka lama heli karo">
                            Rasiid
                          </PdfButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!movementsQuery.data?.items || movementsQuery.data.items.length === 0) && (
                <Empty>Ma jiraan dhaqdhaqaaqyo la helay taariikhdan.</Empty>
              )}
              {movementsQuery.data && movementsQuery.data.totalPages > 1 && (
                <Pagination page={movementPage} totalPages={movementsQuery.data.totalPages} onPageChange={setMovementPage} />
              )}
            </div>
          )}
        </Card>
      )}

      {/* Transfers Section */}
      {transfersQuery.data && transfersQuery.data.length > 0 && (
        <Card style={{ marginTop: 20 }}>
          <CardHead title="Taariikhda Wareejinta Lacagaha" description="Wareejinta lacagaha u dhexeeya xisaabaadka ganacsiga." />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Taariikhda</th>
                  <th>Tixraaca</th>
                  <th>Laga Wareejiyay</th>
                  <th>Loo Wareejiyay</th>
                  <th>Cadadka ($)</th>
                  <th>Xaaladda</th>
                  <th style={{ textAlign: "right" }}>Hawgallada</th>
                </tr>
              </thead>
              <tbody>
                {transfersQuery.data.map((t) => (
                  <tr key={t.id}>
                    <td>{dateTime(t.transferDate)}</td>
                    <td className="strong">{t.transferNo}</td>
                    <td>{t.fromAccountName}</td>
                    <td>{t.toAccountName}</td>
                    <td className="mono strong">${decimal(t.amount)}</td>
                    <td>
                      <Badge tone={t.status === "POSTED" ? "ok" : "danger"}>
                        {t.status === "POSTED" ? "LA DIIWAANGELIYAY" : "LAGA NOQDAY"}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {t.status === "POSTED" && (
                        <ActionButton
                          className="btn small danger"
                          onClick={() => { setReverseTransferTarget(t); setReverseTransferReason(""); }}
                        >
                          <RotateCcw size={14} />
                          Ka Noqo
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Account Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Ku Dar Akoon Cusub">
        <form onSubmit={submitCreate}>
          <div className="form-grid">
            <Field name="name" label="Magaca Akoonka *" required placeholder="tusaale: EVC Plus Ganacsi, Salaam Bank" />
            <div className="field">
              <FormLabel htmlFor="account-type">Nooca Akoonka *</FormLabel>
              <select id="account-type" name="type" className="select" required defaultValue="">
                <option value="" disabled>Dooro nooca akoonka</option>
                <option value="CASH">Kaash (Cash)</option>
                <option value="MOBILE_MONEY">Moobiil (EVC Plus, Somnet, eDahab)</option>
                <option value="BANK">Bangi (Bank)</option>
                <option value="OTHER">Kale</option>
              </select>
            </div>
            <Field name="identifierMasked" label="Lambarka ama Tixraaca Akoonka" placeholder="tusaale: **** 4455 ama 615000000" />
            <Field name="openingBalance" label="Hadhaaga Bilowga ($) *" type="number" required step="0.01" placeholder="0.00" />
            <Field name="openingBalanceAsOf" label="Taariikhda Hadhaaga Bilowga *" type="date" required defaultValue={businessDate()} />
            <div className="field">
              <FormLabel htmlFor="overdraftPolicy">Shuruucda Hadhaaga Taban (Overdraft) *</FormLabel>
              <select id="overdraftPolicy" name="overdraftPolicy" className="select" required defaultValue="BLOCK_NEGATIVE">
                <option value="BLOCK_NEGATIVE">Ha ogolaan hadhaa taban (Jooji haddii lacagtu ka yaraato $0)</option>
                <option value="ALLOW_NEGATIVE">Ogolow hadhaa taban (Overdraft la ogol yahay)</option>
              </select>
            </div>
            <label className="field full" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" name="allowOfficePayments" defaultChecked />
              <span>U ogolow shaqaalaha xafiiska inay akoonkan lacag ku qabtaan</span>
            </label>
            <Field name="notes" label="Xusuusin" placeholder="Xusuus-qor ikhtiyaari ah…" />
          </div>
          {create.isError && <ErrorState message={create.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setCreateOpen(false)}>
              Ka Noqo
            </ActionButton>
            <SubmitButton busy={create.isPending}>Keydi Akoonka</SubmitButton>
          </div>
        </form>
      </Modal>

      {/* Edit Account Modal */}
      <Modal isOpen={Boolean(editingAccount)} onClose={() => setEditingAccount(null)} title="Wax Ka Beddel Akoonka">
        <form onSubmit={submitEdit}>
          <div className="form-grid">
            <Field name="name" label="Magaca Akoonka *" defaultValue={editingAccount?.name} required />
            <Field name="identifierMasked" label="Lambarka ama Tixraaca Akoonka" defaultValue={editingAccount?.identifierMasked ?? ""} placeholder="tusaale: **** 4455" />
            <div className="field">
              <FormLabel htmlFor="edit-overdraftPolicy">Shuruucda Hadhaaga Taban</FormLabel>
              <select id="edit-overdraftPolicy" name="overdraftPolicy" className="select" defaultValue={editingAccount?.overdraftPolicy ?? "BLOCK_NEGATIVE"}>
                <option value="BLOCK_NEGATIVE">Ha ogolaan hadhaa taban</option>
                <option value="ALLOW_NEGATIVE">Ogolow hadhaa taban</option>
              </select>
            </div>
            <label className="field full" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" name="allowOfficePayments" defaultChecked={editingAccount?.allowOfficePayments ?? true} />
              <span>U ogolow shaqaalaha xafiiska inay akoonkan lacag ku qabtaan</span>
            </label>
            <label className="field full" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" name="active" defaultChecked={editingAccount?.active ?? true} />
              <span>Akoonku waa mid shaqaynaya (Active)</span>
            </label>
          </div>
          {updateAccount.isError && <ErrorState message={updateAccount.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setEditingAccount(null)}>
              Ka Noqo
            </ActionButton>
            <SubmitButton busy={updateAccount.isPending}>Keydi Isbeddelka</SubmitButton>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal */}
      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)} title="Wareeji Lacag Akoonnada Dhexdooda">
        <form onSubmit={submitTransfer}>
          <div className="form-grid">
            <AccountSelect name="fromAccountId" label="Akoonka Laga Wareejinayo *" rows={rows} />
            <AccountSelect name="toAccountId" label="Akoonka Loo Wareejinayo *" rows={rows} />
            <Field name="amount" label="Cadadka Lacagta ($) *" type="number" step="0.01" min="0.01" required placeholder="0.00" />
            <Field name="transferDate" label="Taariikhda Wareejinta *" type="date" required defaultValue={businessDate()} />
            <Field name="reference" label="Tixraaca (Ikhtiyaari)" placeholder="tusaale: TRF-10293" />
            <Field name="notes" label="Xusuusin" placeholder="Sababta wareejinta…" />
          </div>
          {transfer.isError && <ErrorState message={transfer.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setTransferOpen(false)}>
              Ka Noqo
            </ActionButton>
            <SubmitButton busy={transfer.isPending}>Xaqiiji Wareejinta</SubmitButton>
          </div>
        </form>
      </Modal>

      {/* Reverse Transfer Modal */}
      <Modal
        isOpen={Boolean(reverseTransferTarget)}
        onClose={() => setReverseTransferTarget(null)}
        title="Ka Noqo Wareejintan"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reverseTransferTarget) {
              reverseTransferMutation.mutate({
                id: reverseTransferTarget.id,
                reason: reverseTransferReason
              });
            }
          }}
        >
          <div className="notice warn" style={{ marginBottom: 14 }}>
            Ma hubtaa inaad ka noqoto wareejinta <strong>{reverseTransferTarget?.transferNo}</strong> oo dhan <strong>${decimal(reverseTransferTarget?.amount ?? "0")}</strong>? Tani waxay dib ugu celinaysaa lacagta akoonkii laga soo wareejiyay.
          </div>
          <div className="field">
            <FormLabel htmlFor="transfer-reverse-reason">Sababta Ka Noqoshada (Waa qasab) *</FormLabel>
            <input
              id="transfer-reverse-reason"
              className="input"
              required
              value={reverseTransferReason}
              onChange={(e) => setReverseTransferReason(e.target.value)}
              placeholder="Tusaale: Khalad xisaabeed ayaa dhacay"
            />
          </div>
          {reverseTransferMutation.isError && (
            <ErrorState message={reverseTransferMutation.error.message} />
          )}
          <div className="form-actions" style={{ marginTop: 16 }}>
            <ActionButton className="btn" type="button" onClick={() => setReverseTransferTarget(null)}>
              Ka Noqo
            </ActionButton>
            <SubmitButton busy={reverseTransferMutation.isPending} className="btn danger">
              Xaqiiji Ka Noqoshada
            </SubmitButton>
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
        <option value="" disabled>Dooro akoon</option>
        {rows.filter((r) => r.active).map((row) => (
          <option key={row.id} value={row.id}>{row.name} · ${decimal(row.currentBalance)}</option>
        ))}
      </select>
    </div>
  );
}
