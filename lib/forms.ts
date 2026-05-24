import { DocumentStatus } from "@prisma/client";
import { sanitizeDocumentText, sanitizeNullableDocumentText } from "@/lib/document-text";

export type ParsedLineItem = {
  description: string;
  quantity: string;
  showQuantity: boolean;
  unitPrice: string;
  lineTotal: string;
  sortOrder: number;
};

export function formString(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return sanitizeDocumentText(typeof value === "string" ? value : fallback);
}

export function nullableString(formData: FormData, key: string) {
  return sanitizeNullableDocumentText(formData.get(key));
}

export function formDate(formData: FormData, key: string, fallback = new Date()) {
  const value = formString(formData, key);
  return value ? new Date(`${value}T00:00:00`) : fallback;
}

export function nullableDate(formData: FormData, key: string) {
  const value = formString(formData, key);
  return value ? new Date(`${value}T00:00:00`) : null;
}

export function formMoney(formData: FormData, key: string, fallback = "0.00") {
  const value = formString(formData, key, fallback).replace(/,/g, "");
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : fallback;
}

export function formStatus(formData: FormData) {
  const value = formString(formData, "status", "DRAFT");
  return Object.values(DocumentStatus).includes(value as DocumentStatus)
    ? (value as DocumentStatus)
    : DocumentStatus.DRAFT;
}

export function parseLineItems(formData: FormData) {
  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const prices = formData.getAll("unitPrice").map(String);

  const items: ParsedLineItem[] = descriptions
    .map((description, index) => {
      const cleanDescription = sanitizeDocumentText(description);
      const rawQuantity = sanitizeDocumentText(quantities[index] || "");
      const showQuantity = rawQuantity.length > 0;
      const quantity = Number((showQuantity ? rawQuantity : "1").replace(/,/g, ""));
      const unitPrice = Number((prices[index] || "0").replace(/,/g, ""));
      const lineTotal = quantity * unitPrice;

      return {
        description: cleanDescription,
        quantity: Number.isFinite(quantity) ? quantity.toFixed(2) : "1.00",
        showQuantity,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice.toFixed(2) : "0.00",
        lineTotal: Number.isFinite(lineTotal) ? lineTotal.toFixed(2) : "0.00",
        sortOrder: index
      };
    })
    .filter((item) => item.description.length > 0);

  if (!items.length) {
    throw new Error("Add at least one line item.");
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);

  return {
    items,
    subtotal: subtotal.toFixed(2),
    total: subtotal.toFixed(2)
  };
}
