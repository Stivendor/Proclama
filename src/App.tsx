import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, useProjectionStore } from "@/stores";
import { supabase } from "@/services/supabase";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSongsRealtime } from "@/hooks/useSongsRealtime";
import { onMessage } from "@/services/projection";
import Sidebar from "@/components/Sidebar";
import LibraryView from "@/pages/LibraryView";
import SongEditorModal from "@/components/SongEditorModal";
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
import DeviceBlockedModal from "@/components/DeviceBlockedModal";
import TermsModal from "@/components/TermsModal";
import ChurchRegistrationView from "@/pages/ChurchRegistrationView";
import Toast from "@/components/Toast";

const IS_PROJECTION =
  typeof window !== "undefined" &&
  (window.name === "proclama-projection" ||
    window.location.pathname === "/projection");

const IS_ADMIN =
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/admin");

const AdminShell = lazy(() => import("@/admin/AdminShell"));

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
    forceLanding,
    onboardingDone,
    deviceBlocked,
    acceptTerms,
    checkTermsVersion
  } = useAppStore(
    useShallow((s) => ({
      setUser: s.setUser,
      setUserRole: s.setUserRole,
      setUserPlan: s.setUserPlan,
      authStatus: s.authStatus,
      setAuthStatus: s.setAuthStatus,
      forceLanding: s.forceLanding,
      onboardingDone: s.onboardingDone,
      deviceBlocked: s.deviceBlocked,
      acceptTerms: s.acceptTerms,
      checkTermsVersion: s.checkTermsVersion
    })),
  );

  const [showTermsUpdateModal, setShowTermsUpdateModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [needsChurchReg, setNeedsChurchReg] = useState(false);

  const user = useAppStore(s => s.user)
  useSongsRealtime(user?.id)

  const isServer = typeof window === "undefined";
  const initRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        useAppStore.getState().setSubscriptionPlan(profile.subscriptionPlan);

        // 1) Migrar registros de guest si existen
        // 2) Pull remote → local (download records from other devices)
        // 3) Push local → remote (upload pending records)
        if (profile.plan === "premium" || profile.role === "admin") {
          import("@/services/attendanceSync").then(async ({ pullRemoteRecords, syncAttendanceRecords, migrateGuestRecords }) => {
            try {
              await migrateGuestRecords(userId);
              await pullRemoteRecords(userId);
              await syncAttendanceRecords(userId);
            } catch {}
          }).catch(() => {});
        }
      }
      return profile;
    };

    const checkDeviceLimit = async (plan: string) => {
      if (plan !== 'premium') return;
      try {
        const { getDeviceId, getDeviceName } = await import('@/utils/deviceFingerprint');
        const { fetchUserDevices, registerDevice } = await import('@/services/supabase');
        const { MAX_DEVICES_PREMIUM } = await import('@/constants/plans');
        const deviceId = getDeviceId();
        const deviceName = getDeviceName();
        
        // 1. Obtener dispositivos actuales
        const devices = await fetchUserDevices(deviceId);
        const isAlreadyRegistered = devices.some(d => d.deviceId === deviceId);
        
        // 2. Si no está registrado y ya hay el máximo permitido o más, bloquear
        if (!isAlreadyRegistered && devices.length >= MAX_DEVICES_PREMIUM) {
          useAppStore.getState().setUserDevices(devices);
          useAppStore.getState().setDeviceBlocked(true);
          return;
        }

        // 3. Registrar/Actualizar y permitir
        const updatedDevices = await registerDevice(deviceId, deviceName);
        useAppStore.getState().setUserDevices(updatedDevices);
        useAppStore.getState().setDeviceBlocked(false);
      } catch (err) {
        console.warn('Device check failed:', err);
      }
    };

    const authTimeout = setTimeout(
      () => {
        if (useAppStore.getState().authStatus === "loading") {
          console.warn("Auth initialization timed out, falling back to unauthenticated.");
          setAuthStatus("unauthenticated");
        }
      },
      30000
    );

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;

        if (user) {
          setUser(user);
          useAppStore.getState().setForceLanding(false);
          void syncProfile(user.id).then((profile) => {
            if (profile) void checkDeviceLimit(profile.plan);
          }).catch((err) => {
            console.warn("Profile sync failed:", err);
          });

          // Check if user needs to complete onboarding (Google users without full_name) - Non-blocking to prevent login hangs
          void (async () => {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name, settings')
                .eq('id', user.id)
                .maybeSingle();

              const settings = profileData?.settings as Record<string, any> | null;
              if (!profileData?.full_name || !settings?.onboardingComplete) {
                setNeedsChurchReg(true);
              }
            } catch {}
          })();
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Evitar que INITIAL_SESSION con sesión nula pise un estado ya inicializado con éxito por initAuth
      if (event === "INITIAL_SESSION" && !session && useAppStore.getState().user) {
        return;
      }

      try {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "INITIAL_SESSION") {
          return;
        }

        const user = session?.user ?? null;
        setUser(user);

        if (user) {
          if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
            useAppStore.getState().setForceLanding(false);
            try {
              // ── Sincronizar perfil inmediatamente en caliente al iniciar sesión / registrarse ──
              const profile = await syncProfile(user.id);
              const planToCheck = profile?.plan || useAppStore.getState().userPlan;

              // ── Always run: device check ──
              await checkDeviceLimit(planToCheck);


              // ── Terms sync ──
              const currentTerms = useAppStore.getState().termsAccepted;
              const shouldUpdateTerms = useAppStore.getState().checkTermsVersion();
              
              if (currentTerms && !shouldUpdateTerms) {
                const { termsSyncPending } = useAppStore.getState();
                if (termsSyncPending && currentTerms) {
                  const { syncTermsAcceptance } = await import("@/services/supabase");
                  await syncTermsAcceptance(user.id, currentTerms.version, currentTerms.acceptedAt);
                  useAppStore.getState().setTermsSyncPending(false);
                }
                return;
              }

              const { fetchTermsAcceptance } = await import("@/services/supabase");
              const remoteTerms = await fetchTermsAcceptance(user.id);
              if (remoteTerms) {
                useAppStore.getState().setTermsAccepted(remoteTerms);
              }

              if (useAppStore.getState().checkTermsVersion()) {
                setShowTermsUpdateModal(true);
                return;
              }
              
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
  }, [isServer, setAuthStatus, setUser, setUserRole, setUserPlan]);

  if (IS_ADMIN) {
    return (
      <Suspense fallback={null}>
        <AdminShell />
      </Suspense>
    );
  }

  if (IS_PROJECTION) {
    return <ProjectionWindow />;
  }

  if (!mounted) return null;

  if (deviceBlocked) {
    return <DeviceBlockedModal />;
  }

  // Show landing for unauthenticated users (guest mode disabled)
  if (forceLanding || authStatus !== "authenticated") {
    return (
      <LandingView />
    );
  }

  // Show church registration for Google users who haven't completed onboarding
  if (needsChurchReg && user) {
    return (
      <ChurchRegistrationView
        userId={user.id}
        userDisplayName={user.user_metadata?.full_name || user.user_metadata?.name || null}
        onComplete={() => setNeedsChurchReg(false)}
      />
    );
  }

  return (
    <div className="app-main-wrapper">
      <MainApp />
      
      {showTermsUpdateModal && (
        <TermsModal
          mode="required"
          onAccept={async () => {
            const { CURRENT_TERMS_VERSION } = await import('@/constants/terms');
            await acceptTerms(CURRENT_TERMS_VERSION);
            setShowTermsUpdateModal(false);
          }}
          onClose={() => setShowTermsUpdateModal(false)}
        />
      )}
    </div>
  );
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

  const theme = projectionState.theme;

  return (
    <div className={`app-shell ${!isSidebarOpen ? "sidebar-hidden" : ""}`}>
      {!onboardingDone && <OnboardingFlow />}
      <SongEditorModal />
      <Sidebar />
      <main className="main-content">
        {activeView === "library" && <LibraryView />}
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
        showBibleVersion={theme.showBibleVersion}
        onTextColorChange={(color) => updateTheme({ textColor: color })}
        onFontFamilyChange={(font) => updateTheme({ fontFamily: font })}
        onTextUppercaseChange={(val) => updateTheme({ textUppercase: val })}
        onTextShadowChange={(val) => updateTheme({ textShadow: val })}
        onTransitionChange={(val) => updateTheme({ transition: val as any })}
        onVersePositionChange={(val) => updateTheme({ verseReferencePosition: val as any })}
        onHideTextChange={(val) => setHideText(val)}
        onBlurChange={(val) => updateTheme({ backgroundBlur: val })}
        onOpacityChange={(val) => updateTheme({ backgroundOverlayOpacity: val })}
        onShowBibleVersionChange={(val) => updateTheme({ showBibleVersion: val })}
        fontScale={theme.fontScale}
        onFontScaleChange={(val) => updateTheme({ fontScale: val })}
      />
      <Toast />
    </div>
  );
}
