import {
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_WIDTH,
  estimatePreviewRowHeight,
  paginateDocumentItems
} from "@/lib/document-pagination";
import { CLASSIC_LAYOUT, PDF_TO_PREVIEW, previewPx } from "@/lib/document-layout";
import { hasDocumentText, joinDocumentText, sanitizeDocumentText } from "@/lib/document-text";

type ClassicPreviewCompany = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  chopUrl?: string | null;
  ssmNumber?: string | null;
};

type ClassicPreviewCustomer = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

type ClassicPreviewItem = {
  id?: string;
  description?: string | null;
  quantity?: string | number | null;
  showQuantity?: boolean;
  unitPrice?: string | number | null;
  lineTotal?: string | number | null;
};

type ClassicDocumentPreviewProps = {
  kind: "invoice" | "quotation" | "receipt";
  company: ClassicPreviewCompany;
  customer?: ClassicPreviewCustomer | null;
  documentNumber: string;
  issueDate?: string | Date | null;
  dueDate?: string | Date | null;
  items: ClassicPreviewItem[];
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

function moneyPlain(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numeric(value));
}

function displayDate(value?: string | Date | null) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })
    .format(date)
    .toUpperCase();
}

function documentTitle(kind: ClassicDocumentPreviewProps["kind"]) {
  if (kind === "quotation") return "QUOTATION";
  if (kind === "receipt") return "RECEIPT";
  return "INVOICE";
}

function placeholder(value: string | null | undefined, label: string, previewMode: boolean) {
  const cleanValue = sanitizeDocumentText(value);
  if (cleanValue) return cleanValue;
  return previewMode ? label : "";
}

function plainDocumentNumber(value: string) {
  const cleanValue = sanitizeDocumentText(value);
  return cleanValue.replace(/^\D+/, "") || cleanValue;
}

