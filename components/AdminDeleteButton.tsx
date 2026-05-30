"use client";

import { useState } from "react";

type AdminDeleteButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  buttonClassName?: string;
  buttonLabel?: string;
  confirmLabel?: string;
  confirmText?: string;
  description: string;
  fields: Record<string, string>;
  title: string;
};

export function AdminDeleteButton({
  action,
  buttonClassName = "btn btn-danger h-9",
  buttonLabel = "Delete",
  confirmLabel = "Delete permanently",
  confirmText,
  description,
  fields,
  title
}: AdminDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const canDelete = !confirmText || typedValue === confirmText;

  return (
    <>
      <button className={buttonClassName} onClick={() => setOpen(true)} type="button">
        {buttonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/45 px-4">
          <div className="w-full max-w-lg rounded-lg border border-line bg-paper p-6 text-left shadow-[0_20px_60px_rgba(17,17,17,0.18)]">
            <p className="text-lg font-semibold text-ink">{title}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>

            <form action={action} className="mt-5 space-y-4">
              {Object.entries(fields).map(([name, value]) => (
                <input key={name} name={name} type="hidden" value={value} />
              ))}

              {confirmText ? (
                <label>
                  <span className="label">Type {confirmText} to confirm</span>
                  <input
                    className="field"
                    name="confirmation"
                    onChange={(event) => setTypedValue(event.target.value)}
                    value={typedValue}
                  />
                </label>
              ) : null}

              <div className="flex justify-end gap-3">
                <button className="btn btn-secondary" onClick={() => setOpen(false)} type="button">
                  Cancel
                </button>
                <button className="btn btn-danger" disabled={!canDelete} type="submit">
                  {confirmLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
