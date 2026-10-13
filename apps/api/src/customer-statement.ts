import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@fuel/database";

export function statementBounds(from?: string, to?: string) {
  function day(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new BadRequestException("Enter a valid date");
    return new Date(value + "T00:00:00+03:00");
  }
  const start = from ? day(from) : undefined;
  const end = to ? new Date(day(to).getTime() + 86400000) : undefined;
  if (start && end && start >= end) throw new BadRequestException("From must be before To");
  return { start, end };
}

type Entry = { id: string; occurredAt: Date; entryType: string; referenceNo: string; debitAmount: Prisma.Decimal; creditAmount: Prisma.Decimal; notes: string | null };
export function statementRows(rows: Entry[], start?: Date) {
  let opening = new Prisma.Decimal(0), running = new Prisma.Decimal(0);
  const entries = [];
  for (const row of rows) {
    running = running.add(row.debitAmount).sub(row.creditAmount);
    if (start && row.occurredAt < start) { opening = running; continue; }
    entries.push({ id: row.id, occurredAt: row.occurredAt, entryType: row.entryType, referenceNo: row.referenceNo, debitAmount: row.debitAmount.toFixed(4), creditAmount: row.creditAmount.toFixed(4), runningBalance: running.toFixed(4), notes: row.notes });
  }
  return { entries, openingBalance: opening.toFixed(4), closingBalance: running.toFixed(4) };
}
