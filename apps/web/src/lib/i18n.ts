/**
 * Centralized Somali Business Terminology & Translation Dictionary
 * Fuel Wholesale Management System (FuelDesk)
 */

export const statusTranslations: Record<string, string> = {
  DRAFT: "Qabyo",
  CONFIRMED: "La Xaqiijiyay",
  SCHEDULED: "La Jadwaleeyay",
  IN_PROGRESS: "Wuu Socdaa",
  PARTIALLY_FULFILLED: "Qayb Ayaa La Fushiyay",
  FULFILLED: "La Dhammeeyay",
  COMPLETED: "La Dhammeeyay",
  CANCELLED: "La Baajiyay",
  UNPAID: "Lama Bixin",
  PARTIALLY_PAID: "Qayb Ayaa Laga Bixiyay",
  PAID: "La Bixiyay",
  REVERSED: "Laga Noqday",
  PREPARED: "La Diyaariyay",
  PRINTED: "La Daabacay",
  DISPATCHED: "Loo Diray",
  PARTIALLY_RECONCILED: "Qayb Ayaa La Heshiisiyay",
  RECONCILED: "La Heshiisiyay",
  ACTIVE: "Firfircoon",
  INACTIVE: "Aan Firfircoonayn",
  HOLD: "La Hakiyay",
  POSTED: "La Diiwaangeliyay"
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
  return statusTranslations[status] ?? status.replaceAll("_", " ");
}

export function formatRole(role: string | null | undefined): string {
  if (!role) return "—";
  return roleTranslations[role] ?? role;
}

export function formatFuel(fuel: string | null | undefined): string {
  if (!fuel) return "—";
  const upper = fuel.toUpperCase();
  if (upper.includes("DIESEL")) return "Naafto";
  if (upper.includes("PETROL")) return "Basiin";
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
