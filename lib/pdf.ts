import "server-only";

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { DocumentType } from "@prisma/client";
import { getDocumentTemplate } from "@/components/document-templates/template-registry";
import { companyAssetPublicUrlToAbsolutePath } from "@/lib/logo";
import { prisma } from "@/lib/prisma";
import { money, moneyPlain as formatMoneyPlain, shortDate } from "@/lib/format";
import { deleteFile, saveFile } from "@/lib/storage";
import { joinDocumentText, sanitizeDocumentText, sanitizeNullableDocumentText } from "@/lib/document-text";
import { A4, CLASSIC_LAYOUT, CLEAN_LAYOUT } from "@/lib/document-layout";

type PdfTarget = {
  companyId: string;
  documentType: DocumentType;
  documentId: string;
};

let pdfKitFontsReady = false;
const INVOICE_PREVIEW_WIDTH = A4.previewWidth;
const PREVIEW_TO_PDF_SCALE = A4.pdfWidth / INVOICE_PREVIEW_WIDTH;
const INVOICE_LOGO_BOX = {
  x: 619 * PREVIEW_TO_PDF_SCALE,
  y: 49 * PREVIEW_TO_PDF_SCALE,
  width: 132 * PREVIEW_TO_PDF_SCALE,
  height: 132 * PREVIEW_TO_PDF_SCALE
};
const CLEAN_TABLE = CLEAN_LAYOUT.table;
const CLEAN_SUMMARY = CLEAN_LAYOUT.summary;
const CLEAN_DATE = CLEAN_LAYOUT.date;
const CLEAN_TITLE = CLEAN_LAYOUT.title;
const CLEAN_SECTIONS = CLEAN_LAYOUT.sections;
const CLASSIC_TABLE = CLASSIC_LAYOUT.table;
const CLASSIC_TOTALS = CLASSIC_LAYOUT.totals;
const CLASSIC_SUMMARY = CLASSIC_LAYOUT.summary;

type PdfImageSource = string | Buffer;
type PdfRenderAssets = {
  logo?: PdfImageSource | null;
  chop?: PdfImageSource | null;
};

type PdfLogContext = Record<string, unknown>;

class PdfGenerationStageError extends Error {
  stage: string;
  details: PdfLogContext;
  cause?: unknown;
  code?: string;

  constructor(stage: string, cause: unknown, details: PdfLogContext = {}) {
    const causeMessage = cause instanceof Error ? cause.message : "Unknown PDF generation error.";
    super(`PDF generation failed during ${stage}: ${causeMessage}`);
    this.name = "PdfGenerationStageError";
    this.stage = stage;
    this.details = safeLogContext(details);
    this.cause = cause;

    if (isRecord(cause) && typeof cause.code === "string") {
      this.code = cause.code;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeLogValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > 260 ? `${value.slice(0, 257)}...` : value;
  if (Buffer.isBuffer(value)) return { type: "Buffer", bytes: value.length };
  if (value instanceof Uint8Array) return { type: value.constructor.name, bytes: value.byteLength };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(safeLogValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, nestedValue]) => [key, safeLogValue(nestedValue)])
        .filter(([, nestedValue]) => nestedValue !== undefined)
    );
  }

  return String(value);
}

function safeLogContext(context: PdfLogContext = {}) {
  return Object.fromEntries(
    Object.entries(context)
      .map(([key, value]) => [key, safeLogValue(value)])
      .filter(([, value]) => value !== undefined)
  );
}

function summarizeUnknownError(error: unknown): PdfLogContext {
  if (error instanceof PdfGenerationStageError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      stage: error.stage,
      details: error.details,
      cause: summarizeUnknownError(error.cause)
    };
  }

  if (error instanceof Error) {
    const extra = error as Error & Record<string, unknown>;
    return {
      name: error.name,
      message: error.message,
      code: typeof extra.code === "string" ? extra.code : undefined,
      syscall: typeof extra.syscall === "string" ? extra.syscall : undefined,
      path: typeof extra.path === "string" ? path.basename(extra.path) : undefined,
      constructorName: error.constructor.name,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined
    };
  }

  return {
    name: typeof error,
    message: typeof error === "string" ? error : "Non-Error value thrown.",
    value: safeLogValue(error)
  };
}

export function describePdfGenerationError(error: unknown, context: PdfLogContext = {}) {
  return {
    ...safeLogContext(context),
    error: summarizeUnknownError(error)
  };
}

function withPdfStage<T>(stage: string, details: PdfLogContext, action: () => T): T {
  try {
    return action();
  } catch (error) {
    throw new PdfGenerationStageError(stage, error, details);
  }
}

async function withAsyncPdfStage<T>(stage: string, details: PdfLogContext, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new PdfGenerationStageError(stage, error, details);
  }
}

function ensurePdfKitStandardFontData() {
  if (pdfKitFontsReady) return;

  const candidateSourceDirs = pdfKitFontDataSourceDirs();
  const candidateDirs = uniqueStrings([
    path.join(process.cwd(), ".next", "server", "vendor-chunks", "data"),
    path.join(process.cwd(), ".next", "server", "chunks", "data"),
    path.join(process.cwd(), ".next", "standalone", ".next", "server", "vendor-chunks", "data"),
    path.join(process.cwd(), ".next", "standalone", ".next", "server", "chunks", "data")
  ]);
  const sourceDir = candidateSourceDirs.find((dir) => fs.existsSync(dir));

  if (!sourceDir) {
    throw new Error(
      `PDFKit font data directory not found. Tried: ${candidateSourceDirs.join(", ")}`
    );
  }

  for (const targetDir of candidateDirs) {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const fileName of fs.readdirSync(sourceDir)) {
      const sourceFile = path.join(sourceDir, fileName);
      const targetFile = path.join(targetDir, fileName);

      if (!fs.existsSync(targetFile)) {
        fs.copyFileSync(sourceFile, targetFile);
      }
    }
  }

  pdfKitFontsReady = true;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function tryResolvePdfKitEntryPath() {
  try {
    const resolved = require.resolve("pdfkit") as unknown;
    return typeof resolved === "string" ? resolved : null;
  } catch {
    return null;
  }
}

function pdfKitFontDataSourceDirs() {
  const resolvedEntryPath = tryResolvePdfKitEntryPath();
  return uniqueStrings([
    path.join(process.cwd(), "node_modules", "pdfkit", "js", "data"),
    path.join(process.cwd(), ".next", "server", "vendor-chunks", "data"),
    path.join(process.cwd(), ".next", "server", "chunks", "data"),
    path.join(process.cwd(), ".next", "standalone", "node_modules", "pdfkit", "js", "data"),
    path.join(process.cwd(), ".next", "standalone", ".next", "server", "vendor-chunks", "data"),
    path.join(process.cwd(), ".next", "standalone", ".next", "server", "chunks", "data"),
    path.join(process.cwd(), "..", "node_modules", "pdfkit", "js", "data"),
    resolvedEntryPath ? path.join(path.dirname(resolvedEntryPath), "data") : ""
  ].filter(Boolean));
}

function documentPdfKey(companyId: string, documentType: "invoice" | "quotation" | "receipt", documentId: string) {
  return `uploads/company-${companyId}/${documentType}s/${documentType}-${documentId}.pdf`;
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8);
  doc.fontSize(10).fillColor("#1F6F78").font("Helvetica-Bold").text(title.toUpperCase());
  doc.moveDown(0.25);
  doc.strokeColor("#D7DEE2").lineWidth(1).moveTo(doc.x, doc.y).lineTo(540, doc.y).stroke();
  doc.moveDown(0.35).fillColor("#172126").font("Helvetica");
}

function splitLines(value?: string | null) {
  const text = sanitizeDocumentText(value);
  return text || "-";
}

async function optionalSharpPngBuffer(filePath: string) {
  try {
    const load = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
    const sharpModule = (await load("sharp")) as { default?: unknown };
    const sharp = (sharpModule.default || sharpModule) as (input: string) => {
      png: () => { toBuffer: () => Promise<Buffer> };
    };

    return sharp(filePath).png().toBuffer();
  } catch {
    return null;
  }
}

async function loadPdfImageSource(assetUrl?: string | null): Promise<PdfImageSource | null> {
  if (!assetUrl) return null;

  try {
    const filePath = companyAssetPublicUrlToAbsolutePath(assetUrl);
    if (!filePath || !fs.existsSync(filePath)) return null;

    const extension = path.extname(filePath).toLowerCase();
    if ([".png", ".jpg", ".jpeg"].includes(extension)) return filePath;
    if (extension === ".webp") return optionalSharpPngBuffer(filePath);

    return null;
  } catch (error) {
    console.warn(
      "PDF asset skipped",
      describePdfGenerationError(error, {
        assetExtension: path.extname(assetUrl.split("?")[0] || "").toLowerCase() || null,
        hasAssetUrl: Boolean(assetUrl)
      })
    );
    return null;
  }
}

