"use client";
import { Users, ClipboardList, CircleCheck, Clock3 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, mutationKey, type PaginatedResponse } from "../../lib/api";
import { formatStatus, formatFuel } from "../../lib/format";
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
        eyebrow="Hawgallada iibka"
        title="Dalabyada"
        description="Ka dhex samay dalabyada qiimayaasha la kaydiyay. La soco fulinta laga bilaabo codsiga ilaa gaarsiinta."
        actions={
          <Link className="btn primary" href="/orders/new">
            Dalab Cusub
          </Link>
        }
      />
      <div className="grid"><MetricCard label="Dalabyada ku habboon" value={rows.data ? (Array.isArray(rows.data) ? rows.data.length : rows.data.total) : "—"} note="Natiijada raadinta hadda" icon={ClipboardList}/><MetricCard label="Qabyo boggan" value={items.filter(o=>o.status==="DRAFT").length} note="Sugaya xaqiijin" icon={Clock3}/><MetricCard label="Socda boggan" value={items.filter(o=>["CONFIRMED","SCHEDULED","IN_PROGRESS"].includes(o.status)).length} note="Dalabyada la xaqiijiyay ee firfircoon" icon={Users}/><MetricCard label="La dhammeeyay boggan" value={items.filter(o=>o.status==="FULFILLED").length} note="Gaarsiinta la aqbalay" icon={CircleCheck}/></div>
      <Card>
        <CardHead
          title="Diiwaanka Dalabyada"
          description="Tirada la codsaday waxay ahaanaysaa taariikh xataa ka dib dirista iyo aqbalada"
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
              placeholder="Ka raadi koodhka dalabka ama magaca macmiilka…"
              aria-label="Raadi dalabyada"
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
              <option value="">Dhammaan Xaaladaha</option>
              <option value="DRAFT">Qabyo</option>
              <option value="CONFIRMED">La Xaqiijiyay</option>
              <option value="SCHEDULED">La Jadwaleeyay</option>
              <option value="IN_PROGRESS">Wuu Socdaa</option>
              <option value="PARTIALLY_FULFILLED">Qayb Ayaa La Fushiyay</option>
              <option value="FULFILLED">La Dhammeeyay</option>
              <option value="CANCELLED">La Baajiyay</option>
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
                  <th>Dalabka</th>
                  <th>Macmiilka</th>
                  <th>La Codsaday</th>
                  <th>Taariikhda Gaarsiinta</th>
                  <th>Xaaladda</th>
                  <th style={{ textAlign: "right" }}>Hawgallada</th>
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
                      {row.lines.map((line) => `${formatFuel(line.fuel.displayName)}: ${line.requestedUnits} Fuusto`).join(", ")}
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
                        {formatStatus(row.status)}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="btn small" href={`/orders/${row.id}`}>Faahfaahin</Link> {row.status === "DRAFT" && (
                        <button
                          className="btn primary small"
                          disabled={confirm.isPending}
                          onClick={() => confirm.mutate(row.id)}
                        >
                          Xaqiiji
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <Empty>Ma jiraan dalabyo loo helay.</Empty>}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
        {confirm.isError && <div className="notice warn" style={{ marginTop: 16 }}>{(confirm.error as Error).message}</div>}
      </Card>
    </main>
  );
}


