"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Badge, Card, CardHead, ErrorState, PageHeader } from "../../components/ui";

type AuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  reason?: string;
  createdAt: string;
  actor?: { id: string; displayName: string; email: string; role: string };
  beforeRedacted?: any;
  afterRedacted?: any;
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
    const baseUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/audits/${format}`;
    const url = `${baseUrl}?${entityType ? `&entityType=${entityType}` : ""}${action ? `&action=${action}` : ""}${fromDate ? `&fromDate=${fromDate}` : ""}${toDate ? `&toDate=${toDate}` : ""}`;
    window.open(url, "_blank");
  };

  if (me.isLoading) return <main className="page"><div className="skeleton tall" /></main>;

  if (!isOwner) {
    return (
      <main className="page">
        <ErrorState title="Access Restricted" message="System audit logs are strictly reserved for the Business Owner role (OWNER)." />
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Security & Governance Trail"
        title="System Audit Logs"
        description="Immutable audit trail of master data edits, stock adjustments, pricing changes, status transitions, and financial reversals."
        actions={
          <>
            <button className="btn" onClick={() => handleExport("pdf")}>
              📄 Export PDF
            </button>
            <button className="btn primary" onClick={() => handleExport("xlsx")}>
              📊 Export Excel (.xlsx)
            </button>
          </>
        }
      />

      {/* Filter Bar */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Entity Type:</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}>
              <option value="">All Entities</option>
              <option value="Customer">Customer</option>
              <option value="PriceVersion">PriceVersion</option>
              <option value="FuelUnitVersion">FuelUnitVersion</option>
              <option value="SalesOrder">SalesOrder</option>
              <option value="TankerReceipt">TankerReceipt</option>
              <option value="Dispatch">Dispatch</option>
              <option value="DeliveryConfirmation">DeliveryConfirmation</option>
              <option value="Invoice">Invoice</option>
              <option value="Payment">Payment</option>
              <option value="InventoryMovement">InventoryMovement</option>
              <option value="User">User</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Action:</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}>
              <option value="">All Actions</option>
              <option value="CREATED">CREATED</option>
              <option value="UPDATED">UPDATED</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="POSTED">POSTED</option>
              <option value="REVERSED">REVERSED</option>
              <option value="ADJUSTED">ADJUSTED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>From Date:</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>To Date:</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }} />
          </div>

          <button className="btn small" onClick={() => { setEntityType(""); setAction(""); setFromDate(""); setToDate(""); setPage(1); }} style={{ marginLeft: "auto" }}>
            Reset Filters
          </button>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHead title="Audit Events Trail" description={`Showing ${audits.data?.items.length ?? 0} events of ${audits.data?.total ?? 0}`} />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Action</th>
                <th>Reason</th>
                <th>Changes / Redacted Payload</th>
              </tr>
            </thead>
            <tbody>
              {audits.data?.items.length ? (
                audits.data.items.map((event) => (
                  <tr key={event.id}>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {new Date(event.createdAt).toISOString().slice(0, 19).replace("T", " ")}
                    </td>
                    <td>
                      <strong>{event.actor?.displayName ?? "System"}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{event.actor?.role}</div>
                    </td>
                    <td className="strong">{event.entityType}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{event.entityId}</td>
                    <td>
                      <Badge tone={event.action === "REVERSED" ? "warn" : event.action === "POSTED" ? "ok" : "info"}>
                        {event.action}
                      </Badge>
                    </td>
                    <td className="muted">{event.reason ?? "—"}</td>
                    <td style={{ fontSize: 11, maxWidth: 300, overflowX: "auto" }}>
                      {event.afterRedacted ? (
                        <pre style={{ margin: 0, padding: 4, background: "#f1f5f9", borderRadius: 4 }}>
                          {JSON.stringify(event.afterRedacted)}
                        </pre>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    No audit events found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
