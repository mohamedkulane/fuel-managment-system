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
    title: "Diiwaanka Macaamiisha & Xaaladda Xisaabaadka",
    category: "Financial",
    description: "Liiska dhameystiran ee macaamiisha, xaaladda, wadarta biilasha, wadarta la bixiyay, deynta harsan iyo natiijada xisaabta.",
    endpoint: "/reports/customers"
  },
  {
    id: "debts",
    title: "Warbixinta Deynta Harsan (Aging Report)",
    category: "Financial",
    description: "Kala qaybinta deynta harsan (Hadda, 31-60, 61-90, 90+ maalmood) ee dhammaan macaamiisha.",
    endpoint: "/reports/debts"
  },
  {
    id: "statement",
    title: "Warbixinta Xisaabta Macmiilka (Statement)",
    category: "Financial",
    description: "Diiwaanka faahfaahsan ee dhaqdhaqaaqa xisaabta macmiilka (biilasha, lacag-bixinnada, iyo baaqiga harsan).",
    endpoint: "/reports/statement"
  },
  {
    id: "sales",
    title: "Warbixinta Dalabyada Iibka & Cabbirrada",
    category: "Operations",
    description: "Safaf ka mid ah dalabyada iibka oo leh tirada fuustooyinka, litirada, qiimaha fuustadii, iyo wadarta.",
    endpoint: "/reports/sales"
  },
  {
    id: "collections",
    title: "Warbixinta Qabashada Lacagaha",
    category: "Financial",
    description: "Rasiidhada lacag-bixinnada ee qaababka kala duwan (Cash, EVC Plus, eDahab, Bank) iyo qaybinta biilasha.",
    endpoint: "/reports/collections"
  },
  {
    id: "inventory",
    title: "Warbixinta Kaydka Shidaalka & Dhaqdhaqaaqa",
    category: "Inventory",
    description: "Heerka kaydka shidaalka ee Bakhaarka ama Wadada ku jira iyo diiwaanka dhaqdhaqaaqa.",
    endpoint: "/reports/inventory"
  },
  {
    id: "tanker-receipts",
    title: "Warbixinta Shidaal Soo Gelinta & Iibsiga",
    category: "Inventory",
    description: "Shidaalka soo galay oo fuusto lagu iibsaday, litirada la xisaabiyay iyo qiimaha iibsiga (Milkiilaha kaliya).",
    endpoint: "/reports/tanker-receipts"
  },
  {
    id: "deliveries",
    title: "Warbixinta Shidaal Gaarsiinta & Dib-u-heshiisiinta",
    category: "Operations",
    description: "Warbixinta gaarsiinta shidaalka oo muujineysa tiradii la diray, tan la aqbalay, iyo shidaalka dib loo soo celiyay.",
    endpoint: "/reports/deliveries"
  },
  {
    id: "invoices",
    title: "Warbixinta Biilasha & Dakhliga",
    category: "Financial",
    description: "Biilasha la xaqiijiyay, wadarta guud, la bixiyay, deynta harsan, iyo xaaladaha kansalaadda.",
    endpoint: "/reports/invoices"
  },
  {
    id: "profitability",
    title: "Warbixinta Faaydada & Dakhliga",
    category: "Owner",
    description: "Wadarta dakhliga biilasha la soo saaray marka loo barbardhigo qiimaha shidaalka lagu soo iibsaday (Milkiilaha kaliya).",
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
        alert("Fadlan dooro macmiil si aad u soo dejiso warbixinta xisaabta macmiilka.");
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
        title="Warbixinnada & Soo Dejinta"
        description="Ka hel diiwaanada aad u baahan tahay. Soo dejiso warbixinnada PDF ama Excel oo cad."
      />

      {/* Global Filter Bar */}
      <Card className="filter-panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Taariikhda Billaabashada (Mogadishu UTC+3):</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Taariikhda Dhammaadka:</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
          </div>

          {activeReport.id === "statement" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Dooro Macmiilka Warbixinta:</label>
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

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => handleDownload("pdf")}>
              <FileDown size={14} /> Soo Dejiso PDF
            </button>
            <button className="btn primary" onClick={() => handleDownload("xlsx")}>
              <FileSpreadsheet size={14} /> Soo Dejiso Excel
            </button>
          </div>
        </div>
      </Card>

      <div className="report-grid">
        {reports.filter(r => !r.ownerOnly || isOwner).map(r => (
          <button
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
          </button>
        ))}
      </div>

      {/* Report Data Preview Section */}
      <Card>
        <CardHead
          title={`Kormeerka Warbixinta — ${activeReport.title}`}
          description={`Diiwaanka taariikhda la shaandheeyay · ${fromDate} ilaa ${toDate}`}
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
