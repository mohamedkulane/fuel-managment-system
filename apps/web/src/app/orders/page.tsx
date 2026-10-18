"use client";
import { ActionButton, ActionLink } from "../../components/controls";
import { Users, ClipboardList, CircleCheck, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import Decimal from "decimal.js";

import { useQuery } from "@tanstack/react-query";
import { api, type PaginatedResponse } from "../../lib/api";
import { formatStatus, formatFuel, decimal, businessDate, fuustoQuantity, orderStatusTone } from "../../lib/format";
import { PdfButton } from "../../components/pdf-button";
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

type DeliveryList = {
  date: string;
  rows: Array<{
    customer: string;
    phone: string;
    location: string;
    fuel: "Naafto" | "Basiin";
    quantity: string;
  }>;
};

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [date, setDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(businessDate);
  const [viewedDeliveryDate, setViewedDeliveryDate] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = new URLSearchParams({ page: String(page), limit: "15" });
  if (searchTerm) queryParams.set("search", searchTerm);
  if (status) queryParams.set("status", status);
  if (date) queryParams.set("date", date);

  const rows = useQuery({
    queryKey: ["orders", searchTerm, status, page, date],
    queryFn: () => api<PaginatedResponse<Order> | Order[]>(`/orders?${queryParams.toString()}`)
  });

  const deliveryList = useQuery({
    queryKey: ["simple", "delivery-list", viewedDeliveryDate],
    queryFn: () => api<DeliveryList>(`/simple/delivery-list?date=${encodeURIComponent(viewedDeliveryDate!)}`),
    enabled: viewedDeliveryDate !== null
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
          <ActionLink className="btn primary" href="/orders/new">
            Dalab Cusub
          </ActionLink>
        }
      />
      <Card>
        <CardHead
          title="Liiska Gaarsiinta"
          description="Dooro taariikh kasta si aad u aragto dalabyadii loo qorsheeyay maalintaas, oo ay ku jiraan gaarsiimaha hore loo dhammeeyay."
        />
        <div className="card-body">
          <div className="delivery-list-toolbar">
            <label className="delivery-list-date">
              <span>Taariikhda</span>
              <input
                type="date"
                className="input"
                value={deliveryDate}
                onChange={(event) => {
                  setDeliveryDate(event.target.value);
                  setViewedDeliveryDate(null);
                }}
              />
            </label>
            <div className="delivery-list-actions">
              <ActionButton
                className="btn"
                type="button"
                disabled={!deliveryDate}
                onClick={() => setViewedDeliveryDate(deliveryDate)}
              >
                View List
              </ActionButton>
              {viewedDeliveryDate === deliveryDate && deliveryList.isSuccess && (
                <PdfButton
                  path={`/simple/delivery-list/pdf?date=${encodeURIComponent(viewedDeliveryDate)}`}
                  failure="Delivery list PDF unavailable"
                  className="btn primary"
                >
                  Open PDF
                </PdfButton>
              )}
            </div>
          </div>
          {viewedDeliveryDate === deliveryDate && deliveryList.isPending && <LoadingState label="Loading delivery list…" />}
          {viewedDeliveryDate === deliveryDate && deliveryList.isError && (
            <ErrorState message={deliveryList.error.message} retry={() => void deliveryList.refetch()} />
          )}
          {viewedDeliveryDate === deliveryDate && deliveryList.isSuccess && (
            <>
              <div className="table-wrap delivery-list-preview">
                <table className="data-table responsive-table">
                  <thead>
                    <tr>
                      <th>Macmiilka</th>
                      <th>Telefoon</th>
                      <th>Goobta</th>
                      <th>Shidaalka</th>
                      <th>Fuusto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryList.data.rows.map((item, index) => (
                      <tr key={`${item.customer}-${item.fuel}-${index}`}>
                        <td data-label="Customer">{item.customer}</td>
                        <td data-label="Phone">{item.phone || "—"}</td>
                        <td data-label="Location">{item.location}</td>
                        <td data-label="Fuel">{item.fuel}</td>
                        <td data-label="Fuusto">{fuustoQuantity(item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {deliveryList.data.rows.length === 0 && <Empty>Ma jiraan dalabyo gaarsiin oo taariikhdan ah.</Empty>}
              </div>
            </>
          )}
        </div>
      </Card>
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
              <option value="CONFIRMED">La xaqiijiyey</option>
              <option value="SCHEDULED">Gaarsiin la qorsheeyey</option>
              <option value="IN_PROGRESS">Gaarsiintu wey socotaa</option>
              <option value="PARTIALLY_FULFILLED">Qayb ahaan la geeyey</option>
              <option value="FULFILLED">La geeyey</option>
              <option value="CANCELLED">La joojiyey</option>
            </select>
            <input type="date" className="input" value={date} aria-label="Taariikhda (Date)" onChange={e=>{setDate(e.target.value);setPage(1);}} />
          </div>
        </div>

        {rows.isLoading ? <LoadingState /> : rows.isError ? (
          <ErrorState message={(rows.error as Error).message} retry={() => void rows.refetch()} />
        ) : (
          <div className="table-wrap">
            <table className="data-table responsive-table">
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
                    <td data-label="Customer">
                      <strong>{row.customer.name}</strong>
                    </td>
                    <td data-label="Fuusto">
                      {row.lines.map((line) => `${formatFuel(line.fuel.displayName)}: ${fuustoQuantity(line.requestedUnits)} Fuusto`).join(", ")}
                    </td>
                    <td data-label="Total">{row.totalAmount ? `$${decimal(row.totalAmount)}` : "Qiyaas lama xaqiijin"}</td>
                    <td data-label="Paid">${decimal(row.paidAmount)}</td>
                    <td data-label="Remaining">{row.status === "FULFILLED" ? `$${decimal(row.invoicedBalance)}` : row.totalAmount ? `$${decimal(Decimal.max(0,new Decimal(row.totalAmount).sub(row.paidAmount ?? "0")).toString())}` : "—"}<small className="balance-label">{row.status === "FULFILLED" ? "Deyn rasmi ah" : "Qiyaas"}</small></td>
                    <td data-label="Status">
                      <Badge tone={orderStatusTone(row.status)}>
                        {formatStatus(row.status)}
                      </Badge>
                    </td>
                    <td data-label="" style={{ textAlign: "right" }}>
                      <ActionLink className="btn small" href={`/orders/${row.id}`}>View</ActionLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <Empty>Ma jiraan dalabyo loo helay.</Empty>}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </main>
  );
}
