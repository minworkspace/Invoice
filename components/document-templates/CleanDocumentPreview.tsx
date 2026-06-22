import {
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_WIDTH,
  estimatePreviewRowHeight,
  paginateDocumentItems
} from "@/lib/document-pagination";
import { CLEAN_LAYOUT, PDF_TO_PREVIEW, previewPx } from "@/lib/document-layout";
import { hasDocumentText, joinDocumentText, sanitizeDocumentText, sanitizePhoneDisplay } from "@/lib/document-text";

type CleanPreviewCompany = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  ssmNumber?: string | null;
};

type CleanPreviewCustomer = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

type CleanPreviewItem = {
  id?: string;
  description?: string | null;
  quantity?: string | number | null;
  showQuantity?: boolean;
  unitPrice?: string | number | null;
  lineTotal?: string | number | null;
};

type CleanDocumentPreviewProps = {
  kind: "invoice" | "quotation" | "receipt";
  company: CleanPreviewCompany;
  customer?: CleanPreviewCustomer | null;
  documentNumber: string;
  issueDate?: string | Date | null;
  dueDate?: string | Date | null;
  items: CleanPreviewItem[];
  total: string | number;
  paidAmount?: string | number | null;
  refundableDeposit?: string | number | null;
  paymentInfo?: string | null;
  importantNotes?: string | null;
  remarks?: string | null;
  chopUrl?: string | null;
  previewMode?: boolean;
  size?: "live" | "page";
};