export function ClassicDocumentPreview({
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
}: ClassicDocumentPreviewProps) {
  const title = documentTitle(kind);
  const printableItems = items.filter((item) => hasDocumentText(item.description) || numeric(item.lineTotal || item.unitPrice) > 0);
  const deposit = numeric(refundableDeposit);
  const paid = numeric(paidAmount);
  const displayTotal = kind === "invoice" || kind === "receipt" ? numeric(total) + deposit : numeric(total);
  const balanceDue = kind === "invoice" || kind === "receipt" ? Math.max(displayTotal - paid, 0) : 0;
  const totalRows: Array<[string, string | number | null | undefined]> = [["TOTAL", displayTotal]];
  if (kind === "receipt") {
    totalRows.push(["PAID", paid > 0 ? paidAmount : displayTotal]);
    if (balanceDue > 0) totalRows.push(["BALANCE", balanceDue]);
  } else if (kind === "invoice" && paid > 0) {
    totalRows.push(["PAID", paidAmount]);
    if (balanceDue > 0) totalRows.push(["BALANCE", balanceDue]);
  }
  const totalsBoxHeight =
    Math.max(
      CLASSIC_LAYOUT.totals.minHeight,
      CLASSIC_LAYOUT.totals.rowTop + totalRows.length * CLASSIC_LAYOUT.totals.rowGap + CLASSIC_LAYOUT.totals.bottomPadding
    ) * PDF_TO_PREVIEW;
  const displayItems: ClassicPreviewItem[] = printableItems.length
    ? printableItems
    : [{ description: previewMode ? "Item description" : "", lineTotal: 0, showQuantity: false }];
  const allItems =
    (kind === "invoice" || kind === "receipt") && deposit > 0
      ? [...displayItems, { description: "Refundable Deposit", lineTotal: deposit, showQuantity: false }]
      : displayItems;
  const itemHeight = (item: ClassicPreviewItem) =>
    estimatePreviewRowHeight(sanitizeDocumentText(item.description) || " ", {
      baseHeight: CLASSIC_LAYOUT.table.rowPaddingY * 2 * PDF_TO_PREVIEW,
      charsPerLine: 58,
      lineHeight: 18
    });
  const summaryTop = 640;
  const itemAreaHeight = (CLASSIC_LAYOUT.table.bottom - (CLASSIC_LAYOUT.table.top + CLASSIC_LAYOUT.table.itemStartOffset)) * PDF_TO_PREVIEW;
  const sectionsText = joinDocumentText([remarks, paymentInfo, importantNotes]);
  const summaryHeight =
    totalsBoxHeight +
    70 +
    estimatePreviewRowHeight(sectionsText, {
      baseHeight: 0,
      charsPerLine: 78,
      lineHeight: 16
    });
  const itemPages = paginateDocumentItems(allItems, {
    firstPageHeight: itemAreaHeight,
    nextPageHeight: itemAreaHeight,
    getItemHeight: itemHeight,
    orphanReservedHeight: 18
  });
  const summaryCapacity = A4_PREVIEW_HEIGHT - summaryTop - 56;
  const needsSummaryPage = summaryHeight > summaryCapacity;
  const totalPages = itemPages.length + (needsSummaryPage ? 1 : 0);
  const pageClass = "relative h-[1123px] w-[794px] overflow-hidden bg-white text-[16px] text-[#111111] shadow-soft print:shadow-none";
  const liveScale = 0.64;
  const scale = 1;
  const px = (value: number) => `${value * scale}px`;
  const hasQty = kind === "quotation";
  const tableColumns = hasQty
    ? [
        CLASSIC_LAYOUT.table.quotationDescriptionWidth,
        CLASSIC_LAYOUT.table.quantity.x - CLASSIC_LAYOUT.table.description.x - CLASSIC_LAYOUT.table.quotationDescriptionWidth,
        CLASSIC_LAYOUT.table.quantity.width,
        CLASSIC_LAYOUT.table.price.x - CLASSIC_LAYOUT.table.quantity.x - CLASSIC_LAYOUT.table.quantity.width,
        CLASSIC_LAYOUT.table.price.width
      ]
        .map(previewPx)
        .join(" ")
    : [
        CLASSIC_LAYOUT.table.description.width,
        CLASSIC_LAYOUT.table.price.x - CLASSIC_LAYOUT.table.description.x - CLASSIC_LAYOUT.table.description.width,
        CLASSIC_LAYOUT.table.price.width
      ]
        .map(previewPx)
        .join(" ");
  const tablePaddingStyle = {
    paddingLeft: previewPx(CLASSIC_LAYOUT.table.paddingX),
    paddingRight: previewPx(CLASSIC_LAYOUT.table.paddingX)
  };
  const itemBodyMinHeight =
    CLASSIC_LAYOUT.table.minBodyHeight * PDF_TO_PREVIEW;

  function tableHeight(pageItems: ClassicPreviewItem[], includeTotals: boolean) {
    const rowsHeight = pageItems.reduce((sum, item) => sum + itemHeight(item), 0);
    const bodyHeight = includeTotals ? Math.max(rowsHeight, itemBodyMinHeight) : rowsHeight;
    return CLASSIC_LAYOUT.table.headerHeight * PDF_TO_PREVIEW + bodyHeight + (includeTotals ? totalsBoxHeight : 0);
  }

  function renderHeader() {
    return (
      <>
        <h1
          className="absolute font-bold uppercase leading-none tracking-normal"
          style={{ left: px(63), top: px(kind === "quotation" ? 108 : 144), fontSize: px(32) }}
        >
          {title}
        </h1>

        <div
          className="absolute flex items-center justify-center bg-white p-1"
          style={{ left: px(619), top: px(49), width: px(132), height: px(132) }}
        >
          {company.logoUrl ? (
            <img alt={`${company.name} logo`} className="h-full w-full object-contain" src={company.logoUrl} />
          ) : (
            <div className="text-center font-bold leading-tight" style={{ fontSize: px(13) }}>
              {company.name}
            </div>
          )}
        </div>

        <div className="absolute leading-tight" style={{ left: px(63), top: px(225), width: px(235), fontSize: px(13) }}>
          <p className="mb-2 font-bold" style={{ fontSize: px(14) }}>FROM:</p>
          <p className="font-bold">{placeholder(company.name, "Company name", previewMode)}</p>
          {hasDocumentText(company.ssmNumber) ? <p className="italic">(SSM: {sanitizeDocumentText(company.ssmNumber)})</p> : null}
          <p className="mt-3 whitespace-pre-line">{placeholder(joinDocumentText([company.email, company.phone, company.address]), "Company details", previewMode)}</p>
        </div>

        <div className="absolute leading-tight" style={{ left: px(351), top: px(225), width: px(kind === "receipt" ? 220 : 180), fontSize: px(13) }}>
          <p className="mb-2 font-bold" style={{ fontSize: px(14) }}>TO:</p>
          <p className="font-bold">{placeholder(customer?.name, "Customer", previewMode)}</p>
          <p className="mt-2 whitespace-pre-line">{placeholder(joinDocumentText([customer?.phone, customer?.address]), "Customer details", previewMode)}</p>
        </div>

        <div className="absolute leading-tight" style={{ left: px(kind === "receipt" ? 591 : 619), top: px(225), width: px(kind === "receipt" ? 160 : 130), fontSize: px(13) }}>
          <p className="font-bold">{kind === "quotation" ? "QUOTE NO:" : kind === "receipt" ? "RECEIPT NO:" : "INVOICE NO:"}</p>
          <p className="mt-3">{plainDocumentNumber(documentNumber)}</p>
          <p className="mt-5 font-bold">ISSUE DATE:</p>
          <p className="mt-3">{placeholder(displayDate(issueDate), "Issue date", previewMode)}</p>
          {kind === "invoice" && dueDate ? (
            <>
              <p className="mt-5 font-bold">DUE DATE:</p>
              <p className="mt-3">{displayDate(dueDate)}</p>
            </>
          ) : null}
        </div>
      </>
    );
  }

  function renderTotalsBox() {
    return (
      <div className="relative bg-[#f0efed]" style={{ height: `${totalsBoxHeight}px`, width: previewPx(CLASSIC_LAYOUT.table.width) }}>
        <div
          className="absolute border-t border-[#222222]"
          style={{
            left: previewPx(CLASSIC_LAYOUT.totals.ruleLeft - CLASSIC_LAYOUT.table.left),
            top: previewPx(CLASSIC_LAYOUT.totals.ruleTop),
            width: previewPx(CLASSIC_LAYOUT.totals.ruleRight - CLASSIC_LAYOUT.totals.ruleLeft)
          }}
        />
        {totalRows.map(([label, value], index) => (
          <div
            key={`classic-total-${label}`}
            className="absolute grid text-right"
            style={{
              gridTemplateColumns: `${previewPx(CLASSIC_LAYOUT.totals.labelWidth)} ${previewPx(
                CLASSIC_LAYOUT.totals.amountX - (CLASSIC_LAYOUT.totals.labelX + CLASSIC_LAYOUT.totals.labelWidth)
              )} ${previewPx(CLASSIC_LAYOUT.totals.amountWidth)}`,
              left: previewPx(CLASSIC_LAYOUT.totals.labelX - CLASSIC_LAYOUT.table.left),
              top: previewPx(CLASSIC_LAYOUT.totals.rowTop + index * CLASSIC_LAYOUT.totals.rowGap),
              fontSize: px(13)
            }}
          >
            <p className="font-bold">{label}</p>
            <span />
            <p>{moneyPlain(value)}</p>
          </div>
        ))}
      </div>
    );
  }

  function renderTable(pageItems: ClassicPreviewItem[], pageIndex: number, includeTotals: boolean) {
    return (
      <div className="absolute" style={{ left: previewPx(CLASSIC_LAYOUT.table.left), top: previewPx(CLASSIC_LAYOUT.table.top), width: previewPx(CLASSIC_LAYOUT.table.width) }}>
        <div
          className="grid items-center bg-[#333333] font-bold text-white"
          style={{
            ...tablePaddingStyle,
            gridTemplateColumns: tableColumns,
            height: previewPx(CLASSIC_LAYOUT.table.headerHeight),
            fontSize: px(13)
          }}
        >
          <p>Description</p>
          {hasQty ? (
            <>
              <span />
              <p className="text-right">Qty</p>
              <span />
            </>
          ) : (
            <span />
          )}
          <p className="text-right">Price (RM)</p>
        </div>
        <div className="bg-[#f0efed]" style={{ ...tablePaddingStyle, minHeight: includeTotals ? `${itemBodyMinHeight}px` : undefined, fontSize: px(13) }}>
          {pageItems.map((item, index) => (
            <div
              key={`${pageIndex}-${item.id || `${item.description}-${index}`}`}
              className="grid"
              style={{
                gridTemplateColumns: tableColumns,
                minHeight: previewPx(CLASSIC_LAYOUT.table.rowMinHeight),
                paddingBottom: previewPx(CLASSIC_LAYOUT.table.rowPaddingY),
                paddingTop: previewPx(CLASSIC_LAYOUT.table.rowPaddingY)
              }}
            >
              <p className="whitespace-pre-line break-words leading-relaxed">{placeholder(item.description, "Description", previewMode)}</p>
              {hasQty ? (
                <>
                  <span />
                  <p className="text-right">{item.showQuantity === false ? "" : Number(item.quantity || 0).toFixed(2)}</p>
                  <span />
                </>
              ) : (
                <span />
              )}
              <p className="text-right">{moneyPlain(item.lineTotal ?? item.unitPrice)}</p>
            </div>
          ))}
        </div>
        {includeTotals ? renderTotalsBox() : null}
      </div>
    );
  }

  function renderSummary(summaryPage: boolean, pageItems: ClassicPreviewItem[], includeTotals: boolean) {
    const remarksTop = summaryPage
      ? previewPx(379 + CLASSIC_LAYOUT.totals.minHeight + CLASSIC_LAYOUT.summary.remarksGap)
      : `${CLASSIC_LAYOUT.table.top * PDF_TO_PREVIEW + tableHeight(pageItems, includeTotals) + CLASSIC_LAYOUT.summary.remarksGap * PDF_TO_PREVIEW}px`;
    const showRemarks = hasDocumentText(remarks) || previewMode;
    const showPaymentInfo = hasDocumentText(paymentInfo) || previewMode;
    const showImportantNotes = hasDocumentText(importantNotes) || previewMode;

    return (
      <>
        {summaryPage ? (
          <div className="absolute" style={{ left: previewPx(CLASSIC_LAYOUT.table.left), top: previewPx(379) }}>
            {renderTotalsBox()}
          </div>
        ) : null}

        {kind === "receipt" && chopUrl ? (
          <div className="absolute" style={{ right: px(43), top: remarksTop }}>
            <img alt={`${company.name} chop`} className="object-contain" src={chopUrl} style={{ width: px(210), height: px(120) }} />
          </div>
        ) : null}

        {showRemarks ? (
          <div
            className="absolute italic leading-snug"
            style={{
              fontSize: px(11),
              left: previewPx(CLASSIC_LAYOUT.summary.remarksX),
              top: remarksTop,
              width: previewPx(CLASSIC_LAYOUT.summary.remarksWidth)
            }}
          >
            <p>Remarks:</p>
            <p className="whitespace-pre-line break-words">{placeholder(remarks, "Remarks", previewMode)}</p>
          </div>
        ) : null}

        <div
          className="absolute leading-tight"
          style={{
            fontSize: px(11),
            left: previewPx(CLASSIC_LAYOUT.summary.footerLeftX),
            top: previewPx(CLASSIC_LAYOUT.summary.footerTop),
            width: previewPx(CLASSIC_LAYOUT.summary.footerLeftWidth)
          }}
        >
          {showPaymentInfo ? (
            <>
              <p className="font-bold">PAYMENT INFO</p>
              <p className="mt-2 whitespace-pre-line break-words">{placeholder(paymentInfo, "Payment info", previewMode)}</p>
            </>
          ) : null}
        </div>
        <div
          className="absolute leading-tight"
          style={{
            fontSize: px(11),
            left: previewPx(CLASSIC_LAYOUT.summary.footerRightX),
            top: previewPx(CLASSIC_LAYOUT.summary.footerTop),
            width: previewPx(CLASSIC_LAYOUT.summary.footerRightWidth)
          }}
        >
          {showImportantNotes ? (
            <>
              <p className="font-bold">IMPORTANT NOTES</p>
              <p className="mt-2 whitespace-pre-line break-words">{placeholder(importantNotes, "Important notes", previewMode)}</p>
            </>
          ) : null}
        </div>
      </>
    );
  }

  function renderPage(pageItems: ClassicPreviewItem[], pageIndex: number, summaryPage = false) {
    const showSummary = summaryPage || (!needsSummaryPage && pageIndex === itemPages.length - 1);
    const includeTotals = showSummary && !summaryPage;
    const page = (
      <div key={`${summaryPage ? "summary" : "items"}-${pageIndex}`} className={pageClass}>
        {renderHeader()}
        {summaryPage ? null : renderTable(pageItems, pageIndex, includeTotals)}
        {showSummary ? renderSummary(summaryPage, pageItems, includeTotals) : null}
        {totalPages > 1 ? (
          <p className="absolute text-[#777777]" style={{ right: px(43), bottom: px(28), fontSize: px(10) }}>
            Page {pageIndex + 1} of {totalPages}
          </p>
        ) : null}
      </div>
    );

    if (size === "page") return <div key={`${summaryPage ? "summary-wrapper" : "items-wrapper"}-${pageIndex}`} className="mx-auto">{page}</div>;

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
