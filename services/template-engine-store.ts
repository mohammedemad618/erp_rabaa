import prisma from "@/lib/prisma";
import { runMongoCommand, toMongoDate } from "@/lib/mongo-helper";
import type {
  PreviewMode,
  TemplateAuditAction,
  TemplateAuditEvent,
  TemplateDefinitionRecord,
  TemplateOutputKind,
  TemplateScope,
  TemplateVersionPayload,
  TemplateVersionRecord,
  TemplateVersionStatus,
} from "@/modules/templates/types";

const VALID_SCOPES = new Set<TemplateScope>(["travel", "operations", "finance", "shared"]);
const VALID_OUTPUT_KINDS = new Set<TemplateOutputKind>(["print", "pdf", "email"]);
const VALID_PREVIEW_MODES = new Set<PreviewMode>(["a4", "mobile"]);

const DEFAULT_TEMPLATE_PAYLOAD: TemplateVersionPayload = {
  tokens: {
    primaryColor: "#0f4c81",
    accentColor: "#0f9d7a",
    paperTint: "#ffffff",
    cornerRadius: 14,
    logoUrl: null,
  },
  content: {
    headerText: "Travel Confirmation",
    footerText: "Prepared by Enterprise Travel ERP",
  },
  layout: {
    previewMode: "a4",
  },
};

interface CreateTemplateInput {
  actorName: string;
  slug: string;
  scope: TemplateScope;
  name: string;
  description?: string;
  outputKind?: TemplateOutputKind;
  tags?: string[];
  initialVersionTitle?: string;
  initialPayload?: TemplateVersionPayload;
  note?: string;
}

interface UpdateTemplateInput {
  templateId: string;
  actorName: string;
  name?: string;
  description?: string;
  outputKind?: TemplateOutputKind;
  tags?: string[];
  archived?: boolean;
  note?: string;
}

interface CreateTemplateVersionInput {
  templateId: string;
  actorName: string;
  title: string;
  payload?: TemplateVersionPayload;
  schemaVersion?: number;
  note?: string;
}

interface ActivateTemplateVersionInput {
  templateId: string;
  versionId: string;
  actorName: string;
  note?: string;
}

interface TemplateStoreError {
  code: "validation_failed" | "template_not_found" | "version_not_found" | "conflict";
  message: string;
}

interface TemplateActionSuccess<T> {
  ok: true;
  result: T;
}

interface TemplateActionFailure {
  ok: false;
  error: TemplateStoreError;
}

export type CreateTemplateResult = TemplateActionSuccess<{
  template: TemplateDefinitionRecord;
  initialVersion: TemplateVersionRecord;
}> | TemplateActionFailure;

export type UpdateTemplateResult = TemplateActionSuccess<TemplateDefinitionRecord> | TemplateActionFailure;

export type CreateTemplateVersionResult = TemplateActionSuccess<TemplateVersionRecord> | TemplateActionFailure;

export type ActivateTemplateVersionResult = TemplateActionSuccess<{
  template: TemplateDefinitionRecord;
  version: TemplateVersionRecord;
}> | TemplateActionFailure;

interface TemplateRecordData {
  templateId: string;
  slug: string;
  scope: unknown;
  name: string;
  description?: string | null;
  outputKind: unknown;
  tags?: unknown;
  activeVersionId?: string | null;
  archivedAt?: unknown;
  createdAt: unknown;
  createdBy: string;
  updatedAt: unknown;
  updatedBy: string;
}

interface TemplateVersionData {
  versionId: string;
  templateId: string;
  status: unknown;
  schemaVersion?: unknown;
  title: string;
  payload: unknown;
  createdAt: unknown;
  createdBy: string;
  activatedAt?: unknown;
  activatedBy?: string | null;
  note?: string | null;
}

interface TemplateAuditData {
  auditId: string;
  templateId: string;
  versionId?: string | null;
  actorName: string;
  action: unknown;
  at: unknown;
  note?: string | null;
  metadata?: unknown;
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return new Date().toISOString();
}

