import { redirect } from "next/navigation";
import { requirePermission } from "@/services/auth/server-guards";

interface LegacyOperationsCreatePageProps {
  params: Promise<{ locale: string }>;
}

export default async function LegacyOperationsCreatePage({
  params,
}: LegacyOperationsCreatePageProps) {
  const { locale } = await params;
  await requirePermission(locale, "travel.create", `/${locale}/operations/new`);
  redirect(`/${locale}/travel/create`);
}
