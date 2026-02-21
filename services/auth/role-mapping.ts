import type { TravelActorRole } from "@/modules/travel/types";
import type { EnterpriseRole } from "@/services/auth/types";

export function mapEnterpriseRoleToTravelActorRole(
  role: EnterpriseRole,
): TravelActorRole | null {
  const roleMap: Record<EnterpriseRole, TravelActorRole | null> = {
    admin: "admin",
    finance_manager: "finance",
    agent: "employee",
    auditor: null,
    manager: "manager",
    travel_desk: "travel_desk",
  };
  return roleMap[role];
}
