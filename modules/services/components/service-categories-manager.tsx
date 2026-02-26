"use client";

import { Plus, Pencil, Trash2, X, Save, AlertTriangle } from "lucide-react";
import { useLocale } from "next-intl";
import { useState } from "react";
import {
  ErpPageHeader,
  ErpPageLayout,
  ErpSection,
} from "@/components/layout/erp-page-layout";
import { Button } from "@/components/ui/button";
import type { ServiceCategoryInfo } from "../types";

interface CategoryWithCount extends ServiceCategoryInfo {
  bookingCount: number;
}

interface ServiceCategoriesManagerProps {
  initialCategories: CategoryWithCount[];
}

interface FormData {
  id: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: string;
  color: string;
  bgColor: string;
}

const EMPTY_FORM: FormData = {
  id: "",
  labelEn: "",
  labelAr: "",
  descriptionEn: "",
  descriptionAr: "",
  icon: "globe",
  color: "text-slate-600",
  bgColor: "bg-slate-50",
};

const COLOR_OPTIONS = [
  { value: "text-blue-600", bg: "bg-blue-50", label: "Blue" },
  { value: "text-emerald-600", bg: "bg-emerald-50", label: "Green" },
  { value: "text-violet-600", bg: "bg-violet-50", label: "Violet" },
  { value: "text-amber-600", bg: "bg-amber-50", label: "Amber" },
  { value: "text-rose-600", bg: "bg-rose-50", label: "Rose" },
  { value: "text-cyan-600", bg: "bg-cyan-50", label: "Cyan" },
  { value: "text-indigo-600", bg: "bg-indigo-50", label: "Indigo" },
  { value: "text-orange-600", bg: "bg-orange-50", label: "Orange" },
  { value: "text-teal-600", bg: "bg-teal-50", label: "Teal" },
  { value: "text-pink-600", bg: "bg-pink-50", label: "Pink" },
  { value: "text-slate-600", bg: "bg-slate-50", label: "Slate" },
];

const ICON_OPTIONS = [
  "hotel", "car", "passport", "shield", "map", "bus", "globe",
  "plane", "train", "ship", "briefcase", "heart", "star", "flag",
];

const fieldLabelClass = "text-xs font-medium text-muted-foreground";
const fieldControlClass =
  "mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70";

