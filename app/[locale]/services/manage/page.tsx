import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { ServiceCategoriesManager } from "@/modules/services/components/service-categories-manager";
import { requirePermission } from "@/services/auth/server-guards";
import { listServiceCategories } from "@/modules/services/service-category-store";
import { getServiceCategoryBookingCounts } from "@/modules/services/service-category-usage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ServiceCategoriesManagePage({ params }: PageProps) {
  const { locale } = await params;
  await requirePermission(locale, "settings.manage", `/${locale}`);

  const usageCounts = await getServiceCategoryBookingCounts();
  const categories = listServiceCategories().map((c) => ({
    ...c,
    bookingCount: usageCounts[c.id] ?? 0,
  }));

  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <ServiceCategoriesManager initialCategories={categories} />
      </div>
    </ErpPageLayout>
  );
}
