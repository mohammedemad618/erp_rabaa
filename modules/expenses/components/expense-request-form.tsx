"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import type { Department, ExpenseDataset } from "../types";

const departmentValues: Department[] = ["sales", "operations", "finance", "it", "hr"];
const paymentMethodValues = ["cash", "card", "bank"] as const;

const formSchema = z.object({
    date: z.string().min(4),
    department: z.enum(["sales", "operations", "finance", "it", "hr"]),
    costCenterId: z.string().min(3),
    category: z.string().min(2),
    description: z.string().min(5),
    vendor: z.string().min(2),
    employee: z.string().min(2),
    amount: z.number().positive(),
    paymentMethod: z.enum(["cash", "card", "bank"]),
});

export type ExpenseFormValues = z.infer<typeof formSchema>;

interface ExpenseRequestFormProps {
    dataset: ExpenseDataset;
    onSubmit: (values: ExpenseFormValues) => void;
    onCancel: () => void;
    // Translation function passed from the parent
    t: (key: string) => string;
}

export function ExpenseRequestForm({ dataset, onSubmit, onCancel, t }: ExpenseRequestFormProps) {
    const form = useForm<ExpenseFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            date: new Date().toISOString().slice(0, 10),
            department: "operations",
            costCenterId:
                dataset.costCenters.find((center) => center.department === "operations")?.id ??
                dataset.costCenters[0]?.id ??
                "",
            category: dataset.categories[0] ?? "Office Supplies",
            description: "",
            vendor: "",
            employee: "",
            amount: 0,
            paymentMethod: "bank",
        },
    });

    // eslint-disable-next-line react-hooks/incompatible-library
    const watchedDepartment = form.watch("department");
    const departmentCenters = dataset.costCenters.filter((center) => center.department === watchedDepartment);

    function handleSubmit(values: ExpenseFormValues) {
        onSubmit(values);
        // Parent handle resets or redirects
    }

    return (
        <form className="space-y-5" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-finance border-b border-border pb-2">{t("entry.title")}</h3>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-xs font-medium text-slate-700">
                        {t("entry.date")}
                        <input
                            type="date"
                            {...form.register("date")}
                            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </label>

                    <label className="text-xs font-medium text-slate-700">
                        {t("entry.department")}
                        <select
                            value={watchedDepartment}
                            onChange={(event) => {
                                const department = event.target.value as Department;
                                form.setValue("department", department, {
                                    shouldValidate: true,
                                });
                                const firstCenter = dataset.costCenters.find(
                                    (center) => center.department === department,
                                );
                                if (firstCenter) {
                                    form.setValue("costCenterId", firstCenter.id, {
                                        shouldValidate: true,
                                    });
                                }
                            }}
                            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                        >
                            {departmentValues.map((department) => (
                                <option key={department} value={department}>
                                    {t(`departments.${department}`)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-xs font-medium text-slate-700">
                        {t("entry.costCenter")}
                        <select
                            value={form.watch("costCenterId")}
                            onChange={(event) =>
                                form.setValue("costCenterId", event.target.value, {
                                    shouldValidate: true,
                                })
                            }
                            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                        >
                            {departmentCenters.map((center) => (
                                <option key={center.id} value={center.id}>
                                    {center.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="text-xs font-medium text-slate-700">
                        {t("entry.category")}
                        <select
                            {...form.register("category")}
                            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                        >
                            {dataset.categories.map((category) => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <label className="block text-xs font-medium text-slate-700">
                    {t("entry.description")}
                    <input
                        type="text"
                        {...form.register("description")}
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="E.g. Client Dinner at Riyadh Hotel"
                    />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-xs font-medium text-slate-700">
                        {t("entry.vendor")}
                        <input
                            type="text"
                            {...form.register("vendor")}
                            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </label>

                    <label className="text-xs font-medium text-slate-700">
                        {t("entry.employee")}
                        <input
                            type="text"
                            {...form.register("employee")}
                            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-xs font-medium text-slate-700">
                        {t("entry.amount")}
                        <input
                            type="number"
                            step="0.01"
                            {...form.register("amount", { valueAsNumber: true })}
                            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </label>

                    <label className="text-xs font-medium text-slate-700">
                        {t("entry.paymentMethod")}
                        <select
                            {...form.register("paymentMethod")}
                            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                        >
                            {paymentMethodValues.map((paymentMethod) => (
                                <option key={paymentMethod} value={paymentMethod}>
                                    {t(`paymentMethods.${paymentMethod}`)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" className="flex-1">
                    {t("entry.submit")}
                </Button>
            </div>
        </form>
    );
}
