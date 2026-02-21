import { DEFAULT_TRAVEL_POLICY, type TravelPolicyConfig } from "@/modules/travel/policy/travel-policy-engine";
import type {
  TravelPolicyAuditEvent,
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

let policyVersionsState: TravelPolicyVersionRecord[] | null = null;
let policyAuditState: TravelPolicyAuditEvent[] | null = null;

function clonePolicyConfig(config: TravelPolicyConfig): TravelPolicyConfig {
  return {
    version: config.version,
    minAdvanceDaysByTripType: { ...config.minAdvanceDaysByTripType },
    maxBudgetByGrade: { ...config.maxBudgetByGrade },
    maxTravelClassByGrade: { ...config.maxTravelClassByGrade },
    budgetWarningThreshold: config.budgetWarningThreshold,
    maxTripLengthDays: config.maxTripLengthDays,
  };
}

function clonePolicyVersion(version: TravelPolicyVersionRecord): TravelPolicyVersionRecord {
  return {
    ...version,
    config: clonePolicyConfig(version.config),
  };
}

function clonePolicyAuditEvent(event: TravelPolicyAuditEvent): TravelPolicyAuditEvent {
  return { ...event };
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function ensurePolicyState(): {
  versions: TravelPolicyVersionRecord[];
  audit: TravelPolicyAuditEvent[];
} {
  if (!policyVersionsState) {
    const createdAt = "2026-02-01T00:00:00.000Z";
    policyVersionsState = [
      {
        versionId: DEFAULT_TRAVEL_POLICY.version,
        status: "active",
        createdAt,
        createdBy: "System",
        effectiveFrom: createdAt,
        activatedAt: createdAt,
        activatedBy: "System",
        note: "Initial baseline policy.",
        config: clonePolicyConfig(DEFAULT_TRAVEL_POLICY),
      },
    ];
  }

  if (!policyAuditState) {
    policyAuditState = [
      {
        id: "POL-AUD-0001",
        at: "2026-02-01T00:00:00.000Z",
        actorName: "System",
        action: "activate_policy",
        versionId: DEFAULT_TRAVEL_POLICY.version,
        note: "Initial baseline policy.",
      },
    ];
  }

  return {
    versions: policyVersionsState,
    audit: policyAuditState,
  };
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
    if (!Number.isFinite(value)) {
      return `${field} must be a finite number.`;
    }
    if (minExclusive === null) {
      continue;
    }
    if (value < minExclusive) {
      return `${field} must be >= ${minExclusive}.`;
    }
  }

  if (config.budgetWarningThreshold <= 0 || config.budgetWarningThreshold >= 1) {
    return "budgetWarningThreshold must be > 0 and < 1.";
  }

  const gradeOrder: Array<keyof typeof config.maxTravelClassByGrade> = [
    "staff",
    "manager",
    "director",
    "executive",
  ];
  for (let index = 1; index < gradeOrder.length; index += 1) {
    const previousGrade = gradeOrder[index - 1];
    const currentGrade = gradeOrder[index];
    if (
      TRAVEL_CLASS_RANK[config.maxTravelClassByGrade[currentGrade]] <
      TRAVEL_CLASS_RANK[config.maxTravelClassByGrade[previousGrade]]
    ) {
      return "maxTravelClassByGrade must be non-decreasing by seniority.";
    }
  }

  return null;
}

function parseVersion(versionId: string): [number, number, number] | null {
  const match = /^policy-v(\d+)\.(\d+)\.(\d+)$/i.exec(versionId);
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }
  return [major, minor, patch];
}

function nextPolicyVersionId(versions: TravelPolicyVersionRecord[]): string {
  let major = 1;
  let minor = 0;
  let patch = 0;

  for (const version of versions) {
    const parsed = parseVersion(version.versionId);
    if (!parsed) {
      continue;
    }
    const [parsedMajor, parsedMinor, parsedPatch] = parsed;
    if (
      parsedMajor > major ||
      (parsedMajor === major && parsedMinor > minor) ||
      (parsedMajor === major && parsedMinor === minor && parsedPatch > patch)
    ) {
      major = parsedMajor;
      minor = parsedMinor;
      patch = parsedPatch;
    }
  }

  return `policy-v${major}.${minor}.${patch + 1}`;
}

function nextPolicyAuditId(events: TravelPolicyAuditEvent[]): string {
  const max = events.reduce((highest, event) => {
    const match = /^POL-AUD-(\d+)$/i.exec(event.id);
    if (!match) {
      return highest;
    }
    const numeric = Number(match[1]);
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
  }, 0);
  return `POL-AUD-${String(max + 1).padStart(4, "0")}`;
}

function activeCandidateForDate(
  versions: TravelPolicyVersionRecord[],
  now: Date,
): TravelPolicyVersionRecord | null {
  const candidates = versions
    .filter((version) => ["active", "scheduled"].includes(version.status))
    .filter((version) => new Date(version.effectiveFrom).getTime() <= now.getTime())
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));

  return candidates[0] ?? null;
}