function normalizeScope(value: unknown): TemplateScope {
  return typeof value === "string" && VALID_SCOPES.has(value as TemplateScope)
    ? (value as TemplateScope)
    : "shared";
}

function normalizeOutputKind(value: unknown): TemplateOutputKind {
  return typeof value === "string" && VALID_OUTPUT_KINDS.has(value as TemplateOutputKind)
    ? (value as TemplateOutputKind)
    : "print";
}

function normalizeVersionStatus(value: unknown): TemplateVersionStatus {
  if (value === "draft" || value === "active" || value === "retired") {
    return value;
  }
  return "draft";
}

function normalizeAuditAction(value: unknown): TemplateAuditAction {
  if (
    value === "create_template" ||
    value === "update_template" ||
    value === "create_version" ||
    value === "activate_version"
  ) {
    return value;
  }
  return "update_template";
}

function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const unique = new Set<string>();
  for (const rawTag of value) {
    if (typeof rawTag !== "string") {
      continue;
    }
    const normalized = rawTag.trim().toLowerCase();
    if (normalized.length > 0) {
      unique.add(normalized);
    }
  }
  return [...unique];
}

function cloneDefaultPayload(): TemplateVersionPayload {
  return {
    tokens: { ...DEFAULT_TEMPLATE_PAYLOAD.tokens },
    content: { ...DEFAULT_TEMPLATE_PAYLOAD.content },
    layout: { ...DEFAULT_TEMPLATE_PAYLOAD.layout },
  };
}

function normalizePayload(value: unknown): TemplateVersionPayload {
  if (!isObjectRecord(value)) {
    return cloneDefaultPayload();
  }

  const payload = cloneDefaultPayload();
  const tokensRaw = isObjectRecord(value.tokens) ? value.tokens : {};
  const contentRaw = isObjectRecord(value.content) ? value.content : {};
  const layoutRaw = isObjectRecord(value.layout) ? value.layout : {};

  if (isNonEmptyText(tokensRaw.primaryColor)) payload.tokens.primaryColor = tokensRaw.primaryColor.trim();
  if (isNonEmptyText(tokensRaw.accentColor)) payload.tokens.accentColor = tokensRaw.accentColor.trim();
  if (isNonEmptyText(tokensRaw.paperTint)) payload.tokens.paperTint = tokensRaw.paperTint.trim();
  if (typeof tokensRaw.cornerRadius === "number" && Number.isFinite(tokensRaw.cornerRadius)) {
    payload.tokens.cornerRadius = Math.max(0, Math.min(32, Math.round(tokensRaw.cornerRadius)));
  }
  if (tokensRaw.logoUrl === null) {
    payload.tokens.logoUrl = null;
  } else if (isNonEmptyText(tokensRaw.logoUrl)) {
    payload.tokens.logoUrl = tokensRaw.logoUrl.trim();
  }

  if (isNonEmptyText(contentRaw.headerText)) payload.content.headerText = contentRaw.headerText.trim();
  if (isNonEmptyText(contentRaw.footerText)) payload.content.footerText = contentRaw.footerText.trim();

  if (
    isNonEmptyText(layoutRaw.previewMode) &&
    VALID_PREVIEW_MODES.has(layoutRaw.previewMode as PreviewMode)
  ) {
    payload.layout.previewMode = layoutRaw.previewMode as PreviewMode;
  }

  return payload;
}

function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  return isObjectRecord(value) ? value : undefined;
}

function mapPrismaTemplate(data: TemplateRecordData): TemplateDefinitionRecord {
  return {
    templateId: data.templateId,
    slug: data.slug,
    scope: normalizeScope(data.scope),
    name: data.name,
    description: data.description ?? undefined,
    outputKind: normalizeOutputKind(data.outputKind),
    tags: sanitizeTags(data.tags),
    activeVersionId: data.activeVersionId ?? undefined,
    archivedAt: isNonEmptyText(data.archivedAt) ? data.archivedAt : undefined,
    createdAt: toIsoString(data.createdAt),
    createdBy: data.createdBy,
    updatedAt: toIsoString(data.updatedAt),
    updatedBy: data.updatedBy,
  };
}

