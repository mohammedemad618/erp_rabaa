import { ErpPageLayout, ErpPageHeader, ErpKpiGrid } from "@/components/layout/erp-page-layout";

export default function AccountingLoading() {
    return (
        <ErpPageLayout>
            <ErpPageHeader
                title="Accounting"
                description="Loading accounting data..."
                actions={
                    <div className="h-9 w-32 animate-pulse rounded-md bg-slate-200" />
                }
            />

            {/* KPI Skeletons */}
            <ErpKpiGrid>
                {[...Array(4)].map((_, i) => (
                    <article key={i} className="surface-card p-4">
                        <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                        <div className="mt-4 h-6 w-24 animate-pulse rounded bg-slate-200" />
                    </article>
                ))}
            </ErpKpiGrid>

            {/* Layout Grid Skeleton */}
            <div className="col-span-12 grid grid-cols-1 gap-4 lg:grid-cols-4">
                {/* Table/List View Skeleton */}
                <div className="surface-card lg:col-span-3 flex h-[600px] flex-col overflow-hidden rounded-lg border border-border shadow-sm">
                    <div className="border-b border-border p-4">
                        <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
                    </div>
                    <div className="flex-1 p-4">
                        <div className="space-y-4">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="h-4 w-12 animate-pulse rounded bg-slate-200" />
                                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                                    <div className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
                                    <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Side Panel Skeleton */}
                <div className="surface-card flex h-[600px] flex-col overflow-hidden rounded-lg border border-border shadow-sm p-4">
                    <div className="h-5 w-32 mb-6 animate-pulse rounded bg-slate-200" />
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="space-y-2">
                                <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                                <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </ErpPageLayout>
    );
}
