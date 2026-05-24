import { classicTemplate } from "./classic-template";
import { cleanTemplate } from "./clean-template";

export const documentTemplateRegistry = {
  classic: classicTemplate,
  clean: cleanTemplate
} as const;

export type DocumentTemplateKey = keyof typeof documentTemplateRegistry;

const documentTemplateAliases = {
  modern: "clean",
  compact: "classic"
} as const satisfies Record<string, DocumentTemplateKey>;

export const documentTemplateOptions = Object.values(documentTemplateRegistry).map((template) => ({
  key: template.key as DocumentTemplateKey,
  name: template.name,
  description: template.description
}));

export function normalizeDocumentTemplateKey(
  value: FormDataEntryValue | string | null | undefined,
  fallback: DocumentTemplateKey = "classic"
): DocumentTemplateKey {
  const key = typeof value === "string" ? value : "";
  if (key in documentTemplateRegistry) return key as DocumentTemplateKey;

  return documentTemplateAliases[key as keyof typeof documentTemplateAliases] || fallback;
}

export function getDocumentTemplate(key: string | null | undefined) {
  return documentTemplateRegistry[normalizeDocumentTemplateKey(key)];
}
