import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Prisma } from "@fuel/database";
import { PrismaService } from "./prisma.service.js";
import { SimpleWorkflowsService } from "./simple-workflows.service.js";
import { SimpleWorkflowsController } from "./simple-workflows.controller.js";
import type { Actor } from "./auth.js";
const db=new PrismaService(); const service=new SimpleWorkflowsService(db);
let owner:Actor,office:Actor,fuelId:string,unitId:string,customerId:string,priceId:string;
const key=()=>randomUUID();
async function createOrder(quantity="5",paidNow="100",discount="10") {
 const result=await service.order(owner,key(),{customerId,fuelId,salesUnitId:unitId,quantity,paidNow,discount,expectedPriceId:priceId,address:"Hodan"});
 return db.salesOrder.findUniqueOrThrow({where:{id:(result as {id:string}).id},include:{lines:true,payments:true}});
}
describe("Simple workflows preserve stock and finance",()=>{
 beforeAll(async()=>{
  const suffix=key();const a=await db.user.create({data:{email:`simple-${suffix}@test.invalid`,displayName:"Simple owner",role:"OWNER",passwordHash:"unused"}});owner={id:a.id,email:a.email,displayName:a.displayName,role:"OWNER"};
  const b=await db.user.create({data:{email:`simple-office-${suffix}@test.invalid`,displayName:"Simple office",role:"OFFICE_EMPLOYEE",passwordHash:"unused"}});office={id:b.id,email:b.email,displayName:b.displayName,role:"OFFICE_EMPLOYEE"};
  const fuel=await db.fuelType.upsert({where:{code:"DIESEL"},update:{},create:{code:"DIESEL",displayName:"Naafto"}});fuelId=fuel.id;
  const unit=await db.salesUnit.create({data:{code:`SIMPLE_${suffix}`,name:"Fuusto"}});unitId=unit.id;
  const since=new Date(Date.now()-86400000);await db.fuelUnitVersion.create({data:{fuelId,salesUnitId:unitId,litersPerUnit:new Prisma.Decimal(240),effectiveFromUtc:since,createdById:owner.id}});
  const price=await db.priceVersion.create({data:{fuelId,salesUnitId:unitId,unitPrice:new Prisma.Decimal(100),effectiveFromUtc:since,createdById:owner.id}});priceId=price.id;
  const c=await db.customer.create({data:{code:`SIMPLE_${suffix}`,name:"Simple customer",createdById:owner.id}});customerId=c.id;
 });
 afterAll(async()=>{await db.$disconnect();});
 it("receives 50 fuusto exactly once under concurrent retries, with null costs",async()=>{
  const before=await db.stockBalance.findUnique({where:{fuelId_location:{fuelId,location:"WAREHOUSE"}}});
  const requestKey=key();const input={fuelId,quantity:"50",date:"2026-10-12"};
  const [a,b]=await Promise.all([service.receipt(owner,requestKey,input),service.receipt(owner,requestKey,input)]);
  expect(a).toEqual(b);
  const balance=await db.stockBalance.findUniqueOrThrow({where:{fuelId_location:{fuelId,location:"WAREHOUSE"}}});
  expect(balance.balanceLiters.sub(before?.balanceLiters??0).toString()).toBe("12000");
  const receipt=await db.tankerReceipt.findUniqueOrThrow({where:{id:(a as {id:string}).id},include:{lines:true}});
  expect(receipt.lines[0]?.unitPurchaseCost).toBeNull();expect(receipt.lines[0]?.totalPurchaseCost).toBeNull();
  await expect(service.receipt(owner,requestKey,{...input,quantity:"51"})).rejects.toThrow("different operation");
 });
 it("rejects office purchase costs and calculates optional total reciprocally",async()=>{
  await expect(service.receipt(office,key(),{fuelId,quantity:"2",date:"2026-10-12",unitCost:"80"})).rejects.toThrow("owner-only");
  const result=await service.receipt(owner,key(),{fuelId,quantity:"2",date:"2026-10-12",totalCost:"160"});
  const r=await db.tankerReceipt.findUniqueOrThrow({where:{id:(result as {id:string}).id},include:{lines:true}});expect(r.lines[0]?.unitPurchaseCost?.toString()).toBe("80");
 });
 it("holds $100 as credit, then bills $490 and allocates $100 after full delivery",async()=>{
  const order=await createOrder();expect(order.totalAmount?.toString()).toBe("490");expect(order.payments[0]?.unappliedAmount.toString()).toBe("100");expect(await db.invoice.count({where:{lines:{some:{orderLine:{orderId:order.id}}}}})).toBe(0);
  const requestKey=key();const input={orderId:order.id,lines:[{orderLineId:order.lines[0]!.id,acceptedUnits:"5"}]};
  const [a,b]=await Promise.all([service.delivery(owner,requestKey,input),service.delivery(owner,requestKey,input)]);expect(a).toEqual(b);
  const invoices=await db.invoice.findMany({where:{lines:{some:{orderLine:{orderId:order.id}}}}});expect(invoices).toHaveLength(1);expect(invoices[0]?.totalAmount.toString()).toBe("490");expect(invoices[0]?.balanceDue.toString()).toBe("390");
  const p=await db.payment.findUniqueOrThrow({where:{id:order.payments[0]!.id}});expect(p.unappliedAmount.toString()).toBe("0");
 });
 it("allows debt and new orders; order payment does not pay old debt",async()=>{
  const old=await db.invoice.findFirstOrThrow({where:{customerId,status:"PARTIALLY_PAID"}});const order=await createOrder();const unchanged=await db.invoice.findUniqueOrThrow({where:{id:old.id}});expect(unchanged.balanceDue.toString()).toBe(old.balanceDue.toString());expect(order.payments[0]?.allocatedAmount.toString()).toBe("0");
  await service.payment(office,key(),{customerId,amount:"50"});const paid=await db.invoice.findUniqueOrThrow({where:{id:old.id}});expect(paid.balanceDue.toString()).toBe("340");
 });
 it("bills only 18 of 20, prorates discount, then safely completes transit remainder",async()=>{
  const order=await createOrder("20","0","100");const requestKey=key();const lineId=order.lines[0]!.id;
  await expect(service.delivery(owner,requestKey,{orderId:order.id,lines:[{orderLineId:lineId,acceptedUnits:"18"}]})).rejects.toThrow("remaining fuel");
  expect(await db.dispatchLine.count({where:{orderLineId:lineId}})).toBe(0);
  await service.delivery(owner,key(),{orderId:order.id,lines:[{orderLineId:lineId,acceptedUnits:"18",remaining:"IN_TRANSIT"}]});
  const first=await db.invoice.findFirstOrThrow({where:{lines:{some:{orderLineId:lineId}}}});expect(first.subtotal.toString()).toBe("1800");expect(first.discountAmount.toString()).toBe("90");expect(first.totalAmount.toString()).toBe("1710");
  await service.delivery(owner,key(),{orderId:order.id,lines:[{orderLineId:lineId,acceptedUnits:"2"}]});
  const totals=await db.invoice.aggregate({where:{lines:{some:{orderLineId:lineId}}},_sum:{totalAmount:true,discountAmount:true}});expect(totals._sum.totalAmount?.toString()).toBe("1900");expect(totals._sum.discountAmount?.toString()).toBe("100");
 });
 it("returns remaining fuel to warehouse and never rewrites an old price",async()=>{
  const order=await createOrder("2","0","0");const before=await db.stockBalance.findUniqueOrThrow({where:{fuelId_location:{fuelId,location:"WAREHOUSE"}}});
  await service.delivery(owner,key(),{orderId:order.id,lines:[{orderLineId:order.lines[0]!.id,acceptedUnits:"1",remaining:"RETURNED"}]});
  const after=await db.stockBalance.findUniqueOrThrow({where:{fuelId_location:{fuelId,location:"WAREHOUSE"}}});expect(before.balanceLiters.sub(after.balanceLiters).toString()).toBe("240");
  const line=await db.salesOrderLine.findUniqueOrThrow({where:{id:order.lines[0]!.id}});expect(line.unitPriceSnapshot?.toString()).toBe("100");
 });
 it("office discount stays pending and price changes require review",async()=>{
  const input={customerId,fuelId,salesUnitId:unitId,quantity:"1",discount:"5",expectedPriceId:priceId,address:"Hodan"};const result=await service.order(office,key(),input);expect((result as {status:string}).status).toBe("DRAFT");
  await expect(service.order(owner,key(),{...input,expectedPriceId:"stale-price"})).rejects.toThrow("Price changed");
 });
 it("posted financial journal reconciles to invoices minus all payments",async()=>{
  const ledger=await db.customerLedgerEntry.aggregate({where:{customerId},_sum:{debitAmount:true,creditAmount:true}});const invoices=await db.invoice.aggregate({where:{customerId},_sum:{totalAmount:true}});const payments=await db.payment.aggregate({where:{customerId,status:"POSTED"},_sum:{amount:true}});expect(ledger._sum.debitAmount?.toString()).toBe(invoices._sum.totalAmount?.toString());expect(ledger._sum.creditAmount?.toString()).toBe(payments._sum.amount?.toString());
 });
 it("exposes only allowlisted operational fields in the delivery manifest",async()=>{
  const controller=new SimpleWorkflowsController(service,db);
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Mogadishu",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const response=await controller.manifest(date);
  expect(response.data.date).toBe(date);
  for(const row of response.data.rows) expect(Object.keys(row).sort()).toEqual(["customer","fuel","location","phone","quantity"]);
  const serialized=JSON.stringify(response);
  for(const forbidden of ["price","debt","payment","tax","cost","revenue","profit","totalAmount","balanceDue"]) expect(serialized).not.toContain(forbidden);
 });
});
