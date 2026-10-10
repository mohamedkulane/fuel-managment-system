"use client";
import { Users, ClipboardList, CircleCheck, Clock3 } from "lucide-react";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PaginatedResponse } from "../../lib/api";
import { formatStatus } from "../../lib/format";
import { MetricCard, LoadingState, Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, Pagination, SubmitButton } from "../../components/ui";

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
    <main className="page customers-page">
      <PageHeader
        eyebrow="Macaamiisha ganacsiga"
        title="Macaamiisha"
        description="Macmiil kasta, xiriirka iyo ciwaanka gaarsiinta oo hal meel ku wada jira."
        actions={<button className="btn primary" onClick={() => setShowModal(true)}>Kudhi Macmiil Cusub</button>}
      />

      <div className="grid"><MetricCard label="Macaamiisha ku habboon" value={query.data ? (Array.isArray(query.data) ? query.data.length : query.data.total) : "—"} note="Natiijada raadinta hadda" icon={Users}/><MetricCard label="Firfircoon boggan" value={items.filter(c=>c.status==="ACTIVE").length} note="Koontooyinka dalabka laga qaban karo" icon={CircleCheck}/><MetricCard label="La hakiyay boggan" value={items.filter(c=>c.status==="HOLD").length} note="Xaddidaad uu milkiilaha saaray" icon={Clock3}/><MetricCard label="Bogga diiwaanka" value={page} note={`Bogga ${page} ee ${totalPages}`} icon={ClipboardList}/></div>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Diiwaangeli Macmiil Cusub">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="name">Magaca macmiilka *</label>
              <input id="name" className="input" name="name" required placeholder="tusaale: Shirkadda Xassan Trading" />
            </div>
            <div className="field">
              <label htmlFor="phone">Telefoonka koowaad</label>
              <input id="phone" className="input" name="phone" placeholder="+252 61 XXX XXXX" />
            </div>
            <div className="field full">
              <label htmlFor="address">Ciwaanka gaarsiinta</label>
              <input id="address" className="input" name="address" placeholder="Bakhaarka Weyn, Degmada Hodan" />
            </div>
            <div className="field">
              <label htmlFor="district">Degmada</label>
              <input id="district" className="input" name="district" placeholder="Hodan" />
            </div>
            <div className="field">
              <label htmlFor="city">Magaalada</label>
              <input id="city" className="input" name="city" placeholder="Muqdisho" />
            </div>
            <div className="field full">
              <label htmlFor="notes">Xusuus-qoor hawgalka</label>
              <input id="notes" className="input" name="notes" placeholder="tusaale: Wuxuu doorbidaa gaarsiinta subaxda" />
            </div>
          </div>
          {create.isError && <div className="notice warn" role="alert" style={{ marginTop: 16 }}>{(create.error as Error).message}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setShowModal(false)}>Ka Noqo</button>
            <SubmitButton busy={create.isPending}>Kaydi Macmiilka</SubmitButton>
          </div>
        </form>
      </Modal>

      <Card>
        <CardHead title="Dhammaan Macaamiisha" description="Ka raadi magaca macmiilka, koodhka, ama telefoonka" />
        <div className="toolbar">
          <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "260px" }}>
            <input
              className="input"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Ka raadi magaca, koodhka ama telefoonka…"
              aria-label="Raadi macaamiisha"
              style={{ width: "100%" }}
            />
            <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Dhammaan Xaaladaha</option>
              <option value="ACTIVE">Firfircoon</option>
              <option value="HOLD">La Hakiyay</option>
              <option value="INACTIVE">Aan Firfircoonayn</option>
            </select>
          </div>
        </div>

        {query.isLoading ? <LoadingState /> : query.isError ? (
          <ErrorState message={(query.error as Error).message} retry={() => void query.refetch()} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Macmiilka</th>
                  <th>Telefoonka</th>
                  <th>Ciwaanka Gaarsiinta Koowaad</th>
                  <th>Xaaladda</th>
                  <th style={{ textAlign: "right" }}>Hawgallada</th>
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
                        {formatStatus(row.status)}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="btn" href={`/customers/${row.id}`}>Eeg Warbixinta</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <Empty>Ma jiraan macaamiil u dhigma raadinta.</Empty>}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </main>
  );
}


