import { redirect } from "next/navigation";
import { requirePermission } from "@/services/auth/server-guards";

interface TransactionsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TransactionsPage({ params }: TransactionsPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "transactions.view", `/${locale}/transactions`);
  redirect(`/${locale}/operations?type=transactions`);
}
