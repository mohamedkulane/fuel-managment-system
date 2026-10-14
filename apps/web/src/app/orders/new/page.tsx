"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { api, type Actor, type PaginatedResponse } from "../../../lib/api";
import { decimal, formatFuel } from "../../../lib/format";
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
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerListOpen, setCustomerListOpen] = useState(false);
  const [fuelId, setFuelId] = useState("");
  const [qty, setQty] = useState("");
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
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
    discount: string;
    paidNow: string;
    notes: string;
  }>(
    "/simple/orders",
    (result) => {
      notifySuccess(result.status === "DRAFT" ? "Order saved" : "Order confirmed");
      setSearch("");
      setSearchTerm("");
      setCustomer(null);
      setCustomerListOpen(false);
      setFuelId("");
      setQty("");
      setDiscount("");
      setPaid("");
      setAddress("");
      setNotes("");
    },
    { error: "Order not saved" }
  );

  const safe = (value: string) => (/^\d+(\.\d{1,4})?$/.test(value) ? new Decimal(value) : new Decimal(0));
  const subtotal = safe(qty).mul(price.data?.unitPrice ?? "0");
  const total = subtotal.sub(safe(discount));
  const remaining = total.sub(safe(paid));
  const pending = safe(discount).gt(0) && me.data?.role === "OFFICE_EMPLOYEE";

  function selectCustomer(selected: Customer) {
    setCustomer(selected);
    setAddress(selected.addresses[0]?.addressText ?? "");
    setCustomerListOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending || !customer || !unit || !price.data) return;
    if (remaining.lt(0)) {
      notifyError(new Error("Overpayment"), "Pay Now cannot exceed the order total.");
      return;
    }
    save.mutate({
      customerId: customer.id,
      fuelId,
      salesUnitId: unit.id,
      quantity: qty,
      expectedPriceId: price.data.id,
      address,
      discount: discount || "0",
      paidNow: paid || "0",
      notes
    });
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow=""
        title="Dalab Cusub"
        description="Dooro macmiilka, shidaalka iyo tirada."
        actions={<ActionLink className="btn" href="/orders">Back to Orders</ActionLink>}
      />
      <form onSubmit={submit}>
        <div className="two-col">
          <Card>
            <CardHead title="Faahfaahinta dalabka" />
            <div className="card-body">
              <div className="form-grid">
                <div className="field full">
                  <FormLabel htmlFor="customer-search">Raadi macmiilka (Search customer)</FormLabel>
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
                    placeholder="Magac ama telefoon / Name or phone"
                    autoComplete="off"
                    aria-controls="customer-options"
                    aria-expanded={customerListOpen}
                  />
                  {customers.isFetching ? (
                    <p role="status">Raraya macaamiisha…</p>
                  ) : customers.isError ? (
                    <ErrorState message="Macaamiisha lama soo rari karin." retry={() => void customers.refetch()} />
                  ) : searchTerm.length < 2 ? (
                    <p className="text-muted">Dooro macmiil liiska hoose ama raadi adigoo gelinaya ugu yaraan laba xaraf.</p>
                  ) : customers.data?.items.length === 0 ? (
                    <p role="status">Macmiil lama helin.</p>
                  ) : null}
                </div>

                <div className="field full customer-picker">
                  <FormLabel htmlFor="customer-list-toggle">Macmiilka (Customer)</FormLabel>
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
                    <span>{customer ? `${customer.name}${customer.primaryPhone ? ` · ${customer.primaryPhone}` : ""}` : customers.isPending ? "Raraya macaamiisha…" : "Dooro macmiilka / Select customer"}</span>
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

                {customer && (
                  <div className="field full">
                    <p>{customer.primaryPhone ?? "Telefoon lama diiwaangelin"} · {address || "Goob lama diiwaangelin"}</p>
                    <details>
                      <summary>Goobta (Delivery address)</summary>
                      <FormLabel htmlFor="order-address">Goobta (Address)</FormLabel>
                      <input id="order-address" className="input" value={address} onChange={(event) => setAddress(event.target.value)} />
                    </details>
                  </div>
                )}

                <div className="field">
                  <FormLabel htmlFor="fuel">Nooca shidaalka (Fuel type)</FormLabel>
                  <select id="fuel" className="select" value={fuelId} onChange={(event) => setFuelId(event.target.value)} required>
                    <option value="">Dooro / Select</option>
                    {fuels.data?.map((fuel) => <option key={fuel.id} value={fuel.id}>{formatFuel(fuel.displayName)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <FormLabel htmlFor="quantity">Tirada fuustooyinka (Quantity in fuusto)</FormLabel>
                  <input id="quantity" type="number" min="1" step="1" className="input" value={qty} onChange={(event) => setQty(event.target.value)} inputMode="numeric" pattern="[0-9]+" required />
                </div>
                <div className="field full">
                  <FormLabel htmlFor="current-price">Qiimaha fuustadii (Current price per fuusto)</FormLabel>
                  <input id="current-price" className="input" readOnly value={price.isFetching ? "Raraya…" : price.data ? `$${decimal(price.data.unitPrice)}` : "Qiime lama dejin"} />
                </div>
              </div>

              <details className="simple-disclosure">
                <summary>Faahfaahin dheeraad ah (More details)</summary>
                <div className="form-grid">
                  <div className="field">
                    <FormLabel htmlFor="discount">Lacag-dhimista dalabka (Fixed order discount $)</FormLabel>
                    <input id="discount" type="number" min="0" step="0.01" max={subtotal.toFixed(2)} className="input" value={discount} onChange={(event) => setDiscount(event.target.value)} inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,4})?" />
                  </div>
                  <div className="field">
                    <FormLabel htmlFor="paid-now">Hadda la bixiyey (Paid now $)</FormLabel>
                    <input id="paid-now" type="number" min="0" step="0.01" max={Decimal.max(0, total).toFixed(2)} className="input" value={paid} onChange={(event) => setPaid(event.target.value)} inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,4})?" />
                  </div>
                  <div className="field full">
                    <FormLabel htmlFor="notes">Faahfaahin (Notes)</FormLabel>
                    <textarea id="notes" name="notes" className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </div>
                </div>
              </details>
            </div>
          </Card>

          <Card>
            <CardHead title="Hubi dalabka" />
            <div className="card-body">
              <div className="info-pair"><span>Macmiil</span><b>{customer?.name ?? "—"}</b></div>
              <div className="info-pair"><span>{qty || "0"} Fuusto × ${decimal(price.data?.unitPrice)}</span><b>${decimal(subtotal.toString())}</b></div>
              <div className="info-pair"><span>Lacag-dhimis guud</span><b>${decimal(discount || "0")}</b></div>
              <div className="info-pair"><span>Wadarta dalabka</span><b>${decimal(total.toString())}</b></div>
              <div className="info-pair"><span>Hadda la bixiyey</span><b>${decimal(paid || "0")}</b></div>
              <div className="info-pair"><span>Inta ka dhiman (Qiyaas)</span><b>${decimal(Decimal.max(0, remaining).toString())}</b></div>
              <p className="text-muted">Haraaga dalabku waa qiyaas ilaa shidaalka la geeyo. Lacagta hore loo bixiyey waxay u taal macmiilka.</p>
              {pending && <p className="notice warn">Sugaya oggolaanshaha milkiilaha.</p>}
              {save.isError && <ErrorState message={save.error.message} retry={() => void price.refetch()} />}
              {(price.isError || fuels.isError) && (
                <ErrorState message="Xogta lama soo rari karin." retry={() => { void price.refetch(); void fuels.refetch(); }} />
              )}
              <SubmitButton busy={save.isPending} disabled={remaining.lt(0) || !price.data || !customer || !address || total.lt(0) || safe(qty).lte(0)}>
                Save Order
              </SubmitButton>
            </div>
          </Card>
        </div>
      </form>
    </main>
  );
}
