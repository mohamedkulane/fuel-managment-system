import { so } from "./so";

/**
 * Centralized Somali Business Terminology & Translation Dictionary
 * Fuel Wholesale Management System (FuelDesk)
 */

export const statusTranslations: Record<string, string> = {
  // Order Statuses (Strict canonical mapping)
  DRAFT: "Qabyo",
  CONFIRMED: "La xaqiijiyey",
  SCHEDULED: "Gaarsiin la qorsheeyey",
  IN_PROGRESS: "Gaarsiintu wey socotaa",
  PARTIALLY_FULFILLED: "Qayb ahaan la geeyey",
  FULFILLED: "La geeyey",
  CANCELLED: "La joojiyey",

  // Invoices & Debt
  UNPAID: "Lama bixin",
  PARTIALLY_PAID: "Qayb ayaa la bixiyey",
  PAID: "La bixiyey",
  REVERSED: "Waa laga noqday",
  POSTED: "La diiwaangeliyey",
  PENDING: "Sugaya",
  PARTIAL: "Qayb ayaa la bixiyey",
  COMPLETED: "La geeyey",
  DELIVERED: "La geeyey",

  // Delivery & Dispatch
  PREPARED: "La diyaariyey",
  PRINTED: "La daabacay",
  DISPATCHED: "La diray",
  PARTIALLY_RECONCILED: "Qayb ayaa la heshiisiyey",
  RECONCILED: "La heshiisiyey",

  // Customers & Suppliers
  ACTIVE: "Shaqaynaya",
  INACTIVE: "Aan shaqaynayn",
  HOLD: "La hakiyey",
  ARCHIVED: "La kaydiyay",

  // Financial & Movement Types
  OPEN: "Furan",
  OUTSIDE: "Ka baxsan akoonnada",
  OUTSIDE_NOT_TRACKED: "Ka baxsan akoonnada",
  NOT_TRACKED: "Lama diiwaangelin",
  NEEDS_REVIEW: "Hubin ayuu u baahan yahay",
  MONEY_IN: "Lacag soo gashay",
  MONEY_OUT: "Lacag baxday",
  TRANSFER: "Wareejin",
  CORRECTION: "Sixid",
  CASH: "Lacag caddaan ah",
  MOBILE_MONEY: "Lacagta moobaylka",
  BANK: "Bangi",
  OTHER: "Kale",
  BLOCK_NEGATIVE: "Ha oggolaan haraag taban",
  ALLOW_NEGATIVE: "Oggolow haraag taban",
  OPENING_BALANCE: "Haraaga bilowga",
  CUSTOMER_PAYMENT: "Lacag macmiil",
  CUSTOMER_PAYMENT_REVERSAL: "Ka noqosho lacag macmiil",
  CUSTOMER_REFUND: "Lacag-celin macmiil",
  SUPPLIER_PAYMENT: "Lacag-bixin keene",
  SUPPLIER_PAYMENT_REVERSAL: "Ka noqosho lacag keene",
  EXPENSE: "Kharash",
  EXPENSE_REVERSAL: "Ka noqosho kharash",
  TRANSFER_IN: "Wareejin soo gashay",
  TRANSFER_OUT: "Wareejin baxday",
  ADJUSTMENT: "Sixid",
  CREDIT_KEPT: "Credit la xafiday",
  REFUNDED: "La celiyay"
};

export type BadgeTone = "ok" | "warn" | "info" | "danger" | "neutral";

/**
 * Returns the standard badge tone corresponding to order status:
 * - FULFILLED -> "ok" (Green)
 * - CONFIRMED / SCHEDULED / IN_PROGRESS -> "info" (Blue/Teal)
 * - PARTIALLY_FULFILLED -> "warn" (Amber/Yellow)
 * - CANCELLED -> "danger" (Red)
 * - DRAFT -> "neutral" (Neutral/Grey)
 */
export function orderStatusTone(status: string | null | undefined): BadgeTone {
  if (!status) return "neutral";
  const upper = status.trim().toUpperCase();
  switch (upper) {
    case "FULFILLED":
    case "LA GEEYEY":
    case "COMPLETED":
    case "DELIVERED":
    case "PAID":
    case "LA BIXIYEY":
    case "POSTED":
    case "LA DIIWAANGELIYEY":
    case "RECONCILED":
    case "LA HESHIISIYEY":
    case "ACTIVE":
    case "SHAQAYNAYA":
      return "ok";

    case "CONFIRMED":
    case "LA XAQIIJIYEY":
    case "SCHEDULED":
    case "GAARSIIN LA QORSHEEYEY":
    case "IN_PROGRESS":
    case "GAARSIINTU WEY SOCOTAA":
    case "DISPATCHED":
    case "LA DIRAY":
    case "PRINTED":
    case "LA DAABACAY":
      return "info";

    case "DRAFT":
    case "QABYO":
      return "neutral";

    case "PARTIALLY_FULFILLED":
    case "QAYB AHAAN LA GEEYEY":
    case "PARTIALLY_PAID":
    case "QAYB AYAA LA BIXIYEY":
    case "PARTIALLY_RECONCILED":
    case "QAYB AYAA LA HESHIISIYEY":
    case "HOLD":
    case "LA HAKIYEY":
    case "PENDING":
    case "SUGAYA":
    case "OPEN":
    case "FURAN":
    case "NEEDS_REVIEW":
    case "HUBIN AYUU U BAAHAN YAHAY":
      return "warn";

    case "CANCELLED":
    case "LA JOOJIYEY":
    case "REVERSED":
    case "WAA LAGA NOQDAY":
      return "danger";

    case "INACTIVE":
    case "AAN SHAQAYNAYN":
    case "ARCHIVED":
    case "LA KAYDIYAY":
    default:
      return "neutral";
  }
}

