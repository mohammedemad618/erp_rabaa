import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { TemplateVersionPayload } from "@/modules/templates/types";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";
import {
  createTemplateVersion,
  listTemplateVersions,
} from "@/services/template-engine-store";

interface CreateVersionBody {
  title?: string;
  payload?: TemplateVersionPayload;
  schemaVersion?: number;
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

  return NextResponse.json(await listTemplateVersions(templateId), { status: 200 });
}

export async function POST(
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

  const parsedBody = await parseJsonBodySafe<CreateVersionBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  if (!body.title) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "title is required.",
      },
      { status: 422 },
    );
  }

  const result = await createTemplateVersion({
    templateId,
    actorName: guard.user.name,
    title: body.title,
    payload: body.payload,
    schemaVersion: body.schemaVersion,
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

  return NextResponse.json(result.result, { status: 201 });
}
