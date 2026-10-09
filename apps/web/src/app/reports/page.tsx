"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
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
    title: "Inbound Booyad Tanker Receipts",
    category: "Inventory",
    description: "Inbound booyad receipts with actual liters, expected liters, and purchase costs (Owner only).",
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
    description: "Confirmed invoiced revenue vs total booyad purchase costs with cost allocation policy disclosures.",
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
    queryFn: () => api<any>(reportQueryUrl()),
    enabled: activeReport.id !== "statement" || Boolean(selectedCustomerId)
  });

  const handleDownload = (format: "pdf" | "xlsx") => {
    let url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1${activeReport.endpoint}/${format}?fromDate=${fromDate}&toDate=${toDate}`;
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
    <main className="page">
      <PageHeader
        eyebrow="Business Intelligence & Export Hub"
        title="Reporting & Analytics Center"
        description="Comprehensive Excel (.xlsx) and PDF report generation for customer subledgers, inventory movements, sales, collections, and financial position."
      />

      {/* Global Filter Bar */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Date Range From (Mogadishu UTC+3):</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Date Range To:</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }} />
          </div>

          {activeReport.id === "statement" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Select Customer for Statement:</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc", minWidth: 200 }}
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
              📄 Export PDF
            </button>
            <button className="btn primary" onClick={() => handleDownload("xlsx")}>
              📊 Export Excel (.xlsx)
            </button>
          </div>
        </div>
      </Card>

      {/* Report Cards Selector Grid */}
      <div className="grid" style={{ marginBottom: 24 }}>
        {reports.map((r) => {
          if (r.ownerOnly && !isOwner) return null;
          const isSelected = r.id === selectedReport;
          return (
            <Card
              key={r.id}
              style={{
                cursor: "pointer",
                borderColor: isSelected ? "var(--primary-color, #2563eb)" : undefined,
                background: isSelected ? "var(--accent-bg, #eff6ff)" : undefined
              }}
              onClick={() => setSelectedReport(r.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Badge tone={r.category === "Financial" ? "info" : r.category === "Owner" ? "warn" : "neutral"}>{r.category}</Badge>
                {isSelected && <span style={{ color: "#2563eb", fontWeight: "bold", fontSize: 13 }}>● Selected</span>}
              </div>
              <strong style={{ display: "block", fontSize: 15, marginBottom: 4 }}>{r.title}</strong>
              <small className="muted" style={{ display: "block", lineHeight: 1.4 }}>
                {r.description}
              </small>
            </Card>
          );
        })}
      </div>

      {/* Report Data Preview Section */}
      <Card>
        <CardHead
          title={`Report Data Preview — ${activeReport.title}`}
          description={`Showing sample results for range ${fromDate} to ${toDate}`}
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
            <p className="muted" style={{ color: "#dc2626" }}>
              {(previewQuery.error as Error).message}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <pre style={{ padding: 16, background: "#f8fafc", borderRadius: 6, fontSize: 12, overflowX: "auto", maxHeight: 400 }}>
              {JSON.stringify(previewQuery.data?.data, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </main>
  );
}