async function preparePdfAssets(company: { settings?: { logoUrl?: string | null; chopUrl?: string | null } | null }) {
  const [logo, chop] = await Promise.all([
    loadPdfImageSource(company.settings?.logoUrl),
    loadPdfImageSource(company.settings?.chopUrl)
  ]);

  return { logo, chop };
}

function drawLogoBox(
  doc: PDFKit.PDFDocument,
  company: {
    name: string;
    settings?: {
      logoUrl?: string | null;
      ssmNumber?: string | null;
    } | null;
  },
  x: number,
  y: number,
  width = 240,
  height = 80,
  bordered = true,
  imageSource?: PdfImageSource | null
) {
  doc.save();
  if (bordered) {
    doc.roundedRect(x, y, width, height, 4).strokeColor("#D7DEE2").lineWidth(1).stroke();
  }

  if (imageSource) {
    const inset = bordered ? 10 : 0;
    try {
      doc.image(imageSource, x + inset, y + inset, {
        fit: [width - inset * 2, height - inset * 2],
        align: "center",
        valign: "center"
      });
      doc.restore();
      return;
    } catch (error) {
      console.warn(
        "PDF logo skipped",
        describePdfGenerationError(error, {
          assetType: "logo",
          imageSourceType: Buffer.isBuffer(imageSource) ? "buffer" : "file",
          width,
          height
        })
      );
      // Fall through to a text fallback if PDFKit cannot embed the source.
    }
  }

  {
    const companyName = sanitizeDocumentText(company.name);
    const fontSize = Math.max(7, Math.min(12, width / Math.max(companyName.length * 0.42, 1)));
    doc.fillColor("#172126").font("Helvetica-Bold").fontSize(fontSize).text(companyName, x + 8, y + height / 2 - fontSize, {
      width: width - 24,
      height: fontSize * 2.4,
      align: "center",
      ellipsis: true
    });
  }

  doc.restore();
}

function drawChopBox(
  doc: PDFKit.PDFDocument,
  company: {
    name: string;
    settings?: {
      chopUrl?: string | null;
    } | null;
  },
  x: number,
  y: number,
  width: number,
  height: number,
  imageSource?: PdfImageSource | null
) {
  doc.save();
  if (imageSource) {
    try {
      doc.image(imageSource, x, y, {
        fit: [width, height],
        align: "center",
        valign: "center"
      });
    } catch (error) {
      console.warn(
        "PDF chop skipped",
        describePdfGenerationError(error, {
          assetType: "chop",
          imageSourceType: Buffer.isBuffer(imageSource) ? "buffer" : "file",
          width,
          height
        })
      );
      // Optional stamp should never break PDF generation.
    }
  }

  doc.restore();
}

function writePartyBlock(
  doc: PDFKit.PDFDocument,
  label: string,
  name: string,
  details: Array<string | null | undefined>,
  options: {
    registrationLabel?: string | null;
  },
  x: number,
  y: number
) {
  doc.fontSize(9).fillColor("#5E6A70").font("Helvetica-Bold").text(label, x, y);
  doc.fontSize(11).fillColor("#172126").font("Helvetica-Bold").text(name, x, y + 16, {
    width: 220
  });
  if (options.registrationLabel) {
    doc.font("Helvetica-Oblique").fontSize(9).text(options.registrationLabel, x, y + 32, {
      width: 220
    });
  }
  doc.font("Helvetica").fontSize(9).fillColor("#172126").text(
    details.filter(Boolean).join("\n"),
    x,
    y + (options.registrationLabel ? 48 : 34),
    { width: 220, lineGap: 2 }
  );
}

function writeDocumentMeta(
  doc: PDFKit.PDFDocument,
  rows: Array<[string, string]>,
  x: number,
  y: number
) {
  rows.forEach(([label, value], index) => {
    const rowY = y + index * 20;
    doc.fontSize(9).fillColor("#5E6A70").font("Helvetica-Bold").text(label, x, rowY, {
      width: 90
    });
    doc.fontSize(10).fillColor("#172126").font("Helvetica").text(value, x + 96, rowY, {
      width: 130,
      align: "right"
    });
  });
}

function writeItemsTable(
  doc: PDFKit.PDFDocument,
  items: Array<{
    description: string;
    quantity: unknown;
    showQuantity?: boolean;
    unitPrice: unknown;
    lineTotal: unknown;
  }>,
  startY: number
) {
  const x = 54;
  let y = startY;

  doc.roundedRect(x, y, 486, 24, 4).fill("#1F6F78");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
  doc.text("DESCRIPTION", x + 12, y + 8, { width: 270 });
  doc.text("QTY", x + 306, y + 8, { width: 40, align: "right" });
  doc.text("PRICE", x + 360, y + 8, { width: 70, align: "right" });
  doc.text("TOTAL", x + 436, y + 8, { width: 38, align: "right" });
  y += 30;

  doc.font("Helvetica").fillColor("#172126").fontSize(9);
  items.forEach((item, index) => {
    const descriptionHeight = doc.heightOfString(item.description, { width: 270, lineGap: 2 });
    const rowHeight = Math.max(36, descriptionHeight + 14);

    if (y + rowHeight > 700) {
      doc.addPage();
      y = 54;
    }

    if (index % 2 === 0) {
      doc.rect(x, y - 4, 486, rowHeight).fill("#F7F8F5");
      doc.fillColor("#172126");
    }

    doc.text(item.description, x + 12, y + 6, { width: 270, lineGap: 2 });
    doc.text(item.showQuantity === false ? "" : Number(item.quantity).toFixed(2), x + 306, y + 6, {
      width: 40,
      align: "right"
    });
    doc.text(money(String(item.unitPrice)), x + 352, y + 6, { width: 78, align: "right" });
    doc.text(money(String(item.lineTotal)), x + 430, y + 6, { width: 44, align: "right" });
    y += rowHeight;
  });

  doc.strokeColor("#D7DEE2").lineWidth(1).moveTo(x, y).lineTo(540, y).stroke();
  return y + 16;
}

function pdfMoneyPlain(value: unknown) {
  return formatMoneyPlain(String(value ?? 0));
}

function writeInvoiceReferenceTable(
  doc: PDFKit.PDFDocument,
  invoice: {
    items: Array<{
      description: string;
      lineTotal: unknown;
    }>;
    refundableDeposit: unknown;
    total: unknown;
    paidAmount: unknown;
  },
  startY: number,
  options?: {
    showPaid?: boolean;
    templateKey?: string | null;
  }
) {
  const showPaid = options?.showPaid ?? true;
  const template = getDocumentTemplate(options?.templateKey).pdf;
  const x = 32;
  const width = 530;
  const priceX = 450;
  let y = startY;

  doc.rect(x, y, width, 18).fill(template.headerFill);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(template.fontSize);
  doc.text("Description", x + 15, y + 5, { width: 330 });
  doc.text("Price (RM)", priceX, y + 5, { width: 96, align: "right" });
  y += 18;

  const bodyStart = y;
  const itemHeights = invoice.items.map((item) =>
    Math.max(template.rowMinHeight, doc.heightOfString(item.description, { width: 345, lineGap: 4 }) + 10)
  );
  const depositHeight = Number(invoice.refundableDeposit) > 0 ? 30 : 0;
  const totalsHeight = showPaid ? 44 : 28;
  const bodyHeight = Math.max(118, itemHeights.reduce((sum, height) => sum + height, 0) + depositHeight + totalsHeight + 10);

  doc.rect(x, bodyStart, width, bodyHeight).fill(template.bodyFill);
  doc.fillColor(template.textFill).font("Helvetica").fontSize(template.fontSize);

  invoice.items.forEach((item, index) => {
    doc.text(item.description, x + 15, y + 14, { width: 345, lineGap: 4 });
    doc.text(pdfMoneyPlain(item.lineTotal), priceX, y + 14, { width: 96, align: "right" });
    y += itemHeights[index];
  });

  if (Number(invoice.refundableDeposit) > 0) {
    y += 4;
    doc.text("Refundable Deposit", x + 15, y + 6, { width: 345 });
    doc.text(pdfMoneyPlain(invoice.refundableDeposit), priceX, y + 6, { width: 96, align: "right" });
    y += 24;
  }

  const ruleY = bodyStart + bodyHeight - totalsHeight - 8;
  doc.strokeColor("#222222").lineWidth(1).moveTo(x + 15, ruleY).lineTo(x + width - 15, ruleY).stroke();

  const totalsY = ruleY + 12;
  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(template.fontSize);
  doc.text("TOTAL", 452, totalsY, { width: 45 });
  doc.font("Helvetica");
  doc.text(pdfMoneyPlain(invoice.total), priceX, totalsY, { width: 96, align: "right" });
  if (showPaid) {
    doc.font("Helvetica-Bold");
    doc.text("PAID", 452, totalsY + 15, { width: 45 });
    doc.font("Helvetica");
    doc.text(pdfMoneyPlain(invoice.paidAmount), priceX, totalsY + 15, { width: 96, align: "right" });
  }

  return bodyStart + bodyHeight;
}

