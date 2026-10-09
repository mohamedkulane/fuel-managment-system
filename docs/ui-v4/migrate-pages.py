from pathlib import Path
import re
root=Path('apps/web/src/app')
for p in root.rglob('page.tsx'):
    if p.parent in [root,root/'login']: continue
    s=p.read_text(encoding='utf-8-sig')
    rel='../'*(len(p.parent.relative_to(root).parts)+1)
    # Normalize exact money formatting and local dates across all screens.
    s=re.sub(r'parseFloat\(([^()]*)\)\.toFixed\((\d+)\)',r'decimal(\1, \2)',s)
    s=re.sub(r'parseFloat\(([^()]*)\)\s*>\s*0',r'new Decimal(\1).gt(0)',s)
    s=re.sub(r'parseFloat\(([^()]*)\)\s*<\s*0',r'new Decimal(\1).lt(0)',s)
    s=re.sub(r'new Date\(([^()]*)\)\.toLocaleString\(\)',r'dateTime(\1)',s)
    if 'decimal(' in s: s=s.replace('"use client";',f'"use client";\nimport {{ decimal }} from "{rel}lib/format";',1)
    if 'dateTime(' in s: s=s.replace('"use client";',f'"use client";\nimport {{ dateTime }} from "{rel}lib/format";',1)
    if 'new Decimal(' in s: s=s.replace('"use client";','"use client";\nimport Decimal from "decimal.js";',1)
    for old,new in {'#2563eb':'var(--petrol)','#1d4ed8':'var(--petrol)','#eff6ff':'var(--lime-pale)','#bfdbfe':'var(--line)','#f8fafc':'var(--canvas)','#f1f5f9':'var(--canvas)','#eff0f2':'var(--line)','#e2e8f0':'var(--line)','#64748b':'var(--muted)','#dc2626':'var(--red)','#f43f5e':'var(--red)','#f59e0b':'var(--amber)','#16a34a':'var(--teal)','#10b981':'var(--teal)'}.items(): s=s.replace(old,new)
    s=s.replace('📄 ','').replace('📊 ','').replace('📦 ','').replace('💳 ','').replace('📖 ','').replace('🖨️ ','').replace('✏️ ','')
    s=s.replace('className="table"','className="data-table"')
    s=s.replace('className="grid grid-cols-1 md:grid-cols-4 gap-4"','className="grid finance-metrics"')
    s=s.replace('className="card grid grid-cols-1 md:grid-cols-2 gap-6"','className="card grid detail-information"')
    s=s.replace('className="page space-y-6"','className="page finance-page"')
    # Make legacy form controls consistently labelled without modifying submitted fields.
    s=re.sub(r'<label>([^<]+)</label>(\s*)<(input|select|textarea)([^>]*?)name="([^"]+)"',lambda m:f'<label htmlFor="{m[5]}">{m[1]}</label>{m[2]}<{m[3]} id="{m[5]}"{m[4]}name="{m[5]}"',s)
    s=s.replace('className="page"',f'className="page {p.parent.name.replace("[id]","detail")}-page"')
    p.write_text(s,encoding='utf-8')
# Correct existing export links to use the same API base as authenticated JSON calls.
for name in ['customers/[id]','invoices/[id]','payments/[id]']:
    p=root/name/'page.tsx';s=p.read_text();s=s.replace('import { api,','import { api, apiBase,');s=s.replace('href={`/api/v1/','href={`${apiBase}/');p.write_text(s)
