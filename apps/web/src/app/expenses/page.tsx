"use client";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Plus, ReceiptText, RotateCcw } from "lucide-react";
import { api, type Actor } from "../../lib/api";
import { businessDate, dateTime, decimal, formatStatus } from "../../lib/format";
import { useWorkflow } from "../../components/simple-forms";
import { ActionButton, FormLabel } from "../../components/controls";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, SubmitButton } from "../../components/ui";

type Expense = {
  id: string;
  expenseNo: string;
  description: string;
  category: string;
  amount: string;
  expenseDate: string;
  accountName: string;
  outsideTracked: boolean;
  reference: string | null;
  status: string;
};

type Account = {
  id: string;
  name: string;
  type: string;
  identifierMasked: string | null;
  currentBalance: string | null;
};

export default function ExpensesPage() {
  const [open, setOpen] = useState(false);
  const [outside, setOutside] = useState(false);
  const [reverse, setReverse] = useState<Expense | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: () => api<Expense[]>("/expenses"), enabled: me.data?.role === "OWNER" });
  const accounts = useQuery({ queryKey: ["financial-accounts", "selectable"], queryFn: () => api<Account[]>("/financial-accounts/selectable"), enabled: me.data?.role === "OWNER" });

  const create = useWorkflow<Record<string, string | boolean>>(
    "/expenses",
    () => { setOpen(false); setOutside(false); },
    { success: "Kharashka si guul leh ayaa loo diiwaangeliyay", error: "Kharashka lama diiwaangelin karin" }
  );

  const reversal = useWorkflow<{ reason: string }>(
    reverse ? `/expenses/${reverse.id}/reverse` : "/expenses/none/reverse",
    () => setReverse(null),
    { success: "Kharashka waa laga noqday", error: "Ka noqoshada kharashka way fashilantay" }
  );

  if (me.isPending) return <main className="page"><LoadingState /></main>;
  if (me.data?.role !== "OWNER")
    return (
      <main className="page">
        <PageHeader eyebrow="Kharashaadka" title="Kharashaadka" description="Kharashaadka ganacsiga waxaa maamuli kara milkiilaha oo keliya." />
        <ErrorState message="Ogolaanshaha Milkiilaha ayaa loo baahan yahay" />
      </main>
    );

  const rows = expenses.data ?? [];
  const posted = rows.filter((r) => r.status === "POSTED");
  const total = posted.reduce((sum, r) => sum + Number(r.amount), 0);
  const outsideTotal = posted.filter((r) => r.outsideTracked).reduce((sum, r) => sum + Number(r.amount), 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    create.mutate({
      description: String(data.get("description")),
      category: String(data.get("category")),
      amount: String(data.get("amount")),
      expenseDate: String(data.get("expenseDate")),
      financialAccountId: String(data.get("financialAccountId") || ""),
      outsideTracked: outside,
      reference: String(data.get("reference") || ""),
      notes: String(data.get("notes") || "")
    });
  }

  function submitReverse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    reversal.mutate({ reason: String(data.get("reason")) });
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Maamulka kharashaadka"
        title="Kharashaadka"
        description="Diiwaangeli kharash kasta oo ganacsi hal mar. Kharashaadka akoonka lagu xiro waxay abuuraan hal dhaqdhaqaaq oo lacag baxday ah."
        actions={
          <ActionButton className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={18} />
            Diiwaangeli Kharash
          </ActionButton>
        }
      />

      <div className="grid">
        <MetricCard label="Wadarta Kharashaadka La Diiwaangeliyey" value={`$${decimal(String(total))}`} note={`${posted.length} jeer`} icon={CircleDollarSign} dark />
        <MetricCard label="Ka Baxsan Akoonnada (Lama Diiwaangelin)" value={`$${decimal(String(outsideTotal))}`} note="Ka-reebitaanno uu milkiiluhu oggolaaday" icon={ReceiptText} />
      </div>

      <Card>
        <CardHead title="Taariikhda Kharashaadka" description="Diiwaannada la xaqiijiyey lama beddeli karo ama lama tirtiri karo. Ka noqoshadu waxay abuurtaa dhaqdhaqaaq lacageed oo saxitaan ah." />
        {expenses.isPending ? (
          <LoadingState />
        ) : expenses.isError ? (
          <ErrorState message={expenses.error.message} retry={() => void expenses.refetch()} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Taariikhda</th>
                  <th>Kharashka</th>
                  <th>Qeybta</th>
                  <th>Akoonka</th>
                  <th>Cadadka</th>
                  <th>Xaaladda</th>
                  <th style={{ textAlign: "right" }}>Hawgallada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{dateTime(row.expenseDate)}</td>
                    <td>
                      <b>{row.description}</b>
                      <small className="muted">{row.expenseNo}{row.reference ? ` · ${row.reference}` : ""}</small>
                    </td>
                    <td>{row.category}</td>
                    <td>{row.accountName}</td>
                    <td className="mono strong" style={{ color: "var(--red, #ef4444)" }}>-${decimal(row.amount)}</td>
                    <td>
                      <Badge tone={row.status === "POSTED" ? "ok" : "danger"}>{row.status === "POSTED" ? "LA DIIWAANGELIYAY" : "LAGA NOQDAY"}</Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {row.status === "POSTED" && (
                        <ActionButton className="btn small" onClick={() => setReverse(row)}>
                          <RotateCcw size={14} />
                          Ka Noqo
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <Empty>Weli kharash lama diiwaangelin.</Empty>}
          </div>
        )}
      </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Diiwaangeli Kharash Cusub">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field full">
              <FormLabel htmlFor="description">Faahfaahinta Kharashka *</FormLabel>
              <input id="description" name="description" className="input" required placeholder="tusaale: Kirada bakhaarka bishan, Shidaalka gaadiidka" />
            </div>
            <div className="field">
              <FormLabel htmlFor="category">Qeybta Kharashka *</FormLabel>
              <select id="category" name="category" className="select" required defaultValue="">
                <option value="" disabled>Dooro qeybta kharashka</option>
                <option value="Gaadiidka & Gaarsiinta">Gaadiidka & Gaarsiinta</option>
                <option value="Kirada Bakhaarka & Xafiiska">Kirada Bakhaarka & Xafiiska</option>
                <option value="Korontada & Biyaha">Korontada & Biyaha</option>
                <option value="Dayactirka & Qalabka">Dayactirka & Qalabka</option>
                <option value="Kharashaadka Xafiiska">Kharashaadka Xafiiska</option>
                <option value="Mushaaraadka">Mushaaraadka</option>
                <option value="Kale">Kale</option>
              </select>
            </div>
            <div className="field">
              <FormLabel htmlFor="amount">Cadadka Lacagta ($) *</FormLabel>
              <input id="amount" name="amount" type="number" min="0.01" step="0.01" className="input" required placeholder="0.00" />
            </div>
            <div className="field">
              <FormLabel htmlFor="expenseDate">Taariikhda Kharashka *</FormLabel>
              <input id="expenseDate" name="expenseDate" type="date" defaultValue={businessDate()} className="input" required />
            </div>
            <div className="field">
              <FormLabel htmlFor="expenseAccount">Akoonka Laga Bixinayo *</FormLabel>
              <select id="expenseAccount" name="financialAccountId" className="select" required={!outside} disabled={outside} defaultValue="">
                <option value="">{outside ? "Ka baxsan akoonnada" : "Dooro akoonka"}</option>
                {accounts.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}{row.currentBalance ? ` · $${decimal(row.currentBalance)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <label className="field full" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={outside} onChange={(e) => setOutside(e.target.checked)} />
              <span>Ka baxsan akoonnada la socdo (Ka-reebis uu milkiiluhu ansixiyay)</span>
            </label>
            <div className="field">
              <FormLabel htmlFor="expenseReference">Tixraaca (Ikhtiyaari)</FormLabel>
              <input id="expenseReference" name="reference" className="input" placeholder="tusaale: Rasiid #4402" />
            </div>
            <div className="field">
              <FormLabel htmlFor="expenseNotes">Xusuusin</FormLabel>
              <input id="expenseNotes" name="notes" className="input" placeholder="Xusuus-qor ikhtiyaari ah…" />
            </div>
          </div>
          {create.isError && <ErrorState message={create.error.message} />}
          <div className="form-actions">
            <ActionButton type="button" className="btn" onClick={() => setOpen(false)}>
              Ka Noqo
            </ActionButton>
            <SubmitButton busy={create.isPending}>Keydi Kharashka</SubmitButton>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(reverse)} onClose={() => setReverse(null)} title="Ka Noqo Kharashkan">
        <form onSubmit={submitReverse}>
          <div className="notice warn" style={{ marginBottom: 14 }}>
            Ma hubtaa inaad ka noqoto kharashka <strong>{reverse?.expenseNo}</strong> oo dhan <strong>${decimal(reverse?.amount ?? "0")}</strong>? Tani waxay abuuraysaa hal dhaqdhaqaaq oo lacag soo gashay (Money In) ah oo saxitaan ah.
          </div>
          <div className="field">
            <FormLabel htmlFor="expenseReverseReason">Sababta Ka Noqoshada (Waa qasab) *</FormLabel>
            <input id="expenseReverseReason" name="reason" className="input" required placeholder="Tusaale: Kharashkan waxaa lagu daray qalad" />
          </div>
          {reversal.isError && <ErrorState message={reversal.error.message} />}
          <div className="form-actions" style={{ marginTop: 16 }}>
            <ActionButton type="button" className="btn" onClick={() => setReverse(null)}>
              Ka Noqo
            </ActionButton>
            <SubmitButton busy={reversal.isPending} className="btn danger">
              Xaqiiji Ka Noqoshada
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </main>
  );
}