function writeQuotationReferenceTable(
  doc: PDFKit.PDFDocument,
  quotation: {
    items: Array<{
      description: string;
      quantity: unknown;
      showQuantity?: boolean;
      lineTotal: unknown;
    }>;
    total: unknown;
  },
  startY: number,
  options?: {
    templateKey?: string | null;
  }
) {
  const template = getDocumentTemplate(options?.templateKey).pdf;
  const x = 32;
  const width = 530;
  const qtyX = 397;
  const priceX = 450;
  let y = startY;

  doc.rect(x, y, width, 18).fill(template.headerFill);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(template.fontSize);
  doc.text("Description", x + 15, y + 5, { width: 330 });
  doc.text("Qty", qtyX, y + 5, { width: 38, align: "right" });
  doc.text("Price (RM)", priceX, y + 5, { width: 96, align: "right" });
  y += 18;

  const bodyStart = y;
  const itemHeights = quotation.items.map((item) =>
    Math.max(template.rowMinHeight, doc.heightOfString(item.description, { width: 330, lineGap: 4 }) + 10)
  );
  const totalsHeight = 28;
  const bodyHeight = Math.max(118, itemHeights.reduce((sum, height) => sum + height, 0) + totalsHeight + 10);

  doc.rect(x, bodyStart, width, bodyHeight).fill(template.bodyFill);
  doc.fillColor(template.textFill).font("Helvetica").fontSize(template.fontSize);

  quotation.items.forEach((item, index) => {
    doc.text(item.description, x + 15, y + 14, { width: 330, lineGap: 4 });
    doc.text(item.showQuantity === false ? "" : Number(item.quantity).toFixed(2), qtyX, y + 14, {
      width: 38,
      align: "right"
    });
    doc.text(pdfMoneyPlain(item.lineTotal), priceX, y + 14, { width: 96, align: "right" });
    y += itemHeights[index];
  });

  const ruleY = bodyStart + bodyHeight - totalsHeight - 8;
  doc.strokeColor("#222222").lineWidth(1).moveTo(x + 15, ruleY).lineTo(x + width - 15, ruleY).stroke();

  const totalsY = ruleY + 12;
  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(template.fontSize);
  doc.text("TOTAL", 398, totalsY, { width: 98, align: "right" });
  doc.font("Helvetica");
  doc.text(pdfMoneyPlain(quotation.total), priceX, totalsY, { width: 96, align: "right" });

  return bodyStart + bodyHeight;
}

function writeInvoiceBottomSections(
  doc: PDFKit.PDFDocument,
  paymentInfo?: string | null,
  importantNotes?: string | null
) {
  const y = 744;
  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(8).text("PAYMENT INFO", 47, y);
  doc.font("Helvetica").fontSize(7).text(splitLines(paymentInfo), 47, y + 13, {
    width: 250,
    lineGap: 1
  });

  doc.font("Helvetica-Bold").fontSize(8).text("IMPORTANT NOTES", 367, y);
  doc.font("Helvetica").fontSize(7).text(splitLines(importantNotes), 367, y + 13, {
    width: 188,
    lineGap: 1
  });
}

function writeTotals(
  doc: PDFKit.PDFDocument,
  rows: Array<[string, string, boolean?]>,
  y: number
) {
  rows.forEach(([label, value, emphasized], index) => {
    const rowY = y + index * 22;
    doc.font(emphasized ? "Helvetica-Bold" : "Helvetica").fontSize(emphasized ? 12 : 10);
    doc.fillColor("#5E6A70").text(label, 340, rowY, { width: 95 });
    doc.fillColor("#172126").text(value, 438, rowY, { width: 102, align: "right" });
  });

  return y + rows.length * 22;
}

function writeTextBox(doc: PDFKit.PDFDocument, title: string, value?: string | null) {
  addSectionTitle(doc, title);
  doc.fontSize(9).font("Helvetica").fillColor("#172126").text(splitLines(value), {
    width: 486,
    lineGap: 3
  });
}

type CleanPdfCompany = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  settings?: {
    logoUrl?: string | null;
    chopUrl?: string | null;
    ssmNumber?: string | null;
  } | null;
};

type CleanPdfCustomer = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

type CleanPdfItem = {
  description: string;
  quantity?: unknown;
  showQuantity?: boolean;
  unitPrice?: unknown;
  lineTotal: unknown;
};

function cleanPdfMoney(value: unknown) {
  return `MYR ${pdfMoneyPlain(value)}`;
}

function cleanPlainDocumentNumber(value: string) {
  const cleanValue = sanitizeDocumentText(value);
  return cleanValue.replace(/^[A-Za-z-]+/, "") || cleanValue;
}

function cleanHasQuantity(item: CleanPdfItem) {
  return item.showQuantity !== false && item.quantity !== "" && item.quantity !== null && item.quantity !== undefined;
}

function cleanNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function writeCleanCompanyBlock(doc: PDFKit.PDFDocument, company: CleanPdfCompany, x: number, y: number) {
  let cursorY = y;

  const companyName = sanitizeDocumentText(company.name);
  doc.fillColor("#2A2A2A").font("Helvetica-Bold").fontSize(10).text(companyName, x, cursorY, {
    width: 210
  });
  cursorY += 14;

  if (company.settings?.ssmNumber) {
    doc.fillColor("#6D6D6D").font("Helvetica-Oblique").fontSize(8).text(`(SSM: ${sanitizeDocumentText(company.settings.ssmNumber)})`, x, cursorY, {
      width: 210
    });
    cursorY += 12;
  }

  const details = joinDocumentText([company.email, company.phone, company.address]);
  if (details) {
    doc.fillColor("#6D6D6D").font("Helvetica").fontSize(8).text(details, x, cursorY + 4, {
      width: 210,
      lineGap: 2
    });
  }
}

function writeCleanItemDescription(
  doc: PDFKit.PDFDocument,
  description: string,
  x: number,
  y: number,
  width: number
) {
  const [title = "", ...details] = sanitizeDocumentText(description).split("\n");
  doc.fillColor("#2A2A2A").font("Helvetica-Bold").fontSize(9).text(title.trim() || "-", x, y, {
    width,
    lineGap: 2
  });

  if (details.join("\n").trim()) {
    doc.fillColor("#6D6D6D").font("Helvetica").fontSize(8).text(details.join("\n").trim(), x, y + 14, {
      width,
      lineGap: 2
    });
  }
}

