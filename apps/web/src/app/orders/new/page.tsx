"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { useRouter } from "next/navigation";
import { api, type Actor, type PaginatedResponse } from "../../../lib/api";
import { businessDate, decimal, formatFuel } from "../../../lib/format";
import { ActionButton, ActionLink, FormLabel } from "../../../components/controls";
import { useWorkflow } from "../../../components/simple-forms";
import { Card, CardHead, ErrorState, PageHeader, SubmitButton } from "../../../components/ui";
import { notifyError, notifySuccess } from "../../../lib/toast";

type Customer = {
  id: string;
  name: string;
  primaryPhone: string | null;
  addresses: { addressText: string }[];
};

type OrderLineState = {
  id: string;
  fuelId: string;
  qty: string;
};

export default function NewOrderPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerListOpen, setCustomerListOpen] = useState(false);
  const [lines, setLines] = useState<OrderLineState[]>([
    { id: "line-1", fuelId: "", qty: "" }
  ]);
  const [deliveryDate, setDeliveryDate] = useState(() => businessDate());
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [financialAccountId, setFinancialAccountId] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const customerSearch = searchTerm.length >= 2 ? searchTerm : "";
  const customers = useQuery({
    queryKey: ["customers", "order-search", customerSearch],
    queryFn: () => api<PaginatedResponse<Customer>>(`/customers?limit=100&search=${encodeURIComponent(customerSearch)}`)
  });
  const fuels = useQuery({ queryKey: ["fuels"], queryFn: () => api<{ id: string; displayName: string }[]>("/fuels") });
  const units = useQuery({ queryKey: ["sales-units"], queryFn: () => api<{ id: string; code: string }[]>("/sales-units") });
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const accounts = useQuery({
    queryKey: ["financial-accounts", "selectable"],
    queryFn: () => api<Array<{ id: string; name: string; identifierMasked: string | null; currentBalance: string | null }>>("/financial-accounts/selectable")
  });
  const unit = units.data?.find((item) => item.code.toUpperCase() === "FUUSTO");

  const fuelList = fuels.data ?? [];

  // Query price for each fuel
  const priceQueries = useQueries({
    queries: fuelList.map((fuel) => ({
      queryKey: ["prices", "current", fuel.id, unit?.id],
      queryFn: () => api<{ id: string; unitPrice: string } | null>(`/prices/current?fuelId=${fuel.id}&unitId=${unit?.id}`),
      enabled: Boolean(fuel.id && unit?.id)
    }))
  });

  const priceMap = new Map<string, { id: string; unitPrice: string }>();
  fuelList.forEach((fuel, idx) => {
    const p = priceQueries[idx]?.data;
    if (p) priceMap.set(fuel.id, p);
  });

  // Auto-select first fuel for the initial row if empty
  useEffect(() => {
    const firstFuel = fuelList[0];
    const firstLine = lines[0];
    if (firstFuel && lines.length === 1 && firstLine && !firstLine.fuelId) {
      setLines([{ id: "line-1", fuelId: firstFuel.id, qty: "" }]);
    }
  }, [fuelList, lines]);

  function updateLine(id: string, field: "fuelId" | "qty", value: string) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  function addLine() {
    if (lines.length >= fuelList.length) return;
    const selectedFuelIds = new Set(lines.map((l) => l.fuelId));
    const nextFuel = fuelList.find((f) => !selectedFuelIds.has(f.id));
    setLines((prev) => [
      ...prev,
      { id: `line-${Date.now()}`, fuelId: nextFuel?.id ?? "", qty: "" }
    ]);
  }

  function removeLine(id: string) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const save = useWorkflow<{
    customerId: string;
    lines: Array<{
      fuelId: string;
      salesUnitId: string;
      quantity: string;
      expectedPriceId?: string;
    }>;
    address: string;
    requestedDeliveryDate?: string;
    discount: string;
    paidNow: string;
    financialAccountId?: string;
    notes: string;
  }>(
    "/simple/orders",
    (result) => {
      notifySuccess(result.status === "DRAFT" ? "Dalabka waa la qabyo-tiray" : "Dalabka si guul leh ayaa loo xaqiijiyay");
      router.push(`/orders/${result.id}?invoice=1`);
    },
    { error: "Dalabka lama keydin karin" }
  );

  const safe = (value: string) => (/^\d+(\.\d{1,4})?$/.test(value) ? new Decimal(value) : new Decimal(0));
  const isWhole = (value: string) => /^[1-9]\d*$/.test(value.trim());

  let subtotal = new Decimal(0);
  let totalLiters = new Decimal(0);
  let totalUnits = 0;
  let allLinesValid = lines.length > 0;

  const computedLines = lines.map((line) => {
    const p = line.fuelId ? priceMap.get(line.fuelId) : null;
    const validQty = isWhole(line.qty);
    const qtyNum = validQty ? parseInt(line.qty, 10) : 0;
    const unitPrice = p ? new Decimal(p.unitPrice) : new Decimal(0);
    const lineSubtotal = validQty ? unitPrice.mul(qtyNum) : new Decimal(0);
    const lineLiters = validQty ? new Decimal(qtyNum).mul(240) : new Decimal(0);

    if (!line.fuelId || !validQty || !p) {
      allLinesValid = false;
    }

    subtotal = subtotal.add(lineSubtotal);
    totalLiters = totalLiters.add(lineLiters);
    totalUnits += qtyNum;

    return {
      ...line,
      price: p,
      unitPrice,
      validQty,
      lineSubtotal,
      lineLiters,
    };
  });

  const total = Decimal.max(0, subtotal.sub(safe(discount)));
  const remaining = total.sub(safe(paid));
  const pending = safe(discount).gt(0) && me.data?.role === "OFFICE_EMPLOYEE";

  function selectCustomer(selected: Customer) {
    setCustomer(selected);
    setAddress(selected.addresses[0]?.addressText ?? "");
    setCustomerListOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending || !customer || !unit || !allLinesValid) return;
    if (remaining.lt(0)) {
      notifyError(new Error("Lacag-dhaaf"), "Lacagta hadda la bixinayo kama badnaan karto wadarta dalabka.");
      return;
    }
    if (safe(paid).gt(0) && !financialAccountId) {
      notifyError(new Error("Akoonka lacagta"), "Fadlan dooro akoonka lacagta lagu qabtay.");
      return;
    }

    save.mutate({
      customerId: customer.id,
      lines: computedLines.map((line) => ({
        fuelId: line.fuelId,
        salesUnitId: unit.id,
        quantity: line.qty,
        expectedPriceId: line.price?.id,
      })),
      address: address.trim() || "Xarunta Macmiilka",
      requestedDeliveryDate: deliveryDate || undefined,
      discount: discount || "0",
      paidNow: paid || "0",
      financialAccountId: safe(paid).gt(0) ? financialAccountId : undefined,
      notes
    });
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow=""
        title="Dalab Cusub"
        description="Dooro macmiilka, noocyada shidaalka iyo tirada fuustooyinka la dalbanayo."
        actions={<ActionLink className="btn" href="/orders">Ku Noqo Dalabyada</ActionLink>}
      />
      <form onSubmit={submit}>
        <div className="two-col">
          <Card>
            <CardHead title="Faahfaahinta Dalabka" />
            <div className="card-body">
              <div className="form-grid">
                <div className="field full">
                  <FormLabel htmlFor="customer-search">Raadi Macmiilka</FormLabel>
                  <input
                    id="customer-search"
                    className="input"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setSearchTerm("");
                      setCustomer(null);
                      setAddress("");
                      setCustomerListOpen(true);
                    }}
                    placeholder="Geli magaca ama telefoonka macmiilka…"
                    autoComplete="off"
                    aria-controls="customer-options"
                    aria-expanded={customerListOpen}
                  />
                  {customers.isFetching ? (
                    <p role="status">Raraya macaamiisha…</p>
                  ) : customers.isError ? (
                    <ErrorState message="Macaamiisha lama soo rari karin." retry={() => void customers.refetch()} />
                  ) : searchTerm.length < 2 ? (
                    <p className="text-muted">Dooro macmiil liiska hoose ama ku raadi magaca/telefoonka.</p>
                  ) : customers.data?.items.length === 0 ? (
                    <p role="status">Macmiil lama helin.</p>
                  ) : null}
                </div>

                <div className="field full customer-picker">
                  <FormLabel htmlFor="customer-list-toggle">Macmiilka La Doortay *</FormLabel>
                  <button
                    id="customer-list-toggle"
                    type="button"
                    className="select customer-picker-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={customerListOpen}
                    aria-controls="customer-options"
                    disabled={customers.isPending || customers.isError}
                    onClick={() => setCustomerListOpen((open) => !open)}
                  >
                    <span>{customer ? `${customer.name}${customer.primaryPhone ? ` · ${customer.primaryPhone}` : ""}` : customers.isPending ? "Raraya macaamiisha…" : "Guji halkan si aad macmiil u doorato"}</span>
                    <span aria-hidden="true">{customerListOpen ? "⌃" : "⌄"}</span>
                  </button>
                  {customerListOpen && customers.data && (
                    <div id="customer-options" className="customer-picker-options" role="listbox" aria-label="Macaamiisha">
                      {customers.data.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={customer?.id === item.id}
                          className="customer-picker-option"
                          onClick={() => selectCustomer(item)}
                        >
                          <span>{item.name}</span>
                          {item.primaryPhone && <small>{item.primaryPhone}</small>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="field full">
                  <FormLabel htmlFor="order-address">Goobta ama Ciwaanka Gaarsiinta *</FormLabel>
                  <input
                    id="order-address"
                    className="input"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="tusaale: Bakhaarka Degmada Hodan ama Dekedda"
                    required
                  />
                </div>
              </div>

              {/* Fuel Lines Section */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Khadadka Shidaalka (Fuusto)</h3>
                  {lines.length < fuelList.length && (
                    <ActionButton
                      type="button"
                      className="btn small secondary"
                      style={{ fontSize: 13, padding: "3px 10px" }}
                      onClick={addLine}
                    >
                      + Ku dar Shidaal Kale
                    </ActionButton>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {computedLines.map((line, index) => {
                    const otherSelectedFuelIds = new Set(
                      lines.filter((l) => l.id !== line.id).map((l) => l.fuelId)
                    );
                    return (
                      <div
                        key={line.id}
                        style={{
                          padding: 12,
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          background: "var(--card-bg, #fff)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--muted)" }}>
                            Khadka {index + 1}
                          </span>
                          {lines.length > 1 && (
                            <button
                              type="button"
                              className="btn-link"
                              style={{ color: "var(--red, #dc2626)", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}
                              onClick={() => removeLine(line.id)}
                            >
                              Ka Saar
                            </button>
                          )}
                        </div>
                        <div className="form-grid">
                          <div className="field">
                            <FormLabel htmlFor={`fuel-${line.id}`}>Nooca Shidaalka *</FormLabel>
                            <select
                              id={`fuel-${line.id}`}
                              className="select"
                              value={line.fuelId}
                              onChange={(e) => updateLine(line.id, "fuelId", e.target.value)}
                              required
                            >
                              <option value="">Dooro nooca shidaalka</option>
                              {fuelList.map((fuel) => (
                                <option
                                  key={fuel.id}
                                  value={fuel.id}
                                  disabled={otherSelectedFuelIds.has(fuel.id)}
                                >
                                  {formatFuel(fuel.displayName)} {otherSelectedFuelIds.has(fuel.id) ? "(horey loo doortay)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="field">
                            <FormLabel htmlFor={`qty-${line.id}`}>Tirada Fuustooyinka *</FormLabel>
                            <input
                              id={`qty-${line.id}`}
                              type="number"
                              min="1"
                              step="1"
                              className="input"
                              value={line.qty}
                              onChange={(e) => updateLine(line.id, "qty", e.target.value)}
                              inputMode="numeric"
                              pattern="[0-9]+"
                              placeholder="tusaale: 10"
                              required
                            />
                          </div>

                          <div className="field">
                            <FormLabel>Qiimaha 1 Fuusto</FormLabel>
                            <input
                              className="input"
                              readOnly
                              value={
                                !line.fuelId
                                  ? "—"
                                  : line.price
                                  ? `$${decimal(line.price.unitPrice)}`
                                  : "Qiime lama dejin"
                              }
                            />
                          </div>

                          <div className="field">
                            <FormLabel>Wadarta Khadka</FormLabel>
                            <div
                              className="notice"
                              style={{
                                margin: 0,
                                padding: "8px 12px",
                                minHeight: 42,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "var(--lime-pale, #eff7e8)",
                              }}
                            >
                              <span>{line.lineLiters.toString()} L =</span>
                              <strong>${decimal(line.lineSubtotal.toString())}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="field full" style={{ marginTop: 12 }}>
                <FormLabel htmlFor="delivery-date">Taariikhda Gaarsiinta</FormLabel>
                <input
                  id="delivery-date"
                  type="date"
                  className="input"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>

              <details className="simple-disclosure" style={{ marginTop: 16 }}>
                <summary>Lacag Bixin & Dhimis (Ikhtiyaari)</summary>
                <div className="form-grid" style={{ marginTop: 12 }}>
                  <div className="field">
                    <FormLabel htmlFor="discount">Lacag-dhimis Dalabka ($)</FormLabel>
                    <input
                      id="discount"
                      type="number"
                      min="0"
                      step="0.01"
                      max={subtotal.toFixed(2)}
                      className="input"
                      value={discount}
                      onChange={(event) => setDiscount(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="field">
                    <FormLabel htmlFor="paid-now">Hadda La Bixiyey ($)</FormLabel>
                    <input
                      id="paid-now"
                      type="number"
                      min="0"
                      step="0.01"
                      max={Decimal.max(0, total).toFixed(2)}
                      className="input"
                      value={paid}
                      onChange={(event) => setPaid(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </div>
                  {safe(paid).gt(0) && (
                    <div className="field full">
                      <FormLabel htmlFor="paid-account">Akoonka Lacagta Lagu Qabtay *</FormLabel>
                      <select
                        id="paid-account"
                        className="select"
                        value={financialAccountId}
                        onChange={(event) => setFinancialAccountId(event.target.value)}
                        required
                      >
                        <option value="">Dooro akoonka (Kaash, EVC Plus, Somnet, Bangi)</option>
                        {accounts.data?.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}{row.identifierMasked ? ` · ${row.identifierMasked}` : ""}{row.currentBalance !== null ? ` (Hadhaa: $${Number(row.currentBalance).toFixed(2)})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="field full">
                    <FormLabel htmlFor="notes">Xusuus-qor / Faahfaahin</FormLabel>
                    <textarea
                      id="notes"
                      name="notes"
                      className="textarea"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Qor xusuusin ama faahfaahin dheeraad ah oo ku saabsan dalabkan…"
                    />
                  </div>
                </div>
              </details>
            </div>
          </Card>

          <Card>
            <CardHead title="Hubi Dalabka" />
            <div className="card-body">
              <div className="info-pair"><span>Macmiilka:</span><b>{customer?.name ?? "—"}</b></div>
              <div style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "8px 0", margin: "8px 0" }}>
                <strong style={{ fontSize: 13, display: "block", marginBottom: 6 }}>Khadadka La Dalbaday:</strong>
                {computedLines.map((line, idx) => {
                  const fuelName = fuelList.find((f) => f.id === line.fuelId)?.displayName;
                  return (
                    <div key={line.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span>
                        {fuelName ? formatFuel(fuelName) : `Khadka ${idx + 1}`}: {line.qty || "0"} Fuusto ({decimal(line.lineLiters.toString())} L)
                      </span>
                      <b>${decimal(line.lineSubtotal.toString())}</b>
                    </div>
                  );
                })}
              </div>
              <div className="info-pair"><span>Wadarta Guud Fuustooyinka:</span><b>{totalUnits} Fuusto ({decimal(totalLiters.toString())} L)</b></div>
              <div className="info-pair"><span>Wadarta Ka Hor Dhimista:</span><b>${decimal(subtotal.toString())}</b></div>
              {safe(discount).gt(0) && <div className="info-pair"><span>Qiimo Dhimis:</span><b>-${decimal(discount)}</b></div>}
              <div className="info-pair" style={{ fontSize: 16, borderTop: "2px solid var(--line)" }}>
                <span>Wadarta Dalabka:</span>
                <strong style={{ color: "var(--petrol)" }}>${decimal(total.toString())}</strong>
              </div>
              <div className="info-pair"><span>Hadda La Bixiyey:</span><b>${decimal(paid || "0")}</b></div>
              <div className="info-pair"><span>Deynta Dhiman Doonta:</span><b style={{ color: remaining.gt(0) ? "var(--red, #b91c1c)" : "inherit" }}>${decimal(Decimal.max(0, remaining).toString())}</b></div>
              <p className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
                Deynta rasmiga ahi waxay abuurmaysaa marka shidaalka la gaarsiiyo ee uu macmiilku saxiixo. Lacagta hadda la bixiyo waxay toos ugu xirmaysaa dalabkan.
              </p>
              {pending && <p className="notice warn">Lacag-dhimistu waxay sugaysaa oggolaanshaha milkiilaha.</p>}
              {save.isError && <ErrorState message={save.error.message} />}
              <SubmitButton
                busy={save.isPending}
                disabled={
                  remaining.lt(0) ||
                  !customer ||
                  !address.trim() ||
                  !allLinesValid ||
                  total.lt(0) ||
                  (safe(paid).gt(0) && !financialAccountId)
                }
              >
                Xaqiiji Dalabka
              </SubmitButton>
            </div>
          </Card>
        </div>
      </form>
    </main>
  );
}
