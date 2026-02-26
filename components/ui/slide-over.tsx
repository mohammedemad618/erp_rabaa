"use client";

import { X } from "lucide-react";
import { useEffect, useState, useRef } from "react";
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
    const panelRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        if (isOpen) {
            document.body.style.overflow = "hidden";
            // Store currently focused element
            previousActiveElement.current = document.activeElement as HTMLElement;
            // Focus the panel
            setTimeout(() => {
                panelRef.current?.focus();
            }, 50);
        } else {
            document.body.style.overflow = "unset";
            // Restore focus
            previousActiveElement.current?.focus();
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === "Escape") {
                onClose();
            }
            
            // Focus trap can be added here similar to Modal if needed
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = "unset";
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, mounted, onClose]);

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
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                ref={panelRef}
                className={cn(
                    "fixed inset-y-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:ring-1 sm:ring-slate-900/10 ltr:right-0 rtl:left-0 outline-none",
                    sizeClasses[size],
                    isOpen ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby="slide-over-title"
                aria-describedby={description ? "slide-over-description" : undefined}
                tabIndex={-1}
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900" id="slide-over-title">
                            {title}
                        </h2>
                        {description && (
                            <p id="slide-over-description" className="mt-1 text-sm text-slate-500">{description}</p>
                        )}
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onClose} 
                        className="rounded-full ltr:-mr-2 rtl:-ml-2"
                        aria-label="Close panel"
                    >
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
