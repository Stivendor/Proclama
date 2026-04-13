import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, useProjectionStore } from "@/stores";
import { supabase } from "@/services/supabase";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { onMessage } from "@/services/projection";
import Sidebar from "@/components/Sidebar";
import LibraryView from "@/pages/LibraryView";
import SongEditor from "@/pages/SongEditor";
import SetlistsView from "@/pages/SetlistsView";
import SettingsView from "@/pages/SettingsView";
import ControlPanel from "@/components/ControlPanel";
import ProjectionWindow from "@/pages/ProjectionWindow";
import ProjectionPreview from "@/components/ProjectionPreview";
import BibleView from "@/pages/BibleView";
import CountdownView from "@/pages/CountdownView";
import NotesView from "@/pages/NotesView";
import TermsView from "@/pages/TermsView";
import OnboardingFlow from "@/components/OnboardingFlow";
import LandingView from "@/pages/LandingView";
import TermsModal from "@/components/TermsModal";
import { CURRENT_TERMS_VERSION } from "@/constants/terms";
import { db } from "@/db";
import { Loader2 } from "lucide-react";

// Detectar si somos la ventana de proyección
const IS_PROJECTION =
  typeof window !== "undefined" &&
  (window.name === "proclama-projection" ||
    window.location.pathname === "/projection");

export default function App() {
  return (
    <>
      <AppContent />
      <Analytics />
      <SpeedInsights />
    </>
  );
}

