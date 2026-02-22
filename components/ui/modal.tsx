"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { Button } from "./button";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
};

export function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    footer,
    size = "md",
}: ModalProps) {
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
            <div
                className={cn(
                    "fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            <div
                className={cn(
                    "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none transition-all duration-200",
                    isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95"
                )}
            >
                <div
                    className={cn(
                        "w-full bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]",
                        sizeClasses[size]
                    )}
                >
                    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                {title}
                            </h2>
                            {description && (
                                <p className="mt-1 text-sm text-slate-500">{description}</p>
                            )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-slate-100/50 hover:bg-slate-200">
                            <span className="sr-only">Close</span>
                            <X className="h-5 w-5" aria-hidden="true" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-6">
                        {children}
                    </div>

                    {footer && (
                        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
