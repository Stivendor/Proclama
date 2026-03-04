import { Music2, List, Settings, Plus, BookOpen, Tv2 } from 'lucide-react'
import { useAppStore } from '@/stores'
import { useProjectionStore } from '@/stores'
import { openProjectionWindow } from '@/services/projection'

export default function Sidebar() {
  const { activeView, setActiveView, setEditingSong, settings } = useAppStore()
  const { setProjectionWindow } = useProjectionStore()

  const handleNewSong = () => {
    setEditingSong(null)
    setActiveView('editor')
  }

  const handleOpenProjection = () => {
    const w = openProjectionWindow()
    setProjectionWindow(w)
  }

  const nav = [
    { id: 'library', icon: BookOpen, label: 'Biblioteca' },
    { id: 'setlists', icon: List, label: 'Setlists' },
    { id: 'settings', icon: Settings, label: 'Ajustes' },
  ] as const

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <Music2 size={28} />
        <span>Proclama</span>
      </div>

      {/* Church name */}
      <div className="sidebar-church">{settings.churchName}</div>

      {/* Nueva canción */}
      <button className="btn-new-song" onClick={handleNewSong}>
        <Plus size={16} />
        Nueva Canción
      </button>

      {/* Nav */}
      <nav className="sidebar-nav">
        {nav.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={`nav-item ${activeView === id ? 'active' : ''}`}
            onClick={() => setActiveView(id)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      {/* Abrir ventana de proyección */}
      <div className="sidebar-footer">
        <button className="btn-projection" onClick={handleOpenProjection}>
          <Tv2 size={16} />
          Abrir Proyección
        </button>
      </div>
    </aside>
  )
}