function AppContent() {
  const {
    setUser,
    setUserRole,
    setUserPlan,
    authStatus,
    setAuthStatus,
    guestMode,
    checkTermsVersion,
    acceptTerms,
    termsSyncPending,
    cachedUserRole,
  } = useAppStore(
    useShallow((s) => ({
      setUser: s.setUser,
      setUserRole: s.setUserRole,
      setUserPlan: s.setUserPlan,
      authStatus: s.authStatus,
      setAuthStatus: s.setAuthStatus,
      guestMode: s.guestMode,
      checkTermsVersion: s.checkTermsVersion,
      acceptTerms: s.acceptTerms,
      termsSyncPending: s.termsSyncPending,
      cachedUserRole: s.userRole,
    })),
  );

  const [showTermsGate, setShowTermsGate] = useState(false);
  const isServer = typeof window === "undefined";

  const handleAcceptTerms = async () => {
    await acceptTerms(CURRENT_TERMS_VERSION);
    // Verificar con el estado actualizado, no con checkTermsVersion()
    setShowTermsGate(false);
  };

  useEffect(() => {
    if (isServer) return;

    const loadProfile = async (userId: string, skipCache = false) => {
      // Check cache first (unless explicitly skipped)
      if (!skipCache && cachedUserRole !== null) {
        return null; // Use cached role
      }

      const { fetchProfile } = await import("@/services/supabase");
      const profile = await fetchProfile(userId);
      setUserRole(profile?.role ?? "user");
      setUserPlan(profile?.plan ?? "free");
      return profile;
    };

    // Check initial auth state with a safety timeout
    const authTimeout = setTimeout(
      () => {
        if (useAppStore.getState().authStatus === "loading") {
          console.warn(
            "Auth initialization timed out, falling back to unauthenticated.",
          );
          setAuthStatus("unauthenticated");
        }
      },
      import.meta.env.DEV ? 30_000 : 10_000,
    ); // 30s en dev, 10s en prod

    const migrateLocalSongs = async (userId: string, _isPremium: boolean) => {
      try {
        // DESACTIVADO: Ya no hay canciones locales que migrar
      } catch (err) {
        console.warn("Local songs migration failed silently:", err);
      }
    };

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        setUser(user);

        if (user) {
          try {
            await loadProfile(user.id);
          } catch (e) {
            console.warn("Profile load failed during init, continuing...", e);
          }
        } else {
          setUserRole(null);
        }

        setAuthStatus(session ? "authenticated" : "unauthenticated");
      } catch (err) {
        console.error("Auth init error:", err);
        setAuthStatus("unauthenticated");
      } finally {
        clearTimeout(authTimeout);
      }
    };

    initAuth();

    // Listen to changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        // Only process key events to prevent redundant sync loops
        if (
          event !== "SIGNED_IN" &&
          event !== "SIGNED_OUT" &&
          event !== "INITIAL_SESSION"
        ) {
          return;
        }

        const user = session?.user ?? null;
        setUser(user);

        if (user) {
          const profile = await loadProfile(user.id).catch((e) => {
            console.warn("Profile sync failed:", e);
            return null;
          });

          if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
            try {
              const isPremium =
                profile?.plan === "premium" || profile?.role === "admin";
              await migrateLocalSongs(user.id, isPremium);

              const { fetchTermsAcceptance } =
                await import("@/services/supabase");
              const remoteTerms = await fetchTermsAcceptance(user.id);
              if (remoteTerms) {
                useAppStore.getState().setTermsAccepted(remoteTerms);
              }

              const { termsSyncPending, termsAccepted } =
                useAppStore.getState();
              if (termsSyncPending && termsAccepted) {
                const { syncTermsAcceptance } =
                  await import("@/services/supabase");
                await syncTermsAcceptance(
                  user.id,
                  termsAccepted.version,
                  termsAccepted.acceptedAt,
                );
                useAppStore.getState().setTermsSyncPending(false);
              }
            } catch (err) {
              console.warn("Post-login sync tasks had issues:", err);
            }
          }
        } else {
          if (event === "SIGNED_OUT") {
            useAppStore.getState().logout();
          }
        }
      } catch (err) {
        console.error("Auth event processing failed:", err);
      } finally {
        setAuthStatus(session ? "authenticated" : "unauthenticated");
        const { termsAccepted } = useAppStore.getState();
        const needsTerms =
          !termsAccepted || termsAccepted.version !== CURRENT_TERMS_VERSION;
        if (needsTerms) setShowTermsGate(true);
      }
    });

    // Listen to media status from projection window
    const offMedia = onMessage((msg) => {
      if (msg.type === "MEDIA_STATUS") {
        useProjectionStore.getState().setMediaStatus(msg.payload);
      }
    });

    return () => {
      subscription.unsubscribe();
      offMedia();
    };
  }, [
    isServer,
    cachedUserRole,
    checkTermsVersion,
    acceptTerms,
    setAuthStatus,
    setUser,
    setUserRole,
    setUserPlan,
  ]);

  if (IS_PROJECTION) {
    return <ProjectionWindow />;
  }

  if (isServer || (authStatus === "unauthenticated" && !guestMode)) {
    return <LandingView />;
  }

  if (authStatus === "loading") {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#060810",
        }}
      >
        <Loader2 className="spin" size={48} color="var(--gold)" />
      </div>
    );
  }

  if (showTermsGate) {
    return (
      <TermsModal
        mode="required"
        onAccept={handleAcceptTerms}
        onClose={() => {
          setShowTermsGate(false);
          useAppStore.getState().logout();
        }}
      />
    );
  }

  return <MainApp />;
}

function MainApp() {
  useKeyboardShortcuts();
  const { activeView, isSidebarOpen, onboardingDone } = useAppStore(
    useShallow((s) => ({
      activeView: s.activeView,
      isSidebarOpen: s.isSidebarOpen,
      onboardingDone: s.onboardingDone,
    })),
  );

  return (
    <div className={`app-shell ${!isSidebarOpen ? "sidebar-hidden" : ""}`}>
      {!onboardingDone && <OnboardingFlow />}
      <Sidebar />
      <main className="main-content">
        {activeView === "library" && <LibraryView />}
        {activeView === "editor" && <SongEditor />}
        {activeView === "setlists" && <SetlistsView />}
        {activeView === "settings" && <SettingsView />}
        {activeView === "bible" && <BibleView />}
        {activeView === "countdown" && <CountdownView />}
        {activeView === "notes" && <NotesView />}
        {activeView === "terms" && <TermsView />}
      </main>
      <aside className="right-panel">
        <ControlPanel />
      </aside>
      <ProjectionPreview />
    </div>
  );
}
