"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CircleCheck, ShieldCheck, Users } from "lucide-react";
import { api, type Actor } from "../../lib/api";
import { dateTime, formatRole } from "../../lib/format";
import { Badge, Card, CardHead, Empty, ErrorState, LoadingState, MetricCard, Modal, PageHeader, SubmitButton } from "../../components/ui";

type User = { id: string; displayName: string; email: string; role: "OWNER" | "OFFICE_EMPLOYEE"; isActive: boolean; lastLoginAt: string | null };

export default function SettingsPage() {
  const router = useRouter();
  const client = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me") });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users"), enabled: me.data?.role === "OWNER", retry: false });
  const create = useMutation({ mutationFn: (body: object) => api<User>("/users", { method: "POST", body: JSON.stringify(body) }), onSuccess: async () => { setShowCreate(false); await client.invalidateQueries({ queryKey: ["users"] }); } });
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
        description="Maamul isticmaalayaasha nidaamka iyo habaynta ganacsiga shidaalka."
        actions={
          <>
            <button className="btn" disabled={logout.isPending} onClick={() => logout.mutate()}>
              Kabax Nidaamka
            </button>
            {owner && (
              <button className="btn primary" onClick={() => setShowCreate(true)}>
                Kudar Isticmaale Cusub
              </button>
            )}
          </>
        }
      />
      {logout.isError && <ErrorState message={logout.error.message} />}

      <div className="two-col">
        <Card>
          <CardHead title="Aakaonkaaga" description="Xogta isticmaalaha nidaamka ka isticmaalaya." />
          <div className="card-body">
            <div className="info-pair"><span>Magaca</span><b>{me.data?.displayName}</b></div>
            <div className="info-pair"><span>Emaylka</span><b>{me.data?.email}</b></div>
            <div className="info-pair"><span>Xilka</span><Badge tone="info">{owner ? "Milkiile" : "Shaqaale Xafiis"}</Badge></div>
            <div className="info-pair"><span>Waqtiga Ganacsiga</span><b>Afrika/Muqdisho (UTC+03:00)</b></div>
            {owner && (
              <div className="form-actions" style={{ marginTop: 16 }}>
                <Link className="btn dark" href="/pricing">
                  Maamul qiimaha & cabbirka shidaalka
                </Link>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="Xaqiijinta Amaanka & Shuruudaha" description="Qawaaniinta loo isticmaalo nidaamka oo dhan." />
          <div className="card-body">
            <div className="info-pair"><span>Sida Loo Soo Gali karo</span><b>Kulan Cookie (Cookie Sessions)</b></div>
            <div className="info-pair"><span>Derejooyinka La Ogolyahay</span><b>Milkiile & Shaqaale Xafiis</b></div>
            <div className="info-pair"><span>Qaybta Kaydka</span><b>Litir</b></div>
            <div className="info-pair"><span>Noocyada Shidaalka</span><b>Naafto & Basiin</b></div>
            <div className="notice" style={{ marginTop: 20 }}>
              Qiimaha iyo cabbirka fuustooyinku waa kuwo leh taariikh (versioned). Hawlihii la xaqiijiyay waxay haysanayaan qiimahoodii hore.
            </div>
          </div>
        </Card>
      </div>

      {owner && (
        <>
          <div className="grid team-metrics">
            <MetricCard label="Shaqaalaha Shaqaynaya" value={users.data?.filter((u) => u.isActive).length ?? "—"} note="Ogolaanshada Nidaamka" icon={Users} />
            <MetricCard label="Milkiilayaasha" value={users.data?.filter((u) => u.role === "OWNER").length ?? "—"} note="Maamulka Ganacsiga" icon={ShieldCheck} />
            <MetricCard label="Shaqaalaha Xafiiska" value={users.data?.filter((u) => u.role === "OFFICE_EMPLOYEE").length ?? "—"} note="Hawlaha Maalintii" icon={CircleCheck} />
          </div>

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
              <label htmlFor="displayName">Magaca Muuqda *</label>
              <input id="displayName" className="input" name="displayName" required />
            </div>
            <div className="field full">
              <label htmlFor="email">Cinwaanka Emaylka *</label>
              <input id="email" className="input" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="role">Xilka</label>
              <select id="role" className="select" name="role">
                <option value="OFFICE_EMPLOYEE">Shaqaale Xafiis (Office Employee)</option>
                <option value="OWNER">Milkiile (Owner)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="password">Furaha Ku-meel-gaarka ah *</label>
              <input id="password" className="input" name="password" type="password" autoComplete="new-password" minLength={12} required />
              <small className="muted">Ugu yaraan 12 xaraf</small>
            </div>
          </div>
          {create.isError && <ErrorState message={create.error.message} />}
          <div className="form-actions">
            <button className="btn" type="button" onClick={() => setShowCreate(false)}>
              Ka Noqo
            </button>
            <SubmitButton busy={create.isPending}>Samee Isticmaale</SubmitButton>
          </div>
        </form>
      </Modal>
    </main>
  );
}
