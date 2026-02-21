import assert from "node:assert/strict";
import test from "node:test";
import type { NextRequest } from "next/server";
import { POST as loginPost } from "../app/api/auth/login/route";
import { parseJsonBodySafe } from "../services/http/request-body";

test("login API returns 400 when body is invalid JSON", async () => {
  const request = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{",
  });

  const response = await loginPost(request as unknown as NextRequest);
  assert.equal(response.status, 400);

  const payload = (await response.json()) as { code?: string; message?: string };
  assert.equal(payload.code, "invalid_json");
  assert.match(payload.message ?? "", /valid json/i);
});

test("JSON parser returns empty object for optional empty body", async () => {
  const request = new Request("http://localhost/api/optional", {
    method: "POST",
  });

  const parsed = await parseJsonBodySafe<Record<string, unknown>>(request, {
    required: false,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("Expected parsing to succeed for optional body.");
  }

  assert.deepEqual(parsed.data, {});
});

test("JSON parser rejects required empty body", async () => {
  const request = new Request("http://localhost/api/required", {
    method: "POST",
  });

  const parsed = await parseJsonBodySafe(request);
  assert.equal(parsed.ok, false);
  if (parsed.ok) {
    throw new Error("Expected parsing to fail for required body.");
  }

  assert.equal(parsed.response.status, 400);
  const payload = (await parsed.response.json()) as { code?: string; message?: string };
  assert.equal(payload.code, "invalid_json");
  assert.match(payload.message ?? "", /valid json/i);
});