export function ServiceCategoriesManager({ initialCategories }: ServiceCategoriesManagerProps) {
  const locale = useLocale();
  const isAr = locale === "ar";

  const [categories, setCategories] = useState<CategoryWithCount[]>(initialCategories);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function showNotice(message: string, tone: "success" | "error") {
    setNotice({ message, tone });
    setTimeout(() => setNotice(null), 3000);
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  }

  function openEditForm(cat: CategoryWithCount) {
    setEditingId(cat.id);
    setForm({
      id: cat.id,
      labelEn: cat.labelEn,
      labelAr: cat.labelAr,
      descriptionEn: cat.descriptionEn,
      descriptionAr: cat.descriptionAr,
      icon: cat.icon,
      color: cat.color,
      bgColor: cat.bgColor,
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.labelEn.trim() || !form.labelAr.trim()) {
      showNotice(isAr ? "الاسم بالعربية والإنجليزية مطلوب" : "English and Arabic names are required", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId
        ? { ...form, id: editingId }
        : { ...form };
      const res = await fetch("/api/services/categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed");
      }
      const refreshRes = await fetch("/api/services/categories");
      const refreshed = await refreshRes.json();
      setCategories(refreshed);
      showNotice(
        editingId
          ? (isAr ? "تم تحديث الفئة بنجاح" : "Category updated successfully")
          : (isAr ? "تم إضافة الفئة بنجاح" : "Category added successfully"),
        "success",
      );
      closeForm();
    } catch (err) {
      showNotice((err as Error).message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/services/categories?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed");
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      showNotice(isAr ? "تم حذف الفئة بنجاح" : "Category deleted successfully", "success");
      setDeleteConfirmId(null);
    } catch (err) {
      showNotice((err as Error).message, "error");
      setDeleteConfirmId(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={isAr ? "إدارة فئات الخدمات" : "Service Categories Management"}
        description={isAr ? "إضافة وتعديل وحذف فئات خدمات السفر المتاحة في النظام." : "Add, edit, and remove travel service categories available in the system."}
        actions={
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="me-1.5 h-4 w-4" />
            {isAr ? "فئة جديدة" : "New Category"}
          </Button>
        }
      />

      {notice && (
        <div className={`col-span-12 rounded-lg px-4 py-2.5 text-xs font-medium ${notice.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {notice.message}
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="col-span-12">
          <div className="surface-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-finance">
                {editingId
                  ? (isAr ? "تعديل الفئة" : "Edit Category")
                  : (isAr ? "إضافة فئة جديدة" : "Add New Category")}
              </h3>
              <button type="button" onClick={closeForm} className="rounded-lg p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={fieldLabelClass}>
                {isAr ? "الاسم بالإنجليزية" : "Name (English)"} *
                <input value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} className={fieldControlClass} required />
              </label>
              <label className={fieldLabelClass}>
                {isAr ? "الاسم بالعربية" : "Name (Arabic)"} *
                <input value={form.labelAr} onChange={(e) => setForm({ ...form, labelAr: e.target.value })} className={fieldControlClass} dir="rtl" required />
              </label>
              <label className={fieldLabelClass}>
                {isAr ? "الوصف بالإنجليزية" : "Description (English)"}
                <input value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} className={fieldControlClass} />
              </label>
              <label className={fieldLabelClass}>
                {isAr ? "الوصف بالعربية" : "Description (Arabic)"}
                <input value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} className={fieldControlClass} dir="rtl" />
              </label>
              <label className={fieldLabelClass}>
                {isAr ? "الأيقونة" : "Icon"}
                <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className={fieldControlClass}>
                  {ICON_OPTIONS.map((ic) => (
                    <option key={ic} value={ic}>{ic}</option>
                  ))}
                </select>
              </label>
              <label className={fieldLabelClass}>
                {isAr ? "اللون" : "Color Theme"}
                <select
                  value={form.color}
                  onChange={(e) => {
                    const opt = COLOR_OPTIONS.find((o) => o.value === e.target.value);
                    setForm({ ...form, color: e.target.value, bgColor: opt?.bg ?? "bg-slate-50" });
                  }}
                  className={fieldControlClass}
                >
                  {COLOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-slate-50 px-4 py-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${form.bgColor}`}>
                <span className={`text-sm font-bold ${form.color}`}>{form.icon.slice(0, 2).toUpperCase()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-finance">{form.labelEn || "..."} / {form.labelAr || "..."}</p>
                <p className="text-[11px] text-muted-foreground">{form.descriptionEn || (isAr ? "بدون وصف" : "No description")}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeForm} disabled={isSubmitting}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button size="sm" onClick={() => void handleSave()} loading={isSubmitting} disabled={isSubmitting}>
                <Save className="me-1.5 h-3.5 w-3.5" />
                {editingId ? (isAr ? "حفظ التعديلات" : "Save Changes") : (isAr ? "إضافة" : "Add")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ErpSection
        className="col-span-12"
        title={isAr ? "الفئات المسجلة" : "Registered Categories"}
        description={isAr ? `${categories.length} فئة خدمة مسجلة في النظام` : `${categories.length} service categories registered`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "المعرف" : "ID"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "الاسم (EN)" : "Name (EN)"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "الاسم (AR)" : "Name (AR)"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "الأيقونة" : "Icon"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "اللون" : "Color"}</th>
                <th className="px-3 py-2.5 text-center font-medium">{isAr ? "الحجوزات" : "Bookings"}</th>
                <th className="px-3 py-2.5 text-end font-medium">{isAr ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {categories.map((cat) => (
                <tr key={cat.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-mono text-xs text-finance">{cat.id}</td>
                  <td className="px-3 py-2.5 font-medium text-finance">{cat.labelEn}</td>
                  <td className="px-3 py-2.5 font-medium text-finance" dir="rtl">{cat.labelAr}</td>
                  <td className="px-3 py-2.5">
                    <div className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${cat.bgColor}`}>
                      <span className={`text-[10px] font-bold ${cat.color}`}>{cat.icon.slice(0, 2).toUpperCase()}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block h-4 w-4 rounded-full ${cat.bgColor} ring-1 ring-inset ring-border/30`} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {cat.bookingCount}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditForm(cat)}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-blue-50 hover:text-blue-600"
                        title={isAr ? "تعديل" : "Edit"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {deleteConfirmId === cat.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDelete(cat.id)}
                            disabled={isSubmitting}
                            className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                          >
                            {isAr ? "تأكيد" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground transition hover:bg-slate-100"
                          >
                            {isAr ? "إلغاء" : "Cancel"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(cat.id)}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600"
                          title={isAr ? "حذف" : "Delete"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {categories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-finance">{isAr ? "لا توجد فئات" : "No categories"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{isAr ? "أضف فئة خدمة جديدة للبدء" : "Add a new service category to get started"}</p>
            </div>
          )}
        </div>
      </ErpSection>
    </ErpPageLayout>
  );
}
