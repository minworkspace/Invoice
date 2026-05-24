"use client";

import { useMemo, useState } from "react";

type FinalPdfPreviewFrameProps = {
  documentId?: string;
  documentType: "INVOICE" | "QUOTATION" | "RECEIPT";
  pdfUrl?: string | null;
  pdfNeedsRegeneration?: boolean;
  hasUnsavedChanges?: boolean;
};

function pdfPreviewRoute(documentType: FinalPdfPreviewFrameProps["documentType"], documentId: string) {
  return withViewerHints(`/api/documents/${documentType.toLowerCase()}/${documentId}/pdf?inline=1&v=${Date.now()}`);
}

function pdfDownloadRoute(documentType: FinalPdfPreviewFrameProps["documentType"], documentId: string) {
  return `/api/documents/${documentType.toLowerCase()}/${documentId}/pdf`;
}

function withViewerHints(url: string) {
  if (url.includes("#")) return url;
  return `${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;
}

export function FinalPdfPreviewFrame({
  documentId,
  documentType,
  pdfUrl,
  pdfNeedsRegeneration = false,
  hasUnsavedChanges = false
}: FinalPdfPreviewFrameProps) {
  const initialUrl = useMemo(() => (documentId && pdfUrl && !pdfNeedsRegeneration ? pdfPreviewRoute(documentType, documentId) : ""), [
    documentId,
    documentType,
    pdfNeedsRegeneration,
    pdfUrl
  ]);
  const [frameUrl, setFrameUrl] = useState(initialUrl);
  const [isOutdated, setIsOutdated] = useState(pdfNeedsRegeneration);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  async function generatePreview() {
    if (!documentId || hasUnsavedChanges) return;

    setIsGenerating(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("documentType", documentType);
      formData.set("documentId", documentId);

      const response = await fetch("/api/documents/generate-pdf?return=json", {
        method: "POST",
        body: formData
      });
      const data = (await response.json().catch(() => null)) as { previewUrl?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Could not generate PDF preview.");
      }

      setFrameUrl(data?.previewUrl ? withViewerHints(data.previewUrl) : pdfPreviewRoute(documentType, documentId));
      setIsOutdated(false);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not generate PDF preview.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!documentId || hasUnsavedChanges) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-paper p-6 text-center">
        <div className="max-w-sm rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-ink">Save changes to preview the final PDF.</p>
          <p className="mt-2 text-xs text-muted">The final preview shows the actual generated PDF, so it needs a saved document first.</p>
        </div>
      </div>
    );
  }

  if (isOutdated) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-paper p-6 text-center">
        <div className="max-w-sm rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-ink">PDF preview is outdated. Regenerate PDF to view the latest version.</p>
          <button className="btn btn-primary mt-4" type="button" onClick={generatePreview} disabled={isGenerating}>
            {isGenerating ? "Regenerating..." : "Regenerate PDF"}
          </button>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    );
  }

  if (!frameUrl) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-paper p-6 text-center">
        <div className="max-w-sm rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-ink">No PDF preview has been generated yet.</p>
          <button className="btn btn-primary mt-4" type="button" onClick={generatePreview} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Preview Final PDF"}
          </button>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[520px] bg-paper p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-white px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-ink">Final PDF preview</p>
          <p className="text-xs text-muted">Download uses this same generated PDF file.</p>
        </div>
        <a className="btn btn-secondary" href={pdfDownloadRoute(documentType, documentId)} download>
          Download PDF
        </a>
      </div>
      <iframe className="h-full min-h-[760px] w-full rounded-md border border-line bg-white" src={frameUrl} title="Final PDF preview" />
    </div>
  );
}
