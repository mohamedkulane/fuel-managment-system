"use client";
import { ActionButton, FormLabel, ActionLink } from "../../components/controls";
import { FormEvent, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CircleCheck, ShieldCheck, Users } from "lucide-react";
import { api, type Actor } from "../../lib/api";
import { dateTime, formatRole } from "../../lib/format";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, SubmitButton } from "../../components/ui";
import { notifyError, notifySuccess } from "../../lib/toast";

type User = { id: string; displayName: string; email: string; role: "OWNER" | "OFFICE_EMPLOYEE"; isActive: boolean; lastLoginAt: string | null };

export default function SettingsPage() {
  const router = useRouter();
  const client = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users"), enabled: me.data?.role === "OWNER", retry: false });
  const create = useMutation({ mutationFn: (body: object) => api<User>("/users", { method: "POST", body: JSON.stringify(body) }), onSuccess: async () => { setShowCreate(false); await client.invalidateQueries({ queryKey: ["users"] }); notifySuccess("User added"); }, onError: error => notifyError(error, "Could not save user") });
  const logout = useMutation({ mutationFn: () => api("/auth/logout", { method: "POST" }), onSuccess: () => { client.clear(); router.replace("/login"); } });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    create.mutate({ displayName: d.get("displayName"), email: d.get("email"), password: d.get("password"), role: d.get("role") });
  }

  const owner = me.data?.role === "OWNER";

  return (
    <main className="page">
      <PageHeader
        eyebrow="Maamulka Nidaamka"
        title="Dejinta Nidaamka"
        description=""
        actions={
          <>
            <ActionButton className="btn" disabled={logout.isPending} onClick={() => logout.mutate()}>
              Kabax Nidaamka
            </ActionButton>
            {owner && (
              <ActionButton className="btn primary" onClick={() => setShowCreate(true)}>
                Kudar Isticmaale Cusub
              </ActionButton>
            )}
          </>
        }
      />
      {logout.isError && <ErrorState message={logout.error.message} />}
      <Card><CardHead title="Account"/><div className="card-body"><div className="info-pair"><span>Name</span><b>{me.data?.displayName}</b></div><div className="info-pair"><span>Email</span><b>{me.data?.email}</b></div><div className="info-pair"><span>Role</span><Badge>{formatRole(me.data?.role)}</Badge></div></div></Card>
      {owner && <details className="simple-disclosure"><summary>Audit history</summary><ActionLink className="btn" href="/audits">View Audit Log</ActionLink></details>}
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