function mapPrismaTemplateVersion(data: TemplateVersionData): TemplateVersionRecord {
  const schemaVersion =
    typeof data.schemaVersion === "number" && Number.isFinite(data.schemaVersion)
      ? Math.max(1, Math.round(data.schemaVersion))
      : 1;

  return {
    versionId: data.versionId,
    templateId: data.templateId,
    status: normalizeVersionStatus(data.status),
    schemaVersion,
    title: data.title,
    payload: normalizePayload(data.payload),
    createdAt: toIsoString(data.createdAt),
    createdBy: data.createdBy,
    activatedAt: isNonEmptyText(data.activatedAt) ? data.activatedAt : undefined,
    activatedBy: data.activatedBy ?? undefined,
    note: data.note ?? undefined,
  };
}

function mapPrismaTemplateAudit(data: TemplateAuditData): TemplateAuditEvent {
  return {
    id: data.auditId,
    templateId: data.templateId,
    versionId: data.versionId ?? undefined,
    actorName: data.actorName,
    action: normalizeAuditAction(data.action),
    at: toIsoString(data.at),
    note: data.note ?? undefined,
    metadata: normalizeMetadata(data.metadata),
  };
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function isValidTemplatePayload(payload: TemplateVersionPayload): boolean {
  return (
    isNonEmptyText(payload.tokens.primaryColor) &&
    isNonEmptyText(payload.tokens.accentColor) &&
    isNonEmptyText(payload.tokens.paperTint) &&
    Number.isFinite(payload.tokens.cornerRadius) &&
    isNonEmptyText(payload.content.headerText) &&
    isNonEmptyText(payload.content.footerText) &&
    VALID_PREVIEW_MODES.has(payload.layout.previewMode)
  );
}

async function ensureInitialTemplates(): Promise<void> {
  const count = await prisma.documentTemplate.count();
  if (count > 0) {
    return;
  }

  const createdAt = "2026-02-01T00:00:00.000Z";
  const templateId = "TPL-0001";
  const versionId = "TPL-0001-V001";

  await runMongoCommand("document_templates", "insert", {
    documents: [
      {
        templateId,
        slug: "corporate-itinerary",
        scope: "travel",
        name: "Corporate Itinerary",
        description: "Default enterprise itinerary template.",
        outputKind: "print",
        tags: ["travel", "itinerary"],
        activeVersionId: versionId,
        createdAt: toMongoDate(createdAt),
        createdBy: "System",
        updatedAt: toMongoDate(createdAt),
        updatedBy: "System",
        archivedAt: null,
      },
    ],
  });

  await runMongoCommand("document_template_versions", "insert", {
    documents: [
      {
        versionId,
        templateId,
        status: "active",
        schemaVersion: 1,
        title: "Corporate Itinerary v1",
        payload: DEFAULT_TEMPLATE_PAYLOAD,
        createdAt: toMongoDate(createdAt),
        createdBy: "System",
        activatedAt: createdAt,
        activatedBy: "System",
        note: "Initial baseline template.",
      },
    ],
  });

  await runMongoCommand("document_template_audit", "insert", {
    documents: [
      {
        auditId: "TPL-AUD-0001",
        templateId,
        versionId,
        actorName: "System",
        action: "create_template",
        at: createdAt,
        note: "Initial baseline template.",
        metadata: { status: "seeded" },
      },
    ],
  });
}

async function nextTemplateId(): Promise<string> {
  const latest = await prisma.documentTemplate.findFirst({
    orderBy: { createdAt: "desc" },
    select: { templateId: true },
  });

  if (!latest) {
    return "TPL-0001";
  }

  const parsed = /^TPL-(\d+)$/i.exec(latest.templateId);
  const current = parsed ? Number(parsed[1]) : 0;
  return `TPL-${String(current + 1).padStart(4, "0")}`;
}

async function nextVersionId(templateId: string): Promise<string> {
  const latest = await prisma.documentTemplateVersion.findFirst({
    where: { templateId },
    orderBy: { createdAt: "desc" },
    select: { versionId: true },
  });

  if (!latest) {
    return `${templateId}-V001`;
  }

  const parsed = new RegExp(`^${templateId}-V(\\d+)$`, "i").exec(latest.versionId);
  const current = parsed ? Number(parsed[1]) : 0;
  return `${templateId}-V${String(current + 1).padStart(3, "0")}`;
}

async function nextAuditId(): Promise<string> {
  const count = await prisma.documentTemplateAudit.count();
  return `TPL-AUD-${String(count + 1).padStart(4, "0")}`;
}

async function addAuditEntry(input: {
  templateId: string;
  versionId?: string;
  actorName: string;
  action: TemplateAuditAction;
  note?: string;
  metadata?: Record<string, unknown>;
  at?: string;
}): Promise<void> {
  const at = input.at ?? new Date().toISOString();
  const auditId = await nextAuditId();
  await runMongoCommand("document_template_audit", "insert", {
    documents: [
      {
        auditId,
        templateId: input.templateId,
        versionId: input.versionId ?? null,
        actorName: input.actorName,
        action: input.action,
        at,
        note: input.note ?? null,
        metadata: input.metadata ?? null,
      },
    ],
  });
}

export async function listTemplates(): Promise<TemplateDefinitionRecord[]> {
  await ensureInitialTemplates();
  const records = await prisma.documentTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return records.map((row) => mapPrismaTemplate(row));
}

export async function getTemplate(templateId: string): Promise<TemplateDefinitionRecord | null> {
  await ensureInitialTemplates();
  const record = await prisma.documentTemplate.findUnique({
    where: { templateId },
  });
  return record ? mapPrismaTemplate(record) : null;
}

export async function listTemplateVersions(templateId: string): Promise<TemplateVersionRecord[]> {
  await ensureInitialTemplates();
  const records = await prisma.documentTemplateVersion.findMany({
    where: { templateId },
    orderBy: { createdAt: "desc" },
  });
  return records.map((row) => mapPrismaTemplateVersion(row));
}

export async function listTemplateAuditEvents(templateId: string): Promise<TemplateAuditEvent[]> {
  await ensureInitialTemplates();
  const records = await prisma.documentTemplateAudit.findMany({
    where: { templateId },
    orderBy: { at: "desc" },
  });
  return records.map((row) => mapPrismaTemplateAudit(row));
}

export async function createTemplate(input: CreateTemplateInput): Promise<CreateTemplateResult> {
  if (!isNonEmptyText(input.actorName)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "actorName is required." },
    };
  }
  if (!isNonEmptyText(input.slug) || !isValidSlug(input.slug.trim().toLowerCase())) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "slug must be lowercase and may include hyphens.",
      },
    };
  }
  if (!VALID_SCOPES.has(input.scope)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "scope is invalid." },
    };
  }
  if (!isNonEmptyText(input.name)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "name is required." },
    };
  }

  const outputKind = input.outputKind ?? "print";
  if (!VALID_OUTPUT_KINDS.has(outputKind)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "outputKind is invalid." },
    };
  }

  const initialPayload = normalizePayload(input.initialPayload);
  if (!isValidTemplatePayload(initialPayload)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "initialPayload is invalid." },
    };
  }

  await ensureInitialTemplates();

  const slug = input.slug.trim().toLowerCase();
  const existing = await prisma.documentTemplate.findUnique({
    where: { slug },
    select: { templateId: true },
  });
  if (existing) {
    return {
      ok: false,
      error: { code: "conflict", message: "slug already exists." },
    };
  }

  const templateId = await nextTemplateId();
  const versionId = await nextVersionId(templateId);
  const now = new Date();
  const nowIso = now.toISOString();
  const actorName = input.actorName.trim();
  const tags = sanitizeTags(input.tags);
  const title = isNonEmptyText(input.initialVersionTitle)
    ? input.initialVersionTitle.trim()
    : `${input.name.trim()} v1`;

  await runMongoCommand("document_templates", "insert", {
    documents: [
      {
        templateId,
        slug,
        scope: input.scope,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        outputKind,
        tags,
        activeVersionId: null,
        createdAt: toMongoDate(now),
        createdBy: actorName,
        updatedAt: toMongoDate(now),
        updatedBy: actorName,
        archivedAt: null,
      },
    ],
  });

  await runMongoCommand("document_template_versions", "insert", {
    documents: [
      {
        versionId,
        templateId,
        status: "draft",
        schemaVersion: 1,
        title,
        payload: initialPayload,
        createdAt: toMongoDate(now),
        createdBy: actorName,
        activatedAt: null,
        activatedBy: null,
        note: input.note?.trim() || null,
      },
    ],
  });

  await addAuditEntry({
    templateId,
    versionId,
    actorName,
    action: "create_template",
    note: input.note,
    metadata: {
      slug,
      scope: input.scope,
      outputKind,
    },
    at: nowIso,
  });

  const createdTemplate = await prisma.documentTemplate.findUnique({
    where: { templateId },
  });
  const createdVersion = await prisma.documentTemplateVersion.findUnique({
    where: { versionId },
  });
  if (!createdTemplate || !createdVersion) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "Template creation failed." },
    };
  }

  return {
    ok: true,
    result: {
      template: mapPrismaTemplate(createdTemplate),
      initialVersion: mapPrismaTemplateVersion(createdVersion),
    },
  };
}

