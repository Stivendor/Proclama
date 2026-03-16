import { useEffect } from 'react'
import { seedDatabase } from '@/db'
import { useAppStore } from '@/stores'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import Sidebar from '@/components/Sidebar'
import LibraryView from '@/pages/LibraryView'
import SongEditor from '@/pages/SongEditor'
import SetlistsView from '@/pages/SetlistsView'
import SettingsView from '@/pages/SettingsView'
import ControlPanel from '@/components/ControlPanel'
import RecognitionPanel from '@/components/RecognitionPanel'
import ProjectionWindow from '@/pages/ProjectionWindow'
import BibleView from '@/pages/BibleView'

// Detectar si somos la ventana de proyección
const IS_PROJECTION = window.name === 'proclama-projection' || window.location.pathname === '/projection'

export default function App() {
  useEffect(() => { seedDatabase() }, [])

  if (IS_PROJECTION) {
    return <ProjectionWindow />
  }

  return <MainApp />
}

function MainApp() {
  useKeyboardShortcuts()
  const { activeView } = useAppStore()

  return (
    <div className="app-shell">
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
