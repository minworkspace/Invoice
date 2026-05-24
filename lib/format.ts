import type { Decimal } from "@prisma/client/runtime/library";

export function money(value: Decimal | number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2
  }).format(amount);
}

export function moneyPlain(value: Decimal | number | string | null | undefined) {
  return money(value)
    .replace(/^MYR\s*/i, "")
    .replace(/^RM\s*/i, "")
    .trim();
}

export function shortDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function dateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function decimalInput(value: Decimal | number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export function compactStatus(status: string) {
  return status.toLowerCase().replace(/^\w/, (match) => match.toUpperCase());
}

export function absoluteAppUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
