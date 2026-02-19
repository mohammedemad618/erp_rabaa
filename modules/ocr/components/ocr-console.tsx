"use client";

import { Loader2, Search, Upload, ZoomIn } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { extractOcrDocument } from "@/services/ocr-api";
import { formatDate } from "@/utils/format";
import type { OcrDataset, OcrDocument, OcrField } from "../types";
import { OcrDocumentViewer } from "./ocr-document-viewer";

const LOW_CONFIDENCE_THRESHOLD = 0.85;

interface OcrConsoleProps {
  dataset: OcrDataset;
}

type OcrSection = "workspace" | "queue" | "quality";

function confidenceClass(confidence: number, accepted: boolean): string {
  if (accepted) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (confidence < 0.75) {
    return "bg-rose-100 text-rose-700";
  }
  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function unresolvedFields(document: OcrDocument | null): OcrField[] {
  if (!document) {
    return [];
  }
  return document.fields.filter(
    (field) => field.confidence < LOW_CONFIDENCE_THRESHOLD && !field.accepted,
  );
}

function getInitialField(document: OcrDocument | null): string {
  if (!document) {
    return "";
  }
  const unresolved = unresolvedFields(document);
  return unresolved[0]?.id ?? document.fields[0]?.id ?? "";
}

export function OcrConsole({ dataset }: OcrConsoleProps) {
  const tOcr = useTranslations("ocrModule");
  const locale = useLocale();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [documents, setDocuments] = useState<OcrDocument[]>(dataset.documents);
  const [activeSection, setActiveSection] = useState<OcrSection>("workspace");
  const [search, setSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState(dataset.documents[0]?.id ?? "");
  const [selectedFieldId, setSelectedFieldId] = useState(
    getInitialField(dataset.documents[0] ?? null),
  );
  const [zoom, setZoom] = useState(1);
  const [notice, setNotice] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const filteredDocuments = useMemo(() => {
    const query = normalize(search);
    return documents.filter((document) => {
      if (!query) {
        return true;
      }
      return (
        document.sourceName.toLowerCase().includes(query) ||
        document.transactionId.toLowerCase().includes(query) ||
        document.branch.toLowerCase().includes(query)
      );
    });
  }, [documents, search]);

  const sectionDocuments = useMemo(() => {
    if (activeSection === "queue") {
      return filteredDocuments.filter(
        (document) => unresolvedFields(document).length > 0,
      );
    }
    if (activeSection === "quality") {
      return [...filteredDocuments].sort(
        (left, right) => left.averageConfidence - right.averageConfidence,
      );
    }
    return filteredDocuments;
  }, [activeSection, filteredDocuments]);

  const selectedDocument =
    sectionDocuments.find((document) => document.id === selectedDocId) ??
    sectionDocuments[0] ??
    null;

  const availableFieldIds = useMemo(
    () => new Set(selectedDocument?.fields.map((field) => field.id) ?? []),
    [selectedDocument],
  );

  const activeFieldId = availableFieldIds.has(selectedFieldId)
    ? selectedFieldId
    : getInitialField(selectedDocument);

  const selectedField =
    selectedDocument?.fields.find((field) => field.id === activeFieldId) ?? null;

  useEffect(() => {
    return () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  const unresolved = unresolvedFields(selectedDocument);
  function notify(message: string): void {
    setNotice(message);
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(""), 2200);
  }

  function handleDocumentSelect(docId: string): void {
    const next = sectionDocuments.find((document) => document.id === docId) ?? null;
    setSelectedDocId(docId);
    setSelectedFieldId(getInitialField(next));
  }

  function handleFieldSelect(fieldId: string): void {
    setSelectedFieldId(fieldId);
  }

  function updateField(fieldId: string, updater: (field: OcrField) => OcrField): void {
    setDocuments((previous) =>
      previous.map((document) => {
        if (document.id !== (selectedDocument?.id ?? "")) {
          return document;
        }
        return {
          ...document,
          fields: document.fields.map((field) =>
            field.id === fieldId ? updater(field) : field,
          ),
        };
      }),
    );
  }

  function acceptField(fieldId: string): void {
    const field =
      selectedDocument?.fields.find((candidate) => candidate.id === fieldId) ?? null;
    if (!field || field.accepted) {
      return;
    }
    updateField(field.id, (current) => ({ ...current, accepted: true }));
  }

  function acceptSelectedField(): void {
    if (!selectedField) {
      return;
    }
    if (selectedField.accepted) {
      notify(tOcr("messages.alreadyAccepted"));
      return;
    }
    acceptField(selectedField.id);
    notify(tOcr("messages.fieldAccepted"));
  }

  function focusNextLowConfidence(): void {
    if (!selectedDocument) {
      return;
    }
    const lowConfidence = unresolvedFields(selectedDocument);
    if (!lowConfidence.length) {
      notify(tOcr("messages.noLowConfidence"));
      return;
    }
    const currentIndex = lowConfidence.findIndex((field) => field.id === activeFieldId);
    const next =
      currentIndex < 0
        ? lowConfidence[0]
        : lowConfidence[(currentIndex + 1) % lowConfidence.length];
    setSelectedFieldId(next.id);
    notify(tOcr("messages.focusedNext"));
  }

  function toggleZoom(): void {
    setZoom((previous) => {
      if (previous === 1) {
        notify(tOcr("messages.zoom140"));
        return 1.4;
      }
      if (previous === 1.4) {
        notify(tOcr("messages.zoom180"));
        return 1.8;
      }
      notify(tOcr("messages.zoom100"));
      return 1;
    });
  }

  async function handleUploadFiles(files: FileList | null): Promise<void> {
    if (!files?.length || isUploading) {
      return;
    }

    const fileList = Array.from(files);
    setIsUploading(true);

    const uploaded: OcrDocument[] = [];
    let failed = 0;
    let firstError = "";

    for (const file of fileList) {
      try {
        const document = await extractOcrDocument({ file });
        uploaded.push(document);
      } catch (error) {
        failed += 1;
        if (!firstError) {
          firstError = error instanceof Error ? error.message : tOcr("messages.uploadFailed");
        }
      }
    }

    if (uploaded.length) {
      setDocuments((previous) => [...uploaded, ...previous]);
      setActiveSection("workspace");
      setSelectedDocId(uploaded[0].id);
      setSelectedFieldId(getInitialField(uploaded[0]));
    }

    if (uploaded.length && failed === 0) {
      notify(
        tOcr("messages.uploadSuccess", {
          count: uploaded.length.toString(),
        }),
      );
    } else if (uploaded.length && failed > 0) {
      notify(
        tOcr("messages.uploadPartial", {
          success: uploaded.length.toString(),
          failed: failed.toString(),
        }),
      );
    } else {
      notify(firstError || tOcr("messages.uploadFailed"));
    }

    setIsUploading(false);
  }

  useHotkeys([
    {
      key: "n",
      alt: true,
      handler: () => focusNextLowConfidence(),
    },
    {
      key: "a",
      alt: true,
      handler: () => acceptSelectedField(),
    },
    {
      key: "d",
      alt: true,
      handler: () => toggleZoom(),
    },
  ]);

  const docsWithLowConfidence = filteredDocuments.filter(
    (document) => unresolvedFields(document).length > 0,
  ).length;
  const criticalDocuments = filteredDocuments.filter(
    (document) => unresolvedFields(document).length >= 3,
  ).length;
  const datasetAverageConfidence = round(
    (filteredDocuments.reduce((sum, document) => sum + document.averageConfidence, 0) /
      Math.max(1, filteredDocuments.length)) *
      100,
  );
  const sectionSummary = [
    {
      id: "workspace" as const,
      label: tOcr("sections.workspace"),
      description: tOcr("sections.workspaceDescription"),
      value: filteredDocuments.length,
    },
    {
      id: "queue" as const,
      label: tOcr("sections.queue"),
      description: tOcr("sections.queueDescription"),
      value: docsWithLowConfidence,
    },
    {
      id: "quality" as const,
      label: tOcr("sections.quality"),
      description: tOcr("sections.qualityDescription"),
      value: criticalDocuments,
    },
  ];
  const branchQuality = useMemo(() => {
    const buckets = new Map<
      string,
      {
        documentsCount: number;
        unresolvedCount: number;
        confidenceSum: number;
      }
    >();

    for (const document of filteredDocuments) {
      const current = buckets.get(document.branch) ?? {
        documentsCount: 0,
        unresolvedCount: 0,
        confidenceSum: 0,
      };
      current.documentsCount += 1;
      current.unresolvedCount += unresolvedFields(document).length;
      current.confidenceSum += document.averageConfidence;
      buckets.set(document.branch, current);
    }

    return Array.from(buckets.entries())
      .map(([branch, entry]) => ({
        branch,
        documentsCount: entry.documentsCount,
        unresolvedCount: entry.unresolvedCount,
        averageConfidence: round(
          (entry.confidenceSum / Math.max(1, entry.documentsCount)) * 100,
        ),
      }))
      .sort(
        (left, right) =>
          right.unresolvedCount - left.unresolvedCount ||
          left.averageConfidence - right.averageConfidence,
      );
  }, [filteredDocuments]);

  return (
    <section className="space-y-4">
      <header className="surface-card p-6">
        <h2 className="text-2xl font-bold text-finance">{tOcr("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tOcr("subtitle")}</p>

        <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-slate-50 px-3 py-2">
          <p className="text-xs text-muted-foreground">{tOcr("upload.help")}</p>

          <input
            ref={uploadInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
            multiple
            className="hidden"
            onChange={(event) => {
              void handleUploadFiles(event.target.files);
              event.target.value = "";
            }}
          />

          <Button
            size="sm"
            variant="secondary"
            disabled={isUploading}
            onClick={() => uploadInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="me-1 h-3.5 w-3.5" />
            )}
            {isUploading ? tOcr("upload.processing") : tOcr("upload.button")}
          </Button>
        </div>

        <div className="no-print mt-4 grid gap-3 md:grid-cols-[1.2fr_0.9fr_1.2fr_0.8fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tOcr("filters.searchPlaceholder")}
              className="h-9 w-full rounded-md border border-border bg-white ps-8 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <select
            value={activeSection}
            onChange={(event) => setActiveSection(event.target.value as OcrSection)}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            {sectionSummary.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label} ({section.value})
              </option>
            ))}
          </select>

          <select
            value={selectedDocument?.id ?? ""}
            onChange={(event) => handleDocumentSelect(event.target.value)}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            {sectionDocuments.length ? (
              sectionDocuments.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.id} - {document.sourceName}
                </option>
              ))
            ) : (
              <option value="">{tOcr("empty.document")}</option>
            )}
          </select>

          <div className="rounded-md border border-border bg-slate-50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{tOcr("top.overallConfidence")}</p>
            <p className="mt-1 text-sm font-semibold text-finance">
              {datasetAverageConfidence}%
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <article className="rounded-md border border-border bg-slate-50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{tOcr("top.documents")}</p>
            <p className="mt-1 text-sm font-semibold text-finance">
              {sectionDocuments.length}
            </p>
          </article>
          <article className="rounded-md border border-border bg-slate-50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{tOcr("top.lowConfidenceDocs")}</p>
            <p className="mt-1 text-sm font-semibold text-finance">
              {docsWithLowConfidence}
            </p>
          </article>
          <article className="rounded-md border border-border bg-slate-50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{tOcr("top.unresolvedFields")}</p>
            <p className="mt-1 text-sm font-semibold text-finance">{unresolved.length}</p>
          </article>
          <article className="rounded-md border border-border bg-slate-50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{tOcr("top.criticalDocs")}</p>
            <p className="mt-1 text-sm font-semibold text-finance">{criticalDocuments}</p>
          </article>
        </div>

        {notice ? (
          <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-finance">
            {notice}
          </p>
        ) : null}

        {!sectionDocuments.length ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {tOcr("empty.section")}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <OcrDocumentViewer
          document={selectedDocument}
          selectedFieldId={activeFieldId}
          zoom={zoom}
          onSelectField={handleFieldSelect}
        />

        <section className="surface-card overflow-hidden">
          <header className="flex items-center justify-between border-b border-border bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-finance">{tOcr("fields.title")}</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={acceptSelectedField}
                disabled={!selectedField || selectedField.accepted}
              >
                {tOcr("fields.accepted")}
              </Button>
              <Button size="sm" variant="secondary" onClick={toggleZoom}>
                <ZoomIn className="me-1 h-3.5 w-3.5" />
                {tOcr("fields.zoom")}
              </Button>
            </div>
          </header>

          <div className="max-h-[640px] space-y-2 overflow-auto p-3">
            {(selectedDocument?.fields ?? []).map((field) => {
              const active = field.id === activeFieldId;
              return (
                <article
                  key={field.id}
                  className={`rounded-md border p-2 transition ${
                    active
                      ? "border-primary bg-blue-50"
                      : "border-border bg-white hover:bg-slate-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleFieldSelect(field.id)}
                    className="w-full text-start"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-finance">{field.label}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${confidenceClass(
                          field.confidence,
                          field.accepted,
                        )}`}
                      >
                        {(field.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </button>

                  <input
                    value={field.value}
                    onChange={(event) =>
                      updateField(field.id, (current) => ({
                        ...current,
                        value: event.target.value,
                        accepted: false,
                      }))
                    }
                    onFocus={() => handleFieldSelect(field.id)}
                    className="mt-2 h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground"
                  />

                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{field.key}</span>
                    <div className="flex items-center gap-2">
                      <span>
                        {field.accepted ? tOcr("fields.accepted") : tOcr("fields.pending")}
                      </span>
                      {!field.accepted ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            handleFieldSelect(field.id);
                            acceptField(field.id);
                          }}
                        >
                          {tOcr("fields.accepted")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
            {!selectedDocument?.fields.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {tOcr("empty.fields")}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {selectedDocument ? (
        <section className="surface-card p-4">
          <p className="text-xs text-muted-foreground">
            {tOcr("meta.branch")}: {selectedDocument.branch} | {tOcr("meta.createdAt")}:{" "}
            {formatDate(selectedDocument.createdAt, locale)}
          </p>
        </section>
      ) : null}

      {activeSection === "quality" ? (
        <section className="surface-card p-4">
          <h3 className="text-sm font-semibold text-finance">{tOcr("quality.title")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {tOcr("quality.subtitle")}
          </p>

          {branchQuality.length ? (
            <div className="mt-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start">{tOcr("quality.branch")}</th>
                    <th className="px-3 py-2 text-start">{tOcr("quality.documents")}</th>
                    <th className="px-3 py-2 text-start">{tOcr("quality.unresolved")}</th>
                    <th className="px-3 py-2 text-start">{tOcr("quality.confidence")}</th>
                  </tr>
                </thead>
                <tbody>
                  {branchQuality.map((item) => (
                    <tr key={item.branch} className="border-t border-border">
                      <td className="px-3 py-2">{item.branch}</td>
                      <td className="px-3 py-2">{item.documentsCount}</td>
                      <td className="px-3 py-2">{item.unresolvedCount}</td>
                      <td className="px-3 py-2">{item.averageConfidence}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{tOcr("quality.empty")}</p>
          )}
        </section>
      ) : null}
    </section>
  );
}