function writeCleanDocumentPdf(
  doc: PDFKit.PDFDocument,
  options: {
    kind: "invoice" | "quotation" | "receipt";
    company: CleanPdfCompany;
    customer: CleanPdfCustomer;
    documentNumber: string;
    issueDate: Date;
    dueDate?: Date | null;
    items: CleanPdfItem[];
    total: unknown;
    paidAmount?: unknown;
    refundableDeposit?: unknown;
    paymentInfo?: string | null;
    importantNotes?: string | null;
    remarks?: string | null;
  }
) {
  const title = options.kind === "quotation" ? "QUOTATION" : options.kind === "receipt" ? "RECEIPT" : "INVOICE";
  const left = 42;
  const right = 553;
  const tableWidth = right - left;
  const itemWidth = 326;
  const qtyX = left + itemWidth;
  const rateX = qtyX + 70;
  const amountX = rateX + 82;
  const total = cleanNumber(options.total);
  const paidAmount = cleanNumber(options.paidAmount);
  const balanceDue = options.kind === "invoice" ? Math.max(total - paidAmount, 0) : total;
  const summaryLabel = options.kind === "receipt" ? "Amount Paid:" : options.kind === "invoice" ? "Balance Due:" : "Total:";
  const summaryAmount = options.kind === "receipt" ? paidAmount || total : balanceDue;

  writeCleanCompanyBlock(doc, options.company, left, 42);

  doc.fillColor("#333333").font("Helvetica").fontSize(34).text(title, 340, 42, {
    width: 213,
    align: "right"
  });
  doc.fillColor("#777777").font("Helvetica-Bold").fontSize(13).text(`# ${cleanPlainDocumentNumber(options.documentNumber)}`, 340, 82, {
    width: 213,
    align: "right"
  });

  doc.fillColor("#6D6D6D").font("Helvetica").fontSize(10).text("Bill To:", left, 143);
  doc.fillColor("#2A2A2A").font("Helvetica-Bold").fontSize(10).text(options.customer.name, left, 162, {
    width: 230
  });
  const customerDetails = joinDocumentText([options.customer.email, options.customer.phone, options.customer.address]);
  if (customerDetails) {
    doc.fillColor("#6D6D6D").font("Helvetica").fontSize(8).text(customerDetails, left, 182, {
      width: 230,
      lineGap: 2
    });
  }

  doc.fillColor("#6D6D6D").font("Helvetica").fontSize(10).text("Date:", CLEAN_DATE.labelX, 143, {
    width: CLEAN_DATE.labelWidth,
    align: "right"
  });
  doc.fillColor("#2A2A2A").text(shortDate(options.issueDate), CLEAN_DATE.valueX, 143, {
    width: CLEAN_DATE.valueWidth,
    align: "right"
  });
  if (options.kind === "invoice" && options.dueDate) {
    doc.fillColor("#6D6D6D").text("Due:", CLEAN_DATE.labelX, 164, {
      width: CLEAN_DATE.labelWidth,
      align: "right"
    });
    doc.fillColor("#2A2A2A").text(shortDate(options.dueDate), CLEAN_DATE.valueX, 164, {
      width: CLEAN_DATE.valueWidth,
      align: "right"
    });
  }

  doc.roundedRect(CLEAN_SUMMARY.x, CLEAN_SUMMARY.y, CLEAN_SUMMARY.width, CLEAN_SUMMARY.height, 3).fill("#F3F3F3");
  doc.fillColor("#2A2A2A").font("Helvetica-Bold").fontSize(11).text(summaryLabel, CLEAN_SUMMARY.labelX, CLEAN_SUMMARY.y + 9, {
    width: CLEAN_SUMMARY.labelWidth,
    align: "right"
  });
  doc.text(cleanPdfMoney(summaryAmount), CLEAN_SUMMARY.amountX, CLEAN_SUMMARY.y + 9, {
    width: CLEAN_SUMMARY.amountWidth,
    align: "right"
  });

  let y = 270;
  doc.roundedRect(left, y, tableWidth, 24, 3).fill("#3A3A3A");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
  doc.text("Item", left + 14, y + 7, { width: itemWidth - 20 });
  doc.text("Quantity", qtyX, y + 7, { width: 60, align: "right" });
  doc.text("Rate", rateX, y + 7, { width: 72, align: "right" });
  doc.text("Amount", amountX, y + 7, { width: 80, align: "right" });
  y += 34;

  const items = options.items.length
    ? options.items
    : [{ description: "", quantity: "", showQuantity: false, unitPrice: 0, lineTotal: 0 }];
  const allItems =
    options.kind === "invoice" && cleanNumber(options.refundableDeposit) > 0
      ? [
          ...items,
          {
            description: "Refundable Deposit",
            quantity: "",
            showQuantity: false,
            unitPrice: 0,
            lineTotal: options.refundableDeposit
          }
        ]
      : items;

  for (const item of allItems) {
    const descriptionHeight = doc.heightOfString(item.description || "-", {
      width: itemWidth - 24,
      lineGap: 2
    });
    const rowHeight = Math.max(46, descriptionHeight + 22);

    if (y + rowHeight > 700) {
      doc.addPage();
      y = 54;
    }

    doc.strokeColor("#E7E7E7").lineWidth(1).moveTo(left, y - 8).lineTo(right, y - 8).stroke();
    writeCleanItemDescription(doc, item.description || "-", left + 14, y, itemWidth - 24);

    const showQty = cleanHasQuantity(item);
    doc.fillColor("#2A2A2A").font("Helvetica").fontSize(9);
    doc.text(showQty ? cleanNumber(item.quantity).toFixed(2) : "", qtyX, y, {
      width: 60,
      align: "right"
    });
    doc.text(showQty ? cleanPdfMoney(item.unitPrice) : "", rateX, y, {
      width: 72,
      align: "right"
    });
    doc.text(cleanPdfMoney(item.lineTotal), amountX, y, {
      width: 80,
      align: "right"
    });

    y += rowHeight;
  }

  y += 42;
  const totals: Array<[string, unknown, boolean?]> = [["Total:", options.total, false]];
  if (options.kind === "invoice" && paidAmount > 0) {
    totals.push(["Paid:", options.paidAmount, false], ["Balance Due:", balanceDue, true]);
  }
  if (options.kind === "receipt") {
    totals.push(["Paid:", options.paidAmount || options.total, false]);
  }

  totals.forEach(([label, value, emphasized], index) => {
    const rowY = y + index * 20;
    doc.fillColor(emphasized ? "#2A2A2A" : "#6D6D6D").font(emphasized ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.text(label, CLEAN_SUMMARY.labelX, rowY, { width: CLEAN_SUMMARY.labelWidth, align: "right" });
    doc.fillColor("#2A2A2A").font(emphasized ? "Helvetica-Bold" : "Helvetica").text(cleanPdfMoney(value), CLEAN_SUMMARY.amountX, rowY, {
      width: CLEAN_SUMMARY.amountWidth,
      align: "right"
    });
  });

  if (options.kind === "receipt") {
    drawChopBox(doc, options.company, 404, y + totals.length * 20 + 18, 126, 66);
  }

  const sections: Array<[string, string | null | undefined]> = [
    ["Notes:", options.remarks],
    ["Payment Methods:", options.paymentInfo],
    ["Terms:", options.importantNotes]
  ];

  y = Math.max(y + totals.length * 20 + 84, 520);
  if (sections.length && y > 690) {
    doc.addPage();
    y = 54;
  }

  sections.forEach(([label, value]) => {
    if (!value?.trim()) return;

    const height = doc.heightOfString(value || "", { width: 500, lineGap: 3 }) + 22;
    if (y + height > 780) {
      doc.addPage();
      y = 54;
    }
    doc.fillColor("#6D6D6D").font("Helvetica").fontSize(10).text(label, left, y);
    doc.fillColor("#2A2A2A").font("Helvetica").fontSize(9).text(value || "", left, y + 16, {
      width: 500,
      lineGap: 3
    });
    y += height + 14;
  });
}

type PdfDocumentOptions = Parameters<typeof writeCleanDocumentPdf>[1] & {
  assets?: PdfRenderAssets;
};

function sanitizePdfOptions(options: PdfDocumentOptions): PdfDocumentOptions {
  return {
    ...options,
    company: {
      ...options.company,
      name: sanitizeDocumentText(options.company.name),
      email: sanitizeNullableDocumentText(options.company.email),
      phone: sanitizeNullableDocumentText(options.company.phone),
      address: sanitizeNullableDocumentText(options.company.address),
      settings: options.company.settings
        ? {
            ...options.company.settings,
            ssmNumber: sanitizeNullableDocumentText(options.company.settings.ssmNumber)
          }
        : options.company.settings
    },
    customer: {
      ...options.customer,
      name: sanitizeDocumentText(options.customer.name),
      email: sanitizeNullableDocumentText(options.customer.email),
      phone: sanitizeNullableDocumentText(options.customer.phone),
      address: sanitizeNullableDocumentText(options.customer.address)
    },
    documentNumber: sanitizeDocumentText(options.documentNumber),
    items: options.items.map((item) => ({
      ...item,
      description: sanitizeDocumentText(item.description)
    })),
    paymentInfo: sanitizeNullableDocumentText(options.paymentInfo),
    importantNotes: sanitizeNullableDocumentText(options.importantNotes),
    remarks: sanitizeNullableDocumentText(options.remarks)
  };
}

type PaginatedPdfItem = {
  description: string;
  quantity?: unknown;
  showQuantity?: boolean;
  unitPrice?: unknown;
  lineTotal: unknown;
  hideAmount?: boolean;
};

function splitLongTextForPdf(text: string, maxChars: number) {
  const words = sanitizeDocumentText(text).split(/(\s+)/);
  const chunks: string[] = [];
  let current = "";

  words.forEach((word) => {
    if ((current + word).length > maxChars && current.trim()) {
      chunks.push(current.trim());
      current = word.trimStart();
      return;
    }
    current += word;
  });

  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

function preparePdfItems(items: PaginatedPdfItem[], maxChars = 900) {
  return items.flatMap((item) => {
    const cleanDescription = sanitizeDocumentText(item.description);
    const cleanItem = { ...item, description: cleanDescription };
    if (cleanDescription.length <= maxChars) return [cleanItem];

    return splitLongTextForPdf(cleanDescription, maxChars).map((description, index) => ({
      ...cleanItem,
      description: index === 0 ? description : `(continued)\n${description}`,
      quantity: index === 0 ? item.quantity : "",
      showQuantity: index === 0 ? item.showQuantity : false,
      unitPrice: index === 0 ? item.unitPrice : "",
      lineTotal: index === 0 ? item.lineTotal : "",
      hideAmount: index > 0
    }));
  });
}

function addPdfPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  if (range.count <= 1) return;

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.fillColor("#777777").font("Helvetica").fontSize(8).text(`Page ${index + 1} of ${range.count}`, 468, 815, {
      width: 85,
      align: "right"
    });
  }
}

