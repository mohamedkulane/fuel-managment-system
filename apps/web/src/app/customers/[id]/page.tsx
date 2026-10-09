"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, type PaginatedResponse } from "../../../lib/api";
import { Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, Pagination, SubmitButton } from "../../../components/ui";

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

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "invoices" | "payments" | "ledger">("overview");
  const [showEdit, setShowEdit] = useState(false);

  // Customer Master Query
  const customerQuery = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api<Customer>(`/customers/${id}`)
  });

  // Financial KPIs Query
  const financialQuery = useQuery({
    queryKey: ["customer-financial", id],
    queryFn: () => api<FinancialSummary>(`/customers/${id}/financial`)
  });

  // Edit Customer Mutation
  const updateCustomer = useMutation({
    mutationFn: (body: object) => api<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setShowEdit(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["customer", id] }),
        client.invalidateQueries({ queryKey: ["customers"] }),
        client.invalidateQueries({ queryKey: ["customer-financial", id] })
      ]);
    }
  });

  function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    updateCustomer.mutate({
      name: d.get("name"),
      primaryPhone: d.get("phone"),
      status: d.get("status"),
      address: d.get("address"),
      notes: d.get("notes")
    });
  }

  if (customerQuery.isError) {
    return (
      <main className="page">
        <ErrorState message={(customerQuery.error as Error).message} retry={() => void customerQuery.refetch()} />
      </main>
    );
  }

  const cust = customerQuery.data;
  const fin = financialQuery.data;

  return (
    <main className="page customer-account-page">
      {/* Dynamic Print Stylesheet */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .page-actions, .tabs-header, .toolbar, .btn, button, nav, header.main-header, .no-print { display: none !important; }
          .page { padding: 0 !important; margin: 0 !important; width: 100% !important; }
          .card { border: 1px solid #ccc !important; box-shadow: none !important; margin-bottom: 20px !important; break-inside: avoid; }
          .print-only { display: block !important; }
          .data-table { font-size: 11px !important; }
          .data-table th, .data-table td { padding: 6px 8px !important; border-bottom: 1px solid #ddd !important; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Print-Only Letterhead Header */}
      <div className="print-only" style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid #333" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 24, margin: 0, fontWeight: "bold" }}>FUELDESK WHOLESALE SYSTEM</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#555" }}>Official Customer Commercial & Financial Statement</p>
          </div>
          <div style={{ textAlign: "right", fontSize: 12 }}>
            <div><strong>Statement Date:</strong> {new Date().toISOString().slice(0, 10)}</div>
            <div><strong>Mogadishu Local Time (UTC+3)</strong></div>
          </div>
        </div>
      </div>

      {/* Top Header */}
      <PageHeader
        eyebrow="Customer Commercial Account"
        title={cust?.name ?? "Loading Customer Profile…"}
        description={
          cust
            ? `Customer Code: ${cust.code} · Primary Phone: ${cust.primaryPhone ?? "N/A"} · Registered: ${
                cust.createdAt ? cust.createdAt.slice(0, 10) : "System Record"
              }`
            : ""
        }
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              className="btn"
              href={`/api/v1/customers/${id}/statement/pdf`}
              target="_blank"
              rel="noreferrer"
              title="Download official PDF statement document"
            >
              📄 Download PDF Statement
            </a>
            <button className="btn" onClick={() => window.print()} title="Print browser view of financial statement">
              🖨️ Print Statement
            </button>
            {cust && (
              <button className="btn primary" onClick={() => setShowEdit(true)}>
                ✏️ Edit Customer
              </button>
            )}
            <Link className="btn" href="/customers">
              ← Back to Directory
            </Link>
          </div>
        }
      />

      {cust && (
        <>
          {/* Edit Customer Modal */}
          <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Customer Account Details">
            <form onSubmit={handleEditSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label>Customer Name *</label>
                  <input className="input" name="name" defaultValue={cust.name} required />
                </div>
                <div className="field">
                  <label>Primary Phone</label>
                  <input className="input" name="phone" defaultValue={cust.primaryPhone ?? ""} />
                </div>
                <div className="field">
                  <label>Account Status</label>
                  <select className="select" name="status" defaultValue={cust.status}>
                    <option value="ACTIVE">Active (Normal Trading)</option>
                    <option value="HOLD">Account Hold (Restrict New Credit Orders)</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div className="field full">
                  <label>Primary Delivery Address</label>
                  <input className="input" name="address" defaultValue={cust.addresses[0]?.addressText ?? ""} />
                </div>
                <div className="field full">
                  <label>Operational Notes</label>
                  <input className="input" name="notes" defaultValue={cust.notes ?? ""} />
                </div>
              </div>
              {updateCustomer.isError && (
                <div className="notice warn" role="alert" style={{ marginTop: 16 }}>
                  {(updateCustomer.error as Error).message}
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowEdit(false)}>
                  Cancel
                </button>
                <SubmitButton busy={updateCustomer.isPending}>Save Changes</SubmitButton>
              </div>
            </form>
          </Modal>

          {/* Top 5 Financial Summary KPI Cards Grid */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Card className="kpi">
              <small>Total Invoiced</small>
              <strong className="mono">${parseFloat(fin?.totalInvoiced ?? "0").toFixed(2)}</strong>
              <span>Gross Invoiced Sales</span>
            </Card>

            <Card className="kpi">
              <small>Total Payments Received</small>
              <strong className="mono text-emerald-400">${parseFloat(fin?.totalPaid ?? "0").toFixed(2)}</strong>
              <span>Posted Receipts Total</span>
            </Card>

            <Card className="kpi" style={{ borderColor: parseFloat(fin?.outstandingDebt ?? "0") > 0 ? "#f43f5e" : undefined }}>
              <small>Outstanding Invoice Debt</small>
              <strong className="mono" style={{ color: parseFloat(fin?.outstandingDebt ?? "0") > 0 ? "#f43f5e" : "inherit" }}>
                ${parseFloat(fin?.outstandingDebt ?? "0").toFixed(2)}
              </strong>
              <span>Unpaid Invoices Total</span>
            </Card>

            <Card className="kpi" style={{ borderColor: parseFloat(fin?.unappliedCredit ?? "0") > 0 ? "#f59e0b" : undefined }}>
              <small>Unapplied Customer Credit</small>
              <strong className="mono" style={{ color: parseFloat(fin?.unappliedCredit ?? "0") > 0 ? "#f59e0b" : "inherit" }}>
                ${parseFloat(fin?.unappliedCredit ?? "0").toFixed(2)}
              </strong>
              <span>Overpayments / Deposit Credit</span>
            </Card>

            <Card className="kpi" style={{ background: "var(--card-bg, #f8fafc)", borderLeft: "4px solid #2563eb" }}>
              <small>Net Account Position</small>
              <strong className="mono" style={{ fontSize: 20 }}>
                ${parseFloat(fin?.netPosition ?? "0").toFixed(2)}
              </strong>
              <span>
                <Badge tone={parseFloat(fin?.netPosition ?? "0") > 0 ? "warn" : parseFloat(fin?.netPosition ?? "0") < 0 ? "ok" : "neutral"}>
                  {parseFloat(fin?.netPosition ?? "0") > 0
                    ? "Net Debt Due"
                    : parseFloat(fin?.netPosition ?? "0") < 0
                    ? "Net Unapplied Credit"
                    : "Settled Account"}
                </Badge>
              </span>
            </Card>
          </div>

          {/* Account Tabs Header */}
          <div className="tabs-header no-print" style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: 20, gap: 4 }}>
            {[
              { id: "overview", label: "📊 Overview" },
              { id: "orders", label: "📦 Orders & Deliveries" },
              { id: "invoices", label: "📄 Invoices & Debts" },
              { id: "payments", label: "💳 Payments & Receipts" },
              { id: "ledger", label: "📖 Statement & Subledger" }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: "10px 18px",
                    border: "none",
                    background: "none",
                    fontWeight: active ? 700 : 500,
                    fontSize: 14,
                    color: active ? "#2563eb" : "#64748b",
                    borderBottom: active ? "3px solid #2563eb" : "3px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Overview */}
          {activeTab === "overview" && <CustomerOverviewTab customer={cust} fin={fin} />}

          {/* Tab 2: Orders & Deliveries */}
          {activeTab === "orders" && <CustomerOrdersTab customerId={id} />}

          {/* Tab 3: Invoices & Debts */}
          {activeTab === "invoices" && <CustomerInvoicesTab customerId={id} />}

          {/* Tab 4: Payments */}
          {activeTab === "payments" && <CustomerPaymentsTab customerId={id} />}

          {/* Tab 5: Account Ledger */}
          {activeTab === "ledger" && <CustomerLedgerTab customerId={id} customerName={cust.name} customerCode={cust.code} />}
        </>
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 1: OVERVIEW COMPONENT                                                  */
/* -------------------------------------------------------------------------- */
function CustomerOverviewTab({ customer, fin }: { customer: Customer; fin?: FinancialSummary }) {
  return (
    <div className="space-y-6">
      <div className="two-col">
        {/* Account Metadata */}
        <Card>
          <CardHead title="Customer Account Metadata" description="Primary operational profile details" />
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <small className="muted" style={{ display: "block", fontSize: 12 }}>Customer Name</small>
                <strong>{customer.name}</strong>
              </div>
              <div>
                <small className="muted" style={{ display: "block", fontSize: 12 }}>Customer Code</small>
                <span className="mono strong">{customer.code}</span>
              </div>
              <div>
                <small className="muted" style={{ display: "block", fontSize: 12 }}>Account Status</small>
                <Badge tone={customer.status === "ACTIVE" ? "ok" : customer.status === "HOLD" ? "warn" : "neutral"}>
                  {customer.status}
                </Badge>
              </div>
              <div>
                <small className="muted" style={{ display: "block", fontSize: 12 }}>Primary Phone</small>
                <span>{customer.primaryPhone ?? "—"}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eff0f2" }}>
              <small className="muted" style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Registered Delivery Addresses</small>
              {customer.addresses.length === 0 ? (
                <span className="muted">No explicit delivery addresses saved.</span>
              ) : (
                customer.addresses.map((addr) => (
                  <div key={addr.id} style={{ marginBottom: 8, fontSize: 13 }}>
                    <b>{addr.label}:</b> {addr.addressText} {addr.district ? `(${addr.district}, ${addr.city ?? ""})` : ""}
                  </div>
                ))
              )}
            </div>

            {customer.notes && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #eff0f2" }}>
                <small className="muted" style={{ display: "block", fontSize: 12 }}>Operational Notes</small>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, lineHeight: 1.4 }}>{customer.notes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Commercial Balance Breakdown */}
        <Card>
          <CardHead title="Financial Position Breakdown" description="Authoritative ledger receivables vs credits" />
          <div className="card-body">
            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  <tr>
                    <td>Total Invoiced Revenue</td>
                    <td className="mono strong" style={{ textAlign: "right" }}>${parseFloat(fin?.totalInvoiced ?? "0").toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Total Payments Collected</td>
                    <td className="mono strong text-emerald-400" style={{ textAlign: "right" }}>${parseFloat(fin?.totalPaid ?? "0").toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Outstanding Open Invoices Debt</td>
                    <td className="mono strong" style={{ textAlign: "right", color: "#f43f5e" }}>${parseFloat(fin?.outstandingDebt ?? "0").toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Unapplied Payments / Deposits</td>
                    <td className="mono strong" style={{ textAlign: "right", color: "#f59e0b" }}>${parseFloat(fin?.unappliedCredit ?? "0").toFixed(2)}</td>
                  </tr>
                  <tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: "bold" }}>
                    <td>Net Account Balance</td>
                    <td className="mono strong" style={{ textAlign: "right", fontSize: 16 }}>${parseFloat(fin?.netPosition ?? "0").toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Orders Overview */}
      <Card>
        <CardHead title="Recent Orders Overview" description="Latest 5 sales orders placed by customer" />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Order Date</th>
                <th>Fuel & Requested Units</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.slice(0, 5).map((ord) => (
                <tr key={ord.id}>
                  <td className="mono strong">
                    <Link href={`/orders/${ord.id}`}>{ord.orderNo}</Link>
                  </td>
                  <td>{ord.orderDate.slice(0, 10)}</td>
                  <td>{ord.lines.map((l) => `${l.fuel.displayName}: ${l.requestedUnits} fuusto`).join(", ")}</td>
                  <td>
                    <Badge tone={ord.status === "FULFILLED" ? "ok" : ord.status === "DRAFT" ? "neutral" : "info"}>
                      {ord.status}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/orders/${ord.id}`}>View Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customer.orders.length === 0 && <Empty>No sales orders recorded for this customer yet.</Empty>}
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 2: ORDERS & DELIVERIES COMPONENT                                       */
/* -------------------------------------------------------------------------- */
function CustomerOrdersTab({ customerId }: { customerId: string }) {
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
      <CardHead title="Customer Order History & Deliveries" description="Requested quantities, price snapshots, and conversion snapshots" />

      <div className="toolbar" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by order #..."
          style={{ flex: 1, minWidth: 200 }}
        />
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
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

      {ordersQuery.isError ? (
        <ErrorState message={(ordersQuery.error as Error).message} retry={() => void ordersQuery.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Order Date</th>
                <th>Requested Fuel & Fuusto</th>
                <th>Conversion Snapshot</th>
                <th>Agreed Price Snapshot</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/orders/${row.id}`} className="mono strong">
                      {row.orderNo}
                    </Link>
                  </td>
                  <td>{row.orderDate.slice(0, 10)}</td>
                  <td>
                    {row.lines.map((l) => (
                      <div key={l.id}>
                        {l.fuel.displayName}: <b>{l.requestedUnits} {l.salesUnit?.name ?? "fuusto"}</b>
                      </div>
                    ))}
                  </td>
                  <td>
                    {row.lines.map((l) => (
                      <div key={l.id} className="mono text-xs">
                        {l.litersPerUnitSnapshot ? `${l.litersPerUnitSnapshot} L / unit` : "Unconfirmed"}
                      </div>
                    ))}
                  </td>
                  <td>
                    {row.lines.map((l) => (
                      <div key={l.id} className="mono text-xs">
                        {l.unitPriceSnapshot ? `$${parseFloat(l.unitPriceSnapshot).toFixed(2)}` : "Unconfirmed"}
                      </div>
                    ))}
                  </td>
                  <td>
                    <Badge tone={row.status === "FULFILLED" ? "ok" : row.status === "DRAFT" ? "neutral" : "info"}>
                      {row.status}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/orders/${row.id}`}>Order Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <Empty>No orders found for this customer.</Empty>}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 3: INVOICES & DEBTS COMPONENT                                          */
/* -------------------------------------------------------------------------- */
function CustomerInvoicesTab({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const queryParams = new URLSearchParams({ customerId, page: String(page), limit: "10" });
  if (search.trim()) queryParams.set("search", search.trim());
  if (status) queryParams.set("status", status);

  const invoicesQuery = useQuery({
    queryKey: ["customer-invoices", customerId, search, status, page],
    queryFn: () => api<PaginatedResponse<InvoiceItem>>(`/invoices?${queryParams.toString()}`)
  });

  const items = invoicesQuery.data?.items ?? [];
  const totalPages = invoicesQuery.data?.totalPages ?? 1;

  return (
    <Card>
      <CardHead title="Customer Invoices & Commercial Receivables" description="Invoicing based exclusively on confirmed accepted delivery quantity" />

      <div className="toolbar" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by invoice #..."
          style={{ flex: 1, minWidth: 200 }}
        />
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Invoice Statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REVERSED">Reversed</option>
        </select>
      </div>

      {invoicesQuery.isError ? (
        <ErrorState message={(invoicesQuery.error as Error).message} retry={() => void invoicesQuery.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Total Invoiced</th>
                <th>Paid Amount</th>
                <th>Balance Due</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`} className="mono strong">
                      {inv.invoiceNo}
                    </Link>
                  </td>
                  <td>{inv.issueDate.slice(0, 10)}</td>
                  <td>{inv.dueDate ? inv.dueDate.slice(0, 10) : "—"}</td>
                  <td>
                    <Badge tone={inv.status === "PAID" ? "ok" : inv.status === "PARTIALLY_PAID" ? "warn" : inv.status === "REVERSED" ? "danger" : "neutral"}>
                      {inv.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="mono font-bold">${parseFloat(inv.totalAmount).toFixed(2)}</td>
                  <td className="mono text-emerald-400">${parseFloat(inv.paidAmount).toFixed(2)}</td>
                  <td className="mono font-bold" style={{ color: parseFloat(inv.balanceDue) > 0 ? "#f43f5e" : "inherit" }}>
                    ${parseFloat(inv.balanceDue).toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/invoices/${inv.id}`}>View Invoice</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <Empty>No commercial invoices found for this customer.</Empty>}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 4: PAYMENTS COMPONENT                                                  */
/* -------------------------------------------------------------------------- */
function CustomerPaymentsTab({ customerId }: { customerId: string }) {
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
      <CardHead title="Customer Payment History & Allocations" description="Receipts, partial installment allocations, and unapplied credits" />

      <div className="toolbar" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by payment # or reference..."
          style={{ flex: 1, minWidth: 200 }}
        />
        <select className="select" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}>
          <option value="">All Payment Methods</option>
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="EVC_PLUS">EVC Plus</option>
          <option value="EDAHAB">eDahab</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {paymentsQuery.isError ? (
        <ErrorState message={(paymentsQuery.error as Error).message} retry={() => void paymentsQuery.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment #</th>
                <th>Date</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Total Collected</th>
                <th>Allocated to Invoices</th>
                <th>Unapplied Credit</th>
                <th>Status</th>
                <th>Recorded By</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/payments/${p.id}`} className="mono strong">
                      {p.paymentNo}
                    </Link>
                  </td>
                  <td>{p.paymentDate.slice(0, 10)}</td>
                  <td><Badge tone="neutral">{p.paymentMethod}</Badge></td>
                  <td>{p.reference ?? "—"}</td>
                  <td className="mono font-bold text-emerald-400">${parseFloat(p.amount).toFixed(2)}</td>
                  <td className="mono">${parseFloat(p.allocatedAmount).toFixed(2)}</td>
                  <td className="mono" style={{ color: parseFloat(p.unappliedAmount) > 0 ? "#f59e0b" : "inherit" }}>
                    ${parseFloat(p.unappliedAmount).toFixed(2)}
                  </td>
                  <td>
                    <Badge tone={p.status === "POSTED" ? "ok" : "danger"}>{p.status}</Badge>
                  </td>
                  <td>{p.recordedBy.displayName}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/payments/${p.id}`}>Receipt Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <Empty>No payment records found for this customer.</Empty>}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* TAB 5: ACCOUNT LEDGER COMPONENT                                            */
/* -------------------------------------------------------------------------- */
function CustomerLedgerTab({ customerId, customerName, customerCode }: { customerId: string; customerName: string; customerCode: string }) {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryTypeFilter, setEntryTypeFilter] = useState("");

  const statementQuery = useQuery({
    queryKey: ["customer-statement-filtered", customerId, fromDate, toDate],
    queryFn: () =>
      api<StatementData>(
        `/customers/${customerId}/statement?fromDate=${fromDate}&toDate=${toDate}`
      )
  });

  const fullEntries = statementQuery.data?.entries ?? [];

  // Calculate opening balance (running balance before fromDate or initial state)
  const filteredEntries = entryTypeFilter
    ? fullEntries.filter((e) => e.entryType === entryTypeFilter)
    : fullEntries;

  const openingBalance = fullEntries.length > 0 ? parseFloat(fullEntries[0]?.runningBalance ?? "0") - parseFloat(fullEntries[0]?.debitAmount ?? "0") + parseFloat(fullEntries[0]?.creditAmount ?? "0") : 0;
  const closingBalance = fullEntries.length > 0 ? parseFloat(fullEntries[fullEntries.length - 1]?.runningBalance ?? "0") : 0;

  const totalPeriodDebits = filteredEntries.reduce((sum, e) => sum + parseFloat(e.debitAmount), 0);
  const totalPeriodCredits = filteredEntries.reduce((sum, e) => sum + parseFloat(e.creditAmount), 0);

  return (
    <Card>
      <CardHead
        title={`Chronological Statement of Account — ${customerName}`}
        description="Official financial subledger. Debits increase outstanding debt (+); Credits decrease debt (-)."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn small" onClick={() => window.print()}>
              🖨️ Print View
            </button>
            <a
              className="btn small primary"
              href={`/api/v1/customers/${customerId}/statement/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              📄 Download PDF
            </a>
          </div>
        }
      />

      {/* Date Range & Type Filter Toolbar */}
      <div className="toolbar no-print" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>From Date (Mogadishu UTC+3):</label>
          <input
            type="date"
            className="input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>To Date:</label>
          <input
            type="date"
            className="input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Entry Type Filter:</label>
          <select className="select" value={entryTypeFilter} onChange={(e) => setEntryTypeFilter(e.target.value)}>
            <option value="">All Transaction Types</option>
            <option value="INVOICE">Invoices (Debits)</option>
            <option value="PAYMENT">Payments (Credits)</option>
            <option value="REVERSAL">Reversals</option>
            <option value="ADJUSTMENT">Adjustments</option>
          </select>
        </div>
      </div>

      {/* Period Balance Summary Banner */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <small className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Period Opening Balance</small>
          <div className="mono strong" style={{ fontSize: 16 }}>${openingBalance.toFixed(2)}</div>
        </div>
        <div style={{ padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <small className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Period Total Debits (+)</small>
          <div className="mono strong" style={{ fontSize: 16, color: "#f43f5e" }}>+${totalPeriodDebits.toFixed(2)}</div>
        </div>
        <div style={{ padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <small className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Period Total Credits (-)</small>
          <div className="mono strong text-emerald-400" style={{ fontSize: 16 }}>-${totalPeriodCredits.toFixed(2)}</div>
        </div>
        <div style={{ padding: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8 }}>
          <small className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Period Closing Balance</small>
          <div className="mono strong" style={{ fontSize: 16, color: "#1d4ed8" }}>${closingBalance.toFixed(2)}</div>
        </div>
      </div>

      {/* Statement Table */}
      {statementQuery.isError ? (
        <ErrorState message={(statementQuery.error as Error).message} retry={() => void statementQuery.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Reference #</th>
                <th>Debit (+ Debt)</th>
                <th>Credit (- Debt)</th>
                <th style={{ textAlign: "right" }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.occurredAt).toLocaleString()}</td>
                  <td>
                    <Badge
                      tone={
                        e.entryType === "INVOICE"
                          ? "warn"
                          : e.entryType === "PAYMENT"
                          ? "ok"
                          : e.entryType === "REVERSAL"
                          ? "danger"
                          : "neutral"
                      }
                    >
                      {e.entryType}
                    </Badge>
                  </td>
                  <td className="mono strong">{e.referenceNo}</td>
                  <td className="mono" style={{ color: parseFloat(e.debitAmount) > 0 ? "#f43f5e" : "inherit" }}>
                    {parseFloat(e.debitAmount) > 0 ? `$${parseFloat(e.debitAmount).toFixed(2)}` : "—"}
                  </td>
                  <td className="mono text-emerald-400">
                    {parseFloat(e.creditAmount) > 0 ? `$${parseFloat(e.creditAmount).toFixed(2)}` : "—"}
                  </td>
                  <td className="mono font-bold" style={{ textAlign: "right" }}>
                    ${parseFloat(e.runningBalance).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEntries.length === 0 && (
            <Empty>No subledger transactions recorded for the selected period.</Empty>
          )}
        </div>
      )}
    </Card>
  );
}
