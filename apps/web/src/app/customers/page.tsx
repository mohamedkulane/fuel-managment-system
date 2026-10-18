"use client";
import { ActionButton, FormLabel, ActionLink } from "../../components/controls";
import { ChevronDown, Users, Archive, RotateCcw, AlertTriangle } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PaginatedResponse } from "../../lib/api";
import { decimal, formatStatus } from "../../lib/format";
import { LoadingState, Badge, Card, CardHead, Empty, ErrorState, Modal, PageHeader, Pagination, SubmitButton } from "../../components/ui";
import { notifyError, notifySuccess } from "../../lib/toast";

type Customer = {
  id: string;
  code: string;
  name: string;
  primaryPhone: string | null;
  status: string;
  notes: string | null;
  outstandingDebt: string;
  archivedAt: string | null;
  archiveReason: string | null;
  addresses: Array<{ id: string; label: string; addressText: string; district: string | null; city: string | null }>;
};

export default function CustomersPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const statusFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setShowModal(true);
  }, []);

  useEffect(() => {
    if (!statusOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!statusFilterRef.current?.contains(event.target as Node)) setStatusOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStatusOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [statusOpen]);

  const queryParams = new URLSearchParams({ page: String(page), limit: "15" });
  if (search.trim()) queryParams.set("search", search.trim());
  if (activeTab === "ARCHIVED") {
    queryParams.set("status", "INACTIVE");
  } else if (status) {
    queryParams.set("status", status);
  } else {
    // When ACTIVE tab is selected without specific status filter, show ACTIVE & HOLD
    queryParams.set("activeOnly", "true");
  }

  const query = useQuery({
    queryKey: ["customers", search, status, activeTab, page],
    queryFn: () => api<PaginatedResponse<Customer> | Customer[]>(`/customers?${queryParams.toString()}`)
  });

  const create = useMutation({
    mutationFn: (body: object) => api<Customer>("/customers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setShowModal(false);
      await client.invalidateQueries({ queryKey: ["customers"] });
      notifySuccess("Macmiilka si guul leh ayaa loo diiwaangeliyay");
    },
    onError: (error) => notifyError(error, "Macmiilka lama kaydin karin")
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<Customer>(`/customers/${id}/archive`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: async () => {
      setArchiveTarget(null);
      setArchiveReason("");
      await client.invalidateQueries({ queryKey: ["customers"] });
      notifySuccess("Macmiilka waa la kaydiyay");
    },
    onError: (error) => notifyError(error, "Kaydinta macmiilka way fashilantay")
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api<Customer>(`/customers/${id}/restore`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["customers"] });
      notifySuccess("Macmiilka waa la soo celiyay");
    },
    onError: (error) => notifyError(error, "Soo celinta macmiilka way fashilantay")
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
  const items: Customer[] = Array.isArray(rawData) ? rawData : rawData?.items ?? [];
  const totalPages = Array.isArray(rawData) ? 1 : rawData?.totalPages ?? 1;

  const statusOptions = [
    { value: "", label: "Dhammaan Xaaladaha" },
    { value: "ACTIVE", label: "Firfircoon" },
    { value: "HOLD", label: "La Hakiyay" }
  ];
  const selectedStatus = statusOptions.find((option) => option.value === status)?.label ?? "Xaaladaha";

  return (
    <main className="page customers-page">
      <PageHeader
        eyebrow="Macaamiisha ganacsiga"
        title="Macaamiisha"
        description="Macmiil kasta, xiriirka iyo ciwaanka gaarsiinta oo hal meel ku wada jira."
        actions={
          <ActionButton className="btn primary" onClick={() => setShowModal(true)}>
            Ku dar Macmiil Cusub
          </ActionButton>
        }
      />



      {/* Modal: New Customer */}
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
            <details className="simple-disclosure field full">
              <summary>Faahfaahin dheeraad ah</summary>
              <div className="field">
                <FormLabel htmlFor="notes">Xusuus-qor hawgalka</FormLabel>
                <input id="notes" className="input" name="notes" placeholder="tusaale: Wuxuu doorbidaa gaarsiinta subaxda" />
              </div>
            </details>
          </div>
          {create.isError && (
            <div className="notice warn" role="alert" style={{ marginTop: 16 }}>
              {(create.error as Error).message}
            </div>
          )}
          <div className="form-actions">
            <ActionButton type="button" className="btn" onClick={() => setShowModal(false)}>
              Ka Noqo
            </ActionButton>
            <SubmitButton busy={create.isPending}>Kaydi Macmiilka</SubmitButton>
          </div>
        </form>
      </Modal>

      {/* Modal: Archive Customer */}
      <Modal
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        title={`Kaydi Macmiilka: ${archiveTarget?.name ?? ""}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (archiveTarget) {
              archiveMutation.mutate({ id: archiveTarget.id, reason: archiveReason });
            }
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-700 dark:text-amber-400">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle size={16} /> Ma hubtaa inaad kaydiso macmiilkan?
            </p>
            <p className="text-xs mt-1">
              Macmiilka lagama saari doono xisaabaadka hore, rasiidhadiisa iyo daymihiisu way sideedooda ahaanayaan, balse kuma soo bixi doono dalabyada cusub.
            </p>
            {archiveTarget && Number(archiveTarget.outstandingDebt) > 0 && (
              <p className="text-xs font-bold mt-1 text-red-600 dark:text-red-400">
                Fiiro gaar ah: Macmiilkan waxaa ku maqan deyn dhan ${decimal(archiveTarget.outstandingDebt)}.
              </p>
            )}
          </div>

          <div className="field">
            <FormLabel htmlFor="archive-customer-reason">Sababta loo kaydinayo (Waa qasab)</FormLabel>
            <textarea
              id="archive-customer-reason"
              className="input w-full min-h-[80px]"
              placeholder="Tusaale: Ganacsigii wuu xiray ama shaqadii ayaa joogsatay"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              required
            />
          </div>

          {archiveMutation.isError && <ErrorState message={archiveMutation.error.message} />}

          <div className="form-actions flex justify-end gap-2 pt-2">
            <ActionButton className="btn" type="button" onClick={() => setArchiveTarget(null)}>
              Ka noqo
            </ActionButton>
            <SubmitButton busy={archiveMutation.isPending} className="btn warn">
              Xaqiiji Kaydinta
            </SubmitButton>
          </div>
        </form>
      </Modal>

      <Card>
        <CardHead
          title={activeTab === "ACTIVE" ? "Macaamiisha Firfircoon" : "Macaamiisha La Kaydiyay"}
          description="Ka raadi magaca macmiilka, koodhka, ama telefoonka"
          action={
            <div className="tabs" style={{ margin: 0 }}>
              <button
                type="button"
                className={`tab ${activeTab === "ACTIVE" ? "active" : ""}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => {
                  setActiveTab("ACTIVE");
                  setStatus("");
                  setPage(1);
                }}
              >
                <Users size={14} aria-hidden="true" />
                Firfircoon
              </button>
              <button
                type="button"
                className={`tab ${activeTab === "ARCHIVED" ? "active" : ""}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => {
                  setActiveTab("ARCHIVED");
                  setStatus("");
                  setPage(1);
                }}
              >
                <Archive size={14} aria-hidden="true" />
                La Kaydiyay
              </button>
            </div>
          }
        />
        <div className="toolbar customers-toolbar">
          <div className="customer-filters">
            <input
              className="input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Ka raadi magaca, koodhka ama telefoonka…"
              aria-label="Raadi macaamiisha"
              style={{ width: "100%" }}
            />
            {activeTab === "ACTIVE" && (
              <div className="customer-status-filter" ref={statusFilterRef}>
                <button
                  type="button"
                  className="select customer-status-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={statusOpen}
                  aria-controls="customer-status-options"
                  onClick={() => setStatusOpen((open) => !open)}
                >
                  <span>{selectedStatus}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                {statusOpen && (
                  <div id="customer-status-options" className="customer-status-options" role="listbox" aria-label="Xaaladda macmiilka">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={status === option.value}
                        className="customer-status-option"
                        onClick={() => {
                          setStatus(option.value);
                          setPage(1);
                          setStatusOpen(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message={(query.error as Error).message} retry={() => void query.refetch()} />
        ) : (
          <div className="table-wrap">
            <table className="data-table responsive-table">
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
                    <td data-label="Macmiilka">
                      <span className="strong">{row.name}</span>
                      <br />
                      <small className="mono">{row.code}</small>
                      {row.status === "INACTIVE" && (
                        <Badge tone="neutral">La Kaydiyay</Badge>
                      )}
                    </td>
                    <td data-label="Telefoonka">{row.primaryPhone ?? "—"}</td>
                    <td data-label="Goobta">{row.addresses[0]?.addressText ?? "—"}</td>
                    <td data-label="Deynta hadda" className="strong">
                      ${decimal(row.outstandingDebt)}
                      {row.status === "HOLD" && <small className="text-muted"> · La hakiyay</small>}
                    </td>
                    <td data-label="" style={{ textAlign: "right" }}>
                      <div className="flex justify-end items-center gap-2">
                        <ActionLink className="btn" href={`/customers/${row.id}`}>
                          Eeg Warbixinta
                        </ActionLink>
                        {row.status !== "INACTIVE" ? (
                          <ActionButton
                            className="btn secondary"
                            type="button"
                            title="Kaydi Macmiilka"
                            onClick={() => setArchiveTarget(row)}
                          >
                            Kaydi
                          </ActionButton>
                        ) : (
                          <ActionButton
                            className="btn primary"
                            type="button"
                            title="Soo celi Macmiilka"
                            disabled={restoreMutation.isPending}
                            onClick={() => restoreMutation.mutate(row.id)}
                          >
                            Soo celi
                          </ActionButton>
                        )}
                      </div>
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