export function formatStatus(status: string | null | undefined): string {
  if (!status) return "—";
  const trimmed = status.trim();
  if (!trimmed) return "—";

  // 1. Direct or upper-cased key match in canonical status dictionary
  const upper = trimmed.toUpperCase();
  if (statusTranslations[upper]) {
    return statusTranslations[upper];
  }

  // 2. Idempotency check: if the input is ALREADY a valid Somali translation
  const knownTranslations = Object.values(statusTranslations);
  const foundTranslation = knownTranslations.find(
    (val) => val.toLowerCase() === trimmed.toLowerCase()
  );
  if (foundTranslation) {
    return foundTranslation;
  }

  // 3. Fallback to general Somali translation dictionary
  const dictMatch = so(trimmed);
  if (dictMatch && dictMatch.toLowerCase() !== trimmed.toLowerCase()) {
    return dictMatch;
  }

  // 4. Humanize unknown status values rather than returning generic placeholders
  return trimmed
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export const roleTranslations: Record<string, string> = {
  OWNER: "Milkiilaha",
  OFFICE_EMPLOYEE: "Shaqaalaha Xafiiska"
};

export const fuelTranslations: Record<string, string> = {
  DIESEL: "Naafto",
  PETROL: "Basiin"
};

export function formatRole(role: string | null | undefined): string {
  if (!role) return "—";
  return roleTranslations[role] ?? "Door aan la aqoon";
}

export function formatFuel(fuel: string | null | undefined): string {
  if (!fuel) return "—";
  if (fuel.includes("+")) {
    return fuel.split("+").map((part) => formatFuel(part.trim())).join(" + ");
  }
  const upper = fuel.trim().toUpperCase();
  if (upper.includes("DIESEL") || upper === "NAAFTO") return "Naafto";
  if (upper.includes("PETROL") || upper === "BASIIN") return "Basiin";
  return fuelTranslations[fuel] ?? fuel;
}

export const t = {
  // Navigation & Workspace Groups
  workspace: "Goobta Shaqada",
  operations: "Hawgallada",
  insights: "Warbixinnada & Xogta",
  administration: "Maamulka",
  overview: "Guudmar",
  customers: "Macaamiisha",
  customer: "Macmiil",
  salesOrders: "Dalabyada",
  invoices: "Biilasha",
  payments: "Lacag-bixinnada",
  debtCenter: "Xinta Deynta",
  inventory: "Kaydka Shidaalka",
  fuelStockReceiving: "Shidaal Soo Gelin",
  fuelPricing: "Qiimaha Shidaalka",
  deliverySheets: "Waraaqaha Gaarsiinta",
  dispatches: "Dhaqdhaqaaqa Dirista",
  reports: "Warbixinnada",
  reportsAndExports: "Warbixinnada & Soo Dejinta",
  activityLog: "Diiwaanka Hawlaha",
  settingsAndAccess: "Dejinta & Ogolaanshaha",
  settings: "Dejinta",

  // Actions
  save: "Kaydi",
  cancel: "Ka Noqo",
  edit: "Wax Ka Beddel",
  delete: "Tirtir",
  search: "Raadi",
  filter: "Kala Shaandhee",
  print: "Daabac",
  downloadPdf: "Soo Dejiso PDF",
  exportExcel: "Soo Dejiso Excel",
  back: "Dib u laab",
  backToOrders: "Dib u laab dalabyada",
  backToCustomers: "Dib u laab macaamiisha",
  tryAgain: "Mar kale isku day",
  signOut: "Ka bax",
  confirm: "Xaqiiji",
  approve: "Ansixi",
  createOrder: "Dalab Cusub",
  receiveStock: "Shidaal Soo Gelin",
  recordPayment: "Diiwaangeli Lacag-bixin",

  // Business Concepts
  subtotal: "Wadarta Ka Hor Dhimista",
  fixedDiscount: "Lacag-dhimis",
  grandTotal: "Wadarta La Bixinayo",
  unitPrice: "Qiimaha Fuustadii",
  quantity: "Tirada Fuustooyinka",
  outstandingDebt: "Deynta Harsan",
  customerLedger: "Diiwaanka Xisaabta Macmiilka",
  accountStatement: "Warbixinta Xisaabta Macmiilka",
  stockMovements: "Dhaqdhaqaaqa Kaydka",
  deliveries: "Gaarsiinta Shidaalka",
  status: "Xaaladda",
  date: "Taariikhda",
  amount: "Lacagta",
  total: "Wadarta",
  details: "Faahfaahin",
  history: "Taariikhda Hawlaha",
  owner: "Milkiilaha",
  officeEmployee: "Shaqaalaha Xafiiska",
  warehouseStock: "Kaydka Bakhaarka",
  inTransitStock: "Kaydka Jidka Ku Jira",
  fuusto: "Fuusto",
  fuustos: "Fuustooyin",
  liters: "Litar",

  // System Messages & Notifications
  requiredField: "Qaybtan waa qasab.",
  customerCreatedSuccess: "Macmiilka si guul leh ayaa loo diiwaangeliyay.",
  orderConfirmedSuccess: "Dalabka si guul leh ayaa loo xaqiijiyay.",
  insufficientStock: "Shidaalka kaydka ku jira kuma filna.",
  paymentRecordedSuccess: "Lacag-bixinta si guul leh ayaa loo diiwaangeliyay.",
  incorrectCredentials: "Email-ka ama erayga sirta ah waa khaldan yahay.",
  somethingWentWrong: "Cilad ayaa dhacday. Fadlan mar kale isku day.",
  loadingRecords: "Raraya xogta…",
  noRecordsFound: "Waqtigan wax xog ah ma jiraan."
};
