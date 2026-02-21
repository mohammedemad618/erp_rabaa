"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ErpKpiGrid,
  ErpMainSplit,
  ErpPageHeader,
  ErpPageLayout,
  ErpSection,
} from "@/components/layout/erp-page-layout";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/format";
import type {
  Department,
  ExpenseDataset,
  ExpenseRecord,
  ExpenseRouteStep,
  ExpenseStatus,
} from "../types";

const departmentValues: Department[] = ["sales", "operations", "finance", "it", "hr"];
const statusValues: Array<ExpenseStatus | "all"> = [
  "all",
  "draft",
  "pending_manager",
  "pending_finance",
  "approved",
  "rejected",
];

const paymentMethodValues = ["cash", "card", "bank"] as const;
const EXPENSES_STORAGE_KEY = "enterprise-travel-erp.expenses.v1";

const formSchema = z.object({
  date: z.string().min(4),
  department: z.enum(departmentValues),
  costCenterId: z.string().min(3),
  category: z.string().min(2),
  description: z.string().min(5),
  vendor: z.string().min(2),
  employee: z.string().min(2),
  amount: z.number().positive(),
  paymentMethod: z.enum(paymentMethodValues),
});

type ExpenseFormValues = z.infer<typeof formSchema>;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toLower(value: string): string {
  return value.trim().toLowerCase();
}

function nextExpenseCounter(rows: ExpenseRecord[]): number {
  let max = 0;
  for (const row of rows) {
    const digits = row.id.match(/\d+/g);
    if (!digits) {
      continue;
    }
    const candidate = Number(digits.join(""));
    if (Number.isFinite(candidate) && candidate > max) {
      max = candidate;
    }
  }
  return max > 0 ? max + 1 : rows.length + 1;
}

function buildInitialRoute(employee: string, date: string): ExpenseRouteStep[] {
  return [
    {
      id: "rt-1",
      role: "Requester",
      actor: employee,
      status: "approved",
      at: date,
      note: "Expense submitted",
    },
    {
      id: "rt-2",
      role: "Department Manager",
      actor: "Department Manager",
      status: "pending",
      note: "Awaiting manager review",
    },
    {
      id: "rt-3",
      role: "Finance Controller",
      actor: "Finance Controller",
      status: "pending",
      note: "Awaiting finance validation",
    },
  ];
}

function statusClass(status: ExpenseStatus): string {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "rejected") {
    return "bg-rose-100 text-rose-700";
  }
  if (status === "pending_manager" || status === "pending_finance") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

interface ExpensesConsoleProps {
  dataset: ExpenseDataset;
}

