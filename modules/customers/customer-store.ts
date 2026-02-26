import { runMongoCommand, toMongoDate } from "@/lib/mongo-helper";
import type { Customer, CustomerSegment } from "./types";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizeName(value: string): string {
  return value.trim();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "").trim();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function toCustomerKey(name: string, phone: string): string {
  return `${normalizeName(name).toLowerCase()}||${normalizePhone(phone)}`;
}

function toCustomerId(name: string, phone: string): string {
  return `CUST-${hashString(`${normalizeName(name)}-${normalizePhone(phone)}`)
    .toString(16)
    .toUpperCase()
    .slice(0, 8)}`;
}

interface MongoDateLike {
  $date?: string;
}

interface MongoCustomerDocument {
  _id: string;
  name: string;
  phone: string;
  email: string;
  segment: CustomerSegment;
  createdAt?: string | Date | MongoDateLike;
}

interface MongoFindResult<TDocument> {
  cursor?: {
    firstBatch?: TDocument[];
  };
}

interface CreateCustomerInput {
  name: string;
  phone: string;
  email: string;
  segment?: CustomerSegment;
}

interface CreateCustomerSuccess {
  ok: true;
  result: Customer;
}

interface CreateCustomerFailure {
  ok: false;
  error: {
    code: "validation_failed" | "duplicate_customer";
    message: string;
  };
}

export type CreateCustomerResult = CreateCustomerSuccess | CreateCustomerFailure;

const VALID_SEGMENTS = new Set<CustomerSegment>(["starter", "growth", "strategic"]);

const customerByNamePhoneCache = new Map<string, Customer>();
const customerByIdCache = new Map<string, Customer>();

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "$date" in value &&
    typeof (value as MongoDateLike).$date === "string"
  ) {
    return (value as MongoDateLike).$date as string;
  }
  return new Date().toISOString();
}

function mapMongoToCustomer(document: MongoCustomerDocument): Customer {
  return {
    id: document._id,
    name: normalizeName(document.name),
    phone: normalizePhone(document.phone),
    email: normalizeEmail(document.email),
    segment: VALID_SEGMENTS.has(document.segment) ? document.segment : "starter",
    createdAt: toIsoString(document.createdAt),
  };
}

function cacheCustomer(customer: Customer): void {
  customerByIdCache.set(customer.id, customer);
  customerByNamePhoneCache.set(toCustomerKey(customer.name, customer.phone), customer);
}

function cacheCustomers(customers: Customer[]): void {
  for (const customer of customers) {
    cacheCustomer(customer);
  }
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findCustomers(
  filter: Record<string, unknown>,
  limit = 100,
): Promise<Customer[]> {
  const result = await runMongoCommand<MongoFindResult<MongoCustomerDocument>>("customers", "find", {
    filter,
    limit,
    sort: { createdAt: -1 },
  });
  const batch = Array.isArray(result.cursor?.firstBatch) ? result.cursor.firstBatch : [];
  const mapped = batch.map(mapMongoToCustomer);
  cacheCustomers(mapped);
  return mapped;
}

export async function listCustomers(): Promise<Customer[]> {
  const customers = await findCustomers({}, 500);
  return [...customers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function searchCustomers(query: string, limit = 20): Promise<Customer[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return (await listCustomers()).slice(0, Math.max(1, Math.min(limit, 50)));
  }

  const escapedText = escapeRegexLiteral(normalizedQuery);
  const escapedPhone = escapeRegexLiteral(normalizePhone(normalizedQuery));
  const rows = await findCustomers(
    {
      $or: [
        { _id: { $regex: escapedText, $options: "i" } },
        { name: { $regex: escapedText, $options: "i" } },
        { email: { $regex: escapedText, $options: "i" } },
        { phone: { $regex: escapedPhone || escapedText, $options: "i" } },
      ],
    },
    Math.max(1, Math.min(limit, 50)),
  );
  return rows;
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  const normalizedId = id.trim();
  if (!normalizedId) {
    return undefined;
  }
  const cached = customerByIdCache.get(normalizedId);
  if (cached) {
    return cached;
  }
  const rows = await findCustomers({ _id: normalizedId }, 1);
  return rows[0];
}

export function getCustomerByNamePhone(name: string, phone: string): Customer | undefined {
  return customerByNamePhoneCache.get(toCustomerKey(name, phone));
}

export async function findOrCreateCustomer(
  name: string,
  phone: string,
  email: string,
): Promise<Customer> {
  const existing = getCustomerByNamePhone(name, phone);
  if (existing) {
    return existing;
  }

  const created = await createCustomer({
    name,
    phone,
    email,
    segment: "starter",
  });
  if (!created.ok) {
    if (created.error.code === "duplicate_customer") {
      const fallback = await searchCustomers(name, 5);
      const matched = fallback.find(
        (candidate) => toCustomerKey(candidate.name, candidate.phone) === toCustomerKey(name, phone),
      );
      if (matched) {
        return matched;
      }
    }
    throw new Error(created.error.message);
  }
  return created.result;
}

export async function createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
  const name = normalizeName(input.name);
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const segment = input.segment ?? "starter";

  if (!name || !phone || !email) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "name, phone, and email are required.",
      },
    };
  }
  if (!VALID_SEGMENTS.has(segment)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "segment is invalid.",
      },
    };
  }

  const duplicates = await findCustomers(
    {
      $or: [{ phone }, { email }],
    },
    2,
  );
  if (duplicates.some((customer) => normalizePhone(customer.phone) === phone)) {
    return {
      ok: false,
      error: {
        code: "duplicate_customer",
        message: "A customer with this phone already exists.",
      },
    };
  }
  if (duplicates.some((customer) => normalizeEmail(customer.email) === email)) {
    return {
      ok: false,
      error: {
        code: "duplicate_customer",
        message: "A customer with this email already exists.",
      },
    };
  }

  const id = toCustomerId(name, phone);
  const now = new Date();
  const createdAt = now.toISOString();
  const customer: Customer = {
    id,
    name,
    phone,
    email,
    segment,
    createdAt,
  };

  try {
    await runMongoCommand("customers", "insert", {
      documents: [
        {
          _id: id,
          name,
          phone,
          email,
          segment,
          createdAt: toMongoDate(now),
          updatedAt: toMongoDate(now),
        },
      ],
    });
  } catch {
    const existing = await findCustomers({ _id: id }, 1);
    if (existing.length > 0) {
      return {
        ok: false,
        error: {
          code: "duplicate_customer",
          message: "A customer with this name and phone already exists.",
        },
      };
    }
    throw new Error("Unable to create customer record.");
  }

  cacheCustomer(customer);
  return { ok: true, result: customer };
}

export function resolveCustomerIdFromBooking(
  customerName: string,
  customerPhone: string,
): string | undefined {
  const cached = customerByNamePhoneCache.get(toCustomerKey(customerName, customerPhone));
  if (cached) {
    return cached.id;
  }
  const normalizedName = normalizeName(customerName);
  const normalizedPhone = normalizePhone(customerPhone);
  if (!normalizedName || !normalizedPhone) {
    return undefined;
  }
  return toCustomerId(normalizedName, normalizedPhone);
}

export { toCustomerId };