function writeCleanPageHeader(
  doc: PDFKit.PDFDocument,
  options: {
    kind: "invoice" | "quotation" | "receipt";
    company: CleanPdfCompany;
    customer: CleanPdfCustomer;
    documentNumber: string;
    issueDate: Date;
    dueDate?: Date | null;
    total: unknown;
    paidAmount?: unknown;
    refundableDeposit?: unknown;
  }
) {
  const title = options.kind === "quotation" ? "QUOTATION" : options.kind === "receipt" ? "RECEIPT" : "INVOICE";
  const total = cleanNumber(options.total);
  const displayTotal = options.kind === "invoice" ? total + cleanNumber(options.refundableDeposit) : total;
  const paidAmount = cleanNumber(options.paidAmount);
  const balanceDue = options.kind === "invoice" ? Math.max(displayTotal - paidAmount, 0) : displayTotal;
  const summaryLabel = options.kind === "receipt" ? "Amount Paid:" : options.kind === "invoice" ? "Balance Due:" : "Total:";
  const summaryAmount = options.kind === "receipt" ? paidAmount || total : balanceDue;

  writeCleanCompanyBlock(doc, options.company, 42, 42);
  doc.fillColor("#333333").font("Helvetica").fontSize(34).text(title, CLEAN_TITLE.x, 42, {
    width: CLEAN_TITLE.width,
    align: "right"
  });
  doc
    .fillColor("#777777")
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(`# ${cleanPlainDocumentNumber(options.documentNumber)}`, CLEAN_TITLE.x, 82, {
      width: CLEAN_TITLE.width,
      align: "right"
    });

  doc.fillColor("#6D6D6D").font("Helvetica").fontSize(10).text("Bill To:", 42, 143);
  doc.fillColor("#2A2A2A").font("Helvetica-Bold").fontSize(10).text(options.customer.name, 42, 162, {
    width: 230
  });
  const customerDetails = joinDocumentText([options.customer.email, options.customer.phone, options.customer.address]);
  if (customerDetails) {
    doc.fillColor("#6D6D6D").font("Helvetica").fontSize(8).text(customerDetails, 42, 182, {
      width: 230,
      lineGap: 2
    });
  }

  doc.fillColor("#6D6D6D").font("Helvetica").fontSize(10).text("Date:", CLEAN_DATE.labelX, 143, {
    width: CLEAN_DATE.labelWidth,
    align: "right"
  });
  doc.fillColor("#2A2A2A").text(shortDate(options.issueDate), CLEAN_DATE.valueX, 143, {
    width: CLEAN_DATE.valueWidth,
    align: "right"
  });
  if (options.kind === "invoice" && options.dueDate) {
    doc.fillColor("#6D6D6D").text("Due:", CLEAN_DATE.labelX, 164, {
      width: CLEAN_DATE.labelWidth,
      align: "right"
    });
    doc.fillColor("#2A2A2A").text(shortDate(options.dueDate), CLEAN_DATE.valueX, 164, {
      width: CLEAN_DATE.valueWidth,
      align: "right"
    });
  }

  doc.roundedRect(CLEAN_SUMMARY.x, CLEAN_SUMMARY.y, CLEAN_SUMMARY.width, CLEAN_SUMMARY.height, 3).fill("#F3F3F3");
  doc.fillColor("#2A2A2A").font("Helvetica-Bold").fontSize(11).text(summaryLabel, CLEAN_SUMMARY.labelX, CLEAN_SUMMARY.y + 9, {
    width: CLEAN_SUMMARY.labelWidth,
    align: "right"
  });
  doc.text(cleanPdfMoney(summaryAmount), CLEAN_SUMMARY.amountX, CLEAN_SUMMARY.y + 9, {
    width: CLEAN_SUMMARY.amountWidth,
    align: "right"
  });
}

function writeCleanTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.roundedRect(CLEAN_TABLE.left, y, CLEAN_TABLE.width, CLEAN_TABLE.headerHeight, CLEAN_TABLE.headerRadius).fill("#3A3A3A");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
  doc.text("Item", CLEAN_TABLE.item.x, y + 7, { width: CLEAN_TABLE.item.width });
  doc.text("Quantity", CLEAN_TABLE.quantity.x, y + 7, { width: CLEAN_TABLE.quantity.width, align: "right" });
  doc.text("Rate", CLEAN_TABLE.rate.x, y + 7, { width: CLEAN_TABLE.rate.width, align: "right" });
  doc.text("Amount", CLEAN_TABLE.amount.x, y + 7, { width: CLEAN_TABLE.amount.width, align: "right" });
}

function cleanPdfRowHeight(doc: PDFKit.PDFDocument, item: PaginatedPdfItem) {
  return Math.max(46, doc.heightOfString(sanitizeDocumentText(item.description) || "-", { width: CLEAN_TABLE.item.width, lineGap: 2 }) + 22);
}

function writeCleanPdfRow(doc: PDFKit.PDFDocument, item: PaginatedPdfItem, y: number) {
  doc.strokeColor("#E7E7E7").lineWidth(1).moveTo(CLEAN_TABLE.left, y - 8).lineTo(CLEAN_TABLE.right, y - 8).stroke();
  writeCleanItemDescription(doc, item.description || "-", CLEAN_TABLE.item.x, y, CLEAN_TABLE.item.width);
  const showQty = cleanHasQuantity(item) && !item.hideAmount;
  doc.fillColor("#2A2A2A").font("Helvetica").fontSize(9);
  doc.text(showQty ? cleanNumber(item.quantity).toFixed(2) : "", CLEAN_TABLE.quantity.x, y, { width: CLEAN_TABLE.quantity.width, align: "right" });
  doc.text(showQty ? cleanPdfMoney(item.unitPrice) : "", CLEAN_TABLE.rate.x, y, { width: CLEAN_TABLE.rate.width, align: "right" });
  doc.text(item.hideAmount ? "" : cleanPdfMoney(item.lineTotal), CLEAN_TABLE.amount.x, y, { width: CLEAN_TABLE.amount.width, align: "right" });
}

function writeClassicPageHeader(
  doc: PDFKit.PDFDocument,
  options: {
    kind: "invoice" | "quotation" | "receipt";
    company: CleanPdfCompany;
    customer: CleanPdfCustomer;
    documentNumber: string;
    issueDate: Date;
    dueDate?: Date | null;
    assets?: PdfRenderAssets;
  }
) {
  const title = options.kind === "quotation" ? "QUOTATION" : options.kind === "receipt" ? "RECEIPT" : "INVOICE";
  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(24).text(title, 47, 108);
  drawLogoBox(doc, options.company, INVOICE_LOGO_BOX.x, INVOICE_LOGO_BOX.y, INVOICE_LOGO_BOX.width, INVOICE_LOGO_BOX.height, false, options.assets?.logo);

  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(10).text("FROM:", 47, 169);
  const companyName = sanitizeDocumentText(options.company.name);
  const companyX = 47;
  const companyWidth = 175;
  const companyNameY = 185;

  doc.font("Helvetica-Bold").fontSize(9);
  doc.text(companyName, companyX, companyNameY, { width: companyWidth });

  let companyDetailsY = companyNameY + doc.heightOfString(companyName, { width: companyWidth }) + 4;
  if (options.company.settings?.ssmNumber) {
    const ssmText = `(SSM: ${sanitizeDocumentText(options.company.settings.ssmNumber)})`;
    doc.font("Helvetica-Oblique").fontSize(9).text(ssmText, companyX, companyDetailsY, { width: companyWidth });
    companyDetailsY += doc.heightOfString(ssmText, { width: companyWidth }) + 8;
  } else {
    companyDetailsY += 8;
  }
  doc.font("Helvetica").fontSize(9).text(
    joinDocumentText([options.company.email, options.company.phone, options.company.address]),
    companyX,
    companyDetailsY,
    { width: 175, lineGap: 3 }
  );

  doc.font("Helvetica-Bold").fontSize(10).text("TO:", 263, 169);
  doc.fontSize(9).text(sanitizeDocumentText(options.customer.name), 263, 185, { width: 160 });
  const customerDetails = joinDocumentText([options.customer.phone, options.customer.address]);
  if (customerDetails) {
    doc.font("Helvetica").fontSize(9).text(customerDetails, 263, 205, { width: 160, lineGap: 3 });
  }

  const metaX = options.kind === "receipt" ? 443 : 486;
  doc.font("Helvetica-Bold").fontSize(10).text(options.kind === "quotation" ? "QUOTE NO:" : options.kind === "receipt" ? "RECEIPT NO:" : "INVOICE NO:", metaX, 169, { width: 120 });
  doc.font("Helvetica").fontSize(9).text(sanitizeDocumentText(options.documentNumber).replace(/^\D+/, ""), metaX, 187, { width: 120 });
  doc.font("Helvetica-Bold").fontSize(10).text("ISSUE DATE:", metaX, 207, { width: 120 });
  doc.font("Helvetica").fontSize(9).text(shortDate(options.issueDate).toUpperCase(), metaX, 225, { width: 120 });
  if (options.kind === "invoice" && options.dueDate) {
    doc.font("Helvetica-Bold").fontSize(10).text("DUE DATE:", metaX, 245, { width: 120 });
    doc.font("Helvetica").fontSize(9).text(shortDate(options.dueDate).toUpperCase(), metaX, 263, { width: 120 });
  }
}

