import React from "react";

type BadgeVariant = "success" | "warning" | "danger" | "accent" | "neutral";
type BadgeSize = "sm" | "md";

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
    dot?: boolean;
    style?: React.CSSProperties;
}

export default function Badge({
    children,
    variant = "neutral",
    size = "md",
    dot = false,
    style,
}: BadgeProps) {
    const variants: Record<BadgeVariant, React.CSSProperties> = {
        success: {
            background: "var(--success-subtle)",
            color: "var(--success-text)",
            border: "1px solid rgba(34,197,94,0.2)",
        },
        warning: {
            background: "var(--warning-subtle)",
            color: "var(--warning-text)",
            border: "1px solid rgba(245,158,11,0.2)",
        },
        danger: {
            background: "var(--danger-subtle)",
            color: "var(--danger-text)",
            border: "1px solid rgba(239,68,68,0.2)",
        },
        accent: {
            background: "var(--accent-subtle)",
            color: "var(--accent)",
            border: "1px solid var(--accent-border)",
        },
        neutral: {
            background: "var(--neutral-subtle)",
            color: "var(--neutral-text)",
            border: "1px solid var(--border-subtle)",
        },
    };

    const sizes: Record<BadgeSize, React.CSSProperties> = {
        sm: { fontSize: "var(--text-xs)", padding: "2px 7px" },
        md: { fontSize: "var(--text-sm)", padding: "4px 10px" },
    };

    const dotColours: Record<BadgeVariant, string> = {
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        accent: "var(--accent)",
        neutral: "var(--neutral-text)",
    };

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontWeight: 600,
                borderRadius: "var(--radius-full)",
                whiteSpace: "nowrap",
                lineHeight: 1,
                ...sizes[size],
                ...variants[variant],
                ...style,
            }}
        >
            {dot && (
                <span
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: dotColours[variant],
                        flexShrink: 0,
                    }}
                />
            )}
            {children}
        </span>
    );
}
