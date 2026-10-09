"use client";
import { Empty } from "./ui";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type ReportData = { [key: string]: JsonValue };
function title(key: string): string { return key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, c => c.toUpperCase()); }
function cell(value: JsonValue | undefined): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(cell).join(" · ");
  if (typeof value === "object") return Object.entries(value).map(([k,v]) => `${title(k)}: ${cell(v)}`).join(" · ");
  return String(value);
}
export function ReportPreview({ data }: { data: ReportData | undefined }) {
  if (!data) return <Empty>Choose a report and its required filters to view records.</Empty>;
  const collections = Object.entries(data).filter(([,v]) => Array.isArray(v));
  const summaries = Object.entries(data).filter(([k,v]) => !Array.isArray(v) && k !== "period" && k !== "customer");
  return <>{summaries.map(([key,value]) => <section className="report-summary" key={key}><h3>{title(key)}</h3>{value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value).map(([k,v]) => <div className="info-pair" key={k}><span>{title(k)}</span><b>{cell(v)}</b></div>) : <p>{cell(value)}</p>}</section>)}{collections.map(([key, collection]) => {
    const rows = collection as JsonValue[];
    const columns = [...new Set(rows.flatMap(row => row && typeof row === "object" && !Array.isArray(row) ? Object.keys(row) : ["value"]))].filter(k => !["id", "customerId"].includes(k));
    return <section key={key}>{collections.length > 1 && <h3 className="section-title">{title(key)}</h3>}{!rows.length ? <Empty>No records for the selected filters.</Empty> : <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map(c => <th key={c}>{title(c)}</th>)}</tr></thead><tbody>{rows.map((row,i) => <tr key={i}>{columns.map(c => <td key={c}>{cell(row && typeof row === "object" && !Array.isArray(row) ? row[c] : row)}</td>)}</tr>)}</tbody></table></div>}</section>;
  })}</>;
}
