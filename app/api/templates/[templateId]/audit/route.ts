import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { listTemplateAuditEvents } from "@/services/template-engine-store";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ templateId: string }> },
) {
  const guard = await requireApiPermission("templates.view");
  if (!guard.ok) {
    return guard.response;
  }

  const { templateId } = await context.params;
  if (!templateId) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "templateId is required.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(await listTemplateAuditEvents(templateId), { status: 200 });
}
