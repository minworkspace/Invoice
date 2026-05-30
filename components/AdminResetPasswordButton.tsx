"use client";

import { useState } from "react";

type AdminResetPasswordButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  buttonClassName?: string;
  fields: Record<string, string>;
  userName: string;
};

export function AdminResetPasswordButton({
  action,
  buttonClassName = "btn btn-secondary h-9",
  fields,
  userName
}: AdminResetPasswordButtonProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const canSubmit = password.length >= 8 && password === confirmPassword;

  return (
    <>
      <button className={buttonClassName} onClick={() => setOpen(true)} type="button">
        Reset password
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/45 px-4">
          <div className="w-full max-w-lg rounded-lg border border-line bg-paper p-6 text-left shadow-[0_20px_60px_rgba(17,17,17,0.18)]">
            <p className="text-lg font-semibold text-ink">Reset password for {userName}</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Set a new password with at least 8 characters. The old password hash is replaced securely.
            </p>

            <form action={action} className="mt-5 space-y-4">
              {Object.entries(fields).map(([name, value]) => (
                <input key={name} name={name} type="hidden" value={value} />
              ))}

              <label className="block">
                <span className="label">New password</span>
                <input
                  className="field"
                  minLength={8}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>

              <label className="block">
                <span className="label">Confirm password</span>
                <input
                  className="field"
                  minLength={8}
                  name="confirmPassword"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>

              <div className="flex justify-end gap-3">
                <button className="btn btn-secondary" onClick={() => setOpen(false)} type="button">
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={!canSubmit} type="submit">
                  Save new password
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
