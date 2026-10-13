"use client";
import { ActionButton, FormLabel, ActionAnchor, ActionLink } from "./controls";
import Decimal from "decimal.js";
import { PaymentDialog } from "./simple-forms";
import { Receipt, Wallet, CircleCheck, TrendingUp } from "lucide-react";
import { sum, dateTime, decimal, formatStatus, formatFuel } from "../lib/format";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, apiBase, type PaginatedResponse } from "../lib/api";
import { notifyError, notifySuccess } from "../lib/toast";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, Pagination, SubmitButton } from "./ui";

type Address = { id: string; label: string; addressText: string; district: string | null; city: string | null };

type Customer = {
  id: string;
  code: string;
  name: string;
  primaryPhone: string | null;
  status: string;
  notes: string | null;
  createdAt?: string;
  addresses: Address[];
  orders: Array<{
    id: string;
    orderNo: string;
    status: string;
    orderDate: string;
    lines: Array<{ requestedUnits: string; fuel: { displayName: string } }>;
  }>;
};

type FinancialSummary = {
  customerId: string;
  code: string;
  name: string;
  status: string;
  totalInvoiced: string;
  totalPaid: string;
  outstandingDebt: string;
  unappliedCredit: string;
  netPosition: string;
};

type OrderItem = {
  id: string;
  orderNo: string;
  status: string;
  orderDate: string;
  requestedDeliveryDate: string | null;
  customer: { name: string };
  lines: Array<{
    id: string;
    requestedUnits: string;
    unitPriceSnapshot: string | null;
    litersPerUnitSnapshot: string | null;
    fuel: { displayName: string };
    salesUnit: { name: string };
  }>;
};

type InvoiceItem = {
  id: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string | null;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "REVERSED";
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
};

type PaymentItem = {
  id: string;
  paymentNo: string;
  paymentDate: string;
  paymentMethod: string;
  amount: string;
  allocatedAmount: string;
  unappliedAmount: string;
  reference: string | null;
  status: "POSTED" | "REVERSED";
  recordedBy: { displayName: string };
};

type LedgerEntry = {
  id: string;
  occurredAt: string;
  entryType: string;
  referenceNo: string;
  debitAmount: string;
  creditAmount: string;
  runningBalance: string;
  notes: string | null;
};

type StatementData = {
  customer: { id: string; code: string; name: string; phone: string | null };
  entries: LedgerEntry[];
};

