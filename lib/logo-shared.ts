export const MAX_LOGO_SIZE = 2 * 1024 * 1024;

export function logoHelperText() {
  return "Recommended logo ratio: 3:1 horizontal. The logo will be fitted inside this area for invoice consistency.";
}

export function chopHelperText() {
  return "Optional company chop / stamp. It will be fitted inside the receipt stamp area without cropping.";
}

export function logoAcceptValue() {
  return ".png,.jpg,.jpeg,image/png,image/jpeg";
}

export function imageAcceptedFormatsText() {
  return "Accepted formats: PNG, JPG, JPEG. Max file size: 2MB.";
}

export function pdfCompatibilityText() {
  return "Use PNG or JPG for reliable PDF previews and downloads.";
}

export function versionedLogoUrl(logoUrl?: string | null, updatedAt?: Date | string | null) {
  if (!logoUrl) return "";
  if (!updatedAt) return logoUrl;

  const stamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(stamp)) return logoUrl;

  const separator = logoUrl.includes("?") ? "&" : "?";
  return `${logoUrl}${separator}v=${stamp}`;
}
