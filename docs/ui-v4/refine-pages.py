from pathlib import Path
import re
root=Path('apps/web/src/app')
for name in ['customers/[id]','invoices/[id]','payments/[id]']:
 p=root/name/'page.tsx';s=p.read_text(encoding='utf-8');s=s.replace('import { api,','import { api, apiBase,');s=s.replace('href={`/api/v1/','href={`${apiBase}/');p.write_text(s,encoding='utf-8')
p=root/'customers/[id]/page.tsx';s=p.read_text(encoding='utf-8')
s=s.replace('Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, Pagination, SubmitButton','Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, Pagination, SubmitButton')
s=s.replace('import Decimal from "decimal.js";','import Decimal from "decimal.js";\nimport { Receipt, Wallet, CircleCheck, TrendingUp } from "lucide-react";\nimport { sum } from "../../../lib/format";')
s=s.replace('title={cust?.name ?? "Loading Customer Profile…"}','title="Customer account"').replace('eyebrow="Customer Commercial Account"','eyebrow="Customer relationships"')
start=s.index('          {/* Top 5 Financial Summary')
end=s.index('          {/* Tab 1:',start)
s=s[:start]+'''          <Card className="profile-identity"><div className="avatar">{cust.name.split(" ").slice(0,2).map(n => n[0]).join("")}</div><div><h2>{cust.name}</h2><p>{cust.code} · {cust.primaryPhone ?? "No phone recorded"} · <Badge tone={cust.status === "ACTIVE" ? "ok" : "warn"}>{cust.status}</Badge></p></div><div className="actions"><button className="btn" onClick={() => setShowEdit(true)}>Edit customer</button><Link className="btn primary" href="/orders/new">New order</Link></div></Card>
          {financialQuery.isError ? <ErrorState message={financialQuery.error.message} retry={() => void financialQuery.refetch()} /> : financialQuery.isLoading ? <LoadingState label="Loading account balances…" /> : <div className="grid profile-metrics">
            <MetricCard label="Total invoiced" value={`$${decimal(fin?.totalInvoiced)}`} note="Historical posted invoices" icon={Receipt} />
            <MetricCard label="Total received" value={`$${decimal(fin?.totalPaid)}`} note="Posted payments" icon={Wallet} />
            <MetricCard label="Outstanding debt" value={`$${decimal(fin?.outstandingDebt)}`} note="Open invoice amount" icon={TrendingUp} dark />
            <MetricCard label="Unapplied credit" value={`$${decimal(fin?.unappliedCredit)}`} note="Not yet allocated" icon={CircleCheck} />
            <MetricCard label="Net account position" value={`$${decimal(fin?.netPosition)}`} note="Debt less available credit" icon={Wallet} />
          </div>}
          <nav className="tabs-header no-print" aria-label="Customer account sections">
            {([
              { id: "overview", label: "Overview" },
              { id: "orders", label: "Orders & deliveries" },
              { id: "invoices", label: "Invoices & debts" },
              { id: "payments", label: "Payments" },
              { id: "ledger", label: "Account ledger" }
            ] as const).map(tab => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
          </nav>

'''+s[end:]
s=s.replace('Customer Account Metadata','Account details').replace('Primary operational profile details','Contact and delivery information').replace('Financial Position Breakdown','Financial position').replace('Statement & Subledger','Account ledger')
s=re.sub(r'const openingBalance = .*?;', 'const openingBalance = fullEntries.length ? new Decimal(fullEntries[0]!.runningBalance).minus(fullEntries[0]!.debitAmount).plus(fullEntries[0]!.creditAmount) : null;',s)
s=re.sub(r'const closingBalance = .*?;', 'const closingBalance = fullEntries.length ? new Decimal(fullEntries[fullEntries.length - 1]!.runningBalance) : null;',s)
s=re.sub(r'const totalPeriodDebits = .*?;', 'const totalPeriodDebits = new Decimal(sum(filteredEntries.map(e => e.debitAmount)));',s)
s=re.sub(r'const totalPeriodCredits = .*?;', 'const totalPeriodCredits = new Decimal(sum(filteredEntries.map(e => e.creditAmount)));',s)
s=s.replace('openingBalance.toFixed(2)','openingBalance?.toFixed(2) ?? "—"').replace('closingBalance.toFixed(2)','closingBalance?.toFixed(2) ?? "—"')
s=s.replace('    <Card>\n      <CardHead\n        title={`Chronological','    <Card className="ledger-document">\n      <CardHead\n        title={`Chronological')
s=s.replace('href={`${apiBase}/customers/${customerId}/statement/pdf`}','href={`${apiBase}/customers/${customerId}/statement/pdf?fromDate=${fromDate}&toDate=${toDate}`}')
s=s.replace('statementQuery.isError ? (','statementQuery.isLoading ? <LoadingState /> : statementQuery.isError ? (')
for q in ['ordersQuery','invoicesQuery','paymentsQuery']:
 s=s.replace(f'{q}.isError ? (',f'{q}.isLoading ? <LoadingState /> : {q}.isError ? (')
