import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const DB_HEALTH_TIMEOUT_MS = 10000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("db_timeout"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function getErrorInfo(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Unknown database error",
    };
  }
  return {
    name: "UnknownError",
    message: "Unknown database error",
  };
}

export async function GET() {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        service: "db",
        code: "missing_database_url",
        message: "DATABASE_URL is not configured.",
        timestamp,
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    await withTimeout(
      prisma.user.findFirst({
        select: { id: true },
      }),
      DB_HEALTH_TIMEOUT_MS,
    );

    return NextResponse.json(
      {
        ok: true,
        service: "db",
        timestamp,
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const details = getErrorInfo(error);
    return NextResponse.json(
      {
        ok: false,
        service: "db",
        code: "db_unavailable",
        message: "Database connectivity check failed.",
        details,
        timestamp,
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
