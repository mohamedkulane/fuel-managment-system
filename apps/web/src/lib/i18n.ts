import { so } from "./so";

/**
 * Centralized Somali Business Terminology & Translation Dictionary
 * Fuel Wholesale Management System (FuelDesk)
 */

export const statusTranslations: Record<string, string> = {
  DRAFT: "Qabyo",
  CONFIRMED: "La Xaqiijiyey",
  SCHEDULED: "La Qorsheeyey",
  IN_PROGRESS: "Wuu Socdaa",
  PARTIALLY_FULFILLED: "Qayb Ayaa La Geeyey",
  FULFILLED: "Waa La Geeyey",
  COMPLETED: "Waa La Dhammeeyey",
  CANCELLED: "Waa La Joojiyey",
  UNPAID: "Lama Bixin",
  PARTIALLY_PAID: "Qayb Ayaa La Bixiyey",
  PAID: "La Bixiyey",
  REVERSED: "Waa Laga Noqday",
  PREPARED: "La Diyaariyey",
  PRINTED: "La Daabacay",
  DISPATCHED: "La Diray",
  PARTIALLY_RECONCILED: "Qayb Ayaa La Heshiisiyey",
  RECONCILED: "La Heshiisiyey",
  ACTIVE: "Shaqaynaya",
  INACTIVE: "Aan shaqaynayn",
  HOLD: "La Hakiyey",
  POSTED: "La Diiwaangeliyey",
  PENDING: "Sugaya",
  PARTIAL: "Qayb Ayaa La Bixiyey",
  OUTSIDE: "Ka Baxsan Akoonnada",
  OUTSIDE_NOT_TRACKED: "Ka Baxsan Akoonnada",
  NOT_TRACKED: "Lama Diiwaangelin",
  NEEDS_REVIEW: "Hubin Ayuu U Baahan Yahay",
  MONEY_IN: "Lacag Soo Gashay",
  MONEY_OUT: "Lacag Baxday",
  TRANSFER: "Wareejin",
  CORRECTION: "Sixid",
  CASH: "Lacag Caddaan ah",
  MOBILE_MONEY: "Lacagta Moobaylka",
  BANK: "Bangi",
  OTHER: "Kale",
  BLOCK_NEGATIVE: "Ha oggolaan haraag taban",
  ALLOW_NEGATIVE: "Oggolow haraag taban",
  OPENING_BALANCE: "Haraaga Bilowga",
  CUSTOMER_PAYMENT: "Lacag Macmiil",
  CUSTOMER_PAYMENT_REVERSAL: "Ka Noqosho Lacag Macmiil",
  SUPPLIER_PAYMENT: "Lacag-bixin Keene",
  SUPPLIER_PAYMENT_REVERSAL: "Ka Noqosho Lacag Keene",
  EXPENSE: "Kharash",
  EXPENSE_REVERSAL: "Ka Noqosho Kharash",
  TRANSFER_IN: "Wareejin Soo Gashay",
  TRANSFER_OUT: "Wareejin Baxday",
  ADJUSTMENT: "Sixid"
};

export const roleTranslations: Record<string, string> = {
  OWNER: "Milkiilaha",
  OFFICE_EMPLOYEE: "Shaqaalaha Xafiiska"
};

export const fuelTranslations: Record<string, string> = {
  DIESEL: "Naafto",
  PETROL: "Basiin"
};

export function formatStatus(status: string | null | undefined): string {
  if (!status) return "—";
  const translated = statusTranslations[status] ?? so(status);
  return translated === status ? "Xaalad kale" : translated;
}

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
