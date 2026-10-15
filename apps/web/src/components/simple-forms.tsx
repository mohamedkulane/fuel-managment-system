"use client";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { api, mutationKey, type Actor } from "../lib/api";
import { businessDate, decimal, formatFuel } from "../lib/format";
import { ActionButton, FormLabel } from "./controls";
import { ErrorState, Modal, SubmitButton } from "./ui";
import { paymentError } from "../lib/payment-validation";
import { notifyError, notifySuccess } from "../lib/toast";
import { soError } from "../lib/so";

export function useWorkflow<T extends object>(path: string, success?: (result: { id: string; status?: string }) => void, messages?: {success?: string; error: string}) {
  const client = useQueryClient(); const request = useRef<{ signature: string; key: string } | null>(null);
  return useMutation({ mutationFn: (body: T) => {
    const signature = JSON.stringify(body); if (request.current?.signature !== signature) request.current = {signature,key:mutationKey()};
    return api<{id:string;status?:string}>(path,{method:"POST",headers:{"idempotency-key":request.current.key},body:signature});
  }, onSuccess: async result => { request.current=null; await client.invalidateQueries(); if(messages?.success) notifySuccess(messages.success); success?.(result); }, onError: error => { if(messages) notifyError(error, messages.error); } });
}

export function PaymentDialog({ customerId, customerName, open, onClose }: {customerId:string;customerName:string;open:boolean;onClose:()=>void}) {
  const [amount,setAmount]=useState(""); const [validation,setValidation]=useState(""); const [accountId,setAccountId]=useState("");
  const financial=useQuery({queryKey:["customer-account",customerId],queryFn:()=>api<{summary:{remainingDebt:string}}>("/customers/"+customerId+"/account"),enabled:open,staleTime:0});
  const accounts=useQuery({queryKey:["financial-accounts","selectable"],queryFn:()=>api<Array<{id:string;name:string;type:string;identifierMasked:string|null}>>("/financial-accounts/selectable"),enabled:open});
  const payable=new Decimal(financial.data?.summary.remainingDebt??"0");
  const payment=useWorkflow<{customerId:string;amount:string;financialAccountId:string;method:string;reference:string}>("/simple/payments",()=>{setAmount("");setAccountId("");setValidation("");onClose();},{success:"Payment recorded",error:"Payment failed"});
  const issue=amount?paymentError(amount,payable):null;
  const remainder=/^\d+(\.\d{1,2})?$/.test(amount)?Decimal.max(0,payable.sub(amount)):payable;
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(payment.isPending||financial.isFetching||financial.isError||!financial.data)return;
    const error=paymentError(amount,payable);if(error){setValidation(error);notifyError(new Error(error),error);return;}
    setValidation("");const data=new FormData(event.currentTarget);
    if(!accountId){setValidation("Select the financial account that received this money.");return;}
    payment.mutate({customerId,amount,financialAccountId:accountId,method:String(data.get("method")||"CASH"),reference:String(data.get("reference")||"")});
  }
  return <Modal isOpen={open} onClose={()=>{if(!payment.isPending){setAmount("");setValidation("");payment.reset();onClose();}}} title="Lacag qaado">
    <div className="payment-summary"><strong>Macmiil: {customerName}</strong><div className="info-pair"><span>Deynta hadda</span><b>{financial.isFetching?"Waa la soo rarayaa…":"$"+payable.toFixed(2)}</b></div><div className="info-pair"><span>Deynta ka hadhaysa</span><b>{financial.isFetching?"—":"$"+remainder.toFixed(2)}</b></div></div>
    {financial.isError&&<ErrorState message="Balance unavailable" retry={()=>void financial.refetch()}/>}
    {!financial.isFetching&&financial.data&&payable.isZero()&&<p role="status">Deyn la bixinayo ma jirto.</p>}
    <form onSubmit={submit} noValidate><div className="form-grid"><div className="field"><FormLabel htmlFor="payment-amount">Lacagta ($)</FormLabel><input id="payment-amount" name="amount" className="input" type="number" inputMode="decimal" step="0.01" min="0.01" max={payable.toFixed(2)} required autoFocus value={amount} onChange={e=>{setAmount(e.target.value);setValidation("");}} aria-invalid={!!(issue||validation)} aria-describedby="payment-validation"/></div><div className="field"><FormLabel htmlFor="payment-account">Akoonka lacagtu soo gashay</FormLabel><select id="payment-account" className="select" required value={accountId} onChange={e=>{setAccountId(e.target.value);setValidation("");}}><option value="">Dooro akoon</option>{accounts.data?.map(row=><option key={row.id} value={row.id}>{row.name}{row.identifierMasked?` · ${row.identifierMasked}`:""}</option>)}</select></div></div>
    <p id="payment-validation" className="validation-error">{validation||issue ? soError(validation || issue || "",400) : ""}</p>
    <details className="simple-disclosure"><summary>Faahfaahin dheeraad ah</summary><div className="form-grid"><div className="field"><FormLabel htmlFor="payment-method">Habka</FormLabel><select className="select" id="payment-method" name="method"><option value="CASH">Lacag caddaan ah</option><option value="BANK_TRANSFER">Wareejin bangi</option><option value="EVC_PLUS">EVC Plus</option><option value="EDAHAB">eDahab</option><option value="OTHER">Kale</option></select></div><div className="field"><FormLabel htmlFor="payment-ref">Tixraac</FormLabel><input className="input" id="payment-ref" name="reference"/></div></div></details>
    {payment.isError&&<ErrorState message="Lacagta lama diiwaangelin. Hubi qadarka oo mar kale isku day."/>}
    <div className="form-actions"><ActionButton className="btn" type="button" disabled={payment.isPending} onClick={onClose}>Cancel</ActionButton><SubmitButton busy={payment.isPending} disabled={financial.isFetching||financial.isError||accounts.isFetching||!financial.data||!accountId||payable.lte(0)}>Pay</SubmitButton></div></form></Modal>;
}

