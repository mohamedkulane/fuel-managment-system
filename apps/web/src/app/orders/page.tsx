"use client";
import { ActionButton, ActionLink } from "../../components/controls";
import { Users, ClipboardList, CircleCheck, Clock3 } from "lucide-react";
import { useState } from "react";
import Decimal from "decimal.js";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBase, mutationKey, type PaginatedResponse } from "../../lib/api";
import { formatStatus, formatFuel, decimal, businessDate } from "../../lib/format";
import { notifyError, notifySuccess } from "../../lib/toast";
import { MetricCard, LoadingState, Badge, Card, CardHead, Empty, ErrorState, PageHeader, Pagination } from "../../components/ui";

type Order = {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: string | null;
  fixedDiscountAmount: string;
  discountApprovedById: string | null;
  paidAmount: string;
  invoicedBalance: string;
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
  const [date, setDate] = useState("");

  const queryParams = new URLSearchParams({ page: String(page), limit: "15" });
  if (search.trim()) queryParams.set("search", search.trim());
  if (status) queryParams.set("status", status);
  if (date) queryParams.set("date", date);

  const rows = useQuery({
    queryKey: ["orders", search, status, page, date],
    queryFn: () => api<PaginatedResponse<Order> | Order[]>(`/orders?${queryParams.toString()}`)
  });

  const confirm = useMutation({
    mutationFn: (id: string) =>
      api(`/orders/${id}/confirm`, {
        method: "POST",
        headers: { "idempotency-key": mutationKey() }
      }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["orders"] }); notifySuccess("Order confirmed"); },
    onError: error => notifyError(error, "Order not saved")
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
          <><ActionLink className="btn" href={`${apiBase}/simple/delivery-list/pdf?date=${businessDate()}`} target="_blank" rel="noreferrer">Today's List</ActionLink><ActionLink className="btn primary" href="/orders/new">
            Dalab Cusub
          </ActionLink></>
        }
      />
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
            <input type="date" className="input" value={date} aria-label="Taariikhda (Date)" onChange={e=>{setDate(e.target.value);setPage(1);}} />
          </div>
        </div>

        {rows.isLoading ? <LoadingState /> : rows.isError ? (
          <ErrorState message={(rows.error as Error).message} retry={() => void rows.refetch()} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Macmiilka</th>
                  <th>La Codsaday</th>
                  <th>Wadarta</th><th>La bixiyey</th><th>Haraaga</th>
                  <th>Xaaladda</th>
                  <th style={{ textAlign: "right" }}>Hawgallada</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.customer.name}</strong>
                    </td>
                    <td>
                      {row.lines.map((line) => `${formatFuel(line.fuel.displayName)}: ${line.requestedUnits} Fuusto`).join(", ")}
                    </td>
                    <td>{row.totalAmount ? `$${decimal(row.totalAmount)}` : "Qiyaas lama xaqiijin"}</td>
                    <td>${decimal(row.paidAmount)}</td>
                    <td>{row.status === "FULFILLED" ? `$${decimal(row.invoicedBalance)}` : row.totalAmount ? `$${decimal(Decimal.max(0,new Decimal(row.totalAmount).sub(row.paidAmount ?? "0")).toString())}` : "—"}<small className="balance-label">{row.status === "FULFILLED" ? "Deyn rasmi ah" : "Qiyaas"}</small></td>
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
                      <ActionLink className="btn small" href={`/orders/${row.id}`}>Faahfaahin</ActionLink> {row.status === "DRAFT" && (
                        <ActionButton
                          className="btn primary small"
                          disabled={confirm.isPending}
                          onClick={() => confirm.mutate(row.id)}
                        >
                          Xaqiiji
                        </ActionButton>
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