function writeClassicTableHeader(doc: PDFKit.PDFDocument, kind: "invoice" | "quotation" | "receipt", y: number) {
  doc.rect(CLASSIC_TABLE.left, y, CLASSIC_TABLE.width, CLASSIC_TABLE.headerHeight).fill("#333333");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
  doc.text("Description", CLASSIC_TABLE.description.x, y + 5, { width: 330 });
  if (kind === "quotation") {
    doc.text("Qty", CLASSIC_TABLE.quantity.x, y + 5, { width: CLASSIC_TABLE.quantity.width, align: "right" });
  }
  doc.text("Price (RM)", CLASSIC_TABLE.price.x, y + 5, { width: CLASSIC_TABLE.price.width, align: "right" });
}

function classicPdfRowHeight(doc: PDFKit.PDFDocument, item: PaginatedPdfItem) {
  return Math.max(
    CLASSIC_TABLE.rowMinHeight,
    doc.heightOfString(sanitizeDocumentText(item.description) || "-", { width: CLASSIC_TABLE.description.width, lineGap: 4 }) +
      CLASSIC_TABLE.rowPaddingY * 2
  );
}

function writeClassicPdfRow(
  doc: PDFKit.PDFDocument,
  kind: "invoice" | "quotation" | "receipt",
  item: PaginatedPdfItem,
  y: number,
  rowHeight: number
) {
  doc.rect(CLASSIC_TABLE.left, y, CLASSIC_TABLE.width, rowHeight).fill(CLASSIC_TABLE.bodyFill);
  doc.fillColor("#111111").font("Helvetica").fontSize(9).text(sanitizeDocumentText(item.description) || "-", CLASSIC_TABLE.description.x, y + CLASSIC_TABLE.rowPaddingY, {
    width: kind === "quotation" ? CLASSIC_TABLE.quotationDescriptionWidth : CLASSIC_TABLE.description.width,
    lineGap: 4
  });
  if (kind === "quotation") {
    doc.text(item.hideAmount || item.showQuantity === false ? "" : Number(item.quantity).toFixed(2), CLASSIC_TABLE.quantity.x, y + CLASSIC_TABLE.rowPaddingY, {
      width: CLASSIC_TABLE.quantity.width,
      align: "right"
    });
  }
  doc.text(item.hideAmount ? "" : pdfMoneyPlain(item.lineTotal), CLASSIC_TABLE.price.x, y + CLASSIC_TABLE.rowPaddingY, { width: CLASSIC_TABLE.price.width, align: "right" });
}

function classicTotalRows(options: PdfDocumentOptions) {
  const total = cleanNumber(options.total);
  const displayTotal = options.kind === "invoice" ? total + cleanNumber(options.refundableDeposit) : total;
  const paidAmount = cleanNumber(options.paidAmount);
  const rows: Array<[string, unknown]> = [["TOTAL", displayTotal]];

  if (options.kind === "receipt") {
    rows.push(["PAID", options.paidAmount || options.total]);
  } else if (options.kind === "invoice" && paidAmount > 0) {
    rows.push(["PAID", options.paidAmount]);
    const balanceDue = Math.max(displayTotal - paidAmount, 0);
    if (balanceDue > 0) rows.push(["BALANCE", balanceDue]);
  }

  return rows;
}

function writeClassicTotalsBox(doc: PDFKit.PDFDocument, options: PdfDocumentOptions, y: number) {
  const rows = classicTotalRows(options);
  const height = Math.max(
    CLASSIC_TOTALS.minHeight,
    CLASSIC_TOTALS.rowTop + rows.length * CLASSIC_TOTALS.rowGap + CLASSIC_TOTALS.bottomPadding
  );

  doc.rect(CLASSIC_TABLE.left, y, CLASSIC_TABLE.width, height).fill(CLASSIC_TABLE.bodyFill);
  doc.strokeColor("#222222").lineWidth(1).moveTo(CLASSIC_TOTALS.ruleLeft, y + CLASSIC_TOTALS.ruleTop).lineTo(CLASSIC_TOTALS.ruleRight, y + CLASSIC_TOTALS.ruleTop).stroke();

  rows.forEach(([label, value], index) => {
    const rowY = y + CLASSIC_TOTALS.rowTop + index * CLASSIC_TOTALS.rowGap;
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(9).text(label, CLASSIC_TOTALS.labelX, rowY, {
      width: CLASSIC_TOTALS.labelWidth,
      align: "right"
    });
    doc.font("Helvetica").text(pdfMoneyPlain(value), CLASSIC_TOTALS.amountX, rowY, {
      width: CLASSIC_TOTALS.amountWidth,
      align: "right"
    });
  });

  return y + height;
}

