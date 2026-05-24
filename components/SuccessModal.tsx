"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SuccessModalProps = {
  open: boolean;
  title: string;
  message: string;
  primaryLabel: string;
};

export function SuccessModal({ open, title, message, primaryLabel }: SuccessModalProps) {
  const [isOpen, setIsOpen] = useState(open);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const cleanedHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("created");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  if (!isOpen) return null;

  function closeModal() {
    setIsOpen(false);
    router.replace(cleanedHref, { scroll: false });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/45 px-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-paper p-6 shadow-[0_20px_60px_rgba(17,17,17,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-ink">{title}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
          </div>
          <button
            aria-label="Close success message"
            className="rounded-md border border-line px-2 py-1 text-sm text-muted transition hover:border-ink hover:text-ink"
            onClick={closeModal}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button className="btn btn-secondary" onClick={closeModal} type="button">
            Stay here
          </button>
          <button className="btn btn-primary" onClick={closeModal} type="button">
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