export async function updateTemplate(input: UpdateTemplateInput): Promise<UpdateTemplateResult> {
  if (!isNonEmptyText(input.actorName)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "actorName is required." },
    };
  }
  if (!isNonEmptyText(input.templateId)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "templateId is required." },
    };
  }
  if (input.outputKind && !VALID_OUTPUT_KINDS.has(input.outputKind)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "outputKind is invalid." },
    };
  }
  if (input.name !== undefined && !isNonEmptyText(input.name)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "name cannot be empty." },
    };
  }

  await ensureInitialTemplates();

  const existing = await prisma.documentTemplate.findUnique({
    where: { templateId: input.templateId.trim() },
  });
  if (!existing) {
    return {
      ok: false,
      error: { code: "template_not_found", message: "Template not found." },
    };
  }

  const actorName = input.actorName.trim();
  const updateData: Record<string, unknown> = {
    updatedBy: actorName,
  };
  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }
  if (input.description !== undefined) {
    updateData.description = input.description.trim() || null;
  }
  if (input.outputKind !== undefined) {
    updateData.outputKind = input.outputKind;
  }
  if (input.tags !== undefined) {
    updateData.tags = sanitizeTags(input.tags);
  }
  if (input.archived !== undefined) {
    updateData.archivedAt = input.archived ? new Date().toISOString() : null;
  }

  await prisma.documentTemplate.update({
    where: { templateId: input.templateId.trim() },
    data: updateData,
  });

  await addAuditEntry({
    templateId: input.templateId.trim(),
    actorName,
    action: "update_template",
    note: input.note,
    metadata: {
      changedFields: Object.keys(updateData).filter((field) => field !== "updatedBy"),
    },
  });

  const updated = await prisma.documentTemplate.findUnique({
    where: { templateId: input.templateId.trim() },
  });
  if (!updated) {
    return {
      ok: false,
      error: { code: "template_not_found", message: "Template not found." },
    };
  }
  return { ok: true, result: mapPrismaTemplate(updated) };
}

