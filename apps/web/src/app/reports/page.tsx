"use client";
import { ActionButton, FormLabel } from "../../components/controls";

import { ArrowRight, FileDown, BarChart3 } from "lucide-react";
import { ReportPreview, type ReportData } from "../../components/report-preview";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, apiBase } from "../../lib/api";
import { Badge, Card, CardHead, LoadingState, PageHeader } from "../../components/ui";
import { PdfButton } from "../../components/pdf-button";
import { notifyError } from "../../lib/toast";

type ReportCard = {
  id: string;
  title: string;
  category: "Financial" | "Operations" | "Inventory" | "Owner";
  description: string;
  endpoint: string;
  ownerOnly?: boolean;
};

const reports: ReportCard[] = [
 {id:"customers",title:"Macaamiisha iyo deymaha",category:"Financial",description:"Xisaabta iyo deynta macaamiisha.",endpoint:"/reports/customers"},
 {id:"sales",title:"Iibka",category:"Financial",description:"Iibka shidaalka la geeyey iyo biilasha.",endpoint:"/reports/invoices"},
 {id:"collections",title:"Lacagihii la qabtay",category:"Financial",description:"Lacagaha macaamiisha laga qabtay.",endpoint:"/reports/collections"},
 {id:"inventory",title:"Kaydka Shidaalka",category:"Inventory",description:"Kaydka iyo shidaalka soo galay ama baxay.",endpoint:"/reports/inventory"}
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
        notifyError(new Error("Customer required"), "Select a customer first");
        return;
      }
      url += `&customerId=${selectedCustomerId}`;
    }
    window.open(url, "_blank");
  };

  return (
    <main className="page reports-page">
      <PageHeader
        eyebrow="Warbixinnada & Falanqaynta"
        title="Warbixinnada"
        description="Ka hel diiwaanada aad u baahan tahay. Soo dejiso warbixinnada PDF ama Excel oo cad."
      />

      {/* Global Filter Bar */}
      <Card className="filter-panel">
        <div className="report-filters">
        <div className="report-date-range">
        <div>
          <FormLabel style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Laga bilaabo</FormLabel>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
          </div>
          <div>
            <FormLabel style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Ilaa</FormLabel>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
          </div>
          </div>

          {activeReport.id === "statement" && (
            <div>
              <FormLabel style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Dooro Macmiilka Warbixinta:</FormLabel>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="input"
              >
                <option value="">-- Dooro Macmiilka --</option>
                {customers.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="report-filter-actions">
            <PdfButton className="btn primary" path={activeReport.endpoint+"/pdf?fromDate="+fromDate+"&toDate="+toDate} failure="Report unavailable"            >Fur Warbixinta</PdfButton>
          </div>
        </div>
      </Card>

      <div className="report-grid">
        {reports.filter(r => !r.ownerOnly || isOwner).map(r => (
          <ActionButton
            type="button"
            key={r.id}
            className={`report-option ${r.id === selectedReport ? "selected" : ""}`}
            aria-pressed={r.id === selectedReport}
            onClick={() => setSelectedReport(r.id)}
          >
            <span className="report-icon"><BarChart3 size={19} /></span>
            <strong>{r.title}</strong>
            <p>{r.description}</p>
            <span className="report-link">
              {r.id === selectedReport ? "Eegaya warbixinta" : "Eeg warbixinta"} <ArrowRight size={13} />
            </span>
            {r.ownerOnly && <Badge tone="warn">Milkiilaha Kaliya</Badge>}
          </ActionButton>
        ))}
      </div>

      {/* Report Data Preview Section */}
      <Card>
        <CardHead
          title={`Kormeerka Warbixinta — ${activeReport.title}`}
          description={`Diiwaanka taariikhda la shaandheeyay · ${fromDate} ilaa ${toDate}`}
        />

        {previewQuery.isLoading ? (
          <div className="card-body">
            <LoadingState label="Warbixinta waa la soo rarayaa…" />
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
