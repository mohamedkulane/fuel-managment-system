"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { useRouter } from "next/navigation";
import { api, type Actor, type PaginatedResponse } from "../../../lib/api";
import { businessDate, decimal, formatFuel } from "../../../lib/format";
import { ActionLink, FormLabel } from "../../../components/controls";
import { useWorkflow } from "../../../components/simple-forms";
import { Card, CardHead, ErrorState, PageHeader, SubmitButton } from "../../../components/ui";
import { notifyError, notifySuccess } from "../../../lib/toast";

type Customer = {
  id: string;
  name: string;
  primaryPhone: string | null;
  addresses: { addressText: string }[];
};

export default function NewOrderPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerListOpen, setCustomerListOpen] = useState(false);
  const [fuelId, setFuelId] = useState("");
  const [qty, setQty] = useState("");
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
  const price = useQuery({
    queryKey: ["prices", "current", fuelId, unit?.id],
    queryFn: () => api<{ id: string; unitPrice: string } | null>(`/prices/current?fuelId=${fuelId}&unitId=${unit?.id}`),
    enabled: Boolean(fuelId) && Boolean(unit)
  });

  const save = useWorkflow<{
    customerId: string;
    fuelId: string;
    salesUnitId: string;
    quantity: string;
    expectedPriceId: string;
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
  const subtotal = safe(qty).mul(price.data?.unitPrice ?? "0");
  const total = Decimal.max(0, subtotal.sub(safe(discount)));
  const remaining = total.sub(safe(paid));
  const pending = safe(discount).gt(0) && me.data?.role === "OFFICE_EMPLOYEE";
  const liters = safe(qty).mul(240).toString();

  function selectCustomer(selected: Customer) {
    setCustomer(selected);
    setAddress(selected.addresses[0]?.addressText ?? "");
    setCustomerListOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending || !customer || !unit || !price.data) return;
    if (remaining.lt(0)) {
      notifyError(new Error("Lacag-dhaaf"), "Lacagta hadda la bixinayo kama badnaan karto wadarta dalabka.");
      return;
    }
    save.mutate({
      customerId: customer.id,
      fuelId,
      salesUnitId: unit.id,
      quantity: qty,
      expectedPriceId: price.data.id,
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
        description="Dooro macmiilka, nooca shidaalka iyo tirada fuustooyinka la dalbanayo."
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

                <div className="field">
                  <FormLabel htmlFor="fuel">Nooca Shidaalka *</FormLabel>
                  <select id="fuel" className="select" value={fuelId} onChange={(event) => setFuelId(event.target.value)} required>
                    <option value="">Dooro nooca shidaalka</option>
                    {fuels.data?.map((fuel) => <option key={fuel.id} value={fuel.id}>{formatFuel(fuel.displayName)}</option>)}
                  </select>
                </div>

                <div className="field">
                  <FormLabel htmlFor="quantity">Tirada Fuustooyinka *</FormLabel>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    className="input"
                    value={qty}
                    onChange={(event) => setQty(event.target.value)}
                    inputMode="numeric"
                    pattern="[0-9]+"
                    placeholder="tusaale: 10"
                    required
                  />
                  {safe(qty).gt(0) && (
                    <small className="text-muted" style={{ marginTop: 2, display: "block" }}>
                      Wadarta Litarada: <strong>{decimal(liters)} Litar</strong> (1 Fuusto = 240 L)
                    </small>
                  )}
                </div>

                <div className="field">
                  <FormLabel htmlFor="current-price">Qiimaha 1 Fuusto ($)</FormLabel>
                  <input
                    id="current-price"
                    className="input"
                    readOnly
                    value={price.isFetching ? "Raraya qiimaha…" : price.data ? `$${decimal(price.data.unitPrice)}` : "Qiime lama dejin"}
                  />
                </div>

                <div className="field">
                  <FormLabel htmlFor="delivery-date">Taariikhda Gaarsiinta</FormLabel>
                  <input
                    id="delivery-date"
                    type="date"
                    className="input"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
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
              <div className="info-pair"><span>Shidaalka:</span><b>{fuels.data?.find(f => f.id === fuelId)?.displayName ? formatFuel(fuels.data.find(f => f.id === fuelId)!.displayName) : "—"}</b></div>
              <div className="info-pair"><span>Tirada Fuustooyinka:</span><b>{qty ? `${qty} Fuusto (${decimal(liters)} L)` : "0 Fuusto"}</b></div>
              <div className="info-pair"><span>Qiimaha Fuustadii:</span><b>${decimal(price.data?.unitPrice ?? "0")}</b></div>
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
              {save.isError && <ErrorState message={save.error.message} retry={() => void price.refetch()} />}
              {(price.isError || fuels.isError) && (
                <ErrorState message="Xogta lama soo rari karin." retry={() => { void price.refetch(); void fuels.refetch(); }} />
              )}
              <SubmitButton
                busy={save.isPending}
                disabled={remaining.lt(0) || !price.data || !customer || !address.trim() || total.lt(0) || safe(qty).lte(0) || (safe(paid).gt(0) && !financialAccountId)}
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
