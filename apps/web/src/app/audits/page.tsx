"use client";
import { ActionButton, FormLabel } from "../../components/controls";
import { dateTime, formatRole, formatStatus } from "../../lib/format";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, apiBase } from "../../lib/api";
import { Badge, Card, CardHead, ErrorState, LoadingState, PageHeader, Pagination } from "../../components/ui";

type AuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  reason?: string;
  createdAt: string;
  actor?: { id: string; displayName: string; email: string; role: string };
  beforeRedacted?: unknown;
  afterRedacted?: unknown;
};

type AuditsResponse = {
  items: AuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function AuditsPage() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<{ role: string }>("/auth/me") });
  const isOwner = me.data?.role === "OWNER";

  const queryUrl = `/audits?page=${page}&limit=50${entityType ? `&entityType=${entityType}` : ""}${action ? `&action=${action}` : ""}${fromDate ? `&fromDate=${fromDate}` : ""}${toDate ? `&toDate=${toDate}` : ""}`;

  const audits = useQuery({
    queryKey: ["audits", entityType, action, fromDate, toDate, page],
    queryFn: () => api<AuditsResponse>(queryUrl),
    enabled: isOwner
  });

  const handleExport = (format: "pdf" | "xlsx") => {
    const baseUrl = `${apiBase}/audits/${format}`;
    const url = `${baseUrl}?${entityType ? `&entityType=${entityType}` : ""}${action ? `&action=${action}` : ""}${fromDate ? `&fromDate=${fromDate}` : ""}${toDate ? `&toDate=${toDate}` : ""}`;
    window.open(url, "_blank");
  };

  if (me.isLoading) return <main className="page audits-page"><LoadingState /></main>;

  if (!isOwner) {
    return (
      <main className="page audits-page">
        <ErrorState title="Xaqiijinta Ogolaanshada" message="Diiwaanka hawlaha nidaamka (audit logs) waxaa la ogol yahay oo kaliya Milkiilaha Vane (OWNER)." />
      </main>
    );
  }

  return (
    <main className="page audits-page">
      <PageHeader
        eyebrow="Amaanada & Maamulka"
        title="Diiwaanka Hawlaha Nidaamka"
        description="Diiwaanka Milkiilaha kaliya ee dhammaan isbeddelada, ogolaanshaha, iyo ka noqoshada xisaabaadka."
        actions={
          <>
            <ActionButton className="btn" onClick={() => handleExport("pdf")}>
              Soo Dejiso PDF
            </ActionButton>
            <ActionButton className="btn primary" onClick={() => handleExport("xlsx")}>
              Soo Dejiso Excel (.xlsx)
            </ActionButton>
          </>
        }
      />

      {/* Filter Bar */}
      <Card className="filter-panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div>
            <FormLabel style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Nooca Qaybta:</FormLabel>
            <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className="input">
              <option value="">Dhammaan Qaybaha</option>
              <option value="Customer">Macmiilka</option>
              <option value="PriceVersion">Qiimaha Shidaalka</option>
              <option value="FuelUnitVersion">Cabbirka Fuustada</option>
              <option value="SalesOrder">Dalabka Iibka</option>
              <option value="TankerReceipt">Shidaal Soo Gelin</option>
              <option value="Dispatch">Dirista Shidaalka</option>
              <option value="DeliveryConfirmation">Xaqiijinta Gaarsiinta</option>
              <option value="Invoice">Biilka</option>
              <option value="Payment">Lacag-bixin</option>
              <option value="InventoryMovement">Dhaqdhaqaaqa Kaydka</option>
              <option value="User">Isticmaalaha</option>
            </select>
          </div>

          <div>
            <FormLabel style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Hawsha:</FormLabel>
            <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="input">
              <option value="">Dhammaan Hawlaha</option>
              <option value="CREATED">La Diiwaangeliyey</option>
              <option value="UPDATED">La Cusboonaysiiyey</option>
              <option value="CONFIRMED">La Xaqiijiyey</option>
              <option value="POSTED">La Gudbiyey</option>
              <option value="REVERSED">Laga Noqday</option>
              <option value="ADJUSTED">La Saxay</option>
              <option value="CANCELLED">La Joojiyey</option>
            </select>
          </div>

          <div>
            <FormLabel style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Taariikhda Billaabashada:</FormLabel>
            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="input" />
          </div>

          <div>
            <FormLabel style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Taariikhda Dhammaadka:</FormLabel>
            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="input" />
          </div>

          <ActionButton className="btn small" onClick={() => { setEntityType(""); setAction(""); setFromDate(""); setToDate(""); setPage(1); }} style={{ marginLeft: "auto" }}>
            Nadiifi Shaandheynta
          </ActionButton>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHead title="Diiwaanka Hawlihii Ugu Dambeeyay" description={`Muujinaya ${audits.data?.items.length ?? 0} ka mid ah ${audits.data?.total ?? 0}`} />
        {audits.isLoading ? <LoadingState /> : audits.isError ? <ErrorState message={audits.error.message} retry={() => void audits.refetch()} /> : <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waqtiga · Muqdisho</th>
                <th>Qofka Hawsha Qabtay</th>
                <th>Qaybta</th>
                <th>Lambarka Qaybta</th>
                <th>Hawsha</th>
                <th>Sababta</th>
                <th>Isbeddelka / Xogta La Qariyey</th>
              </tr>
            </thead>
            <tbody>
              {audits.data?.items.length ? (
                audits.data.items.map((event) => (
                  <tr key={event.id}>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {dateTime(event.createdAt)}
                    </td>
                    <td>
                      <strong>{event.actor?.displayName ?? "Nidaamka"}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{event.actor?.role ? formatRole(event.actor.role) : ""}</div>
                    </td>
                    <td className="strong">{formatStatus(event.entityType)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{event.entityId}</td>
                    <td>
                      <Badge tone={event.action === "REVERSED" ? "warn" : event.action === "POSTED" ? "ok" : "info"}>
                        {formatStatus(event.action)}
                      </Badge>
                    </td>
                    <td className="muted">{event.reason ?? "—"}</td>
                    <td style={{ fontSize: 11, maxWidth: 300, overflowX: "auto" }}>
                      {event.afterRedacted != null ? (
                        <details className="audit-details"><summary>Eeg Isbeddelka</summary><pre>
                          {JSON.stringify(event.afterRedacted)}
                        </pre></details>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    Ma jiraan hawlo lagu helay shaandheyntan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>}
        <Pagination page={page} totalPages={audits.data?.totalPages ?? 1} onPageChange={setPage} />
      </Card>
    </main>
  );
}
