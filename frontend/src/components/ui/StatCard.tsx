import React from "react";

type TrendDirection = "up" | "down" | "neutral";

interface StatCardProps {
    label: string;
    value: string | number;
    supporting?: string;
    trend?: string;
    trendDirection?: TrendDirection;
    icon?: React.ReactNode;
    loading?: boolean;
    style?: React.CSSProperties;
}

export default function StatCard({
    label,
    value,
    supporting,
    trend,
    trendDirection = "neutral",
    icon,
    loading = false,
    style,
}: StatCardProps) {
    const trendColours: Record<TrendDirection, string> = {
        up: "var(--success-text)",
        down: "var(--danger-text)",
        neutral: "var(--text-muted)",
    };

    const trendArrow: Record<TrendDirection, string> = {
        up: "↑",
        down: "↓",
        neutral: "→",
    };

    if (loading) {
        return (
            <div
                style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-6)",
                    boxShadow: "var(--shadow-sm)",
                    ...style,
                }}
            >
                <div className="skeleton" style={{ height: 12, width: "55%", marginBottom: 14 }} />
                <div className="skeleton" style={{ height: 30, width: "40%", marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 11, width: "70%" }} />
            </div>
        );
    }

    return (
        <div
            style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-6)",
                boxShadow: "var(--shadow-sm)",
                display: "flex",
                flexDirection: "column",
                gap: 0,
                ...style,
            }}
        >
            {/* Label row */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "var(--space-3)",
                }}
            >
                <span
                    style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--text-secondary)",
                        fontWeight: 500,
                    }}
                >
                    {label}
                </span>
                {icon && (
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 32,
                            height: 32,
                            borderRadius: "var(--radius-md)",
                            background: "var(--accent-subtle)",
                            color: "var(--accent)",
                            fontSize: 15,
                            flexShrink: 0,
                        }}
                    >
                        {icon}
                    </span>
                )}
            </div>

            {/* Value */}
            <span
                style={{
                    fontSize: "var(--text-3xl)",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    marginBottom: "var(--space-2)",
                }}
            >
                {value}
            </span>

            {/* Supporting + Trend */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    flexWrap: "wrap",
                    marginTop: "var(--space-1)",
                }}
            >
                {trend && (
                    <span
                        style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            color: trendColours[trendDirection],
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                        }}
                    >
                        {trendArrow[trendDirection]} {trend}
                    </span>
                )}
                {supporting && (
                    <span
                        style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-muted)",
                        }}
                    >
                        {supporting}
                    </span>
                )}
            </div>
        </div>
    );
}