function writePaginatedCleanDocumentPdf(
  doc: PDFKit.PDFDocument,
  options: PdfDocumentOptions
) {
  options = sanitizePdfOptions(options);
  const baseItems = preparePdfItems(
    options.kind === "invoice" && cleanNumber(options.refundableDeposit) > 0
      ? [
          ...options.items,
          {
            description: "Refundable Deposit",
            quantity: "",
            showQuantity: false,
            unitPrice: "",
            lineTotal: options.refundableDeposit
          }
        ]
      : options.items
  );
  const tableStartY = CLEAN_TABLE.top;
  const bottomY = CLEAN_TABLE.bottom;
  let y = tableStartY;

  doc.addPage();
  writeCleanPageHeader(doc, options);
  writeCleanTableHeader(doc, y);
  y = tableStartY + CLEAN_TABLE.itemStartOffset;

  baseItems.forEach((item) => {
    const rowHeight = cleanPdfRowHeight(doc, item);
    if (y + rowHeight > bottomY) {
      doc.addPage();
      writeCleanPageHeader(doc, options);
      writeCleanTableHeader(doc, tableStartY);
      y = tableStartY + CLEAN_TABLE.itemStartOffset;
    }
    writeCleanPdfRow(doc, item, y);
    y += rowHeight;
  });

  const summaryHeight =
    96 + doc.heightOfString(joinDocumentText([options.remarks, options.paymentInfo, options.importantNotes]), { width: CLEAN_SECTIONS.width, lineGap: 3 });
  if (y + summaryHeight > bottomY) {
    doc.addPage();
    writeCleanPageHeader(doc, options);
    y = tableStartY;
  } else {
    y += 28;
  }

  const total = cleanNumber(options.total);
  const displayTotal = options.kind === "invoice" ? total + cleanNumber(options.refundableDeposit) : total;
  const paidAmount = cleanNumber(options.paidAmount);
  const rows: Array<[string, unknown, boolean?]> = [["Total:", displayTotal, false]];
  if (options.kind === "invoice" && paidAmount > 0) {
    rows.push(["Paid:", options.paidAmount, false], ["Balance Due:", Math.max(displayTotal - paidAmount, 0), true]);
  }
  if (options.kind === "receipt") rows.push(["Paid:", options.paidAmount || options.total, false]);

  rows.forEach(([label, value, emphasized], index) => {
    const rowY = y + index * 20;
    doc.fillColor(emphasized ? "#2A2A2A" : "#6D6D6D").font(emphasized ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.text(label, CLEAN_SUMMARY.labelX, rowY, { width: CLEAN_SUMMARY.labelWidth, align: "right" });
    doc.fillColor("#2A2A2A").font(emphasized ? "Helvetica-Bold" : "Helvetica").text(cleanPdfMoney(value), CLEAN_SUMMARY.amountX, rowY, {
      width: CLEAN_SUMMARY.amountWidth,
      align: "right"
    });
  });
  y += rows.length * 20 + 24;

  if (options.kind === "receipt") {
    drawChopBox(doc, options.company, 404, y, 126, 66, options.assets?.chop);
    y += 78;
  }

  const sections: Array<[string, string | null | undefined]> = [
    ["Notes:", options.remarks],
    ["Payment Methods:", options.paymentInfo],
    ["Terms:", options.importantNotes]
  ];
  sections.forEach(([label, value]) => {
    const cleanValue = sanitizeDocumentText(value);
    if (!cleanValue) return;
    const height = doc.heightOfString(cleanValue, { width: CLEAN_SECTIONS.width, lineGap: 3 }) + 28;
    if (y + height > bottomY) {
      doc.addPage();
      writeCleanPageHeader(doc, options);
      y = tableStartY;
    }
    doc.fillColor("#6D6D6D").font("Helvetica").fontSize(10).text(label, CLEAN_SECTIONS.x, y);
    doc.fillColor("#2A2A2A").font("Helvetica").fontSize(9).text(cleanValue, CLEAN_SECTIONS.x, y + 16, { width: CLEAN_SECTIONS.width, lineGap: 3 });
    y += height + 12;
  });
}

function writePaginatedClassicDocumentPdf(
  doc: PDFKit.PDFDocument,
  options: PdfDocumentOptions
) {
  options = sanitizePdfOptions(options);
  const baseItems = preparePdfItems(
    options.kind === "invoice" && cleanNumber(options.refundableDeposit) > 0
      ? [
          ...options.items,
          {
            description: "Refundable Deposit",
            quantity: "",
            showQuantity: false,
            unitPrice: "",
            lineTotal: options.refundableDeposit
          }
        ]
      : options.items
  );
  const tableStartY = CLASSIC_TABLE.top;
  const totalsStartY = CLASSIC_TABLE.top + CLASSIC_TABLE.headerHeight + CLASSIC_TABLE.minBodyHeight;
  const summaryBottomY = 800;
  const bottomY = CLASSIC_TABLE.bottom;
  let y = tableStartY;

  doc.addPage();
  writeClassicPageHeader(doc, options);
  writeClassicTableHeader(doc, options.kind, y);
  y = tableStartY + CLASSIC_TABLE.itemStartOffset;

  baseItems.forEach((item) => {
    const rowHeight = classicPdfRowHeight(doc, item);
    if (y + rowHeight > bottomY) {
      doc.addPage();
      writeClassicPageHeader(doc, options);
      writeClassicTableHeader(doc, options.kind, tableStartY);
      y = tableStartY + CLASSIC_TABLE.itemStartOffset;
    }
    writeClassicPdfRow(doc, options.kind, item, y, rowHeight);
    y += rowHeight;
  });

  const summaryText = joinDocumentText([options.remarks, options.paymentInfo, options.importantNotes]);
  const summaryHeight = 95 + doc.heightOfString(summaryText, { width: 486, lineGap: 2 });
  const itemsEndY = y;
  if (summaryHeight > summaryBottomY - totalsStartY) {
    doc.addPage();
    writeClassicPageHeader(doc, options);
    y = totalsStartY;
  } else {
    y = Math.max(y + CLASSIC_TOTALS.preGap, totalsStartY);
    if (y > itemsEndY) {
      doc.rect(CLASSIC_TABLE.left, itemsEndY, CLASSIC_TABLE.width, y - itemsEndY).fill(CLASSIC_TABLE.bodyFill);
    }
  }

  y = writeClassicTotalsBox(doc, options, y);
  if (options.kind === "receipt") {
    drawChopBox(doc, options.company, 412, y + 19, 156, 85, options.assets?.chop);
  }

  const cleanRemarks = sanitizeDocumentText(options.remarks);
  if (cleanRemarks) {
    const remarksY = y + CLASSIC_SUMMARY.remarksGap;
    doc.fillColor("#222222").font("Helvetica-Oblique").fontSize(8).text("Remarks:", CLASSIC_SUMMARY.remarksX, remarksY, {
      width: CLASSIC_SUMMARY.remarksWidth
    });
    doc.fontSize(8).text(cleanRemarks, CLASSIC_SUMMARY.remarksX, remarksY + 12, {
      width: CLASSIC_SUMMARY.remarksWidth,
      lineGap: 2
    });
  }

  const cleanPaymentInfo = sanitizeDocumentText(options.paymentInfo);
  if (cleanPaymentInfo) {
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(CLASSIC_SUMMARY.footerFontSize).text("PAYMENT INFO", CLASSIC_SUMMARY.footerLeftX, CLASSIC_SUMMARY.footerTop, {
      width: CLASSIC_SUMMARY.footerLeftWidth
    });
    doc.font("Helvetica").fontSize(CLASSIC_SUMMARY.footerFontSize).text(cleanPaymentInfo, CLASSIC_SUMMARY.footerLeftX, CLASSIC_SUMMARY.footerTop + CLASSIC_SUMMARY.footerBodyOffsetY, {
      width: CLASSIC_SUMMARY.footerLeftWidth,
      lineGap: CLASSIC_SUMMARY.footerLineGap
    });
  }

  const cleanImportantNotes = sanitizeDocumentText(options.importantNotes);
  if (cleanImportantNotes) {
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(CLASSIC_SUMMARY.footerFontSize).text("IMPORTANT NOTES", CLASSIC_SUMMARY.footerRightX, CLASSIC_SUMMARY.footerTop, {
      width: CLASSIC_SUMMARY.footerRightWidth
    });
    doc.font("Helvetica").fontSize(CLASSIC_SUMMARY.footerFontSize).text(cleanImportantNotes, CLASSIC_SUMMARY.footerRightX, CLASSIC_SUMMARY.footerTop + CLASSIC_SUMMARY.footerBodyOffsetY, {
      width: CLASSIC_SUMMARY.footerRightWidth,
      lineGap: CLASSIC_SUMMARY.footerLineGap
    });
  }
}

function pdfChunkToBuffer(chunk: unknown) {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  if (chunk instanceof ArrayBuffer) return Buffer.from(chunk);
  if (typeof chunk === "string") return Buffer.from(chunk);

  throw new PdfGenerationStageError("buffer-pdf-chunk", new TypeError("PDFKit emitted an unsupported data chunk."), {
    chunkType: typeof chunk,
    chunkConstructor: isRecord(chunk) && chunk.constructor ? chunk.constructor.name : null
  });
}

async function finishPdf(doc: PDFKit.PDFDocument, details: PdfLogContext) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof PdfGenerationStageError ? error : new PdfGenerationStageError("finish-pdf", error, details));
    };

    doc.on("data", (chunk) => {
      try {
        chunks.push(pdfChunkToBuffer(chunk));
      } catch (error) {
        fail(error);
      }
    });
    doc.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", fail);

    try {
      addPdfPageNumbers(doc);
      doc.end();
    } catch (error) {
      fail(error);
    }
  });
}

async function saveGeneratedPdf({
  companyId,
  documentType,
  documentId,
  previousUrl,
  data
}: {
  companyId: string;
  documentType: "invoice" | "quotation" | "receipt";
  documentId: string;
  previousUrl?: string | null;
  data: Buffer;
}) {
  const stored = await saveFile({
    key: documentPdfKey(companyId, documentType, documentId),
    data,
    contentType: "application/pdf",
    visibility: "public"
  });

  if (previousUrl && previousUrl !== stored.url) {
    await deleteFile(previousUrl);
  }

  return stored.url;
}

