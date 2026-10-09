"use client";
import { dateTime } from "../../../lib/format";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, mutationKey, type Actor } from "../../../lib/api";
import { LoadingState, Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, SubmitButton } from "../../../components/ui";

type Fuel = { id: string; code: string; displayName: string };
type ReceiptLine = {
  id: string;
  actualLiters: string;
  expectedLiters: string | null;
  unitPurchaseCost?: string | null;
  fuel: { displayName: string };
};
type Receipt = {
  id: string;
  receiptNo: string;
  tankerReference: string | null;
  arrivedAt: string;
  status: string;
  postedAt: string | null;
  lines: ReceiptLine[];
};

export default function ReceivePage() {
  const client = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const fuels = useQuery({ queryKey: ["fuels"], queryFn: () => api<Fuel[]>("/fuels") });
  const receipts = useQuery({ queryKey: ["tanker-receipts"], queryFn: () => api<Receipt[]>("/tanker-receipts") });

  const receiptDetail = useQuery({
    queryKey: ["tanker-receipt", selectedReceiptId],
    queryFn: () => api<Receipt>(`/tanker-receipts/${selectedReceiptId}`),
    enabled: Boolean(selectedReceiptId)
  });

  const create = useMutation({
    mutationFn: (body: object) => api<Receipt>("/tanker-receipts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setShowCreate(false);
      await client.invalidateQueries({ queryKey: ["tanker-receipts"] });
    }
  });

  const post = useMutation({
    mutationFn: (id: string) =>
      api(`/tanker-receipts/${id}/post`, {
        method: "POST",
        headers: { "idempotency-key": mutationKey() }
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["tanker-receipts"] }),
        client.invalidateQueries({ queryKey: ["stock"] }),
        client.invalidateQueries({ queryKey: ["tanker-receipt"] })
      ]);
    }
  });

  const isOwner = me.data?.role === "OWNER";

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const cost = d.get("unitPurchaseCost");
    create.mutate({
      tankerReference: d.get("reference"),
      arrivedAt: d.get("arrivedAt"),
      lines: [
        {
          fuelId: d.get("fuelId"),
          actualLiters: d.get("actualLiters"),
          expectedLiters: d.get("expectedLiters") || undefined,
          unitPurchaseCost: isOwner && cost ? String(cost) : undefined
        }
      ]
    });
  }

  return (
    <main className="page receive-page">
      <PageHeader
        eyebrow="Stock receiving"
        title="Tanker receipts"
        description="Record incoming booyado and post verified liters into warehouse stock."
        actions={<button className="btn primary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Close arrival form" : "Register new tanker"}</button>}
      />

      {selectedReceiptId && (
        <Modal isOpen={Boolean(selectedReceiptId)} onClose={() => setSelectedReceiptId(null)} title="Tanker Receipt Details">
          {receiptDetail.isLoading ? (
            <div>Loading receipt details…</div>
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
                    <small className="muted">Tanker / Truck Reference</small>
                    <div>{receiptDetail.data.tankerReference ?? "—"}</div>
                  </div>
                  <div>
                    <small className="muted">Arrived At</small>
                    <div>{dateTime(receiptDetail.data.arrivedAt)}</div>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fuel</th>
                        <th>Actual Measured Liters</th>
                        <th>Expected Liters</th>
                        {isOwner && <th>Unit Purchase Cost ($/L)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {receiptDetail.data.lines.map((line) => (
                        <tr key={line.id}>
                          <td>{line.fuel.displayName}</td>
                          <td className="strong mono">{line.actualLiters} L</td>
                          <td>{line.expectedLiters ? `${line.expectedLiters} L` : "—"}</td>
                          {isOwner && <td className="mono">{line.unitPurchaseCost ? `$${line.unitPurchaseCost}` : "—"}</td>}
                        </tr>
                      ))}
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
                      {post.isPending ? "Posting…" : "Post Receipt to Stock"}
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </Modal>
      )}

      {showCreate && <div className="two-col">
        <Card>
          <CardHead title="Record Tanker Arrival" description="Saving creates a draft receipt; posting updates inventory stock." />
          <form className="card-body" onSubmit={submit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="reference">Truck / Tanker reference</label>
                <input id="reference" className="input" name="reference" placeholder="e.g. Tanker #TRK-884" />
              </div>
              <div className="field">
                <label htmlFor="arrivedAt">Arrival date & time *</label>
                <input id="arrivedAt" className="input" name="arrivedAt" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} />
              </div>
              <div className="field">
                <label htmlFor="fuelId">Fuel type *</label>
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
                <label htmlFor="actualLiters">Actual measured liters *</label>
                <input id="actualLiters" className="input" name="actualLiters" inputMode="decimal" required placeholder="e.g. 10000.000" />
              </div>
              <div className="field">
                <label htmlFor="expectedLiters">Expected liters (optional)</label>
                <input id="expectedLiters" className="input" name="expectedLiters" inputMode="decimal" placeholder="e.g. 10000.000" />
              </div>
              {isOwner && (
                <div className="field">
                  <label htmlFor="unitPurchaseCost">Unit purchase cost USD/L (Owner only)</label>
                  <input id="unitPurchaseCost" className="input" name="unitPurchaseCost" inputMode="decimal" placeholder="e.g. 0.8500" />
                </div>
              )}
            </div>
            {create.isError && <div className="notice warn" style={{ marginTop: 16 }}>{(create.error as Error).message}</div>}
            <div className="form-actions">
              <SubmitButton busy={create.isPending}>Save Draft Receipt</SubmitButton>
            </div>
          </form>
        </Card>

        <Card>
          <CardHead title="Before you post" />
          <div className="card-body">
            <p>
              <b>01 · Measure the fuel</b>
              <br />
              All fuel is stocked in actual liters.
            </p>
            <p>
              <b>02 · Review and post</b>
              <br />
              Review the draft before posting. Posting adds the measured liters to warehouse stock.
            </p>
            <p>
              <b>03 · Purchase information</b>
              <br />
              {isOwner
                ? "You have Owner privileges. Purchase costs are recorded and visible."
                : "Office Employees can register deliveries in liters; purchase costs are restricted to Owner accounts."}
            </p>
          </div>
        </Card>
      </div>}

      <Card>
        <CardHead title="Incoming Tanker Register" description="Draft and posted tanker receipts" />
        {receipts.isLoading ? <LoadingState /> : receipts.isError ? (
          <ErrorState message={(receipts.error as Error).message} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Truck Reference</th>
                  <th>Fuel</th>
                  <th>Actual Liters</th>
                  {isOwner && <th>Unit Purchase Cost</th>}
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.data?.map((row) => (
                  <tr key={row.id}>
                    <td className="strong mono">{row.receiptNo}</td>
                    <td>{row.tankerReference ?? "—"}</td>
                    <td>{row.lines.map((x) => x.fuel.displayName).join(", ")}</td>
                    <td className="strong mono">{row.lines.map((x) => `${x.actualLiters} L`).join(", ")}</td>
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
            {receipts.data?.length === 0 && <Empty>No tanker receipts recorded yet.</Empty>}
          </div>
        )}
      </Card>
    </main>
  );
}

