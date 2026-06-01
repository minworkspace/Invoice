import "server-only";

import { randomUUID } from "node:crypto";
import fsSync from "fs";
import path from "path";
import { MAX_LOGO_SIZE } from "@/lib/logo-shared";
import { deleteFile, getLocalFilePath, saveFile } from "@/lib/storage";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg"
]);

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg"
};

const ASSET_KINDS = new Set(["logos", "chops"]);
const PDF_EMBEDDABLE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

function companyAssetKey(companyId: string, kind: "logos" | "chops", extension: string) {
  return `uploads/company-${companyId}/${kind}/${kind.slice(0, -1)}-${randomUUID()}.${extension}`;
}

function assertManagedAssetKey(assetUrl?: string | null) {
  if (!assetUrl) return null;
  const key = assetUrl.split("?")[0]?.replace(/^\/+/, "") || "";
  const parts = key.split("/");

  if (key.startsWith("uploads/company-logos/") || key.startsWith("uploads/company-chops/")) {
    return key;
  }

  if (parts.length < 4 || parts[0] !== "uploads" || !parts[1]?.startsWith("company-") || !ASSET_KINDS.has(parts[2])) {
    return null;
  }

  return key;
}

function assertValidUpload(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Image must be a PNG, JPG, or JPEG file.");
  }

  if (file.size > MAX_LOGO_SIZE) {
    throw new Error("Image must be 2MB or smaller.");
  }
}

function assertValidImageBytes(type: string, bytes: Buffer) {
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  if (type === "image/png" && !isPng) throw new Error("PNG upload content does not match its file type.");
  if ((type === "image/jpeg" || type === "image/jpg") && !isJpeg) throw new Error("JPEG upload content does not match its file type.");
}

export function companyAssetPublicUrlToAbsolutePath(assetUrl?: string | null) {
  const key = assertManagedAssetKey(assetUrl);
  return key ? getLocalFilePath(key) : null;
}

export function logoPublicUrlToAbsolutePath(logoUrl?: string | null) {
  return companyAssetPublicUrlToAbsolutePath(logoUrl);
}

export function isPdfEmbeddableImage(assetUrl?: string | null) {
  const key = assertManagedAssetKey(assetUrl);
  if (!key) return false;
  return PDF_EMBEDDABLE_EXTENSIONS.has(path.extname(key).toLowerCase());
}

export function companyAssetStatus(assetUrl?: string | null) {
  const key = assertManagedAssetKey(assetUrl);
  const filePath = key ? getLocalFilePath(key) : null;
  const extension = key ? path.extname(key).toLowerCase() : "";

  return {
    key,
    extension,
    exists: Boolean(filePath && fsSync.existsSync(filePath)),
    pdfEmbeddable: Boolean(key && PDF_EMBEDDABLE_EXTENSIONS.has(extension))
  };
}

export async function deleteManagedAssetFile(assetUrl?: string | null) {
  const key = assertManagedAssetKey(assetUrl);
  if (key) await deleteFile(key);
}

async function saveCompanyAsset(companyId: string, file: File, kind: "logos" | "chops") {
  if (!file || file.size === 0) return null;

  assertValidUpload(file);

  const bytes = Buffer.from(await file.arrayBuffer());
  assertValidImageBytes(file.type, bytes);
  const extension = EXTENSION_BY_TYPE[file.type] || "png";
  const contentType = file.type;

  const stored = await saveFile({
    key: companyAssetKey(companyId, kind, extension),
    data: bytes,
    contentType,
    visibility: "public"
  });

  return stored.url;
}

export async function saveCompanyLogo(companyId: string, file: File) {
  return saveCompanyAsset(companyId, file, "logos");
}

export async function saveCompanyChop(companyId: string, file: File) {
  return saveCompanyAsset(companyId, file, "chops");
}

export async function deleteManagedLogoFile(logoUrl?: string | null) {
  await deleteManagedAssetFile(logoUrl);
}

export async function deleteManagedChopFile(chopUrl?: string | null) {
  await deleteManagedAssetFile(chopUrl);
}

export async function normalizeManagedLogoFile() {
  return false;
}
