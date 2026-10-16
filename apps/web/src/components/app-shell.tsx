"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Boxes, LayoutGrid, Menu, Receipt, Settings, ShoppingBag, Users, Wallet, X, ShieldAlert } from "lucide-react";
import { api, ApiError, type Actor } from "../lib/api";
import { ErrorState, LoadingState } from "./ui";
import { formatRole } from "../lib/format";
import { WorkspaceHeader } from "./workspace-header";

const navLinks = [
  { href: "/", label: "Guudmar", icon: LayoutGrid, permission: "dashboard.view" },
  { href: "/customers", label: "Macaamiisha", icon: Users, permission: "customers.view" },
  { href: "/orders", label: "Dalabyada", icon: ShoppingBag, permission: "orders.view" },
  { href: "/stock", label: "Kaydka Shidaalka", icon: Boxes, permission: "stock.view" },
  { href: "/expenses", label: "Kharashaadka", icon: Receipt, permission: "expenses.view" },
  { href: "/accounts", label: "Akoonnada", icon: Wallet, permission: "accounts.view" },
  { href: "/reports", label: "Warbixinnada", icon: BarChart3, permission: "reports.view" },
  { href: "/settings", label: "Dejinta", icon: Settings, permission: "settings.view" }
];

type DocumentBranding = { companyName: string; logoUrl: string };

function canAccess(actor: Actor | undefined, permission: string): boolean {
  if (!actor) return false;
  if (actor.role === "OWNER") return true;
  return Boolean(actor.permissions && actor.permissions.includes(permission));
}

export function Brand({ logoUrl, companyName = "FuelDesk" }: { logoUrl?: string; companyName?: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [logoUrl]);
  return (
    <div className="brand">
      {logoUrl && !logoFailed ? (
        <img className="brand-logo" src={logoUrl} alt="" onError={() => setLogoFailed(true)} />
      ) : (
        <span className="brand-mark">F</span>
      )}
      <div className="brand-copy">
        <strong title={companyName}>{companyName}</strong>
        <small>Maamulka shidaalka jumlada</small>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const login = path === "/login";

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Actor>("/auth/me"), enabled: !login, retry: false });

  const branding = useQuery({
    queryKey: ["settings", "document-branding"],
    queryFn: () => api<DocumentBranding>("/settings/document-branding"),
    enabled: !login && path !== "/deliveries" && Boolean(me.data),
    retry: false
  });

  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      client.clear();
      router.replace("/login");
    }
  });

  useEffect(() => {
    if (!login && me.error instanceof ApiError && me.error.status === 401) router.replace("/login");
  }, [login, me.error, router]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab") return;
      const items = sidebar.current?.querySelectorAll<HTMLElement>("a, button:not(:disabled)");
      const first = items?.[0];
      const last = items?.[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
      menu.current?.focus();
    };
  }, [open]);

  if (login) return children;

  // The daily manifest is deliberately isolated from search and financial widgets
  if (path === "/deliveries")
    return me.data ? (
      children
    ) : (
      <main className="page">{me.isError ? <ErrorState message={me.error.message} /> : <LoadingState />}</main>
    );

  const sectionPath = /^\/(payments|debts|invoices)(\/|$)/.test(path)
    ? "/customers"
    : /^\/(deliveries|dispatches)(\/|$)/.test(path)
    ? "/orders"
    : path === "/pricing"
    ? "/stock"
    : path === "/audits"
    ? "/settings"
    : path;

  const currentSectionLink = navLinks
    .filter((l) => (l.href === "/" ? sectionPath === "/" : sectionPath === l.href || sectionPath.startsWith(`${l.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const activeLink = currentSectionLink;
  const isDenied = me.data && currentSectionLink && !canAccess(me.data, currentSectionLink.permission);

  const visibleLinks = navLinks.filter((l) => canAccess(me.data, l.permission));
  const initials = me.data?.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "";

  return (
    <div className="app-shell">
      <a href="#workspace-content" className="skip-link">
        U gudub nuxurka
      </a>
      <button className={`backdrop ${open ? "open" : ""}`} aria-label="Xir liiska" onClick={() => setOpen(false)} tabIndex={-1} />
      <aside ref={sidebar} className={`sidebar ${open ? "open" : ""}`} aria-label="Liiska goobta shaqada">
        <div className="brand-row">
          <Brand logoUrl={branding.data?.logoUrl || undefined} companyName={branding.data?.companyName || undefined} />
          <button className="sidebar-close icon-btn" aria-label="Xir liiska" onClick={() => setOpen(false)}>
            <X size={19} />
          </button>
        </div>
        <nav className="side-nav" aria-label="Liiska qaybaha">
          <div>
            {visibleLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={activeLink?.href === href ? "page" : undefined}
                className={activeLink?.href === href ? "active" : ""}
              >
                <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{initials}</div>
          <div className="sidebar-user">
            <b>{me.data?.displayName ?? "Raraya…"}</b>
            <small>{formatRole(me.data?.role)}</small>
          </div>
        </div>
      </aside>
      <div className="workspace" inert={open ? true : undefined}>
        <header className="topbar">
          <button ref={menu} className="menu-btn icon-btn" aria-label="Fur liiska" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <WorkspaceHeader actor={me.data} />
        </header>
        <div id="workspace-content" tabIndex={-1}>
          {logout.isError && <ErrorState message={logout.error.message} />}
          {me.isLoading ? (
            <main className="page">
              <LoadingState label="Soo raraya goobtaada shaqada…" />
            </main>
          ) : me.isError ? (
            <main className="page">
              <ErrorState message={me.error.message} retry={() => void me.refetch()} />
            </main>
          ) : isDenied ? (
            <main className="page flex items-center justify-center min-h-[60vh]">
              <div className="card p-8 text-center max-w-md mx-auto space-y-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                  <ShieldAlert size={28} />
                </div>
                <h2 className="text-lg font-bold">Ogolaansho uma haysatid boggan (403 Forbidden)</h2>
                <p className="text-sm text-muted-foreground">
                  Uma haysatid ogolaansho inaad gasho qaybtan ({currentSectionLink?.permission}). Fadlan la xiriir Milkiilaha si laguu siiyo oggolaansho.
                </p>
                <div className="pt-2">
                  <Link href="/" className="btn primary inline-block">
                    Ku noqo Guudmarka
                  </Link>
                </div>
              </div>
            </main>
          ) : me.data ? (
            children
          ) : null}
        </div>
      </div>
    </div>
  );
}
