"use client";
import { ActionButton, FormLabel, ActionLink } from "../../components/controls";
import { FormEvent, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, ShieldCheck, Users } from "lucide-react";
import { api, type Actor } from "../../lib/api";
import { dateTime, formatRole } from "../../lib/format";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, SubmitButton } from "../../components/ui";
import { notifyError, notifySuccess } from "../../lib/toast";

type User = { id: string; displayName: string; email: string; role: "OWNER" | "OFFICE_EMPLOYEE"; isActive: boolean; lastLoginAt: string | null };
type DocumentBranding = { companyName: string; logoUrl: string; footerText: string };

export default function SettingsPage() {
  const client = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users"), enabled: me.data?.role === "OWNER", retry: false });
  const branding = useQuery({ queryKey: ["settings", "document-branding"], queryFn: () => api<DocumentBranding>("/settings/document-branding"), enabled: me.data?.role === "OWNER", retry: false });
  const create = useMutation({ mutationFn: (body: object) => api<User>("/users", { method: "POST", body: JSON.stringify(body) }), onSuccess: async () => { setShowCreate(false); await client.invalidateQueries({ queryKey: ["users"] }); notifySuccess("User added"); }, onError: error => notifyError(error, "Could not save user") });
  const saveBranding = useMutation({
    mutationFn: (body: DocumentBranding) => api<DocumentBranding>("/settings/document-branding", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["settings", "document-branding"] }); notifySuccess("Document branding saved"); },
    onError: error => notifyError(error, "Could not save document branding")
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    create.mutate({ displayName: d.get("displayName"), email: d.get("email"), password: d.get("password"), role: d.get("role") });
  }

  function submitBranding(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    saveBranding.mutate({
      companyName: String(data.get("companyName") ?? ""),
      logoUrl: String(data.get("logoUrl") ?? ""),
      footerText: String(data.get("footerText") ?? "")
    });
  }

  const owner = me.data?.role === "OWNER";

  return (
    <main className="page">
      <PageHeader
        eyebrow="Maamulka Nidaamka"
        title="Dejinta Nidaamka"
        description=""
        actions={owner && (
          <ActionButton className="btn primary" onClick={() => setShowCreate(true)}>
            Kudar Isticmaale Cusub
          </ActionButton>
        )}
      />
      <Card><CardHead title="Account"/><div className="card-body"><div className="info-pair"><span>Name</span><b>{me.data?.displayName}</b></div><div className="info-pair"><span>Email</span><b>{me.data?.email}</b></div><div className="info-pair"><span>Role</span><Badge>{formatRole(me.data?.role)}</Badge></div></div></Card>
      {owner && <details className="simple-disclosure"><summary>Audit history</summary><ActionLink className="btn" href="/audits">View Audit Log</ActionLink></details>}
      {owner && <Card>
        <CardHead title="Muuqaalka dukumentiyada" description="Magaca shirkadda, logo-ga iyo footer-ku waxay ka muuqanayaan PDF-yada iyo Excel-ka." />
        {branding.isPending ? <LoadingState /> : branding.isError ? <ErrorState message={branding.error.message} retry={() => void branding.refetch()} /> : <form className="card-body" onSubmit={submitBranding}>
          <div className="form-grid">
            <div className="field">
              <FormLabel htmlFor="document-company-name">Magaca shirkadda (Company name)</FormLabel>
              <input id="document-company-name" name="companyName" className="input" maxLength={120} defaultValue={branding.data?.companyName ?? "FuelDesk"} required />
            </div>
            <div className="field">
              <FormLabel htmlFor="document-logo-url">Logo URL (HTTPS)</FormLabel>
              <input id="document-logo-url" name="logoUrl" className="input" type="url" maxLength={2048} defaultValue={branding.data?.logoUrl ?? ""} placeholder="https://example.com/logo.png" />
              <small className="muted">Isticmaal URL dadweyne oo HTTPS ah; PNG ama JPEG, ugu badnaan 2 MB.</small>
            </div>
            <div className="field full">
              <FormLabel htmlFor="document-footer">Qoraalka footer-ka (Footer text)</FormLabel>
              <textarea id="document-footer" name="footerText" className="textarea" maxLength={500} rows={3} defaultValue={branding.data?.footerText ?? ""} placeholder="Tusaale: Mahadsanid — Kheyre Petroleum" />
            </div>
          </div>
          {saveBranding.isError && <ErrorState message={saveBranding.error.message} />}
          <div className="form-actions"><SubmitButton busy={saveBranding.isPending}>Save Document Branding</SubmitButton></div>
        </form>}
      </Card>}
      {owner && (
        <>
          <Card>
            <CardHead title="Shaqaalaha & Ogolaanshada" description="Milkiilaha iyo shaqaalaha xafiiska kaliya ayaa geli kara nidaamka." />
            {users.isLoading ? (
              <LoadingState />
            ) : users.isError ? (
              <ErrorState message={users.error.message} retry={() => void users.refetch()} />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Magaca Shaqaalaha</th>
                      <th>Emaylka</th>
                      <th>Xilka</th>
                      <th>Xaaladda Aakaonka</th>
                      <th>Galitaankii Ugu Dambeeyay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data?.map((row) => (
                      <tr key={row.id}>
                        <td className="strong">{row.displayName}</td>
                        <td>{row.email}</td>
                        <td>
                          <Badge tone="info">{formatRole(row.role)}</Badge>
                        </td>
                        <td>
                          <Badge tone={row.isActive ? "ok" : "neutral"}>
                            {row.isActive ? "Shaqaynaya" : "Aan Shaqaynayn"}
                          </Badge>
                        </td>
                        <td>{row.lastLoginAt ? dateTime(row.lastLoginAt) : "Wali Ma Soo Galin"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.data?.length === 0 && <Empty>Ma jiraan isticmaalayaal laga helay.</Empty>}
              </div>
            )}
          </Card>
        </>
      )}

      <Modal isOpen={showCreate && owner} onClose={() => setShowCreate(false)} title="Kudar Isticmaale Cusub">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field full">
              <FormLabel htmlFor="displayName">Magaca Muuqda *</FormLabel>
              <input id="displayName" className="input" name="displayName" required />
            </div>
            <div className="field full">
              <FormLabel htmlFor="email">Cinwaanka Emaylka *</FormLabel>
              <input id="email" className="input" name="email" type="email" required />
            </div>
            <div className="field">
              <FormLabel htmlFor="role">Xilka</FormLabel>
              <select id="role" className="select" name="role">
                <option value="OFFICE_EMPLOYEE">Shaqaale Xafiis (Office Employee)</option>
                <option value="OWNER">Milkiile (Owner)</option>
              </select>
            </div>
            <div className="field">
              <FormLabel htmlFor="password">Furaha Ku-meel-gaarka ah *</FormLabel>
              <input id="password" className="input" name="password" type="password" autoComplete="new-password" minLength={12} required />
              <small className="muted">Ugu yaraan 12 xaraf</small>
            </div>
          </div>
          {create.isError && <ErrorState message={create.error.message} />}
          <div className="form-actions">
            <ActionButton className="btn" type="button" onClick={() => setShowCreate(false)}>
              Ka Noqo
            </ActionButton>
            <SubmitButton busy={create.isPending}>Samee Isticmaale</SubmitButton>
          </div>
        </form>
      </Modal>
    </main>
  );
}
