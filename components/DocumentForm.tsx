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
import { documentTotal, lineTotal } from "@/lib/document-calculations";

type CustomerOption = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
};

type CompanyPreview = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  ssmNumber?: string | null;
};

type ItemInput = {
  description: string;
  quantity: string;
  unitPrice: string;
};

type DocumentFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  company: CompanyPreview;
  customers: CustomerOption[];
  documentId?: string;
  initialPreviewMode?: "live" | "final";
  pdfUrl?: string | null;
  pdfNeedsRegeneration?: boolean;
  kind: "invoice" | "quotation";
  submitLabel: string;
  suggestedNumber?: string;
  initial?: {
    documentNumber?: string;
    customerId?: string;
    status?: string;
    issueDate?: string;
    dueDate?: string;
    validUntil?: string;
    paidAmount?: string;
    refundableDeposit?: string;
    importantNotes?: string;
    paymentInfo?: string;
    remarks?: string;
    templateKey?: string;
    items?: ItemInput[];
  };
};

const statuses = ["DRAFT", "SENT", "CONFIRMED", "PAID", "CANCELLED"];

function blankItem(): ItemInput {
  return { description: "", quantity: "", unitPrice: "0.00" };
}

function moneyPlain(value: string | number) {
  const amount = Number(value || 0);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    : "0.00";
}

