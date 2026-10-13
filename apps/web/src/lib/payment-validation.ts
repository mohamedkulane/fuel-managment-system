import Decimal from "decimal.js";
export function payableDebt(debt: string, credit: string) { return Decimal.max(0, new Decimal(debt).sub(credit)); }
export function paymentError(amount: string, payable: Decimal): string | null {
  if (payable.lte(0)) return "No debt to pay";
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || new Decimal(amount).lte(0)) return "Enter a positive amount with up to two decimals.";
  if (new Decimal(amount).gt(payable)) return `Debt is $${payable.toFixed(2)}. You cannot pay more.`;
  return null;
}
