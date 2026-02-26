"use client";

import {
  Building2, Bus, Calculator, Car, Cog, FileCheck, FileText,
  Globe, LayoutDashboard, Landmark, Map, Printer,
  ReceiptText, Scale, Search, Shield, Ticket, Users, BarChart3, X, Plus,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

interface CommandItem {
  href: string;
  labelEn: string;
  labelAr: string;
  icon: LucideIcon;
  keywords: string;
}

const COMMANDS: CommandItem[] = [
  { href: "/", labelEn: "Dashboard", labelAr: "لوحة التحكم", icon: LayoutDashboard, keywords: "home main dashboard" },
  { href: "/services", labelEn: "Services Hub", labelAr: "مركز الخدمات", icon: Globe, keywords: "services hub travel" },
  { href: "/services/hotels", labelEn: "Hotel Reservations", labelAr: "حجوزات الفنادق", icon: Building2, keywords: "hotel room booking reservation" },
  { href: "/services/cars", labelEn: "Car Rental", labelAr: "تأجير السيارات", icon: Car, keywords: "car rental vehicle" },
  { href: "/services/visa", labelEn: "Visa Services", labelAr: "خدمات التأشيرات", icon: FileCheck, keywords: "visa passport embassy" },
  { href: "/services/insurance", labelEn: "Travel Insurance", labelAr: "تأمين السفر", icon: Shield, keywords: "insurance coverage" },
  { href: "/services/tours", labelEn: "Tour Packages", labelAr: "البرامج السياحية", icon: Map, keywords: "tour package trip itinerary" },
  { href: "/services/transfers", labelEn: "Transfers", labelAr: "التوصيل", icon: Bus, keywords: "transfer airport pickup" },
  { href: "/operations", labelEn: "Operations Hub", labelAr: "مركز العمليات", icon: Ticket, keywords: "operations travel transaction ticket sale" },
  { href: "/expenses", labelEn: "Expenses", labelAr: "المصروفات", icon: ReceiptText, keywords: "expense cost" },
  { href: "/accounting", labelEn: "Accounting", labelAr: "المحاسبة", icon: Calculator, keywords: "accounting journal ledger" },
  { href: "/treasury", labelEn: "Treasury", labelAr: "الخزينة", icon: Landmark, keywords: "treasury cash bank" },
  { href: "/bsp", labelEn: "BSP Reconciliation", labelAr: "مطابقة BSP", icon: Scale, keywords: "bsp reconciliation" },
  { href: "/crm", labelEn: "CRM", labelAr: "إدارة العملاء", icon: Users, keywords: "crm customer" },
  { href: "/reports", labelEn: "Reports & BI", labelAr: "التقارير", icon: BarChart3, keywords: "report analytics bi" },
  { href: "/ocr", labelEn: "OCR Workspace", labelAr: "مساحة OCR", icon: FileText, keywords: "ocr document scan" },
  { href: "/templates", labelEn: "Templates", labelAr: "القوالب", icon: Printer, keywords: "template print voucher" },
  { href: "/settings", labelEn: "Settings", labelAr: "الإعدادات", icon: Cog, keywords: "settings preferences" },

  // Quick Actions
  { href: "/operations?type=travel&mode=create", labelEn: "New Travel Request", labelAr: "طلب سفر جديد", icon: Plus, keywords: "create add new travel request trip action" },
  { href: "/operations?type=transactions&mode=create", labelEn: "New Transaction", labelAr: "معاملة جديدة", icon: Plus, keywords: "create add new transaction payment action" },
  { href: "/crm/create", labelEn: "New Customer", labelAr: "عميل جديد", icon: Plus, keywords: "create add new customer account action" },
];

export function CommandPalette() {
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (cmd) =>
        cmd.labelEn.toLowerCase().includes(q) ||
        cmd.labelAr.includes(q) ||
        cmd.keywords.includes(q),
    );
  }, [query]);

  function doOpen() {
    setQuery("");
    setSelectedIndex(0);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedIndex(0);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!open) doOpen(); else setOpen(false);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function navigate(href: string) {
    setOpen(false);
    router.push(`/${locale}${href === "/" ? "" : href}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].href);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => doOpen()}
        className="hidden lg:flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition hover:bg-slate-50 hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span>{isAr ? "بحث..." : "Search..."}</span>
        <kbd className="rounded border border-border bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed inset-x-0 top-[15%] z-50 mx-auto w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAr ? "ابحث عن صفحة أو خدمة..." : "Search pages and services..."}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {isAr ? "لا توجد نتائج" : "No results found"}
              </p>
            )}
            {filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.href}
                  type="button"
                  onClick={() => navigate(cmd.href)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition ${i === selectedIndex ? "bg-primary/10 text-primary" : "text-finance hover:bg-slate-50"
                    }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{isAr ? cmd.labelAr : cmd.labelEn}</span>
                  <span className="ms-auto text-[10px] text-muted-foreground">{cmd.href}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-border bg-slate-50/50 px-4 py-2 text-[10px] text-muted-foreground">
            <span className="me-3">↑↓ {isAr ? "تنقل" : "Navigate"}</span>
            <span className="me-3">↵ {isAr ? "فتح" : "Open"}</span>
            <span>Esc {isAr ? "إغلاق" : "Close"}</span>
          </div>
        </div>
      </div>
    </>
  );
}