export function DocumentForm({
  action,
  company,
  customers,
  documentId,
  initialPreviewMode = "live",
  pdfUrl,
  pdfNeedsRegeneration,
  kind,
  submitLabel,
  suggestedNumber,
  initial
}: DocumentFormProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [documentNumber, setDocumentNumber] = useState(initial?.documentNumber || "");
  const [customerId, setCustomerId] = useState(initial?.customerId || "");
  const [status, setStatus] = useState(initial?.status || "DRAFT");
  const [issueDate, setIssueDate] = useState(initial?.issueDate || "");
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [paidAmount, setPaidAmount] = useState(initial?.paidAmount || "0.00");
  const [refundableDeposit, setRefundableDeposit] = useState(initial?.refundableDeposit || "0.00");
  const [importantNotes, setImportantNotes] = useState(initial?.importantNotes || "");
  const [paymentInfo, setPaymentInfo] = useState(initial?.paymentInfo || "");
  const [remarks, setRemarks] = useState(initial?.remarks || "");
  const [templateKey, setTemplateKey] = useState<DocumentTemplateKey>(
    getDocumentTemplate(initial?.templateKey).key as DocumentTemplateKey
  );
  const [items, setItems] = useState<ItemInput[]>(initial?.items?.length ? initial.items : [blankItem()]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) || null,
    [customerId, customers]
  );

  const normalizedItems = useMemo(
    () =>
      items.map((item) => {
        return { ...item, lineTotal: lineTotal(item.quantity, item.unitPrice) };
      }),
    [items]
  );

  const subtotal = useMemo(() => documentTotal(normalizedItems), [normalizedItems]);
  const depositAmount = Number(String(refundableDeposit || "0").replace(/,/g, ""));
  const displayTotal = kind === "invoice" ? subtotal + (Number.isFinite(depositAmount) ? depositAmount : 0) : subtotal;

  function markDirty() {
    setIsDirty(true);
  }

  function updateItem(index: number, patch: Partial<ItemInput>) {
    markDirty();
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  const documentLabel = kind === "invoice" ? "Invoice" : "Quotation";
  const numberLabel = kind === "invoice" ? "Invoice number" : "Quotation number";
  const previewNumber = documentNumber || suggestedNumber || `${kind === "invoice" ? "INV" : "QUO"}-00000`;

  return (
    <form action={action} className="space-y-4">
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white/95 px-4 py-3 shadow-soft backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{documentLabel} editor</p>
          <p className="text-sm text-muted">Edit the document and review the live preview beside it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" type="button" onClick={() => setShowPreview((current) => !current)}>
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
          <button className="btn btn-primary" type="submit">
            {submitLabel}
          </button>
        </div>
      </div>

      <div className={`grid gap-5 ${showPreview ? "lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]" : "grid-cols-1"}`}>
        <div className="order-1 space-y-5">
          <section className="panel">
            <SectionHeading title={`${documentLabel} details`} description="Customer, numbering, dates, and status." />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="label">{numberLabel}</span>
                <input
                  className="field"
                  name="documentNumber"
                  value={documentNumber}
                  onChange={(event) => {
                    markDirty();
                    setDocumentNumber(event.target.value);
                  }}
                  placeholder={suggestedNumber ? `Auto: ${suggestedNumber}` : ""}
                />
              </label>
              <label>
                <span className="label">Customer</span>
                <select
                  className="field"
                  name="customerId"
                  value={customerId}
                  onChange={(event) => {
                    markDirty();
                    setCustomerId(event.target.value);
                  }}
                  required
                >
                  <option value="" disabled>
                    Select customer
                  </option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
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
                  {documentTemplateOptions.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Issue date</span>
                <input
                  className="field"
                  name="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(event) => {
                    markDirty();
                    setIssueDate(event.target.value);
                  }}
                  required
                />
              </label>
              {kind === "invoice" ? (
                <>
                  <label>
                    <span className="label">Due date</span>
                    <input
                      className="field"
                      name="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(event) => {
                        markDirty();
                        setDueDate(event.target.value);
                      }}
                    />
                  </label>
                  <label>
                    <span className="label">Paid amount</span>
                    <input
                      className="field"
                      name="paidAmount"
                      inputMode="decimal"
                      value={paidAmount}
                      onChange={(event) => {
                        markDirty();
                        setPaidAmount(event.target.value);
                      }}
                    />
                  </label>
                  <label>
                    <span className="label">Refundable deposit</span>
                    <input
                      className="field"
                      name="refundableDeposit"
                      inputMode="decimal"
                      value={refundableDeposit}
                      onChange={(event) => {
                        markDirty();
                        setRefundableDeposit(event.target.value);
                      }}
                    />
                  </label>
                </>
              ) : null}
            </div>

            <div className="mt-4 rounded-md border border-line bg-paper p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Customer details</p>
              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <p>
                  <span className="text-muted">Name: </span>
                  <span className="font-semibold">{selectedCustomer?.name || "Select a customer"}</span>
                </p>
                <p>
                  <span className="text-muted">Phone: </span>
                  {selectedCustomer?.phone || selectedCustomer?.whatsapp || "-"}
                </p>
                <p className="md:col-span-2">
                  <span className="text-muted">Address: </span>
                  {selectedCustomer?.address || "-"}
                </p>
              </div>
            </div>
          </section>

          <section className="panel space-y-4">
            <div className="flex items-center justify-between gap-3">
              <SectionHeading title="Item details" description="Leave qty empty when you want the amount to print as the total only." />
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  markDirty();
                  setItems((current) => [...current, blankItem()]);
                }}
              >
                Add item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => {
                const lineTotal = normalizedItems[index]?.lineTotal ?? 0;
                return (
                  <div key={index} className="grid gap-3 rounded-md border border-line bg-paper p-3 lg:grid-cols-[90px_1fr_1fr_auto]">
                    <label className="lg:col-span-4">
                      <span className="label">Description</span>
                      <textarea
                        className="field min-h-24"
                        name="description"
                        value={item.description}
                        onChange={(event) => updateItem(index, { description: event.target.value })}
                        placeholder="Item description, rental date, destination..."
                        required
                      />
                    </label>
                    <label>
                      <span className="label">Qty</span>
                      <input
                        className="field"
                        name="quantity"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(event) => updateItem(index, { quantity: event.target.value })}
                        placeholder="-"
                      />
                    </label>
                    <label>
                      <span className="label">Unit price</span>
                      <input
                        className="field"
                        name="unitPrice"
                        inputMode="decimal"
                        value={item.unitPrice}
                        onChange={(event) => updateItem(index, { unitPrice: event.target.value })}
                      />
                    </label>
                    <div>
                      <span className="label">Line total</span>
                      <div className="field bg-white/70 text-right">{moneyPlain(lineTotal)}</div>
                    </div>
                    <div className="flex items-end">
                      <button
                        className="btn btn-secondary w-full"
                        type="button"
                        onClick={() => {
                          markDirty();
                          setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
                        }}
                        disabled={items.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end border-t border-line pt-4">
              <div className="min-w-64 rounded-md bg-white p-4 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total</p>
                <p className="mt-1 text-2xl font-bold">RM {moneyPlain(displayTotal)}</p>
              </div>
            </div>
          </section>

          <section className="panel grid gap-4 lg:grid-cols-3">
            <label>
              <span className="label">Important notes</span>
              <textarea
                className="field min-h-36"
                name="importantNotes"
                value={importantNotes}
                onChange={(event) => {
                  markDirty();
                  setImportantNotes(event.target.value);
                }}
              />
            </label>
            <label>
              <span className="label">Payment info</span>
              <textarea
                className="field min-h-36"
                name="paymentInfo"
                value={paymentInfo}
                onChange={(event) => {
                  markDirty();
                  setPaymentInfo(event.target.value);
                }}
              />
            </label>
            <label>
              <span className="label">Remarks</span>
              <textarea
                className="field min-h-36"
                name="remarks"
                value={remarks}
                onChange={(event) => {
                  markDirty();
                  setRemarks(event.target.value);
                }}
              />
            </label>
          </section>

          <div className="flex justify-end gap-2">
            <button className="btn btn-primary" type="submit">
              {submitLabel}
            </button>
          </div>
        </div>

        {showPreview ? (
          <aside className="order-2 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
            <DocumentLivePreview
              company={company}
              customer={selectedCustomer}
              documentLabel={documentLabel}
              documentNumber={previewNumber}
              dueDate={dueDate}
              importantNotes={importantNotes}
              issueDate={issueDate}
              items={normalizedItems}
              kind={kind}
              paidAmount={paidAmount}
              paymentInfo={paymentInfo}
              refundableDeposit={refundableDeposit}
              remarks={remarks}
              status={status}
              templateKey={templateKey}
              total={subtotal}
              documentId={documentId}
              documentType={kind === "invoice" ? "INVOICE" : "QUOTATION"}
              pdfNeedsRegeneration={pdfNeedsRegeneration}
              pdfUrl={pdfUrl}
              hasUnsavedChanges={isDirty}
              initialPreviewMode={initialPreviewMode}
            />
          </aside>
        ) : null}
      </div>
    </form>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

function DocumentLivePreview({
  company,
  customer,
  documentLabel,
  documentNumber,
  dueDate,
  importantNotes,
  issueDate,
  items,
  kind,
  paidAmount,
  paymentInfo,
  refundableDeposit,
  remarks,
  status,
  templateKey,
  total,
  documentId,
  documentType,
  pdfNeedsRegeneration,
  pdfUrl,
  hasUnsavedChanges,
  initialPreviewMode,
}: {
  company: CompanyPreview;
  customer: CustomerOption | null;
  documentLabel: string;
  documentNumber: string;
  dueDate: string;
  importantNotes: string;
  issueDate: string;
  items: Array<ItemInput & { lineTotal: number }>;
  kind: "invoice" | "quotation";
  paidAmount: string;
  paymentInfo: string;
  refundableDeposit: string;
  remarks: string;
  status: string;
  templateKey: DocumentTemplateKey;
  total: number;
  documentId?: string;
  documentType: "INVOICE" | "QUOTATION";
  pdfNeedsRegeneration?: boolean;
  pdfUrl?: string | null;
  hasUnsavedChanges?: boolean;
  initialPreviewMode?: "live" | "final";
}) {
  const template = getDocumentTemplate(templateKey);
  const [previewMode, setPreviewMode] = useState<"live" | "final">(initialPreviewMode || "live");
  const previewItems = items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    showQuantity: item.quantity !== "",
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal
  }));

  return (
    <div className="h-full overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{previewMode === "live" ? "Live preview" : "Final PDF preview"}</p>
          <p className="text-sm font-semibold text-ink">{documentLabel} · {template.name}</p>
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
            documentType={documentType}
            hasUnsavedChanges={hasUnsavedChanges}
            pdfNeedsRegeneration={pdfNeedsRegeneration}
            pdfUrl={pdfUrl}
          />
        ) : template.key === "clean" ? (
          <CleanDocumentPreview
            company={company}
            customer={customer}
            documentNumber={documentNumber}
            dueDate={dueDate}
            importantNotes={importantNotes}
            issueDate={issueDate}
            items={previewItems}
            kind={kind}
            paidAmount={paidAmount}
            paymentInfo={paymentInfo}
            previewMode
            refundableDeposit={refundableDeposit}
            remarks={remarks}
            total={total}
          />
        ) : (
          <ClassicDocumentPreview
            company={company}
            customer={customer}
            documentNumber={documentNumber}
            dueDate={dueDate}
            importantNotes={importantNotes}
            issueDate={issueDate}
            items={previewItems}
            kind={kind}
            paidAmount={paidAmount}
            paymentInfo={paymentInfo}
            previewMode
            refundableDeposit={refundableDeposit}
            remarks={remarks}
            total={total}
          />
        )}
      </div>
    </div>
  );
}
