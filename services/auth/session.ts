import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthenticatedUser, SessionPayload } from "@/services/auth/types";

const SESSION_TTL_SECONDS = 60 * 60 * 10;
const SECRET_FALLBACK = "enterprise-travel-erp-local-session-secret";

function getSessionSecret(): string {
  const configuredSecret = process.env.AUTH_SESSION_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return SECRET_FALLBACK;
  }

  throw new Error("AUTH_SESSION_SECRET must be configured in production.");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(user: AuthenticatedUser): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    ...user,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  };
  const payloadB64 = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return null;
  }

  const expected = signPayload(payloadB64);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== signatureBuffer.length) {
    return null;
  }
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  const decoded = decodeBase64Url(payloadB64);
  if (!decoded) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(decoded) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload?.id || !payload?.name || !payload?.email || !payload?.role) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) {
    return null;
  }

  return payload;
}

export function getSessionCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
