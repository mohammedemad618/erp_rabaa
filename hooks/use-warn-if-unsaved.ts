"use client";

import { useEffect, useState } from "react";

export function useWarnIfUnsaved(isUnsaved: boolean, message: string = "You have unsaved changes. Are you sure you want to leave?") {
    const [shouldWarn, setShouldWarn] = useState(isUnsaved);

    useEffect(() => {
        setShouldWarn(isUnsaved);
    }, [isUnsaved]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (shouldWarn) {
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [shouldWarn, message]);

    return { shouldWarn };
}
