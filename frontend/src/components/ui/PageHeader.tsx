import React from "react";

interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
}

export default function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "var(--space-8)",
                gap: "var(--space-6)",
                flexWrap: "wrap",
            }}
        >
            <div>
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                <h1 className="page-title" style={{ marginBottom: description ? "var(--space-2)" : 0 }}>
                    {title}
                </h1>
                {description && (
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", maxWidth: 560, lineHeight: 1.6, marginTop: "var(--space-1)" }}>
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexShrink: 0 }}>
                    {actions}
                </div>
            )}
        </div>
    );
}