function pdfDocumentContext(
  documentType: DocumentType,
  document: {
    id: string;
    companyId: string;
    templateKey?: string | null;
    pdfUrl?: string | null;
    company?: {
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      settings?: {
        logoUrl?: string | null;
        chopUrl?: string | null;
        paymentInfo?: string | null;
        defaultImportantNotes?: string | null;
        ssmNumber?: string | null;
      } | null;
    } | null;
    customer?: {
      address?: string | null;
    } | null;
    items?: unknown[];
    paymentInfo?: string | null;
    importantNotes?: string | null;
    remarks?: string | null;
  }
) {
  return safeLogContext({
    documentType,
    documentId: document.id,
    companyId: document.companyId,
    templateKey: document.templateKey || "classic",
    hasPreviousPdfUrl: Boolean(document.pdfUrl),
    itemCount: document.items?.length ?? 0,
    hasCompanySettings: Boolean(document.company?.settings),
    hasLogoUrl: Boolean(document.company?.settings?.logoUrl),
    logoExtension: document.company?.settings?.logoUrl ? path.extname(document.company.settings.logoUrl.split("?")[0] || "").toLowerCase() : null,
    hasChopUrl: Boolean(document.company?.settings?.chopUrl),
    chopExtension: document.company?.settings?.chopUrl ? path.extname(document.company.settings.chopUrl.split("?")[0] || "").toLowerCase() : null,
    hasCompanyEmail: Boolean(document.company?.email),
    hasCompanyPhone: Boolean(document.company?.phone),
    hasCompanyAddress: Boolean(document.company?.address),
    hasCompanySsm: Boolean(document.company?.settings?.ssmNumber),
    hasCustomerAddress: Boolean(document.customer?.address),
    hasPaymentInfo: Boolean(document.paymentInfo || document.company?.settings?.paymentInfo),
    hasImportantNotes: Boolean(document.importantNotes || document.company?.settings?.defaultImportantNotes),
    hasRemarks: Boolean(document.remarks)
  });
}

async function generateInvoicePdf(companyId: string, documentId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: documentId, companyId },
    include: {
      company: { include: { settings: true } },
      customer: true,
      quotation: true,
      items: { orderBy: { sortOrder: "asc" } }
    }
  });
  if (!invoice) throw new Error("Invoice not found.");

  const context = pdfDocumentContext(DocumentType.INVOICE, invoice);
  withPdfStage("prepare-fonts", context, () => ensurePdfKitStandardFontData());
  const assets = await withAsyncPdfStage("prepare-assets", context, () => preparePdfAssets(invoice.company));
  const doc = withPdfStage(
    "create-pdf-document",
    context,
    () => new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, bufferPages: true })
  );
  const template = getDocumentTemplate(invoice.templateKey);
  const pdfOptions = {
    kind: "invoice" as const,
    company: invoice.company,
    customer: invoice.customer,
    documentNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    items: invoice.items,
    total: invoice.total,
    paidAmount: invoice.paidAmount,
    refundableDeposit: invoice.refundableDeposit,
    paymentInfo: invoice.paymentInfo,
    importantNotes: invoice.importantNotes,
    remarks: invoice.remarks,
    assets
  };

  withPdfStage("render-pdf", { ...context, resolvedTemplateKey: template.key }, () => {
    if (template.key === "clean") {
      writePaginatedCleanDocumentPdf(doc, pdfOptions);
    } else {
      writePaginatedClassicDocumentPdf(doc, pdfOptions);
    }
  });

  const pdfBuffer = await finishPdf(doc, { ...context, resolvedTemplateKey: template.key });
  const storageKey = documentPdfKey(companyId, "invoice", invoice.id);
  const pdfUrl = await withAsyncPdfStage("save-pdf", { ...context, storageKey, bytes: pdfBuffer.length }, () =>
    saveGeneratedPdf({
      companyId,
      documentType: "invoice",
      documentId: invoice.id,
      previousUrl: invoice.pdfUrl,
      data: pdfBuffer
    })
  );

  await withAsyncPdfStage("update-document-record", context, () =>
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pdfUrl,
        pdfGeneratedAt: new Date(),
        pdfNeedsRegeneration: false
      }
    })
  );

  return pdfUrl;
}

async function generateQuotationPdf(companyId: string, documentId: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id: documentId, companyId },
    include: {
      company: { include: { settings: true } },
      customer: true,
      items: { orderBy: { sortOrder: "asc" } }
    }
  });
  if (!quotation) throw new Error("Quotation not found.");

  const context = pdfDocumentContext(DocumentType.QUOTATION, quotation);
  withPdfStage("prepare-fonts", context, () => ensurePdfKitStandardFontData());
  const assets = await withAsyncPdfStage("prepare-assets", context, () => preparePdfAssets(quotation.company));
  const doc = withPdfStage(
    "create-pdf-document",
    context,
    () => new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, bufferPages: true })
  );
  const template = getDocumentTemplate(quotation.templateKey);
  const pdfOptions = {
    kind: "quotation" as const,
    company: quotation.company,
    customer: quotation.customer,
    documentNumber: quotation.quotationNumber,
    issueDate: quotation.issueDate,
    items: quotation.items,
    total: quotation.total,
    paymentInfo: quotation.paymentInfo,
    importantNotes: quotation.importantNotes,
    remarks: quotation.remarks,
    assets
  };

  withPdfStage("render-pdf", { ...context, resolvedTemplateKey: template.key }, () => {
    if (template.key === "clean") {
      writePaginatedCleanDocumentPdf(doc, pdfOptions);
    } else {
      writePaginatedClassicDocumentPdf(doc, pdfOptions);
    }
  });

  const pdfBuffer = await finishPdf(doc, { ...context, resolvedTemplateKey: template.key });
  const storageKey = documentPdfKey(companyId, "quotation", quotation.id);
  const pdfUrl = await withAsyncPdfStage("save-pdf", { ...context, storageKey, bytes: pdfBuffer.length }, () =>
    saveGeneratedPdf({
      companyId,
      documentType: "quotation",
      documentId: quotation.id,
      previousUrl: quotation.pdfUrl,
      data: pdfBuffer
    })
  );
  await withAsyncPdfStage("update-document-record", context, () =>
    prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        pdfUrl,
        pdfGeneratedAt: new Date(),
        pdfNeedsRegeneration: false
      }
    })
  );

  return pdfUrl;
}

async function generateReceiptPdf(companyId: string, documentId: string) {
  const receipt = await prisma.receipt.findFirst({
    where: { id: documentId, companyId },
    include: {
      company: { include: { settings: true } },
      customer: true,
      invoice: {
        include: {
          items: { orderBy: { sortOrder: "asc" } }
        }
      }
    }
  });
  if (!receipt) throw new Error("Receipt not found.");

  const context = pdfDocumentContext(DocumentType.RECEIPT, {
    ...receipt,
    items: receipt.invoice.items,
    paymentInfo: receipt.company.settings?.paymentInfo,
    importantNotes: receipt.company.settings?.defaultImportantNotes,
    remarks: receipt.notes
  });
  withPdfStage("prepare-fonts", context, () => ensurePdfKitStandardFontData());
  const assets = await withAsyncPdfStage("prepare-assets", context, () => preparePdfAssets(receipt.company));
  const doc = withPdfStage(
    "create-pdf-document",
    context,
    () => new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, bufferPages: true })
  );
  const template = getDocumentTemplate(receipt.templateKey);
  const pdfOptions = {
    kind: "receipt" as const,
    company: receipt.company,
    customer: receipt.customer,
    documentNumber: receipt.receiptNumber,
    issueDate: receipt.receiptDate,
    items: receipt.invoice.items,
    total: receipt.amount,
    paidAmount: receipt.amount,
    paymentInfo: receipt.company.settings?.paymentInfo,
    importantNotes: receipt.company.settings?.defaultImportantNotes,
    remarks: receipt.notes,
    assets
  };

  withPdfStage("render-pdf", { ...context, resolvedTemplateKey: template.key }, () => {
    if (template.key === "clean") {
      writePaginatedCleanDocumentPdf(doc, pdfOptions);
    } else {
      writePaginatedClassicDocumentPdf(doc, pdfOptions);
    }
  });

  const pdfBuffer = await finishPdf(doc, { ...context, resolvedTemplateKey: template.key });
  const storageKey = documentPdfKey(companyId, "receipt", receipt.id);
  const pdfUrl = await withAsyncPdfStage("save-pdf", { ...context, storageKey, bytes: pdfBuffer.length }, () =>
    saveGeneratedPdf({
      companyId,
      documentType: "receipt",
      documentId: receipt.id,
      previousUrl: receipt.pdfUrl,
      data: pdfBuffer
    })
  );
  await withAsyncPdfStage("update-document-record", context, () =>
    prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        pdfUrl,
        pdfGeneratedAt: new Date(),
        pdfNeedsRegeneration: false
      }
    })
  );

  return pdfUrl;
}

export async function generateDocumentPdf(target: PdfTarget) {
  if (target.documentType === DocumentType.INVOICE) {
    return generateInvoicePdf(target.companyId, target.documentId);
  }

  if (target.documentType === DocumentType.QUOTATION) {
    return generateQuotationPdf(target.companyId, target.documentId);
  }

  return generateReceiptPdf(target.companyId, target.documentId);
}
