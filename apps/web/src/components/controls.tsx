"use client";
import Link from "next/link";
import { Children, cloneElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Download, Eye, FilePlus2, FileSpreadsheet, LogIn, LogOut, Pencil, Plus, Printer, RefreshCw, RotateCcw, Save, Search, Settings, Truck, UserCheck, UserX, Wallet, X, type LucideIcon } from "lucide-react";
import { so } from "../lib/so";

const legacyActions: Record<string, string> = {
  "Kudhi Macmiil Cusub": "Ku dar Macmiil",
  "Kudar Macmiil Cusub": "Ku dar Macmiil",
  "Kaydi Macmiilka": "Kaydi",
  "Ka Noqo": "Jooji",
  "Ka noqo": "Jooji",
  "Eeg Warbixinta": "Eeg Xisaabta",
  "Wax ka beddel macmiilka": "Wax ka beddel Macmiilka",
  "Wax Ka Beddel": "Wax ka beddel",
  "Kaydi Beddelka": "Kaydi Isbeddellada",
  "Dalab cusub": "Dalab Cusub",
  "Eeg Faahfaahinta": "Eeg Faahfaahinta",
  "Faahfaahin": "Eeg Faahfaahinta",
  "Faahfaahinta Dalabka": "Eeg Dalabka",
  "Eeg Biilka": "Fur Biilka",
  "Faahfaahinta Rasiidhka": "Fur Rasiidhka",
  "Diiwaangeli Lacag-bixin": "Diiwaangeli Lacag",
  "Soo Dejiso PDF": "Soo dejiso PDF",
  "Daabac Xisaabta": "Daabac Warbixinta Xisaabta",
  "Dib u laab dalabyada": "Ku noqo Dalabyada",
  "Dib u laab dirista": "Ku noqo Gaarsiinta",
  "Dib u laab": "Dib u noqo",
  "Kaydi dalabka qabyada ah": "Kaydi",
  "Soo Saar Biil Cusub": "Fur Biilka",
  "Kabax Nidaamka": "Ka bax",
  "Kudar Isticmaale Cusub": "Ku dar Isticmaale",
  "Samee Isticmaale": "Ku dar Isticmaale",
  "Maamul qiimaha & cabbirka shidaalka": "Maamul Qiimaha Shidaalka",
  "Kaydi Qiimaha Cusub": "Kaydi",
  "Beddel Qiimaha": "Wax ka beddel Qiimaha",
  "Wax Ka Beddelka Kaydka": "Sax Kaydka",
  "+ Shidaal Soo Gelin": "Soo Geli Shidaal",
  "Shidaal Soo Gelin": "Soo Geli Shidaal",
  "Diiwaangeli Beddelka": "Kaydi Sixidda",
  "Kaydi Qabyada Iibka": "Kaydi",
  "Kusoo gal goobta shaqada": "Gal nidaamka",
  "Kuwii Hore": "Hore",
  "Kuwii Danbe": "Xiga",
  "Amuur Waraaqda Gaarsiinta": "Diyaari Liiska Gaarsiinta",
  "Waraaq Gaarsiinta oo Cusub": "Liiska Gaarsiinta Cusub",
  "Xir diyaarinada": "Jooji",
  "Diyaari dirista": "Diyaari Gaarsiinta",
  "Diiwaangeli dirista rasmiga ah": "Xaqiiji Dirista",
  "Heshiisii gaarsiinta": "Xaqiiji Gaarsiinta",
  "Diiwaangeli Heshiisiinta": "Xaqiiji Gaarsiinta",
  "Kaydinaya…": "Waa la kaydinayaa…",
  "Soo Dejiso Excel": "Soo dejiso Excel",
  "Nadiifi Shaandhaynta": "Ka saar kala shaandhaynta",
  "Soo Saar Biilka": "Fur Biilka",
  "Kansal garee": "Ka noqo",
  "Xaqiiji Kansalaadda": "Xaqiiji Ka Noqoshada",
  "Diiwaangeli Lacagta": "Diiwaangeli Lacag",
  "Diiwaangeli dirista": "Xaqiiji Dirista",
  "Soo Dejiso Rasiidhka (PDF)": "Fur Rasiidhka",
  "Kansal Lacag-bixinta": "Ka Noqo Lacag-qabashada",
  "Kansal Biilka": "Ka Noqo Biilka",
  "Waa la diiwaangelinayaa...": "Waa la diiwaangelinayaa…",
  "Waa la kansal garaynayaa...": "Waa laga noqonayaa…",
  "Diiwaangeli Rasiidhka": "Xaqiiji Soo Gelinta",
  "Soo Saar Biilasha": "Diyaari Biillasha",
  "Eeg xisaabta": "Eeg Xisaabta",
  "Xaqiiji Dirista": "Xaqiiji Dirista"
};
function textOf(children: ReactNode): string { return Children.toArray(children).map(child => typeof child === "string" || typeof child === "number" ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : "").join(" ").trim(); }
function translate(children: ReactNode, removeExistingIcons = true): ReactNode { return Children.map(children, child => { if (typeof child === "string") { const key = child.trim(); return legacyActions[key] ?? so(key); } if (isValidElement<{ children?: ReactNode; size?: number }>(child)) { if (removeExistingIcons && child.props.size !== undefined && !child.props.children) return null; return child.props.children ? cloneElement(child, {}, translate(child.props.children, removeExistingIcons)) : child; } return child; }); }
function iconFor(text: string): LucideIcon {
  if (/sign in|gal nidaamka/i.test(text)) return LogIn;
  if (/sign out|ka bax/i.test(text)) return LogOut;
  if (/deactivate|disable/i.test(text)) return UserX;
  if (/activate|enable/i.test(text)) return UserCheck;
  if (/cancel|close/i.test(text)) return X;
  if (/revers/i.test(text)) return RotateCcw;
  if (/edit|adjust|change|beddel/i.test(text)) return Pencil;
  if (/save|saving|kaydi/i.test(text)) return Save;
  if (/print|daabac/i.test(text)) return Printer;
  if (/excel|xlsx/i.test(text)) return FileSpreadsheet;
  if (/statement|report|list|pdf|download|export/i.test(text)) return Download;
  if (/back|previous|dib u/i.test(text)) return ArrowLeft;
  if (/next/i.test(text)) return ArrowRight;
  if (/view|preview|hide invoice|eeg|faahfaahin/i.test(text)) return Eye;
  if (/payment|^pay$|lacag/i.test(text)) return Wallet;
  if (/confirm delivery|reconcile/i.test(text)) return ClipboardCheck;
  if (/confirm|approve|xaqiiji/i.test(text)) return Check;
  if (/stock|dispatch|delivery/i.test(text)) return Truck;
  if (/invoice|biil/i.test(text)) return FilePlus2;
  if (/new|add|create|cusub/i.test(text)) return Plus;
  if (/retry|try again|refresh|clear/i.test(text)) return RefreshCw;
  if (/search|raadi/i.test(text)) return Search;
  return Settings;
}
function ActionContents({ children, decorate = true }: { children: ReactNode; decorate?: boolean }) { const originalText = textOf(children); if (!originalText) return children; const translated = translate(children, decorate); if (!decorate) return translated; const Icon = iconFor(originalText); return <><Icon size={18} aria-hidden="true" />{translated}</>; }
export function ActionButton({ children, ...props }: ComponentProps<"button">) { const decorate = typeof props.className === "string" && props.className.split(/\s+/).some(name => name.startsWith("btn")); return <button {...props}><ActionContents decorate={decorate}>{children}</ActionContents></button>; }
export function ActionLink({ children, ...props }: ComponentProps<typeof Link>) { return <Link {...props}>{props.className?.includes("btn") ? <ActionContents>{children}</ActionContents> : children}</Link>; }
export function ActionAnchor({ children, ...props }: ComponentProps<"a">) { return <a {...props}>{props.className?.includes("btn") ? <ActionContents>{children}</ActionContents> : children}</a>; }
export function FormLabel({ children, ...props }: ComponentProps<"label">) {
  const content = Children.map(children, child => {
    if (typeof child !== "string") return child;
    const original = child.trim();
    const required = original.endsWith("*");
    const label = original.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*[:*]\s*$/, "");
    return `${legacyActions[label] ?? so(label)}${required ? " *" : ""}`;
  });
  return <label {...props} style={{ wordBreak: "keep-all", ...props.style }}>{content}</label>;
}
