"use client";

import { useEffect, useState } from "react";
import {
  chopHelperText,
  imageAcceptedFormatsText,
  logoAcceptValue,
  logoHelperText,
  pdfCompatibilityText
} from "@/lib/logo-shared";

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

const PDF_SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);
const CONVERTIBLE_IMAGE_TYPES = new Set(["image/webp", "image/svg+xml"]);

async function loadImageFromUrl(url: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load image for PDF conversion."));
  });

  return image;
}

async function convertToPngFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromUrl(objectUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      throw new Error("Image dimensions could not be detected.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Browser image conversion is unavailable.");
    }

    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

    if (!blob) {
      throw new Error("Could not convert image to PNG.");
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function CompanyImageField({ companyName, existingImageUrl, kind }: CompanyImageFieldProps) {
  const [previewUrl, setPreviewUrl] = useState(existingImageUrl || "");
  const [conversionMessage, setConversionMessage] = useState("");
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
            onChange={async (event) => {
              const input = event.currentTarget;
              const nextFile = input.files?.[0];
              setConversionMessage("");

              if (!nextFile) {
                setPreviewUrl(existingImageUrl || "");
                return;
              }

              if (PDF_SAFE_IMAGE_TYPES.has(nextFile.type)) {
                const objectUrl = URL.createObjectURL(nextFile);
                setPreviewUrl(objectUrl);
                return;
              }

              if (!CONVERTIBLE_IMAGE_TYPES.has(nextFile.type)) {
                input.value = "";
                setPreviewUrl(existingImageUrl || "");
                setConversionMessage("Please upload a PNG, JPG, JPEG, WebP, or SVG image.");
                return;
              }

              try {
                const convertedFile = await convertToPngFile(nextFile);
                const files = new DataTransfer();
                files.items.add(convertedFile);
                input.files = files.files;
                setPreviewUrl(URL.createObjectURL(convertedFile));
                setConversionMessage("Converted to PNG for reliable PDF embedding.");
              } catch {
                input.value = "";
                setPreviewUrl(existingImageUrl || "");
                setConversionMessage("Could not convert this image for PDF. Please upload a PNG or JPG file.");
              }
            }}
          />
          <p className="mt-2 text-xs text-muted">{copy.helperText()}</p>
          <p className="mt-1 text-xs text-muted">{imageAcceptedFormatsText()}</p>
          <p className="mt-1 text-xs text-muted">{pdfCompatibilityText()}</p>
          {conversionMessage ? <p className="mt-2 text-xs font-semibold text-brand">{conversionMessage}</p> : null}
          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            <input name={copy.removeName} type="checkbox" value="1" />
            Remove current {kind}
          </label>
        </div>
      </div>
    </div>
  );
}
