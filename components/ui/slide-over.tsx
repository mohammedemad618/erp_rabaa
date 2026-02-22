"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { Button } from "./button";

interface SlideOverProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl" | "full";
}

const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[calc(100vw-2rem)]",
};

export function SlideOver({
    isOpen,
    onClose,
    title,
    description,
    children,
    footer,
    size = "md",
}: SlideOverProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen, mounted]);

    if (!mounted) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={cn(
                    "fixed inset-y-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:ring-1 sm:ring-slate-900/10 ltr:right-0 rtl:left-0",
                    sizeClasses[size],
                    isOpen ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"
                )}
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900" id="slide-over-title">
                            {title}
                        </h2>
                        {description && (
                            <p className="mt-1 text-sm text-slate-500">{description}</p>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full ltr:-mr-2 rtl:-ml-2">
                        <span className="sr-only">Close panel</span>
                        <X className="h-5 w-5" aria-hidden="true" />
                    </Button>
                </div>

                <div className="relative flex-1 overflow-y-auto px-6 py-6 sm:px-8 bg-slate-50/50">
                    {children}
                </div>

                {footer && (
                    <div className="flex flex-shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                        {footer}
                    </div>
                )}
            </div>
        </>
    );
}
