import { DocumentStatus } from "@prisma/client";

type InvoiceAmountInput = {
  total: unknown;
  refundableDeposit?: unknown;
  paidAmount?: unknown;
  status?: DocumentStatus | string | null;
  receipt?: {
    amount?: unknown;
    status?: DocumentStatus | string | null;
  } | null;
};

export function amountNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function invoiceGrandTotal(invoice: InvoiceAmountInput) {
  return amountNumber(invoice.total) + amountNumber(invoice.refundableDeposit);
}

export function invoiceRecordedPaid(invoice: InvoiceAmountInput) {
  const receiptPaid = invoice.receipt?.status === DocumentStatus.PAID ? amountNumber(invoice.receipt.amount) : 0;
  const recordedPaid = Math.max(amountNumber(invoice.paidAmount), receiptPaid);

  if (invoice.status === DocumentStatus.PAID) {
    return Math.max(recordedPaid, invoiceGrandTotal(invoice));
  }

  return recordedPaid;
}

export function invoiceOutstandingBalance(invoice: InvoiceAmountInput) {
  return Math.max(invoiceGrandTotal(invoice) - invoiceRecordedPaid(invoice), 0);
}
