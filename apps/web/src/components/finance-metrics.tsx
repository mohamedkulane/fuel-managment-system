"use client";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Receipt, TrendingUp, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { decimal } from "../lib/format";
import { ErrorState, LoadingState, MetricCard } from "./ui";

type FinancialTotals = { totals: { totalSales: string; totalPaid: string; remainingDebt: string; pendingOrders: string; moneyToReview: string } };
export function FinanceMetrics({ kind }: { kind: "invoices" | "payments" }) {
  const summary = useQuery({ queryKey: ["financial-summary"], queryFn: () => api<FinancialTotals>("/financial/debts") });
  if (summary.isLoading) return <LoadingState label="La soo rarayaa xaaladda xisaabaadka…" />;
  if (summary.isError) return <ErrorState message={summary.error.message} retry={() => void summary.refetch()} />;
  const totals = summary.data?.totals;
  return (
    <div className="grid">
      <MetricCard
        label={kind === "invoices" ? "Wadarta Biilasha" : "Lacagaha La Qabtay"}
        value={`$${decimal(kind === "invoices" ? totals?.totalSales : totals?.totalPaid)}`}
        note="Dhammaan xisaabaadka macaamiisha"
        icon={kind === "invoices" ? Receipt : Wallet}
      />
      <MetricCard
        label="Deynta Harsan"
        value={`$${decimal(totals?.remainingDebt)}`}
        note="Baaqiga biilasha furan"
        icon={TrendingUp}
        dark
      />
      <MetricCard
        label="Dalabyada Sugaya"
        value={`$${decimal(totals?.pendingOrders)}`}
        note="Haraaga dalab aan weli la keenin"
        icon={CircleCheck}
      />
      <MetricCard
        label="Owner Review"
        value={`$${decimal(totals?.moneyToReview)}`}
        note="Lacag u baahan xaqiijin"
        icon={Wallet}
      />
    </div>
  );
}
