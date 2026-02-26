import React, { useEffect, useState } from "react";
import { Input, type InputProps } from "@/components/ui/input";

export interface DebouncedInputProps extends Omit<InputProps, "value" | "onChange"> {
    value: string;
    onChange: (value: string) => void;
    debounce?: number;
}

export const DebouncedInput = React.forwardRef<HTMLInputElement, DebouncedInputProps>(
    ({ value: initialValue, onChange, debounce = 500, ...props }, ref) => {
        const [value, setValue] = useState(initialValue);

        useEffect(() => {
            setValue(initialValue);
        }, [initialValue]);

        useEffect(() => {
            const timeout = setTimeout(() => {
                if (value !== initialValue) {
                    onChange(value);
                }
            }, debounce);
            return () => clearTimeout(timeout);
        }, [value, initialValue, debounce, onChange]);

        return (
            <Input
                {...props}
                ref={ref}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={(e) => {
                    e.target.select();
                    props.onFocus?.(e);
                }}
            />
        );
    }
);
DebouncedInput.displayName = "DebouncedInput";
