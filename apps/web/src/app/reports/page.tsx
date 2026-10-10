"use client";

import { ArrowRight, FileDown, FileSpreadsheet, BarChart3 } from "lucide-react";
import { ReportPreview, type ReportData } from "../../components/report-preview";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, apiBase } from "../../lib/api";
import { Badge, Card, CardHead, PageHeader } from "../../components/ui";

type ReportCard = {
  id: string;
  title: string;
  category: "Financial" | "Operations" | "Inventory" | "Owner";
  description: string;
  endpoint: string;
  ownerOnly?: boolean;
};

const reports: ReportCard[] = [
  {
    id: "customers",
    title: "Customer List & Financial Position",
    category: "Financial",
    description: "Complete list of customers with status, total invoiced, total paid, debt due, and net position.",
    endpoint: "/reports/customers"
  },
  {
    id: "debts",
    title: "Accounts Receivable Debt Aging",
    category: "Financial",
    description: "Detailed debt aging breakdown (Current, 31-60, 61-90, 90+ days) across all open customer accounts.",
    endpoint: "/reports/debts"
  },
  {
    id: "statement",
    title: "Customer Statement of Account",
    category: "Financial",
    description: "Chronological transaction subledger for an individual customer showing invoices, payments, and running balances.",
    endpoint: "/reports/statement"
  },
  {
    id: "sales",
    title: "Sales Orders & Unit Conversions",
    category: "Operations",
    description: "Sales order lines with fuusto requested units, snapshot liters, agreed unit prices, and line totals.",
    endpoint: "/reports/sales"
  },
  {
    id: "collections",
    title: "Payment Collections",
    category: "Financial",
    description: "Payment receipts by method (Cash, EVC Plus, eDahab, Bank Transfer) with allocation and unapplied amounts.",
    endpoint: "/reports/collections"
  },
  {
    id: "inventory",
    title: "Inventory Stock Balances & Movements",
    category: "Inventory",
    description: "Canonical stock levels by location (Warehouse vs In-Transit) and historical movement ledger.",
    endpoint: "/reports/inventory"
  },
  {
    id: "tanker-receipts",
    title: "Fuel Stock Receipts & Purchases",
    category: "Inventory",
    description: "Inbound fuel stock purchases in fuusto with calculated liters and purchase costs (Owner only).",
    endpoint: "/reports/tanker-receipts"
  },
  {
    id: "deliveries",
    title: "Actual Delivery & Reconciliation",
    category: "Operations",
    description: "Non-financial delivery manifest reconciliations showing dispatched, accepted, and physically returned fuel.",
    endpoint: "/reports/deliveries"
  },
  {
    id: "invoices",
    title: "Invoices & Revenue Subledger",
    category: "Financial",
    description: "Confirmed commercial invoices with totals, paid amounts, balance due, and reversal statuses.",
    endpoint: "/reports/invoices"
  },
  {
    id: "profitability",
    title: "Financial Profitability Summary",
    category: "Owner",
    description: "Confirmed invoiced revenue vs total fuel stock purchase costs with cost allocation policy disclosures.",
    endpoint: "/reports/profitability",
    ownerOnly: true
  }
];

export default function ReportsHubPage() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedReport, setSelectedReport] = useState<string>("customers");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<{ role: string }>("/auth/me") });
  const isOwner = me.data?.role === "OWNER";

  const customers = useQuery({
    queryKey: ["customers-list"],
    queryFn: () => api<{ items: Array<{ id: string; name: string; code: string }> }>("/customers?limit=100")
  });

  const activeReport = reports.find((r) => r.id === selectedReport) ?? reports[0]!;

  // Dynamic Query for Preview
  const reportQueryUrl = () => {
    let url = `${activeReport.endpoint}?fromDate=${fromDate}&toDate=${toDate}`;
    if (activeReport.id === "statement" && selectedCustomerId) {
      url += `&customerId=${selectedCustomerId}`;
    }
    return url;
  };

  const previewQuery = useQuery({
    queryKey: ["report-preview", activeReport.id, fromDate, toDate, selectedCustomerId],
    queryFn: () => api<ReportData>(reportQueryUrl()),
    enabled: activeReport.id !== "statement" || Boolean(selectedCustomerId)
  });

  const handleDownload = (format: "pdf" | "xlsx") => {
    let url = `${apiBase}${activeReport.endpoint}/${format}?fromDate=${fromDate}&toDate=${toDate}`;
    if (activeReport.id === "statement") {
      if (!selectedCustomerId) {
        alert("Please select a customer to generate a statement report.");
        return;
      }
      url += `&customerId=${selectedCustomerId}`;
    }
    window.open(url, "_blank");
  };

  return (
    <main className="page reports-page">
      <PageHeader
        eyebrow="Business insights"
        title="Reports & exports"
        description="Find the records you need. Export clear PDF and Excel reports."
      />

      {/* Global Filter Bar */}
      <Card className="filter-panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Date Range From (Mogadishu UTC+3):</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Date Range To:</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
          </div>

          {activeReport.id === "statement" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Select Customer for Statement:</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="input"
              >
                <option value="">-- Choose Customer --</option>
                {customers.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => handleDownload("pdf")}>
              <FileDown size={14} /> Export PDF
            </button>
            <button className="btn primary" onClick={() => handleDownload("xlsx")}>
              <FileSpreadsheet size={14} /> Export Excel
            </button>
          </div>
        </div>
      </Card>

      <div className="report-grid">
        {reports.filter(r => !r.ownerOnly || isOwner).map(r => <button type="button" key={r.id} className={`report-option ${r.id === selectedReport ? "selected" : ""}`} aria-pressed={r.id === selectedReport} onClick={() => setSelectedReport(r.id)}><span className="report-icon"><BarChart3 size={19} /></span><strong>{r.title}</strong><p>{r.description}</p><span className="report-link">{r.id === selectedReport ? "Viewing report" : "View report"} <ArrowRight size={13} /></span>{r.ownerOnly && <Badge tone="warn">Owner only</Badge>}</button>)}
      </div>

      {/* Report Data Preview Section */}
      <Card>
        <CardHead
          title={`Report Data Preview — ${activeReport.title}`}
          description={`Records from the selected report · ${fromDate} to ${toDate}`}
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn small" onClick={() => handleDownload("pdf")}>
                PDF
              </button>
              <button className="btn small primary" onClick={() => handleDownload("xlsx")}>
                Excel (.xlsx)
              </button>
            </div>
          }
        />

        {previewQuery.isLoading ? (
          <div className="card-body">
            <div className="skeleton tall" />
          </div>
        ) : previewQuery.isError ? (
          <div className="card-body">
            <p className="muted" style={{ color: "var(--red)" }}>
              {(previewQuery.error as Error).message}
            </p>
          </div>
        ) : (
          <ReportPreview data={previewQuery.data} />
        )}
      </Card>
    </main>
  );
}