export async function createTemplateVersion(
  input: CreateTemplateVersionInput,
): Promise<CreateTemplateVersionResult> {
  if (!isNonEmptyText(input.actorName)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "actorName is required." },
    };
  }
  if (!isNonEmptyText(input.templateId)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "templateId is required." },
    };
  }
  if (!isNonEmptyText(input.title)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "title is required." },
    };
  }

  await ensureInitialTemplates();

  const template = await prisma.documentTemplate.findUnique({
    where: { templateId: input.templateId.trim() },
  });
  if (!template) {
    return {
      ok: false,
      error: { code: "template_not_found", message: "Template not found." },
    };
  }

  const payload = normalizePayload(input.payload);
  if (!isValidTemplatePayload(payload)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "payload is invalid." },
    };
  }

  const versionId = await nextVersionId(input.templateId.trim());
  const schemaVersion =
    typeof input.schemaVersion === "number" && Number.isFinite(input.schemaVersion)
      ? Math.max(1, Math.round(input.schemaVersion))
      : 1;
  const now = new Date();
  const nowIso = now.toISOString();
  const actorName = input.actorName.trim();

  await runMongoCommand("document_template_versions", "insert", {
    documents: [
      {
        versionId,
        templateId: input.templateId.trim(),
        status: "draft",
        schemaVersion,
        title: input.title.trim(),
        payload,
        createdAt: toMongoDate(now),
        createdBy: actorName,
        activatedAt: null,
        activatedBy: null,
        note: input.note?.trim() || null,
      },
    ],
  });

  await prisma.documentTemplate.update({
    where: { templateId: input.templateId.trim() },
    data: { updatedBy: actorName },
  });

  await addAuditEntry({
    templateId: input.templateId.trim(),
    versionId,
    actorName,
    action: "create_version",
    note: input.note,
    metadata: {
      schemaVersion,
      title: input.title.trim(),
    },
    at: nowIso,
  });

  const created = await prisma.documentTemplateVersion.findUnique({
    where: { versionId },
  });
  if (!created) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "Version creation failed." },
    };
  }
  return { ok: true, result: mapPrismaTemplateVersion(created) };
}

