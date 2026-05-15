import {
  LayoutDashboard, Users, CreditCard, Clock, AlertCircle,
  MessageSquare, Library, ScrollText, ArrowLeft, Menu, X
} from "lucide-react";
import { useState } from "react";

export type AdminView =
  | "dashboard" | "users" | "plans" | "pending-songs"
  | "reports" | "suggestions" | "global-library" | "activity-logs";

interface Props {
  activeView: AdminView;
  onNavigate: (view: AdminView) => void;
  adminEmail: string;
  badges?: Partial<Record<AdminView, number>>;
}

const NAV_ITEMS: { id: AdminView; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "users", label: "Usuarios", icon: <Users size={18} /> },
  { id: "plans", label: "Planes", icon: <CreditCard size={18} /> },
  { id: "pending-songs", label: "Pendientes", icon: <Clock size={18} /> },
  { id: "reports", label: "Reportes", icon: <AlertCircle size={18} /> },
  { id: "suggestions", label: "Sugerencias", icon: <MessageSquare size={18} /> },
  { id: "global-library", label: "Biblioteca", icon: <Library size={18} /> },
  { id: "activity-logs", label: "Logs", icon: <ScrollText size={18} /> },
];

export default function AdminSidebar({ activeView, onNavigate, adminEmail, badges = {} }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`admin-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="admin-sidebar-header">
        <button className="admin-sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
        {!collapsed && <span className="admin-sidebar-title">Proclama Admin</span>}
      </div>

      <nav className="admin-sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`admin-nav-item ${activeView === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : undefined}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
            {badges[item.id] && badges[item.id]! > 0 && (
              <span className="admin-nav-badge">{badges[item.id]}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        {!collapsed && <span className="admin-email">{adminEmail}</span>}
        <button className="admin-nav-item back" onClick={() => (window.location.href = "/")}>
          <ArrowLeft size={18} />
          {!collapsed && <span>Volver a Proclama</span>}
        </button>
      </div>
    </aside>
  );
}
