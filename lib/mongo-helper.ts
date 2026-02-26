import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface RawCommandCapableClient {
  $runCommandRaw(command: Record<string, unknown>): Promise<unknown>;
}

/**
 * A safe wrapper for MongoDB raw commands to ensure type safety and centralized handling.
 * This is used to perform operations that might otherwise require a Replica Set
 * when using standard Prisma methods (e.g. nested writes or transactions),
 * allowing the application to function on standalone MongoDB instances.
 */
export async function runMongoCommand<T = unknown>(
  collection: string,
  command: "insert" | "update" | "delete" | "find",
  payload: Record<string, unknown>
): Promise<T> {
  try {
    const rawClient = prisma as unknown as RawCommandCapableClient;
    const result = await rawClient.$runCommandRaw({
      [command]: collection,
      ...payload,
    });
    return result as T;
  } catch (error) {
    console.error(`[MongoHelper] Command '${command}' on '${collection}' failed:`, error);
    throw error;
  }
}

/**
 * Helper to format Dates for MongoDB Extended JSON (EJSON)
 * usage: { createdAt: toMongoDate(new Date()) }
 */
export function toMongoDate(date: Date | string): { $date: string } {
  const d = typeof date === "string" ? new Date(date) : date;
  return { $date: d.toISOString() };
}

/**
 * Helper to generate a new ObjectId string if needed (though we mostly use custom IDs)
 */
// export function newObjectId(): string { ... }