function numeric(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function cleanMoney(value: string | number | null | undefined) {
  return `MYR ${new Intl.NumberFormat("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numeric(value))}`;
}

function cleanDate(value?: string | Date | null) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function documentTitle(kind: CleanDocumentPreviewProps["kind"]) {
  if (kind === "quotation") return "QUOTATION";
  if (kind === "receipt") return "RECEIPT";
  return "INVOICE";
}

function plainDocumentNumber(value: string) {
  const cleanValue = sanitizeDocumentText(value);
  const plain = cleanValue.replace(/^[A-Za-z-]+/, "");
  return plain || cleanValue || "0000";
}

function placeholder(value: string | null | undefined, label: string, previewMode: boolean) {
  const cleanValue = sanitizeDocumentText(value);
  if (cleanValue) return cleanValue;
  return previewMode ? label : "";
}

function itemDescriptionParts(description?: string | null) {
  const lines = sanitizeDocumentText(description).split("\n");
  const title = lines.shift()?.trim() || "";
  return { title, detail: lines.join("\n").trim() };
}

function hasQuantity(item: CleanPreviewItem) {
  return item.showQuantity !== false && item.quantity !== "" && item.quantity !== null && item.quantity !== undefined;
}

function estimateSummaryHeight({
  remarks,
  paymentInfo,
  importantNotes,
  previewMode
}: Pick<CleanDocumentPreviewProps, "remarks" | "paymentInfo" | "importantNotes" | "previewMode">) {
  const charsPerLine = 78;
  const lineHeight = 19;
  const visibleSections = [remarks, paymentInfo, importantNotes].filter(hasDocumentText).length || (previewMode ? 3 : 0);
  const sectionText = joinDocumentText([remarks, paymentInfo, importantNotes]);
  return 72 + visibleSections * 24 + estimatePreviewRowHeight(sectionText, { baseHeight: 0, charsPerLine, lineHeight });
}

export function CleanDocumentPreview({
  kind,
  company,
  customer,
  documentNumber,
  issueDate,
  dueDate,
  items,
  total,
  paidAmount,
  refundableDeposit,
  paymentInfo,
  importantNotes,
  remarks,
  chopUrl,
  previewMode = false,
  size = "live"
}: CleanDocumentPreviewProps) {
  const title = documentTitle(kind);
  const deposit = numeric(refundableDeposit);
  const displayTotal = kind === "invoice" || kind === "receipt" ? numeric(total) + deposit : numeric(total);
  const balanceDue = kind === "invoice" || kind === "receipt" ? Math.max(displayTotal - numeric(paidAmount), 0) : displayTotal;
  const amountLabel = kind === "receipt" ? "Amount Paid:" : kind === "invoice" ? "Balance Due:" : "Total:";
  const amountValue = kind === "receipt" ? numeric(paidAmount ?? displayTotal) : balanceDue;
  const muted = "text-[#6D6D6D]";
  const tableGridStyle = {
    gridTemplateColumns: [
      CLEAN_LAYOUT.table.item.width,
      CLEAN_LAYOUT.table.quantity.width,
      CLEAN_LAYOUT.table.rate.width,
      CLEAN_LAYOUT.table.amount.width
    ].map(previewPx).join(" ")
  };
  const tablePaddingStyle = {
    paddingLeft: previewPx(CLEAN_LAYOUT.table.paddingX),
    paddingRight: previewPx(CLEAN_LAYOUT.table.paddingX)
  };
  const summaryGridStyle = {
    width: previewPx(CLEAN_LAYOUT.summary.width),
    gridTemplateColumns: `${previewPx(CLEAN_LAYOUT.summary.labelWidth)} ${previewPx(CLEAN_LAYOUT.summary.amountWidth)}`,
    columnGap: previewPx(CLEAN_LAYOUT.summary.amountX - (CLEAN_LAYOUT.summary.labelX + CLEAN_LAYOUT.summary.labelWidth)),
    paddingLeft: previewPx(CLEAN_LAYOUT.summary.labelX - CLEAN_LAYOUT.summary.x),
    paddingRight: previewPx(CLEAN_LAYOUT.summary.x + CLEAN_LAYOUT.summary.width - (CLEAN_LAYOUT.summary.amountX + CLEAN_LAYOUT.summary.amountWidth))
  };
  const titleBlockStyle = {
    width: previewPx(CLEAN_LAYOUT.title.width),
    marginRight: previewPx(CLEAN_LAYOUT.page.rightEdge - CLEAN_LAYOUT.page.rightTextEdge)
  };
  const billToStyle = {
    width: previewPx(CLEAN_LAYOUT.billTo.width)
  };
  const printableItems = items.filter((item) => hasDocumentText(item.description) || numeric(item.lineTotal || item.unitPrice) > 0);
  const displayItems: CleanPreviewItem[] = printableItems.length
    ? printableItems
    : [{ description: previewMode ? "Item description" : "", lineTotal: 0, showQuantity: false }];
  const allItems =
    (kind === "invoice" || kind === "receipt") && deposit > 0
      ? [...displayItems, { description: "Refundable Deposit", lineTotal: deposit, showQuantity: false }]
      : displayItems;
  const itemHeight = (item: CleanPreviewItem) =>
    estimatePreviewRowHeight(sanitizeDocumentText(item.description) || " ", {
      baseHeight: 30,
      charsPerLine: 46,
      lineHeight: 19
    });
  const itemAreaHeight = (CLEAN_LAYOUT.table.bottom - (CLEAN_LAYOUT.table.top + CLEAN_LAYOUT.table.itemStartOffset)) * PDF_TO_PREVIEW;
  const summaryHeight = estimateSummaryHeight({ remarks, paymentInfo, importantNotes, previewMode });
  const itemPages = paginateDocumentItems(allItems, {
    firstPageHeight: itemAreaHeight,
    nextPageHeight: itemAreaHeight,
    getItemHeight: itemHeight,
    orphanReservedHeight: 28
  });
  const lastItemsHeight = itemPages.at(-1)?.reduce((sum, item) => sum + itemHeight(item), 0) || 0;
  const summaryFitsOnLastItemPage = lastItemsHeight + summaryHeight <= itemAreaHeight;
  const needsSummaryPage = !summaryFitsOnLastItemPage;
  const totalPages = itemPages.length + (needsSummaryPage ? 1 : 0);
  const pageClass = "relative h-[1123px] w-[794px] overflow-hidden bg-white text-[16px] text-[#2A2A2A] shadow-soft print:shadow-none";
  const pageStyle = {
    paddingTop: previewPx(CLEAN_LAYOUT.page.paddingTop),
    paddingBottom: previewPx(CLEAN_LAYOUT.page.paddingBottom),
    paddingLeft: previewPx(CLEAN_LAYOUT.page.marginLeft),
    paddingRight: previewPx(CLEAN_LAYOUT.page.marginRight)
  };
  const liveScale = 0.64;
  const titleClass = "text-[46px]";
  const numberClass = "text-[18px]";
  const topGap = "mt-[60px]";
  const tableGap = "mt-[56px]";
  const sectionGap = "mt-10";

  function renderHeader() {
    return (
      <>
        <div className="flex items-start justify-between gap-8">
          <div className="max-w-[300px]">
            <p className="font-bold">{placeholder(company.name, "Company name", previewMode)}</p>
            {hasDocumentText(company.ssmNumber) ? <p className={`${muted} mt-1 italic`}>(SSM: {sanitizeDocumentText(company.ssmNumber)})</p> : null}
            <p className={`${muted} mt-2 whitespace-pre-line leading-relaxed`}>{placeholder(joinDocumentText([company.email, sanitizePhoneDisplay(company.phone), company.address]), "Company details", previewMode)}</p>
          </div>

          <div className="text-right" style={titleBlockStyle}>
            <h1 className={`${titleClass} font-normal leading-none tracking-normal text-[#333333]`}>{title}</h1>
            <p className={`${numberClass} mt-3 font-semibold text-[#777777]`}># {plainDocumentNumber(documentNumber)}</p>
          </div>
        </div>

        <div className={`${topGap} flex items-start justify-between`}>
          <div style={billToStyle}>
            <p className={muted}>Bill To:</p>
            <p className="mt-2 font-bold">{placeholder(customer?.name, "Customer name", previewMode)}</p>
            <p className={`${muted} mt-2 whitespace-pre-line leading-relaxed`}>{placeholder(joinDocumentText([customer?.email, sanitizePhoneDisplay(customer?.phone), customer?.address]), "Customer details", previewMode)}</p>
          </div>

          <div>
            <div className="ml-auto grid text-right" style={summaryGridStyle}>
              <p className={muted}>Date:</p>
              <p>{placeholder(cleanDate(issueDate), "Issue date", previewMode)}</p>
              {kind === "invoice" && dueDate ? (
                <>
                  <p className={muted}>Due Date:</p>
                  <p>{cleanDate(dueDate)}</p>
                </>
              ) : null}
            </div>
            <div className="mt-3 ml-auto grid rounded bg-[#F3F3F3] py-3 text-right font-bold" style={summaryGridStyle}>
              <p>{amountLabel}</p>
              <p className="whitespace-nowrap">{cleanMoney(amountValue)}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderTable(pageItems: CleanPreviewItem[], pageIndex: number) {
    return (
      <div className={tableGap}>
        <div
          className="grid rounded-t bg-[#3A3A3A] py-3 font-bold text-white"
          style={{ ...tableGridStyle, ...tablePaddingStyle, fontSize: previewPx(9) }}
        >
          <p>Item</p>
          <p className="text-right">Quantity</p>
          <p className="text-right">Rate</p>
          <p className="text-right">Amount</p>
        </div>
        <div className="divide-y divide-[#E7E7E7]">
          {pageItems.map((item, index) => {
            const parts = itemDescriptionParts(item.description);
            const showQty = hasQuantity(item);
            const key = `${pageIndex}-${item.id || `${parts.title}-${index}`}`;

            return (
              <div key={key} className="grid py-4" style={{ ...tableGridStyle, ...tablePaddingStyle, fontSize: previewPx(9) }}>
                <div>
                  <p className="font-bold">{placeholder(parts.title, "Item", previewMode)}</p>
                  {parts.detail || previewMode ? (
                    <p className={`${muted} mt-2 whitespace-pre-line break-words leading-relaxed`} style={{ fontSize: previewPx(8) }}>
                      {placeholder(parts.detail, "Description", previewMode)}
                    </p>
                  ) : null}
                </div>
                <p className="text-right">{showQty ? Number(item.quantity).toFixed(2) : ""}</p>
                <p className="text-right">{showQty ? cleanMoney(item.unitPrice) : ""}</p>
                <p className="text-right">{cleanMoney(item.lineTotal ?? item.unitPrice)}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderSummary() {
    return (
      <>
        <div className="mt-10 ml-auto grid gap-y-3 text-right" style={summaryGridStyle}>
          <p className={muted}>Total:</p>
          <p>{cleanMoney(displayTotal)}</p>
          {kind === "invoice" && numeric(paidAmount) > 0 ? (
            <>
              <p className={muted}>Paid:</p>
              <p>{cleanMoney(paidAmount)}</p>
              <p className="font-bold">Balance Due:</p>
              <p className="font-bold">{cleanMoney(balanceDue)}</p>
            </>
          ) : null}
          {kind === "receipt" ? (
            <>
              <p className={muted}>Paid:</p>
              <p>{cleanMoney(paidAmount ?? displayTotal)}</p>
              {balanceDue > 0 ? (
                <>
                  <p className="font-bold">Balance Due:</p>
                  <p className="font-bold">{cleanMoney(balanceDue)}</p>
                </>
              ) : null}
            </>
          ) : null}
        </div>

        {kind === "receipt" && chopUrl ? (
          <div className="mt-6 flex justify-end">
            <img alt={`${company.name} chop`} className="h-[92px] w-[220px] object-contain" src={chopUrl} />
          </div>
        ) : null}

        <div className={`${sectionGap} space-y-5 leading-relaxed`}>
          {hasDocumentText(remarks) || previewMode ? (
            <section>
              <p className={muted}>Notes:</p>
              <p className="mt-2 whitespace-pre-line break-words">{placeholder(remarks, "Remarks", previewMode)}</p>
            </section>
          ) : null}
          {hasDocumentText(paymentInfo) || previewMode ? (
            <section>
              <p className={muted}>Payment Methods:</p>
              <p className="mt-2 whitespace-pre-line break-words">{placeholder(paymentInfo, "Payment info", previewMode)}</p>
            </section>
          ) : null}
          {hasDocumentText(importantNotes) || previewMode ? (
            <section>
              <p className={muted}>Terms:</p>
              <p className="mt-2 whitespace-pre-line break-words">{placeholder(importantNotes, "Important notes", previewMode)}</p>
            </section>
          ) : null}
        </div>
      </>
    );
  }

  function renderPage(pageItems: CleanPreviewItem[], pageIndex: number, summaryPage = false) {
    const showSummary = summaryPage || (!needsSummaryPage && pageIndex === itemPages.length - 1);
    const page = (
      <div key={`${summaryPage ? "summary" : "items"}-${pageIndex}`} className={pageClass} style={pageStyle}>
        {renderHeader()}
        {summaryPage ? null : renderTable(pageItems, pageIndex)}
        {showSummary ? renderSummary() : null}
        {totalPages > 1 ? (
          <p className="absolute bottom-5 right-8 text-[10px] text-[#777777]">
            Page {pageIndex + 1} of {totalPages}
          </p>
        ) : null}
      </div>
    );

    if (size === "page") {
      return (
        <div key={`${summaryPage ? "summary-wrapper" : "items-wrapper"}-${pageIndex}`} className="mx-auto">
          {page}
        </div>
      );
    }

    return (
      <div
        key={`${summaryPage ? "summary" : "items"}-${pageIndex}`}
        className="mx-auto"
        style={{ width: A4_PREVIEW_WIDTH * liveScale, height: A4_PREVIEW_HEIGHT * liveScale }}
      >
        <div style={{ width: A4_PREVIEW_WIDTH, height: A4_PREVIEW_HEIGHT, transform: `scale(${liveScale})`, transformOrigin: "top left" }}>
          {page}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {itemPages.map((pageItems, index) => renderPage(pageItems, index))}
      {needsSummaryPage ? renderPage([], itemPages.length, true) : null}
    </div>
  );
}
