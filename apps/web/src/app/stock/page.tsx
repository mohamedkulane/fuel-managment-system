"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Actor, type PaginatedResponse } from "../../lib/api";
import { Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, Pagination, SubmitButton } from "../../components/ui";

type Balance = { fuel: string; fuelName: string; location: string; balanceLiters: string };
type Fuel = { id: string; code: string; displayName: string };
type Movement = {
  id: string;
  fuel: string;
  fuelName: string;
  location: string;
  eventType: string;
  quantityLiters: string;
  sourceType: string;
  occurredAt: string;
};

export default function StockPage() {
  const client = useQueryClient();
  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedFuel, setSelectedFuel] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [page, setPage] = useState(1);

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const fuels = useQuery({ queryKey: ["fuels"], queryFn: () => api<Fuel[]>("/fuels") });
  const balances = useQuery({ queryKey: ["stock", "balances"], queryFn: () => api<Balance[]>("/stock/balances") });

  const queryParams = new URLSearchParams({ page: String(page), limit: "15" });
  if (selectedFuel) queryParams.set("fuelId", selectedFuel);
  if (selectedEvent) queryParams.set("eventType", selectedEvent);

  const movements = useQuery({
    queryKey: ["stock", "movements", selectedFuel, selectedEvent, page],
    queryFn: () => api<PaginatedResponse<Movement> | Movement[]>(`/stock/movements?${queryParams.toString()}`)
  });

  const adjust = useMutation({
    mutationFn: (body: object) => api("/stock/adjustments", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setShowAdjust(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["stock", "balances"] }),
        client.invalidateQueries({ queryKey: ["stock", "movements"] })
      ]);
    }
  });

  function handleAdjustSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    adjust.mutate({
      fuelId: d.get("fuelId"),
      signedDeltaLiters: d.get("delta"),
      reason: d.get("reason")
    });
  }

  const isOwner = me.data?.role === "OWNER";
  const rawMovements = movements.data;
  const movementItems: Movement[] = Array.isArray(rawMovements) ? rawMovements : (rawMovements?.items ?? []);
  const totalPages = Array.isArray(rawMovements) ? 1 : (rawMovements?.totalPages ?? 1);

  return (
    <main className="page">
      <PageHeader
        eyebrow="Inventory control"
        title="Fuel inventory"
        description="Warehouse and in-transit liters are separate posted physical balances."
        actions={
          <>
            {isOwner && (
              <button className="btn" onClick={() => setShowAdjust(true)}>
                Stock Adjustment
              </button>
            )}
            <Link className="btn primary" href="/stock/receive">
              Receive tanker
            </Link>
          </>
        }
      />

      <Modal isOpen={showAdjust} onClose={() => setShowAdjust(false)} title="Record Manual Stock Adjustment (Owner Only)">
        <form onSubmit={handleAdjustSubmit}>
          <div className="notice warn" style={{ marginBottom: 16 }}>
            Adjustments alter physical warehouse stock. A detailed reason is required for audit verification.
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Fuel Type *</label>
              <select className="select" name="fuelId" required>
                <option value="">Select fuel type</option>
                {fuels.data?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Signed Delta Liters * (+ / -)</label>
              <input className="input" name="delta" required placeholder="e.g. 500 or -150" inputMode="decimal" />
            </div>
            <div className="field full">
              <label>Mandatory Audit Reason *</label>
              <input className="input" name="reason" required placeholder="e.g. Tank calibration adjustment approved by owner" />
            </div>
          </div>
          {adjust.isError && <div className="notice warn" role="alert" style={{ marginTop: 16 }}>{(adjust.error as Error).message}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setShowAdjust(false)}>
              Cancel
            </button>
            <SubmitButton busy={adjust.isPending}>Post Adjustment</SubmitButton>
          </div>
        </form>
      </Modal>

      {balances.isError ? (
        <ErrorState message={(balances.error as Error).message} retry={() => void balances.refetch()} />
      ) : (
        <div className="grid">
          {balances.data?.map((row) => (
            <Card className="kpi" key={`${row.fuel}-${row.location}`}>
              <small>{row.fuelName}</small>
              <strong className="mono">{row.balanceLiters} L</strong>
              <span>{row.location.replace("_", " ")}</span>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHead title="Stock Movement Ledger" description="Receipts, dispatch, acceptance, return and adjustment remain distinct audit events" />
        <div className="toolbar">
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", width: "100%" }}>
            <select
              className="select"
              value={selectedFuel}
              onChange={(e) => { setSelectedFuel(e.target.value); setPage(1); }}
            >
              <option value="">All Fuel Types</option>
              {fuels.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.displayName}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={selectedEvent}
              onChange={(e) => { setSelectedEvent(e.target.value); setPage(1); }}
            >
              <option value="">All Movement Types</option>
              <option value="RECEIPT">RECEIPT</option>
              <option value="DISPATCH">DISPATCH</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="RETURN">RETURN</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
            </select>
          </div>
        </div>

        {movements.isError ? (
          <ErrorState message={(movements.error as Error).message} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Fuel</th>
                  <th>Movement Type</th>
                  <th>Location</th>
                  <th>Quantity (Liters)</th>
                  <th>Source Reference</th>
                </tr>
              </thead>
              <tbody>
                {movementItems.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.occurredAt).toLocaleString()}</td>
                    <td>{row.fuelName}</td>
                    <td>
                      <Badge
                        tone={
                          row.eventType === "RECEIPT" || row.eventType === "RETURN"
                            ? "ok"
                            : row.eventType === "ADJUSTMENT"
                            ? "warn"
                            : "info"
                        }
                      >
                        {row.eventType}
                      </Badge>
                    </td>
                    <td>{row.location.replace("_", " ")}</td>
                    <td className="mono strong">{row.quantityLiters} L</td>
                    <td>{row.sourceType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movementItems.length === 0 && <Empty>No posted stock movements found.</Empty>}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </main>
  );
}

