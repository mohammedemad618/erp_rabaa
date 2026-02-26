import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { activateTemplateVersion } from "@/services/template-engine-store";

interface ActivateVersionBody {
  note?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ templateId: string; versionId: string }> },
) {
  const guard = await requireApiPermission("templates.manage");
  if (!guard.ok) {
    return guard.response;
  }

  const { templateId, versionId } = await context.params;
  if (!templateId || !versionId) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "templateId and versionId are required.",
      },
      { status: 400 },
    );
  }

  const parsedBody = await parseJsonBodySafe<ActivateVersionBody>(request, {
    required: false,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const result = await activateTemplateVersion({
    templateId,
    versionId,
    actorName: guard.user.name,
    note: parsedBody.data.note,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.error.code, number> = {
      validation_failed: 422,
      template_not_found: 404,
      version_not_found: 404,
      conflict: 409,
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