p.write_text(s,encoding='utf-8')
# Current rates, calculated from effective dates, including multiple sales units.
p=root/'pricing/page.tsx';s=p.read_text(encoding='utf-8');s=s.replace('"use client";','"use client";\nimport { Fuel as FuelIcon, Pencil } from "lucide-react";\nimport { decimal } from "../../lib/format";')
s=s.replace('title="Price book & Fuusto configuration"','title="Fuel pricing"').replace('eyebrow="Price & Container Management"','eyebrow="Pricing & conversions"').replace('description="Effective-dated master records. Confirmed sales orders retain their price and conversion snapshots forever."','description="Manage Diesel and Petrol selling rates. Previously confirmed orders retain their prices."')
pos=s.index('      <div className="notice">')
s=s[:pos]+'''      <div className="price-grid">
        {fuels.data?.map(fuel => {
          const current = prices.data?.filter(p => p.fuel.id === fuel.id && new Date(p.effectiveFromUtc).getTime() <= Date.now() && (!p.effectiveToUtc || new Date(p.effectiveToUtc).getTime() > Date.now())) ?? [];
          return <Card className="price-card" key={fuel.id}><div className="metric-top"><Badge tone={current.length ? "ok" : "warn"}>{current.length ? "Current selling rate" : "Not configured"}</Badge><span className="metric-icon"><FuelIcon size={18} /></span></div><h2>{fuel.displayName}</h2>{prices.isError ? <ErrorState message={prices.error.message} retry={() => void prices.refetch()} /> : current.length ? current.map(price => <div key={price.id}><div className="price-value mono">{price.currencyCode} {decimal(price.unitPrice)}<small>/ {price.salesUnit.name}</small></div><div className="price-meta"><span>Effective {dateTime(price.effectiveFromUtc)}</span>{owner && <button className="btn dark small" onClick={() => setMode("price")}><Pencil size={13} />Change rate</button>}</div></div>) : <p className="muted">{prices.isLoading ? "Loading rates…" : "An owner must configure a selling price before confirming orders."}</p>}</Card>;
        })}
      </div>
'''+s[pos:]
s=s.replace('20 Liters is an illustrative example only. Sales order confirmations require an active Fuusto capacity version set up by an Owner.','Set the actual liters per fuusto before confirming orders. New versions never change historical quantities.')
s=s.replace('<div className="two-col">','<div className="two-col equal-cols">').replace('placeholder={mode === "price" ? "120.0000" : "20.000000"}','placeholder={mode === "price" ? "Enter selling price" : "Enter confirmed capacity"}')
p.write_text(s,encoding='utf-8')
# Finance headers and table structures use the same primitives as operations.
for name,title,desc,action in [
 ('invoices','Invoices','Billing follows accepted deliveries. Review posted invoices and outstanding amounts.','<button className="btn primary" onClick={() => setOpenModal(true)}>Generate invoice</button>'),
 ('payments','Payment collections','Record customer payments and allocate them to invoices.','<button className="btn primary" onClick={() => setOpenModal(true)}>Record payment</button>'),
 ('debts','Accounts receivable','Follow outstanding balances, unapplied credits and customer exposure.','<Link href="/payments" className="btn primary">Receive payment</Link>')]:
 p=root/name/'page.tsx';s=p.read_text(encoding='utf-8');s=s.replace('"use client";', '"use client";\nimport { PageHeader, CardHead } from "../../components/ui";',1)
 s=re.sub(r'<header className="page-header">.*?</header>',f'<PageHeader eyebrow="Customer finance" title="{title}" description="{desc}" actions={{{action}}} />',s,count=1,flags=re.S)
 s=s.replace('<section className="card space-y-4">',f'<section className="card"><CardHead title="{title if name=="debts" else title.split()[0]+" register"}" description="Review records and open an account for details." />',1)
 s=s.replace('<h2 className="section-title">Customer Subledger Accounts</h2>','')
 p.write_text(s,encoding='utf-8')
for name,obj,word in [('invoices','inv','Invoice'),('payments','pay','Payment')]:
 p=root/name/'[id]/page.tsx';s=p.read_text(encoding='utf-8');s=s.replace('import { Modal }','import { Modal, PageHeader }')
 start=s.index('      <header className="page-header">');end=s.index('      </header>',start)+len('      </header>')
 old=s[start:end];actions=old[old.index('        <div className="actions">'):old.rindex('      </header>')].strip()
 s=s[:start]+f'<PageHeader eyebrow="{word} / detail" title={{`{word} ${{{obj}.{word.lower()}No}}`}} description={{{obj}.customer.name}} actions={{{actions}}} />'+s[end:]
 p.write_text(s,encoding='utf-8')
