/** Coerce DB/API fee values (number or numeric string) to a number. */
export function toFeeNumber(
  value: number | string | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return null;
  return amount;
}

/** Parse user fee input to a non-negative amount, or null if empty/invalid. */
export function parseFeeInput(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

export function formatFeeAmount(
  amount: number | string | null | undefined,
): string {
  const value = toFeeNumber(amount);
  if (value == null) return "—";
  const formatted = value.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `Rs ${formatted}`;
}

export function getRemainingFee(
  total: number | string | null | undefined,
  received: number | string | null | undefined,
): number | null {
  const totalAmount = toFeeNumber(total);
  const receivedAmount = toFeeNumber(received);
  if (totalAmount == null) return null;
  const paid = receivedAmount ?? 0;
  return Math.max(0, Math.round((totalAmount - paid) * 100) / 100);
}

export function feeNumberToInput(
  value: number | string | null | undefined,
): string {
  const amount = toFeeNumber(value);
  if (amount == null) return "";
  return String(amount);
}
