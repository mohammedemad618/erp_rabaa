import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { TravelPolicyEditableConfig } from "@/modules/travel/policy/types";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { createTravelPolicyDraft, listTravelPolicyVersions } from "@/services/travel-policy-store";

interface CreatePolicyDraftBody {
  config?: TravelPolicyEditableConfig;
  note?: string;
}

export async function GET() {
  const guard = await requireApiPermission("travel.policy.view");
  if (!guard.ok) {
    return guard.response;
  }
  return NextResponse.json(listTravelPolicyVersions(), { status: 200 });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("travel.policy.manage");
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBodySafe<CreatePolicyDraftBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  if (!body.config) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "config is required.",
      },
      { status: 422 },
    );
  }

  const result = createTravelPolicyDraft({
    actorName: guard.user.name,
    config: body.config,
    note: body.note,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        code: result.error.code,
        message: result.error.message,
      },
      { status: 422 },
    );
  }

  return NextResponse.json(result.result, { status: 201 });
}
