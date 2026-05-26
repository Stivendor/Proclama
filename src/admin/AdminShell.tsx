import { lazy, Suspense, useEffect, useState } from "react";
import AdminGuard from "./AdminGuard";
import AdminErrorBoundary from "./AdminErrorBoundary";
import AdminSidebar, { type AdminView } from "./AdminSidebar";
import { supabase } from "@/services/supabase";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
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
      case "dashboard": return <DashboardPage onNavigate={setActiveView} />;
      case "users": return <UsersPage />;
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
        <AdminErrorBoundary>
          <Suspense fallback={fallback}>
            {renderPage()}
          </Suspense>
        </AdminErrorBoundary>
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
