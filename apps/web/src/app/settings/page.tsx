"use client";

import { type FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionButton, ActionLink, FormLabel } from "../../components/controls";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, Modal, PageHeader, SubmitButton } from "../../components/ui";
import { api, type Actor } from "../../lib/api";
import { dateTime, formatRole } from "../../lib/format";
import { notifyError, notifySuccess } from "../../lib/toast";
import { UserPermissionsModal } from "../../components/user-permissions-modal";

type UserRole = "OWNER" | "OFFICE_EMPLOYEE";
type User = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};
type DocumentBranding = { companyName: string; logoUrl: string; footerText: string };
type UpdateUserInput = { id: string; body: { displayName: string; email: string; role: UserRole; password?: string } };

export default function SettingsPage() {
  const client = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const owner = me.data?.role === "OWNER";
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users"), enabled: owner, retry: false });
  const branding = useQuery({ queryKey: ["settings", "document-branding"], queryFn: () => api<DocumentBranding>("/settings/document-branding"), enabled: owner, retry: false });
  const currentUser = users.data?.find((user) => user.id === me.data?.id);

  const createUser = useMutation({
    mutationFn: (body: { displayName: string; email: string; password: string; role: UserRole }) => api<User>("/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setShowCreate(false);
      await client.invalidateQueries({ queryKey: ["users"] });
      notifySuccess("Shaqaalaha si guul leh ayaa loo abuuray");
    },
    onError: (error) => notifyError(error, "Lama abuuri karin shaqaalaha")
  });
  const updateUser = useMutation({
    mutationFn: ({ id, body }: UpdateUserInput) => api<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: async (updated) => {
      setEditing(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["users"] }),
        updated.id === me.data?.id ? client.invalidateQueries({ queryKey: ["me"] }) : Promise.resolve()
      ]);
      notifySuccess("Shaqaalaha waa la cusbooneysiiyey");
    },
    onError: (error) => notifyError(error, "Lama cusbooneysiin karin shaqaalaha")
  });
  const changeStatus = useMutation({
    mutationFn: ({ user, isActive }: { user: User; isActive: boolean }) => isActive
      ? api<User>(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) })
      : api<User>(`/users/${user.id}`, { method: "DELETE" }),
    onSuccess: async (updated) => {
      setDeactivating(null);
      await client.invalidateQueries({ queryKey: ["users"] });
      notifySuccess(updated.isActive ? "Shaqaalaha waa la hawlgeliyey" : "Shaqaalaha waa la joojiyey");
    },
    onError: (error) => notifyError(error, "Lama beddeli karin xaaladda shaqaalaha")
  });
  const saveBranding = useMutation({
    mutationFn: (body: DocumentBranding) => api<DocumentBranding>("/settings/document-branding", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["settings", "document-branding"] });
      notifySuccess("Muuqaalka dukumentiyada waa la keydiyey");
    },
    onError: (error) => notifyError(error, "Lama keydin karin muuqaalka dukumentiyada")
  });

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    createUser.mutate({
      displayName: String(data.get("displayName") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      role: String(data.get("role")) as UserRole
    });
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    updateUser.mutate({
      id: editing.id,
      body: {
        displayName: String(data.get("displayName") ?? ""),
        email: String(data.get("email") ?? ""),
        role: String(data.get("role")) as UserRole,
        ...(password ? { password } : {})
      }
    });
  }

  function submitBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    saveBranding.mutate({
      companyName: String(data.get("companyName") ?? ""),
      logoUrl: String(data.get("logoUrl") ?? ""),
      footerText: String(data.get("footerText") ?? "")
    });
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Maamulka Nidaamka"
        title="Dejinta Nidaamka"
        description=""
        actions={owner && <ActionButton className="btn primary" onClick={() => setShowCreate(true)}>Ku dar Shaqaale</ActionButton>}
      />

      <Card>
        <CardHead title="Akoonkaaga" action={owner && currentUser && <ActionButton className="btn" onClick={() => setEditing(currentUser)}>Wax ka beddel Xogtaada</ActionButton>} />
        <div className="card-body">
          <div className="info-pair"><span>Magac</span><b>{me.data?.displayName}</b></div>
          <div className="info-pair"><span>Iimayl</span><b>{me.data?.email}</b></div>
          <div className="info-pair"><span>Doorka</span><Badge>{formatRole(me.data?.role)}</Badge></div>
        </div>
      </Card>

      {owner && <details className="simple-disclosure"><summary>Diiwaanka Kormeerka (Audit Log)</summary><ActionLink className="btn" href="/audits">Eeg Diiwaanka Kormeerka</ActionLink></details>}

      {owner && (
        <Card>
          <CardHead title="Muuqaalka dukumentiyada" description="Magaca shirkadda, logo-ga iyo footer-ku waxay ka muuqanayaan PDF-yada iyo Excel-ka." />
          {branding.isPending ? <LoadingState /> : branding.isError ? <ErrorState message={branding.error.message} retry={() => void branding.refetch()} /> : (
            <form className="card-body" onSubmit={submitBranding}>
              <div className="form-grid">
                <div className="field">
                  <FormLabel htmlFor="document-company-name">Magaca shirkadda</FormLabel>
                  <input id="document-company-name" name="companyName" className="input" maxLength={120} defaultValue={branding.data?.companyName ?? "FuelDesk"} required />
                </div>
                <div className="field">
                  <FormLabel htmlFor="document-logo-url">Logo URL (HTTPS)</FormLabel>
                  <input id="document-logo-url" name="logoUrl" className="input" type="url" maxLength={2048} defaultValue={branding.data?.logoUrl ?? ""} placeholder="https://example.com/logo.png" />
                  <small className="muted">Isticmaal URL dadweyne oo HTTPS ah; PNG ama JPEG, ugu badnaan 2 MB.</small>
                </div>
                <div className="field full">
                  <FormLabel htmlFor="document-footer">Qoraalka hoose</FormLabel>
                  <textarea id="document-footer" name="footerText" className="textarea" maxLength={500} rows={3} defaultValue={branding.data?.footerText ?? ""} placeholder="Tusaale: Mahadsanid — Kheyre Petroleum" />
                </div>
              </div>
              {saveBranding.isError && <ErrorState message={saveBranding.error.message} />}
              <div className="form-actions"><SubmitButton busy={saveBranding.isPending}>Keydi Muuqaalka Dukumentiyada</SubmitButton></div>
            </form>
          )}
        </Card>
      )}

      {owner && (
        <Card>
          <CardHead title="Shaqaalaha & Ogolaanshada" description="Milkiilaha iyo shaqaalaha xafiiska kaliya ayaa geli kara nidaamka." />
          {users.isPending ? <LoadingState /> : users.isError ? <ErrorState message={users.error.message} retry={() => void users.refetch()} /> : (
            <div className="table-wrap">
              <table className="data-table responsive-table">
                <thead>
                  <tr><th>Magaca Shaqaalaha</th><th>Iimaylka</th><th>Doorka</th><th>Xaaladda Akoonka</th><th>Galitaankii Ugu Dambeeyey</th><th style={{ textAlign: "right" }}>Hawlaha</th></tr>
                </thead>
                <tbody>
                  {users.data?.map((user) => (
                    <tr key={user.id}>
                      <td data-label="Magaca" className="strong">{user.displayName}{user.id === me.data?.id && <small className="muted"> (Adiga)</small>}</td>
                      <td data-label="Iimaylka">{user.email}</td>
                      <td data-label="Doorka"><Badge tone="info">{formatRole(user.role)}</Badge></td>
                      <td data-label="Xaaladda"><Badge tone={user.isActive ? "ok" : "neutral"}>{user.isActive ? "Shaqeynaya" : "Joogsan"}</Badge></td>
                      <td data-label="Galitaankii">{user.lastLoginAt ? dateTime(user.lastLoginAt) : "Weli ma gelin"}</td>
                      <td data-label="">
                        <div className="actions" style={{ justifyContent: "flex-end" }}>
                          <ActionButton className="btn small secondary" onClick={() => setPermissionsUser(user)}>Ogolaanshaha</ActionButton>
                          <ActionButton className="btn small" onClick={() => setEditing(user)}>Wax ka beddel</ActionButton>
                          {user.isActive ? (
                            user.id !== me.data?.id && <ActionButton className="btn small danger" onClick={() => setDeactivating(user)}>Jooji</ActionButton>
                          ) : (
                            <ActionButton className="btn small" disabled={changeStatus.isPending} onClick={() => changeStatus.mutate({ user, isActive: true })}>Hawlgeli</ActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.data?.length === 0 && <Empty>Ma jiraan isticmaalayaal laga helay.</Empty>}
            </div>
          )}
        </Card>
      )}

      <Modal isOpen={showCreate && owner} onClose={() => setShowCreate(false)} title="Ku dar Shaqaale">
        <form onSubmit={submitCreate}>
          <div className="form-grid">
            <div className="field full"><FormLabel htmlFor="create-display-name">Magaca Muuqda *</FormLabel><input id="create-display-name" className="input" name="displayName" maxLength={120} autoComplete="name" required /></div>
            <div className="field full"><FormLabel htmlFor="create-email">Cinwaanka Emaylka *</FormLabel><input id="create-email" className="input" name="email" type="email" autoComplete="email" maxLength={254} required /></div>
            <div className="field">
              <FormLabel htmlFor="create-role">Xilka</FormLabel>
              <select id="create-role" className="select" name="role" defaultValue="OFFICE_EMPLOYEE"><option value="OFFICE_EMPLOYEE">Shaqaale Xafiis</option><option value="OWNER">Milkiile</option></select>
            </div>
            <div className="field"><FormLabel htmlFor="create-password">Furaha Ku-meel-gaarka ah *</FormLabel><input id="create-password" className="input" name="password" type="password" autoComplete="new-password" minLength={12} required /><small className="muted">Ugu yaraan 12 xaraf (Minimum 12 characters)</small></div>
          </div>
          {createUser.isError && <ErrorState message={createUser.error.message} />}
          <div className="form-actions"><ActionButton className="btn" type="button" onClick={() => setShowCreate(false)}>Ka noqo</ActionButton><SubmitButton busy={createUser.isPending}>Abuur Shaqaale</SubmitButton></div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(editing) && owner} onClose={() => setEditing(null)} title={editing?.id === me.data?.id ? "Wax ka beddel Xogta Milkiilaha" : "Wax ka beddel Shaqaalaha"}>
        {editing && (
          <form key={editing.id} onSubmit={submitEdit}>
            <div className="form-grid">
              <div className="field full"><FormLabel htmlFor="edit-display-name">Magaca Muuqda *</FormLabel><input id="edit-display-name" className="input" name="displayName" maxLength={120} defaultValue={editing.displayName} autoComplete="name" required /></div>
              <div className="field full"><FormLabel htmlFor="edit-email">Cinwaanka Emaylka *</FormLabel><input id="edit-email" className="input" name="email" type="email" maxLength={254} defaultValue={editing.email} autoComplete="email" required /></div>
              <div className="field">
                <FormLabel htmlFor="edit-role">Xilka</FormLabel>
                <select id="edit-role" className="select" name="role" defaultValue={editing.role}><option value="OFFICE_EMPLOYEE">Shaqaale Xafiis</option><option value="OWNER">Milkiile</option></select>
              </div>
              <div className="field"><FormLabel htmlFor="edit-password">Furaha cusub</FormLabel><input id="edit-password" className="input" name="password" type="password" autoComplete="new-password" minLength={12} /><small className="muted">Bannaan ka tag haddii aadan doonayn inaad beddesho furaha hadda jira.</small></div>
            </div>
            {updateUser.isError && <ErrorState message={updateUser.error.message} />}
            <div className="form-actions"><ActionButton className="btn" type="button" onClick={() => setEditing(null)}>Ka noqo</ActionButton><SubmitButton busy={updateUser.isPending}>Keydi Isbeddelada</SubmitButton></div>
          </form>
        )}
      </Modal>

      <Modal isOpen={Boolean(deactivating) && owner} onClose={() => setDeactivating(null)} title="Jooji Shaqaalaha">
        {deactivating && (
          <div>
            <p>Ma joojinaysaa <strong>{deactivating.displayName}</strong>? Waa laga saarayaa nidaamka, mana geli karo ilaa dib loo hawlgeliyo.</p>
            {changeStatus.isError && <ErrorState message={changeStatus.error.message} />}
            <div className="form-actions"><ActionButton className="btn" type="button" onClick={() => setDeactivating(null)}>Ka noqo</ActionButton><ActionButton className="btn danger" type="button" disabled={changeStatus.isPending} onClick={() => changeStatus.mutate({ user: deactivating, isActive: false })}>{changeStatus.isPending ? "Waa la joojinayaa…" : "Jooji Shaqaalaha"}</ActionButton></div>
          </div>
        )}
      </Modal>
      <UserPermissionsModal
        isOpen={Boolean(permissionsUser) && owner}
        onClose={() => setPermissionsUser(null)}
        userId={permissionsUser?.id ?? null}
        userName={permissionsUser?.displayName ?? ""}
        userRole={permissionsUser?.role ?? "OFFICE_EMPLOYEE"}
      />
    </main>
  );
}
