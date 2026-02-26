import prisma from "@/lib/prisma";
import { runMongoCommand, toMongoDate } from "@/lib/mongo-helper";
import { globalCache } from "@/lib/cache";
import { DEFAULT_TRAVEL_POLICY, type TravelPolicyConfig } from "@/modules/travel/policy/travel-policy-engine";
import type {
  TravelPolicyAuditEvent,
  TravelPolicyVersionStatus,
  TravelPolicyEditableConfig,
  TravelPolicyVersionRecord,
} from "@/modules/travel/policy/types";
import type { TravelClass } from "@/modules/travel/types";

interface CreateTravelPolicyDraftInput {
  actorName: string;
  config: TravelPolicyEditableConfig;
  note?: string;
}

interface ActivateTravelPolicyVersionInput {
  versionId: string;
  actorName: string;
  effectiveFrom?: string;
  note?: string;
}

interface CreateTravelPolicyDraftSuccess {
  ok: true;
  result: TravelPolicyVersionRecord;
}

interface CreateTravelPolicyDraftFailure {
  ok: false;
  error: {
    code: "validation_failed";
    message: string;
  };
}

interface ActivateTravelPolicyVersionSuccess {
  ok: true;
  result: TravelPolicyVersionRecord;
}

interface ActivateTravelPolicyVersionFailure {
  ok: false;
  error: {
    code: "validation_failed" | "version_not_found";
    message: string;
  };
}

export type CreateTravelPolicyDraftResult =
  | CreateTravelPolicyDraftSuccess
  | CreateTravelPolicyDraftFailure;

export type ActivateTravelPolicyVersionResult =
  | ActivateTravelPolicyVersionSuccess
  | ActivateTravelPolicyVersionFailure;

const TRAVEL_CLASS_RANK: Record<TravelClass, number> = {
  economy: 1,
  premium_economy: 2,
  business: 3,
  first: 4,
};

function toIsoDateString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return new Date().toISOString();
}

interface PolicyVersionRecordData {
  versionId: string;
  status: unknown;
  createdAt: unknown;
  createdBy: string;
  effectiveFrom: unknown;
  activatedAt?: unknown;
  activatedBy?: string | null;
  note?: string | null;
  config: unknown;
}

interface PolicyAuditRecordData {
  auditId: string;
  at: string;
  actorName: string;
  action: unknown;
  versionId: string;
  note?: string | null;
}

function normalizePolicyVersionStatus(value: unknown): TravelPolicyVersionStatus {
  if (value === "draft" || value === "active" || value === "scheduled" || value === "retired") {
    return value;
  }
  return "draft";
}

function normalizePolicyAuditAction(value: unknown): TravelPolicyAuditEvent["action"] {
  return value === "activate_policy" ? "activate_policy" : "create_draft";
}

function normalizePolicyConfig(value: unknown, versionId: string): TravelPolicyConfig {
  if (value && typeof value === "object") {
    const config = value as TravelPolicyConfig;
    if (typeof config.version === "string" && config.version.length > 0) {
      return config;
    }
    return {
      ...config,
      version: versionId,
    };
  }

  return {
    ...DEFAULT_TRAVEL_POLICY,
    version: versionId,
  };
}

/**
 * MongoDB helper to map Prisma model to Domain type
 */
function mapPrismaToPolicyVersion(data: PolicyVersionRecordData): TravelPolicyVersionRecord {
  return {
    versionId: data.versionId,
    status: normalizePolicyVersionStatus(data.status),
    createdAt: toIsoDateString(data.createdAt),
    createdBy: data.createdBy,
    effectiveFrom: toIsoDateString(data.effectiveFrom),
    activatedAt: data.activatedAt ? toIsoDateString(data.activatedAt) : undefined,
    activatedBy: data.activatedBy ?? undefined,
    note: data.note ?? undefined,
    config: normalizePolicyConfig(data.config, data.versionId),
  };
}

