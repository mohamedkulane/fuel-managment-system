import { z } from "zod";

export const roleSchema = z.enum(["OWNER", "OFFICE_EMPLOYEE"]);
export type Role = z.infer<typeof roleSchema>;

export const fuelCodeSchema = z.enum(["DIESEL", "PETROL"]);
export type FuelCode = z.infer<typeof fuelCodeSchema>;

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
