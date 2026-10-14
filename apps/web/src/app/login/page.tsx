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
    <section className="login-showcase" aria-label="FuelDesk welcome">
      <div className="login-brand"><Brand logoUrl={branding.data?.logoUrl || undefined} companyName={branding.data?.companyName || "FuelDesk"} /></div>
      <img className="login-illustration" src="/login-fuel-operations.png" alt="Fuel distribution operations illustration" />
      <div className="login-welcome"><h2>Kusoo dhawoow!</h2><p>Maamul stock, dalabyo iyo macaamiil hal meel oo cad.</p><div className="login-slides" aria-label="Welcome slides"><Circle size={12} /><Circle size={12} /><Circle size={12} fill="currentColor" /></div></div>
    </section>
    <section className="login-panel"><div className="login-accent" /><div className="eyebrow">Secure workspace</div><h1>Log In</h1><p className="login-sub">Gal koontadaada si aad u sii waddo shaqada maanta.</p><form onSubmit={submit}>{error && <div id="login-error" className="notice danger" role="alert">{error}</div>}<div className="field"><FormLabel htmlFor="email">Ciwaanka Email-ka</FormLabel><div className="login-input-wrap"><Mail size={18} aria-hidden="true" /><input className="input" id="email" name="email" type="email" autoComplete="username" placeholder="name@company.so" required aria-describedby={error ? "login-error" : undefined} /></div></div><div className="field"><FormLabel htmlFor="password">Erayga sirta ah</FormLabel><div className="login-input-wrap password-field"><LockKeyhole size={18} aria-hidden="true" /><input className="input" id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required minLength={12} /><ActionButton type="button" className="password-toggle" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</ActionButton></div></div><div className="login-help"><ShieldCheck size={15} />Owner and office employee access only</div><SubmitButton busy={login.isPending}>Sign In <ArrowRight size={16} /></SubmitButton></form></section>
  </div></main>;
}
