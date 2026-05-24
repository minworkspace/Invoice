export const cleanTemplate = {
  key: "clean",
  name: "Clean",
  description: "Minimal black-and-white layout with a large right-aligned title.",
  preview: {
    page: "bg-white p-8 text-[#2A2A2A]",
    title: "text-[32px] font-normal uppercase leading-none tracking-normal text-[#333333]",
    logo: "h-[48px] w-[120px]",
    metaGrid: "mt-12 grid grid-cols-[1.25fr_1fr_0.95fr] gap-6 text-[11px] leading-tight",
    table: "mt-10 overflow-hidden bg-white text-[11px]",
    tableHead: "bg-[#3A3A3A] text-white",
    tableBody: "bg-white",
    remarks: "mt-3",
    bottom: "mt-28"
  },
  pdf: {
    headerFill: "#3A3A3A",
    bodyFill: "#FFFFFF",
    textFill: "#2A2A2A",
    rowMinHeight: 36,
    fontSize: 9
  }
} as const;
