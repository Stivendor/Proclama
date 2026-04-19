import { Music2, List, Settings, Plus, BookOpen as BookIcon, Tv2, LogOut, Cloud, CloudOff, Timer, ClipboardEdit, Library, Image } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import { supabase } from '@/services/supabase'
import { openProjectionWindow } from '@/services/projection'
import FeedbackModal from '@/components/FeedbackModal'

export default function Sidebar() {
  const { activeView, setActiveView, setEditingSong, toggleSidebar, user, goToLanding } = useAppStore(useShallow(s => ({
    activeView: s.activeView,
    setActiveView: s.setActiveView,
    setEditingSong: s.setEditingSong,
    toggleSidebar: s.toggleSidebar,
    user: s.user,
    goToLanding: s.goToLanding,
  })))
  const setProjectionWindow = useProjectionStore(s => s.setProjectionWindow)

  const handleNewSong = () => {
    setEditingSong(null)
    setActiveView('editor')
  }

  const handleOpenProjection = () => {
    const w = openProjectionWindow()
    setProjectionWindow(w)
  }

  const nav = [
    { id: 'library', icon: Library, label: 'Biblioteca' },
    { id: 'setlists', icon: List, label: 'Setlists' },
    { id: 'bible', icon: BookIcon, label: 'Biblia' },
    { id: 'countdown', icon: Timer, label: 'Contador' },
    { id: 'notes', icon: ClipboardEdit, label: 'Notas' },
    { id: 'fondos', icon: Image, label: 'Fondos / Estilos' },
    { id: 'settings', icon: Settings, label: 'Ajustes' }
  ] as const

  const handleLogoClick = () => {
    useAppStore.getState().setForceLanding(true)
  }

  const handleLogout = async () => {
    useAppStore.getState().logout()
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn(e)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}
          onClick={handleLogoClick}
          title="Volver al inicio de la app"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Music2 size={24} color="#d4a843" />
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              display: 'flex',
              gap: '6px'
            }}>
              <span style={{ color: '#ffffff' }}>Proclama</span>
              <span style={{ color: '#d4a843' }}>Pro</span>
            </div>
          </div>
        </div>
        <button className="btn-icon" onClick={toggleSidebar} aria-label="Cerrar panel" title="Cerrar panel">
          <List size={18} />
        </button>
      </div>

      <button className="btn-new-song" onClick={handleNewSong}>
        <Plus size={16} />
        Nueva Cancion
      </button>

      <nav className="sidebar-nav">
        {nav.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={`nav-item ${activeView === id ? 'active' : ''}`}
            onClick={() => setActiveView(id)}
            aria-current={activeView === id ? 'page' : undefined}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-sync-status">
        {user ? (
          <div className="sync-user-row">
            <div className="sync-indicator synced">
              <Cloud size={14} />
              <span>{user.email ?? 'Cuenta Pro activa'}</span>
            </div>
            <button
              className="btn-icon sm"
              onClick={handleLogout}
              title="Cerrar sesion"
              aria-label="Cerrar sesion"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            className="sync-login-btn"
            onClick={() => setActiveView('settings')}
          >
            <CloudOff size={14} />
            <span>Modo local</span>
          </button>
        )}
      </div>

      <div className="sidebar-footer">
        <FeedbackModal />
        <button className="btn-projection" onClick={handleOpenProjection}>
          <Tv2 size={16} />
          Abrir Proyeccion
        </button>
      </div>
    </aside>
  )
}
