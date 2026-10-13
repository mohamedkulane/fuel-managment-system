"use client";
import { ActionButton, FormLabel, ActionLink } from "../../components/controls";
import { Users, ClipboardList, CircleCheck, Clock3 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PaginatedResponse } from "../../lib/api";
import { decimal, formatStatus } from "../../lib/format";
import { MetricCard, LoadingState, Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, Pagination, SubmitButton } from "../../components/ui";
import { notifyError, notifySuccess } from "../../lib/toast";

type Customer = {
  id: string;
  code: string;
  name: string;
  primaryPhone: string | null;
  status: string;
  notes: string | null;
  outstandingDebt: string;
  addresses: Array<{ id: string; label: string; addressText: string; district: string | null; city: string | null }>;
};

export default function CustomersPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("new") === "1") setShowModal(true); }, []);

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
      notifySuccess("Customer added");
    },
    onError: error => notifyError(error, "Customer not saved")
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
        actions={<ActionButton className="btn primary" onClick={() => setShowModal(true)}>Kudhi Macmiil Cusub</ActionButton>}
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Diiwaangeli Macmiil Cusub">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <FormLabel htmlFor="name">Magaca macmiilka*</FormLabel>
              <input id="name" className="input" name="name" required placeholder="tusaale: Shirkadda Xassan Trading" />
            </div>
            <div className="field">
              <FormLabel htmlFor="phone">Telefoonka koowaad</FormLabel>
              <input id="phone" className="input" name="phone" placeholder="+252 61 XXX XXXX" />
            </div>
            <div className="field full">
              <FormLabel htmlFor="address">Ciwaanka gaarsiinta</FormLabel>
              <input id="address" className="input" name="address" placeholder="Bakhaarka Weyn, Degmada Hodan" />
            </div>
            <details className="simple-disclosure field full"><summary>Faahfaahin dheeraad ah (More details)</summary><div className="field">
              <FormLabel htmlFor="notes">Xusuus-qoor hawgalka</FormLabel>
              <input id="notes" className="input" name="notes" placeholder="tusaale: Wuxuu doorbidaa gaarsiinta subaxda" />
            </div></details>
          </div>
          {create.isError && <div className="notice warn" role="alert" style={{ marginTop: 16 }}>{(create.error as Error).message}</div>}
          <div className="form-actions">
            <ActionButton type="button" className="btn" onClick={() => setShowModal(false)}>Ka Noqo</ActionButton>
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
                  <th>Goobta</th>
                  <th>Deynta hadda</th>
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
                    <td className="strong">${decimal(row.outstandingDebt)}{row.status === "HOLD" && <small className="text-muted"> · La hakiyay</small>}</td>
                    <td style={{ textAlign: "right" }}>
                      <ActionLink className="btn" href={`/customers/${row.id}`}>Eeg Warbixinta</ActionLink>
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


