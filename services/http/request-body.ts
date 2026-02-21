import { NextResponse } from "next/server";

interface ParseJsonBodyOptions {
  required?: boolean;
  message?: string;
  code?: string;
}

interface ParseJsonBodySuccess<TBody> {
  ok: true;
  data: TBody;
}

interface ParseJsonBodyFailure {
  ok: false;
  response: NextResponse;
}

export type ParseJsonBodyResult<TBody> = ParseJsonBodySuccess<TBody> | ParseJsonBodyFailure;

function hasRequestBody(request: Request): boolean {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const numericLength = Number(contentLength);
    if (Number.isFinite(numericLength) && numericLength > 0) {
      return true;
    }
  }
  return Boolean(request.headers.get("transfer-encoding"));
}

function invalidJsonResponse(code: string, message: string): NextResponse {
  return NextResponse.json(
    {
      code,
      message,
    },
    { status: 400 },
  );
}

export async function parseJsonBodySafe<TBody extends object = Record<string, unknown>>(
  request: Request,
  options: ParseJsonBodyOptions = {},
): Promise<ParseJsonBodyResult<TBody>> {
  const required = options.required ?? true;
  const code = options.code ?? "invalid_json";
  const message = options.message ?? "Request body must be valid JSON.";

  if (!hasRequestBody(request)) {
    if (!required) {
      return {
        ok: true,
        data: {} as TBody,
      };
    }
    return {
      ok: false,
      response: invalidJsonResponse(code, message),
    };
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      response: invalidJsonResponse(code, message),
    };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      response: invalidJsonResponse(code, message),
    };
  }

  return {
    ok: true,
    data: payload as TBody,
  };
}
