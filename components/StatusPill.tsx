import { compactStatus } from "@/lib/format";

const colors: Record<string, string> = {
  DRAFT: "border-line bg-white text-muted",
  SENT: "border-[#CFAE43] bg-[#FFF8DF] text-[#765B00]",
  CONFIRMED: "border-brand/25 bg-brand/10 text-brand",
  PAID: "border-[#4C9A68]/25 bg-[#E9F7EE] text-[#2F7047]",
  CANCELLED: "border-[#B64545]/25 bg-[#FDECEC] text-[#9D3838]"
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${colors[status] || colors.DRAFT}`}>
      {compactStatus(status)}
    </span>
  );
}
