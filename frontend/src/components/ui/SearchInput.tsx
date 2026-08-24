import React, { useState } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";

interface SearchInputProps {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    style?: React.CSSProperties;
}

export default function SearchInput({
    placeholder = "Search…",
    value,
    onChange,
    style,
}: SearchInputProps) {
    const [focused, setFocused] = useState(false);

    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                ...style,
            }}
        >
            <span
                style={{
                    position: "absolute",
                    left: 12,
                    color: focused ? "var(--accent)" : "var(--text-muted)",
                    fontSize: 15,
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "none",
                    transition: "color var(--transition-fast)",
                }}
            >
                <HiMagnifyingGlass />
            </span>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                    width: "100%",
                    paddingLeft: 36,
                    paddingRight: 14,
                    paddingTop: 9,
                    paddingBottom: 9,
                    background: "var(--bg-input)",
                    border: `1px solid ${focused ? "var(--accent-border)" : "var(--border-default)"}`,
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                    outline: "none",
                    transition: "border-color var(--transition-fast)",
                }}
            />
        </div>
    );
}
