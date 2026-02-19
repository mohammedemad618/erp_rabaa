"use client";

import {
  FileText,
  ImagePlus,
  Palette,
  Printer,
  Smartphone,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { formatCurrency, formatDate } from "@/utils/format";
import type { PreviewMode, TemplateDataset, TemplateVersionState } from "../types";

interface TemplatesConsoleProps {
  dataset: TemplateDataset;
}

export function TemplatesConsole({ dataset }: TemplatesConsoleProps) {
  const tTemplates = useTranslations("templatesModule");
  const locale = useLocale();

  const snapshot = dataset.snapshot;

  const [templateName, setTemplateName] = useState(snapshot.defaultName);
  const [headerText, setHeaderText] = useState(snapshot.defaultHeader);
  const [footerText, setFooterText] = useState(snapshot.defaultFooter);
  const [versionState, setVersionState] = useState<TemplateVersionState>("draft");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("a4");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const [primaryColor, setPrimaryColor] = useState("#0f4c81");
  const [accentColor, setAccentColor] = useState("#0f9d7a");
  const [paperTint, setPaperTint] = useState("#ffffff");
  const [cornerRadius, setCornerRadius] = useState(14);

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

  const previewStyle = {
    "--template-primary": primaryColor,
    "--template-accent": accentColor,
    "--template-paper": paperTint,
    "--template-radius": `${cornerRadius}px`,
  } as CSSProperties;

  const totalAmount = snapshot.totalAmount;

  return (
    <section className="space-y-4">
      <header className="surface-card p-6">
        <h2 className="text-2xl font-bold text-finance">{tTemplates("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tTemplates("subtitle")}</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <aside className="template-builder-panel surface-card no-print p-4">
          <h3 className="text-sm font-semibold text-finance">{tTemplates("builder.title")}</h3>

          <div className="mt-3 space-y-3">
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
                <Button
                  size="sm"
                  variant={versionState === "draft" ? "primary" : "secondary"}
                  onClick={() => setVersionState("draft")}
                >
                  {tTemplates("builder.draft")}
                </Button>
                <Button
                  size="sm"
                  variant={versionState === "active" ? "primary" : "secondary"}
                  onClick={() => setVersionState("active")}
                >
                  {tTemplates("builder.active")}
                </Button>
              </div>
            </div>

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
            <h3 className="text-sm font-semibold text-finance">{tTemplates("preview.title")}</h3>
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
                    <p className="text-xs text-muted-foreground">{snapshot.templateId}</p>
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
                      {formatDate(snapshot.generatedAt, locale)}
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
    </section>
  );
}
