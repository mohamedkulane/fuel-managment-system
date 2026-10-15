"use client";
import { ActionButton, FormLabel } from "../../components/controls";
import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight, Circle, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { api, type Actor } from "../../lib/api";
import { SubmitButton } from "../../components/ui";
import { Brand } from "../../components/app-shell";
import { useQuery } from "@tanstack/react-query";

type DocumentBranding = { companyName: string; logoUrl: string };

export default function LoginPage() {
  const router = useRouter(); const client = useQueryClient(); const [error, setError] = useState(""); const [visible, setVisible] = useState(false);
  const branding = useQuery({
    queryKey: ["settings", "document-branding"],
    queryFn: () => api<DocumentBranding>("/settings/document-branding"),
    retry: false,
  });
  const login = useMutation({ mutationFn: (values: { email: string; password: string }) => api<Actor>("/auth/login", { method: "POST", body: JSON.stringify(values) }), onSuccess: async (actor) => { client.setQueryData(["me"], actor); await client.invalidateQueries(); router.replace("/"); }, onError: (e: Error) => setError(e.message) });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const data = new FormData(event.currentTarget); login.mutate({ email: String(data.get("email")), password: String(data.get("password")) }); }
  return <main className="login login-reference"><div className="login-shell">
    <section className="login-showcase" aria-label="Ku soo dhawoow FuelDesk">
      <div className="login-brand"><Brand logoUrl={branding.data?.logoUrl || undefined} companyName={branding.data?.companyName || "FuelDesk"} /></div>
      <img className="login-illustration" src="/login-fuel-operations.png" alt="Sawirka hawlaha shidaal-qaybinta" />
      <div className="login-welcome"><h2>Ku soo dhawoow!</h2><p>Maamul kaydka shidaalka, dalabyada iyo macaamiisha hal meel.</p><div className="login-slides" aria-label="Sawirrada soo dhawaynta"><Circle size={12} /><Circle size={12} /><Circle size={12} fill="currentColor" /></div></div>
    </section>
    <section className="login-panel"><div className="login-accent" /><div className="eyebrow">Goob shaqo ammaan ah</div><h1>Gal nidaamka</h1><p className="login-sub">Gal koontadaada si aad u sii waddo shaqada maanta.</p><form onSubmit={submit}>{error && <div id="login-error" className="notice danger" role="alert">{error}</div>}<div className="field"><FormLabel htmlFor="email">Cinwaanka iimaylka</FormLabel><div className="login-input-wrap"><Mail size={18} aria-hidden="true" /><input className="input" id="email" name="email" type="email" autoComplete="username" placeholder="magac@shirkad.so" required aria-describedby={error ? "login-error" : undefined} /></div></div><div className="field"><FormLabel htmlFor="password">Furaha sirta ah</FormLabel><div className="login-input-wrap password-field"><LockKeyhole size={18} aria-hidden="true" /><input className="input" id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Geli furahaaga sirta ah" required minLength={12} /><ActionButton type="button" className="password-toggle" aria-label={visible ? "Qari furaha sirta ah" : "Muuji furaha sirta ah"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</ActionButton></div></div><div className="login-help"><ShieldCheck size={15} />Gelitaanku wuxuu u gaar yahay milkiilaha iyo shaqaalaha xafiiska</div><SubmitButton busy={login.isPending}>Gal nidaamka <ArrowRight size={16} /></SubmitButton></form></section>
  </div></main>;
}
