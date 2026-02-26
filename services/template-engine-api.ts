import type {
  TemplateDefinitionRecord,
  TemplateVersionPayload,
  TemplateVersionRecord,
} from "@/modules/templates/types";

interface ApiErrorPayload {
  message?: string;
}

interface ActivateTemplateVersionResponse {
  template: TemplateDefinitionRecord;
  version: TemplateVersionRecord;
}

interface CreateTemplateVersionPayload {
  templateId: string;
  title: string;
  payload: TemplateVersionPayload;
  schemaVersion?: number;
  note?: string;
}

interface ActivateTemplateVersionPayload {
  templateId: string;
  versionId: string;
  note?: string;
}

interface UpdateTemplatePayload {
  templateId: string;
  name?: string;
  description?: string;
  outputKind?: "print" | "pdf" | "email";
  tags?: string[];
  archived?: boolean;
  note?: string;
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.text();
  let payload: unknown = null;
  if (raw.trim().length > 0) {
    try {
      payload = JSON.parse(raw) as T | ApiErrorPayload;
    } catch {
      payload = { message: raw.trim() } satisfies ApiErrorPayload;
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as ApiErrorPayload).message === "string"
        ? (payload as ApiErrorPayload).message ?? fallbackMessage
        : fallbackMessage;
    throw new Error(message);
  }

  if (!payload) {
    throw new Error(fallbackMessage);
  }
  return payload as T;
}

export async function fetchTemplatesApi(): Promise<TemplateDefinitionRecord[]> {
  const response = await fetch("/api/templates", {
    method: "GET",
    cache: "no-store",
  });
  return parseApiResponse<TemplateDefinitionRecord[]>(response, "Unable to fetch templates.");
}

export async function fetchTemplateVersionsApi(templateId: string): Promise<TemplateVersionRecord[]> {
  const response = await fetch(`/api/templates/${templateId}/versions`, {
    method: "GET",
    cache: "no-store",
  });
  return parseApiResponse<TemplateVersionRecord[]>(
    response,
    "Unable to fetch template versions.",
  );
}

export async function updateTemplateApi(payload: UpdateTemplatePayload): Promise<TemplateDefinitionRecord> {
  const response = await fetch(`/api/templates/${payload.templateId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: payload.name,
      description: payload.description,
      outputKind: payload.outputKind,
      tags: payload.tags,
      archived: payload.archived,
      note: payload.note,
    }),
  });
  return parseApiResponse<TemplateDefinitionRecord>(response, "Unable to update template.");
}

export async function createTemplateVersionApi(
  payload: CreateTemplateVersionPayload,
): Promise<TemplateVersionRecord> {
  const response = await fetch(`/api/templates/${payload.templateId}/versions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: payload.title,
      payload: payload.payload,
      schemaVersion: payload.schemaVersion,
      note: payload.note,
    }),
  });
  return parseApiResponse<TemplateVersionRecord>(
    response,
    "Unable to create template draft version.",
  );
}

export async function activateTemplateVersionApi(
  payload: ActivateTemplateVersionPayload,
): Promise<ActivateTemplateVersionResponse> {
  const response = await fetch(
    `/api/templates/${payload.templateId}/versions/${payload.versionId}/activate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        note: payload.note,
      }),
    },
  );
  return parseApiResponse<ActivateTemplateVersionResponse>(
    response,
    "Unable to activate template version.",
  );
}
