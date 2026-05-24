"use client";

import { useEffect, useState } from "react";
import { chopHelperText, logoAcceptValue, logoHelperText } from "@/lib/logo-shared";

type CompanyImageFieldProps = {
  companyName: string;
  existingImageUrl?: string | null;
  kind: "logo" | "chop";
};

const KIND_COPY = {
  logo: {
    title: "Company logo",
    inputName: "logo",
    removeName: "removeLogo",
    emptyLabel: (companyName: string) => companyName,
    helperText: logoHelperText
  },
  chop: {
    title: "Company chop / stamp",
    inputName: "chop",
    removeName: "removeChop",
    emptyLabel: () => "Optional chop",
    helperText: chopHelperText
  }
} as const;

export function CompanyImageField({ companyName, existingImageUrl, kind }: CompanyImageFieldProps) {
  const [previewUrl, setPreviewUrl] = useState(existingImageUrl || "");
  const copy = KIND_COPY[kind];

  useEffect(() => {
    setPreviewUrl(existingImageUrl || "");
  }, [existingImageUrl]);

  return (
    <div className="rounded-md border border-line bg-paper p-4">
      <p className="label">{copy.title}</p>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex h-20 w-60 items-center justify-center rounded-md border border-line bg-white p-3">
          {previewUrl ? (
            <img alt={`${companyName} ${kind} preview`} className="h-full w-full object-contain" src={previewUrl} />
          ) : (
            <span className="text-center text-sm font-semibold text-muted">{copy.emptyLabel(companyName)}</span>
          )}
        </div>
        <div className="flex-1">
          <input
            accept={logoAcceptValue()}
            className="field"
            name={copy.inputName}
            type="file"
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              if (!nextFile) {
                setPreviewUrl(existingImageUrl || "");
                return;
              }

              const objectUrl = URL.createObjectURL(nextFile);
              setPreviewUrl(objectUrl);
            }}
          />
          <p className="mt-2 text-xs text-muted">{copy.helperText()}</p>
          <p className="mt-1 text-xs text-muted">Accepted formats: PNG, JPG, JPEG, WebP, SVG. Max file size: 2MB.</p>
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            <input name={copy.removeName} type="checkbox" value="1" />
            Remove current {kind}
          </label>
        </div>
      </div>
    </div>
  );
}
