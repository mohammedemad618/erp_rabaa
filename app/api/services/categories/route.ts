import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { getServiceCategoryBookingCounts } from "@/modules/services/service-category-usage";
import {
  listServiceCategories,
  addServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  type AddServiceCategoryInput,
  type UpdateServiceCategoryInput,
} from "@/modules/services/service-category-store";

export async function GET() {
  const guard = await requireApiPermission("dashboard.view");
  if (!guard.ok) return guard.response;

  const usageCounts = await getServiceCategoryBookingCounts();
  const categories = listServiceCategories().map((c) => ({
    ...c,
    bookingCount: usageCounts[c.id] ?? 0,
  }));
  return NextResponse.json(categories, { status: 200 });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("settings.manage");
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBodySafe<AddServiceCategoryInput>(request);
  if (!parsed.ok) return parsed.response;

  const { labelEn, labelAr, descriptionEn, descriptionAr, icon, color, bgColor } = parsed.data;
  if (!labelEn?.trim() || !labelAr?.trim()) {
    return NextResponse.json({ code: "validation_failed", message: "labelEn and labelAr are required." }, { status: 422 });
  }

  try {
    const created = addServiceCategory({
      labelEn: labelEn.trim(),
      labelAr: labelAr.trim(),
      descriptionEn: (descriptionEn ?? "").trim(),
      descriptionAr: (descriptionAr ?? "").trim(),
      icon: (icon ?? "globe").trim(),
      color: (color ?? "text-slate-600").trim(),
      bgColor: (bgColor ?? "bg-slate-50").trim(),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ code: "conflict", message: (err as Error).message }, { status: 409 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireApiPermission("settings.manage");
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBodySafe<UpdateServiceCategoryInput>(request);
  if (!parsed.ok) return parsed.response;

  if (!parsed.data.id?.trim()) {
    return NextResponse.json({ code: "validation_failed", message: "id is required." }, { status: 422 });
  }

  try {
    const updated = updateServiceCategory({
      ...parsed.data,
      id: parsed.data.id.trim(),
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return NextResponse.json({ code: "not_found", message: (err as Error).message }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireApiPermission("settings.manage");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id?.trim()) {
    return NextResponse.json({ code: "validation_failed", message: "id query param is required." }, { status: 422 });
  }

  const result = deleteServiceCategory(id.trim());
  if (!result.ok) {
    return NextResponse.json({ code: "delete_blocked", message: result.reason }, { status: 409 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
