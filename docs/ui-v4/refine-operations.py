from pathlib import Path
import re
root=Path('apps/web/src/app')
# List screens gain grounded, clearly scoped record summaries.
for name,q,items,title in [('customers','query','items','Customers'),('orders','rows','items','Orders')]:
 p=root/name/'page.tsx';s=p.read_text(encoding='utf-8')
 s=s.replace('import { Badge,','import { MetricCard, LoadingState, Badge,')
 s=s.replace('"use client";','"use client";\nimport { Users, ClipboardList, CircleCheck, Clock3 } from "lucide-react";',1)
 if name=='customers':
  s=s.replace('title="Customer directory"','title="Customers"').replace('description="Operational contacts and delivery addresses. Customer debt balance is billing-managed."','description="Every account, contact and delivery address in one place."')
  marker='      <Modal isOpen='
  summary='''      <div className="grid"><MetricCard label="Matching customers" value={query.data ? (Array.isArray(query.data) ? query.data.length : query.data.total) : "—"} note="Across the current search" icon={Users}/><MetricCard label="Active on this page" value={items.filter(c=>c.status==="ACTIVE").length} note="Accounts accepting orders" icon={CircleCheck}/><MetricCard label="On hold on this page" value={items.filter(c=>c.status==="HOLD").length} note="Restricted by the owner" icon={Clock3}/><MetricCard label="Directory page" value={page} note={`Of ${totalPages} pages`} icon={ClipboardList}/></div>
'''
 else:
  marker='      <Card>'
  summary='''      <div className="grid"><MetricCard label="Matching orders" value={rows.data ? (Array.isArray(rows.data) ? rows.data.length : rows.data.total) : "—"} note="Across the current search" icon={ClipboardList}/><MetricCard label="Drafts on this page" value={items.filter(o=>o.status==="DRAFT").length} note="Awaiting confirmation" icon={Clock3}/><MetricCard label="In progress on this page" value={items.filter(o=>["CONFIRMED","SCHEDULED","IN_PROGRESS"].includes(o.status)).length} note="Confirmed and active orders" icon={Users}/><MetricCard label="Fulfilled on this page" value={items.filter(o=>o.status==="FULFILLED").length} note="Accepted deliveries" icon={CircleCheck}/></div>
'''
  s=s.replace('description="Confirmed orders freeze effective price and fuusto-to-liter snapshots."','description="Create orders with saved prices. Track fulfillment from request to delivery."')
  s=s.replace('{row.status === "DRAFT" && (','<Link className="btn small" href={`/orders/${row.id}`}>Details</Link> {row.status === "DRAFT" && (')
 s=s.replace(marker,summary+marker,1)
 s=s.replace(f'{{{q}.isError ? (',f'{{{q}.isLoading ? <LoadingState /> : {q}.isError ? (')
 p.write_text(s,encoding='utf-8')
