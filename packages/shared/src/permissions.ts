import { z } from "zod";

export const PERMISSION_CODES = [
  // Guudmar (Dashboard)
  "dashboard.view",

  // Macaamiisha (Customers)
  "customers.view",
  "customers.create",
  "customers.update",
  "customers.archive",
  "customers.restore",

  // Dalabyada (Orders)
  "orders.view",
  "orders.create",
  "orders.amend",
  "orders.cancel",
  "orders.delivery.confirm",
  "orders.delivery.overage_approve",
  "orders.invoice.view",

  // Kaydka Shidaalka & Qiimaha (Stock & Prices)
  "stock.view",
  "stock.receive",
  "stock.adjust",
  "stock.purchase_cost.view",
  "prices.view",
  "prices.update",

  // Keenayaasha (Suppliers)
  "suppliers.view",
  "suppliers.create",
  "suppliers.update",
  "suppliers.pay",

  // Kharashaadka (Expenses)
  "expenses.view",
  "expenses.create",
  "expenses.reverse",

  // Akoonnada & Lacagaha (Accounts & Payments)
  "accounts.view",
  "accounts.create",
  "accounts.transfer",
  "accounts.movements.view",
  "payments.view",
  "payments.record",
  "payments.reverse",
  "payments.receipt.view",

  // Warbixinnada (Reports)
  "reports.view",
  "reports.export",
  "reports.financial.view",
  "reports.profit.view",

  // Dejinta & Maamulka (Settings & Admin)
  "settings.view",
  "settings.manage",
  "users.manage",
  "permissions.manage",
  "audit.view"
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const permissionCodeSchema = z.enum(PERMISSION_CODES);

export interface PermissionDefinition {
  code: PermissionCode;
  label: string;
  description: string;
  section: "dashboard" | "customers" | "orders" | "stock" | "expenses" | "accounts" | "reports" | "settings";
  isOwnerOnlyByDefault?: boolean;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Dashboard
  {
    code: "dashboard.view",
    label: "Eeg Guudmarka",
    description: "Arag bogga guudmarka iyo cabbirrada kooban",
    section: "dashboard"
  },

  // Customers
  {
    code: "customers.view",
    label: "Eeg Macaamiisha",
    description: "Arag liiska macaamiisha iyo faahfaahintooda",
    section: "customers"
  },
  {
    code: "customers.create",
    label: "Ku dar Macmiil",
    description: "Diiwaangeli macmiil cusub",
    section: "customers"
  },
  {
    code: "customers.update",
    label: "Wax ka beddel Macmiil",
    description: "Wax ka beddel macluumaadka macmiilka",
    section: "customers"
  },
  {
    code: "customers.archive",
    label: "Kaydi / Tirtir Macmiil",
    description: "Macmiilka ka dhig mid aan shaqaynayn (archive)",
    section: "customers",
    isOwnerOnlyByDefault: true
  },
  {
    code: "customers.restore",
    label: "Soo celi Macmiil",
    description: "Dib u hawlgeli macmiil horay loo kaydiyay",
    section: "customers",
    isOwnerOnlyByDefault: true
  },

  // Orders
  {
    code: "orders.view",
    label: "Eeg Dalabyada",
    description: "Arag liiska dalabyada iyo faahfaahintooda",
    section: "orders"
  },
  {
    code: "orders.create",
    label: "Abuur Dalab",
    description: "Diiwaangeli dalab cusub oo shidaal ah",
    section: "orders"
  },
  {
    code: "orders.amend",
    label: "Kordhi / Beddel Dalab",
    description: "Wax ka beddel tirada dalabka ka hor ama inta lagu jiro gaarsiinta",
    section: "orders",
    isOwnerOnlyByDefault: true
  },
  {
    code: "orders.cancel",
    label: "Jooji Dalabka",
    description: "Jooji dalab aan la dirin ama jooji inta harsan",
    section: "orders",
    isOwnerOnlyByDefault: true
  },
  {
    code: "orders.delivery.confirm",
    label: "Xaqiiji Gaarsiinta",
    description: "Diiwaangeli shidaalka dhabta ah ee macmiilku qaatay",
    section: "orders"
  },
  {
    code: "orders.delivery.overage_approve",
    label: "Oggolow Fuusto Dheeraad ah",
    description: "Ansixi shidaal ka badan intii hore loo dalbaday",
    section: "orders",
    isOwnerOnlyByDefault: true
  },
  {
    code: "orders.invoice.view",
    label: "Eeg Qaansheegta",
    description: "Arag ama daabac qaansheegta rasmiga ah ee dalabka",
    section: "orders"
  },

  // Stock & Prices
  {
    code: "stock.view",
    label: "Eeg Kaydka",
    description: "Arag xaddiga shidaalka ku jira bakhaarka iyo jidka",
    section: "stock"
  },
  {
    code: "stock.receive",
    label: "Qaado Shidaal (Receipt)",
    description: "Diiwaangeli keenis cusub oo fuusto shidaal ah",
    section: "stock"
  },
  {
    code: "stock.adjust",
    label: "Sixid Kayd (Adjust)",
    description: "Toosi ama sax tirada fuustooyinka kaydka",
    section: "stock",
    isOwnerOnlyByDefault: true
  },
  {
    code: "stock.purchase_cost.view",
    label: "Eeg Qiimaha Iibsiga",
    description: "Arag qiimaha shidaalka lagu soo iibiyay keenayaasha",
    section: "stock",
    isOwnerOnlyByDefault: true
  },
  {
    code: "prices.view",
    label: "Eeg Qiimaha Iibka",
    description: "Arag qiimaha firfircoon ee fuustada",
    section: "stock"
  },
  {
    code: "prices.update",
    label: "Beddel Qiimaha Iibka",
    description: "Jadwal u samee qiimo cusub oo fuustada lagu iibinayo",
    section: "stock",
    isOwnerOnlyByDefault: true
  },

  // Suppliers
  {
    code: "suppliers.view",
    label: "Eeg Keenayaasha",
    description: "Arag liiska keenayaasha shidaalka",
    section: "stock"
  },
  {
    code: "suppliers.create",
    label: "Ku dar Keene",
    description: "Diiwaangeli shirkad ama keene shidaal cusub",
    section: "stock"
  },
  {
    code: "suppliers.update",
    label: "Wax ka beddel Keene",
    description: "Wax ka beddel xogta keenaha",
    section: "stock"
  },
  {
    code: "suppliers.pay",
    label: "Bixi Lacagta Keenaha",
    description: "Diiwaangeli bixinta deynta keenaha",
    section: "stock",
    isOwnerOnlyByDefault: true
  },

  // Expenses
  {
    code: "expenses.view",
    label: "Eeg Kharashaadka",
    description: "Arag kharashaadka maamulka iyo hawlgalka",
    section: "expenses"
  },
  {
    code: "expenses.create",
    label: "Qor Kharash Cusub",
    description: "Diiwaangeli kharash ganacsi oo baxay",
    section: "expenses"
  },
  {
    code: "expenses.reverse",
    label: "Kansal garee Kharash",
    description: "Ka noqo kharash horay loo qoray",
    section: "expenses",
    isOwnerOnlyByDefault: true
  },

  // Accounts & Payments
  {
    code: "accounts.view",
    label: "Eeg Akoonnada",
    description: "Arag akoonnada lacagta (Bank, Cash, Mobile Money)",
    section: "accounts"
  },
  {
    code: "accounts.create",
    label: "Fur Akoon Cusub",
    description: "Ku dar akoon maaliyadeed oo cusub",
    section: "accounts",
    isOwnerOnlyByDefault: true
  },
  {
    code: "accounts.transfer",
    label: "Wareejin Akoonno",
    description: "Lacag ka wareeji akoon una wareeji mid kale",
    section: "accounts",
    isOwnerOnlyByDefault: true
  },
  {
    code: "accounts.movements.view",
    label: "Eeg Dhaqdhaqaaqa Akoonka",
    description: "Arag xisaab-xirka iyo dhaqdhaqaaqa maaliyadeed",
    section: "accounts"
  },
  {
    code: "payments.view",
    label: "Eeg Lacag-bixinta Macaamiisha",
    description: "Arag lacagaha ay bixiyeen macaamiishu",
    section: "accounts"
  },
  {
    code: "payments.record",
    label: "Qabo Lacag Macmiil",
    description: "Diiwaangeli lacag macmiilku bixiyay",
    section: "accounts"
  },
  {
    code: "payments.reverse",
    label: "Ka noqo Lacag Macmiil",
    description: "Kansal garee lacag-qabasho qalad ahayd",
    section: "accounts",
    isOwnerOnlyByDefault: true
  },
  {
    code: "payments.receipt.view",
    label: "Daabac Rasiidh (Receipt)",
    description: "Arag ama daabac rasiidka lacag-qabashada",
    section: "accounts"
  },

  // Reports
  {
    code: "reports.view",
    label: "Eeg Warbixinnada",
    description: "Gal qaybta warbixinnada maalinlaha iyo xisaabaadka",
    section: "reports"
  },
  {
    code: "reports.export",
    label: "Soo Deji Excel / PDF",
    description: "Soo deji faylasha Excel ama PDF ee warbixinnada",
    section: "reports",
    isOwnerOnlyByDefault: true
  },
  {
    code: "reports.financial.view",
    label: "Eeg Dakhliga & Maaliyadda",
    description: "Arag wadarta lacagaha, daymaha iyo dakhliga guud",
    section: "reports",
    isOwnerOnlyByDefault: true
  },
  {
    code: "reports.profit.view",
    label: "Eeg Faaf-faahinta Faa'iidada (Profit)",
    description: "Arag faa'iidada shidaalka laga helo",
    section: "reports",
    isOwnerOnlyByDefault: true
  },

  // Settings & System
  {
    code: "settings.view",
    label: "Eeg Dejinta",
    description: "Arag bogga guud ee dejinta nidaamka",
    section: "settings"
  },
  {
    code: "settings.manage",
    label: "Maamul Dejinta & Branding",
    description: "Beddel xogta shirkadda, logo-ga iyo qoraallada",
    section: "settings",
    isOwnerOnlyByDefault: true
  },
  {
    code: "users.manage",
    label: "Maamul Shaqaalaha",
    description: "Ku dar shaqaale cusub ama furaha ka beddel",
    section: "settings",
    isOwnerOnlyByDefault: true
  },
  {
    code: "permissions.manage",
    label: "Bixi Ogolaanshooyin",
    description: "Maamul xuquuqda iyo awoodaha shaqaalaha (Milkiile keliya)",
    section: "settings",
    isOwnerOnlyByDefault: true
  },
  {
    code: "audit.view",
    label: "Eeg Audit Log",
    description: "Arag diiwaanka wax kasta oo nidaamka laga sameeyay",
    section: "settings",
    isOwnerOnlyByDefault: true
  }
];

export const SECTION_DEFINITIONS = [
  { id: "dashboard", label: "Guudmar", icon: "LayoutGrid" },
  { id: "customers", label: "Macaamiisha", icon: "Users" },
  { id: "orders", label: "Dalabyada", icon: "ShoppingBag" },
  { id: "stock", label: "Kaydka Shidaalka", icon: "Boxes" },
  { id: "expenses", label: "Kharashaadka", icon: "Receipt" },
  { id: "accounts", label: "Akoonnada & Lacagaha", icon: "Wallet" },
  { id: "reports", label: "Warbixinnada", icon: "BarChart3" },
  { id: "settings", label: "Dejinta Nidaamka", icon: "Settings" }
] as const;

export const STANDARD_OFFICE_PERMISSIONS: PermissionCode[] = [
  "dashboard.view",
  "customers.view",
  "customers.create",
  "customers.update",
  "orders.view",
  "orders.create",
  "orders.delivery.confirm",
  "orders.invoice.view",
  "stock.view",
  "stock.receive",
  "prices.view",
  "suppliers.view",
  "suppliers.create",
  "suppliers.update",
  "expenses.view",
  "expenses.create",
  "accounts.view",
  "accounts.movements.view",
  "payments.view",
  "payments.record",
  "payments.receipt.view",
  "reports.view",
  "settings.view"
];
