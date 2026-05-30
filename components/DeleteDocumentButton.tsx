"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

type DeleteDocumentButtonProps = {
  action: string;
  buttonClassName?: string;
  buttonLabel?: string;
  confirmLabel?: string;
  description: string;
  returnTo?: string;
  title: string;
};

export function DeleteDocumentButton({
  action,
  buttonClassName = "btn btn-secondary",
  buttonLabel = "Delete",
  confirmLabel = "Delete permanently",
  description,
  returnTo,
  title
}: DeleteDocumentButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pathname = usePathname();
  const requestUrl = `${action}${action.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo || pathname)}`;

  return (
    <>
      <button className={buttonClassName} onClick={() => setOpen(true)} type="button">
        {buttonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/45 px-4">
          <div className="w-full max-w-md rounded-lg border border-line bg-paper p-6 shadow-[0_20px_60px_rgba(17,17,17,0.18)]">
            <p className="text-lg font-semibold text-ink">{title}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>

            <form className="mt-5 flex justify-end gap-3" action={requestUrl} method="post" onSubmit={() => setPending(true)}>
              <button className="btn btn-secondary" onClick={() => setOpen(false)} type="button">
                Cancel
              </button>
              <button className="btn btn-danger" disabled={pending} type="submit">
                {pending ? "Deleting..." : confirmLabel}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
