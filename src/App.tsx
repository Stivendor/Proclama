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
import LandingView from "@/pages/LandingView";

const LibraryView = lazy(() => import("@/pages/LibraryView"));
const SongEditorModal = lazy(() => import("@/components/SongEditorModal"));
const SetlistsView = lazy(() => import("@/pages/SetlistsView"));
const SettingsView = lazy(() => import("@/pages/SettingsView"));
const ControlPanel = lazy(() => import("@/components/ControlPanel"));
const ProjectionWindow = lazy(() => import("@/pages/ProjectionWindow"));
const ProjectionPreview = lazy(() => import("@/components/ProjectionPreview"));
const BibleView = lazy(() => import("@/pages/BibleView"));
const CountdownView = lazy(() => import("@/pages/CountdownView"));
const NotesView = lazy(() => import("@/pages/NotesView"));
const TermsView = lazy(() => import("@/pages/TermsView"));
const FondosView = lazy(() => import("@/pages/FondosView"));
const OnboardingFlow = lazy(() => import("@/components/OnboardingFlow"));
const DeviceBlockedModal = lazy(() => import("@/components/DeviceBlockedModal"));
const TermsModal = lazy(() => import("@/components/TermsModal"));
const ChurchRegistrationView = lazy(() => import("@/pages/ChurchRegistrationView"));
const Toast = lazy(() => import("@/components/Toast"));

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

    // Safety net: if auth doesn't resolve within 10s, show landing
    const authTimeout = setTimeout(
      () => {
        if (useAppStore.getState().authStatus === "loading") {
          console.warn("Auth initialization timed out, falling back to unauthenticated.");
          setAuthStatus("unauthenticated");
        }
      },
      10000
    );

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "INITIAL_SESSION") {
          return;
        }

        const user = session?.user ?? null;
        setUser(user);

        if (user) {
          // Show the app immediately — no waiting for sync
          useAppStore.getState().setForceLanding(false);
          clearTimeout(authTimeout);
          setAuthStatus("authenticated");

          // Background sync
          (async () => {
            try {
              const { fetchProfile } = await import("@/services/supabase");
              const profile = await fetchProfile(user.id);
              if (profile) {
                setUserRole(profile.role);
                setUserPlan(profile.plan);
                useAppStore.getState().setSubscriptionPlan(profile.subscriptionPlan);

                if (profile.plan === "premium" || profile.role === "admin") {
                  import("@/services/attendanceSync").then(async ({ pullRemoteRecords, syncAttendanceRecords, migrateGuestRecords }) => {
                    try {
                      await migrateGuestRecords(user.id);
                      await pullRemoteRecords(user.id);
                      await syncAttendanceRecords(user.id);
                    } catch {}
                  }).catch(() => {});
                }
              }

              // Sync cloud settings AFTER profile fetch to avoid DB trigger race
              useAppStore.getState().fetchCloudSettings();

              const planToCheck = profile?.plan || useAppStore.getState().userPlan;

              // Device check (non-blocking)
              if (planToCheck === 'premium') {
                import('@/utils/deviceFingerprint').then(async ({ getDeviceId, getDeviceName }) => {
                  const { fetchUserDevices, registerDevice } = await import('@/services/supabase');
                  const { MAX_DEVICES_PREMIUM } = await import('@/constants/plans');
                  const deviceId = getDeviceId();
                  const deviceName = getDeviceName();
                  const devices = await fetchUserDevices(deviceId);
                  if (!devices.some(d => d.deviceId === deviceId) && devices.length >= MAX_DEVICES_PREMIUM) {
                    useAppStore.getState().setUserDevices(devices);
                    useAppStore.getState().setDeviceBlocked(true);
                  } else {
                    const updatedDevices = await registerDevice(deviceId, deviceName);
                    useAppStore.getState().setUserDevices(updatedDevices);
                    useAppStore.getState().setDeviceBlocked(false);
                  }
                }).catch(err => console.warn('Device check failed:', err));
              }

              // Terms sync (non-blocking)
              const { fetchTermsAcceptance, syncTermsAcceptance } = await import('@/services/supabase');
              const currentTerms = useAppStore.getState().termsAccepted;
              const shouldUpdateTerms = useAppStore.getState().checkTermsVersion();
              
              if (currentTerms && !shouldUpdateTerms) {
                const { termsSyncPending } = useAppStore.getState();
                if (termsSyncPending && currentTerms) {
                  await syncTermsAcceptance(user.id, currentTerms.version, currentTerms.acceptedAt);
                  useAppStore.getState().setTermsSyncPending(false);
                }
              } else {
                const remoteTerms = await fetchTermsAcceptance(user.id);
                if (remoteTerms) useAppStore.getState().setTermsAccepted(remoteTerms);
                if (useAppStore.getState().checkTermsVersion()) setShowTermsUpdateModal(true);
              }

              const { termsSyncPending, termsAccepted } = useAppStore.getState();
              if (termsSyncPending && termsAccepted) {
                await syncTermsAcceptance(user.id, termsAccepted.version, termsAccepted.acceptedAt);
                useAppStore.getState().setTermsSyncPending(false);
              }

              // Only Google users without full_name need church registration
              if (user.app_metadata?.provider === 'google') {
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('full_name, settings')
                  .eq('id', user.id)
                  .maybeSingle();

                const settings = profileData?.settings as Record<string, any> | null;
                if (!profileData?.full_name || !settings?.onboardingComplete) {
                  setNeedsChurchReg(true);
                }
              }
            } catch (err) {
              console.warn("Post-login sync tasks had issues:", err);
            }
          })();
        } else {
          setUserRole(null);
          setUserPlan("free");
          if (event === "SIGNED_OUT") {
            useAppStore.getState().logout();
          }
          clearTimeout(authTimeout);
          setAuthStatus("unauthenticated");
        }
      } catch (err) {
        console.error("Auth event processing failed:", err);
        clearTimeout(authTimeout);
        setAuthStatus("unauthenticated");
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
    return (
      <Suspense fallback={null}>
        <ProjectionWindow />
      </Suspense>
    );
  }

  if (!mounted) return null;

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

  // Show landing for unauthenticated users
  if (forceLanding || authStatus === "unauthenticated") {
    return <LandingView />;
  }

  // Show church registration for Google users who haven't completed onboarding
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
      <Suspense fallback={null}>
        {!onboardingDone && <OnboardingFlow />}
      </Suspense>
      <Suspense fallback={null}>
        <SongEditorModal />
      </Suspense>
      <Sidebar />
      <main className="main-content">
        <Suspense fallback={<div className="view-loading" />}>
          {activeView === "library" && <LibraryView />}
          {activeView === "setlists" && <SetlistsView />}
          {activeView === "settings" && <SettingsView />}
          {activeView === "bible" && <BibleView />}
          {activeView === "countdown" && <CountdownView />}
          {activeView === "notes" && <NotesView />}
          {activeView === "terms" && <TermsView />}
          {activeView === "fondos" && <FondosView />}
        </Suspense>
      </main>
      <aside className="right-panel">
        <Suspense fallback={null}>
          <ControlPanel />
        </Suspense>
      </aside>
      <Suspense fallback={null}>
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
      </Suspense>
      <Suspense fallback={null}>
        <Toast />
      </Suspense>
    </div>
  );
}
