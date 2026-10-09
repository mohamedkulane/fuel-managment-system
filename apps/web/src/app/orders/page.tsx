"use client";
import { Users, ClipboardList, CircleCheck, Clock3 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, mutationKey, type PaginatedResponse } from "../../lib/api";
import { MetricCard, LoadingState, Badge, Card, CardHead, Empty, ErrorState, PageHeader, Pagination } from "../../components/ui";

type Order = {
  id: string;
  orderNo: string;
  status: string;
  orderDate: string;
  requestedDeliveryDate: string | null;
  customer: { name: string };
  lines: Array<{
    requestedUnits: string;
    fuel: { displayName: string };
    unitPriceSnapshot: string | null;
    litersPerUnitSnapshot: string | null;
  }>;
};

export default function OrdersPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams({ page: String(page), limit: "15" });
  if (search.trim()) queryParams.set("search", search.trim());
  if (status) queryParams.set("status", status);

  const rows = useQuery({
    queryKey: ["orders", search, status, page],
    queryFn: () => api<PaginatedResponse<Order> | Order[]>(`/orders?${queryParams.toString()}`)
  });

  const confirm = useMutation({
    mutationFn: (id: string) =>
      api(`/orders/${id}/confirm`, {
        method: "POST",
        headers: { "idempotency-key": mutationKey() }
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: ["orders"] })
  });

  const rawData = rows.data;
  const items: Order[] = Array.isArray(rawData) ? rawData : (rawData?.items ?? []);
  const totalPages = Array.isArray(rawData) ? 1 : (rawData?.totalPages ?? 1);

  return (
    <main className="page orders-page">
      <PageHeader
        eyebrow="Sales operations"
        title="Sales orders"
        description="Create orders with saved prices. Track fulfillment from request to delivery."
        actions={
          <Link className="btn primary" href="/orders/new">
            Create order
          </Link>
        }
      />
      <div className="grid"><MetricCard label="Matching orders" value={rows.data ? (Array.isArray(rows.data) ? rows.data.length : rows.data.total) : "—"} note="Across the current search" icon={ClipboardList}/><MetricCard label="Drafts on this page" value={items.filter(o=>o.status==="DRAFT").length} note="Awaiting confirmation" icon={Clock3}/><MetricCard label="In progress on this page" value={items.filter(o=>["CONFIRMED","SCHEDULED","IN_PROGRESS"].includes(o.status)).length} note="Confirmed and active orders" icon={Users}/><MetricCard label="Fulfilled on this page" value={items.filter(o=>o.status==="FULFILLED").length} note="Accepted deliveries" icon={CircleCheck}/></div>
      <Card>
        <CardHead
          title="Order register"
          description="Requested quantities remain historical after dispatch and acceptance"
        />
        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1 }}>
            <input
              className="input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by order # or customer name…"
              aria-label="Search orders"
              style={{ flex: 1, minWidth: "220px" }}
            />
            <select
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PARTIALLY_FULFILLED">Partially Fulfilled</option>
              <option value="FULFILLED">Fulfilled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {rows.isLoading ? <LoadingState /> : rows.isError ? (
          <ErrorState message={(rows.error as Error).message} retry={() => void rows.refetch()} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Requested</th>
                  <th>Delivery date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="strong mono" href={`/orders/${row.id}`}>
                        {row.orderNo}
                      </Link>
                    </td>
                    <td>{row.customer.name}</td>
                    <td>
                      {row.lines.map((line) => `${line.fuel.displayName}: ${line.requestedUnits} fuusto`).join(", ")}
                    </td>
                    <td>{row.requestedDeliveryDate?.slice(0, 10) ?? "—"}</td>
                    <td>
                      <Badge
                        tone={
                          row.status === "DRAFT"
                            ? "neutral"
                            : row.status === "FULFILLED"
                            ? "ok"
                            : row.status === "CONFIRMED" || row.status === "SCHEDULED" || row.status === "IN_PROGRESS"
                            ? "info"
                            : "warn"
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="btn small" href={`/orders/${row.id}`}>Details</Link> {row.status === "DRAFT" && (
                        <button
                          className="btn primary small"
                          disabled={confirm.isPending}
                          onClick={() => confirm.mutate(row.id)}
                        >
                          Confirm
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <Empty>No orders found.</Empty>}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
        {confirm.isError && <div className="notice warn" style={{ marginTop: 16 }}>{(confirm.error as Error).message}</div>}
      </Card>
    </main>
  );
}