function mapPrismaToPolicyAudit(data: PolicyAuditRecordData): TravelPolicyAuditEvent {
  return {
    id: data.auditId,
    at: data.at,
    actorName: data.actorName,
    action: normalizePolicyAuditAction(data.action),
    versionId: data.versionId,
    note: data.note ?? undefined,
  };
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

async function normalizeLegacyPolicyData(): Promise<void> {
  // Legacy records stored activatedAt as Date while Prisma schema expects String?.
  await runMongoCommand("travel_policies", "update", {
    updates: [
      {
        q: { activatedAt: { $type: "date" } },
        u: { $set: { activatedAt: null } },
        multi: true,
      },
    ],
  });
}

async function ensureInitialPolicy(): Promise<void> {
  await normalizeLegacyPolicyData();
  const count = await prisma.travelPolicyVersion.count();
  if (count === 0) {
    const createdAt = "2026-02-01T00:00:00.000Z";
    
    // Seed initial policy version
    await runMongoCommand("travel_policies", "insert", {
      documents: [
        {
          versionId: DEFAULT_TRAVEL_POLICY.version,
          status: "active",
          createdAt: toMongoDate(createdAt),
          createdBy: "System",
          effectiveFrom: createdAt,
          activatedAt: createdAt,
          activatedBy: "System",
          note: "Initial baseline policy.",
          config: DEFAULT_TRAVEL_POLICY,
        }
      ]
    });

    // Seed initial audit log
    await runMongoCommand("travel_policy_audit", "insert", {
      documents: [
        {
          auditId: "POL-AUD-0001",
          at: createdAt,
          actorName: "System",
          action: "activate_policy",
          versionId: DEFAULT_TRAVEL_POLICY.version,
          note: "Initial baseline policy.",
        }
      ]
    });
  }
}

function validatePolicyEditableConfig(config: TravelPolicyEditableConfig): string | null {
  const numericChecks: Array<[string, number, number | null]> = [
    ["minAdvanceDaysByTripType.domestic", config.minAdvanceDaysByTripType.domestic, 0],
    ["minAdvanceDaysByTripType.international", config.minAdvanceDaysByTripType.international, 0],
    ["maxBudgetByGrade.staff", config.maxBudgetByGrade.staff, 1],
    ["maxBudgetByGrade.manager", config.maxBudgetByGrade.manager, 1],
    ["maxBudgetByGrade.director", config.maxBudgetByGrade.director, 1],
    ["maxBudgetByGrade.executive", config.maxBudgetByGrade.executive, 1],
    ["budgetWarningThreshold", config.budgetWarningThreshold, null],
    ["maxTripLengthDays", config.maxTripLengthDays, 1],
  ];

  for (const [field, value, minExclusive] of numericChecks) {
    if (!Number.isFinite(value)) return `${field} must be finite.`;
    if (minExclusive !== null && value < minExclusive) return `${field} must be >= ${minExclusive}.`;
  }

  if (config.budgetWarningThreshold <= 0 || config.budgetWarningThreshold >= 1) return "budgetWarningThreshold must be between 0 and 1.";

  const grades: Array<keyof typeof config.maxTravelClassByGrade> = ["staff", "manager", "director", "executive"];
  for (let i = 1; i < grades.length; i++) {
    if (TRAVEL_CLASS_RANK[config.maxTravelClassByGrade[grades[i]]] < TRAVEL_CLASS_RANK[config.maxTravelClassByGrade[grades[i - 1]]]) {
      return "maxTravelClassByGrade must be non-decreasing.";
    }
  }
  return null;
}

async function nextPolicyVersionId(): Promise<string> {
  const latest = await prisma.travelPolicyVersion.findFirst({
    orderBy: { createdAt: "desc" },
    select: { versionId: true },
  });

  let major = 1, minor = 0, patch = 0;
  if (latest) {
    const match = /^policy-v(\d+)\.(\d+)\.(\d+)$/i.exec(latest.versionId);
    if (match) {
      major = Number(match[1]);
      minor = Number(match[2]);
      patch = Number(match[3]);
    }
  }
  return `policy-v${major}.${minor}.${patch + 1}`;
}

async function nextPolicyAuditId(): Promise<string> {
  const count = await prisma.travelPolicyAudit.count();
  return `POL-AUD-${String(count + 1).padStart(4, "0")}`;
}

export async function getTravelPolicyVersion(versionId: string): Promise<TravelPolicyVersionRecord | null> {
  const record = await prisma.travelPolicyVersion.findUnique({ where: { versionId } });
  return record ? mapPrismaToPolicyVersion(record) : null;
}

export async function listTravelPolicyVersions(): Promise<TravelPolicyVersionRecord[]> {
  await ensureInitialPolicy();
  const records = await prisma.travelPolicyVersion.findMany({
    orderBy: { createdAt: "desc" },
  });
  return records.map(mapPrismaToPolicyVersion);
}

export async function listTravelPolicyAuditEvents(): Promise<TravelPolicyAuditEvent[]> {
  await ensureInitialPolicy();
  const records = await prisma.travelPolicyAudit.findMany({
    orderBy: { at: "desc" },
  });
  return records.map(mapPrismaToPolicyAudit);
}

export async function getActiveTravelPolicyVersion(now: Date = new Date()): Promise<TravelPolicyVersionRecord> {
  const cacheKey = `active_policy_${now.toDateString()}`; // Cache by day for simplicity, or implement more granular invalidation
  
  return globalCache.getOrSet(cacheKey, async () => {
    await ensureInitialPolicy();
    const nowIso = now.toISOString();
    
    const activeCandidate = await prisma.travelPolicyVersion.findFirst({
      where: {
        status: { in: ["active", "scheduled"] },
        effectiveFrom: { lte: nowIso },
      },
      orderBy: { effectiveFrom: "desc" },
    });

    if (activeCandidate) return mapPrismaToPolicyVersion(activeCandidate);

    const fallback = await prisma.travelPolicyVersion.findFirst({
      where: { status: "active" },
    }) || await prisma.travelPolicyVersion.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!fallback) {
      const nowIso = now.toISOString();
      return mapPrismaToPolicyVersion({
        versionId: DEFAULT_TRAVEL_POLICY.version,
        status: "active",
        createdAt: nowIso,
        createdBy: "System",
        effectiveFrom: nowIso,
        activatedAt: nowIso,
        activatedBy: "System",
        note: "Fallback baseline policy.",
        config: DEFAULT_TRAVEL_POLICY,
      });
    }

    return mapPrismaToPolicyVersion(fallback);
  }, 60 * 5); // Cache for 5 minutes
}

