export const A4 = {
  pdfWidth: 595,
  pdfHeight: 842,
  previewWidth: 794,
  previewHeight: 1123
};

export const PDF_TO_PREVIEW = A4.previewWidth / A4.pdfWidth;

export function previewPx(value: number) {
  return `${value * PDF_TO_PREVIEW}px`;
}

export const CLEAN_LAYOUT = {
  page: {
    marginLeft: 42,
    marginRight: 42,
    paddingTop: 42,
    paddingBottom: 42,
    rightEdge: 553,
    rightTextEdge: 539
  },
  title: {
    x: 326,
    width: 213
  },
  billTo: {
    x: 42,
    labelY: 143,
    nameY: 162,
    detailsY: 182,
    width: 250
  },
  table: {
    left: 42,
    right: 553,
    width: 511,
    paddingX: 14,
    top: 270,
    bottom: 800,
    itemStartOffset: 34,
    headerHeight: 24,
    headerRadius: 3,
    item: { x: 56, width: 216 },
    quantity: { x: 272, width: 60 },
    rate: { x: 332, width: 84 },
    amount: { x: 416, width: 123 }
  },
  summary: {
    x: 310,
    y: 190,
    width: 243,
    height: 30,
    labelX: 330,
    labelWidth: 94,
    amountX: 433,
    amountWidth: 106
  },
  date: {
    labelX: 330,
    labelWidth: 94,
    valueX: 433,
    valueWidth: 106
  },
  sections: {
    x: 42,
    width: 497
  }
};

export const CLASSIC_LAYOUT = {
  table: {
    left: 32,
    right: 562,
    width: 530,
    paddingX: 15,
    top: 284,
    bottom: 620,
    itemStartOffset: 18,
    headerHeight: 18,
    minBodyHeight: 52,
    rowMinHeight: 22,
    rowPaddingY: 6,
    bodyFill: "#F0EFED",
    description: { x: 47, width: 345 },
    quotationDescriptionWidth: 330,
    quantity: { x: 397, width: 38 },
    price: { x: 450, width: 96 }
  },
  totals: {
    ruleLeft: 47,
    ruleRight: 547,
    labelX: 380,
    labelWidth: 62,
    amountX: 450,
    amountWidth: 96,
    minHeight: 24,
    rowGap: 14,
    preGap: 0,
    ruleTop: 0,
    rowTop: 6,
    bottomPadding: 3
  },
  summary: {
    remarksGap: 8,
    remarksX: 47,
    remarksWidth: 420,
    footerTop: 735,
    footerLeftX: 47,
    footerLeftWidth: 250,
    footerRightX: 337,
    footerRightWidth: 210,
    footerFontSize: 8.25,
    footerBodyOffsetY: 15,
    footerLineGap: 1.5
  }
};
