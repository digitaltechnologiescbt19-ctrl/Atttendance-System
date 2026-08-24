import React from "react";

interface CardProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    padding?: "none" | "sm" | "md" | "lg";
    elevated?: boolean;
    onClick?: () => void;
}

export default function Card({
    children,
    style,
    className,
    padding = "md",
    elevated = false,
    onClick,
}: CardProps) {
    const paddings = {
        none: "0",
        sm: "var(--space-4)",
        md: "var(--space-6)",
        lg: "var(--space-8)",
    };

    const base: React.CSSProperties = {
        background: elevated ? "var(--bg-surface-raised)" : "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: paddings[padding],
        boxShadow: elevated ? "var(--shadow-md)" : "var(--shadow-sm)",
        cursor: onClick ? "pointer" : undefined,
        transition: onClick ? "border-color var(--transition-fast), box-shadow var(--transition-fast)" : undefined,
    };

    return (
        <div
            style={{ ...base, ...style }}
            className={className}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

/* ---------- Card sub-components ---------- */

interface CardHeaderProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    eyebrow?: string;
}

export function CardHeader({ title, subtitle, action, eyebrow }: CardHeaderProps) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "var(--space-5)",
            }}
        >
            <div>
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>
                {subtitle && (
                    <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        {subtitle}
                    </p>
                )}
            </div>
            {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
    );
}
