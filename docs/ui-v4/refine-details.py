from pathlib import Path
import re
root=Path('apps/web/src/app')
for name in ['invoices','payments']:
 p=root/name/'page.tsx';s=p.read_text(encoding='utf-8').replace('"use client";',f'"use client";\nimport {{ FinanceMetrics }} from "../../components/finance-metrics";',1)
 s=s.replace('      <section className="card">',f'      <FinanceMetrics kind="{name}" />\n      <section className="card">',1)
 s=s.replace('      queryClient.invalidateQueries({ queryKey: ["invoices"] });','      queryClient.invalidateQueries({ queryKey: ["invoices"] });\n      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });\n      queryClient.invalidateQueries({ queryKey: ["dashboard"] });',1)
 p.write_text(s,encoding='utf-8')
p=root/'dispatches/page.tsx';s=p.read_text(encoding='utf-8');s=s.replace('Badge, Card,','MetricCard, LoadingState, Badge, Card,').replace('"use client";','"use client";\nimport { ClipboardList, Clock3, CircleCheck, Truck } from "lucide-react";\nimport { sum } from "../../lib/format";',1)
s=s.replace('title="Dispatches"','title="Dispatch management"').replace('description="Track fuel dispatched from the warehouse to in-transit status and perform actual delivery reconciliation."','description="Follow physical fuel movement and record actual delivery acceptance."')
s=s.replace('      <Card>','''      <div className="grid"><MetricCard label="Dispatch records" value={query.data?.length ?? "—"} note="All recorded dispatches" icon={ClipboardList}/><MetricCard label="Awaiting dispatch" value={query.data?.filter(d=>d.status==="PREPARED").length ?? "—"} note="Prepared for physical movement" icon={Clock3}/><MetricCard label="Awaiting reconciliation" value={query.data?.filter(d=>["POSTED","PARTIALLY_RECONCILED"].includes(d.status)).length ?? "—"} note="Accepted and returned quantities needed" icon={Truck} dark/><MetricCard label="Reconciled" value={query.data?.filter(d=>d.status==="RECONCILED").length ?? "—"} note="Physical disposition recorded" icon={CircleCheck}/></div>
      <Card>''',1)
s=s.replace('row.lines.reduce((s, l) => s + Number(l.dispatchedUnits), 0)','sum(row.lines.map(l => l.dispatchedUnits))').replace('row.lines.reduce((s, l) => s + Number(l.dispatchedLiters), 0)','sum(row.lines.map(l => l.dispatchedLiters))')
s=s.replace('{query.isError ? (','{query.isLoading ? <LoadingState /> : query.isError ? (')
p.write_text(s,encoding='utf-8')
p=root/'dispatches/[id]/page.tsx';s=p.read_text(encoding='utf-8');s=s.replace('Badge, Card,','MetricCard, Badge, Card,').replace('"use client";','"use client";\nimport { sum, decimal } from "../../../lib/format";\nimport { Boxes, Truck, CircleCheck } from "lucide-react";',1)
s=s.replace('          <Card>','''          <div className="grid team-metrics"><MetricCard label="Dispatched liters" value={`${decimal(sum(row.lines.map(l=>l.dispatchedLiters)),3)} L`} note="Fuel physically dispatched" icon={Truck}/><MetricCard label="Accepted liters" value={`${decimal(sum(row.lines.flatMap(l=>l.confirmations.map(c=>c.acceptedLiters))),3)} L`} note="Confirmed customer acceptance" icon={CircleCheck}/><MetricCard label="Returned liters" value={`${decimal(sum(row.lines.flatMap(l=>l.confirmations.map(c=>c.physicalReturnedLiters))),3)} L`} note="Returned to warehouse" icon={Boxes}/></div>
          <Card>''',1)
s=s.replace('line.confirmations.reduce((s, c) => s + Number(c.acceptedUnits), 0)','sum(line.confirmations.map(c=>c.acceptedUnits))').replace('line.confirmations.reduce((s, c) => s + Number(c.physicalReturnedLiters), 0)','sum(line.confirmations.map(c=>c.physicalReturnedLiters))')
s=s.replace('Operational Inventory Invariant:','Physical dispatch:')
s=s.replace('      {row && (','      {post.isError && <ErrorState message={post.error.message} />}\n      {row && (',1)
p.write_text(s,encoding='utf-8')
p=root/'orders/[id]/page.tsx';s=p.read_text(encoding='utf-8').replace('import { dateTime }','import { dateTime, sum, decimal }').replace('Badge, Card,','MetricCard, Badge, Card,')
s=s.replace('"use client";','"use client";\nimport Decimal from "decimal.js";\nimport { ShoppingBag, Boxes, Truck } from "lucide-react";',1)
s=s.replace('<div className="two-col">','''<div className="grid team-metrics"><MetricCard label="Order value" value={row.lines.every(l=>l.unitPriceSnapshot != null) ? `$${decimal(sum(row.lines.map(l=>new Decimal(l.requestedUnits).times(l.unitPriceSnapshot!).toString())))}` : "Not confirmed"} note="Requested quantity at saved prices" icon={ShoppingBag}/><MetricCard label="Requested quantity" value={sum(row.lines.map(l=>l.requestedUnits))} note="Fuusto ordered" icon={Boxes}/><MetricCard label="Accepted quantity" value={sum(row.lines.flatMap(l=>l.dispatchLines.flatMap(d=>d.confirmations.map(c=>c.acceptedUnits))))} note="Customer-confirmed fuusto" icon={Truck}/></div><div className="two-col">''',1)
s=s.replace('line.dispatchLines.reduce((s,x)=>s+Number(x.dispatchedUnits),0)','sum(line.dispatchLines.map(x=>x.dispatchedUnits))').replace('line.dispatchLines.flatMap(x=>x.confirmations).reduce((s,x)=>s+Number(x.acceptedUnits),0)','sum(line.dispatchLines.flatMap(x=>x.confirmations).map(x=>x.acceptedUnits))').replace('line.dispatchLines.flatMap(x=>x.confirmations).reduce((s,x)=>s+Number(x.physicalReturnedLiters),0)','sum(line.dispatchLines.flatMap(x=>x.confirmations).map(x=>x.physicalReturnedLiters))')
p.write_text(s,encoding='utf-8')
# Associate dynamic reconciliation fields with labels.
p=root/'dispatches/[id]/reconcile/page.tsx';s=p.read_text(encoding='utf-8')
for key,label,tag in [('accepted','Accepted fuusto this event','input'),('returned','Physical returned liters','input'),('disposition','Commercial remainder','select'),('reason','Discrepancy reason','input')]:
 s=s.replace(f'<label>{label}</label><{tag} className="',f'<label htmlFor={{`{key}-${{line.id}}`}}>{label}</label><{tag} id={{`{key}-${{line.id}}`}} className="')
p.write_text(s,encoding='utf-8')
