import React from "react";

export type TrendDir = "up" | "down" | "neutral";

export interface StatCardProps {
  label: string;
  value: string | number;
  supporting?: string;
  trend?: string;
  trendDir?: TrendDir;
  icon?: React.ReactNode;
  loading?: boolean;
}

export default function StatCard({
  label,
  value,
  supporting,
  trend,
  trendDir = "neutral",
  icon,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="stat-card">
        <div className="stat-card-header">
          <div className="skeleton" style={{ height: 13, width: "55%" }} />
          <div className="skeleton" style={{ height: 32, width: 32, borderRadius: "var(--radius-md)" }} />
        </div>
        <div className="skeleton" style={{ height: 38, width: "45%", margin: "var(--sp-3) 0 var(--sp-2)" }} />
        <div className="skeleton" style={{ height: 12, width: "70%" }} />
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {icon && <span className="stat-card-icon">{icon}</span>}
      </div>

      <div className="stat-card-value">{value}</div>

      <div className="stat-card-footer">
        {trend && (
          <span className={`stat-trend ${trendDir}`}>
            {trendDir === "up" ? "↑" : trendDir === "down" ? "↓" : "→"} {trend}
          </span>
        )}
        {supporting && (
          <span className="stat-supporting">{supporting}</span>
        )}
      </div>
    </div>
  );
}
