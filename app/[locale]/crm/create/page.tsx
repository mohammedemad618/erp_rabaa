import { ErpPageHeader, ErpPageLayout } from "@/components/layout/erp-page-layout";
import { CrmCreateCustomerForm } from "@/modules/crm/components/crm-create-customer-form";
import { requirePermission } from "@/services/auth/server-guards";

export const dynamic = "force-dynamic";

interface CrmCreatePageProps {
  params: Promise<{ locale: string }>;
}

export default async function CrmCreatePage({ params }: CrmCreatePageProps) {
  const { locale } = await params;
  await requirePermission(locale, "crm.view", `/${locale}/crm/create`);

  const isAr = locale === "ar";
  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={isAr ? "إنشاء عميل جديد" : "Create New Customer"}
        description={
          isAr
            ? "أضف ملف عميل جديد ليظهر مباشرة في CRM ويمكن ربطه بطلبات السفر."
            : "Add a new customer profile to appear in CRM and be linkable to travel requests."
        }
      />
      <CrmCreateCustomerForm />
    </ErpPageLayout>
  );
}
