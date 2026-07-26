import { useState } from 'react'
import { Music2, List, Settings, Plus, BookOpen as BookIcon, LogOut, Cloud, CloudOff, Timer, Megaphone, Library, Image, Users, Shield, RefreshCw, Sparkles, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/stores'
import { supabase } from '@/services/supabase'
import FeedbackFAB from '@/components/ui/FeedbackFAB'
import { useSWUpdate } from '@/hooks/useSWUpdate'
import { t } from '@/i18n'
import { FOUNDING_PHASE } from '@/hooks/usePlan'

export default function Sidebar() {
  const { updateAvailable, updateApp } = useSWUpdate()
  const [launchBannerDismissed, setLaunchBannerDismissed] = useState(
    () => localStorage.getItem('launch-banner-v1') === '1'
  )
  const { activeView, setActiveView, openEditor, toggleSidebar, user, goToLanding, language } = useAppStore(useShallow(s => ({
    activeView: s.activeView,
    setActiveView: s.setActiveView,
    openEditor: s.openEditor,
    toggleSidebar: s.toggleSidebar,
    user: s.user,
    goToLanding: s.goToLanding,
    language: s.language,
  })))
  const handleNewSong = () => {
    openEditor()
  }

  const nav = [
    { id: 'library', icon: Library, label: t(language, 'sidebar.songs') },
    { id: 'setlists', icon: List, label: t(language, 'sidebar.setlists') },
    { id: 'bible', icon: BookIcon, label: t(language, 'sidebar.bible') },
    { id: 'timer', icon: Timer, label: t(language, 'sidebar.timer') },
    { id: 'notices', icon: Megaphone, label: t(language, 'sidebar.notices') },
    { id: 'notes', icon: Users, label: t(language, 'sidebar.notes') },
    { id: 'fondos', icon: Image, label: t(language, 'sidebar.fondos') },
    { id: 'settings', icon: Settings, label: t(language, 'sidebar.settings') }
  ] as const

  const userRole = useAppStore(s => s.userRole)
  const visibleNav = nav.filter(item => !('adminOnly' in item) || userRole === 'admin')

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
          title={t(language, 'sidebar.backToHome')}
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
        <button className="btn-icon" onClick={toggleSidebar} aria-label={t(language, 'sidebar.closePanel')} title={t(language, 'sidebar.closePanel')}>
          <List size={18} />
        </button>
      </div>

      <button className="btn-new-song" onClick={handleNewSong}>
        <Plus size={16} />
        {t(language, 'sidebar.newSong')}
      </button>

      <nav className="sidebar-nav">
        {visibleNav.map(({ id, icon: Icon, label }) => (
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
        {userRole === 'admin' && (
          <button className="nav-item admin-link" onClick={() => window.location.href = '/admin'}>
            <Shield size={18} />
            {t(language, 'sidebar.admin')}
          </button>
        )}
      </nav>

      {FOUNDING_PHASE && user && !launchBannerDismissed && (
        <div style={{
          margin: '0 10px 8px',
          padding: '10px 11px',
          borderRadius: 10,
          background: 'rgba(212, 168, 67, 0.08)',
          border: '1px solid rgba(212, 168, 67, 0.22)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <Sparkles size={13} color="#d4a843" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45, flex: 1 }}>
            Estás disfrutando de <strong style={{ color: '#d4a843' }}>Premium gratis</strong> — oferta de lanzamiento por tiempo limitado.
          </span>
          <button
            onClick={() => { localStorage.setItem('launch-banner-v1', '1'); setLaunchBannerDismissed(true) }}
            aria-label="Cerrar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, flexShrink: 0, display: 'flex' }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="sidebar-sync-status">
        {updateAvailable && (
          <button
            onClick={updateApp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '8px',
              background: 'var(--gold)',
              color: '#000',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '6px'
            }}
          >
            <RefreshCw size={14} />
            <span>{t(language, 'sidebar.updateApp')}</span>
          </button>
        )}
        <FeedbackFAB />
        {user ? (
          <div className="sync-user-row">
            <div className="sync-indicator synced">
              <Cloud size={14} />
              <span>{user.email ?? t(language, 'sidebar.accountActive')}</span>
            </div>
            <button
              className="btn-icon sm"
              onClick={handleLogout}
              title={t(language, 'sidebar.signOut')}
              aria-label={t(language, 'sidebar.signOut')}
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
            <span>{t(language, 'sidebar.localMode')}</span>
          </button>
        )}
      </div>
    </aside>
  )
}
