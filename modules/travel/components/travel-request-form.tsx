"use client";

import { Search, Users, Plane, Link2, ClipboardCheck, Check, UserCircle, Plus, AlertTriangle, Layers } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputWithIcon } from "@/components/ui/input-with-icon";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SlideOver } from "@/components/ui/slide-over";
import { AdvisorPanel } from "./advisor-panel";
import { SERVICE_CATEGORIES } from "@/modules/services/types";
import type { AnyServiceBooking, ServiceCategory } from "@/modules/services/types";
import type { ServiceCategoryInfo } from "@/modules/services/types";
import type { Customer } from "@/modules/customers/types";
import type { EmployeeGrade, TravelClass, TripType } from "../types";
import type { TravelDictionary } from "../i18n";
import { formatCurrency, formatDate } from "@/utils/format";
import { calculateNormalizedTotal } from "@/utils/pricing";
import { DEFAULT_TRAVEL_POLICY } from "@/modules/travel/policy/travel-policy-engine";
import { cn } from "@/utils/cn";

export interface FormState {
    customerId: string;
    linkedServiceBookingIds: string[];
    employeeName: string;
    employeeEmail: string;
    employeeGrade: EmployeeGrade;
    department: string;
    costCenter: string;
    tripType: TripType;
    origin: string;
    destination: string;
    departureDate: string;
    returnDate: string;
    purpose: string;
    travelClass: TravelClass;
    estimatedCost: string;
    currency: string;
}

export interface CreateRequestPricingContext {
    baseTripEstimatedCost: number;
    additionalServicesEstimatedCost: number;
    totalEstimatedCost: number;
    serviceCostOverrides: Record<string, number>;
}

