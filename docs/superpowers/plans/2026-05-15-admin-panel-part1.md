# Admin Panel Implementation Plan — Part 1 (Tasks 1-4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el scaffolding del admin panel (shell separado, guard, sidebar) y migrar las vistas existentes (Reports, Users) al nuevo shell.

**Architecture:** Mismo repo, shell separado montado en `/admin`. `App.tsx` detecta pathname y renderiza `AdminShell` en vez de `MainApp`. Sin react-router.

**Tech Stack:** React, Zustand, Supabase, Vite, Lucide Icons, Recharts

**Spec:** `docs/superpowers/specs/2026-05-15-admin-panel-design.md`

---

### Task 1: AdminGuard — Autenticación y autorización

**Files:**
- Create: `src/admin/AdminGuard.tsx`

- [ ] **Step 1: Create AdminGuard component**

```tsx
// src/admin/AdminGuard.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase";
import { Shield } from "lucide-react";

type GuardState = "loading" | "authorized" | "denied";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuardState>("loading");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/";
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      setState(data?.role === "admin" ? "authorized" : "denied");
    };
    check();
  }, []);

  if (state === "loading") {
    return (
      <div className="admin-guard-loading">
        <div className="admin-spinner" />
        <p>Verificando acceso...</p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="admin-guard-denied">
        <Shield size={48} />
        <h2>Acceso Denegado</h2>
        <p>No tienes permisos de administrador.</p>
        <button onClick={() => (window.location.href = "/")}>
          Volver a Proclama
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/admin/AdminGuard.tsx` or check IDE for errors.

---

### Task 2: AdminSidebar — Navegación lateral

**Files:**
- Create: `src/admin/AdminSidebar.tsx`

- [ ] **Step 1: Create AdminSidebar component**

```tsx
// src/admin/AdminSidebar.tsx
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
```

---

### Task 3: AdminShell + App.tsx integration

**Files:**
- Create: `src/admin/AdminShell.tsx`
- Modify: `src/App.tsx` (lines 30-33, 261-263)

- [ ] **Step 1: Create AdminShell**

```tsx
// src/admin/AdminShell.tsx
import { lazy, Suspense, useEffect, useState } from "react";
import AdminGuard from "./AdminGuard";
import AdminSidebar, { type AdminView } from "./AdminSidebar";
import { supabase } from "@/services/supabase";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const PlansPage = lazy(() => import("./pages/PlansPage"));
const PendingSongsPage = lazy(() => import("./pages/PendingSongsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SuggestionsPage = lazy(() => import("./pages/SuggestionsPage"));
const GlobalLibraryPage = lazy(() => import("./pages/GlobalLibraryPage"));
const ActivityLogsPage = lazy(() => import("./pages/ActivityLogsPage"));

function AdminContent() {
  const [activeView, setActiveView] = useState<AdminView>("dashboard");
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAdminEmail(session?.user?.email ?? "");
    });
  }, []);

  const fallback = (
    <div className="admin-page-loading">
      <div className="admin-spinner" />
    </div>
  );

  const renderPage = () => {
    switch (activeView) {
      case "dashboard": return <DashboardPage />;
      case "users": return <UsersPage />;
      case "plans": return <PlansPage />;
      case "pending-songs": return <PendingSongsPage />;
      case "reports": return <ReportsPage />;
      case "suggestions": return <SuggestionsPage />;
      case "global-library": return <GlobalLibraryPage />;
      case "activity-logs": return <ActivityLogsPage />;
    }
  };

  return (
    <div className="admin-layout">
      <AdminSidebar
        activeView={activeView}
        onNavigate={setActiveView}
        adminEmail={adminEmail}
      />
      <main className="admin-main">
        <Suspense fallback={fallback}>
          {renderPage()}
        </Suspense>
      </main>
    </div>
  );
}

export default function AdminShell() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}
```

