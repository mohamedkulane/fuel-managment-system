from pathlib import Path
import re
root=Path('apps/web/src/app')
p=root/'reports/page.tsx';s=p.read_text(encoding='utf-8')
s=s.replace('import Link from "next/link";','import { ArrowRight, FileDown, FileSpreadsheet, BarChart3 } from "lucide-react";\nimport { ReportPreview, type ReportData } from "../../components/report-preview";')
s=s.replace('import { api }','import { api, apiBase }').replace('api<any>','api<ReportData>')
s=s.replace('`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1${activeReport.endpoint}', '`${apiBase}${activeReport.endpoint}')
s=s.replace('title="Reporting & Analytics Center"','title="Reports & exports"').replace('eyebrow="Business Intelligence & Export Hub"','eyebrow="Business insights"').replace('description="Comprehensive Excel (.xlsx) and PDF report generation for customer subledgers, inventory movements, sales, collections, and financial position."','description="Find the records you need. Export clear PDF and Excel reports."')
s=s.replace('<Card style={{ marginBottom: 20 }}>','<Card className="filter-panel">')
s=re.sub(r'style=\{\{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc"(?:, minWidth: 200)? \}\}', 'className="input"',s)
start=s.index('      {/* Report Cards Selector Grid */}');end=s.index('      {/* Report Data Preview Section */}',start)
s=s[:start]+'''      <div className="report-grid">
        {reports.filter(r => !r.ownerOnly || isOwner).map(r => <button type="button" key={r.id} className={`report-option ${r.id === selectedReport ? "selected" : ""}`} aria-pressed={r.id === selectedReport} onClick={() => setSelectedReport(r.id)}><span className="report-icon"><BarChart3 size={19} /></span><strong>{r.title}</strong><p>{r.description}</p><span className="report-link">{r.id === selectedReport ? "Viewing report" : "View report"} <ArrowRight size={13} /></span>{r.ownerOnly && <Badge tone="warn">Owner only</Badge>}</button>)}
      </div>

'''+s[end:]
s=s.replace('description={`Showing sample results for range ${fromDate} to ${toDate}`}','description={`Records from the selected report · ${fromDate} to ${toDate}`}')
start=s.index('          <div className="table-wrap">',s.index('      {/* Report Data Preview Section */}'));end=s.index('          </div>',start)+len('          </div>')
s=s[:start]+'          <ReportPreview data={previewQuery.data} />'+s[end:]
s=s.replace('Export PDF','<FileDown size={14} /> Export PDF').replace('Export Excel (.xlsx)','<FileSpreadsheet size={14} /> Export Excel')
p.write_text(s,encoding='utf-8')
p=root/'audits/page.tsx';s=p.read_text(encoding='utf-8');s=s.replace('import { api }','import { api, apiBase }').replace('ErrorState, PageHeader','ErrorState, LoadingState, PageHeader, Pagination')
s=s.replace('beforeRedacted?: any','beforeRedacted?: unknown').replace('afterRedacted?: any','afterRedacted?: unknown').replace('{event.afterRedacted ? (','{event.afterRedacted != null ? (')
s=s.replace('`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/audits/${format}`','`${apiBase}/audits/${format}`')
s=s.replace('title="System Audit Logs"','title="Activity & audit log"').replace('eyebrow="Security & Governance Trail"','eyebrow="Security & governance"').replace('description="Immutable audit trail of master data edits, stock adjustments, pricing changes, status transitions, and financial reversals."','description="Owner-only history of changes, approvals and financial reversals."')
s=s.replace('<Card style={{ marginBottom: 20 }}>','<Card className="filter-panel">')
s=re.sub(r'style=\{\{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" \}\}', 'className="input"',s)
for state in ['EntityType','Action','FromDate','ToDate']:
 s=s.replace(f'onChange={{(e) => set{state}(e.target.value)}}',f'onChange={{(e) => {{ set{state}(e.target.value); setPage(1); }}}}')
s=s.replace('title="Audit Events Trail"','title="Recent system activity"').replace('<th>Timestamp (UTC)</th>','<th>Timestamp · Mogadishu</th>').replace('{new Date(event.createdAt).toISOString().slice(0, 19).replace("T", " ")}','{dateTime(event.createdAt)}')
s=s.replace('"use client";','"use client";\nimport { dateTime } from "../../lib/format";',1)
s=s.replace('<pre style={{ margin: 0, padding: 4, background: "var(--canvas)", borderRadius: 4 }}>','<details className="audit-details"><summary>View changes</summary><pre>').replace('</pre>','</pre></details>')
s=s.replace('        <div className="table-wrap">','        {audits.isLoading ? <LoadingState /> : audits.isError ? <ErrorState message={audits.error.message} retry={() => void audits.refetch()} /> : <div className="table-wrap">',1)
s=s.replace('        </div>\n      </Card>\n    </main>','        </div>}\n        <Pagination page={page} totalPages={audits.data?.totalPages ?? 1} onPageChange={setPage} />\n      </Card>\n    </main>')
p.write_text(s,encoding='utf-8')
# Remove legacy unsafe types while retaining response compatibility.
p=root/'orders/new/page.tsx';s=p.read_text(encoding='utf-8').replace('import { api }','import { api, type PaginatedResponse }').replace('api<Customer[]>','api<Customer[] | PaginatedResponse<Customer>>').replace('(rawCustomers as any)?.items','rawCustomers?.items');p.write_text(s,encoding='utf-8')
p=root/'deliveries/page.tsx';s=p.read_text(encoding='utf-8').replace('import { api }','import { api, type PaginatedResponse }').replace('api<Order[]>','api<Order[] | PaginatedResponse<Order>>').replace('api<Sheet[]>','api<Sheet[] | PaginatedResponse<Sheet>>').replace('(rawOrders as any)?.items','rawOrders?.items').replace('(rawSheets as any)?.items','rawSheets?.items');p.write_text(s,encoding='utf-8')
p=root/'payments/page.tsx';s=p.read_text(encoding='utf-8').replace('e.target.value as any','e.target.value as typeof methodInput');p.write_text(s,encoding='utf-8')
