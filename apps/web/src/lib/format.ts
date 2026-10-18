import Decimal from "decimal.js";
import { formatStatus, formatFuel, formatRole, orderStatusTone } from "./i18n";
export { formatStatus, formatFuel, formatRole, orderStatusTone };

/** Format exact decimal API strings without converting money to floating point. */
export function decimal(value: string | undefined | null, places = 2): string {
  if (value == null) return "—";
  const [whole, fraction] = new Decimal(value).toFixed(places).split(".");
  return whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction === undefined ? "" : `.${fraction}`);
}
export function fuustoQuantity(value: string | undefined | null): string {
  if (value == null) return "—";
  const [whole, fraction] = new Decimal(value).toFixed().split(".");
  const trimmedFraction = fraction?.replace(/0+$/, "");
  return whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (trimmedFraction ? `.${trimmedFraction}` : "");
}
export function sum(values: string[]): string { return values.reduce((total, value) => total.plus(value), new Decimal(0)).toString(); }
const somaliMonths = ["Jannaayo", "Febraayo", "Maarso", "Abriil", "Maajo", "Juun", "Luulyo", "Agoosto", "Sebtembar", "Oktoobar", "Nofeembar", "Diseembar"];
export function dateTime(value: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Mogadishu", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  const month = Number(part("month"));
  return `${Number(part("day"))} ${somaliMonths[month - 1] ?? ""} ${part("year")}, ${part("hour")}:${part("minute")}`;
}
export function businessDate(): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Mogadishu", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

