"use client";
import { Fuel as FuelIcon, Pencil } from "lucide-react";
import { decimal, formatFuel, dateTime } from "../../lib/format";
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
  reason?: string | null;
  createdByName?: string | null;
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
    <main className="page pricing-page">
      <PageHeader
        eyebrow="Qiimaha Shidaalka & Cabbirrada"
        title="Qiimaha Shidaalka"
        description="Maamul qiimaha Naaftada iyo Basiinka. Dalabyadii hore ee la xaqiijiyay waxay haysanayaan qiimahoodii hore."
        actions={
          owner ? (
            <>
              <button className="btn" onClick={() => setMode("unit")}>
                Ajiin Cabbirka Fuustada (Litir)
              </button>
              <button className="btn primary" onClick={() => setMode("price")}>
                Cusboonaysii Qiimaha Iibka
              </button>
            </>
          ) : undefined
        }
      />

      <div className="price-grid">
        {fuels.data?.map(fuel => {
          const current = prices.data?.filter(p => p.fuel.id === fuel.id && new Date(p.effectiveFromUtc).getTime() <= Date.now() && (!p.effectiveToUtc || new Date(p.effectiveToUtc).getTime() > Date.now())) ?? [];
          return (
            <Card className="price-card" key={fuel.id}>
              <div className="metric-top">
                <Badge tone={current.length ? "ok" : "warn"}>
                  {current.length ? "Qiimaha Iibka ee Hada Jira" : "Aan La Dejin"}
                </Badge>
                <span className="metric-icon"><FuelIcon size={18} /></span>
              </div>
              <h2>{formatFuel(fuel.displayName)}</h2>
              {prices.isError ? (
                <ErrorState message={prices.error.message} retry={() => void prices.refetch()} />
              ) : current.length ? (
                current.map(price => (
                  <div key={price.id}>
                    <div className="price-value mono">
                      {price.currencyCode} ${decimal(price.unitPrice)}
                      <small>/ {price.salesUnit.name}</small>
                    </div>
                    <div className="price-meta">
                      <span>Dhaqangal: {dateTime(price.effectiveFromUtc)}</span>
                      {owner && (
                        <button className="btn dark small" onClick={() => setMode("price")}>
                          <Pencil size={13} /> Wax Ka Beddel Qiimaha
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  {prices.isLoading ? "La soo rarayaa qiimaha…" : "Milkiilaha waa inuu dhigo qiimaha iibka ka hor inta aysan shaqaaluhu xaqiijin dalabyada."}
                </p>
              )}
            </Card>
          );
        })}
      </div>
      <div className="notice">
        <b>Cabbirka Fuustada:</b> Dhig tirada litir ee fuustadiiba ka hor xaqiijinta dalabyada. Cabbirrada cusub ma beddelaan tiradii hore.
      </div>

      <Modal
        isOpen={Boolean(mode)}
        onClose={() => setMode(null)}
        title={mode === "price" ? "Beddel Qiimaha Iibka (Milkiilaha Kaliya)" : "Dhig Cabbirka Fuustada (Milkiilaha Kaliya)"}
      >
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="fuelId">Nooca Shidaalka *</label>
              <select id="fuelId" className="select" name="fuelId" required>
                <option value="">Dooro shidaal</option>
                {fuels.data?.map((x) => (
                  <option key={x.id} value={x.id}>
                    {formatFuel(x.displayName)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="salesUnitId">Qaybta Iibka *</label>
              <select id="salesUnitId" className="select" name="salesUnitId" required>
                <option value="">Dooro qayb</option>
                {units.data?.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="value">{mode === "price" ? "Qiimaha Fuustadii ($ USD) *" : "Litirkiiba Fuusto *"}</label>
              <input id="value" className="input" name="value" inputMode="decimal" placeholder={mode === "price" ? "Geli qiimaha iibka" : "Geli tirada litirka fuustada"} required />
            </div>
            <div className="field">
              <label htmlFor="effectiveFromUtc">Taariikhda & Waqtiga Dhaqangalinta *</label>
              <input id="effectiveFromUtc" className="input" name="effectiveFromUtc" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} />
            </div>
            {mode === "price" && (
              <div className="field full">
                <label htmlFor="reason">Sababta Wax ka Beddelka</label>
                <input id="reason" className="input" name="reason" placeholder="tusaale: Isbeddelka qiimaha shidaalka soo galay" />
              </div>
            )}
          </div>
          {save.isError && <div className="notice warn" role="alert" style={{ marginTop: 16 }}>{(save.error as Error).message}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setMode(null)}>
              Ka Noqo
            </button>
            <SubmitButton busy={save.isPending}>Kaydi Qiimaha Cusub</SubmitButton>
          </div>
        </form>
      </Modal>

      <div className="two-col equal-cols">
        <Card>
          <CardHead title="Taariikhda Cabbirka Fuustada" description="Taariikhda isbeddelka litirada ku jira fuustadiiba" />
          {versions.isError ? (
            <ErrorState message={(versions.error as Error).message} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Shidaalka</th>
                    <th>Qaybta</th>
                    <th>Cabbirka</th>
                    <th>Taariikhda Dhaqangalinta</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.data?.map((row) => (
                    <tr key={row.id}>
                      <td className="strong">{formatFuel(row.fuel)}</td>
                      <td>{row.unit}</td>
                      <td className="strong mono">{row.litersPerUnit} Litir</td>
                      <td>{dateTime(row.effectiveFromUtc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {versions.data?.length === 0 && <Empty>Wali ma jiraan cabbirro fuusto oo la dhigay.</Empty>}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="Taariikhda Qiimaha Iibka" description="Diiwaanka qiimayaashii hore iyo kuwa hadda dhaqangalka ah" />
          {prices.isError ? (
            <ErrorState message={(prices.error as Error).message} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Shidaalka</th>
                    <th>Qiimaha / Fuusto</th>
                    <th>Taariikhda Dhaqangalinta</th>
                    <th>Cusboonaysiiyaha</th>
                    <th>Sababta</th>
                    <th>Xaaladda</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.data?.map((row) => (
                    <tr key={row.id}>
                      <td className="strong">{formatFuel(row.fuel.displayName)}</td>
                      <td className="strong mono">
                        {row.currencyCode} ${row.unitPrice} / fuusto
                      </td>
                      <td>{dateTime(row.effectiveFromUtc)}</td>
                      <td>{row.createdByName ?? "Nidaamka"}</td>
                      <td className="muted">{row.reason ?? "—"}</td>
                      <td>
                        <Badge tone={row.effectiveToUtc ? "neutral" : "ok"}>
                          {row.effectiveToUtc ? "Tii Hore" : "Dhaqangal"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {prices.data?.length === 0 && <Empty>Wali ma jiraan qiimayaal la dhigay.</Empty>}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

