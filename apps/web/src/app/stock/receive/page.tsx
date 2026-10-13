"use client";
import { ReceiveStockForm } from "../../../components/simple-forms";
import { ActionLink } from "../../../components/controls";
import { ActionButton, FormLabel } from "../../../components/controls";

import Decimal from "decimal.js";
import { dateTime, decimal, formatStatus, formatFuel, fuustoQuantity } from "../../../lib/format";
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

  function validDecimal(value: string): Decimal | null {
    if (!value.trim()) return null;
    try {
      const result = new Decimal(value);
      return result.isFinite() && result.greaterThan(0) ? result : null;
    } catch {
      return null;
    }
  }

  function handleUnitCostChange(val: string) {
    setUnitCostInput(val);
    const unitCost = validDecimal(val);
    if (!unitCost) {
      if (!val) setTotalCostInput("");
      return;
    }
    const fuusto = validDecimal(fuustoInput);
    if (fuusto) {
      setTotalCostInput(unitCost.mul(fuusto).toFixed(2));
    }
  }

  function handleTotalCostChange(val: string) {
    setTotalCostInput(val);
    const totalCost = validDecimal(val);
    if (!totalCost) {
      if (!val) setUnitCostInput("");
      return;
    }
    const fuusto = validDecimal(fuustoInput);
    if (fuusto) {
      setUnitCostInput(totalCost.div(fuusto).toFixed(4));
    }
  }

  function handleFuustoChange(val: string) {
    setFuustoInput(val);
    const fuusto = validDecimal(val);
    const unitCost = validDecimal(unitCostInput);
    const totalCost = validDecimal(totalCostInput);
    if (fuusto && unitCost) {
      setTotalCostInput(unitCost.mul(fuusto).toFixed(2));
    } else if (fuusto && totalCost) {
      setUnitCostInput(totalCost.div(fuusto).toFixed(4));
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

  const calculatedLitersPreview = validDecimal(fuustoInput)?.mul(240).toFixed(2) ?? "0.00";

  return (
    <main className="page receive-page">
      <PageHeader
        eyebrow="Iibka kaydka shidaalka"
        title="Shidaal Soo Gelin"
        description="Diiwaangeli iibka shidaalka ee cusub ee fuustooyinka (1 fuusto = 240 litar). Qiimaha iibka waa dookh oo waxaa u furan kaliya Milkiilaha."
        
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
                        const fuustoVal = fuustoQuantity(line.quantityFuusto ?? new Decimal(line.actualLiters).div(240).toFixed(3));
                        return (
                          <tr key={line.id}>
                            <td>{formatFuel(line.fuel.displayName)}</td>
                            <td className="strong mono" style={{ fontSize: 14 }}>{fuustoVal} Fuusto</td>
                            <td className="mono muted">{decimal(line.actualLiters)} L</td>
                            {isOwner && <td className="mono">{line.unitPurchaseCost ? `$${decimal(line.unitPurchaseCost, 4)}` : <span className="muted">Aan la diiwaangelin</span>}</td>}
                            {isOwner && <td className="mono">{line.totalPurchaseCost ? `$${decimal(line.totalPurchaseCost, 2)}` : <span className="muted">Aan la diiwaangelin</span>}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {receiptDetail.data.status === "DRAFT" && (
                  <div className="form-actions" style={{ marginTop: 20 }}>
                    <ActionButton
                      className="btn primary"
                      disabled={post.isPending}
                      onClick={() => post.mutate(receiptDetail.data!.id)}
                    >
                      {post.isPending ? "Diiwaangelinaya…" : "Ku Diiwaangeli Kaydka Bakhaarka"}
                    </ActionButton>
                  </div>
                )}
              </div>
            )
          )}
        </Modal>
      )}

      {/* New Stock Purchase Form */}
      <Card><CardHead title="Shidaal Soo Geli" action={<ActionLink className="btn" href="/stock">Back to Stock</ActionLink>}/><div className="card-body"><ReceiveStockForm onSaved={() => setShowCreate(false)} /></div></Card>

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
                      {row.lines.map((x) => `${fuustoQuantity(x.quantityFuusto ?? new Decimal(x.actualLiters).div(240).toFixed(3))} Fuusto`).join(", ")}
                    </td>
                    <td className="mono muted">
                      {row.lines.map((x) => `${decimal(x.actualLiters)} L`).join(", ")}
                    </td>
                    {isOwner && (
                      <td className="mono">
                        {row.lines.map((x) => (x.unitPurchaseCost ? `$${decimal(x.unitPurchaseCost, 4)}` : "—")).join(", ")}
                      </td>
                    )}
                    {isOwner && (
                      <td className="mono">
                        {row.lines.map((x) => (x.totalPurchaseCost ? `$${decimal(x.totalPurchaseCost, 2)}` : "—")).join(", ")}
                      </td>
                    )}
                    <td>
                      <Badge tone={row.status === "POSTED" ? "ok" : "warn"}>{formatStatus(row.status)}</Badge>
                    </td>
                    <td style={{ textAlign: "right", display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <ActionButton className="btn" onClick={() => setSelectedReceiptId(row.id)}>
                        Eeg Faahfaahinta
                      </ActionButton>
                      {row.status === "DRAFT" && (
                        <ActionButton className="btn primary" disabled={post.isPending} onClick={() => post.mutate(row.id)}>
                          Diiwaangeli Rasiidhka
                        </ActionButton>
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