export async function getActiveTravelPolicy(now: Date = new Date()): Promise<TravelPolicyConfig> {
  const version = await getActiveTravelPolicyVersion(now);
  return version.config;
}

export async function createTravelPolicyDraft(
  input: CreateTravelPolicyDraftInput,
): Promise<CreateTravelPolicyDraftResult> {
  if (!isNonEmptyText(input.actorName)) return { ok: false, error: { code: "validation_failed", message: "Actor name required." } };
  const valError = validatePolicyEditableConfig(input.config);
  if (valError) return { ok: false, error: { code: "validation_failed", message: valError } };

  const versionId = await nextPolicyVersionId();
  const now = new Date();
  const nowIso = now.toISOString();

  await runMongoCommand("travel_policies", "insert", {
    documents: [
      {
        versionId,
        status: "draft",
        createdBy: input.actorName.trim(),
        effectiveFrom: nowIso,
        note: input.note?.trim(),
        config: { ...input.config, version: versionId },
        createdAt: toMongoDate(now),
      }
    ]
  });

  const created = await prisma.travelPolicyVersion.findUniqueOrThrow({ where: { versionId } });

  const auditId = await nextPolicyAuditId();
  await runMongoCommand("travel_policy_audit", "insert", {
    documents: [
      {
        auditId,
        at: nowIso,
        actorName: input.actorName.trim(),
        action: "create_draft",
        versionId,
        note: input.note?.trim(),
      }
    ]
  });

  return { ok: true, result: mapPrismaToPolicyVersion(created) };
}

export async function activateTravelPolicyVersion(
  input: ActivateTravelPolicyVersionInput,
): Promise<ActivateTravelPolicyVersionResult> {
  if (!isNonEmptyText(input.versionId)) return { ok: false, error: { code: "validation_failed", message: "ID required." } };
  if (input.effectiveFrom && !isValidDate(input.effectiveFrom)) {
    return { ok: false, error: { code: "validation_failed", message: "effectiveFrom is invalid." } };
  }
  
  const target = await prisma.travelPolicyVersion.findUnique({ where: { versionId: input.versionId } });
  if (!target) return { ok: false, error: { code: "version_not_found", message: "Not found." } };

  const now = new Date();
  const nowIso = now.toISOString();
  const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : now;
  const effectiveFromIso = effectiveFrom.toISOString();
  const isImmediate = effectiveFrom.getTime() <= now.getTime();

  if (isImmediate) {
    await prisma.travelPolicyVersion.updateMany({
      where: { status: "active", versionId: { not: input.versionId } },
      data: { status: "retired" },
    });
    await prisma.travelPolicyVersion.update({
      where: { versionId: input.versionId },
      data: { status: "active", effectiveFrom: effectiveFromIso, activatedAt: nowIso, activatedBy: input.actorName.trim() },
    });
    // Invalidate cache
    globalCache.clear();
  } else {
    await prisma.travelPolicyVersion.update({
      where: { versionId: input.versionId },
      data: { status: "scheduled", effectiveFrom: effectiveFromIso, activatedAt: nowIso, activatedBy: input.actorName.trim() },
    });
  }

  const auditId = await nextPolicyAuditId();
  await runMongoCommand("travel_policy_audit", "insert", {
    documents: [
      {
        auditId,
        at: nowIso,
        actorName: input.actorName.trim(),
        action: "activate_policy",
        versionId: input.versionId,
        note: `effectiveFrom=${effectiveFromIso}`,
      }
    ]
  });

  const updated = await prisma.travelPolicyVersion.findUnique({ where: { versionId: input.versionId } });
  if (!updated) return { ok: false, error: { code: "version_not_found", message: "Not found." } };
  return { ok: true, result: mapPrismaToPolicyVersion(updated) };
}
