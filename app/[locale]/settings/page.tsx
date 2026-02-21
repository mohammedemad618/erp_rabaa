import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { SettingsConsole } from "@/modules/settings/components/settings-console";
import { requirePermission } from "@/services/auth/server-guards";

interface SettingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "settings.view", `/${locale}/settings`);
  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <SettingsConsole />
      </div>
    </ErpPageLayout>
  );
}
