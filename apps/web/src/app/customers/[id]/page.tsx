"use client";
import Decimal from "decimal.js";
import { Receipt, Wallet, CircleCheck, TrendingUp } from "lucide-react";
import { sum, dateTime, decimal, formatStatus, formatFuel } from "../../../lib/format";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, apiBase, type PaginatedResponse } from "../../../lib/api";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, Pagination, SubmitButton } from "../../../components/ui";

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
      <main className="page detail-page">
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
            <h1 style={{ fontSize: 24, margin: 0, fontWeight: "bold" }}>SYSTEMKA JUMLADLAHA SHIDAALKA EE FUELDESK</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#555" }}>Warbixinta Xisaabta Ganacsiga & Maaliyadda ee Macmiilka</p>
          </div>
          <div style={{ textAlign: "right", fontSize: 12 }}>
            <div><strong>Taariikhda Warbixinta:</strong> {new Date().toISOString().slice(0, 10)}</div>
            <div><strong>Waqtiga Muqdisho (UTC+3)</strong></div>
          </div>
        </div>
      </div>

      {/* Top Header */}
      <PageHeader
        eyebrow="Macaamiisha ganacsiga"
        title="Koontada macmiilka"
        description={
          cust
            ? `Koodhka Macmiilka: ${cust.code} · Telefoonka Koowaad: ${cust.primaryPhone ?? "Lama helin"} · Diiwaangelinta: ${
                cust.createdAt ? cust.createdAt.slice(0, 10) : "Diiwaanka Systemka"
              }`
            : ""
        }
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              className="btn"
              href={`${apiBase}/customers/${id}/statement/pdf`}
              target="_blank"
              rel="noreferrer"
              title="Soo dejiso warbixinta rasmiga ah ee PDF"
            >
              Soo Dejiso PDF Warbixinta
            </a>
            <button className="btn" onClick={() => window.print()} title="Daabac warbixinta maaliyadda">
              Daabac Warbixinta
            </button>
            {cust && (
              <button className="btn primary" onClick={() => setShowEdit(true)}>
                Wax Ka Beddel Macmiilka
              </button>
            )}
            <Link className="btn" href="/customers">
              ← Dib u laab Diiwaanka
            </Link>
          </div>
        }
      />

      {cust && (
        <>
          {/* Edit Customer Modal */}
          <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Wax Ka Beddel Xogta Macmiilka">
            <form onSubmit={handleEditSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="name">Magaca macmiilka *</label>
                  <input id="name" className="input" name="name" defaultValue={cust.name} required />
                </div>
                <div className="field">
                  <label htmlFor="phone">Telefoonka koowaad</label>
                  <input id="phone" className="input" name="phone" defaultValue={cust.primaryPhone ?? ""} />
                </div>
                <div className="field">
                  <label htmlFor="status">Xaaladda koontada</label>
                  <select id="status" className="select" name="status" defaultValue={cust.status}>
                    <option value="ACTIVE">Firfircoon (Ganacsi Kawaad)</option>
                    <option value="HOLD">La Hakiyay (Hakinta Dalabyada Deynta)</option>
                    <option value="INACTIVE">Aan Firfircoonayn</option>
                  </select>
                </div>
                <div className="field full">
                  <label htmlFor="address">Ciwaanka gaarsiinta koowaad</label>
                  <input id="address" className="input" name="address" defaultValue={cust.addresses[0]?.addressText ?? ""} />
                </div>
                <div className="field full">
                  <label htmlFor="notes">Xusuus-qoor hawgalka</label>
                  <input id="notes" className="input" name="notes" defaultValue={cust.notes ?? ""} />
                </div>
              </div>
              {updateCustomer.isError && (
                <div className="notice warn" role="alert" style={{ marginTop: 16 }}>
                  {(updateCustomer.error as Error).message}
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowEdit(false)}>
                  Ka Noqo
                </button>
                <SubmitButton busy={updateCustomer.isPending}>Kaydi Beddelka</SubmitButton>
              </div>
            </form>
          </Modal>

          <Card className="profile-identity"><div className="avatar">{cust.name.split(" ").slice(0,2).map(n => n[0]).join("")}</div><div><h2>{cust.name}</h2><p>{cust.code} · {cust.primaryPhone ?? "Telefoon ma jiro"} · <Badge tone={cust.status === "ACTIVE" ? "ok" : "warn"}>{formatStatus(cust.status)}</Badge></p></div><div className="actions"><button className="btn" onClick={() => setShowEdit(true)}>Wax ka beddel macmiilka</button><Link className="btn primary" href="/orders/new">Dalab cusub</Link></div></Card>
          {financialQuery.isError ? <ErrorState message={financialQuery.error.message} retry={() => void financialQuery.refetch()} /> : financialQuery.isLoading ? <LoadingState label="Raraya xisaabta macmiilka…" /> : <div className="grid profile-metrics">
            <MetricCard label="Wadarta biilasha lagu jaray" value={`$${decimal(fin?.totalInvoiced)}`} note="Biilasha la diiwaangeliyay" icon={Receipt} />
            <MetricCard label="Wadarta la helay" value={`$${decimal(fin?.totalPaid)}`} note="Lacagaha la diiwaangeliyay" icon={Wallet} />
            <MetricCard label="Deynta harsan" value={`$${decimal(fin?.outstandingDebt)}`} note="Biilasha furan ee aan la bixin" icon={TrendingUp} dark />
            <MetricCard label="Kireeditka aan la isticmaalin" value={`$${decimal(fin?.unappliedCredit)}`} note="Weli lacag la qaban" icon={CircleCheck} />
            <MetricCard label="Xaaladda koontada ee netka ah" value={`$${decimal(fin?.netPosition)}`} note="Deynta ka dib kireeditka" icon={Wallet} />
          </div>}
          <nav className="tabs-header no-print" aria-label="Seefaha koontada macmiilka">
            {([
              { id: "overview", label: "Guudmar" },
              { id: "orders", label: "Dalabyada & Gaarsiinta" },
              { id: "invoices", label: "Biilasha & Deynta" },
              { id: "payments", label: "Lacag-bixinnada" },
              { id: "ledger", label: "Diiwaanka Xisaabta" }
            ] as const).map(tab => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
          </nav>

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
          <CardHead title="Xogta koontada" description="Xiriirka iyo ciwaanka gaarsiinta" />
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <small className="muted" style={{ display: "block", fontSize: 12 }}>Magaca Macmiilka</small>
                <strong>{customer.name}</strong>
              </div>
              <div>
                <small className="muted" style={{ display: "block", fontSize: 12 }}>Koodhka Macmiilka</small>
                <span className="mono strong">{customer.code}</span>
              </div>
              <div>
                <small className="muted" style={{ display: "block", fontSize: 12 }}>Xaaladda Koontada</small>
                <Badge tone={customer.status === "ACTIVE" ? "ok" : customer.status === "HOLD" ? "warn" : "neutral"}>
                  {formatStatus(customer.status)}
                </Badge>
              </div>
              <div>
                <small className="muted" style={{ display: "block", fontSize: 12 }}>Telefoonka Koowaad</small>
                <span>{customer.primaryPhone ?? "—"}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <small className="muted" style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Ciwaannada Gaarsiinta ee Diiwaangashan</small>
              {customer.addresses.length === 0 ? (
                <span className="muted">Weli ma jiraan ciwaanno gaarsiinta oo la kaydiyay.</span>
              ) : (
                customer.addresses.map((addr) => (
                  <div key={addr.id} style={{ marginBottom: 8, fontSize: 13 }}>
                    <b>{addr.label}:</b> {addr.addressText} {addr.district ? `(${addr.district}, ${addr.city ?? ""})` : ""}
                  </div>
                ))
              )}
            </div>

            {customer.notes && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <small className="muted" style={{ display: "block", fontSize: 12 }}>Xusuus-qoor Hawgalka</small>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, lineHeight: 1.4 }}>{customer.notes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Commercial Balance Breakdown */}
        <Card>
          <CardHead title="Xaaladda maaliyadda" description="Xisaabta deynta iyo kireeditka" />
          <div className="card-body">
            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  <tr>
                    <td>Wadarta Dakhliga Biilasha</td>
                    <td className="mono strong" style={{ textAlign: "right" }}>${decimal(fin?.totalInvoiced ?? "0", 2)}</td>
                  </tr>
                  <tr>
                    <td>Wadarta Lacagaha La Ururiyay</td>
                    <td className="mono strong text-emerald-400" style={{ textAlign: "right" }}>${decimal(fin?.totalPaid ?? "0", 2)}</td>
                  </tr>
                  <tr>
                    <td>Deynta Biilasha Furan ee Harsan</td>
                    <td className="mono strong" style={{ textAlign: "right", color: "var(--red)" }}>${decimal(fin?.outstandingDebt ?? "0", 2)}</td>
                  </tr>
                  <tr>
                    <td>Lacagaha Deposit-ka/Kireeditka Aan La Isticmaalin</td>
                    <td className="mono strong" style={{ textAlign: "right", color: "var(--amber)" }}>${decimal(fin?.unappliedCredit ?? "0", 2)}</td>
                  </tr>
                  <tr style={{ borderTop: "2px solid var(--line)", fontWeight: "bold" }}>
                    <td>Wadarta Netka ee Koontada</td>
                    <td className="mono strong" style={{ textAlign: "right", fontSize: 16 }}>${decimal(fin?.netPosition ?? "0", 2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Orders Overview */}
      <Card>
        <CardHead title="Guudmarada Dalabyadii Ugu Dambeeyay" description="5-tii dalab ee ugu dambeeyay ee macmiilka" />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dalabka #</th>
                <th>Taariikhda</th>
                <th>Shidaalka & Tirada Fuustooyinka</th>
                <th>Xaaladda</th>
                <th style={{ textAlign: "right" }}>Hawgalka</th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.slice(0, 5).map((ord) => (
                <tr key={ord.id}>
                  <td className="mono strong">
                    <Link href={`/orders/${ord.id}`}>{ord.orderNo}</Link>
                  </td>
                  <td>{ord.orderDate.slice(0, 10)}</td>
                  <td>{ord.lines.map((l) => `${formatFuel(l.fuel.displayName)}: ${l.requestedUnits} Fuusto`).join(", ")}</td>
                  <td>
                    <Badge tone={ord.status === "FULFILLED" ? "ok" : ord.status === "DRAFT" ? "neutral" : "info"}>
                      {formatStatus(ord.status)}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/orders/${ord.id}`}>Eeg Faahfaahinta</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customer.orders.length === 0 && <Empty>Weli wax dalab ah lagama diiwaangelin macmiilkan.</Empty>}
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
                    <Link href={`/orders/${row.id}`} className="mono strong">
                      {row.orderNo}
                    </Link>
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
                    <Link className="btn small" href={`/orders/${row.id}`}>Faahfaahinta Dalabka</Link>
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
      <CardHead title="Biilasha Macmiilka & Deynta Ganacsiga" description="Jarista biilka ee ku batay shidaalka la aqbalay ee la gaarsiiyay" />

      <div className="toolbar" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          className="input"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Ka raadi lambarka biilka..."
          style={{ flex: 1, minWidth: 200 }}
        />
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Dhammaan Xaaladaha Biilasha</option>
          <option value="UNPAID">Lama Bixin</option>
          <option value="PARTIALLY_PAID">Qayb Ayaa Laga Bixiyay</option>
          <option value="PAID">La Bixiyay</option>
          <option value="CANCELLED">La Baajiyay</option>
          <option value="REVERSED">Laga Noqday</option>
        </select>
      </div>

      {invoicesQuery.isLoading ? <LoadingState /> : invoicesQuery.isError ? (
        <ErrorState message={(invoicesQuery.error as Error).message} retry={() => void invoicesQuery.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Biilka #</th>
                <th>Taariikhda Bixinta</th>
                <th>Taariikhda Harsan</th>
                <th>Xaaladda</th>
                <th>Wadarta Biilka</th>
                <th>Lacagta La Bixiyay</th>
                <th>Deynta Harsan</th>
                <th style={{ textAlign: "right" }}>Hawgallada</th>
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
                      {formatStatus(inv.status)}
                    </Badge>
                  </td>
                  <td className="mono font-bold">${decimal(inv.totalAmount, 2)}</td>
                  <td className="mono text-emerald-400">${decimal(inv.paidAmount, 2)}</td>
                  <td className="mono font-bold" style={{ color: new Decimal(inv.balanceDue).gt(0) ? "var(--red)" : "inherit" }}>
                    ${decimal(inv.balanceDue, 2)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="btn small" href={`/invoices/${inv.id}`}>Eeg Biilka</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <Empty>Ma jiraan biilal ganacsi oo loo helay macmiilkan.</Empty>}
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
                    <Link href={`/payments/${p.id}`} className="mono strong">
                      {p.paymentNo}
                    </Link>
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
                    <Link className="btn small" href={`/payments/${p.id}`}>Faahfaahinta Rasiidhka</Link>
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

  const openingBalance = fullEntries.length ? new Decimal(fullEntries[0]!.runningBalance).minus(fullEntries[0]!.debitAmount).plus(fullEntries[0]!.creditAmount) : null;
  const closingBalance = fullEntries.length ? new Decimal(fullEntries[fullEntries.length - 1]!.runningBalance) : null;

  const totalPeriodDebits = new Decimal(sum(filteredEntries.map(e => e.debitAmount)));
  const totalPeriodCredits = new Decimal(sum(filteredEntries.map(e => e.creditAmount)));

  return (
    <Card className="ledger-document">
      <CardHead
        title={`Diiwaanka Xisaabta ee Taariikhda ah — ${customerName}`}
        description="Diiwaanka rasmiga ah ee maaliyadda. Deynta (Debit +); Lacag-bixinta (Credit -)."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn small" onClick={() => window.print()}>
              Daabac
            </button>
            <a
              className="btn small primary"
              href={`${apiBase}/customers/${customerId}/statement/pdf?fromDate=${fromDate}&toDate=${toDate}`}
              target="_blank"
              rel="noreferrer"
            >
              Soo Dejiso PDF
            </a>
          </div>
        }
      />

      {/* Date Range & Type Filter Toolbar */}
      <div className="toolbar no-print" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Ka soo bilaabato (Muqdisho UTC+3):</label>
          <input
            type="date"
            className="input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Ku dhamaato:</label>
          <input
            type="date"
            className="input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Shaandhaynta Nooca Diiwaanka:</label>
          <select className="select" value={entryTypeFilter} onChange={(e) => setEntryTypeFilter(e.target.value)}>
            <option value="">Dhammaan Hawgallada</option>
            <option value="INVOICE">Biilasha (Deynta +)</option>
            <option value="PAYMENT">Lacag-bixinnada (Kireeditka -)</option>
            <option value="REVERSAL">Laga Noqday</option>
            <option value="ADJUSTMENT">Wax Ka Beddelka</option>
          </select>
        </div>
      </div>

      {/* Period Balance Summary Banner */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 12, background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: 8 }}>
          <small className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Baalansiga Ugu Horreeya Xilliga</small>
          <div className="mono strong" style={{ fontSize: 16 }}>${openingBalance?.toFixed(2) ?? "—"}</div>
        </div>
        <div style={{ padding: 12, background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: 8 }}>
          <small className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Wadarta Deynta Xilliga (+)</small>
          <div className="mono strong" style={{ fontSize: 16, color: "var(--red)" }}>+${totalPeriodDebits.toFixed(2)}</div>
        </div>
        <div style={{ padding: 12, background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: 8 }}>
          <small className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Wadarta Lacag-bixinta Xilliga (-)</small>
          <div className="mono strong text-emerald-400" style={{ fontSize: 16 }}>-${totalPeriodCredits.toFixed(2)}</div>
        </div>
        <div style={{ padding: 12, background: "var(--lime-pale)", border: "1px solid var(--line)", borderRadius: 8 }}>
          <small className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Baalansiga Ugu Dambeeya Xilliga</small>
          <div className="mono strong" style={{ fontSize: 16, color: "var(--petrol)" }}>${closingBalance?.toFixed(2) ?? "—"}</div>
        </div>
      </div>

      {/* Statement Table */}
      {statementQuery.isLoading ? <LoadingState /> : statementQuery.isError ? (
        <ErrorState message={(statementQuery.error as Error).message} retry={() => void statementQuery.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Taariikhda & Waqtiga</th>
                <th>Nooca</th>
                <th>Tixraaca #</th>
                <th>Deynta (+ Debt)</th>
                <th>Kireeditka (- Debt)</th>
                <th style={{ textAlign: "right" }}>Baalansiga Harsan</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e) => (
                <tr key={e.id}>
                  <td>{dateTime(e.occurredAt)}</td>
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
                      {formatStatus(e.entryType)}
                    </Badge>
                  </td>
                  <td className="mono strong">{e.referenceNo}</td>
                  <td className="mono" style={{ color: new Decimal(e.debitAmount).gt(0) ? "var(--red)" : "inherit" }}>
                    {new Decimal(e.debitAmount).gt(0) ? `$${decimal(e.debitAmount, 2)}` : "—"}
                  </td>
                  <td className="mono text-emerald-400">
                    {new Decimal(e.creditAmount).gt(0) ? `$${decimal(e.creditAmount, 2)}` : "—"}
                  </td>
                  <td className="mono font-bold" style={{ textAlign: "right" }}>
                    ${decimal(e.runningBalance, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEntries.length === 0 && (
            <Empty>Ma jiraan hawgallo diiwaanka xisaabta ah oo la diiwaangeliyay xilliga la doortay.</Empty>
          )}
        </div>
      )}
    </Card>
  );
}