interface SessionUser {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface TravelRequestFormProps {
    form: FormState;
    updateForm: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
    onSubmit: (
        event: React.FormEvent<HTMLFormElement>,
        pricing: CreateRequestPricingContext,
    ) => void;
    isCreating: boolean;
    canCreate: boolean;
    sessionUser: SessionUser | null;
    customers: Customer[];
    serviceBookings: AnyServiceBooking[];
    locale: string;
    layoutText: Record<string, string>;
    requestFormText: Record<string, string>;
    t: TravelDictionary;
}

type RequestFormStep = 1 | 2 | 3 | 4;

const fieldLabelClass = "block text-xs font-medium text-muted-foreground";
const formBlockClass = "rounded-lg border border-border bg-slate-50/70 p-4";

const STEP_ICONS: Record<RequestFormStep, React.ElementType> = {
    1: Users,
    2: Plane,
    3: Link2,
    4: ClipboardCheck,
};

const segmentColors: Record<string, string> = {
    starter: "bg-slate-100 text-slate-700",
    growth: "bg-blue-100 text-blue-700",
    strategic: "bg-indigo-100 text-indigo-700",
};

const FORM_INPUT_SYNC_DELAY_MS = 500;

const VALID_CUSTOMER_SEGMENTS = new Set(["starter", "growth", "strategic"]);

function normalizeCustomer(item: unknown): Customer | null {
    if (!item || typeof item !== "object") {
        return null;
    }

    const value = item as Partial<Customer>;
    if (
        typeof value.id !== "string" ||
        typeof value.name !== "string" ||
        typeof value.phone !== "string" ||
        typeof value.email !== "string" ||
        typeof value.createdAt !== "string" ||
        typeof value.segment !== "string" ||
        !VALID_CUSTOMER_SEGMENTS.has(value.segment)
    ) {
        return null;
    }

    return {
        id: value.id,
        name: value.name,
        phone: value.phone,
        email: value.email,
        segment: value.segment as Customer["segment"],
        createdAt: value.createdAt,
    };
}

function normalizeCategory(item: unknown): ServiceCategoryInfo | null {
    if (!item || typeof item !== "object") {
        return null;
    }

    const value = item as Partial<ServiceCategoryInfo>;
    if (
        typeof value.id !== "string" ||
        typeof value.labelEn !== "string" ||
        typeof value.labelAr !== "string" ||
        typeof value.descriptionEn !== "string" ||
        typeof value.descriptionAr !== "string" ||
        typeof value.icon !== "string" ||
        typeof value.color !== "string" ||
        typeof value.bgColor !== "string"
    ) {
        return null;
    }

    return {
        id: value.id,
        labelEn: value.labelEn,
        labelAr: value.labelAr,
        descriptionEn: value.descriptionEn,
        descriptionAr: value.descriptionAr,
        icon: value.icon,
        color: value.color,
        bgColor: value.bgColor,
    };
}

function formatReviewDate(value: string, locale: string): string {
    return formatDate(value, locale, {
        includeTime: false,
        fallback: "-",
    });
}

interface ServiceBundleDefinition {
    id: string;
    labelEn: string;
    labelAr: string;
    categories: string[];
}

interface QuickServiceDraft {
    serviceName: string;
    provider: string;
    location: string;
    totalAmount: string;
    notes: string;
}

const QUICK_SERVICE_DRAFT_DEFAULT: QuickServiceDraft = {
    serviceName: "",
    provider: "",
    location: "",
    totalAmount: "",
    notes: "",
};

const SERVICE_BUNDLES: ServiceBundleDefinition[] = [
    {
        id: "conference_city",
        labelEn: "Conference Bundle",
        labelAr: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0645\u0624\u062a\u0645\u0631",
        categories: ["hotel", "transfer", "insurance"],
    },
    {
        id: "international_trip",
        labelEn: "International Bundle",
        labelAr: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0633\u0641\u0631 \u0627\u0644\u062f\u0648\u0644\u064a",
        categories: ["hotel", "visa", "insurance", "transfer"],
    },
    {
        id: "domestic_trip",
        labelEn: "Domestic Bundle",
        labelAr: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0633\u0641\u0631 \u0627\u0644\u062f\u0627\u062e\u0644\u064a",
        categories: ["hotel", "car_rental", "transfer"],
    },
];

function getTripDays(departureDate: string, returnDate: string): number {
    if (!departureDate || !returnDate) {
        return 1;
    }
    const departure = new Date(departureDate);
    const back = new Date(returnDate);
    if (!Number.isFinite(departure.getTime()) || !Number.isFinite(back.getTime())) {
        return 1;
    }
    const diffMs = back.getTime() - departure.getTime();
    if (diffMs <= 0) {
        return 1;
    }
    return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function getBookingServiceName(booking: AnyServiceBooking): string {
    switch (booking.category) {
        case "hotel":
            return booking.hotelName;
        case "car_rental":
            return booking.vehicleModel;
        case "visa":
            return booking.destinationCountry;
        case "insurance":
            return booking.planName;
        case "tour":
            return booking.tourName;
        case "transfer":
            return booking.transferType.replace(/_/g, " ");
        default:
            return "";
    }
}

function getBookingProvider(booking: AnyServiceBooking): string {
    switch (booking.category) {
        case "car_rental":
        case "insurance":
            return booking.provider;
        case "hotel":
            return booking.hotelName;
        case "visa":
            return booking.embassy;
        case "tour":
            return booking.tourType;
        case "transfer":
            return booking.driverName || booking.vehicleClass;
        default:
            return "";
    }
}

function getBookingLocation(booking: AnyServiceBooking): string {
    switch (booking.category) {
        case "hotel":
            return `${booking.city}, ${booking.country}`;
        case "car_rental":
            return `${booking.pickupLocation} -> ${booking.dropoffLocation}`;
        case "visa":
            return booking.destinationCountry;
        case "insurance":
            return booking.coverageArea;
        case "tour":
            return booking.destination;
        case "transfer":
            return `${booking.pickupLocation} -> ${booking.dropoffLocation}`;
        default:
            return "";
    }
}

export function TravelRequestForm({
    form,
    updateForm,
    onSubmit,
    isCreating,
    canCreate,
    sessionUser,
    customers,
    serviceBookings,
    locale,
    layoutText: _layoutText,
    requestFormText,
    t,
}: TravelRequestFormProps) {
    const isAr = locale === "ar";
    void _layoutText;
    const [step, setStep] = useState<RequestFormStep>(1);
    const [customerSearch, setCustomerSearch] = useState("");
    const [serviceSearch, setServiceSearch] = useState("");
    const [serviceFilter, setServiceFilter] = useState<ServiceCategory | "all">("all");
    const [liveCustomers, setLiveCustomers] = useState<Customer[]>(customers);
    const [serviceCategories, setServiceCategories] = useState<ServiceCategoryInfo[]>(() => [...SERVICE_CATEGORIES]);
    const [liveServiceBookings, setLiveServiceBookings] = useState<AnyServiceBooking[]>(serviceBookings);
    const [selectedBundleId, setSelectedBundleId] = useState<string>("none");
    const [serviceAmountOverrides, setServiceAmountOverrides] = useState<Record<string, string>>({});
    const [serviceNotice, setServiceNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
    const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
    const [isQuickCreateSaving, setIsQuickCreateSaving] = useState(false);
    const [quickCreateCategory, setQuickCreateCategory] = useState<ServiceCategory>("hotel");
    const [quickCreateDraft, setQuickCreateDraft] = useState<QuickServiceDraft>(QUICK_SERVICE_DRAFT_DEFAULT);

    useEffect(() => {
        setLiveServiceBookings(serviceBookings);
    }, [serviceBookings]);

    useEffect(() => {
        setLiveCustomers(customers);
    }, [customers]);

    useEffect(() => {
        const query = customerSearch.trim();
        if (!query) {
            setLiveCustomers(customers);
            return;
        }

        let active = true;
        const timeout = window.setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/customers/search?q=${encodeURIComponent(query)}&limit=24`,
                    { cache: "no-store" },
                );
                if (!response.ok || !active) {
                    return;
                }
                const payload = (await response.json()) as unknown;
                if (!Array.isArray(payload)) {
                    return;
                }
                const normalized = payload
                    .map(normalizeCustomer)
                    .filter((customer): customer is Customer => !!customer);
                if (active) {
                    setLiveCustomers(normalized);
                }
            } catch {
                // Keep local fallback list if remote search fails.
            }
        }, 220);

        return () => {
            active = false;
            window.clearTimeout(timeout);
        };
    }, [customerSearch, customers]);

    useEffect(() => {
        let active = true;

        async function loadServiceContext() {
            try {
                const [categoriesResponse, bookingsResponse] = await Promise.all([
                    fetch("/api/services/categories", { cache: "no-store" }),
                    fetch("/api/services", { cache: "no-store" }),
                ]);

                if (categoriesResponse.ok) {
                    const payload = (await categoriesResponse.json()) as unknown;
                    if (active && Array.isArray(payload)) {
                        const normalized = payload
                            .map(normalizeCategory)
                            .filter((item): item is ServiceCategoryInfo => !!item);

                        if (normalized.length > 0) {
                            setServiceCategories(normalized);
                        }
                    }
                }

                if (bookingsResponse.ok) {
                    const bookingsPayload = (await bookingsResponse.json()) as unknown;
                    if (active && Array.isArray(bookingsPayload)) {
                        setLiveServiceBookings(bookingsPayload as AnyServiceBooking[]);
                    }
                }
            } catch {
                // Keep fallback categories when API is unavailable.
            }
        }

        void loadServiceContext();
        return () => {
            active = false;
        };
    }, []);

    const categoryById = useMemo(() => {
        return new Map(serviceCategories.map((category) => [category.id, category]));
    }, [serviceCategories]);

    const uncataloguedCategoryIds = useMemo(() => {
        return Array.from(new Set(liveServiceBookings.map((booking) => booking.category))).filter(
            (categoryId) => !categoryById.has(categoryId),
        );
    }, [liveServiceBookings, categoryById]);

    const customerDirectory = useMemo(() => {
        const byId = new Map<string, Customer>();
        for (const customer of customers) {
            byId.set(customer.id, customer);
        }
        for (const customer of liveCustomers) {
            byId.set(customer.id, customer);
        }
        return Array.from(byId.values());
    }, [customers, liveCustomers]);

    const selectedCustomer = useMemo(
        () => (form.customerId ? customerDirectory.find((c) => c.id === form.customerId) : null),
        [form.customerId, customerDirectory],
    );

    const filteredCustomers = useMemo(() => {
        const q = customerSearch.trim().toLowerCase();
        const source = q ? liveCustomers : customerDirectory;
        if (!q) return source.slice(0, 8);
        return source.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                c.phone.includes(q),
        );
    }, [customerDirectory, customerSearch, liveCustomers]);

    const filteredBookings = useMemo(() => {
        let list = liveServiceBookings;
        if (serviceFilter !== "all") {
            list = list.filter((b) => b.category === serviceFilter);
        }
        const query = serviceSearch.trim().toLowerCase();
        if (query) {
            list = list.filter((booking) => {
                const haystack = [
                    booking.id,
                    booking.customerName,
                    booking.customerEmail,
                    getBookingServiceName(booking),
                    getBookingProvider(booking),
                    getBookingLocation(booking),
                ].join(" ").toLowerCase();
                return haystack.includes(query);
            });
        }
        return list;
    }, [liveServiceBookings, serviceFilter, serviceSearch]);

    const selectedBookings = useMemo(
        () => liveServiceBookings.filter((b) => form.linkedServiceBookingIds.includes(b.id)),
        [liveServiceBookings, form.linkedServiceBookingIds],
    );

    const normalizedServiceOverrides = useMemo(() => {
        const next: Record<string, number> = {};
        for (const booking of selectedBookings) {
            const rawValue = serviceAmountOverrides[booking.id];
            if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
                continue;
            }
            const parsed = Number(rawValue);
            if (Number.isFinite(parsed) && parsed > 0) {
                next[booking.id] = parsed;
            }
        }
        return next;
    }, [selectedBookings, serviceAmountOverrides]);

    const resolveServiceAmount = useCallback(
        (booking: AnyServiceBooking) => {
            const override = normalizedServiceOverrides[booking.id];
            if (typeof override === "number") {
                return override;
            }
            return booking.totalAmount;
        },
        [normalizedServiceOverrides],
    );

    const servicesTotalAmount = useMemo(
        () =>
            calculateNormalizedTotal(
                selectedBookings.map((booking) => ({
                    cost: resolveServiceAmount(booking),
                    currency: booking.currency,
                })),
                { targetCurrency: form.currency || "SAR" },
            ).total,
        [form.currency, resolveServiceAmount, selectedBookings],
    );
    const tripDays = useMemo(
        () => getTripDays(form.departureDate, form.returnDate),
        [form.departureDate, form.returnDate],
    );
    const tripEstimatedAmount = Number(form.estimatedCost) || 0;
    const totalEstimatedAmount = tripEstimatedAmount + servicesTotalAmount;

    const budgetCap = DEFAULT_TRAVEL_POLICY.maxBudgetByGrade[form.employeeGrade];
    const nearBudgetThreshold = budgetCap * DEFAULT_TRAVEL_POLICY.budgetWarningThreshold;
    const budgetExceeded = totalEstimatedAmount > budgetCap;
    const budgetNearCap = !budgetExceeded && totalEstimatedAmount >= nearBudgetThreshold;
    const cheaperAlternatives = useMemo(() => {
        const requestCurrency = form.currency || "SAR";
        return selectedBookings
            .map((booking) => {
                const selectedAmount = calculateNormalizedTotal(
                    [{ cost: resolveServiceAmount(booking), currency: booking.currency }],
                    { targetCurrency: requestCurrency },
                ).total;
                const alternatives = liveServiceBookings
                    .filter((candidate) => candidate.category === booking.category && candidate.id !== booking.id)
                    .map((candidate) => ({
                        booking: candidate,
                        normalizedAmount: calculateNormalizedTotal(
                            [{ cost: candidate.totalAmount, currency: candidate.currency }],
                            { targetCurrency: requestCurrency },
                        ).total,
                    }))
                    .sort((left, right) => left.normalizedAmount - right.normalizedAmount);
                const cheaper = alternatives.find((candidate) => candidate.normalizedAmount < selectedAmount);
                if (!cheaper) {
                    return null;
                }
                return {
                    currentId: booking.id,
                    suggestedId: cheaper.booking.id,
                    savings: selectedAmount - cheaper.normalizedAmount,
                    suggestedAmount: cheaper.normalizedAmount,
                };
            })
            .filter((item): item is NonNullable<typeof item> => !!item)
            .slice(0, 3);
    }, [form.currency, liveServiceBookings, resolveServiceAmount, selectedBookings]);

    const steps: { id: RequestFormStep; label: string }[] = [
        { id: 1, label: isAr ? "\u0627\u0644\u0639\u0645\u064a\u0644" : "Customer" },
        { id: 2, label: isAr ? "\u0627\u0644\u0631\u062d\u0644\u0629 \u0648\u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629" : "Trip & Budget" },
        { id: 3, label: isAr ? "\u0627\u0644\u062e\u062f\u0645\u0627\u062a" : "Services" },
        { id: 4, label: isAr ? "\u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629" : "Review" },
    ];

    function handleSelectCustomer(customer: Customer) {
        updateForm("customerId", customer.id);
        setCustomerSearch("");
    }

    function handleClearCustomer() {
        updateForm("customerId", "");
    }

    function notifyService(message: string, tone: "success" | "error") {
        setServiceNotice({ message, tone });
        window.setTimeout(() => {
            setServiceNotice(null);
        }, 3000);
    }

    function openQuickCreateDrawer() {
        const defaultCategory =
            serviceFilter !== "all"
                ? serviceFilter
                : serviceCategories[0]?.id ?? "hotel";
        setQuickCreateCategory(defaultCategory);
        setQuickCreateDraft((prev) => ({
            ...prev,
            serviceName: "",
            provider: "",
            location: "",
            totalAmount: "",
            notes: "",
        }));
        setIsQuickCreateOpen(true);
    }

    function buildQuickBookingPayload(category: ServiceCategory): Record<string, unknown> {
        const today = new Date().toISOString().slice(0, 10);
        const departure = form.departureDate || today;
        const back = form.returnDate || departure;
        const fallbackName = sessionUser?.name || "Travel Request User";
        const fallbackEmail = sessionUser?.email || "travel.request@enterprise.local";
        const amount = Math.max(1, Number(quickCreateDraft.totalAmount) || 0);
        const base = {
            category,
            customerId: selectedCustomer?.id || "",
            customerName: selectedCustomer?.name || fallbackName,
            customerPhone: selectedCustomer?.phone || "0000000000",
            customerEmail: selectedCustomer?.email || fallbackEmail,
            status: "pending",
            totalAmount: amount,
            currency: form.currency || "SAR",
            notes: quickCreateDraft.notes || "",
        };

        if (category === "hotel") {
            return {
                ...base,
                hotelName: quickCreateDraft.serviceName || "Hotel",
                city: quickCreateDraft.location || form.destination || "City",
                country: "N/A",
                starRating: 4,
                roomType: "standard",
                checkIn: departure,
                checkOut: back,
                nights: tripDays,
                guests: 1,
                mealPlan: "breakfast",
                confirmationNumber: `TMP-${Date.now()}`,
            };
        }
        if (category === "car_rental") {
            return {
                ...base,
                provider: quickCreateDraft.provider || "Rental Provider",
                vehicleType: "sedan",
                vehicleModel: quickCreateDraft.serviceName || "Sedan",
                pickupLocation: quickCreateDraft.location || form.origin || "Pickup",
                dropoffLocation: form.destination || quickCreateDraft.location || "Dropoff",
                pickupDate: departure,
                dropoffDate: back,
                days: tripDays,
                dailyRate: Math.max(1, Math.round((amount / Math.max(1, tripDays)) * 100) / 100),
                includesInsurance: true,
                driverOption: "with_driver",
            };
        }
        if (category === "visa") {
            return {
                ...base,
                destinationCountry: quickCreateDraft.location || form.destination || "Destination",
                visaType: "business",
                applicantName: selectedCustomer?.name || fallbackName,
                passportNumber: "PENDING",
                applicationDate: today,
                expectedDate: back,
                processingStatus: "documents_collected",
                embassy: quickCreateDraft.provider || "Embassy",
            };
        }
        if (category === "insurance") {
            return {
                ...base,
                provider: quickCreateDraft.provider || "Insurance Provider",
                planName: quickCreateDraft.serviceName || "Travel Plan",
                planType: "standard",
                coverageArea: form.tripType === "international" ? "worldwide" : "domestic",
                startDate: departure,
                endDate: back,
                travelers: 1,
                medicalCoverage: amount * 10,
                tripCancellation: true,
                luggageCoverage: true,
            };
        }
        if (category === "tour") {
            return {
                ...base,
                tourName: quickCreateDraft.serviceName || "Tour Package",
                destination: quickCreateDraft.location || form.destination || "Destination",
                duration: `${tripDays}d`,
                startDate: departure,
                endDate: back,
                groupSize: 1,
                tourType: "group",
                includesFlights: false,
                includesHotel: true,
                includesMeals: false,
                itinerary: [quickCreateDraft.notes || "Auto generated itinerary"],
            };
        }
        if (category === "transfer") {
            return {
                ...base,
                transferType: "airport_pickup",
                vehicleClass: "business",
                pickupLocation: quickCreateDraft.location || form.origin || "Pickup",
                dropoffLocation: form.destination || "Dropoff",
                pickupDateTime: `${departure}T09:00`,
                passengers: 1,
                flightNumber: "TBD",
                driverName: quickCreateDraft.provider || "Assigned Driver",
                driverPhone: "0000000000",
            };
        }

        return base;
    }

    async function handleQuickCreateService() {
        if (!quickCreateDraft.serviceName.trim()) {
            notifyService(
                isAr
                    ? "\u0627\u0633\u0645 \u0627\u0644\u062e\u062f\u0645\u0629 \u0645\u0637\u0644\u0648\u0628."
                    : "Service name is required.",
                "error",
            );
            return;
        }
        const amount = Number(quickCreateDraft.totalAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            notifyService(
                isAr
                    ? "\u0623\u062f\u062e\u0644 \u0642\u064a\u0645\u0629 \u0635\u062d\u064a\u062d\u0629 \u0644\u0644\u062a\u0643\u0644\u0641\u0629."
                    : "Enter a valid cost amount.",
                "error",
            );
            return;
        }

        setIsQuickCreateSaving(true);
        try {
            const response = await fetch("/api/services", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildQuickBookingPayload(quickCreateCategory)),
            });
            const payload = (await response.json()) as AnyServiceBooking | { message?: string; error?: string };
            if (!response.ok) {
                const errorMessage =
                    (payload as { message?: string; error?: string }).message ||
                    (payload as { message?: string; error?: string }).error ||
                    (isAr
                        ? "\u062a\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062e\u062f\u0645\u0629."
                        : "Unable to create service.");
                throw new Error(errorMessage);
            }

            const created = payload as AnyServiceBooking;
            setLiveServiceBookings((prev) => [created, ...prev.filter((booking) => booking.id !== created.id)]);
            updateForm(
                "linkedServiceBookingIds",
                Array.from(new Set([...form.linkedServiceBookingIds, created.id])),
            );
            setServiceFilter(created.category);
            setServiceSearch("");
            setIsQuickCreateOpen(false);
            notifyService(
                isAr
                    ? "\u062a\u0645 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062e\u062f\u0645\u0629 \u0648\u0631\u0628\u0637\u0647\u0627 \u0628\u0627\u0644\u0637\u0644\u0628 \u0645\u0628\u0627\u0634\u0631\u0629."
                    : "Service created and linked to this request.",
                "success",
            );
        } catch (err) {
            notifyService(
                err instanceof Error ? err.message : (isAr
                    ? "\u062a\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062e\u062f\u0645\u0629."
                    : "Unable to create service."),
                "error",
            );
        } finally {
            setIsQuickCreateSaving(false);
        }
    }

    function applyBundle() {
        if (selectedBundleId === "none") {
            return;
        }
        const bundle = SERVICE_BUNDLES.find((item) => item.id === selectedBundleId);
        if (!bundle) {
            return;
        }

        const customerScoped = selectedCustomer
            ? liveServiceBookings.filter((booking) => booking.customerId === selectedCustomer.id)
            : [];
        const pool = customerScoped.length > 0 ? customerScoped : liveServiceBookings;
        const suggestedIds = bundle.categories
            .map((categoryId) =>
                pool
                    .filter((booking) => booking.category === categoryId)
                    .sort((left, right) => left.totalAmount - right.totalAmount)[0],
            )
            .filter((booking): booking is AnyServiceBooking => !!booking)
            .map((booking) => booking.id);

        if (!suggestedIds.length) {
            notifyService(
                isAr
                    ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u062e\u062f\u0645\u0627\u062a \u0645\u062a\u0627\u062d\u0629 \u0644\u0647\u0630\u0647 \u0627\u0644\u062d\u0632\u0645\u0629."
                    : "No available services for this bundle.",
                "error",
            );
            return;
        }

        updateForm(
            "linkedServiceBookingIds",
            Array.from(new Set([...form.linkedServiceBookingIds, ...suggestedIds])),
        );
        notifyService(
            isAr
                ? "\u062a\u0645 \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u062d\u0632\u0645\u0629 \u0648\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u062d\u0629."
                : "Bundle applied and available services were linked.",
            "success",
        );
    }

    function toggleServiceBooking(bookingId: string) {
        const current = form.linkedServiceBookingIds;
        if (current.includes(bookingId)) {
            updateForm("linkedServiceBookingIds", current.filter((id) => id !== bookingId));
        } else {
            updateForm("linkedServiceBookingIds", [...current, bookingId]);
        }
    }

    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});

    function validateStep(currentStep: RequestFormStep): boolean {
        const errors: Partial<Record<keyof FormState, string>> = {};
        let isValid = true;

        if (currentStep === 1) {
            if (!form.employeeName.trim()) {
                errors.employeeName = isAr ? "اسم الموظف مطلوب" : "Employee Name is required";
                isValid = false;
            }
            if (!form.employeeEmail.trim()) {
                errors.employeeEmail = isAr ? "البريد الإلكتروني مطلوب" : "Email is required";
                isValid = false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.employeeEmail)) {
                errors.employeeEmail = isAr ? "البريد الإلكتروني غير صالح" : "Invalid email format";
                isValid = false;
            }
            if (!form.department.trim()) {
                errors.department = isAr ? "القسم مطلوب" : "Department is required";
                isValid = false;
            }
        }

        if (currentStep === 2) {
            if (!form.origin.trim()) {
                errors.origin = isAr ? "نقطة الانطلاق مطلوبة" : "Origin is required";
                isValid = false;
            }
            if (!form.destination.trim()) {
                errors.destination = isAr ? "الوجهة مطلوبة" : "Destination is required";
                isValid = false;
            }
            if (!form.departureDate) {
                errors.departureDate = isAr ? "تاريخ المغادرة مطلوب" : "Departure Date is required";
                isValid = false;
            }
            if (!form.returnDate) {
                errors.returnDate = isAr ? "تاريخ العودة مطلوب" : "Return Date is required";
                isValid = false;
            } else if (form.departureDate && form.returnDate < form.departureDate) {
                errors.returnDate = isAr ? "تاريخ العودة يجب أن يكون بعد المغادرة" : "Return Date must be after Departure";
                isValid = false;
            }
            if (!form.purpose.trim()) {
                errors.purpose = isAr ? "الغرض من السفر مطلوب" : "Purpose is required";
                isValid = false;
            }
        }

        setFormErrors(errors);
        return isValid;
    }

    function goNext() {
        const isValid = validateStep(step);
        if (isValid) {
            if (step < 4) setStep((s) => (s + 1) as RequestFormStep);
        } else {
            // If validation fails, force re-render to show errors immediately
            // (setFormErrors is already called in validateStep)
        }
    }

    function goPrev() {
        if (step > 1) setStep((s) => (s - 1) as RequestFormStep);
    }

    function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
        onSubmit(event, {
            baseTripEstimatedCost: tripEstimatedAmount,
            additionalServicesEstimatedCost: servicesTotalAmount,
            totalEstimatedCost: totalEstimatedAmount,
            serviceCostOverrides: normalizedServiceOverrides,
        });
    }

    const previousLabel = isAr ? "\u0627\u0644\u0633\u0627\u0628\u0642" : "Previous";
    const nextLabel = isAr ? "\u0627\u0644\u062a\u0627\u0644\u064a" : "Next";

    return (
        <form className="mt-2 space-y-4" onSubmit={handleFormSubmit}>
            {/* Session employee card */}
            {sessionUser && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-gradient-to-r from-primary/5 to-transparent px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-finance">{sessionUser.name}</p>
                        <p className="text-[11px] text-muted-foreground">{sessionUser.email}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                        {isAr ? "\u0645\u0642\u062f\u0645 \u0627\u0644\u0637\u0644\u0628" : "Requester"}
                    </span>
                </div>
            )}

            {/* Step bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
                {steps.map((s) => {
                    const Icon = STEP_ICONS[s.id];
                    const isActive = step === s.id;
                    const isDone = step > s.id;
                    return (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => setStep(s.id)}
                            className={`flex min-w-max items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] lg:text-xs font-medium transition ${isActive
                                ? "border-primary bg-primary text-white shadow-sm"
                                : isDone
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-border bg-white text-muted-foreground hover:bg-slate-50"
                                }`}
                        >
                            {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                            {s.label}
                        </button>
                    );
                })}
            </div>

            {step >= 3 && (
                <aside className="rounded-lg border border-primary/20 bg-blue-50/40 p-3 lg:ms-auto lg:w-[320px]">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                        {isAr ? "\u0645\u0644\u062e\u0635 \u0627\u0644\u0631\u062d\u0644\u0629" : "Trip Summary"}
                    </p>
                    <div className="mt-2 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{isAr ? "\u0627\u0644\u0645\u0633\u0627\u0631" : "Route"}</span>
                            <span className="font-medium text-finance">
                                {(form.origin || "-") + " -> " + (form.destination || "-")}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{isAr ? "\u0627\u0644\u0631\u062d\u0644\u0629" : "Trip"}</span>
                            <span className="font-medium text-finance">
                                {formatCurrency(tripEstimatedAmount, locale, form.currency || "SAR")}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{isAr ? "\u0627\u0644\u062e\u062f\u0645\u0627\u062a" : "Services"}</span>
                            <span className="font-medium text-finance">
                                {formatCurrency(servicesTotalAmount, locale, form.currency || "SAR")}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-primary/10 pt-1.5">
                            <span className="text-muted-foreground">{isAr ? "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a" : "Total"}</span>
                            <span className="font-bold text-primary">
                                {formatCurrency(totalEstimatedAmount, locale, form.currency || "SAR")}
                            </span>
                        </div>
                    </div>
                </aside>
            )}

            {/* Step 1: Customer Selection */}
            {step === 1 && (
                <div className={formBlockClass}>
                    <div className="mb-3">
                        <p className="text-sm font-semibold text-finance">
                            {isAr ? "\u0631\u0628\u0637 \u0627\u0644\u0639\u0645\u064a\u0644" : "Link Customer"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            {isAr
                                ? "\u0627\u062e\u062a\u0631 \u0639\u0645\u064a\u0644\u0627\u064b \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645 \u0644\u0631\u0628\u0637\u0647 \u0628\u0637\u0644\u0628 \u0627\u0644\u0633\u0641\u0631 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)."
                                : "Select a customer to link to this travel request (optional)."}
                        </p>
                    </div>

                    {selectedCustomer ? (
                        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-blue-50/60 to-white p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-finance">{selectedCustomer.name}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{selectedCustomer.email}</p>
                                    <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${segmentColors[selectedCustomer.segment] ?? ""}`}>
                                        {selectedCustomer.segment}
                                    </span>
                                    <Button type="button" variant="ghost" size="sm" onClick={handleClearCustomer}>
                                        {isAr ? "\u062a\u063a\u064a\u064a\u0631" : "Change"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <InputWithIcon
                                icon={<Search className="h-4 w-4" />}
                                iconPosition="start"
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                dir="auto"
                                lang={isAr ? "ar" : "en"}
                                placeholder={isAr ? "\u0627\u0628\u062d\u062b \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0628\u0631\u064a\u062f \u0623\u0648 \u0627\u0644\u0647\u0627\u062a\u0641..." : "Search by name, email, or phone..."}
                            />
                            <div className="mt-3 max-h-[240px] space-y-1.5 overflow-auto">
                                {filteredCustomers.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleSelectCustomer(c)}
                                        className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-3 py-2.5 text-start transition hover:border-primary/30 hover:bg-blue-50/40"
                                    >
                                        <div>
                                            <p className="text-xs font-semibold text-finance">{c.name}</p>
                                            <p className="text-[11px] text-muted-foreground">{c.email}</p>
                                        </div>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${segmentColors[c.segment] ?? ""}`}>
                                            {c.segment}
                                        </span>
                                    </button>
                                ))}
                                {filteredCustomers.length === 0 && (
                                    <p className="py-4 text-center text-xs text-muted-foreground">
                                        {isAr ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c" : "No customers found"}
                                    </p>
                                )}
                            </div>
                            <p className="mt-3 rounded-md border border-dashed border-border px-3 py-2 text-center text-[11px] text-muted-foreground">
                                {isAr ? "\u064a\u0645\u0643\u0646\u0643 \u062a\u062e\u0637\u064a \u0647\u0630\u0647 \u0627\u0644\u062e\u0637\u0648\u0629 \u0625\u0630\u0627 \u0644\u0645 \u064a\u0643\u0646 \u0647\u0646\u0627\u0643 \u0639\u0645\u064a\u0644 \u0645\u0631\u062a\u0628\u0637" : "You can skip this step if there is no associated customer"}
                            </p>
                        </>
                    )}
                </div>
            )}

            {/* Step 2: Trip Details + Schedule + Department */}
            {step === 2 && (
                <>
                    <div className={formBlockClass}>
                        <div className="mb-3">
                            <p className="text-sm font-semibold text-finance">{requestFormText.tripSection}</p>
                            <p className="text-[11px] text-muted-foreground">{requestFormText.tripHint}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className={fieldLabelClass}>
                                {t.form.tripType}
                                <Select value={form.tripType} onChange={(e) => updateForm("tripType", e.target.value as TripType)} className="mt-1">
                                    {(["domestic", "international"] as TripType[]).map((tt) => (
                                        <option key={tt} value={tt}>{t.tripType[tt]}</option>
                                    ))}
                                </Select>
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.travelClass}
                                <Select value={form.travelClass} onChange={(e) => updateForm("travelClass", e.target.value as TravelClass)} className="mt-1">
                                    {(["economy", "premium_economy", "business", "first"] as TravelClass[]).map((tc) => (
                                        <option key={tc} value={tc}>{t.travelClass[tc]}</option>
                                    ))}
                                </Select>
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.origin}
                                <DebouncedInput
                                    value={form.origin}
                                    onChange={(val) => updateForm("origin", val)}
                                    className={cn("mt-1", formErrors.origin && "border-red-500 focus:ring-red-200")}
                                    dir="auto"
                                    lang={isAr ? "ar" : "en"}
                                    required
                                />
                                {formErrors.origin && <p className="mt-1 text-[10px] text-red-500">{formErrors.origin}</p>}
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.destination}
                                <DebouncedInput
                                    value={form.destination}
                                    onChange={(val) => updateForm("destination", val)}
                                    className={cn("mt-1", formErrors.destination && "border-red-500 focus:ring-red-200")}
                                    dir="auto"
                                    lang={isAr ? "ar" : "en"}
                                    required
                                />
                                {formErrors.destination && <p className="mt-1 text-[10px] text-red-500">{formErrors.destination}</p>}
                            </label>
                        </div>
                        <label className={`${fieldLabelClass} mt-3 block`}>
                            {t.form.purpose}
                            <DebouncedTextarea
                                value={form.purpose}
                                onChange={(value) => updateForm("purpose", value)}
                                className={cn("mt-1", formErrors.purpose && "border-red-500 focus:ring-red-200")}
                                dir="auto"
                                lang={isAr ? "ar" : "en"}
                                rows={2}
                                required
                            />
                            {formErrors.purpose && <p className="mt-1 text-[10px] text-red-500">{formErrors.purpose}</p>}
                        </label>
                    </div>

                    <div className={formBlockClass}>
                        <div className="mb-3">
                            <p className="text-sm font-semibold text-finance">{requestFormText.scheduleSection}</p>
                            <p className="text-[11px] text-muted-foreground">{requestFormText.scheduleHint}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className={fieldLabelClass}>
                                {t.form.departureDate}
                                <Input
                                    type="date"
                                    value={form.departureDate}
                                    onChange={(e) => updateForm("departureDate", e.target.value)}
                                    className={cn("mt-1", formErrors.departureDate && "border-red-500 focus:ring-red-200")}
                                    required
                                />
                                {formErrors.departureDate && <p className="mt-1 text-[10px] text-red-500">{formErrors.departureDate}</p>}
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.returnDate}
                                <Input
                                    type="date"
                                    value={form.returnDate}
                                    onChange={(e) => updateForm("returnDate", e.target.value)}
                                    className={cn("mt-1", formErrors.returnDate && "border-red-500 focus:ring-red-200")}
                                    required
                                />
                                {formErrors.returnDate && <p className="mt-1 text-[10px] text-red-500">{formErrors.returnDate}</p>}
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.estimatedCost}
                                <Input
                                    type="number"
                                    min={1}
                                    step={0.01}
                                    inputMode="decimal"
                                    value={form.estimatedCost}
                                    onChange={(e) => updateForm("estimatedCost", e.target.value)}
                                    className="mt-1"
                                    title={
                                        isAr
                                            ? "\u062a\u064f\u0633\u062a\u062e\u062f\u0645 \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u062a\u0642\u062f\u064a\u0631\u064a\u0629 \u0641\u064a \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0633\u064a\u0627\u0633\u0629 \u0648\u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062a."
                                            : "Estimated cost is used in policy checks and approval routing."
                                    }
                                    required
                                />
                                <span className="mt-1 block text-[10px] text-muted-foreground">
                                    {isAr
                                        ? "\u062a\u064f\u0633\u062a\u062e\u062f\u0645 \u0647\u0630\u0647 \u0627\u0644\u0642\u064a\u0645\u0629 \u0644\u062d\u0633\u0627\u0628 \u062d\u062f\u0648\u062f \u0627\u0644\u0633\u064a\u0627\u0633\u0629 \u0648\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062a."
                                        : "Used to evaluate policy limits and approval thresholds."}
                                </span>
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.currency}
                                <Input value={form.currency} onChange={(e) => updateForm("currency", e.target.value.toUpperCase())} className="mt-1 uppercase tracking-wide" maxLength={3} required />
                            </label>
                        </div>
                    </div>

                    <div className={formBlockClass}>
                        <div className="mb-3">
                            <p className="text-sm font-semibold text-finance">
                                {isAr ? "\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629" : "Organizational Details"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                {isAr ? "\u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0648\u0645\u0631\u0643\u0632 \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0648\u0627\u0644\u062f\u0631\u062c\u0629 \u0627\u0644\u0648\u0638\u064a\u0641\u064a\u0629." : "Department, cost center, and employee grade."}
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <label className={fieldLabelClass}>
                                {t.form.employeeGrade}
                                <Select value={form.employeeGrade} onChange={(e) => updateForm("employeeGrade", e.target.value as EmployeeGrade)} className="mt-1">
                                    {(["staff", "manager", "director", "executive"] as EmployeeGrade[]).map((g) => (
                                        <option key={g} value={g}>{t.grade[g]}</option>
                                    ))}
                                </Select>
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.department}
                                <Input
                                    value={form.department}
                                    onChange={(e) => updateForm("department", e.target.value)}
                                    className="mt-1"
                                    dir="auto"
                                    lang={isAr ? "ar" : "en"}
                                    required
                                />
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.costCenter}
                                <Input
                                    value={form.costCenter}
                                    onChange={(e) => updateForm("costCenter", e.target.value)}
                                    className="mt-1"
                                    dir="auto"
                                    lang={isAr ? "ar" : "en"}
                                    title={
                                        isAr
                                            ? "\u0645\u062b\u0627\u0644: CC-SALES-001. \u064a\u064f\u0633\u062a\u062e\u062f\u0645 \u0645\u0631\u0643\u0632 \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0644\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u0642\u064a\u0648\u062f \u0627\u0644\u0645\u062d\u0627\u0633\u0628\u064a\u0629."
                                            : "Example: CC-SALES-001. Cost center controls accounting allocation."
                                    }
                                    required
                                />
                                <span className="mt-1 block text-[10px] text-muted-foreground">
                                    {isAr
                                        ? "\u0623\u062f\u062e\u0644 \u0631\u0645\u0632 \u0645\u0631\u0643\u0632 \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0639\u062a\u0645\u062f (\u0645\u062b\u0644 CC-SALES-001)."
                                        : "Enter the approved cost center code (for example: CC-SALES-001)."}
                                </span>
                            </label>
                        </div>
                    </div>

                    <AdvisorPanel
                        input={{
                            employeeGrade: form.employeeGrade,
                            tripType: form.tripType,
                            departureDate: form.departureDate,
                            estimatedCost: Number(form.estimatedCost) || undefined,
                        }}
                    />
                </>
            )}

            {/* Step 3: Linked Services */}
            {step === 3 && (
                <div className={formBlockClass}>
                    <div className="mb-3">
                        <p className="text-sm font-semibold text-finance">
                            {isAr ? "\u0631\u0628\u0637 \u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0628\u0627\u0644\u0631\u062d\u0644\u0629" : "Link Services to Trip"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            {isAr
                                ? "\u0627\u062e\u062a\u0631 \u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0627\u0644\u0631\u062d\u0644\u0629\u060c \u0645\u0639 \u0625\u0645\u0643\u0627\u0646\u064a\u0629 \u0627\u0644\u0628\u062d\u062b \u0648\u0627\u0644\u062a\u0635\u0646\u064a\u0641 \u0648\u0625\u0636\u0627\u0641\u0629 \u062e\u062f\u0645\u0629 \u062c\u062f\u064a\u062f\u0629 \u0641\u0648\u0631\u064a\u0627\u064b."
                                : "Search, filter, and link managed services. You can also create a new service inline."}
                        </p>
                    </div>

                    <SlideOver
                        isOpen={isQuickCreateOpen}
                        onClose={() => setIsQuickCreateOpen(false)}
                        title={isAr ? "\u0625\u0636\u0627\u0641\u0629 \u062e\u062f\u0645\u0629 \u062c\u062f\u064a\u062f\u0629" : "Add New Service"}
                        description={isAr ? "\u0625\u0646\u0634\u0627\u0621 \u062e\u062f\u0645\u0629 \u0645\u0646 \u0646\u0641\u0633 \u0646\u0645\u0648\u0630\u062c \u0637\u0644\u0628 \u0627\u0644\u0633\u0641\u0631 \u0628\u062f\u0648\u0646 \u0641\u0642\u062f\u0627\u0646 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a." : "Create a service record inline without leaving this form."}
                    >
                        <div className="space-y-3">
                            <label className={fieldLabelClass}>
                                {isAr ? "\u0627\u0644\u0641\u0626\u0629" : "Category"}
                                <Select
                                    value={quickCreateCategory}
                                    onChange={(e) => setQuickCreateCategory(e.target.value)}
                                    className="mt-1"
                                >
                                    {serviceCategories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {isAr ? cat.labelAr : cat.labelEn}
                                        </option>
                                    ))}
                                    {uncataloguedCategoryIds.map((categoryId) => (
                                        <option key={categoryId} value={categoryId}>
                                            {categoryId}
                                        </option>
                                    ))}
                                </Select>
                            </label>
                            <label className={fieldLabelClass}>
                                {isAr ? "\u0627\u0633\u0645 \u0627\u0644\u062e\u062f\u0645\u0629" : "Service Name"}
                                <Input
                                    value={quickCreateDraft.serviceName}
                                    onChange={(e) =>
                                        setQuickCreateDraft((prev) => ({
                                            ...prev,
                                            serviceName: e.target.value,
                                        }))
                                    }
                                    className="mt-1"
                                    dir="auto"
                                    required
                                />
                            </label>
                            <label className={fieldLabelClass}>
                                {isAr ? "\u0627\u0644\u0645\u0632\u0648\u062f" : "Provider"}
                                <Input
                                    value={quickCreateDraft.provider}
                                    onChange={(e) =>
                                        setQuickCreateDraft((prev) => ({
                                            ...prev,
                                            provider: e.target.value,
                                        }))
                                    }
                                    className="mt-1"
                                    dir="auto"
                                />
                            </label>
                            <label className={fieldLabelClass}>
                                {isAr ? "\u0627\u0644\u0645\u062f\u064a\u0646\u0629/\u0627\u0644\u0645\u0648\u0642\u0639" : "City / Location"}
                                <Input
                                    value={quickCreateDraft.location}
                                    onChange={(e) =>
                                        setQuickCreateDraft((prev) => ({
                                            ...prev,
                                            location: e.target.value,
                                        }))
                                    }
                                    className="mt-1"
                                    dir="auto"
                                />
                            </label>
                            <label className={fieldLabelClass}>
                                {isAr ? "\u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u062a\u0642\u062f\u064a\u0631\u064a\u0629" : "Estimated Cost"}
                                <Input
                                    type="number"
                                    min={1}
                                    step={0.01}
                                    value={quickCreateDraft.totalAmount}
                                    onChange={(e) =>
                                        setQuickCreateDraft((prev) => ({
                                            ...prev,
                                            totalAmount: e.target.value,
                                        }))
                                    }
                                    className="mt-1"
                                    required
                                />
                            </label>
                            <label className={fieldLabelClass}>
                                {isAr ? "\u0645\u0644\u0627\u062d\u0638\u0627\u062a" : "Notes"}
                                <Textarea
                                    value={quickCreateDraft.notes}
                                    onChange={(e) =>
                                        setQuickCreateDraft((prev) => ({
                                            ...prev,
                                            notes: e.target.value,
                                        }))
                                    }
                                    className="mt-1"
                                    rows={3}
                                />
                            </label>
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setIsQuickCreateOpen(false)}
                                >
                                    {isAr ? "\u0625\u0644\u063a\u0627\u0621" : "Cancel"}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void handleQuickCreateService()}
                                    loading={isQuickCreateSaving}
                                >
                                    {isAr ? "\u062d\u0641\u0638 \u0648\u0625\u0636\u0627\u0641\u0629" : "Save & Add"}
                                </Button>
                            </div>
                        </div>
                    </SlideOver>

                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <InputWithIcon
                            icon={<Search className="h-4 w-4" />}
                            iconPosition="start"
                            value={serviceSearch}
                            onChange={(e) => setServiceSearch(e.target.value)}
                            placeholder={isAr ? "\u0627\u0628\u062d\u062b \u0628\u0627\u0633\u0645 \u0627\u0644\u062e\u062f\u0645\u0629\u060c \u0627\u0644\u0645\u0632\u0648\u062f \u0623\u0648 \u0627\u0644\u0645\u062f\u064a\u0646\u0629..." : "Search by service, provider, or city..."}
                            className="min-w-[230px] flex-1"
                            dir="auto"
                        />
                        <Button type="button" variant="secondary" onClick={openQuickCreateDrawer}>
                            <Plus className="me-1 h-3.5 w-3.5" />
                            {isAr ? "\u0625\u0636\u0627\u0641\u0629 \u062e\u062f\u0645\u0629 \u062c\u062f\u064a\u062f\u0629" : "Add Service"}
                        </Button>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setServiceFilter("all")}
                            className={cn(
                                "rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
                                serviceFilter === "all"
                                    ? "border-primary bg-primary text-white"
                                    : "border-border bg-white text-muted-foreground hover:bg-slate-50",
                            )}
                        >
                            {isAr ? "\u0627\u0644\u0643\u0644" : "All"}
                        </button>
                        {serviceCategories.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setServiceFilter(cat.id)}
                                className={cn(
                                    "rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
                                    serviceFilter === cat.id
                                        ? "border-primary bg-primary text-white"
                                        : "border-border bg-white text-muted-foreground hover:bg-slate-50",
                                )}
                            >
                                {isAr ? cat.labelAr : cat.labelEn}
                            </button>
                        ))}
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
                        <Layers className="h-4 w-4 text-primary" />
                        <Select
                            value={selectedBundleId}
                            onChange={(e) => setSelectedBundleId(e.target.value)}
                            size="sm"
                            className="w-[220px]"
                        >
                            <option value="none">{isAr ? "\u0628\u0627\u0642\u0627\u062a \u0627\u0644\u062e\u062f\u0645\u0627\u062a" : "Service Bundles"}</option>
                            {SERVICE_BUNDLES.map((bundle) => (
                                <option key={bundle.id} value={bundle.id}>
                                    {isAr ? bundle.labelAr : bundle.labelEn}
                                </option>
                            ))}
                        </Select>
                        <Button type="button" size="sm" variant="secondary" onClick={applyBundle}>
                            {isAr ? "\u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u062d\u0632\u0645\u0629" : "Apply Bundle"}
                        </Button>
                    </div>

                    {serviceNotice ? (
                        <p
                            className={cn(
                                "mb-3 rounded-lg px-3 py-2 text-xs font-medium",
                                serviceNotice.tone === "success"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700",
                            )}
                        >
                            {serviceNotice.message}
                        </p>
                    ) : null}

                    {selectedBookings.length > 0 && (
                        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                            <p className="text-[11px] font-semibold text-emerald-700">
                                {isAr ? "\u0627\u0644\u0645\u062e\u062a\u0627\u0631\u0629" : "Selected"}: {selectedBookings.length} |{" "}
                                {isAr ? "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a" : "Total"}: {formatCurrency(servicesTotalAmount, locale, form.currency || "SAR")}
                            </p>
                        </div>
                    )}

                    {(budgetExceeded || budgetNearCap) ? (
                        <div className={cn(
                            "mb-3 rounded-lg border px-3 py-2",
                            budgetExceeded
                                ? "border-rose-200 bg-rose-50"
                                : "border-amber-200 bg-amber-50",
                        )}>
                            <div className="flex items-start gap-2">
                                <AlertTriangle className={cn(
                                    "mt-0.5 h-4 w-4",
                                    budgetExceeded ? "text-rose-600" : "text-amber-600",
                                )} />
                                <div>
                                    <p className={cn(
                                        "text-xs font-semibold",
                                        budgetExceeded ? "text-rose-700" : "text-amber-700",
                                    )}>
                                        {budgetExceeded
                                            ? (isAr
                                                ? "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u062a\u062c\u0627\u0648\u0632 \u062d\u062f \u0627\u0644\u0633\u064a\u0627\u0633\u0629."
                                                : "Estimated total exceeds policy budget cap.")
                                            : (isAr
                                                ? "\u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0642\u062a\u0631\u0628\u062a \u0645\u0646 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0633\u064a\u0627\u0633\u0629."
                                                : "Estimated total is near policy budget cap.")}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        {isAr ? "\u0627\u0644\u062d\u062f" : "Cap"}: {formatCurrency(budgetCap, locale, form.currency)} |{" "}
                                        {isAr ? "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062d\u0627\u0644\u064a" : "Current total"}: {formatCurrency(totalEstimatedAmount, locale, form.currency)}
                                    </p>
                                    {cheaperAlternatives.length > 0 ? (
                                        <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                                            {cheaperAlternatives.map((suggestion) => (
                                                <li key={`${suggestion.currentId}-${suggestion.suggestedId}`}>
                                                    {isAr
                                                        ? `\u0628\u062f\u064a\u0644 \u0623\u0648\u0641\u0631: ${suggestion.suggestedId} (\u0648\u0641\u0631 ${formatCurrency(suggestion.savings, locale, form.currency)})`
                                                        : `Cheaper option: ${suggestion.suggestedId} (save ${formatCurrency(suggestion.savings, locale, form.currency)})`}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="max-h-[360px] space-y-1.5 overflow-auto">
                        {filteredBookings.map((b) => {
                            const catInfo = categoryById.get(b.category);
                            const isSelected = form.linkedServiceBookingIds.includes(b.id);
                            return (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => toggleServiceBooking(b.id)}
                                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-start transition ${isSelected
                                        ? "border-primary bg-blue-50/60"
                                        : "border-border bg-white hover:bg-slate-50"
                                        }`}
                                >
                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${isSelected ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"
                                        }`}>
                                        {isSelected && <Check className="h-3 w-3" />}
                                    </div>
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${catInfo?.bgColor ?? "bg-slate-50"}`}>
                                        <span className="text-[10px] font-bold">{b.id.split("-")[0]}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-semibold text-finance truncate">
                                                {getBookingServiceName(b)} - {b.customerName}
                                            </p>
                                            <span className="text-xs font-semibold text-finance whitespace-nowrap">
                                                {formatCurrency(b.totalAmount, locale, b.currency)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {(isAr ? catInfo?.labelAr : catInfo?.labelEn) ?? b.category}
                                            {" | "}
                                            {getBookingProvider(b) || b.status}
                                            {" | "}
                                            {getBookingLocation(b)}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                        {filteredBookings.length === 0 && (
                            <p className="py-6 text-center text-xs text-muted-foreground">
                                {isAr ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u062c\u0648\u0632\u0627\u062a \u062e\u062f\u0645\u0627\u062a \u0645\u062a\u0627\u062d\u0629" : "No service bookings available"}
                            </p>
                        )}
                    </div>

                    {selectedBookings.length > 0 ? (
                        <div className="mt-3 space-y-2 rounded-lg border border-border bg-white p-3">
                            <p className="text-[11px] font-semibold text-finance">
                                {isAr ? "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0641\u0639\u0644\u064a\u0629 \u0644\u0644\u0637\u0644\u0628" : "Adjust actual cost for this request"}
                            </p>
                            {selectedBookings.map((booking) => (
                                <div key={`override-${booking.id}`} className="grid gap-2 sm:grid-cols-[1fr_180px]">
                                    <div className="truncate text-xs text-muted-foreground">
                                        {booking.id} - {getBookingServiceName(booking)}
                                    </div>
                                    <Input
                                        type="number"
                                        min={1}
                                        step={0.01}
                                        value={serviceAmountOverrides[booking.id] ?? ""}
                                        onChange={(event) =>
                                            setServiceAmountOverrides((prev) => ({
                                                ...prev,
                                                [booking.id]: event.target.value,
                                            }))
                                        }
                                        placeholder={booking.totalAmount.toString()}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            )}
            {/* Step 4: Review & Submit */}
            {step === 4 && (
                <div className="space-y-3">
                    {/* Requester from session */}
                    {sessionUser && (
                        <div className="rounded-lg border border-border bg-white p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {isAr ? "\u0645\u0642\u062f\u0645 \u0627\u0644\u0637\u0644\u0628" : "Requester"}
                            </p>
                            <p className="mt-1 text-sm font-bold text-finance">{sessionUser.name}</p>
                            <p className="text-xs text-muted-foreground">{sessionUser.email}</p>
                        </div>
                    )}

                    {selectedCustomer && (
                        <div className="rounded-lg border border-primary/20 bg-blue-50/40 px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                                {isAr ? "\u0627\u0644\u0639\u0645\u064a\u0644 \u0627\u0644\u0645\u0631\u062a\u0628\u0637" : "Linked Customer"}
                            </p>
                            <p className="mt-1 text-sm font-bold text-finance">{selectedCustomer.name}</p>
                            <p className="text-xs text-muted-foreground">{selectedCustomer.email} | {selectedCustomer.phone}</p>
                        </div>
                    )}

                    <div className="rounded-lg border border-border bg-white p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isAr ? "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0631\u062d\u0644\u0629" : "Trip Details"}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <ReviewRow label={t.form.tripType} value={t.tripType[form.tripType]} />
                            <ReviewRow label={t.form.travelClass} value={t.travelClass[form.travelClass]} />
                            <ReviewRow label={t.form.origin} value={form.origin} />
                            <ReviewRow label={t.form.destination} value={form.destination} />
                            <ReviewRow
                                label={t.form.departureDate}
                                value={formatReviewDate(form.departureDate, locale)}
                            />
                            <ReviewRow
                                label={t.form.returnDate}
                                value={formatReviewDate(form.returnDate, locale)}
                            />
                            <ReviewRow label={t.form.employeeGrade} value={t.grade[form.employeeGrade]} />
                            <ReviewRow label={t.form.department} value={form.department} />
                            <ReviewRow label={t.form.costCenter} value={form.costCenter} />
                            <ReviewRow label={t.form.purpose} value={form.purpose} />
                        </div>
                    </div>

                    {selectedBookings.length > 0 && (
                        <div className="rounded-lg border border-border bg-white p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {isAr ? "\u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0645\u0631\u062a\u0628\u0637\u0629" : "Linked Services"}
                                </p>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    {selectedBookings.length}
                                </span>
                            </div>
                            <div className="mt-2 space-y-1.5">
                                {selectedBookings.map((b) => {
                                    const catInfo = categoryById.get(b.category);
                                    return (
                                        <div key={b.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-xs">
                                            <span className="text-finance font-medium">
                                                {b.id} - {(isAr ? catInfo?.labelAr : catInfo?.labelEn) ?? b.category}
                                            </span>
                                            <span className="font-semibold text-finance">{formatCurrency(resolveServiceAmount(b), locale, b.currency)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                        <p className="text-xs font-semibold text-finance">
                            {isAr ? "\u0627\u0644\u062a\u0644\u062e\u064a\u0635 \u0627\u0644\u0645\u0627\u0644\u064a" : "Financial Summary"}
                        </p>
                        <div className="mt-2 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{isAr ? "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0631\u062d\u0644\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629" : "Base trip cost"}</span>
                                <span className="font-semibold text-finance">{formatCurrency(tripEstimatedAmount, locale, form.currency)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{isAr ? "\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0625\u0636\u0627\u0641\u064a\u0629" : "Additional services"}</span>
                                <span className="font-semibold text-finance">{formatCurrency(servicesTotalAmount, locale, form.currency || "SAR")}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-primary/20 pt-1.5">
                                <span className="font-semibold text-finance">{isAr ? "\u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0629 \u0627\u0644\u0645\u0642\u062f\u0631\u0629" : "Total estimated cost"}</span>
                                <span className="text-lg font-bold text-primary">
                                    {formatCurrency(
                                        totalEstimatedAmount,
                                        locale,
                                        form.currency,
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    <AdvisorPanel
                        input={{
                            employeeGrade: form.employeeGrade,
                            tripType: form.tripType,
                            departureDate: form.departureDate,
                            estimatedCost: totalEstimatedAmount || undefined,
                        }}
                    />
                </div>
            )}

            {/* Navigation */}
            <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="secondary" onClick={goPrev} disabled={step === 1}>
                    {previousLabel}
                </Button>
                {step < 4 ? (
                    <Button type="button" onClick={goNext}>
                        {step === 1
                            ? (isAr ? (form.customerId ? "\u0627\u0644\u062a\u0627\u0644\u064a" : "\u062a\u062e\u0637\u064a") : (form.customerId ? "Next" : "Skip"))
                            : step === 3
                                ? (isAr ? (form.linkedServiceBookingIds.length ? "\u0627\u0644\u062a\u0627\u0644\u064a" : "\u062a\u062e\u0637\u064a") : (form.linkedServiceBookingIds.length ? "Next" : "Skip"))
                                : nextLabel}
                    </Button>
                ) : (
                    <Button
                        type="submit"
                        loading={isCreating}
                        className="w-full"
                        disabled={isCreating || !canCreate || !sessionUser}
                    >
                        {t.labels.submitDraft}
                    </Button>
                )}
            </div>
        </form>
    );
}

interface DebouncedInputProps extends Omit<ComponentProps<typeof Input>, "value" | "onChange"> {
    value: string;
    onChange: (value: string) => void;
    delayMs?: number;
}

function DebouncedInput({
    value,
    onChange,
    delayMs = FORM_INPUT_SYNC_DELAY_MS,
    onBlur,
    ...props
}: DebouncedInputProps) {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        if (localValue === value) {
            return;
        }
        const timeout = window.setTimeout(() => {
            onChange(localValue);
        }, delayMs);
        return () => window.clearTimeout(timeout);
    }, [delayMs, localValue, onChange, value]);

    function flushPending() {
        if (localValue !== value) {
            onChange(localValue);
        }
    }

    return (
        <Input
            {...props}
            value={localValue}
            onChange={(event) => setLocalValue(event.target.value)}
            onBlur={(event) => {
                onBlur?.(event);
                flushPending();
            }}
        />
    );
}

interface DebouncedTextareaProps extends Omit<ComponentProps<typeof Textarea>, "value" | "onChange"> {
    value: string;
    onChange: (value: string) => void;
    delayMs?: number;
}

function DebouncedTextarea({
    value,
    onChange,
    delayMs = FORM_INPUT_SYNC_DELAY_MS,
    onBlur,
    ...props
}: DebouncedTextareaProps) {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        if (localValue === value) {
            return;
        }
        const timeout = window.setTimeout(() => {
            onChange(localValue);
        }, delayMs);
        return () => window.clearTimeout(timeout);
    }, [delayMs, localValue, onChange, value]);

    function flushPending() {
        if (localValue !== value) {
            onChange(localValue);
        }
    }

    return (
        <Textarea
            {...props}
            value={localValue}
            onChange={(event) => setLocalValue(event.target.value)}
            onBlur={(event) => {
                onBlur?.(event);
                flushPending();
            }}
        />
    );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
    return (
        <>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-finance truncate">{value || "-"}</span>
        </>
    );
}
