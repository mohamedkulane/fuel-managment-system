import { z } from "zod";

export const roleSchema = z.enum(["OWNER", "OFFICE_EMPLOYEE"]);
export type Role = z.infer<typeof roleSchema>;

export const fuelCodeSchema = z.enum(["DIESEL", "PETROL"]);
export type FuelCode = z.infer<typeof fuelCodeSchema>;

export const customerStatusSchema = z.enum(["ACTIVE", "HOLD", "INACTIVE"]);
export type CustomerStatus = z.infer<typeof customerStatusSchema>;

export const decimalString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a non-negative decimal string");

export const deliveryManifestLineSchema = z.object({
  orderNo: z.string(),
  customerName: z.string(),
  phone: z.string().nullable(),
  address: z.string(),
  fuel: fuelCodeSchema,
  scheduledUnits: decimalString,
  instructions: z.string().nullable()
});
export type DeliveryManifestLine = z.infer<typeof deliveryManifestLineSchema>;

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  primaryPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  primaryPhone: z.string().optional().nullable(),
  status: customerStatusSchema.optional(),
  notes: z.string().optional().nullable(),
  address: z.string().optional().nullable()
});
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional()
});

export const invoiceStatusSchema = z.enum(["UNPAID", "PARTIALLY_PAID", "PAID", "CANCELLED", "REVERSED"]);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const paymentStatusSchema = z.enum(["POSTED", "REVERSED"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentMethodSchema = z.enum(["CASH", "BANK_TRANSFER", "EVC_PLUS", "EDAHAB", "OTHER"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const ledgerEntryTypeSchema = z.enum(["INVOICE", "PAYMENT", "PAYMENT_ALLOCATION", "REVERSAL", "CREDIT_NOTE", "ADJUSTMENT"]);
export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>;

export const createInvoiceSchema = z.object({
  deliveryConfirmationLineId: z.string().optional(),
  dispatchId: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});
export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;

export const paymentAllocationItemSchema = z.object({
  invoiceId: z.string().min(1, "invoiceId is required"),
  amount: decimalString
});
export type PaymentAllocationItemDto = z.infer<typeof paymentAllocationItemSchema>;

export const createPaymentSchema = z.object({
  customerId: z.string().min(1, "customerId is required"),
  amount: decimalString,
  paymentDate: z.string().min(1, "paymentDate is required"),
  paymentMethod: paymentMethodSchema.default("CASH"),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allocations: z.array(paymentAllocationItemSchema).optional()
});
export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;

export const reversePaymentSchema = z.object({
  reason: z.string().min(1, "Reason is required")
});
export type ReversePaymentDto = z.infer<typeof reversePaymentSchema>;

export const reverseInvoiceSchema = z.object({
  reason: z.string().min(1, "Reason is required")
});
export type ReverseInvoiceDto = z.infer<typeof reverseInvoiceSchema>;

