import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: React.ReactNode;
    iconPosition?: "left" | "right";
    loading?: boolean;
    fullWidth?: boolean;
}

export default function Button({
    variant = "primary",
    size = "md",
    icon,
    iconPosition = "left",
    loading = false,
    fullWidth = false,
    children,
    disabled,
    style,
    ...rest
}: ButtonProps) {
    const base: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        border: "none",
        borderRadius: "var(--radius-md)",
        fontWeight: 600,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.55 : 1,
        transition: "background var(--t-fast), opacity var(--t-fast)",
        whiteSpace: "nowrap",
        width: fullWidth ? "100%" : undefined,
        outline: "none",
        letterSpacing: "0.01em",
    };

    const sizes: Record<ButtonSize, React.CSSProperties> = {
        sm: { padding: "7px 13px",  fontSize: "var(--tx-sm)" },
        md: { padding: "10px 18px", fontSize: "var(--tx-base)" },
        lg: { padding: "13px 24px", fontSize: "var(--tx-md)" },
    };

    const variants: Record<ButtonVariant, React.CSSProperties> = {
        primary:   { background: "var(--accent)",          color: "#fff" },
        secondary: { background: "var(--bg-surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border-default)" },
        ghost:     { background: "transparent",            color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" },
        danger:    { background: "var(--danger-subtle)",   color: "var(--danger-text)",    border: "1px solid rgba(239,68,68,0.25)" },
    };

    return (
        <button
            disabled={disabled || loading}
            style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
            {...rest}
        >
            {loading && (
                <span style={{
                    width: 13, height: 13,
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                    flexShrink: 0,
                }} />
            )}
            {!loading && icon && iconPosition === "left" && (
                <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
            )}
            {children}
            {!loading && icon && iconPosition === "right" && (
                <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
            )}
        </button>
    );
}
