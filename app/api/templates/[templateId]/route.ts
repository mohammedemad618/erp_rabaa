import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { TemplateOutputKind } from "@/modules/templates/types";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { getTemplate, updateTemplate } from "@/services/template-engine-store";

interface UpdateTemplateBody {
  name?: string;
  description?: string;
  outputKind?: TemplateOutputKind;
  tags?: string[];
  archived?: boolean;
  note?: string;
}

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

  const template = await getTemplate(templateId);
  if (!template) {
    return NextResponse.json(
      {
        code: "template_not_found",
        message: "Template not found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json(template, { status: 200 });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> },
) {
  const guard = await requireApiPermission("templates.manage");
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

  const parsedBody = await parseJsonBodySafe<UpdateTemplateBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const result = await updateTemplate({
    templateId,
    actorName: guard.user.name,
    name: body.name,
    description: body.description,
    outputKind: body.outputKind,
    tags: body.tags,
    archived: body.archived,
    note: body.note,
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