export function listTravelPolicyVersions(): TravelPolicyVersionRecord[] {
  const { versions } = ensurePolicyState();
  return versions
    .map((version) => clonePolicyVersion(version))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listTravelPolicyAuditEvents(): TravelPolicyAuditEvent[] {
  const { audit } = ensurePolicyState();
  return audit
    .map((event) => clonePolicyAuditEvent(event))
    .sort((left, right) => right.at.localeCompare(left.at));
}

export function getTravelPolicyVersion(versionId: string): TravelPolicyVersionRecord | null {
  const { versions } = ensurePolicyState();
  const match = versions.find((version) => version.versionId === versionId);
  return match ? clonePolicyVersion(match) : null;
}

export function getActiveTravelPolicyVersion(now: Date = new Date()): TravelPolicyVersionRecord {
  const { versions } = ensurePolicyState();
  const resolved = activeCandidateForDate(versions, now);
  if (resolved) {
    return clonePolicyVersion(resolved);
  }

  const fallback =
    versions.find((version) => version.status === "active") ?? versions[0];
  if (!fallback) {
    return {
      versionId: DEFAULT_TRAVEL_POLICY.version,
      status: "active",
      createdAt: now.toISOString(),
      createdBy: "System",
      effectiveFrom: now.toISOString(),
      config: clonePolicyConfig(DEFAULT_TRAVEL_POLICY),
    };
  }

  return clonePolicyVersion(fallback);
}

export function getActiveTravelPolicy(now: Date = new Date()): TravelPolicyConfig {
  const version = getActiveTravelPolicyVersion(now);
  return clonePolicyConfig(version.config);
}

export function createTravelPolicyDraft(
  input: CreateTravelPolicyDraftInput,
): CreateTravelPolicyDraftResult {
  if (!isNonEmptyText(input.actorName)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "actorName is required.",
      },
    };
  }

  const validationError = validatePolicyEditableConfig(input.config);
  if (validationError) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: validationError,
      },
    };
  }

  const { versions, audit } = ensurePolicyState();
  const versionId = nextPolicyVersionId(versions);
  const createdAt = new Date().toISOString();
  const created: TravelPolicyVersionRecord = {
    versionId,
    status: "draft",
    createdAt,
    createdBy: input.actorName.trim(),
    effectiveFrom: createdAt,
    note: input.note?.trim() || undefined,
    config: {
      version: versionId,
      minAdvanceDaysByTripType: { ...input.config.minAdvanceDaysByTripType },
      maxBudgetByGrade: { ...input.config.maxBudgetByGrade },
      maxTravelClassByGrade: { ...input.config.maxTravelClassByGrade },
      budgetWarningThreshold: input.config.budgetWarningThreshold,
      maxTripLengthDays: input.config.maxTripLengthDays,
    },
  };

  versions.unshift(created);
  audit.push({
    id: nextPolicyAuditId(audit),
    at: createdAt,
    actorName: input.actorName.trim(),
    action: "create_draft",
    versionId,
    note: input.note?.trim(),
  });

  return {
    ok: true,
    result: clonePolicyVersion(created),
  };
}

export function activateTravelPolicyVersion(
  input: ActivateTravelPolicyVersionInput,
): ActivateTravelPolicyVersionResult {
  if (!isNonEmptyText(input.versionId)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "versionId is required.",
      },
    };
  }
  if (!isNonEmptyText(input.actorName)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "actorName is required.",
      },
    };
  }

  if (input.effectiveFrom && !isValidDate(input.effectiveFrom)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "effectiveFrom must be a valid date.",
      },
    };
  }

  const { versions, audit } = ensurePolicyState();
  const index = versions.findIndex((version) => version.versionId === input.versionId);
  if (index < 0) {
    return {
      ok: false,
      error: {
        code: "version_not_found",
        message: "Policy version was not found.",
      },
    };
  }

  const target = versions[index];
  if (!target) {
    return {
      ok: false,
      error: {
        code: "version_not_found",
        message: "Policy version was not found.",
      },
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const effectiveFrom = input.effectiveFrom
    ? new Date(input.effectiveFrom)
    : now;
  const effectiveFromIso = effectiveFrom.toISOString();
  const immediateActivation = effectiveFrom.getTime() <= now.getTime();

  if (immediateActivation) {
    for (const version of versions) {
      if (version.versionId === target.versionId) {
        continue;
      }
      if (version.status === "active") {
        version.status = "retired";
      }
      if (version.status === "scheduled" && new Date(version.effectiveFrom) <= effectiveFrom) {
        version.status = "retired";
      }
    }
    target.status = "active";
  } else {
    target.status = "scheduled";
  }

  target.effectiveFrom = effectiveFromIso;
  target.activatedAt = nowIso;
  target.activatedBy = input.actorName.trim();
  target.note = input.note?.trim() || target.note;

  audit.push({
    id: nextPolicyAuditId(audit),
    at: nowIso,
    actorName: input.actorName.trim(),
    action: "activate_policy",
    versionId: target.versionId,
    note: input.note?.trim()
      ? `effectiveFrom=${effectiveFromIso}; ${input.note.trim()}`
      : `effectiveFrom=${effectiveFromIso}`,
  });

  return {
    ok: true,
    result: clonePolicyVersion(target),
  };
}
