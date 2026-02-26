import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type {
  TemplateOutputKind,
  TemplateScope,
  TemplateVersionPayload,
} from "@/modules/templates/types";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { createTemplate, listTemplates } from "@/services/template-engine-store";

interface CreateTemplateBody {
  slug?: string;
  scope?: TemplateScope;
  name?: string;
  description?: string;
  outputKind?: TemplateOutputKind;
  tags?: string[];
  initialVersionTitle?: string;
  initialPayload?: TemplateVersionPayload;
  note?: string;
}

export async function GET() {
  const guard = await requireApiPermission("templates.view");
  if (!guard.ok) {
    return guard.response;
  }
  return NextResponse.json(await listTemplates(), { status: 200 });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("templates.manage");
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBodySafe<CreateTemplateBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  if (!body.slug || !body.scope || !body.name) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "slug, scope and name are required.",
      },
      { status: 422 },
    );
  }

  const result = await createTemplate({
    actorName: guard.user.name,
    slug: body.slug,
    scope: body.scope,
    name: body.name,
    description: body.description,
    outputKind: body.outputKind,
    tags: body.tags,
    initialVersionTitle: body.initialVersionTitle,
    initialPayload: body.initialPayload,
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
