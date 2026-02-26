"use client";

import { Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";

// Notification hook. In a real app this would connect to SSE or WebSockets.
export function useNotifications() {
    const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; time: string; read: boolean }>>([]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    return { notifications, unreadCount, markAllRead };
}

export function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const locale = useLocale();
    const isAr = locale === "ar";
    const { notifications, unreadCount, markAllRead } = useNotifications();

    // Close when clicking outside
    useEffect(() => {
        if (!isOpen) return;
        function handle(e: MouseEvent) {
            if (!(e.target as Element).closest(".nc-container")) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [isOpen]);

    return (
        <div className="relative nc-container">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="relative flex items-center justify-center rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Notifications"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute end-0 top-full z-50 mt-1 w-80 rounded-xl border border-border bg-white p-3 shadow-lg lg:w-96">
                    <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-2">
                        <h3 className="font-semibold text-finance">{isAr ? "الإشعارات" : "Notifications"}</h3>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={markAllRead}
                                className="text-[11px] font-medium text-primary hover:underline"
                            >
                                {isAr ? "تحديد الكل كمقروء" : "Mark all read"}
                            </button>
                        )}
                    </div>
                    <div className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
                        {notifications.map((n) => (
                            <div
                                key={n.id}
                                className={cn(
                                    "flex flex-col gap-1 rounded-lg p-2.5 transition-colors",
                                    n.read ? "bg-white" : "bg-blue-50/50"
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p className={cn("text-xs font-semibold", n.read ? "text-slate-700" : "text-finance")}>{n.title}</p>
                                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(n.time, locale)}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground line-clamp-2">{n.message}</p>
                            </div>
                        ))}
                        {notifications.length === 0 && (
                            <p className="py-6 text-center text-xs text-muted-foreground">
                                {isAr ? "لا توجد إشعارات" : "No notifications"}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
