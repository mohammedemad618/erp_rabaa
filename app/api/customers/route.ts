import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createCustomer, listCustomers } from "@/modules/customers/customer-store";
import type { CustomerSegment } from "@/modules/customers/types";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";

interface CreateCustomerBody {
  name: string;
  phone: string;
  email: string;
  segment?: CustomerSegment;
}

export async function GET() {
  const guard = await requireApiPermission("crm.view");
  if (!guard.ok) {
    return guard.response;
  }

  return NextResponse.json(await listCustomers(), { status: 200 });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("crm.view");
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBodySafe<CreateCustomerBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;
  const result = await createCustomer({
    name: body.name ?? "",
    phone: body.phone ?? "",
    email: body.email ?? "",
    segment: body.segment,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        code: result.error.code,
        message: result.error.message,
      },
      { status: 422 },
    );
  }

  return NextResponse.json(result.result, { status: 201 });
}
