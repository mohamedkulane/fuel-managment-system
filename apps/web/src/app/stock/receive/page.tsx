"use client";

import { dateTime, formatStatus, formatFuel } from "../../../lib/format";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, mutationKey, type Actor } from "../../../lib/api";
import { LoadingState, Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, SubmitButton } from "../../../components/ui";

type Fuel = { id: string; code: string; displayName: string };

type ReceiptLine = {
  id: string;
  quantityFuusto?: string;
  litersPerFuustoSnapshot?: string;
  actualLiters: string;
  expectedLiters: string | null;
  unitPurchaseCost?: string | null;
  totalPurchaseCost?: string | null;
  fuel: { displayName: string };
};

type Receipt = {
  id: string;
  receiptNo: string;
  supplier?: string | null;
  tankerReference: string | null;
  arrivedAt: string;
  status: string;
  postedAt: string | null;
  notes?: string | null;
  lines: ReceiptLine[];
};

export default function ReceivePage() {
  const client = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [fuustoInput, setFuustoInput] = useState<string>("");
  const [unitCostInput, setUnitCostInput] = useState<string>("");
  const [totalCostInput, setTotalCostInput] = useState<string>("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const fuels = useQuery({ queryKey: ["fuels"], queryFn: () => api<Fuel[]>("/fuels") });
  const receipts = useQuery({ queryKey: ["stock-receipts"], queryFn: () => api<Receipt[]>("/stock/receipts") });

  const receiptDetail = useQuery({
    queryKey: ["stock-receipt", selectedReceiptId],
    queryFn: () => api<Receipt>(`/stock/receipts/${selectedReceiptId}`),
    enabled: Boolean(selectedReceiptId)
  });

  const create = useMutation({
    mutationFn: (body: object) => api<Receipt>("/stock/receipts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setShowCreate(false);
      setFuustoInput("");
      setUnitCostInput("");
      setTotalCostInput("");
      await client.invalidateQueries({ queryKey: ["stock-receipts"] });
    }
  });

  const post = useMutation({
    mutationFn: (id: string) =>
      api(`/stock/receipts/${id}/post`, {
        method: "POST",
        headers: { "idempotency-key": mutationKey() }
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["stock-receipts"] }),
        client.invalidateQueries({ queryKey: ["stock"] }),
        client.invalidateQueries({ queryKey: ["stock-receipt"] })
      ]);
    }
  });

  const isOwner = me.data?.role === "OWNER";

  function handleUnitCostChange(val: string) {
    setUnitCostInput(val);
    if (!val || isNaN(Number(val))) {
      if (!val) setTotalCostInput("");
      return;
    }
    const fuustoNum = Number(fuustoInput);
    if (fuustoNum > 0) {
      const calcTotal = Number(val) * fuustoNum;
      setTotalCostInput(calcTotal.toFixed(2));
    }
  }

  function handleTotalCostChange(val: string) {
    setTotalCostInput(val);
    if (!val || isNaN(Number(val))) {
      if (!val) setUnitCostInput("");
      return;
    }
    const fuustoNum = Number(fuustoInput);
    if (fuustoNum > 0) {
      const calcUnit = Number(val) / fuustoNum;
      setUnitCostInput(calcUnit.toFixed(4));
    }
  }

  function handleFuustoChange(val: string) {
    setFuustoInput(val);
    const fuustoNum = Number(val);
    if (fuustoNum > 0 && unitCostInput && !isNaN(Number(unitCostInput))) {
      setTotalCostInput((Number(unitCostInput) * fuustoNum).toFixed(2));
    } else if (fuustoNum > 0 && totalCostInput && !isNaN(Number(totalCostInput))) {
      setUnitCostInput((Number(totalCostInput) / fuustoNum).toFixed(4));
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const uCost = d.get("unitPurchaseCost");
    const tCost = d.get("totalPurchaseCost");
    create.mutate({
      supplier: d.get("supplier"),
      purchaseDate: d.get("purchaseDate"),
      notes: d.get("notes"),
      lines: [
        {
          fuelId: d.get("fuelId"),
          quantityFuusto: d.get("quantityFuusto"),
          unitPurchaseCost: isOwner && uCost && String(uCost).trim() !== "" ? String(uCost) : undefined,
          totalPurchaseCost: isOwner && tCost && String(tCost).trim() !== "" ? String(tCost) : undefined
        }
      ]
    });
  }

  const calculatedLitersPreview = fuustoInput && !isNaN(Number(fuustoInput))
    ? (Number(fuustoInput) * 240).toLocaleString()
    : "0";

  return (
    <main className="page receive-page">
      <PageHeader
        eyebrow="Iibka kaydka shidaalka"
        title="Shidaal Soo Gelin"
        description="Diiwaangeli iibka shidaalka ee cusub ee fuustooyinka (1 fuusto = 240 litar). Qiimaha iibka waa dookh oo waxaa u furan kaliya Milkiilaha."
        actions={
          <button className="btn primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Xir foomka soo gelinta" : "+ Diiwaangeli iibka shidaalka"}
          </button>
        }
      />

      {/* Receipt Detail Modal */}
      {selectedReceiptId && (
        <Modal isOpen={Boolean(selectedReceiptId)} onClose={() => setSelectedReceiptId(null)} title="Faahfaahinta Iibka Shidaalka">
          {receiptDetail.isLoading ? (
            <LoadingState />
          ) : receiptDetail.isError ? (
            <ErrorState message={(receiptDetail.error as Error).message} />
          ) : (
            receiptDetail.data && (
              <div>
                <div className="form-grid" style={{ marginBottom: 20 }}>
                  <div>
                    <small className="muted">Lambarka Rasiidhka</small>
                    <div className="strong mono">{receiptDetail.data.receiptNo}</div>
                  </div>
                  <div>
                    <small className="muted">Xaaladda</small>
                    <div>
                      <Badge tone={receiptDetail.data.status === "POSTED" ? "ok" : "warn"}>
                        {formatStatus(receiptDetail.data.status)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <small className="muted">Ila-heleyda / Tixraaca</small>
                    <div>{receiptDetail.data.supplier ?? receiptDetail.data.tankerReference ?? "—"}</div>
                  </div>
                  <div>
                    <small className="muted">Taariikhda Iibka</small>
                    <div>{dateTime(receiptDetail.data.arrivedAt)}</div>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Shidaalka</th>
                        <th>Tirada (Fuusto)</th>
                        <th>Litarada Rasmiga ah (240 L/fuusto)</th>
                        {isOwner && <th>Qiimaha Fuustadii ($)</th>}
                        {isOwner && <th>Wadarta Kharashka ($)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {receiptDetail.data.lines.map((line) => {
                        const fuustoVal = line.quantityFuusto ?? (Number(line.actualLiters) / 240).toFixed(3);
                        return (
                          <tr key={line.id}>
                            <td>{formatFuel(line.fuel.displayName)}</td>
                            <td className="strong mono" style={{ fontSize: 14 }}>{fuustoVal} Fuusto</td>
                            <td className="mono muted">{parseFloat(line.actualLiters).toLocaleString()} L</td>
                            {isOwner && <td className="mono">{line.unitPurchaseCost ? `$${line.unitPurchaseCost}` : <span className="muted">Aan la diiwaangelin</span>}</td>}
                            {isOwner && <td className="mono">{line.totalPurchaseCost ? `$${line.totalPurchaseCost}` : <span className="muted">Aan la diiwaangelin</span>}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {receiptDetail.data.status === "DRAFT" && (
                  <div className="form-actions" style={{ marginTop: 20 }}>
                    <button
                      className="btn primary"
                      disabled={post.isPending}
                      onClick={() => post.mutate(receiptDetail.data!.id)}
                    >
                      {post.isPending ? "Diiwaangelinaya…" : "Ku Diiwaangeli Kaydka Bakhaarka"}
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </Modal>
      )}

      {/* New Stock Purchase Form */}
      {showCreate && (
        <div className="two-col">
          <Card>
            <CardHead title="Diiwaangeli Iibka Shidaalka" description="Tirada lagu geliyo fuustooyinka waxay si avtomaatik ah u xisaabisaa litarada rasmiga ah (240 L/fuusto)." />
            <form className="card-body" onSubmit={submit}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="supplier">Ila-heleyda / Xogta Tixraaca</label>
                  <input id="supplier" className="input" name="supplier" placeholder="tusaale: Qeybiyaha Bakhaarka Muqdisho #4" />
                </div>
                <div className="field">
                  <label htmlFor="purchaseDate">Taariikhda & Waqtiga Iibka *</label>
                  <input id="purchaseDate" className="input" name="purchaseDate" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} />
                </div>
                <div className="field">
                  <label htmlFor="fuelId">Nooca Shidaalka *</label>
                  <select id="fuelId" className="select" name="fuelId" required>
                    <option value="">Dooro nooca shidaalka</option>
                    {fuels.data?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {formatFuel(f.displayName)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="quantityFuusto">Tirada Fuustooyinka *</label>
                  <input
                    id="quantityFuusto"
                    className="input"
                    name="quantityFuusto"
                    inputMode="decimal"
                    required
                    placeholder="tusaale: 50"
                    value={fuustoInput}
                    onChange={(e) => handleFuustoChange(e.target.value)}
                  />
                  <small className="muted" style={{ display: "block", marginTop: 4 }}>
                    Litarada la xisaabiyay: <b>{calculatedLitersPreview} L</b> (1 fuusto = 240 L)
                  </small>
                </div>

                {isOwner && (
                  <>
                    <div className="field">
                      <label htmlFor="unitPurchaseCost">
                        Qiimaha Fuustadii USD <span className="muted">(Dookh - Milkiilaha Kaliya)</span>
                      </label>
                      <input
                        id="unitPurchaseCost"
                        className="input"
                        name="unitPurchaseCost"
                        inputMode="decimal"
                        placeholder="tusaale: 192.0000"
                        value={unitCostInput}
                        onChange={(e) => handleUnitCostChange(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="totalPurchaseCost">
                        Wadarta Kharashka Iibka USD <span className="muted">(Dookh - Milkiilaha Kaliya)</span>
                      </label>
                      <input
                        id="totalPurchaseCost"
                        className="input"
                        name="totalPurchaseCost"
                        inputMode="decimal"
                        placeholder="tusaale: 9600.00"
                        value={totalCostInput}
                        onChange={(e) => handleTotalCostChange(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="field full">
                  <label htmlFor="notes">Xusuus-qoor / Fariimaha Audit-ka</label>
                  <input id="notes" className="input" name="notes" placeholder="tusaale: Lagula soo wareegay bakhaarka Muqdisho" />
                </div>
              </div>
              {create.isError && <div className="notice warn" style={{ marginTop: 16 }}>{(create.error as Error).message}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowCreate(false)}>Ka Noqo</button>
                <SubmitButton busy={create.isPending}>Kaydi Qabyada Iibka</SubmitButton>
              </div>
            </form>
          </Card>

          <Card>
            <CardHead title="Hantida & Qawaaniinta Iibka Shidaalka" />
            <div className="card-body">
              <p>
                <b>01 · Iibka Fuustooyinka</b>
                <br />
                Dhammaan iibka shidaalka waxaa lagu diiwaangeliyaa <b>fuustooyin</b>.
              </p>
              <p>
                <b>02 · Kuleetarka Litarada</b>
                <br />
                1 fuusto waxaa si joogto ah loogu beddelaa <b>240 Litar</b> si loo maamulo kaydka rasmiga ah.
              </p>
              <p>
                <b>03 · Kharashka Iibka ee Dookha ah</b>
                <br />
                Geliinta kharashka iibka waa ku <b>dookh</b>. Geliinta qiimaha fuustadii ama wadarta kharashka waxay si avtomaatik ah u xisaabisaa kharashka kale. Xogta ka dhiman waxaa loo kaydiyaa null.
              </p>
              <p>
                <b>04 · Sirta Maaliyadda</b>
                <br />
                {isOwner
                  ? "Waxaad leedahay ixtiyaarka Milkiilaha. Qiimaha iibka fuustadii waa la diiwaangeliyaa waana muuqdaa."
                  : "Shaqaalaha Xafiisku waxay diiwaangeliyaan shidaalka fuustooyinka; kharashka iibka waxaa u gaar ah Milkiilaha."}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Stock Purchases Register */}
      <Card>
        <CardHead title="Diiwaanka Shidaal Soo Gelinta" description="Iibka shidaalka ee qabyada ah iyo kan la diiwaangeliyay" />
        {receipts.isLoading ? (
          <LoadingState />
        ) : receipts.isError ? (
          <ErrorState message={(receipts.error as Error).message} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rasiidhka #</th>
                  <th>Ila-heleyda / Tixraaca</th>
                  <th>Shidaalka</th>
                  <th>Tirada (Fuusto)</th>
                  <th>Litarada Rasmiga ah</th>
                  {isOwner && <th>Qiimaha / Fuustadii</th>}
                  {isOwner && <th>Wadarta Kharashka</th>}
                  <th>Xaaladda</th>
                  <th style={{ textAlign: "right" }}>Hawgallada</th>
                </tr>
              </thead>
              <tbody>
                {receipts.data?.map((row) => (
                  <tr key={row.id}>
                    <td className="strong mono">{row.receiptNo}</td>
                    <td>{row.supplier ?? row.tankerReference ?? "—"}</td>
                    <td>{row.lines.map((x) => formatFuel(x.fuel.displayName)).join(", ")}</td>
                    <td className="strong mono" style={{ fontSize: 13 }}>
                      {row.lines.map((x) => `${x.quantityFuusto ?? (Number(x.actualLiters) / 240).toFixed(3)} Fuusto`).join(", ")}
                    </td>
                    <td className="mono muted">
                      {row.lines.map((x) => `${parseFloat(x.actualLiters).toLocaleString()} L`).join(", ")}
                    </td>
                    {isOwner && (
                      <td className="mono">
                        {row.lines.map((x) => (x.unitPurchaseCost ? `$${x.unitPurchaseCost}` : <span className="muted" key={x.id}>—</span>)).join(", ")}
                      </td>
                    )}
                    {isOwner && (
                      <td className="mono">
                        {row.lines.map((x) => (x.totalPurchaseCost ? `$${x.totalPurchaseCost}` : <span className="muted" key={x.id}>—</span>)).join(", ")}
                      </td>
                    )}
                    <td>
                      <Badge tone={row.status === "POSTED" ? "ok" : "warn"}>{formatStatus(row.status)}</Badge>
                    </td>
                    <td style={{ textAlign: "right", display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button className="btn" onClick={() => setSelectedReceiptId(row.id)}>
                        Eeg Faahfaahinta
                      </button>
                      {row.status === "DRAFT" && (
                        <button className="btn primary" disabled={post.isPending} onClick={() => post.mutate(row.id)}>
                          Diiwaangeli Rasiidhka
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {receipts.data?.length === 0 && <Empty>Weli wax shidaal soo gelin ah lagama diiwaangelin.</Empty>}
          </div>
        )}
      </Card>
    </main>
  );
}

