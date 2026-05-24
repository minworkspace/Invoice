"use client";

import { useMemo, useState } from "react";

type WhatsAppButtonProps = {
  documentType: "INVOICE" | "QUOTATION" | "RECEIPT";
  documentId: string;
  documentNumber: string;
  amount: string;
  defaultPhone?: string | null;
  linkPath: string;
};

function cleanPhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function WhatsAppButton({
  documentType,
  documentId,
  documentNumber,
  amount,
  defaultPhone,
  linkPath
}: WhatsAppButtonProps) {
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone || "");
  const [sending, setSending] = useState(false);

  const message = useMemo(() => {
    const url = typeof window === "undefined" ? linkPath : `${window.location.origin}${linkPath}`;
    return `${documentType} ${documentNumber}\nAmount: ${amount}\nLink: ${url}`;
  }, [amount, documentNumber, documentType, linkPath]);

  async function send() {
    const phone = cleanPhone(phoneNumber);
    if (!phone) return;

    setSending(true);
    const response = await fetch("/api/documents/whatsapp-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType,
        documentId,
        phoneNumber: phone,
        message
      })
    });
    if (!response.ok) {
      setSending(false);
      window.alert("WhatsApp send could not be logged. Please refresh and try again.");
      return;
    }
    setSending(false);
    setOpen(false);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <button className="btn btn-secondary" type="button" onClick={() => setOpen(true)}>
        Send via WhatsApp
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">Send via WhatsApp</h3>
                <p className="mt-1 text-sm text-muted">{documentNumber}</p>
                <p className="mt-2 text-sm text-muted">
                  WhatsApp will open with a message. Please send it manually.
                </p>
              </div>
              <button className="btn btn-secondary h-9" type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <label className="mt-4 block">
              <span className="label">WhatsApp number</span>
              <input className="field" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
            </label>
            <label className="mt-4 block">
              <span className="label">Message</span>
              <textarea className="field min-h-32" value={message} readOnly />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" onClick={send} disabled={sending}>
                {sending ? "Opening..." : "Open WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
