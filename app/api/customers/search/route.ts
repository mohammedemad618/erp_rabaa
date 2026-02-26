import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { searchCustomers } from "@/modules/customers/customer-store";
import { requireApiPermission } from "@/services/auth/api-guards";

function parseLimit(raw: string | null): number {
  if (!raw) {
    return 20;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.max(1, Math.min(Math.floor(parsed), 50));
}

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("travel.view");
  if (!guard.ok) {
    return guard.response;
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const customers = await searchCustomers(query, limit);
  return NextResponse.json(customers, { status: 200 });
}
