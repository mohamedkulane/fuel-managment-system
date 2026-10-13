import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@fuel/database";

const DAY_IN_MILLISECONDS = 86_400_000;
const MOGADISHU_UTC_OFFSET = 3 * 60 * 60 * 1000;

export type DeliveryListDateBounds = {
  requestedDateStart: Date;
  requestedDateEnd: Date;
  orderDateStart: Date;
  orderDateEnd: Date;
};

export type DeliveryListRow = {
  customer: string;
  phone: string;
  location: string;
  fuel: "Naafto" | "Basiin";
  quantity: string;
};

export type DeliveryListData = {
  date: string;
  rows: DeliveryListRow[];
};

type DeliverySheetLineSnapshot = {
  orderLineId: string;
  scheduledUnits: Prisma.Decimal;
  displayCustomerNameSnapshot: string;
  phoneSnapshot: string | null;
  addressSnapshot: string;
  orderLine: { fuel: { code: string } };
};

type DeliveryOrderLine = {
  id: string;
  requestedUnits: Prisma.Decimal;
  fuel: { code: string };
};

type DeliveryOrder = {
  id: string;
  requestedDeliveryDate: Date | null;
  orderDate: Date;
  addressSnapshot: string;
  customer: { name: string; primaryPhone: string | null };
  lines: DeliveryOrderLine[];
};

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function deliveryListDateBounds(value: string): DeliveryListDateBounds {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new BadRequestException("Date must be YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidDateParts(year, month, day)) throw new BadRequestException("Date must be a valid calendar date");

  const requestedDateStart = new Date(Date.UTC(year, month - 1, day));
  return {
    requestedDateStart,
    requestedDateEnd: new Date(requestedDateStart.getTime() + DAY_IN_MILLISECONDS),
    orderDateStart: new Date(requestedDateStart.getTime() - MOGADISHU_UTC_OFFSET),
    orderDateEnd: new Date(requestedDateStart.getTime() + DAY_IN_MILLISECONDS - MOGADISHU_UTC_OFFSET)
  };
}

export function deliveryListOrderWhere(bounds: DeliveryListDateBounds): Prisma.SalesOrderWhereInput {
  return {
    status: { notIn: ["DRAFT", "CANCELLED"] },
    OR: [
      { requestedDeliveryDate: { gte: bounds.requestedDateStart, lt: bounds.requestedDateEnd } },
      {
        requestedDeliveryDate: null,
        orderDate: { gte: bounds.orderDateStart, lt: bounds.orderDateEnd }
      }
    ]
  };
}

function fuelLabel(code: string): DeliveryListRow["fuel"] {
  if (code === "DIESEL") return "Naafto";
  if (code === "PETROL") return "Basiin";
  throw new BadRequestException("Delivery list contains an unsupported fuel type");
}

function quantityString(quantity: Prisma.Decimal): string {
  return quantity.toFixed(0);
}

export function buildDeliveryList(
  date: string,
  sheetLines: DeliverySheetLineSnapshot[],
  orders: DeliveryOrder[]
): DeliveryListData {
  const rowsByOrderLineId = new Map<string, DeliveryListRow>();

  for (const line of sheetLines) {
    rowsByOrderLineId.set(line.orderLineId, {
      customer: line.displayCustomerNameSnapshot,
      phone: line.phoneSnapshot ?? "",
      location: line.addressSnapshot,
      fuel: fuelLabel(line.orderLine.fuel.code),
      quantity: quantityString(line.scheduledUnits)
    });
  }

  for (const order of orders) {
    for (const line of order.lines) {
      if (rowsByOrderLineId.has(line.id)) continue;
      rowsByOrderLineId.set(line.id, {
        customer: order.customer.name,
        phone: order.customer.primaryPhone ?? "",
        location: order.addressSnapshot,
        fuel: fuelLabel(line.fuel.code),
        quantity: quantityString(line.requestedUnits)
      });
    }
  }

  const rows = [...rowsByOrderLineId.values()].sort((left, right) =>
    left.customer.localeCompare(right.customer, "en") || left.fuel.localeCompare(right.fuel, "en")
  );
  return { date, rows };
}
