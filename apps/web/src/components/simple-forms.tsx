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

export function useWorkflow<T extends object>(path: string, success?: (result: { id: string; status?: string }) => void, messages?: {success?: string; error: string}) {
  const client = useQueryClient(); const request = useRef<{ signature: string; key: string } | null>(null);
  return useMutation({ mutationFn: (body: T) => {
    const signature = JSON.stringify(body); if (request.current?.signature !== signature) request.current = {signature,key:mutationKey()};
    return api<{id:string;status?:string}>(path,{method:"POST",headers:{"idempotency-key":request.current.key},body:signature});
  }, onSuccess: async result => { request.current=null; await client.invalidateQueries(); if(messages?.success) notifySuccess(messages.success); success?.(result); }, onError: error => { if(messages) notifyError(error, messages.error); } });
}

export function PaymentDialog({ customerId, customerName, open, onClose }: {customerId:string;customerName:string;open:boolean;onClose:()=>void}) {
  const [amount,setAmount]=useState(""); const [validation,setValidation]=useState("");
  const financial=useQuery({queryKey:["customer-account",customerId],queryFn:()=>api<{summary:{remainingDebt:string}}>("/customers/"+customerId+"/account"),enabled:open,staleTime:0});
  const payable=new Decimal(financial.data?.summary.remainingDebt??"0");
  const payment=useWorkflow<{customerId:string;amount:string;method:string;reference:string}>("/simple/payments",()=>{setAmount("");setValidation("");onClose();},{success:"Payment recorded",error:"Payment failed"});
  const issue=amount?paymentError(amount,payable):null;
  const remainder=/^\d+(\.\d{1,2})?$/.test(amount)?Decimal.max(0,payable.sub(amount)):payable;
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(payment.isPending||financial.isFetching||financial.isError||!financial.data)return;
    const error=paymentError(amount,payable);if(error){setValidation(error);notifyError(new Error(error),error);return;}
    setValidation("");const data=new FormData(event.currentTarget);
    payment.mutate({customerId,amount,method:String(data.get("method")||"CASH"),reference:String(data.get("reference")||"")});
  }
  return <Modal isOpen={open} onClose={()=>{if(!payment.isPending){setAmount("");setValidation("");payment.reset();onClose();}}} title="Lacag qaado (Pay)">
    <div className="payment-summary"><strong>Macmiil: {customerName}</strong><div className="info-pair"><span>Deyn hadda (Debt)</span><b>{financial.isFetching?"Loading…":"$"+payable.toFixed(2)}</b></div><div className="info-pair"><span>Deyn ka haraysa (Remaining)</span><b>{financial.isFetching?"—":"$"+remainder.toFixed(2)}</b></div></div>
    {financial.isError&&<ErrorState message="Balance unavailable" retry={()=>void financial.refetch()}/>}
    {!financial.isFetching&&financial.data&&payable.isZero()&&<p role="status">Deyn ma jiro (No debt to pay)</p>}
    <form onSubmit={submit} noValidate><div className="field"><FormLabel htmlFor="payment-amount">Lacagta (Amount $)</FormLabel><input id="payment-amount" name="amount" className="input" type="number" inputMode="decimal" step="0.01" min="0.01" max={payable.toFixed(2)} required autoFocus value={amount} onChange={e=>{setAmount(e.target.value);setValidation("");}} aria-invalid={!!(issue||validation)} aria-describedby="payment-validation"/></div>
    <p id="payment-validation" className="validation-error">{validation||issue}</p>
    <details className="simple-disclosure"><summary>More details</summary><div className="form-grid"><div className="field"><FormLabel htmlFor="payment-method">Habka (Method)</FormLabel><select className="select" id="payment-method" name="method"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="EVC_PLUS">EVC Plus</option><option value="EDAHAB">eDahab</option><option value="OTHER">Other</option></select></div><div className="field"><FormLabel htmlFor="payment-ref">Tixraaca (Reference)</FormLabel><input className="input" id="payment-ref" name="reference"/></div></div></details>
    {payment.isError&&<ErrorState message="Payment failed. Check the amount and try again."/>}
    <div className="form-actions"><ActionButton className="btn" type="button" disabled={payment.isPending} onClick={onClose}>Cancel</ActionButton><SubmitButton busy={payment.isPending} disabled={financial.isFetching||financial.isError||!financial.data||payable.lte(0)}>Pay</SubmitButton></div></form></Modal>;
}

