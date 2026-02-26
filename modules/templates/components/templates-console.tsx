"use client";

import {
  FileText,
  ImagePlus,
  Palette,
  Printer,
  RefreshCcw,
  Rocket,
  Save,
  Smartphone,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { ErpPageHeader, ErpPageLayout } from "@/components/layout/erp-page-layout";
import { Button } from "@/components/ui/button";
import {
  activateTemplateVersionApi,
  createTemplateVersionApi,
  fetchTemplatesApi,
  fetchTemplateVersionsApi,
  updateTemplateApi,
} from "@/services/template-engine-api";
import { cn } from "@/utils/cn";
import { formatCurrency, formatDate } from "@/utils/format";
import type {
  PreviewMode,
  TemplateDataset,
  TemplateDefinitionRecord,
  TemplateVersionPayload,
  TemplateVersionRecord,
  TemplateVersionState,
} from "../types";

interface TemplatesConsoleProps {
  dataset: TemplateDataset;
}

interface SessionApiResponse {
  authenticated: boolean;
  permissions?: string[];
}

interface NoticeState {
  tone: "success" | "error";
  message: string;
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export function TemplatesConsole({ dataset }: TemplatesConsoleProps) {
  const tTemplates = useTranslations("templatesModule");
  const locale = useLocale();
  const isAr = locale === "ar";
  const snapshot = dataset.snapshot;

  const [templateCatalog, setTemplateCatalog] = useState<TemplateDefinitionRecord[]>([]);
  const [templateVersions, setTemplateVersions] = useState<TemplateVersionRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const [canManageTemplates, setCanManageTemplates] = useState(false);
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(true);
  const [isVersionsLoading, setIsVersionsLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const [templateName, setTemplateName] = useState(snapshot.defaultName);
  const [headerText, setHeaderText] = useState(snapshot.defaultHeader);
  const [footerText, setFooterText] = useState(snapshot.defaultFooter);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("a4");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#0f4c81");
  const [accentColor, setAccentColor] = useState("#0f9d7a");
  const [paperTint, setPaperTint] = useState("#ffffff");
  const [cornerRadius, setCornerRadius] = useState(14);

  const selectedTemplate = useMemo(
    () =>
      selectedTemplateId
        ? (templateCatalog.find((item) => item.templateId === selectedTemplateId) ?? null)
        : null,
    [selectedTemplateId, templateCatalog],
  );

  const selectedVersion = useMemo(
    () =>
      selectedVersionId
        ? (templateVersions.find((item) => item.versionId === selectedVersionId) ?? null)
        : null,
    [selectedVersionId, templateVersions],
  );

  const versionState: TemplateVersionState = selectedVersion?.status === "active" ? "active" : "draft";
  const activeTemplateId = selectedTemplate?.templateId ?? snapshot.templateId;
  const generatedAt = selectedVersion?.createdAt ?? snapshot.generatedAt;

  const previewStyle = {
    "--template-primary": primaryColor,
    "--template-accent": accentColor,
    "--template-paper": paperTint,
    "--template-radius": `${cornerRadius}px`,
  } as CSSProperties;

  const buildPayloadFromBuilder = useCallback((): TemplateVersionPayload => {
    return {
      tokens: {
        primaryColor,
        accentColor,
        paperTint,
        cornerRadius,
        logoUrl: logoDataUrl,
      },
      content: {
        headerText,
        footerText,
      },
      layout: {
        previewMode,
      },
    };
  }, [
    accentColor,
    cornerRadius,
    footerText,
    headerText,
    logoDataUrl,
    paperTint,
    previewMode,
    primaryColor,
  ]);

  const applyVersionToBuilder = useCallback(
    (template: TemplateDefinitionRecord, version: TemplateVersionRecord): void => {
      setTemplateName(template.name);
      setHeaderText(version.payload.content.headerText);
      setFooterText(version.payload.content.footerText);
      setPreviewMode(version.payload.layout.previewMode);
      setPrimaryColor(version.payload.tokens.primaryColor);
      setAccentColor(version.payload.tokens.accentColor);
      setPaperTint(version.payload.tokens.paperTint);
      setCornerRadius(version.payload.tokens.cornerRadius);
      setLogoDataUrl(version.payload.tokens.logoUrl ?? null);
    },
    [],
  );

  const loadVersionsForTemplate = useCallback(
    async (template: TemplateDefinitionRecord, preferredVersionId?: string): Promise<void> => {
      setIsVersionsLoading(true);
      try {
        const versions = await fetchTemplateVersionsApi(template.templateId);
        setTemplateVersions(versions);

        if (versions.length === 0) {
          setSelectedVersionId(null);
          setTemplateName(template.name);
          return;
        }

        const initialVersion =
          (preferredVersionId
            ? versions.find((item) => item.versionId === preferredVersionId)
            : null) ??
          (template.activeVersionId
            ? versions.find((item) => item.versionId === template.activeVersionId)
            : null) ??
          versions[0];

        setSelectedVersionId(initialVersion.versionId);
        applyVersionToBuilder(template, initialVersion);
      } catch (error) {
        setTemplateVersions([]);
        setSelectedVersionId(null);
        setNotice({
          tone: "error",
          message: resolveErrorMessage(
            error,
            isAr ? "تعذر تحميل إصدارات القالب." : "Unable to load template versions.",
          ),
        });
      } finally {
        setIsVersionsLoading(false);
      }
    },
    [applyVersionToBuilder, isAr],
  );

  useEffect(() => {
    let active = true;

    async function bootstrap(): Promise<void> {
      setIsBootstrapLoading(true);
      try {
        const [sessionRes, templates] = await Promise.all([
          fetch("/api/auth/session", { method: "GET", cache: "no-store" }),
          fetchTemplatesApi(),
        ]);

        if (!active) {
          return;
        }

        const sessionPayload = (await sessionRes.json()) as SessionApiResponse;
        const hasManagePermission =
          sessionPayload.authenticated &&
          Array.isArray(sessionPayload.permissions) &&
          sessionPayload.permissions.includes("templates.manage");

        setCanManageTemplates(Boolean(hasManagePermission));
        setTemplateCatalog(templates);

        const preferredTemplate =
          templates.find((item) => item.scope === "travel" && !item.archivedAt) ??
          templates.find((item) => !item.archivedAt) ??
          templates[0] ??
          null;

        if (!preferredTemplate) {
          setNotice({
            tone: "error",
            message: isAr ? "لا يوجد قالب متاح حالياً." : "No template is available right now.",
          });
          return;
        }

        setSelectedTemplateId(preferredTemplate.templateId);
      } catch (error) {
        if (!active) {
          return;
        }
        setNotice({
          tone: "error",
          message: resolveErrorMessage(
            error,
            isAr ? "تعذر تحميل بيانات القوالب." : "Unable to load template data.",
          ),
        });
      } finally {
        if (active) {
          setIsBootstrapLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [isAr]);

  useEffect(() => {
    if (!selectedTemplateId) {
      return;
    }
    const template = templateCatalog.find((item) => item.templateId === selectedTemplateId);
    if (!template) {
      return;
    }
    void loadVersionsForTemplate(template);
  }, [loadVersionsForTemplate, selectedTemplateId, templateCatalog]);

  function handleTemplateSelection(templateId: string): void {
    setNotice(null);
    setSelectedTemplateId(templateId);
  }

  function handleVersionSelection(versionId: string): void {
    setNotice(null);
    setSelectedVersionId(versionId);
    if (!selectedTemplate) {
      return;
    }
    const version = templateVersions.find((item) => item.versionId === versionId);
    if (version) {
      applyVersionToBuilder(selectedTemplate, version);
    }
  }

  function handleLogoUpload(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoDataUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setLogoDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handlePrint(): void {
    window.print();
  }

  async function handleRefresh(): Promise<void> {
    if (!selectedTemplate) {
      return;
    }
    setNotice(null);
    await loadVersionsForTemplate(selectedTemplate, selectedVersionId ?? undefined);
  }

  async function handleSaveDraft(): Promise<void> {
    if (!canManageTemplates) {
      setNotice({
        tone: "error",
        message: isAr ? "لا تملك صلاحية إدارة القوالب." : "You do not have permission to manage templates.",
      });
      return;
    }
    if (!selectedTemplate) {
      setNotice({
        tone: "error",
        message: isAr ? "اختر قالباً أولاً." : "Please select a template first.",
      });
      return;
    }

    const nextName = templateName.trim();
    if (!nextName) {
      setNotice({
        tone: "error",
        message: isAr ? "اسم القالب مطلوب." : "Template name is required.",
      });
      return;
    }

    setIsSavingDraft(true);
    setNotice(null);
    try {
      let effectiveTemplate = selectedTemplate;
      if (nextName !== selectedTemplate.name) {
        const updatedTemplate = await updateTemplateApi({
          templateId: selectedTemplate.templateId,
          name: nextName,
          note: isAr ? "تحديث اسم القالب من الشاشة." : "Template name updated from templates console.",
        });
        effectiveTemplate = updatedTemplate;
        setTemplateCatalog((prev) =>
          prev.map((item) => (item.templateId === updatedTemplate.templateId ? updatedTemplate : item)),
        );
      }

      const titleSuffix = new Date().toISOString().replace("T", " ").slice(0, 16);
      const createdVersion = await createTemplateVersionApi({
        templateId: effectiveTemplate.templateId,
        title: `${nextName} - ${titleSuffix}`,
        payload: buildPayloadFromBuilder(),
        note: isAr ? "حفظ نسخة مسودة من الشاشة." : "Draft saved from templates console.",
      });

      setTemplateVersions((prev) => [createdVersion, ...prev]);
      setSelectedVersionId(createdVersion.versionId);
      setNotice({
        tone: "success",
        message: isAr ? "تم حفظ المسودة بنجاح." : "Draft version saved successfully.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: resolveErrorMessage(
          error,
          isAr ? "تعذر حفظ المسودة." : "Unable to save draft version.",
        ),
      });
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleActivateVersion(): Promise<void> {
    if (!canManageTemplates) {
      setNotice({
        tone: "error",
        message: isAr ? "لا تملك صلاحية تفعيل الإصدارات." : "You do not have permission to activate versions.",
      });
      return;
    }
    if (!selectedTemplate || !selectedVersionId) {
      setNotice({
        tone: "error",
        message: isAr ? "اختر إصداراً قبل التفعيل." : "Select a version before activation.",
      });
      return;
    }

    setIsPublishing(true);
    setNotice(null);
    try {
      const result = await activateTemplateVersionApi({
        templateId: selectedTemplate.templateId,
        versionId: selectedVersionId,
        note: isAr ? "تفعيل الإصدار من الشاشة." : "Version activated from templates console.",
      });

      setTemplateCatalog((prev) =>
        prev.map((item) => (item.templateId === result.template.templateId ? result.template : item)),
      );

      await loadVersionsForTemplate(result.template, result.version.versionId);
      setNotice({
        tone: "success",
        message: isAr ? "تم تفعيل الإصدار الحالي." : "Selected version has been activated.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: resolveErrorMessage(
          error,
          isAr ? "تعذر تفعيل الإصدار." : "Unable to activate version.",
        ),
      });
    } finally {
      setIsPublishing(false);
    }
  }

  const totalAmount = snapshot.totalAmount;

  return (
    <ErpPageLayout>
      <ErpPageHeader title={tTemplates("title")} description={tTemplates("subtitle")} />

      <div className="col-span-12 grid gap-4 xl:grid-cols-[360px_1fr]">
        <aside className="template-builder-panel surface-card no-print p-4">
          <h3 className="text-sm font-semibold text-finance">{tTemplates("builder.title")}</h3>

          <div className="mt-3 space-y-3">
            <label className="block text-xs text-muted-foreground">
              {isAr ? "القوالب المتاحة" : "Available Templates"}
              <select
                value={selectedTemplateId ?? ""}
                onChange={(event) => handleTemplateSelection(event.target.value)}
                disabled={isBootstrapLoading || templateCatalog.length === 0}
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              >
                {templateCatalog.map((template) => (
                  <option key={template.templateId} value={template.templateId}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-muted-foreground">
              {isAr ? "الإصدار الحالي" : "Current Version"}
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={selectedVersionId ?? ""}
                  onChange={(event) => handleVersionSelection(event.target.value)}
                  disabled={isVersionsLoading || templateVersions.length === 0}
                  className="h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                >
                  {templateVersions.map((version) => (
                    <option key={version.versionId} value={version.versionId}>
                      {version.title}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleRefresh}
                  disabled={!selectedTemplate || isVersionsLoading}
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </label>

            <label className="block text-xs text-muted-foreground">
              {tTemplates("builder.templateName")}
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <div>
              <p className="text-xs text-muted-foreground">{tTemplates("builder.version")}</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Button size="sm" variant={versionState === "draft" ? "primary" : "secondary"} disabled>
                  {tTemplates("builder.draft")}
                </Button>
                <Button size="sm" variant={versionState === "active" ? "primary" : "secondary"} disabled>
                  {tTemplates("builder.active")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={isSavingDraft}
                disabled={isBootstrapLoading || isVersionsLoading || !selectedTemplate || !canManageTemplates}
                onClick={handleSaveDraft}
              >
                <Save className="me-1 h-3.5 w-3.5" />
                {isAr ? "حفظ مسودة" : "Save Draft"}
              </Button>
              <Button
                size="sm"
                loading={isPublishing}
                disabled={
                  isBootstrapLoading ||
                  isVersionsLoading ||
                  !selectedTemplate ||
                  !selectedVersionId ||
                  !canManageTemplates
                }
                onClick={handleActivateVersion}
              >
                <Rocket className="me-1 h-3.5 w-3.5" />
                {isAr ? "اعتماد نشط" : "Publish Active"}
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {canManageTemplates
                ? isAr
                  ? "يمكنك حفظ المسودات وتفعيل الإصدار مباشرة."
                  : "You can save draft versions and activate them directly."
                : isAr
                  ? "وضع عرض فقط: لا تملك صلاحية إدارة القوالب."
                  : "View-only mode: you do not have template management permission."}
            </p>

            {notice ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  notice.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700",
                )}
              >
                {notice.message}
              </div>
            ) : null}

            <label className="block text-xs text-muted-foreground">
              {tTemplates("builder.logo")}
              <div className="mt-1 rounded-md border border-dashed border-border bg-slate-50 p-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="block w-full text-xs text-foreground"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {tTemplates("builder.logoHint")}
                </p>
                {logoDataUrl ? (
                  <Image
                    src={logoDataUrl}
                    alt={tTemplates("builder.logo")}
                    width={220}
                    height={72}
                    unoptimized
                    className="mt-2 h-10 w-auto rounded border border-border bg-white p-1"
                  />
                ) : (
                  <div className="mt-2 inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-[11px] text-muted-foreground">
                    <ImagePlus className="h-3.5 w-3.5" />
                    {tTemplates("builder.noLogo")}
                  </div>
                )}
              </div>
            </label>

            <label className="block text-xs text-muted-foreground">
              {tTemplates("builder.header")}
              <textarea
                value={headerText}
                onChange={(event) => setHeaderText(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="block text-xs text-muted-foreground">
              {tTemplates("builder.footer")}
              <textarea
                value={footerText}
                onChange={(event) => setFooterText(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <div className="rounded-md border border-border bg-slate-50 p-3">
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Palette className="h-3.5 w-3.5" />
                {tTemplates("builder.theme")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-muted-foreground">
                  {tTemplates("builder.primary")}
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                    className="mt-1 block h-9 w-full rounded border border-border bg-white"
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  {tTemplates("builder.accent")}
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(event) => setAccentColor(event.target.value)}
                    className="mt-1 block h-9 w-full rounded border border-border bg-white"
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  {tTemplates("builder.paper")}
                  <input
                    type="color"
                    value={paperTint}
                    onChange={(event) => setPaperTint(event.target.value)}
                    className="mt-1 block h-9 w-full rounded border border-border bg-white"
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  {tTemplates("builder.radius")}
                  <input
                    type="range"
                    min={4}
                    max={24}
                    step={1}
                    value={cornerRadius}
                    onChange={(event) => setCornerRadius(Number(event.target.value))}
                    className="mt-2 block w-full"
                  />
                </label>
              </div>
            </div>
          </div>
        </aside>

        <section className="surface-card p-4">
          <header className="template-preview-toolbar no-print mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-finance">
              {tTemplates("preview.title")}
              <span className="ms-2 text-[10px] font-normal text-muted-foreground">
                {isAr ? "يتم تحديث المعاينة تلقائياً" : "Preview updates live"}
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={previewMode === "a4" ? "primary" : "secondary"}
                onClick={() => setPreviewMode("a4")}
              >
                <FileText className="me-1 h-3.5 w-3.5" />
                {tTemplates("preview.a4Mode")}
              </Button>
              <Button
                size="sm"
                variant={previewMode === "mobile" ? "primary" : "secondary"}
                onClick={() => setPreviewMode("mobile")}
              >
                <Smartphone className="me-1 h-3.5 w-3.5" />
                {tTemplates("preview.mobileMode")}
              </Button>
              <Button size="sm" onClick={handlePrint}>
                <Printer className="me-1 h-3.5 w-3.5" />
                {tTemplates("preview.print")}
              </Button>
            </div>
          </header>

          <div className="template-preview-stage">
            <article
              style={previewStyle}
              className={cn(
                "template-sheet",
                previewMode === "a4" ? "template-sheet-a4" : "template-sheet-mobile",
              )}
            >
              <div className="template-brand-strip" />
              <header className="template-block border-b border-border/70 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{activeTemplateId}</p>
                    <h4 className="truncate text-xl font-bold text-finance">{templateName}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{headerText}</p>
                  </div>
                  <div className="text-end">
                    {logoDataUrl ? (
                      <Image
                        src={logoDataUrl}
                        alt={tTemplates("builder.logo")}
                        width={220}
                        height={72}
                        unoptimized
                        className="ms-auto h-12 w-auto rounded border border-border bg-white p-1"
                      />
                    ) : (
                      <div className="ms-auto rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
                        {tTemplates("builder.noLogo")}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {tTemplates("preview.generated")}
                    </p>
                    <p className="text-xs font-medium text-finance">
                      {formatDate(generatedAt, locale)}
                    </p>
                    <span
                      className={cn(
                        "mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        versionState === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700",
                      )}
                    >
                      {tTemplates(`status.${versionState}`)}
                    </span>
                  </div>
                </div>
              </header>

              <section className="template-block border-b border-border/70 px-6 py-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <article className="rounded-md border border-border/80 bg-white/70 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {tTemplates("preview.customer")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-finance">
                      {snapshot.customerName}
                    </p>
                  </article>
                  <article className="rounded-md border border-border/80 bg-white/70 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {tTemplates("preview.transaction")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-finance">
                      <bdi>{snapshot.transactionId}</bdi>
                    </p>
                  </article>
                  <article className="rounded-md border border-border/80 bg-white/70 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {tTemplates("preview.branch")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-finance">
                      {snapshot.branch}
                    </p>
                  </article>
                </div>
              </section>

              <section className="template-block px-6 py-5">
                <div className="overflow-hidden rounded-md border border-border/80">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr className="text-muted-foreground">
                        <th className="px-3 py-2 text-start">{tTemplates("preview.lineItem")}</th>
                        <th className="px-3 py-2 text-start">
                          {tTemplates("preview.description")}
                        </th>
                        <th className="px-3 py-2 text-end">{tTemplates("preview.amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.items.map((item) => (
                        <tr key={item.id} className="border-t border-border/70">
                          <td className="px-3 py-2 font-medium text-finance">{item.label}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.description}</td>
                          <td className="px-3 py-2 text-end">
                            {formatCurrency(item.amount, locale, snapshot.currency)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-border bg-slate-50/80">
                        <td className="px-3 py-2 text-xs font-semibold text-finance" colSpan={2}>
                          {tTemplates("preview.total")}
                        </td>
                        <td className="px-3 py-2 text-end text-xs font-bold text-finance">
                          {formatCurrency(totalAmount, locale, snapshot.currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <footer className="template-block border-t border-border/70 px-6 py-4">
                <p className="text-xs text-muted-foreground">{footerText}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {tTemplates("preview.modeOnly")}
                </p>
              </footer>
            </article>
          </div>
        </section>
      </div>
    </ErpPageLayout>
  );
}
