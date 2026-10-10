"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { api, type Actor } from "../../lib/api";
import { SubmitButton } from "../../components/ui";
import { Brand } from "../../components/app-shell";
export default function LoginPage() {
  const router = useRouter(); const client = useQueryClient(); const [error, setError] = useState(""); const [visible, setVisible] = useState(false);
  const login = useMutation({ mutationFn: (values: { email: string; password: string }) => api<Actor>("/auth/login", { method: "POST", body: JSON.stringify(values) }), onSuccess: async (actor) => { client.setQueryData(["me"], actor); await client.invalidateQueries(); router.replace("/"); }, onError: (e: Error) => setError(e.message) });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); const data = new FormData(event.currentTarget); login.mutate({ email: String(data.get("email")), password: String(data.get("password")) }); }
  return <main className="login"><div className="login-shell"><div className="login-brand"><Brand /></div><section className="login-panel"><div className="login-accent" /><div className="eyebrow">Soo galidda koontada</div><h1>Kusoo dhawoow sistemka</h1><p className="login-sub">Gal si aad u maamusho macaamiisha, kaydka iyo shaqada maalinta.</p><form onSubmit={submit}>{error && <div id="login-error" className="notice danger" role="alert">{error}</div>}<div className="field"><label htmlFor="email">Ciwaanka Email-ka</label><input className="input" id="email" name="email" type="email" autoComplete="username" placeholder="magac@shirkada.so" required aria-describedby={error ? "login-error" : undefined} /></div><div className="field"><label htmlFor="password">Erayga sirta ah</label><div className="password-field"><input className="input" id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Geli eraygaaga sirta ah" required minLength={12} /><button type="button" className="password-toggle" aria-label={visible ? "Qari erayga sirta ah" : "Muuji erayga sirta ah"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div><div className="login-help"><ShieldCheck size={14} />Waxaa u furan oo kaliya milkiilaha iyo shaqaalaha xafiiska</div><SubmitButton busy={login.isPending}>Kusoo gal goobta shaqada <ArrowRight size={15} /></SubmitButton></form></section><p className="login-bottom">Goob shaqo oo u gaar ah jumladlaha shidaalka</p></div></main>;
}
