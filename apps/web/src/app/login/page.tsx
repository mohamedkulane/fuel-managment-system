"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type Actor } from "../../lib/api";
import { SubmitButton } from "../../components/ui";

export default function LoginPage() {
  const router = useRouter(); const client = useQueryClient(); const [error, setError] = useState("");
  const login = useMutation({ mutationFn: (values: { email: string; password: string }) => api<Actor>("/auth/login", { method: "POST", body: JSON.stringify(values) }), onSuccess: async (actor) => { client.setQueryData(["me"], actor); await client.invalidateQueries(); router.replace("/"); }, onError: (e: Error) => setError(e.message) });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const data = new FormData(event.currentTarget); login.mutate({ email: String(data.get("email")), password: String(data.get("password")) }); }
  return <main className="login"><section className="login-art"><div className="brand"><span className="brand-mark">F</span><div><strong>fueldesk.</strong><small>Wholesale system</small></div></div><div><div className="eyebrow">Built for the way you work</div><h1>Every liter.<br />Every order.<br /><em>Every delivery.</em></h1><p>Run incoming tanker receipts, customer orders and physical delivery reconciliation from one disciplined workspace.</p></div><small>Owner and office employee access only</small></section><section className="login-panel"><form className="login-box" onSubmit={submit}><span className="badge info">Secure workspace</span><h2>Welcome back.</h2><p>Sign in to manage today&apos;s fuel operations.</p>{error && <div className="notice warn" role="alert">{error}</div>}<div className="field"><label htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" autoComplete="username" required /></div><div className="field" style={{marginTop:16}}><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required minLength={12} /></div><div className="form-actions"><SubmitButton busy={login.isPending}>Sign in</SubmitButton></div></form></section></main>;
}
