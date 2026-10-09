"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Actor } from "../../lib/api";
import { Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, SubmitButton } from "../../components/ui";

type Fuel = { id: string; code: string; displayName: string };
type UnitMaster = { id: string; code: string; name: string };
type UnitVersion = {
  id: string;
  fuel: string;
  unit: string;
  litersPerUnit: string;
  effectiveFromUtc: string;
  effectiveToUtc?: string | null;
};
type Price = {
  id: string;
  unitPrice: string;
  currencyCode: string;
  effectiveFromUtc: string;
  effectiveToUtc: string | null;
  fuel: { id: string; displayName: string };
  salesUnit: { id: string; name: string };
};

export default function PricingPage() {
  const client = useQueryClient();
  const [mode, setMode] = useState<"price" | "unit" | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const fuels = useQuery({ queryKey: ["fuels"], queryFn: () => api<Fuel[]>("/fuels") });
  const units = useQuery({ queryKey: ["sales-units"], queryFn: () => api<UnitMaster[]>("/sales-units") });
  const versions = useQuery({ queryKey: ["units"], queryFn: () => api<UnitVersion[]>("/units") });
  const prices = useQuery({ queryKey: ["prices"], queryFn: () => api<Price[]>("/prices/history") });

  const save = useMutation({
    mutationFn: ({ path, body }: { path: string; body: object }) =>
      api(path, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setMode(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["prices"] }),
        client.invalidateQueries({ queryKey: ["units"] })
      ]);
    }
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const dateInput = d.get("effectiveFromUtc");
    const common = {
      fuelId: d.get("fuelId"),
      salesUnitId: d.get("salesUnitId"),
      effectiveFromUtc: dateInput ? new Date(String(dateInput)).toISOString() : new Date().toISOString()
    };
    save.mutate(
      mode === "price"
        ? { path: "/prices", body: { ...common, unitPrice: d.get("value"), reason: d.get("reason") } }
        : { path: "/units", body: { ...common, litersPerUnit: d.get("value") } }
    );
  }

  const owner = me.data?.role === "OWNER";

  return (
    <main className="page">
      <PageHeader
        eyebrow="Price & Container Management"
        title="Price book & Fuusto configuration"
        description="Effective-dated master records. Confirmed sales orders retain their price and conversion snapshots forever."
        actions={
          owner ? (
            <>
              <button className="btn" onClick={() => setMode("unit")}>
                Configure Fuusto Liters
              </button>
              <button className="btn primary" onClick={() => setMode("price")}>
                Update Selling Price
              </button>
            </>
          ) : undefined
        }
      />

      <div className="notice">
        <b>Configurable Container Sizes:</b> 20 Liters is an illustrative example only. Sales order confirmations require an active Fuusto capacity version set up by an Owner.
      </div>

      <Modal
        isOpen={Boolean(mode)}
        onClose={() => setMode(null)}
        title={mode === "price" ? "Create Price Version (Owner Only)" : "Configure Fuusto Conversion Capacity (Owner Only)"}
      >
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Fuel Type *</label>
              <select className="select" name="fuelId" required>
                <option value="">Select fuel</option>
                {fuels.data?.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Sales Unit *</label>
              <select className="select" name="salesUnitId" required>
                <option value="">Select unit</option>
                {units.data?.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{mode === "price" ? "Price per Fuusto ($ USD) *" : "Liters per Fuusto *"}</label>
              <input className="input" name="value" inputMode="decimal" placeholder={mode === "price" ? "120.0000" : "20.000000"} required />
            </div>
            <div className="field">
              <label>Effective Date & Time *</label>
              <input className="input" name="effectiveFromUtc" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} />
            </div>
            {mode === "price" && (
              <div className="field full">
                <label>Update Reason</label>
                <input className="input" name="reason" placeholder="e.g. Inbound tanker price adjustment" />
              </div>
            )}
          </div>
          {save.isError && <div className="notice warn" role="alert" style={{ marginTop: 16 }}>{(save.error as Error).message}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setMode(null)}>
              Cancel
            </button>
            <SubmitButton busy={save.isPending}>Save Master Version</SubmitButton>
          </div>
        </form>
      </Modal>

      <div className="two-col">
        <Card>
          <CardHead title="Fuusto Capacity History" description="Liters per Fuusto unit configuration history" />
          {versions.isError ? (
            <ErrorState message={(versions.error as Error).message} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fuel</th>
                    <th>Unit</th>
                    <th>Capacity</th>
                    <th>Effective Date</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.data?.map((row) => (
                    <tr key={row.id}>
                      <td className="strong">{row.fuel}</td>
                      <td>{row.unit}</td>
                      <td className="strong mono">{row.litersPerUnit} L</td>
                      <td>{new Date(row.effectiveFromUtc).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {versions.data?.length === 0 && <Empty>No container capacity configured yet.</Empty>}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="Selling Price History" description="Active and historical selling price versions" />
          {prices.isError ? (
            <ErrorState message={(prices.error as Error).message} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fuel</th>
                    <th>Unit Price</th>
                    <th>Effective Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.data?.map((row) => (
                    <tr key={row.id}>
                      <td className="strong">{row.fuel.displayName}</td>
                      <td className="strong mono">
                        {row.currencyCode} ${row.unitPrice}
                      </td>
                      <td>{new Date(row.effectiveFromUtc).toLocaleString()}</td>
                      <td>
                        <Badge tone={row.effectiveToUtc ? "neutral" : "ok"}>
                          {row.effectiveToUtc ? "Historical" : "Active"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {prices.data?.length === 0 && <Empty>No prices configured yet.</Empty>}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

