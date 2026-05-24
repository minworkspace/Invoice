"use client";

import { useMemo, useState } from "react";
import {
  documentTemplateOptions,
  getDocumentTemplate,
  type DocumentTemplateKey
} from "@/components/document-templates/template-registry";
import { ClassicDocumentPreview } from "@/components/document-templates/ClassicDocumentPreview";
import { CleanDocumentPreview } from "@/components/document-templates/CleanDocumentPreview";
import { FinalPdfPreviewFrame } from "@/components/FinalPdfPreviewFrame";

type ReceiptFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  documentId?: string;
  initialPreviewMode?: "live" | "final";
  pdfUrl?: string | null;
  pdfNeedsRegeneration?: boolean;
  company: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    chopUrl?: string | null;
    ssmNumber?: string | null;
    paymentInfo?: string | null;
    importantNotes?: string | null;
  };
  customer: {
    name: string;
    phone?: string | null;
    address?: string | null;
  };
  invoice: {
    invoiceNumber: string;
    items: Array<{
      description: string;
      lineTotal: string;
    }>;
  };
  initial: {
    receiptNumber: string;
    receiptDate: string;
    status: string;
    amount: string;
    paymentMethod?: string | null;
    notes?: string | null;
    templateKey?: string | null;
  };
};

const statuses = ["DRAFT", "SENT", "CONFIRMED", "PAID", "CANCELLED"];

