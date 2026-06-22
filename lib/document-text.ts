export function sanitizeDocumentText(value: unknown, options: { trim?: boolean } = {}) {
  const trim = options.trim ?? true;
  const text = String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\uFEFF]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ ]+$/g, ""))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n");

  return trim ? text.trim() : text;
}

export function sanitizeNullableDocumentText(value: unknown) {
  const text = sanitizeDocumentText(value);
  return text.length ? text : null;
}

export function sanitizePhoneDisplay(value: unknown) {
  const text = sanitizeDocumentText(value);
  if (!text) return "";

  return text
    .split("\n")
    .map((line) => {
      let cleaned = line
        .replace(/[^\d+()\-\s]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .replace(/^[\s-]+/g, "")
        .replace(/[\s-]+$/g, "");

      if (cleaned.includes("+")) {
        cleaned = `${cleaned.startsWith("+") ? "+" : ""}${cleaned.replace(/\+/g, "")}`;
      }

      return cleaned;
    })
    .filter(Boolean)
    .join("\n");
}

export function sanitizeNullablePhoneDisplay(value: unknown) {
  const text = sanitizePhoneDisplay(value);
  return text.length ? text : null;
}

export function joinDocumentText(values: unknown[]) {
  return values
    .map((value) => sanitizeDocumentText(value))
    .filter(Boolean)
    .join("\n");
}

export function hasDocumentText(value: unknown) {
  return sanitizeDocumentText(value).length > 0;
}
