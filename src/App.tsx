import { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/stores";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSongsRealtime } from "@/hooks/useSongsRealtime";
import { useSetlistsRealtime } from "@/hooks/useSetlistsRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useAppUpdateStatus } from "@/hooks/useAppUpdateStatus";
import { graceStatus } from "@/components/pricing/pricingHelpers";
import Sidebar from "@/components/layout/Sidebar";
import LandingView from "@/pages/LandingView";
import ForcedUpdateScreen from "@/components/ui/ForcedUpdateScreen";

const LibraryView = lazy(() => import("@/pages/LibraryView"));
const SongEditorModal = lazy(() => import("@/components/songs/SongEditorModal"));
const SetlistsView = lazy(() => import("@/pages/SetlistsView"));
const SettingsView = lazy(() => import("@/pages/SettingsView"));
const ControlPanel = lazy(() => import("@/components/layout/ControlPanel"));
const ProjectionWindow = lazy(() => import("@/pages/ProjectionWindow"));
const ProjectionPreview = lazy(() => import("@/components/projection/ProjectionPreview"));
const BibleView = lazy(() => import("@/pages/BibleView"));
const TimerView = lazy(() => import("@/pages/TimerView"));
const NoticesView = lazy(() => import("@/pages/NoticesView"));
const NotesView = lazy(() => import("@/pages/NotesView"));
const TermsView = lazy(() => import("@/pages/TermsView"));
const FondosView = lazy(() => import("@/pages/FondosView"));
const OnboardingFlow = lazy(() => import("@/components/auth/OnboardingFlow"));
const DeviceBlockedModal = lazy(() => import("@/components/auth/DeviceBlockedModal"));
const TermsModal = lazy(() => import("@/components/terms/TermsModal"));
const GraceNoticeModal = lazy(() => import("@/components/pricing/GraceNoticeModal"));
const ChurchRegistrationView = lazy(() => import("@/pages/ChurchRegistrationView"));
const Toast = lazy(() => import("@/components/ui/Toast"));
const ShortcutsModal = lazy(() => import("@/components/ui/ShortcutsModal"));
import ShortcutsFab from "@/components/ui/ShortcutsFab";
const AdminShell = lazy(() => import("@/admin/AdminShell"));
const CollabView = lazy(() => import("@/pages/CollabView"));

// Map URL paths to store activeView values
const VIEW_PATHS: Record<string, string> = {
  '/library': 'library',
  '/setlists': 'setlists',
  '/settings': 'settings',
  '/bible': 'bible',
  '/timer': 'timer',
  '/notices': 'notices',
  '/notes': 'notes',
  '/terms': 'terms',
  '/fondos': 'fondos',
}

/** Registers the router's navigate fn into the store so setActiveView can update the URL */
function RouterSync() {
  const navigate = useNavigate()
  const location = useLocation()
  const _setNavigate = useAppStore((s) => s._setNavigate)
  const setActiveView = useAppStore((s) => s.setActiveView)

  useEffect(() => {
    // Register navigate so the store's setActiveView can push history
    _setNavigate((path) => navigate(path))
  }, [navigate, _setNavigate])

  useEffect(() => {
    // On URL change (e.g. browser back/forward), sync store
    const view = VIEW_PATHS[location.pathname]
    if (view) {
      // Update store without triggering another navigate (use set directly)
      useAppStore.setState({ activeView: view as any })
    }
  }, [location.pathname])

  return null
}

export default function App() {
  return (
    <>
      <RouterSync />
      <Routes>
        <Route path="/projection" element={
          <Suspense fallback={null}><ProjectionWindow /></Suspense>
        } />
        <Route path="/admin/*" element={
          <Suspense fallback={null}><AdminShell /></Suspense>
        } />
        <Route path="/colaborar/:token" element={
          <Suspense fallback={null}><CollabView /></Suspense>
        } />
        <Route path="/*" element={<AppContent />} />
      </Routes>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

function AppContent() {
  const {
    authStatus,
    forceLanding,
    deviceBlocked,
    acceptTerms,
    userPlan,
    userRole,
    premiumExpiresAt,
    graceNoticeSeen,
    setGraceNoticeSeen,
    onboardingDone,
  } = useAppStore(
    useShallow((s) => ({
      authStatus: s.authStatus,
      forceLanding: s.forceLanding,
      deviceBlocked: s.deviceBlocked,
      acceptTerms: s.acceptTerms,
      userPlan: s.userPlan,
      userRole: s.userRole,
      premiumExpiresAt: s.premiumExpiresAt,
      graceNoticeSeen: s.graceNoticeSeen,
      setGraceNoticeSeen: s.setGraceNoticeSeen,
      onboardingDone: s.onboardingDone,
    }))
  );

  const [mounted, setMounted] = useState(false);
  const user = useAppStore((s) => s.user);
  const { required: updateRequired } = useAppUpdateStatus();

  const { needsChurchReg, setNeedsChurchReg, showTermsUpdateModal, setShowTermsUpdateModal } =
    useAuth();

  useSongsRealtime(user?.id);
  useSetlistsRealtime(user?.id);

  // Sync inicial de setlists al tener sesión
  useEffect(() => {
    if (!user?.id) return;
    import("@/services/setlistSync").then(({ syncSetlists }) =>
      syncSetlists(user.id).catch((e) => console.warn("[SetlistSync] initial sync failed", e))
    );
  }, [user?.id]);

  useEffect(() => {
    setMounted(true);
    const lang = useAppStore.getState().language;
    document.documentElement.lang = lang;
  }, []);

  const grace = graceStatus({ plan: userPlan, role: userRole, premiumExpiresAt });

  if (!mounted) return null;

  if (updateRequired) {
    return <ForcedUpdateScreen />;
  }

  if (deviceBlocked) {
    return (
      <Suspense fallback={null}>
        <DeviceBlockedModal />
      </Suspense>
    );
  }

  if (authStatus === "loading") {
    return null;
  }

  if (forceLanding || authStatus === "unauthenticated") {
    return <LandingView />;
  }

  if (needsChurchReg && user) {
    return (
      <Suspense fallback={null}>
        <ChurchRegistrationView
          userId={user.id}
          userDisplayName={user.user_metadata?.full_name || user.user_metadata?.name || null}
          onComplete={() => setNeedsChurchReg(false)}
        />
      </Suspense>
    );
  }

  return (
    <div className="app-main-wrapper">
      <MainApp />

      {showTermsUpdateModal && (
        <Suspense fallback={null}>
          <TermsModal
            mode="required"
            onAccept={async () => {
              const { CURRENT_TERMS_VERSION } = await import("@/constants/terms");
              await acceptTerms(CURRENT_TERMS_VERSION);
              setShowTermsUpdateModal(false);
            }}
            onClose={() => setShowTermsUpdateModal(false)}
          />
        </Suspense>
      )}

      {/* El aviso espera a que no haya nada más encima: dos modales apilados, o
          el tour de onboarding debajo, no. `premiumExpiresAt` llega después del
          primer render (useAuth marca la sesión y luego trae el perfil), por eso
          esto se recalcula en cada render y no una sola vez al montar.
          Cerrado una vez, el que puede volver a abrirlo es el banner del sidebar. */}
      {grace && !graceNoticeSeen && !showTermsUpdateModal && onboardingDone && (
        <Suspense fallback={null}>
          <GraceNoticeModal
            lastFullDay={grace.lastFullDay}
            userEmail={user?.email ?? undefined}
            onClose={() => setGraceNoticeSeen(true)}
          />
        </Suspense>
      )}
    </div>
  );
}

function MainApp() {
  const { shortcutsOpen, closeShortcuts } = useKeyboardShortcuts();
  const { isSidebarOpen, onboardingDone } = useAppStore(
    useShallow((s) => ({
      isSidebarOpen: s.isSidebarOpen,
      onboardingDone: s.onboardingDone,
    }))
  );

  return (
    <div className={`app-shell ${!isSidebarOpen ? "sidebar-hidden" : ""}`}>
      <Suspense fallback={null}>
        {!onboardingDone && <OnboardingFlow />}
      </Suspense>
      <Suspense fallback={null}>
        <SongEditorModal />
      </Suspense>
      <Sidebar />
      <main className="main-content">
        <Suspense fallback={<div className="view-loading" />}>
          <Routes>
            <Route path="/library" element={<LibraryView />} />
            <Route path="/setlists" element={<SetlistsView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/bible" element={<BibleView />} />
            <Route path="/timer" element={<TimerView />} />
            <Route path="/notices" element={<NoticesView />} />
            <Route path="/countdown" element={<Navigate to="/timer" replace />} />
            <Route path="/notes" element={<NotesView />} />
            <Route path="/terms" element={<TermsView />} />
            <Route path="/fondos" element={<FondosView />} />
            <Route path="*" element={<LibraryView />} />
          </Routes>
        </Suspense>
        <ShortcutsFab />
      </main>
      <aside className="right-panel">
        <Suspense fallback={null}>
          <ControlPanel />
        </Suspense>
      </aside>
      <Suspense fallback={null}>
        <ProjectionPreview />
      </Suspense>
      {shortcutsOpen && (
        <Suspense fallback={null}>
          <ShortcutsModal onClose={closeShortcuts} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <Toast />
      </Suspense>
    </div>
  );
}
