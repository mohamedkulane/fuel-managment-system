"use client";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Receipt, TrendingUp, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { decimal } from "../lib/format";
import { ErrorState, LoadingState, MetricCard } from "./ui";

type FinancialTotals = { totals: { totalInvoiced: string; totalPaid: string; outstandingDebt: string; unappliedCredit: string; netPosition: string } };
export function FinanceMetrics({ kind }: { kind: "invoices" | "payments" }) {
  const summary = useQuery({ queryKey: ["financial-summary"], queryFn: () => api<FinancialTotals>("/financial/debts") });
  if (summary.isLoading) return <LoadingState label="La soo rarayaa xaaladda xisaabaadka…" />;
  if (summary.isError) return <ErrorState message={summary.error.message} retry={() => void summary.refetch()} />;
  const totals = summary.data?.totals;
  return (
    <div className="grid">
      <MetricCard
        label={kind === "invoices" ? "Wadarta Biilasha" : "Lacagaha La Qabtay"}
        value={`$${decimal(kind === "invoices" ? totals?.totalInvoiced : totals?.totalPaid)}`}
        note="Dhammaan xisaabaadka macaamiisha"
        icon={kind === "invoices" ? Receipt : Wallet}
      />
      <MetricCard
        label="Deynta Harsan"
        value={`$${decimal(totals?.outstandingDebt)}`}
        note="Baaqiga biilasha furan"
        icon={TrendingUp}
        dark
      />
      <MetricCard
        label="Lacagta Dheeraadka ah (Credit)"
        value={`$${decimal(totals?.unappliedCredit)}`}
        note="Diyaar u ah qaybinta biilasha"
        icon={CircleCheck}
      />
      <MetricCard
        label="Natiijada Xisaabta"
        value={`$${decimal(totals?.netPosition)}`}
        note="Deynta oo laga jaray lacagaha dheeraadka ah"
        icon={Wallet}
      />
    </div>
  );
}
