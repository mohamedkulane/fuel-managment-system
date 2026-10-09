import Decimal from "decimal.js";

/** Format exact decimal API strings without converting money to floating point. */
export function decimal(value: string | undefined | null, places = 2): string {
  if (value == null) return "—";
  const [whole, fraction] = new Decimal(value).toFixed(places).split(".");
  return whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction === undefined ? "" : `.${fraction}`);
}
export function sum(values: string[]): string { return values.reduce((total, value) => total.plus(value), new Decimal(0)).toString(); }
export function dateTime(value: string): string { return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Mogadishu", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
export function businessDate(): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Mogadishu", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
