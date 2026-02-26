import { NextResponse } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { exportTravelAuditCsv } from "@/services/travel-request-store";

export async function GET() {
  const guard = await requireApiPermission("travel.audit_export");
  if (!guard.ok) {
    return guard.response;
  }

  const csv = await exportTravelAuditCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="travel-audit-report.csv"',
      "Cache-Control": "no-store",
    },
  });
}