# Inventory presentation uses actual separated balances, without invented capacity percentages.
p=root/'stock/page.tsx';s=p.read_text(encoding='utf-8').replace('Badge, Card,','MetricCard, LoadingState, Badge, Card,')
s=s.replace('"use client";','"use client";\nimport { Fuel as FuelIcon } from "lucide-react";\nimport { decimal } from "../../lib/format";',1)
s=s.replace('title="Fuel inventory"','title="Inventory overview"').replace('description="Warehouse and in-transit liters are separate posted physical balances."','description="A clear view of warehouse stock, in-transit fuel and movement history."')
s=re.sub(r'<Card className="kpi" key=\{`\$\{row.fuel\}-\$\{row.location\}`\}>.*?</Card>', '<MetricCard key={`${row.fuel}-${row.location}`} label={`${row.fuelName} · ${row.location.replaceAll("_", " ")}`} value={`${decimal(row.balanceLiters, 3)} L`} note="Posted physical balance" icon={FuelIcon} dark={row.fuel === "DIESEL" && row.location === "WAREHOUSE"} />',s,flags=re.S)
s=s.replace('{balances.isError ? (','{balances.isLoading ? <LoadingState /> : balances.isError ? (').replace('{movements.isError ? (','{movements.isLoading ? <LoadingState /> : movements.isError ? (')
p.write_text(s,encoding='utf-8')
# Receiving keeps both register and creation workflow on its existing route.
p=root/'stock/receive/page.tsx';s=p.read_text(encoding='utf-8').replace('Badge, Card,','LoadingState, Badge, Card,')
s=s.replace('const client = useQueryClient();','const client = useQueryClient();\n  const [showCreate, setShowCreate] = useState(false);')
s=s.replace('description="A booyad is an incoming tanker truck delivery. Register and post actual measured liters to canonical stock."','description="Record incoming booyado and post verified liters into warehouse stock."\n        actions={<button className="btn primary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Close arrival form" : "Register new tanker"}</button>}')
s=s.replace('      <div className="two-col">','      {showCreate && <div className="two-col">',1)
s=s.replace('      </div>\n\n      <Card>','      </div>}\n\n      <Card>',1)
s=s.replace('title="Booyad Receiving Rules"','title="Before you post"').replace('<b>Canonical Stock Unit</b>','<b>01 · Measure the fuel</b>').replace('<b>Atomic Posting</b>','<b>02 · Review and post</b>').replace('<b>Purchase Cost Confidentiality</b>','<b>03 · Purchase information</b>')
s=s.replace('Posting a draft tanker receipt increases warehouse stock balance immediately.','Review the draft before posting. Posting adds the measured liters to warehouse stock.')
s=s.replace('{receipts.isError ? (','{receipts.isLoading ? <LoadingState /> : receipts.isError ? (')
s=s.replace('await client.invalidateQueries({ queryKey: ["tanker-receipts"] });','setShowCreate(false);\n      await client.invalidateQueries({ queryKey: ["tanker-receipts"] });',1)
p.write_text(s,encoding='utf-8')
# Delivery sheet creation is opened deliberately above the register.
p=root/'deliveries/page.tsx';s=p.read_text(encoding='utf-8').replace('import { FormEvent }','import { FormEvent, useState }').replace('Badge, Card,','LoadingState, Badge, Card,')
s=s.replace('const client=useQueryClient();','const client=useQueryClient();const [showCreate,setShowCreate]=useState(false);')
s=s.replace('title="Daily delivery lists"','title="Delivery sheets"').replace('description="Create and print a non-financial sheet; physical dispatch is always a separate action."','description="Prepare daily delivery lists to print or share manually." actions={<button className="btn primary" onClick={()=>setShowCreate(!showCreate)}>{showCreate ? "Close preparation" : "New delivery sheet"}</button>}')
s=s.replace('<Card><CardHead title="Prepare a delivery sheet"','{showCreate && <Card><CardHead title="Prepare a delivery sheet"',1).replace('</form></Card><Card>','</form></Card>}<Card>',1)
s=s.replace('Only authenticated owner or office staff use this workspace. Delivery personnel receive the printed/PDF list outside the system.','Delivery sheets contain customer, contact, address, fuel and quantity details only. Print or share the PDF outside this workspace.')
s=s.replace('onSuccess:async()=>{await Promise.all','onSuccess:async()=>{setShowCreate(false);await Promise.all',1)
s=s.replace('{sheets.isError?','{sheets.isLoading?<LoadingState/>:sheets.isError?')
s=s.replace('type="checkbox" name="orderLineIds"','type="checkbox" aria-label={`Select ${order.orderNo}, ${line.fuel.displayName}`} name="orderLineIds"')
p.write_text(s,encoding='utf-8')
# Keep the operational manifest separate from dispatch actions and finance.
p=root/'deliveries/[id]/page.tsx';s=p.read_text(encoding='utf-8').replace('<Card><CardHead title="Non-financial manifest preview"/>','<Card className="document-card"><div className="document-heading"><div><strong>fueldesk.</strong><small>Wholesale fuel distribution · Operations only</small></div><div><b>DELIVERY SHEET</b><small>{row.sheetNo} · {row.serviceDate}</small></div></div>')
p.write_text(s,encoding='utf-8')
# Order details get an adjacent chronological timeline.
p=root/'orders/[id]/page.tsx';s=p.read_text(encoding='utf-8');s=s.replace('return <tr key={line.id}>','return <tr key={line.id}>')
s=s.replace('<Card><CardHead title="Order lines"/>','<div className="two-col"><Card><CardHead title="Order items" description="Saved quantities, price and conversion snapshots."/>')
s=s.replace('<CardHead title="Lifecycle"/>','<CardHead title="Order timeline" description="Recorded events for this order."/>').replace('<div className="card-body">{row.events.map(event=><p key={event.id}>','<div className="card-body"><ol className="timeline">{row.events.map(event=><li key={event.id}>').replace(' {dateTime(event.occurredAt)}</p>)}</div></Card>',' <small>{dateTime(event.occurredAt)}</small></li>)}</ol></div></Card></div>')
p.write_text(s,encoding='utf-8')
# Reconciliation adds contextual help beside the existing event form.
p=root/'dispatches/[id]/reconcile/page.tsx';s=p.read_text(encoding='utf-8');s=s.replace('"use client";','"use client";\nimport Link from "next/link";',1)
s=s.replace('title={row?.dispatchNo??"Loading dispatch…"}','title="Delivery reconciliation"').replace('description="Record what the customer accepted and what physically returned; unresolved fuel stays in transit."','description={row ? `${row.dispatchNo} · Confirm accepted quantities and physical returns.` : "Loading dispatch…"} actions={<Link className="btn" href={`/dispatches/${id}`}>Back to dispatch</Link>}')
s=s.replace('<form onSubmit={submit}>','<div className="two-col"><form onSubmit={submit}>',1)
s=s.replace('</form></>}', '</form><Card><CardHead title="Quantity reconciliation" description="Record only this delivery event."/><div className="card-body"><div className="info-pair"><span>Accepted</span><b>Customer-confirmed fuusto</b></div><div className="info-pair"><span>Returned</span><b>Actual liters back in warehouse</b></div><div className="info-pair"><span>Unresolved</span><b>Remains in transit</b></div><div className="notice" style={{marginTop:20}}>Invoicing uses only accepted quantities. Explain any difference and choose the commercial disposition of the remainder.</div></div></Card></div></>}')
p.write_text(s,encoding='utf-8')