export function ReceiptForm({
  action,
  documentId,
  initialPreviewMode = "live",
  pdfUrl,
  pdfNeedsRegeneration,
  company,
  customer,
  invoice,
  initial
}: ReceiptFormProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [previewMode, setPreviewMode] = useState<"live" | "final">(initialPreviewMode);
  const [isDirty, setIsDirty] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState(initial.receiptNumber);
  const [receiptDate, setReceiptDate] = useState(initial.receiptDate);
  const [status, setStatus] = useState(initial.status);
  const [amount, setAmount] = useState(initial.amount);
  const [paymentMethod, setPaymentMethod] = useState(initial.paymentMethod || "");
  const [notes, setNotes] = useState(initial.notes || "");
  const [templateKey, setTemplateKey] = useState<DocumentTemplateKey>(
    getDocumentTemplate(initial.templateKey).key as DocumentTemplateKey
  );
  const template = getDocumentTemplate(templateKey);

  const items = useMemo(
    () => invoice.items.map((item) => ({ ...item, lineTotalNumber: Number(item.lineTotal || 0) })),
    [invoice.items]
  );

  function markDirty() {
    setIsDirty(true);
  }

  return (
    <form action={action} className="space-y-4">
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white/95 px-4 py-3 shadow-soft backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Receipt editor</p>
          <p className="text-sm text-muted">Edit receipt details and review the live preview beside it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" type="button" onClick={() => setShowPreview((current) => !current)}>
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
          <button className="btn btn-primary" type="submit">
            Save receipt
          </button>
        </div>
      </div>

      <div className={`grid gap-5 ${showPreview ? "lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]" : "grid-cols-1"}`}>
        <div className="order-1 space-y-5">
          <section className="panel">
            <h3 className="text-lg font-bold">Receipt details</h3>
            <p className="mt-1 text-sm text-muted">Receipt number, payment date, amount, and notes.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="label">Receipt number</span>
                <input
                  className="field"
                  name="receiptNumber"
                  value={receiptNumber}
                  onChange={(event) => {
                    markDirty();
                    setReceiptNumber(event.target.value);
                  }}
                  required
                />
              </label>
              <label>
                <span className="label">Status</span>
                <select
                  className="field"
                  name="status"
                  value={status}
                  onChange={(event) => {
                    markDirty();
                    setStatus(event.target.value);
                  }}
                >
                  {statuses.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Template</span>
                <select
                  className="field"
                  name="templateKey"
                  value={templateKey}
                  onChange={(event) => {
                    markDirty();
                    setTemplateKey(getDocumentTemplate(event.target.value).key as DocumentTemplateKey);
                  }}
                >
                  {documentTemplateOptions.map((templateOption) => (
                    <option key={templateOption.key} value={templateOption.key}>
                      {templateOption.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Receipt date</span>
                <input
                  className="field"
                  name="receiptDate"
                  type="date"
                  value={receiptDate}
                  onChange={(event) => {
                    markDirty();
                    setReceiptDate(event.target.value);
                  }}
                  required
                />
              </label>
              <label>
                <span className="label">Amount</span>
                <input
                  className="field"
                  name="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => {
                    markDirty();
                    setAmount(event.target.value);
                  }}
                />
              </label>
              <label className="md:col-span-2">
                <span className="label">Payment method</span>
                <input
                  className="field"
                  name="paymentMethod"
                  value={paymentMethod}
                  onChange={(event) => {
                    markDirty();
                    setPaymentMethod(event.target.value);
                  }}
                  placeholder="Bank transfer, cash, card..."
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <h3 className="text-lg font-bold">Customer and invoice</h3>
            <div className="mt-4 grid gap-3 rounded-md border border-line bg-paper p-4 text-sm md:grid-cols-2">
              <p>
                <span className="text-muted">Customer: </span>
                <span className="font-semibold">{customer.name}</span>
              </p>
              <p>
                <span className="text-muted">Invoice: </span>
                <span className="font-semibold">{invoice.invoiceNumber}</span>
              </p>
              <p className="md:col-span-2">
                <span className="text-muted">Address: </span>
                {customer.address || "-"}
              </p>
            </div>
          </section>

          <section className="panel">
            <label>
              <span className="label">Remarks</span>
              <textarea
                className="field min-h-40"
                name="notes"
                value={notes}
                onChange={(event) => {
                  markDirty();
                  setNotes(event.target.value);
                }}
              />
            </label>
          </section>
        </div>

        {showPreview ? (
          <aside className="order-2 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
            <div className="h-full overflow-hidden rounded-lg border border-line bg-white shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{previewMode === "live" ? "Live preview" : "Final PDF preview"}</p>
                  <p className="text-sm font-semibold text-ink">Receipt · {template.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md border border-line bg-white p-1 text-xs font-semibold">
                    <button
                      className={`rounded px-2 py-1 ${previewMode === "live" ? "bg-ink text-white" : "text-muted"}`}
                      type="button"
                      onClick={() => setPreviewMode("live")}
                    >
                      Live Preview
                    </button>
                    <button
                      className={`rounded px-2 py-1 ${previewMode === "final" ? "bg-ink text-white" : "text-muted"}`}
                      type="button"
                      onClick={() => setPreviewMode("final")}
                    >
                      Preview Final PDF
                    </button>
                  </div>
                  <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted">{status}</span>
                </div>
              </div>
              <div className="h-[calc(100%-70px)] overflow-auto bg-[#F7F8F5] p-4">
                {previewMode === "final" ? (
                  <FinalPdfPreviewFrame
                    documentId={documentId}
                    documentType="RECEIPT"
                    hasUnsavedChanges={isDirty}
                    pdfNeedsRegeneration={pdfNeedsRegeneration}
                    pdfUrl={pdfUrl}
                  />
                ) : template.key === "clean" ? (
                  <CleanDocumentPreview
                    chopUrl={company.chopUrl}
                    company={company}
                    customer={customer}
                    documentNumber={receiptNumber}
                    importantNotes={company.importantNotes}
                    issueDate={receiptDate}
                    items={items.map((item) => ({
                      description: item.description,
                      lineTotal: item.lineTotalNumber,
                      showQuantity: false
                    }))}
                    kind="receipt"
                    paidAmount={amount}
                    paymentInfo={company.paymentInfo}
                    previewMode
                    remarks={notes}
                    total={amount}
                  />
                ) : (
                  <ClassicDocumentPreview
                    chopUrl={company.chopUrl}
                    company={company}
                    customer={customer}
                    documentNumber={receiptNumber}
                    importantNotes={company.importantNotes}
                    issueDate={receiptDate}
                    items={items.map((item) => ({
                      description: item.description,
                      lineTotal: item.lineTotalNumber,
                      showQuantity: false
                    }))}
                    kind="receipt"
                    paidAmount={amount}
                    paymentInfo={company.paymentInfo}
                    previewMode
                    remarks={notes}
                    total={amount}
                  />
                )}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </form>
  );
}