- [ ] **Step 2: Create placeholder pages** (so imports don't break)

Create each file in `src/admin/pages/` with a minimal placeholder:

```tsx
// Pattern for ALL 8 pages — replace PageName and title accordingly
// DashboardPage.tsx, UsersPage.tsx, PlansPage.tsx, PendingSongsPage.tsx,
// ReportsPage.tsx, SuggestionsPage.tsx, GlobalLibraryPage.tsx, ActivityLogsPage.tsx
export default function DashboardPage() {
  return <div className="admin-page"><h1>Dashboard</h1><p>En construcción...</p></div>;
}
```

- [ ] **Step 3: Modify App.tsx — add IS_ADMIN check**

In `src/App.tsx`, add after line 33 (after `IS_PROJECTION`):

```ts
const IS_ADMIN =
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/admin");
```

Add lazy import at top of file:

```ts
const AdminShell = lazy(() => import("@/admin/AdminShell"));
```

Add `lazy` and `Suspense` to the React import on line 1.

In `AppContent`, add before the `IS_PROJECTION` check (line 261):

```tsx
if (IS_ADMIN) {
  return (
    <Suspense fallback={null}>
      <AdminShell />
    </Suspense>
  );
}
```

- [ ] **Step 4: Verify app loads at `/` and `/admin` without errors**

Run: `pnpm dev`, navigate to `localhost:5173/` (should show normal app), then `localhost:5173/admin` (should show admin shell with placeholder pages).

---

### Task 4: Admin CSS base styles

**Files:**
- Modify: `src/index.css` (append at end)

- [ ] **Step 1: Add admin styles to index.css**

Append the following at the end of `src/index.css`:

```css
/* ═══════════════════════════════════════════
   ADMIN PANEL STYLES
   ═══════════════════════════════════════════ */

/* Guard */
.admin-guard-loading,
.admin-guard-denied {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
  color: var(--text-secondary);
  background: var(--bg-base);
}
.admin-guard-denied h2 { color: var(--text-primary); margin: 0; }
.admin-guard-denied button {
  margin-top: 12px;
  padding: 10px 24px;
  background: var(--gold);
  color: #000;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.admin-spinner {
  width: 28px; height: 28px;
  border: 3px solid rgba(212,175,55,0.15);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Layout */
.admin-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  height: 100vh;
  background: var(--bg-base);
  overflow: hidden;
}
.admin-layout:has(.admin-sidebar.collapsed) {
  grid-template-columns: 64px 1fr;
}

.admin-main {
  overflow-y: auto;
  padding: 32px;
}

/* Sidebar */
.admin-sidebar {
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border);
  padding: 16px 12px;
  gap: 8px;
  transition: width 0.2s;
  overflow: hidden;
}
.admin-sidebar.collapsed { padding: 16px 8px; }

.admin-sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  margin-bottom: 8px;
}
.admin-sidebar-title {
  font-weight: 700;
  font-size: 16px;
  color: var(--gold);
  white-space: nowrap;
}
.admin-sidebar-toggle {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}
.admin-sidebar-toggle:hover { color: var(--text-primary); background: var(--bg-hover); }

.admin-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  position: relative;
}
.admin-nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.admin-nav-item.active {
  background: rgba(212,175,55,0.08);
  color: var(--gold);
  font-weight: 600;
}

.admin-nav-badge {
  margin-left: auto;
  background: var(--red);
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.admin-sidebar-footer {
  border-top: 1px solid var(--border);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.admin-email {
  font-size: 12px;
  color: var(--text-muted);
  padding: 0 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.admin-nav-item.back { color: var(--text-muted); }
.admin-nav-item.back:hover { color: var(--text-primary); }

/* Pages */
.admin-page {
  max-width: 1200px;
  margin: 0 auto;
}
.admin-page h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--text-primary);
}
.admin-page-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60vh;
}

/* Responsive */
@media (max-width: 768px) {
  .admin-layout { grid-template-columns: 1fr; }
  .admin-sidebar {
    position: fixed;
    z-index: 100;
    width: 260px;
    height: 100vh;
    transform: translateX(-100%);
    transition: transform 0.25s;
  }
  .admin-sidebar:not(.collapsed) { transform: translateX(0); }
}
```

- [ ] **Step 2: Verify admin panel styling looks correct**

Run dev server and navigate to `/admin`. Verify sidebar renders, navigation works, and styles are correct.

---

**End of Part 1.** Part 2 covers Tasks 5-8 (DB migrations, Reports migration, Users migration, Dashboard). Part 3 covers Tasks 9-12 (remaining pages).
