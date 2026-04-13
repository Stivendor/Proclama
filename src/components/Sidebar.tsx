import { Music2, List, Settings, Plus, BookOpen as BookIcon, Tv2, LogOut, Cloud, CloudOff, Timer, ClipboardEdit, Library } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, useProjectionStore } from '@/stores';
import { supabase } from '@/services/supabase';
import { openProjectionWindow } from '@/services/projection';
import FeedbackModal from '@/components/FeedbackModal'



export default function Sidebar() {
  const { activeView, setActiveView, setEditingSong, toggleSidebar, user, setGuestMode } = useAppStore(useShallow(s => ({
    activeView: s.activeView, setActiveView: s.setActiveView, setEditingSong: s.setEditingSong, 
    toggleSidebar: s.toggleSidebar, user: s.user, setGuestMode: s.setGuestMode
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
    { id: 'settings', icon: Settings, label: 'Ajustes' }
  ] as const

  const handleLogoClick = () => {
  if (user) {
    // Con sesión: ir a biblioteca (home de la app)
    setActiveView('library')
  } else {
    // Sin sesión guest: volver al landing
    setGuestMode(false)
  }
}

  const handleLogout = async () => {
    useAppStore.getState().logout()
    try {
      await supabase.auth.signOut()
    } catch(e) {
      console.warn(e)
    }
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}
          onClick={handleLogoClick}
          title="Volver a la página de inicio"
        >
          <Music2 size={24} />
          <span>Proclama</span>
        </div>
        <button className="btn-icon" onClick={toggleSidebar} aria-label="Cerrar panel" title="Cerrar Panel">
          <List size={18} />
        </button>
      </div>

      {/* Nueva canción */}
      <button className="btn-new-song" onClick={handleNewSong}>
        <Plus size={16} />
        Nueva Canción
      </button>

      {/* Nav */ }
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

      {/* Estado de sincronización */}
      <div className="sidebar-sync-status">
        {user ? (
          <div className="sync-user-row">
            <div className="sync-indicator synced">
              <Cloud size={14} />
              <span>{user.email ?? 'Sincronizado'}</span>
            </div>
            <button
              className="btn-icon sm"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
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

      {/* Abrir ventana de proyección */}
      <div className="sidebar-footer">
        <FeedbackModal />
        <button className="btn-projection" onClick={handleOpenProjection}>
          <Tv2 size={16} />
          Abrir Proyección
        </button>
      </div>
    </aside>
  )
}
