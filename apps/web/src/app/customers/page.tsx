"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PaginatedResponse } from "../../lib/api";
import { Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, Pagination, SubmitButton } from "../../components/ui";

type Customer = {
  id: string;
  code: string;
  name: string;
  primaryPhone: string | null;
  status: string;
  notes: string | null;
  addresses: Array<{ id: string; label: string; addressText: string; district: string | null; city: string | null }>;
};

export default function CustomersPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const queryParams = new URLSearchParams({ page: String(page), limit: "15" });
  if (search.trim()) queryParams.set("search", search.trim());
  if (status) queryParams.set("status", status);

  const query = useQuery({
    queryKey: ["customers", search, status, page],
    queryFn: () => api<PaginatedResponse<Customer> | Customer[]>(`/customers?${queryParams.toString()}`)
  });

  const create = useMutation({
    mutationFn: (body: object) => api<Customer>("/customers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setShowModal(false);
      await client.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    create.mutate({
      name: d.get("name"),
      primaryPhone: d.get("phone"),
      address: d.get("address"),
      district: d.get("district"),
      city: d.get("city"),
      notes: d.get("notes")
    });
  }

  const rawData = query.data;
  const items: Customer[] = Array.isArray(rawData) ? rawData : (rawData?.items ?? []);
  const totalPages = Array.isArray(rawData) ? 1 : (rawData?.totalPages ?? 1);

  return (
    <main className="page">
      <PageHeader
        eyebrow="Customer relationships"
        title="Customer directory"
        description="Operational contacts and delivery addresses. Customer debt balance is billing-managed."
        actions={<button className="btn primary" onClick={() => setShowModal(true)}>Add customer</button>}
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Operational Customer">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Customer name *</label>
              <input className="input" name="name" required placeholder="e.g. Hassan Trading Co." />
            </div>
            <div className="field">
              <label>Primary phone</label>
              <input className="input" name="phone" placeholder="+252 61 XXX XXXX" />
            </div>
            <div className="field full">
              <label>Delivery address</label>
              <input className="input" name="address" placeholder="Main Warehouse, Hodan District" />
            </div>
            <div className="field">
              <label>District</label>
              <input className="input" name="district" placeholder="Hodan" />
            </div>
            <div className="field">
              <label>City</label>
              <input className="input" name="city" placeholder="Mogadishu" />
            </div>
            <div className="field full">
              <label>Operational notes</label>
              <input className="input" name="notes" placeholder="e.g. Preferred delivery in morning" />
            </div>
          </div>
          {create.isError && <div className="notice warn" role="alert" style={{ marginTop: 16 }}>{(create.error as Error).message}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
            <SubmitButton busy={create.isPending}>Save Customer</SubmitButton>
          </div>
        </form>
      </Modal>

      <Card>
        <CardHead title="All Customers" description="Search by customer name, code, or phone" />
        <div className="toolbar">
          <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "260px" }}>
            <input
              className="input"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search customers by name, code or phone…"
              aria-label="Search customers"
              style={{ width: "100%" }}
            />
            <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="HOLD">Account Hold</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {query.isError ? (
          <ErrorState message={(query.error as Error).message} retry={() => void query.refetch()} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Primary Delivery Address</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="strong">{row.name}</span>
                      <br />
                      <small className="mono">{row.code}</small>
                    </td>
                    <td>{row.primaryPhone ?? "—"}</td>
                    <td>{row.addresses[0]?.addressText ?? "—"}</td>
                    <td>
                      <Badge tone={row.status === "ACTIVE" ? "ok" : row.status === "HOLD" ? "warn" : "neutral"}>
                        {row.status}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="btn" href={`/customers/${row.id}`}>View Profile</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <Empty>No customers found matching search filter.</Empty>}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </main>
  );
}

