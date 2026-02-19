"use client";

import { useTranslations } from "next-intl";
import type { OcrDocument } from "../types";

interface OcrDocumentViewerProps {
  document: OcrDocument | null;
  selectedFieldId: string;
  zoom: number;
  onSelectField: (fieldId: string) => void;
}

function fieldClass(
  isSelected: boolean,
  confidence: number,
  accepted: boolean,
): string {
  if (isSelected) {
    return "border-primary bg-blue-200/30";
  }
  if (!accepted && confidence < 0.85) {
    return "border-warning bg-amber-300/25";
  }
  return "border-success/70 bg-emerald-200/20";
}

function fieldTextClass(
  isSelected: boolean,
  confidence: number,
  accepted: boolean,
): string {
  if (isSelected) {
    return "text-primary";
  }
  if (!accepted && confidence < 0.85) {
    return "text-amber-900";
  }
  return "text-emerald-900";
}

export function OcrDocumentViewer({
  document,
  selectedFieldId,
  zoom,
  onSelectField,
}: OcrDocumentViewerProps) {
  const tOcr = useTranslations("ocrModule");

  if (!document) {
    return (
      <section className="surface-card flex min-h-[540px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">{tOcr("empty.document")}</p>
      </section>
    );
  }

  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-border bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-finance">{tOcr("viewer.title")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {document.sourceName} | {tOcr("viewer.zoom")}: {(zoom * 100).toFixed(0)}%
        </p>
      </header>

      <div className="overflow-auto p-4">
        <div
          className="mx-auto min-w-[620px] rounded-lg border border-border bg-white p-4 shadow-sm"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
          }}
        >
          <div className="mb-3 flex items-center justify-between border-b border-dashed border-border pb-2">
            <p className="text-sm font-semibold text-finance">E-Ticket Itinerary</p>
            <p className="text-xs text-muted-foreground">{document.transactionId}</p>
          </div>

          <div className="relative aspect-[1/1.26] w-full rounded-md border border-border bg-gradient-to-b from-slate-50 to-white">
            <div className="absolute left-0 right-0 top-0 h-8 border-b border-dashed border-border bg-slate-100/70" />
            <div className="absolute left-3 right-3 top-12 h-0.5 bg-slate-200" />
            <div className="absolute left-3 right-3 top-30 h-0.5 bg-slate-200" />
            <div className="absolute left-3 right-3 top-46 h-0.5 bg-slate-200" />
            <div className="absolute left-3 right-3 top-62 h-0.5 bg-slate-200" />

            {document.fields.map((field) => {
              const isSelected = field.id === selectedFieldId;
              const textClass = fieldTextClass(
                isSelected,
                field.confidence,
                field.accepted,
              );
              return (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => onSelectField(field.id)}
                  className={`absolute rounded-sm border-2 transition ${fieldClass(
                    isSelected,
                    field.confidence,
                    field.accepted,
                  )}`}
                  style={{
                    left: `${field.bbox.x}%`,
                    top: `${field.bbox.y}%`,
                    width: `${field.bbox.width}%`,
                    height: `${field.bbox.height}%`,
                  }}
                  title={`${field.label}: ${field.value}`}
                  aria-label={`${field.label}: ${field.value}`}
                >
                  <span
                    className={`pointer-events-none absolute inset-0 overflow-hidden px-1.5 py-1 text-start text-[10px] leading-3 ${textClass}`}
                  >
                    <span className="block truncate font-semibold">{field.label}</span>
                    <span className="mt-0.5 block truncate opacity-80">{field.value}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
