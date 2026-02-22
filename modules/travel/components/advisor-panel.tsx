import { AlertCircle, CheckCircle, Info, TrendingUp, AlertTriangle } from "lucide-react";
import { useLocale } from "next-intl";
import { DEFAULT_TRAVEL_POLICY } from "@/modules/travel/policy/travel-policy-engine";
import { getPolicyRecommendations, type PolicyRecommendationInput } from "@/modules/travel/policy/policy-advisor";

interface AdvisorPanelProps {
    input: PolicyRecommendationInput;
}

export function AdvisorPanel({ input }: AdvisorPanelProps) {
    const locale = useLocale();

    const recommendations = getPolicyRecommendations(input, DEFAULT_TRAVEL_POLICY, locale);

    if (recommendations.length === 0) {
        return null;
    }

    return (
        <section className="mt-4 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <TrendingUp className="w-24 h-24" />
            </div>

            <header className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100/80 text-indigo-600">
                    <TrendingUp className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                    {locale === "ar" ? "المستشار الذكي" : "Smart Advisor"}
                </h3>
                <span className="ml-auto text-[10px] font-medium tracking-wider text-indigo-500 uppercase bg-indigo-50 px-2 py-0.5 rounded-full">
                    AI Powered
                </span>
            </header>

            <div className="grid gap-2">
                {recommendations.map((rec, idx) => {
                    const isDanger = rec.type === "danger";
                    const isWarning = rec.type === "warning";
                    const isSuccess = rec.type === "success";

                    const Icon = isDanger ? AlertCircle : isWarning ? AlertTriangle : isSuccess ? CheckCircle : Info;

                    const baseClass = isDanger
                        ? "border-rose-200 bg-rose-50/50 text-rose-800"
                        : isWarning
                            ? "border-amber-200 bg-amber-50/50 text-amber-800"
                            : isSuccess
                                ? "border-emerald-200 bg-emerald-50/50 text-emerald-800"
                                : "border-slate-200 bg-slate-50/50 text-slate-700";

                    const iconClass = isDanger
                        ? "text-rose-500"
                        : isWarning
                            ? "text-amber-500"
                            : isSuccess
                                ? "text-emerald-500"
                                : "text-slate-500";

                    return (
                        <article
                            key={idx}
                            className={`flex items-start gap-3 rounded-lg border p-3 transition-all hover:bg-white ${baseClass}`}
                        >
                            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
                            <div className="flex-1">
                                <h4 className="text-xs font-bold mb-0.5">{rec.title}</h4>
                                <p className="text-[11px] leading-relaxed opacity-90">{rec.message}</p>
                                {rec.actionable && (
                                    <p className="mt-1.5 text-[11px] font-medium flex items-center gap-1.5 opacity-100">
                                        <span className="w-1 h-1 rounded-full bg-current opacity-50 block" />
                                        {rec.actionable}
                                    </p>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
