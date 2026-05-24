export function numericAmount(value: string | number | null | undefined, fallback = 0) {
  const amount = Number(String(value ?? fallback).replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : fallback;
}

export function lineTotal(quantity: string | number | null | undefined, unitPrice: string | number | null | undefined) {
  const hasQuantity = String(quantity ?? "").trim().length > 0;
  return numericAmount(hasQuantity ? quantity : 1) * numericAmount(unitPrice);
}

export function documentTotal(items: Array<{ lineTotal: number }>) {
  return items.reduce((sum, item) => sum + item.lineTotal, 0);
}
