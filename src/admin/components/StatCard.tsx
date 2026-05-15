import type { ReactNode } from "react";

interface Props {
  label: string;
  value: number | string;
  icon: ReactNode;
  accentColor?: string;
  onClick?: () => void;
  active?: boolean;
}

export default function StatCard({ label, value, icon, accentColor, onClick, active }: Props) {
  return (
    <div
      className={`admin-stat-card ${active ? "active" : ""}`}
      onClick={onClick}
      style={active && accentColor ? { borderColor: accentColor } : undefined}
    >
      <span className="admin-stat-label">{label}</span>
      <span className="admin-stat-value">{value}</span>
      <div className="admin-stat-icon" style={accentColor ? { color: accentColor } : undefined}>
        {icon}
      </div>
    </div>
  );
}
