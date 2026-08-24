import React from "react";

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-12) var(--space-8)",
                textAlign: "center",
                gap: "var(--space-4)",
            }}
        >
            {icon && (
                <div
                    style={{
                        width: 52,
                        height: 52,
                        borderRadius: "var(--radius-lg)",
                        background: "var(--bg-surface-raised)",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        color: "var(--text-muted)",
                        marginBottom: "var(--space-2)",
                    }}
                >
                    {icon}
                </div>
            )}
            <div>
                <p style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
                    {title}
                </p>
                {description && (
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", maxWidth: 380, lineHeight: 1.6 }}>
                        {description}
                    </p>
                )}
            </div>
            {action && <div style={{ marginTop: "var(--space-2)" }}>{action}</div>}
        </div>
    );
}
