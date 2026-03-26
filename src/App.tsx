import { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { useAppStore, useProjectionStore } from '@/stores'
import { supabase } from '@/services/supabase'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { onMessage } from '@/services/projection'
import Sidebar from '@/components/Sidebar'
import LibraryView from '@/pages/LibraryView'
import SongEditor from '@/pages/SongEditor'
import SetlistsView from '@/pages/SetlistsView'
import SettingsView from '@/pages/SettingsView'
import ControlPanel from '@/components/ControlPanel'
import RecognitionPanel from '@/components/RecognitionPanel'
import ProjectionWindow from '@/pages/ProjectionWindow'
import BibleView from '@/pages/BibleView'
import CountdownView from '@/pages/CountdownView'
import OnboardingFlow from '@/components/OnboardingFlow'
import LandingView from '@/pages/LandingView'
import { Loader2 } from 'lucide-react'

// Detectar si somos la ventana de proyección
const IS_PROJECTION = typeof window !== 'undefined' && (window.name === 'proclama-projection' || window.location.pathname === '/projection')

export default function App() {
  return (
    <>
      <AppContent />
      <Analytics />
      <SpeedInsights />
    </>
  )
}

function AppContent() {
  const { setUser, setUserRole, authStatus, setAuthStatus, guestMode } = useAppStore()
  const isServer = typeof window === 'undefined'

  useEffect(() => {
    if (isServer) return

    const loadProfile = async (userId: string) => {
      const { fetchProfile } = await import('@/services/supabase')
      const profile = await fetchProfile(userId)
      setUserRole(profile?.role ?? 'user')
    }

    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null
      setUser(user)
      if (user) loadProfile(user.id)
      else setUserRole(null)
      setAuthStatus(session ? 'authenticated' : 'unauthenticated')
    })

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setUser(user)
      if (user) loadProfile(user.id)
      else setUserRole(null)
      setAuthStatus(session ? 'authenticated' : 'unauthenticated')
    })

    // Listen to media status from projection window
    const offMedia = onMessage((msg) => {
      if (msg.type === 'MEDIA_STATUS') {
        useProjectionStore.getState().setMediaStatus(msg.payload)
      }
    })

    return () => {
      subscription.unsubscribe()
      offMedia()
    }
  }, [])

  if (IS_PROJECTION) {
    return <ProjectionWindow />
  }

  if (isServer || (authStatus === 'unauthenticated' && !guestMode)) {
    return <LandingView />
  }

  if (authStatus === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060810' }}>
        <Loader2 className="spin" size={48} color="var(--gold)" />
      </div>
    )
  }

  return <MainApp />
}

function MainApp() {
  useKeyboardShortcuts()
  const { activeView, isSidebarOpen, onboardingDone } = useAppStore()

  return (
    <div className={`app-shell ${!isSidebarOpen ? 'sidebar-hidden' : ''}`}>
      {!onboardingDone && <OnboardingFlow />}
      <Sidebar />
      <main className="main-content">
        {activeView === 'library' && <LibraryView />}
        {activeView === 'editor' && <SongEditor />}
        {activeView === 'setlists' && <SetlistsView />}
        {activeView === 'settings' && <SettingsView />}
        {activeView === 'bible' && <BibleView />}
        {activeView === 'countdown' && <CountdownView />}
      </main>
      <aside className="right-panel">
        <ControlPanel />
      </aside>
    </div>
  )
}