export function ReceiveStockForm({ onSaved }: { onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [units, setUnits] = useState("");
  const [cost, setCost] = useState("");
  const [costMode, setCostMode] = useState<"unit" | "total">("unit");
  const [supplierId, setSupplierId] = useState("");
  const [paidNow, setPaidNow] = useState("");
  const [accountId, setAccountId] = useState("");

  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierLocation, setNewSupplierLocation] = useState("");
  const [newSupplierPending, setNewSupplierPending] = useState(false);

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const fuels = useQuery({ queryKey: ["fuels"], queryFn: () => api<{ id: string; displayName: string }[]>("/fuels") });
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api<Array<{ id: string; name: string; status: string }>>("/suppliers"),
    enabled: me.data?.role === "OWNER",
  });
  const accounts = useQuery({
    queryKey: ["financial-accounts", "selectable"],
    queryFn: () => api<Array<{ id: string; name: string; identifierMasked: string | null; currentBalance: string | null; overdraftPolicy: string | null }>>("/financial-accounts/selectable"),
    enabled: me.data?.role === "OWNER",
  });

  const save = useWorkflow<{
    fuelId: string;
    quantity: string;
    date: string;
    supplierId?: string;
    notes: string;
    unitCost?: string;
    totalCost?: string;
    paidNow?: string;
    financialAccountId?: string;
  }>("/simple/receipts", onSaved, { success: "Stock added", error: "Stock not added" });

  let liters = "0";
  let reciprocal = "";
  let calculatedTotal: Decimal | null = null;

  const validUnits = /^\d+$/.test(units) && Number(units) > 0;
  const validCost = /^\d+(\.\d+)?$/.test(cost) && Number(cost) > 0;

  if (validUnits) {
    liters = new Decimal(units).mul(240).toString();
    if (validCost) {
      if (costMode === "unit") {
        calculatedTotal = new Decimal(cost).mul(units);
        reciprocal = calculatedTotal.toFixed(2);
      } else {
        calculatedTotal = new Decimal(cost);
        reciprocal = calculatedTotal.div(units).toFixed(4);
      }
    }
  }

  const validPaidNow = /^\d+(\.\d+)?$/.test(paidNow) && Number(paidNow) > 0;
  const paidNowDecimal = validPaidNow ? new Decimal(paidNow) : new Decimal(0);
  const calculatedDebt = calculatedTotal ? Decimal.max(0, calculatedTotal.sub(paidNowDecimal)) : null;

  const isCostEntered = Boolean(cost && Number(cost) > 0);
  const isSupplierMissing = isCostEntered && !supplierId;
  const isPaidNowPositive = Boolean(paidNow && Number(paidNow) > 0);
  const isAccountMissing = isPaidNowPositive && !accountId;
  const selectedAccount = accounts.data?.find(a => a.id === accountId);
  const isAccountInsufficient = Boolean(
    isPaidNowPositive &&
    selectedAccount &&
    selectedAccount.currentBalance !== null &&
    selectedAccount.overdraftPolicy === "BLOCK_NEGATIVE" &&
    paidNowDecimal.gt(Number(selectedAccount.currentBalance))
  );
  const isPaidExceedingTotal = Boolean(calculatedTotal && paidNowDecimal.gt(calculatedTotal));

  let validationMessage = "";
  if (isSupplierMissing) {
    validationMessage = "Fadlan dooro keenaha shidaalka (Keenaha waa qasab marka kharash la gelinayo).";
  } else if (isAccountMissing) {
    validationMessage = "Fadlan dooro akoonka lacagta laga bixiyey.";
  } else if (isAccountInsufficient) {
    validationMessage = `Hadhaaga akoonka '${selectedAccount?.name}' waa $${Number(selectedAccount?.currentBalance ?? 0).toFixed(2)}, kuma filna bixinta $${paidNowDecimal.toFixed(2)} (akoonku ma ogola hadhaa taban). Haddii aad shidaalkan deyn ku qaadatay, 'Hadda la bixiyey' ka dhig 0 si wadarta ($${calculatedTotal?.toFixed(2)}) ay deyn ugu noqoto keenaha.`;
  } else if (isPaidExceedingTotal) {
    validationMessage = `Lacagta hadda la bixiyey ($${paidNowDecimal.toFixed(2)}) kama badnaan karto wadarta soo-iibsiga ($${calculatedTotal?.toFixed(2)}).`;
  }

  async function handleCreateSupplier(e: FormEvent) {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    setNewSupplierPending(true);
    try {
      const res = await api<{ id: string }>("/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: newSupplierName.trim(),
          phone: newSupplierPhone.trim() || undefined,
          location: newSupplierLocation.trim() || undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSupplierId(res.id);
      setNewSupplierOpen(false);
      setNewSupplierName("");
      setNewSupplierPhone("");
      setNewSupplierLocation("");
      notifySuccess("Keenaha cusub waa la daray");
    } catch (err) {
      notifyError(err, "Keenaha lama darin");
    } finally {
      setNewSupplierPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSupplierMissing || isAccountMissing || isAccountInsufficient || isPaidExceedingTotal) return;
    const data = new FormData(event.currentTarget);
    save.mutate({
      fuelId: String(data.get("fuelId")),
      quantity: units,
      date: String(data.get("date")),
      notes: String(data.get("notes") || ""),
      ...(me.data?.role === "OWNER" && (cost || supplierId) ? {
        supplierId: supplierId || undefined,
        paidNow: paidNow || "0",
        financialAccountId: (paidNow && Number(paidNow) > 0) ? accountId : undefined,
        ...(cost ? (costMode === "unit" ? { unitCost: cost } : { totalCost: cost }) : {})
      } : {})
    });
  }

  return (
    <>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <FormLabel htmlFor="receive-fuel">Nooca shidaalka</FormLabel>
            <select id="receive-fuel" name="fuelId" className="select" required>
              <option value="">Dooro shidaalka</option>
              {fuels.data?.map(fuel => (
                <option key={fuel.id} value={fuel.id}>{formatFuel(fuel.displayName)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <FormLabel htmlFor="receive-units">Tirada fuustooyinka</FormLabel>
            <input
              id="receive-units"
              type="number"
              min="1"
              step="1"
              className="input"
              value={units}
              onChange={e => setUnits(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]+"
              required
              placeholder="tusaale: 20"
            />
          </div>
          <div className="field">
            <FormLabel htmlFor="receive-date">Taariikhda</FormLabel>
            <input id="receive-date" name="date" className="input" type="date" defaultValue={businessDate()} required />
          </div>
          <div className="field">
            <FormLabel>Wadarta litarada</FormLabel>
            <div className="notice" style={{ margin: 0, padding: "8px 12px", minHeight: 42, display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--lime-pale, #eff7e8)" }}>
              <span>{units || "0"} Fuusto =</span>
              <strong>{decimal(liters)} L</strong>
            </div>
          </div>
        </div>

        {me.data?.role === "OWNER" && (
          <details open className="simple-disclosure" style={{ marginTop: 14, marginBottom: 14 }}>
            <summary style={{ fontWeight: 600, cursor: "pointer" }}>
              Iibka, Keenaha & Deynta (Milkiilaha)
            </summary>
            <div className="form-grid" style={{ marginTop: 10 }}>
              {/* Supplier Selector - full width on top with add button */}
              <div className="field full" style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <FormLabel htmlFor="receive-supplier" style={{ margin: 0 }}>
                    Keene shidaal {cost ? <span style={{ color: "var(--red, #dc2626)" }}>*</span> : ""}
                  </FormLabel>
                  <ActionButton
                    type="button"
                    className="btn small"
                    style={{ fontSize: 12, padding: "2px 8px", minHeight: 28 }}
                    onClick={() => setNewSupplierOpen(true)}
                  >
                    + Ku dar Keene Cusub
                  </ActionButton>
                </div>
                <select
                  id="receive-supplier"
                  className="select"
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  required={Boolean(cost)}
                >
                  <option value="">
                    {suppliers.data && suppliers.data.length > 0
                      ? "Dooro keene shidaal…"
                      : "Keene diiwaangashan ma jiro — Guji '+ Ku dar Keene Cusub'"}
                  </option>
                  {suppliers.data?.filter(row => row.status === "ACTIVE").map(row => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
                {suppliers.data?.length === 0 && (
                  <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>
                    Nidaamka kuma jiro keene hadda. Guji badhanka sare si aad keene cusub ugu darto.
                  </small>
                )}
              </div>

              {/* Cost mode & Amount in 2 columns side by side */}
              <div className="field">
                <FormLabel htmlFor="receive-cost-mode">Nooca kharashka</FormLabel>
                <select
                  className="select"
                  id="receive-cost-mode"
                  value={costMode}
                  onChange={e => {
                    setCostMode(e.target.value as "unit" | "total");
                    setCost("");
                  }}
                >
                  <option value="unit">Fuustadii ($)</option>
                  <option value="total">Wadarta kharashka ($)</option>
                </select>
              </div>

              <div className="field">
                <FormLabel htmlFor="receive-cost">
                  {costMode === "unit" ? "Qiimaha 1 Fuusto ($)" : "Wadarta Iibka ($)"}
                </FormLabel>
                <input
                  id="receive-cost"
                  className="input"
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{1,4})?"
                  placeholder={costMode === "unit" ? "tusaale 80" : "tusaale 4000"}
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                />
                {reciprocal && (
                  <small style={{ display: "block", marginTop: 2, color: "var(--muted)" }}>
                    {costMode === "unit" ? "Wadarta:" : "Fuustadii:"} ${reciprocal}
                  </small>
                )}
              </div>

              {/* Paid Now & Account in 2 columns side by side */}
              <div className="field">
                <FormLabel htmlFor="receive-paid-now">Hadda la bixiyey ($)</FormLabel>
                <input
                  id="receive-paid-now"
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={paidNow}
                  onChange={e => setPaidNow(e.target.value)}
                />
              </div>

              <div className="field">
                <FormLabel htmlFor="receive-account">
                  Akoonka lacagta {Number(paidNow) > 0 ? <span style={{ color: "var(--red, #dc2626)" }}>*</span> : ""}
                </FormLabel>
                <select
                  id="receive-account"
                  className="select"
                  required={Boolean(paidNow && Number(paidNow) > 0)}
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  disabled={!paidNow || Number(paidNow) <= 0}
                >
                  <option value="">
                    {!paidNow || Number(paidNow) <= 0
                      ? "Geli 'Hadda la bixiyey' si aad akoon u doorato"
                      : "Dooro akoon (EVC Plus, Somnet, Kaash, Bangi)"}
                  </option>
                  {accounts.data?.map(row => (
                    <option key={row.id} value={row.id}>
                      {row.name}{row.identifierMasked ? ` · ${row.identifierMasked}` : ""}{row.currentBalance !== null ? ` (Hadhaa: $${Number(row.currentBalance).toFixed(2)})` : ""}
                    </option>
                  ))}
                </select>
                {selectedAccount && selectedAccount.currentBalance !== null && (
                  <small style={{ display: "block", marginTop: 2, color: isAccountInsufficient ? "var(--red, #dc2626)" : "var(--muted)" }}>
                    Hadhaaga hadda: <strong>${Number(selectedAccount.currentBalance).toFixed(2)}</strong>
                    {selectedAccount.overdraftPolicy === "BLOCK_NEGATIVE" ? " · Ma ogola hadhaa taban" : " · Wuu ogol yahay hadhaa taban"}
                  </small>
                )}
              </div>
            </div>

            {/* Financial summary banner */}
            {calculatedTotal && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  background: "var(--lime-pale, #f4fbe8)",
                  border: "1px solid var(--border-color, #dae9c5)",
                  borderRadius: 8,
                  fontSize: 13.5,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span>Wadarta Guud ee Iibka:</span>
                  <strong>${calculatedTotal.toFixed(2)}</strong>
                </div>
                {Number(paidNow) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, color: "var(--lime, #22c55e)" }}>
                    <span>Hadda la bixiyey (Account):</span>
                    <strong>-${paidNowDecimal.toFixed(2)}</strong>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 5,
                    borderTop: "1px dashed #cbd5e1",
                    fontWeight: 700,
                    color: calculatedDebt && calculatedDebt.gt(0) ? "var(--red, #b91c1c)" : "inherit",
                  }}
                >
                  <span>Deynta Keenaha ku dhiman doonta:</span>
                  <span>${calculatedDebt?.toFixed(2)}</span>
                </div>
                {calculatedDebt && calculatedDebt.gt(0) && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted, #64748b)" }}>
                    Deyntan waxay si toos ah ugu qormi doontaa xisaabta keenaha aad dooratay.
                  </p>
                )}
              </div>
            )}
          </details>
        )}

        <div className="field full" style={{ gridColumn: "1 / -1", marginBottom: 12 }}>
          <FormLabel htmlFor="receive-notes">Faahfaahin / Xusuusin</FormLabel>
          <input id="receive-notes" name="notes" className="input" placeholder="Xusuusin ikhtiyaari ah…" />
        </div>

        {validationMessage && (
          <p className="validation-error" style={{ marginBottom: 10 }}>
            {validationMessage}
          </p>
        )}

        {fuels.isError && <ErrorState message={fuels.error.message} retry={() => void fuels.refetch()} />}
        {save.isError && <ErrorState message={save.error.message} />}

        <div className="form-actions">
          <SubmitButton
            busy={save.isPending}
            disabled={Boolean(isSupplierMissing || isAccountMissing || isAccountInsufficient || isPaidExceedingTotal)}
          >
            Kaydi oo Shidaal Soo Geli
          </SubmitButton>
        </div>
      </form>

      {/* Sub-modal: Quick Add Supplier */}
      <Modal
        isOpen={newSupplierOpen}
        onClose={() => setNewSupplierOpen(false)}
        title="Ku dar Keene Cusub (Add Supplier)"
      >
        <form onSubmit={handleCreateSupplier}>
          <div className="form-grid">
            <div className="field full" style={{ gridColumn: "span 2" }}>
              <FormLabel htmlFor="new-supplier-name">Magaca Keenaha *</FormLabel>
              <input
                id="new-supplier-name"
                className="input"
                required
                autoFocus
                placeholder="tusaale: Hass Petroleum, Som Petroleum"
                value={newSupplierName}
                onChange={e => setNewSupplierName(e.target.value)}
              />
            </div>
            <div className="field">
              <FormLabel htmlFor="new-supplier-phone">Telefoon</FormLabel>
              <input
                id="new-supplier-phone"
                className="input"
                placeholder="tusaale: 615000000"
                value={newSupplierPhone}
                onChange={e => setNewSupplierPhone(e.target.value)}
              />
            </div>
            <div className="field">
              <FormLabel htmlFor="new-supplier-location">Goobta / Magaalada</FormLabel>
              <input
                id="new-supplier-location"
                className="input"
                placeholder="tusaale: Dekedda Muqdisho"
                value={newSupplierLocation}
                onChange={e => setNewSupplierLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: 16 }}>
            <ActionButton
              type="button"
              className="btn"
              onClick={() => setNewSupplierOpen(false)}
            >
              Cancel
            </ActionButton>
            <SubmitButton busy={newSupplierPending} disabled={!newSupplierName.trim()}>
              Save Supplier
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
