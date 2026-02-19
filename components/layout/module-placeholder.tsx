import { getTranslations } from "next-intl/server";

interface ModulePlaceholderProps {
  title: string;
  description: string;
}

export async function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  const tCommon = await getTranslations("common");

  return (
    <section className="surface-card p-6">
      <h2 className="text-xl font-semibold text-finance">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <p className="mt-4 rounded-md border border-dashed border-border bg-slate-50 p-3 text-sm text-muted-foreground">
        {tCommon("moduleUnderConstruction")}
      </p>
    </section>
  );
}
