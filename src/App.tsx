import { useEffect, useState, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, useProjectionStore } from "@/stores";
import { supabase } from "@/services/supabase";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { onMessage } from "@/services/projection";
import FontLoader from "@/components/FontLoader";
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
import FondosView from "@/pages/FondosView";
import OnboardingFlow from "@/components/OnboardingFlow";
import LandingView from "@/pages/LandingView";
import { CURRENT_TERMS_VERSION } from "@/constants/terms";

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
    forceLanding,
    setForceLanding,
    termsSyncPending,
    onboardingDone,
  } = useAppStore(
    useShallow((s) => ({
      setUser: s.setUser,
      setUserRole: s.setUserRole,
      setUserPlan: s.setUserPlan,
      authStatus: s.authStatus,
      setAuthStatus: s.setAuthStatus,
      guestMode: s.guestMode,
      forceLanding: s.forceLanding,
      setForceLanding: s.setForceLanding,
      termsSyncPending: s.termsSyncPending,
      onboardingDone: s.onboardingDone,
    })),
  );

  const isServer = typeof window === "undefined";
  const initRef = useRef(false);

  useEffect(() => {
    if (isServer) return;
    if (initRef.current) return;
    initRef.current = true;

    const syncProfile = async (userId: string) => {
      const { fetchProfile } = await import("@/services/supabase");
      const profile = await fetchProfile(userId);
      if (profile) {
        setUserRole(profile.role);
        setUserPlan(profile.plan);
      }
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
      30000 // Aumentado a 30s para mayor robustez
    );

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user ?? null;

        if (user) {
          setUser(user);
          void syncProfile(user.id).catch((err) => {
            console.warn("Profile sync failed:", err);
          });
        } else {
          setUser(null);
          setUserRole(null);
          setUserPlan("free");
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
          void syncProfile(user.id).catch((err) => {
            console.warn("Profile sync failed:", err);
          });

          if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
            try {
              // Primero verificar si hay términos locales ya aceptados
              const currentTerms = useAppStore.getState().termsAccepted;
              const shouldUpdateTerms = useAppStore.getState().checkTermsVersion();
              
              // Si ya tiene términos locales actualizados, NO mostrar términos
              if (currentTerms && !shouldUpdateTerms) {
                // Sincronizar con Supabase si hay pending
                const { termsSyncPending } = useAppStore.getState();
                if (termsSyncPending && currentTerms) {
                  const { syncTermsAcceptance } = await import("@/services/supabase");
                  await syncTermsAcceptance(user.id, currentTerms.version, currentTerms.acceptedAt);
                  useAppStore.getState().setTermsSyncPending(false);
                }
                return // No mostrar términos
              }

              // Descargar términos de Supabase
              const { fetchTermsAcceptance } = await import("@/services/supabase");
              const remoteTerms = await fetchTermsAcceptance(user.id);
              if (remoteTerms) {
                useAppStore.getState().setTermsAccepted(remoteTerms);
              }

              // Verificar si necesita aceptar
              if (useAppStore.getState().checkTermsVersion()) {
                useAppStore.getState().setActiveView("terms");
                return
              }
              
              // Sync pending si hay
              const { termsSyncPending, termsAccepted } = useAppStore.getState();
              if (termsSyncPending && termsAccepted) {
                const { syncTermsAcceptance } = await import("@/services/supabase");
                await syncTermsAcceptance(user.id, termsAccepted.version, termsAccepted.acceptedAt);
                useAppStore.getState().setTermsSyncPending(false);
              }
            } catch (err) {
              console.warn("Post-login sync tasks had issues:", err);
            }
          }
        } else {
          setUserRole(null);
          setUserPlan("free");
          if (event === "SIGNED_OUT") {
            useAppStore.getState().logout();
          }
        }
      } catch (err) {
        console.error("Auth event processing failed:", err);
      } finally {
        setAuthStatus(session ? "authenticated" : "unauthenticated");
      }
    });

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
    setAuthStatus,
    setUser,
    setUserRole,
    setUserPlan,
  ]);

  if (IS_PROJECTION) {
    return <ProjectionWindow />;
  }

  // Si somos servidor, no renderizamos nada pesado
  if (isServer) return null;

  if (forceLanding || (!guestMode && !onboardingDone && authStatus !== "authenticated")) {
    return <LandingView />;
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

  const { updateTheme, state: projectionState, setHideText } = useProjectionStore(
    useShallow((s) => ({
      updateTheme: s.updateTheme,
      state: s.state,
      setHideText: s.setHideText,
    })),
  );

  const showTextControls = activeView === "fondos";
  const theme = projectionState.theme;

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
        {activeView === "fondos" && <FondosView />}
      </main>
      <aside className="right-panel">
        <ControlPanel />
      </aside>
      <ProjectionPreview 
        textColor={theme.textColor}
        fontFamily={theme.fontFamily}
        textUppercase={theme.textUppercase}
        textShadow={theme.textShadow}
        transition={theme.transition}
        verseReferencePosition={theme.verseReferencePosition}
        hideText={projectionState.hideText}
        backgroundType={theme.backgroundType}
        background={theme.background}
        backgroundImageUrl={theme.backgroundImageUrl}
        backgroundThumbnail={theme.backgroundThumbnail}
        backgroundVideoUrl={theme.backgroundVideoUrl}
        backgroundBlur={theme.backgroundBlur}
        backgroundOverlayOpacity={theme.backgroundOverlayOpacity}
        onTextColorChange={(color) => updateTheme({ textColor: color })}
        onFontFamilyChange={(font) => updateTheme({ fontFamily: font })}
        onTextUppercaseChange={(val) => updateTheme({ textUppercase: val })}
        onTextShadowChange={(val) => updateTheme({ textShadow: val })}
        onTransitionChange={(val) => updateTheme({ transition: val as any })}
        onVersePositionChange={(val) => updateTheme({ verseReferencePosition: val as any })}
        onHideTextChange={(val) => setHideText(val)}
      />
    </div>
  );
}