export function CustomerOrdersTab({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const queryParams = new URLSearchParams({ customerId, page: String(page), limit: "10" });
  if (search.trim()) queryParams.set("search", search.trim());
  if (status) queryParams.set("status", status);

  const ordersQuery = useQuery({
    queryKey: ["customer-orders", customerId, search, status, page],
    queryFn: () => api<PaginatedResponse<OrderItem> | OrderItem[]>(`/orders?${queryParams.toString()}`)
  });

  const rawData = ordersQuery.data;
  const items: OrderItem[] = Array.isArray(rawData) ? rawData : (rawData?.items ?? []);
  const totalPages = Array.isArray(rawData) ? 1 : (rawData?.totalPages ?? 1);

  return (
    <Card>
      <CardHead title="Taariikhda Dalabyada & Gaarsiinta Macmiilka" description="Tirada la codsaday, qiimaha la xaqiijiyay, iyo kuleetarrada" />

      <div className="toolbar" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Ka raadi koodhka dalabka..."
          style={{ flex: 1, minWidth: 200 }}
        />
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
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

      {ordersQuery.isLoading ? <LoadingState /> : ordersQuery.isError ? (
        <ErrorState message={(ordersQuery.error as Error).message} retry={() => void ordersQuery.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dalabka #</th>
                <th>Taariikhda</th>
                <th>Shidaalka & Fuustooyinka</th>
                <th>Kuleetarka Litarada</th>
                <th>Qiimaha Fuustadii</th>
                <th>Xaaladda</th>
                <th style={{ textAlign: "right" }}>Hawgallada</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <ActionLink href={`/orders/${row.id}`} className="mono strong">
                      {row.orderNo}
                    </ActionLink>
                  </td>
                  <td>{row.orderDate.slice(0, 10)}</td>
                  <td>
                    {row.lines.map((l) => (
                      <div key={l.id}>
                        {formatFuel(l.fuel.displayName)}: <b>{l.requestedUnits} {l.salesUnit?.name ?? "fuusto"}</b>
                      </div>
                    ))}
                  </td>
                  <td>
                    {row.lines.map((l) => (
                      <div key={l.id} className="mono text-xs">
                        {l.litersPerUnitSnapshot ? `${l.litersPerUnitSnapshot} L / fuusto` : "Aan la xaqiijin"}
                      </div>
                    ))}
                  </td>
                  <td>
                    {row.lines.map((l) => (
                      <div key={l.id} className="mono text-xs">
                        {l.unitPriceSnapshot ? `$${decimal(l.unitPriceSnapshot, 2)}` : "Aan la xaqiijin"}
                      </div>
                    ))}
                  </td>
                  <td>
                    <Badge tone={row.status === "FULFILLED" ? "ok" : row.status === "DRAFT" ? "neutral" : "info"}>
                      {formatStatus(row.status)}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <ActionLink className="btn small" href={`/orders/${row.id}`}>Faahfaahinta Dalabka</ActionLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <Empty>Ma jiraan dalabyo loo helay macmiilkan.</Empty>}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 3: INVOICES & DEBTS COMPONENT                                          */
/* -------------------------------------------------------------------------- */
export function CustomerPaymentsTab({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");

  const queryParams = new URLSearchParams({ customerId, page: String(page), limit: "10" });
  if (search.trim()) queryParams.set("search", search.trim());
  if (method) queryParams.set("paymentMethod", method);

  const paymentsQuery = useQuery({
    queryKey: ["customer-payments", customerId, search, method, page],
    queryFn: () => api<PaginatedResponse<PaymentItem>>(`/payments?${queryParams.toString()}`)
  });

  const items = paymentsQuery.data?.items ?? [];
  const totalPages = paymentsQuery.data?.totalPages ?? 1;

  return (
    <Card>
      <CardHead title="Taariikhda Lacag-bixinnada & Qaybinta Macmiilka" description="Rasiidhada, qayb-bixinta, iyo kireeditka aan la isticmaalin" />

      <div className="toolbar" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Ka raadi lambarka lacag-bixinta ama tixraaca..."
          style={{ flex: 1, minWidth: 200 }}
        />
        <select className="select" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}>
          <option value="">Dhammaan Hababka Bixinta</option>
          <option value="CASH">Kaash</option>
          <option value="BANK_TRANSFER">Xawaalad Bank</option>
          <option value="EVC_PLUS">EVC Plus</option>
          <option value="EDAHAB">eDahab</option>
          <option value="OTHER">Wadada Kale</option>
        </select>
      </div>

      {paymentsQuery.isLoading ? <LoadingState /> : paymentsQuery.isError ? (
        <ErrorState message={(paymentsQuery.error as Error).message} retry={() => void paymentsQuery.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lacag-bixinta #</th>
                <th>Taariikhda</th>
                <th>Habka</th>
                <th>Tixraaca</th>
                <th>Wadarta La Ururiyay</th>
                <th>Lagu Jaray Biilasha</th>
                <th>Kireeditka Aan La Isticmaalin</th>
                <th>Xaaladda</th>
                <th>Wuxuu Diiwaangeliyay</th>
                <th style={{ textAlign: "right" }}>Hawgallada</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <ActionLink href={`/payments/${p.id}`} className="mono strong">
                      {p.paymentNo}
                    </ActionLink>
                  </td>
                  <td>{p.paymentDate.slice(0, 10)}</td>
                  <td><Badge tone="neutral">{p.paymentMethod}</Badge></td>
                  <td>{p.reference ?? "—"}</td>
                  <td className="mono font-bold text-emerald-400">${decimal(p.amount, 2)}</td>
                  <td className="mono">${decimal(p.allocatedAmount, 2)}</td>
                  <td className="mono" style={{ color: new Decimal(p.unappliedAmount).gt(0) ? "var(--amber)" : "inherit" }}>
                    ${decimal(p.unappliedAmount, 2)}
                  </td>
                  <td>
                    <Badge tone={p.status === "POSTED" ? "ok" : "danger"}>{formatStatus(p.status)}</Badge>
                  </td>
                  <td>{p.recordedBy.displayName}</td>
                  <td style={{ textAlign: "right" }}>
                    <ActionLink className="btn small" href={`/payments/${p.id}`}>Faahfaahinta Rasiidhka</ActionLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <Empty>Ma jiraan diiwaanno lacag-bixin oo loo helay macmiilkan.</Empty>}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 5: ACCOUNT LEDGER COMPONENT                                            */
/* -------------------------------------------------------------------------- */