export function ExpensesConsole({ dataset }: ExpensesConsoleProps) {
  const tExpenses = useTranslations("expenseModule");
  const locale = useLocale();
  const idCounter = useRef(dataset.expenses.length + 1);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(dataset.expenses);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<Department | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "all">("all");
  const [selectedExpenseId, setSelectedExpenseId] = useState(
    dataset.expenses[0]?.id ?? "",
  );
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(EXPENSES_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        expenses?: ExpenseRecord[];
        selectedExpenseId?: string;
      };
      if (!Array.isArray(parsed.expenses) || parsed.expenses.length === 0) {
        return;
      }
      setExpenses(parsed.expenses);
      setSelectedExpenseId(parsed.selectedExpenseId ?? parsed.expenses[0]?.id ?? "");
      idCounter.current = nextExpenseCounter(parsed.expenses);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        EXPENSES_STORAGE_KEY,
        JSON.stringify({ expenses, selectedExpenseId }),
      );
    } catch {
      return;
    }
  }, [expenses, selectedExpenseId]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    };
  }, []);

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
  const departmentCenters = useMemo(
    () =>
      dataset.costCenters.filter((center) => center.department === watchedDepartment),
    [dataset.costCenters, watchedDepartment],
  );

  const filteredExpenses = useMemo(() => {
    const query = toLower(search);
    return expenses.filter((expense) => {
      if (departmentFilter !== "all" && expense.department !== departmentFilter) {
        return false;
      }
      if (statusFilter !== "all" && expense.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        expense.id.toLowerCase().includes(query) ||
        expense.description.toLowerCase().includes(query) ||
        expense.vendor.toLowerCase().includes(query) ||
        expense.employee.toLowerCase().includes(query)
      );
    });
  }, [departmentFilter, expenses, search, statusFilter]);

  const selectedExpense =
    expenses.find((expense) => expense.id === selectedExpenseId) ??
    filteredExpenses[0] ??
    null;

  const costCenterStats = useMemo(() => {
    const spentMap = new Map<string, number>();
    for (const expense of expenses) {
      if (expense.status === "rejected") {
        continue;
      }
      spentMap.set(
        expense.costCenterId,
        roundMoney((spentMap.get(expense.costCenterId) ?? 0) + expense.amount),
      );
    }

    return dataset.costCenters.map((center) => {
      const spent = spentMap.get(center.id) ?? 0;
      const utilization = center.budget > 0 ? roundMoney((spent / center.budget) * 100) : 0;
      return { ...center, spent, utilization };
    });
  }, [dataset.costCenters, expenses]);

  const totalAmount = roundMoney(
    filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
  );
  const pendingCount = filteredExpenses.filter(
    (expense) =>
      expense.status === "pending_manager" || expense.status === "pending_finance",
  ).length;
  const approvedAmount = roundMoney(
    filteredExpenses
      .filter((expense) => expense.status === "approved")
      .reduce((sum, expense) => sum + expense.amount, 0),
  );
  const rejectedAmount = roundMoney(
    filteredExpenses
      .filter((expense) => expense.status === "rejected")
      .reduce((sum, expense) => sum + expense.amount, 0),
  );

  const exceededCenters = costCenterStats.filter((center) => center.utilization > 100).length;

  function notify(message: string): void {
    setNotice(message);
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(""), 2400);
  }

  function submitExpense(values: ExpenseFormValues): void {
    const costCenter = dataset.costCenters.find((center) => center.id === values.costCenterId);
    if (!costCenter) {
      notify(tExpenses("messages.invalidCostCenter"));
      return;
    }

    const id = `EXP-${idCounter.current.toString().padStart(6, "0")}`;
    idCounter.current += 1;
    const dateIso = `${values.date}T09:00:00.000Z`;

    const nextExpense: ExpenseRecord = {
      id,
      date: dateIso,
      department: values.department,
      costCenterId: costCenter.id,
      costCenterName: costCenter.name,
      category: values.category,
      description: values.description,
      vendor: values.vendor,
      employee: values.employee,
      amount: roundMoney(values.amount),
      currency: "SAR",
      status: "pending_manager",
      paymentMethod: values.paymentMethod,
      approvalRoute: buildInitialRoute(values.employee, dateIso),
    };

    setExpenses((previous) => [nextExpense, ...previous]);
    setSelectedExpenseId(nextExpense.id);
    form.reset({
      ...values,
      description: "",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
    });
    notify(tExpenses("messages.created"));
  }

  function approveSelected(): void {
    if (!selectedExpense) {
      return;
    }
    const now = new Date().toISOString();

    setExpenses((previous) =>
      previous.map((expense) => {
        if (expense.id !== selectedExpense.id) {
          return expense;
        }

        if (expense.status === "draft") {
          return {
            ...expense,
            status: "pending_manager",
            approvalRoute: expense.approvalRoute.map((step, index) =>
              index === 1
                ? { ...step, status: "pending", note: "Awaiting manager review" }
                : step,
            ),
          };
        }

        if (expense.status === "pending_manager") {
          return {
            ...expense,
            status: "pending_finance",
            approvalRoute: expense.approvalRoute.map((step, index) => {
              if (index === 1) {
                return {
                  ...step,
                  status: "approved",
                  at: now,
                  note: "Approved by manager",
                };
              }
              return step;
            }),
          };
        }

        if (expense.status === "pending_finance") {
          return {
            ...expense,
            status: "approved",
            approvalRoute: expense.approvalRoute.map((step, index) => {
              if (index === 2) {
                return {
                  ...step,
                  status: "approved",
                  at: now,
                  note: "Approved by finance",
                };
              }
              return step;
            }),
          };
        }

        return expense;
      }),
    );

    notify(tExpenses("messages.approved"));
  }

  function rejectSelected(): void {
    if (!selectedExpense) {
      return;
    }
    const now = new Date().toISOString();

    setExpenses((previous) =>
      previous.map((expense) => {
        if (expense.id !== selectedExpense.id) {
          return expense;
        }
        if (expense.status === "approved" || expense.status === "rejected") {
          return expense;
        }

        const targetStepIndex = expense.status === "pending_finance" ? 2 : 1;
        return {
          ...expense,
          status: "rejected",
          approvalRoute: expense.approvalRoute.map((step, index) =>
            index === targetStepIndex
              ? {
                  ...step,
                  status: "rejected",
                  at: now,
                  note: "Rejected in approval routing",
                }
              : step,
          ),
        };
      }),
    );
    notify(tExpenses("messages.rejected"));
  }

  return (
    <ErpPageLayout>
      <ErpPageHeader title={tExpenses("title")} description={tExpenses("subtitle")} />

      <ErpSection
        className="col-span-12 no-print"
        title={locale === "ar" ? "عناصر قابلة للتنفيذ" : "Actionable Controls"}
        description={
          locale === "ar"
            ? "استخدم الفلاتر لتقليل الضوضاء والتركيز على العناصر القابلة للمعالجة."
            : "Use filters to reduce noise and focus on immediately actionable items."
        }
      >
        <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tExpenses("filters.searchPlaceholder")}
              className="h-9 w-full rounded-md border border-border bg-white ps-8 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value as Department | "all")}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="all">{tExpenses("filters.allDepartments")}</option>
            {departmentValues.map((department) => (
              <option key={department} value={department}>
                {tExpenses(`departments.${department}`)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ExpenseStatus | "all")}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            {statusValues.map((status) => (
              <option key={status} value={status}>
                {status === "all"
                  ? tExpenses("filters.allStatuses")
                  : tExpenses(`status.${status}`)}
              </option>
            ))}
          </select>
        </div>

        {notice ? (
          <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-finance">{notice}</p>
        ) : null}
      </ErpSection>

      <ErpKpiGrid className="xl:grid-cols-5">
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tExpenses("kpi.totalAmount")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(totalAmount, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tExpenses("kpi.pendingCount")}</p>
          <p className="mt-2 text-lg font-bold text-finance">{pendingCount}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tExpenses("kpi.approvedAmount")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(approvedAmount, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tExpenses("kpi.rejectedAmount")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(rejectedAmount, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tExpenses("kpi.overBudget")}</p>
          <p className="mt-2 text-lg font-bold text-finance">{exceededCenters}</p>
        </article>
      </ErpKpiGrid>

      <ErpMainSplit
        primary={
          <ErpSection
            title={tExpenses("entry.title")}
            description={
              locale === "ar"
                ? "إدخال المطالبة في حقول مرتبة حسب التسلسل التشغيلي."
                : "Create an expense entry with fields grouped by operational sequence."
            }
          >
            <form className="space-y-3" onSubmit={form.handleSubmit(submitExpense)}>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                {tExpenses("entry.date")}
                <input
                  type="date"
                  {...form.register("date")}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
                />
              </label>

              <label className="text-xs text-muted-foreground">
                {tExpenses("entry.department")}
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
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
                >
                  {departmentValues.map((department) => (
                    <option key={department} value={department}>
                      {tExpenses(`departments.${department}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                {tExpenses("entry.costCenter")}
                <select
                  value={form.watch("costCenterId")}
                  onChange={(event) =>
                    form.setValue("costCenterId", event.target.value, {
                      shouldValidate: true,
                    })
                  }
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
                >
                  {departmentCenters.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-muted-foreground">
                {tExpenses("entry.category")}
                <select
                  {...form.register("category")}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
                >
                  {dataset.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-xs text-muted-foreground">
              {tExpenses("entry.description")}
              <input
                type="text"
                {...form.register("description")}
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
              />
            </label>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                {tExpenses("entry.vendor")}
                <input
                  type="text"
                  {...form.register("vendor")}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
                />
              </label>

              <label className="text-xs text-muted-foreground">
                {tExpenses("entry.employee")}
                <input
                  type="text"
                  {...form.register("employee")}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
                />
              </label>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                {tExpenses("entry.amount")}
                <input
                  type="number"
                  step="0.01"
                  {...form.register("amount", { valueAsNumber: true })}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
                />
              </label>

              <label className="text-xs text-muted-foreground">
                {tExpenses("entry.paymentMethod")}
                <select
                  {...form.register("paymentMethod")}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
                >
                  {paymentMethodValues.map((paymentMethod) => (
                    <option key={paymentMethod} value={paymentMethod}>
                      {tExpenses(`paymentMethods.${paymentMethod}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <Button type="submit" size="sm" className="w-full">
              {tExpenses("entry.submit")}
            </Button>
            </form>
          </ErpSection>
        }
        secondary={
          <>
            <ErpSection title={tExpenses("costCenters.title")}>
            <div className="mt-3 space-y-2">
              {costCenterStats.map((center) => (
                <article key={center.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between text-xs">
                    <p className="font-medium text-finance">{center.name}</p>
                    <p className="text-muted-foreground">{center.utilization}%</p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${
                        center.utilization > 100
                          ? "bg-danger"
                          : center.utilization > 80
                            ? "bg-warning"
                            : "bg-success"
                      }`}
                      style={{ width: `${Math.min(center.utilization, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{formatCurrency(center.spent, locale, "SAR")}</span>
                    <span>{formatCurrency(center.budget, locale, "SAR")}</span>
                  </div>
                </article>
              ))}
            </div>
            </ErpSection>

            <ErpSection title={tExpenses("routing.title")}>
            {!selectedExpense ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {tExpenses("empty.selection")}
              </p>
            ) : (
              <>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-finance">{selectedExpense.id}</p>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass(
                      selectedExpense.status,
                    )}`}
                  >
                    {tExpenses(`status.${selectedExpense.status}`)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedExpense.costCenterName} - {selectedExpense.employee}
                </p>

                <ol className="mt-3 space-y-2">
                  {selectedExpense.approvalRoute.map((step) => (
                    <li key={step.id} className="rounded-md border border-border p-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-finance">{step.role}</span>
                        <span className="text-muted-foreground">
                          {tExpenses(`routeStatus.${step.status}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{step.actor}</p>
                      {step.note ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">{step.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={approveSelected}
                    disabled={
                      selectedExpense.status === "approved" ||
                      selectedExpense.status === "rejected"
                    }
                  >
                    {tExpenses("routing.approveStep")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={rejectSelected}
                    disabled={
                      selectedExpense.status === "approved" ||
                      selectedExpense.status === "rejected"
                    }
                  >
                    {tExpenses("routing.reject")}
                  </Button>
                </div>
              </>
            )}
            </ErpSection>
          </>
        }
      />

      <section className="surface-card col-span-12 overflow-hidden">
        <header className="border-b border-border bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-finance">{tExpenses("table.title")}</h3>
        </header>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2 text-start">{tExpenses("table.id")}</th>
                <th className="px-2 py-2 text-start">{tExpenses("table.date")}</th>
                <th className="px-2 py-2 text-start">{tExpenses("table.department")}</th>
                <th className="px-2 py-2 text-start">{tExpenses("table.costCenter")}</th>
                <th className="px-2 py-2 text-start">{tExpenses("table.employee")}</th>
                <th className="px-2 py-2 text-end">{tExpenses("table.amount")}</th>
                <th className="px-2 py-2 text-start">{tExpenses("table.status")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  onClick={() => setSelectedExpenseId(expense.id)}
                  className={`cursor-pointer border-b border-border/70 ${
                    selectedExpense?.id === expense.id ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-2 py-2 font-medium text-finance">{expense.id}</td>
                  <td className="px-2 py-2">{formatDate(expense.date, locale)}</td>
                  <td className="px-2 py-2">{tExpenses(`departments.${expense.department}`)}</td>
                  <td className="px-2 py-2">{expense.costCenterName}</td>
                  <td className="px-2 py-2">{expense.employee}</td>
                  <td className="px-2 py-2 text-end">
                    {formatCurrency(expense.amount, locale, expense.currency)}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(
                        expense.status,
                      )}`}
                    >
                      {tExpenses(`status.${expense.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
              {!filteredExpenses.length ? (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">
                    {tExpenses("empty.rows")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </ErpPageLayout>
  );
}
