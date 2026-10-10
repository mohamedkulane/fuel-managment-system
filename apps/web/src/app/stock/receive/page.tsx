"use client";

import { dateTime } from "../../../lib/format";
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

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const cost = d.get("unitPurchaseCost");
    create.mutate({
      supplier: d.get("supplier"),
      purchaseDate: d.get("purchaseDate"),
      notes: d.get("notes"),
      lines: [
        {
          fuelId: d.get("fuelId"),
          quantityFuusto: d.get("quantityFuusto"),
          unitPurchaseCost: isOwner && cost ? String(cost) : undefined
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
        eyebrow="Inventory purchasing"
        title="Fuel stock receiving"
        description="Record incoming fuel stock purchases in fuusto (1 fuusto = 240 liters). Posting updates warehouse inventory."
        actions={
          <button className="btn primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Close receiving form" : "+ Register stock purchase"}
          </button>
        }
      />

      {/* Receipt Detail Modal */}
      {selectedReceiptId && (
        <Modal isOpen={Boolean(selectedReceiptId)} onClose={() => setSelectedReceiptId(null)} title="Stock Purchase Details">
          {receiptDetail.isLoading ? (
            <LoadingState />
          ) : receiptDetail.isError ? (
            <ErrorState message={(receiptDetail.error as Error).message} />
          ) : (
            receiptDetail.data && (
              <div>
                <div className="form-grid" style={{ marginBottom: 20 }}>
                  <div>
                    <small className="muted">Receipt No</small>
                    <div className="strong mono">{receiptDetail.data.receiptNo}</div>
                  </div>
                  <div>
                    <small className="muted">Status</small>
                    <div>
                      <Badge tone={receiptDetail.data.status === "POSTED" ? "ok" : "warn"}>
                        {receiptDetail.data.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <small className="muted">Supplier / Reference</small>
                    <div>{receiptDetail.data.supplier ?? receiptDetail.data.tankerReference ?? "—"}</div>
                  </div>
                  <div>
                    <small className="muted">Purchase Date</small>
                    <div>{dateTime(receiptDetail.data.arrivedAt)}</div>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fuel</th>
                        <th>Quantity (Fuusto)</th>
                        <th>Canonical Liters (240 L/fuusto)</th>
                        {isOwner && <th>Unit Purchase Cost ($/fuusto)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {receiptDetail.data.lines.map((line) => {
                        const fuustoVal = line.quantityFuusto ?? (Number(line.actualLiters) / 240).toFixed(3);
                        return (
                          <tr key={line.id}>
                            <td>{line.fuel.displayName}</td>
                            <td className="strong mono" style={{ fontSize: 14 }}>{fuustoVal} fuusto</td>
                            <td className="mono muted">{parseFloat(line.actualLiters).toLocaleString()} L</td>
                            {isOwner && <td className="mono">{line.unitPurchaseCost ? `$${line.unitPurchaseCost}` : "—"}</td>}
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
                      {post.isPending ? "Posting…" : "Post Stock Receipt to Inventory"}
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
            <CardHead title="Record Fuel Stock Purchase" description="Quantities entered in fuusto automatically calculate canonical liters at 240 L/fuusto." />
            <form className="card-body" onSubmit={submit}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="supplier">Supplier / Reference Information</label>
                  <input id="supplier" className="input" name="supplier" placeholder="e.g. Mogadishu Depot Supplier #4" />
                </div>
                <div className="field">
                  <label htmlFor="purchaseDate">Purchase Date & Time *</label>
                  <input id="purchaseDate" className="input" name="purchaseDate" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} />
                </div>
                <div className="field">
                  <label htmlFor="fuelId">Fuel Type *</label>
                  <select id="fuelId" className="select" name="fuelId" required>
                    <option value="">Select fuel type</option>
                    {fuels.data?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="quantityFuusto">Quantity in Fuusto *</label>
                  <input
                    id="quantityFuusto"
                    className="input"
                    name="quantityFuusto"
                    inputMode="decimal"
                    required
                    placeholder="e.g. 50"
                    value={fuustoInput}
                    onChange={(e) => setFuustoInput(e.target.value)}
                  />
                  <small className="muted" style={{ display: "block", marginTop: 4 }}>
                    Calculated liters: <b>{calculatedLitersPreview} L</b> (1 fuusto = 240 L)
                  </small>
                </div>
                {isOwner && (
                  <div className="field">
                    <label htmlFor="unitPurchaseCost">Unit Purchase Cost USD/Fuusto (Owner Only)</label>
                    <input id="unitPurchaseCost" className="input" name="unitPurchaseCost" inputMode="decimal" placeholder="e.g. 192.0000" />
                  </div>
                )}
                <div className="field full">
                  <label htmlFor="notes">Notes / Audit Remarks</label>
                  <input id="notes" className="input" name="notes" placeholder="e.g. Received at Mogadishu warehouse" />
                </div>
              </div>
              {create.isError && <div className="notice warn" style={{ marginTop: 16 }}>{(create.error as Error).message}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
                <SubmitButton busy={create.isPending}>Save Draft Stock Purchase</SubmitButton>
              </div>
            </form>
          </Card>

          <Card>
            <CardHead title="Stock Purchasing Rules" />
            <div className="card-body">
              <p>
                <b>01 · Purchasing in Fuusto</b>
                <br />
                All fuel stock purchases are recorded in <b>fuusto</b> containers.
              </p>
              <p>
                <b>02 · Confirmed Conversion</b>
                <br />
                1 fuusto is statically converted to <b>240 Liters</b> for canonical stock tracking.
              </p>
              <p>
                <b>03 · Posting Stock</b>
                <br />
                Draft receipts do not increase inventory balance until posted. Posting atomically increments warehouse stock.
              </p>
              <p>
                <b>04 · Confidentiality</b>
                <br />
                {isOwner
                  ? "You have Owner privileges. Purchase costs per fuusto are recorded and visible."
                  : "Office Employees register stock in fuusto; purchase costs remain restricted to Owner accounts."}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Stock Purchases Register */}
      <Card>
        <CardHead title="Fuel Stock Receiving Register" description="Draft and posted stock receipts" />
        {receipts.isLoading ? (
          <LoadingState />
        ) : receipts.isError ? (
          <ErrorState message={(receipts.error as Error).message} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Supplier / Ref</th>
                  <th>Fuel</th>
                  <th>Quantity (Fuusto)</th>
                  <th>Canonical Liters</th>
                  {isOwner && <th>Purchase Cost / Fuusto</th>}
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.data?.map((row) => (
                  <tr key={row.id}>
                    <td className="strong mono">{row.receiptNo}</td>
                    <td>{row.supplier ?? row.tankerReference ?? "—"}</td>
                    <td>{row.lines.map((x) => x.fuel.displayName).join(", ")}</td>
                    <td className="strong mono" style={{ fontSize: 13 }}>
                      {row.lines.map((x) => `${x.quantityFuusto ?? (Number(x.actualLiters) / 240).toFixed(3)} fuusto`).join(", ")}
                    </td>
                    <td className="mono muted">
                      {row.lines.map((x) => `${parseFloat(x.actualLiters).toLocaleString()} L`).join(", ")}
                    </td>
                    {isOwner && (
                      <td className="mono">
                        {row.lines.map((x) => (x.unitPurchaseCost ? `$${x.unitPurchaseCost}` : "—")).join(", ")}
                      </td>
                    )}
                    <td>
                      <Badge tone={row.status === "POSTED" ? "ok" : "warn"}>{row.status}</Badge>
                    </td>
                    <td style={{ textAlign: "right", display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button className="btn" onClick={() => setSelectedReceiptId(row.id)}>
                        View Details
                      </button>
                      {row.status === "DRAFT" && (
                        <button className="btn primary" disabled={post.isPending} onClick={() => post.mutate(row.id)}>
                          Post Receipt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {receipts.data?.length === 0 && <Empty>No fuel stock receipts recorded yet.</Empty>}
          </div>
        )}
      </Card>
    </main>
  );
}