export async function activateTemplateVersion(
  input: ActivateTemplateVersionInput,
): Promise<ActivateTemplateVersionResult> {
  if (!isNonEmptyText(input.actorName)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "actorName is required." },
    };
  }
  if (!isNonEmptyText(input.templateId) || !isNonEmptyText(input.versionId)) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "templateId and versionId are required." },
    };
  }

  await ensureInitialTemplates();

  const templateId = input.templateId.trim();
  const versionId = input.versionId.trim();
  const template = await prisma.documentTemplate.findUnique({
    where: { templateId },
  });
  if (!template) {
    return {
      ok: false,
      error: { code: "template_not_found", message: "Template not found." },
    };
  }

  const version = await prisma.documentTemplateVersion.findFirst({
    where: {
      templateId,
      versionId,
    },
  });
  if (!version) {
    return {
      ok: false,
      error: { code: "version_not_found", message: "Version not found." },
    };
  }

  const actorName = input.actorName.trim();
  const now = new Date();
  const nowIso = now.toISOString();

  await runMongoCommand("document_template_versions", "update", {
    updates: [
      {
        q: {
          templateId,
          status: "active",
          versionId: { $ne: versionId },
        },
        u: {
          $set: {
            status: "retired",
          },
        },
        multi: true,
      },
      {
        q: {
          templateId,
          versionId,
        },
        u: {
          $set: {
            status: "active",
            activatedAt: nowIso,
            activatedBy: actorName,
          },
        },
        multi: false,
      },
    ],
  });

  await runMongoCommand("document_templates", "update", {
    updates: [
      {
        q: { templateId },
        u: {
          $set: {
            activeVersionId: versionId,
            updatedBy: actorName,
            updatedAt: toMongoDate(now),
          },
        },
        multi: false,
      },
    ],
  });

  await addAuditEntry({
    templateId,
    versionId,
    actorName,
    action: "activate_version",
    note: input.note,
    metadata: {
      activatedAt: nowIso,
    },
    at: nowIso,
  });

  const updatedTemplate = await prisma.documentTemplate.findUnique({
    where: { templateId },
  });
  const updatedVersion = await prisma.documentTemplateVersion.findUnique({
    where: { versionId },
  });

  if (!updatedTemplate || !updatedVersion) {
    return {
      ok: false,
      error: { code: "validation_failed", message: "Version activation failed." },
    };
  }

  return {
    ok: true,
    result: {
      template: mapPrismaTemplate(updatedTemplate),
      version: mapPrismaTemplateVersion(updatedVersion),
    },
  };
}
