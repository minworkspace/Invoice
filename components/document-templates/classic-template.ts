export const classicTemplate = {
  key: "classic",
  name: "Classic",
  description: "Current PDF-inspired layout with strong title and dark item table.",
  preview: {
    page: "bg-white p-8 text-[#111111]",
    title: "mt-12 text-[30px] font-bold uppercase leading-none tracking-normal",
    logo: "h-[96px] w-[96px]",
    metaGrid: "mt-12 grid grid-cols-[1.25fr_1fr_0.95fr] gap-6 text-[11px] leading-tight",
    table: "mt-10 overflow-hidden bg-[#f0efed] text-[11px]",
    tableHead: "bg-[#333333] text-white",
    tableBody: "px-4 py-3",
    remarks: "mt-3",
    bottom: "mt-28"
  },
  pdf: {
    headerFill: "#333333",
    bodyFill: "#F0EFED",
    textFill: "#111111",
    rowMinHeight: 28,
    fontSize: 9
  }
} as const;