export function ReceiveStockForm({onSaved}:{onSaved:()=>void}) {
  const [units,setUnits]=useState(""); const [cost,setCost]=useState(""); const [costMode,setCostMode]=useState("unit");
  const me=useQuery({queryKey:["me"],queryFn:()=>api<Actor>("/auth/me")});
  const fuels=useQuery({queryKey:["fuels"],queryFn:()=>api<{id:string;displayName:string}[]>("/fuels")});
  const save=useWorkflow<{fuelId:string;quantity:string;date:string;supplier:string;notes:string;unitCost?:string;totalCost?:string}>("/simple/receipts",onSaved,{success:"Stock added",error:"Stock not added"});
  let liters="0", reciprocal="";
  if(/^\d+$/.test(units)) { liters=new Decimal(units).mul(240).toString(); if(new Decimal(units).gt(0)&&/^\d+(\.\d+)?$/.test(cost)) reciprocal=costMode==="unit"?new Decimal(cost).mul(units).toFixed(2):new Decimal(cost).div(units).toFixed(4); }
  function submit(event:FormEvent<HTMLFormElement>) {event.preventDefault();const data=new FormData(event.currentTarget);save.mutate({fuelId:String(data.get("fuelId")),quantity:units,date:String(data.get("date")),supplier:String(data.get("supplier")||""),notes:String(data.get("notes")||""),...(me.data?.role==="OWNER"&&cost?costMode==="unit"?{unitCost:cost}:{totalCost:cost}:{})});}
  return <form onSubmit={submit}><div className="form-grid"><div className="field"><FormLabel htmlFor="receive-fuel">Nooca shidaalka (Fuel type)</FormLabel><select id="receive-fuel" name="fuelId" className="select" required><option value="">Dooro shidaalka / Select fuel</option>{fuels.data?.map(fuel=><option key={fuel.id} value={fuel.id}>{formatFuel(fuel.displayName)}</option>)}</select></div><div className="field"><FormLabel htmlFor="receive-units">Tirada fuustooyinka (Quantity in fuusto)</FormLabel><input id="receive-units" type="number" min="1" step="1" className="input" value={units} onChange={e=>setUnits(e.target.value)} inputMode="numeric" pattern="[0-9]+" required/></div><div className="field"><FormLabel htmlFor="receive-date">Taariikhda (Date)</FormLabel><input id="receive-date" name="date" className="input" type="date" defaultValue={businessDate()} required/></div></div><p className="notice">{units||"0"} Fuusto = {decimal(liters)} L</p><details className="simple-disclosure"><summary>Faahfaahin dheeraad ah (More details)</summary><div className="form-grid">{me.data?.role==="OWNER"&&<><div className="field"><FormLabel htmlFor="receive-cost-mode">Qiimaha iibka (Optional purchase cost)</FormLabel><select className="select" id="receive-cost-mode" value={costMode} onChange={e=>{setCostMode(e.target.value);setCost("");}}><option value="unit">Fuustadii / Per fuusto</option><option value="total">Wadarta / Total cost</option></select></div><div className="field"><FormLabel htmlFor="receive-cost">Lacagta (Cost $)</FormLabel><input id="receive-cost" className="input" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,4})?" value={cost} onChange={e=>setCost(e.target.value)}/>{reciprocal&&<span>{costMode==="unit"?"Wadarta / Total":"Fuustadii / Per fuusto"}: ${reciprocal}</span>}</div></>}<div className="field"><FormLabel htmlFor="receive-supplier">Alaab-qeybiyaha (Supplier)</FormLabel><input id="receive-supplier" name="supplier" className="input"/></div><div className="field"><FormLabel htmlFor="receive-notes">Faahfaahin (Notes)</FormLabel><textarea id="receive-notes" name="notes" className="textarea"/></div></div></details>{fuels.isError&&<ErrorState message={fuels.error.message} retry={()=>void fuels.refetch()}/>} {save.isError&&<ErrorState message={save.error.message}/>}<div className="form-actions"><SubmitButton busy={save.isPending}>Save & Add Stock</SubmitButton></div></form>;
}
