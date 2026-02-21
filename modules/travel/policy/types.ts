import type { TravelPolicyConfig } from "@/modules/travel/policy/travel-policy-engine";

export type TravelPolicyEditableConfig = Omit<TravelPolicyConfig, "version">;

export type TravelPolicyVersionStatus = "draft" | "active" | "scheduled" | "retired";

export interface TravelPolicyVersionRecord {
  versionId: string;
  status: TravelPolicyVersionStatus;
  createdAt: string;
  createdBy: string;
  effectiveFrom: string;
  activatedAt?: string;
  activatedBy?: string;
  note?: string;
  config: TravelPolicyConfig;
}

export interface TravelPolicyAuditEvent {
  id: string;
  at: string;
  actorName: string;
  action: "create_draft" | "activate_policy";
  versionId: string;
  note?: string;
}
