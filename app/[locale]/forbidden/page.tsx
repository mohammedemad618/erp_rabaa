import { Link } from "@/i18n/navigation";
import { ShieldX, Home, ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function ForbiddenPage() {
  const tForbidden = await getTranslations("forbidden");

  return (
    <section className="surface-card flex flex-col items-center justify-center p-10 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
        <ShieldX className="h-8 w-8 text-rose-500" />
      </div>
      <h2 className="text-2xl font-extrabold tracking-tight text-finance">{tForbidden("title")}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{tForbidden("description")}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-blue-700"
        >
          <Home className="h-4 w-4" />
          {tForbidden("backToDashboard")}
        </Link>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-5 text-sm font-semibold text-finance shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {tForbidden("goBack") ?? "Go Back"}
        </button>
      </div>
    </section>
  );
}
