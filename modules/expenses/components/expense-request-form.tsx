"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
                    <FormField label={t("entry.date")} required>
                        <Input type="date" {...form.register("date")} />
                    </FormField>
                    <FormField label={t("entry.department")} required>
                        <Select
                            value={watchedDepartment}
                            onChange={(event) => {
                                const department = event.target.value as Department;
                                form.setValue("department", department, { shouldValidate: true });
                                const firstCenter = dataset.costCenters.find(
                                    (center) => center.department === department,
                                );
                                if (firstCenter) {
                                    form.setValue("costCenterId", firstCenter.id, { shouldValidate: true });
                                }
                            }}
                        >
                            {departmentValues.map((department) => (
                                <option key={department} value={department}>
                                    {t(`departments.${department}`)}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <FormField label={t("entry.costCenter")} required>
                        <Select
                            value={form.watch("costCenterId")}
                            onChange={(event) =>
                                form.setValue("costCenterId", event.target.value, { shouldValidate: true })
                            }
                        >
                            {departmentCenters.map((center) => (
                                <option key={center.id} value={center.id}>
                                    {center.name}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField label={t("entry.category")} required>
                        <Select {...form.register("category")}>
                            {dataset.categories.map((category) => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                </div>

                <FormField label={t("entry.description")} required hint="E.g. Client Dinner at Riyadh Hotel">
                    <Input type="text" {...form.register("description")} placeholder="E.g. Client Dinner at Riyadh Hotel" />
                </FormField>

                <div className="grid gap-4 md:grid-cols-2">
                    <FormField label={t("entry.vendor")} required>
                        <Input type="text" {...form.register("vendor")} />
                    </FormField>
                    <FormField label={t("entry.employee")} required>
                        <Input type="text" {...form.register("employee")} />
                    </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <FormField label={t("entry.amount")} required>
                        <Input type="number" step={0.01} {...form.register("amount", { valueAsNumber: true })} />
                    </FormField>
                    <FormField label={t("entry.paymentMethod")} required>
                        <Select {...form.register("paymentMethod")}>
                            {paymentMethodValues.map((paymentMethod) => (
                                <option key={paymentMethod} value={paymentMethod}>
                                    {t(`paymentMethods.${paymentMethod}`)}
                                </option>
                            ))}
                        </Select>
                    </FormField>
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
