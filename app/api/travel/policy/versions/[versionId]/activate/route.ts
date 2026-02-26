import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { activateTravelPolicyVersion } from "@/services/travel-policy-store";

interface ActivatePolicyBody {
  effectiveFrom?: string;
  note?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await context.params;
  if (!versionId) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "versionId is required.",
      },
      { status: 400 },
    );
  }

  const guard = await requireApiPermission("travel.policy.manage");
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBodySafe<ActivatePolicyBody>(request, {
    required: false,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const result = await activateTravelPolicyVersion({
    versionId,
    actorName: guard.user.name,
    effectiveFrom: body.effectiveFrom,
    note: body.note,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.error.code, number> = {
      validation_failed: 422,
      version_not_found: 404,
    };
    return NextResponse.json(
      {
        code: result.error.code,
        message: result.error.message,
      },
      { status: statusByCode[result.error.code] ?? 400 },
    );
  }

  return NextResponse.json(result.result, { status: 200 });
}
