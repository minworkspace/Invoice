export const MAX_LOGO_SIZE = 2 * 1024 * 1024;

export function logoHelperText() {
  return "Recommended logo ratio: 3:1 horizontal. The logo will be fitted inside this area for invoice consistency.";
}

export function chopHelperText() {
  return "Optional company chop / stamp. It will be fitted inside the receipt stamp area without cropping.";
}

export function logoAcceptValue() {
  return ".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml";
}

export function imageAcceptedFormatsText() {
  return "Accepted formats: PNG, JPG, JPEG, WebP, SVG. Max file size: 2MB.";
}

export function pdfCompatibilityText() {
  return "For reliable PDFs, WebP and SVG uploads are converted to PNG before saving.";
}

export function versionedLogoUrl(logoUrl?: string | null, updatedAt?: Date | string | null) {
  if (!logoUrl) return "";
  if (!updatedAt) return logoUrl;

  const stamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(stamp)) return logoUrl;

  const separator = logoUrl.includes("?") ? "&" : "?";
  return `${logoUrl}${separator}v=${stamp}`;
}
