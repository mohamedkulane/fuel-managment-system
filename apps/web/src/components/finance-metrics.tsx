"use client";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Receipt, TrendingUp, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { decimal } from "../lib/format";
import { ErrorState, LoadingState, MetricCard } from "./ui";

type FinancialTotals = { totals: { totalInvoiced: string; totalPaid: string; outstandingDebt: string; unappliedCredit: string; netPosition: string } };
export function FinanceMetrics({ kind }: { kind: "invoices" | "payments" }) {
 const summary = useQuery({ queryKey:["financial-summary"], queryFn:()=>api<FinancialTotals>("/financial/debts") });
 if(summary.isLoading) return <LoadingState label="Loading financial position…"/>;
 if(summary.isError) return <ErrorState message={summary.error.message} retry={()=>void summary.refetch()}/>;
 const totals=summary.data?.totals;
 return <div className="grid"><MetricCard label={kind === "invoices" ? "Total invoiced" : "Payments received"} value={`$${decimal(kind === "invoices" ? totals?.totalInvoiced : totals?.totalPaid)}`} note="All posted customer accounts" icon={kind === "invoices" ? Receipt : Wallet}/><MetricCard label="Outstanding invoice debt" value={`$${decimal(totals?.outstandingDebt)}`} note="Open invoice balances" icon={TrendingUp} dark/><MetricCard label="Unapplied customer credit" value={`$${decimal(totals?.unappliedCredit)}`} note="Available for allocation" icon={CircleCheck}/><MetricCard label="Net account position" value={`$${decimal(totals?.netPosition)}`} note="Debt less customer credits" icon={Wallet}/></div>;
}
