import { useEffect } from 'react'
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
import OnboardingFlow from '@/components/OnboardingFlow'
import LandingView from '@/pages/LandingView'
import { Loader2 } from 'lucide-react'

// Detectar si somos la ventana de proyección
const IS_PROJECTION = typeof window !== 'undefined' && (window.name === 'proclama-projection' || window.location.pathname === '/projection')

export default function App() {
  const { setUser, authStatus, setAuthStatus, guestMode } = useAppStore()
  const isServer = typeof window === 'undefined'

  useEffect(() => {
    if (isServer) return

    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthStatus(session ? 'authenticated' : 'unauthenticated')
    })

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
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
      </main>
      <aside className="right-panel">
        <ControlPanel />
      </aside>
    </div>
  )
}
