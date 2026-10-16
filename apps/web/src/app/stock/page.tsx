"use client";
import { ActionButton, FormLabel, ActionLink } from "../../components/controls";
import { Fuel as FuelIcon } from "lucide-react";
import Decimal from "decimal.js";
import { FuelPrices } from "../../components/fuel-prices";
import { ReceiveStockForm } from "../../components/simple-forms";
import { decimal, dateTime, formatStatus, formatFuel, fuustoQuantity } from "../../lib/format";
import { FormEvent, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Actor, type PaginatedResponse } from "../../lib/api";
import { MetricCard, LoadingState, Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, Pagination, SubmitButton } from "../../components/ui";
import { notifyError, notifySuccess } from "../../lib/toast";
import { SupplierDebt } from "../../components/supplier-debt";

type Balance = { fuel: string; fuelName: string; location: string; balanceFuusto?: string; balanceLiters: string };
type Fuel = { id: string; code: string; displayName: string };
type Movement = {
  id: string;
  fuel: string;
  fuelName: string;
  location: string;
  eventType: string;
  quantityFuusto?: string;
  quantityLiters: string;
  sourceType: string;
  occurredAt: string;
};

export default function StockPage() {
  const client = useQueryClient();
  const [showAdjust, setShowAdjust] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
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
      notifySuccess("Kaydka shidaalka si guul leh ayaa loo saxay");
    },
    onError: error => notifyError(error, "Kaydka lama beddeli karin")
  });

  function handleAdjustSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    adjust.mutate({
      fuelId: d.get("fuelId"),
      quantityFuusto: d.get("fuustoDelta"),
      reason: d.get("reason")
    });
  }

  const isOwner = me.data?.role === "OWNER";
  const rawMovements = movements.data;
  const movementItems: Movement[] = Array.isArray(rawMovements) ? rawMovements : (rawMovements?.items ?? []);
  const totalPages = Array.isArray(rawMovements) ? 1 : (rawMovements?.totalPages ?? 1);

  return (
    <main className="page stock-page">
      <PageHeader
        eyebrow="Maamulka kaydka shidaalka"
        title="Kaydka Shidaalka"
        description="Kaydka bakhaarka, shidaalka jidka ku jira iyo taariikhda dhaqdhaqaaqa ee lagu qiyaaso fuustooyinka (1 fuusto = 240 litar)."
        actions={
          <>
            {isOwner && (
              <ActionButton className="btn" onClick={() => setShowAdjust(true)}>
                Wax Ka Beddelka Kaydka
              </ActionButton>
            )}
            <ActionButton className="btn primary" onClick={() => setShowReceive(true)}>Soo Geli Shidaal</ActionButton>
          </>
        }
      />

      <Modal isOpen={showAdjust} onClose={() => setShowAdjust(false)} title="Wax Ka Beddelka Kaydka">
        <form onSubmit={handleAdjustSubmit}>
          <div className="notice warn" style={{ marginBottom: 16 }}>
            Wax ka beddelku wuxuu beddelaa shidaalka bakhaarka ee rasmiga ah. Waxaa qasab ah sabab faahfaahsan oo audit ah.
          </div>
          <div className="form-grid">
            <div className="field">
              <FormLabel htmlFor="fuelId">Nooca Shidaalka *</FormLabel>
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
              <FormLabel htmlFor="fuustoDelta">Kala duwanaanshaha Fuustada * (+ / -)</FormLabel>
              <input id="fuustoDelta" className="input" name="fuustoDelta" required placeholder="tusaale: +5 ama -2" inputMode="numeric" />
            </div>
            <div className="field full">
              <FormLabel htmlFor="reason">Sababta Rasmiga ah ee Audit-ka *</FormLabel>
              <input id="reason" className="input" name="reason" required placeholder="tusaale: Wax ka beddelka cabbirka taangiga ee uu milkiiluhu ogolaaday" />
            </div>
          </div>
          {adjust.isError && <div className="notice warn" role="alert" style={{ marginTop: 16 }}>{(adjust.error as Error).message}</div>}
          <div className="form-actions">
            <ActionButton type="button" className="btn" onClick={() => setShowAdjust(false)}>
              Ka Noqo
            </ActionButton>
            <SubmitButton busy={adjust.isPending}>Diiwaangeli Beddelka</SubmitButton>
          </div>
        </form>
      </Modal>

      {balances.isLoading ? <LoadingState /> : balances.isError ? (
        <ErrorState message={(balances.error as Error).message} retry={() => void balances.refetch()} />
      ) : (
        <div className="simple-stock-grid">
          {balances.data?.filter(row => row.location === "WAREHOUSE").map((row) => {
            const fuusto = fuustoQuantity(row.balanceFuusto ?? new Decimal(row.balanceLiters).div(240).toFixed(3));
            const locationLabel = row.location === "WAREHOUSE" ? "Bakhaarka" : row.location === "IN_TRANSIT" ? "Jidka Ku Jira" : row.location;
            return (
              <MetricCard
                key={`${row.fuel}-${row.location}`}
                label={`${formatFuel(row.fuelName)} · ${locationLabel}`}
                value={`${fuusto} Fuusto`}
                note={`${decimal(row.balanceLiters)} litar oo sax ah`}
                icon={FuelIcon}
                dark={false}
              />
            );
          })}
        </div>
      )}

      <Modal isOpen={showReceive} onClose={() => setShowReceive(false)} title="Soo Geli Shidaal"><ReceiveStockForm onSaved={() => setShowReceive(false)} /></Modal>
      <FuelPrices />
      {isOwner && <SupplierDebt />}
      <Card><CardHead title="Shidaalkii soo galay" action={<ActionLink className="btn" href="/stock/receive">Eeg Rasiidhada</ActionLink>} /><div className="card-body"><p>Eeg shidaalka la soo iibsaday iyo rasiidhadiisa.</p></div></Card>
      <Card><details className="simple-disclosure"><summary>Taariikhda kaydka</summary>
        <div className="toolbar">
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", width: "100%" }}>
            <select
              className="select"
              value={selectedFuel}
              onChange={(e) => { setSelectedFuel(e.target.value); setPage(1); }}
            >
              <option value="">Dhammaan Noocyada Shidaalka</option>
              {fuels.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {formatFuel(f.displayName)}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={selectedEvent}
              onChange={(e) => { setSelectedEvent(e.target.value); setPage(1); }}
            >
              <option value="">Dhammaan Dhaqdhaqaaqyada</option>
              <option value="RECEIPT">SOO GELIN</option>
              <option value="DISPATCH">DIRIS</option>
              <option value="ACCEPTED">LA AQBALAY</option>
              <option value="RETURN">SOO CELIN</option>
              <option value="ADJUSTMENT">WAX KA BEDDEL</option>
            </select>
          </div>
        </div>

        {movements.isLoading ? <LoadingState /> : movements.isError ? (
          <ErrorState message={(movements.error as Error).message} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Taariikhda & Waqtiga</th>
                  <th>Shidaalka</th>
                  <th>Nooca Dhaqdhaqaaqa</th>
                  <th>Goobta</th>
                  <th>Tirada (Fuusto)</th>
                  <th>Litarada Rasmiga ah</th>
                  <th>Tixraaca Asalka</th>
                </tr>
              </thead>
              <tbody>
                {movementItems.map((row) => {
                  const fuustoQty = fuustoQuantity(row.quantityFuusto ?? new Decimal(row.quantityLiters).div(240).toFixed(3));
                  const locationText = row.location === "WAREHOUSE" ? "Bakhaarka" : row.location === "IN_TRANSIT" ? "Jidka Ku Jira" : row.location;
                  return (
                    <tr key={row.id}>
                      <td>{dateTime(row.occurredAt)}</td>
                      <td>{formatFuel(row.fuelName)}</td>
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
                          {formatStatus(row.eventType)}
                        </Badge>
                      </td>
                      <td>{locationText}</td>
                      <td className="mono strong" style={{ fontSize: 13 }}>{fuustoQty} Fuusto</td>
                      <td className="mono muted">{decimal(row.quantityLiters)} L</td>
                      <td>{formatStatus(row.sourceType)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {movementItems.length === 0 && <Empty>Ma jiraan dhaqdhaqaaqyo kayd ah oo la diiwaangeliyay.</Empty>}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </details></Card>
    </main>
  );
}
