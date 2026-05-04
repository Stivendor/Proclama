import { useState, useEffect } from 'react'
import { Save, X, Trash2, Globe, Lock, Music } from 'lucide-react'
import { db } from '@/db'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/stores'
import type { Song } from '@/types'
import { createSong, updateSong, deleteSong } from '@/services/supabase'
import { usePlan } from '@/hooks/usePlan'

const LANGUAGES = ['Español', 'Inglés', 'Portugués', 'Otro']

const EMPTY_SONG: Omit<Song, 'id'> = {
  title: '', artist: '', lyrics: '', key: '', tags: [],
  language: 'Español', usageCount: 0, isPublic: true,
  isVerified: false,
  createdAt: new Date(), updatedAt: new Date()
}

export default function SongEditorModal() {
  const { canSync } = usePlan()
  const { isEditorOpen, closeEditor, editingSong, user, userRole } = useAppStore(useShallow(s => ({
    isEditorOpen: s.isEditorOpen,
    closeEditor: s.closeEditor,
    editingSong: s.editingSong,
    user: s.user,
    userRole: s.userRole
  })))

  const [form, setForm] = useState<Omit<Song, 'id'>>({ ...EMPTY_SONG })
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState('')

  useEffect(() => {
    if (editingSong) {
      setForm({ ...editingSong })
    } else {
      setForm({ ...EMPTY_SONG })
    }
    setTitleError('')
  }, [editingSong, isEditorOpen])

  if (!isEditorOpen) return null

  const set = (key: keyof typeof form, value: any) =>
    setForm(f => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!form.title.trim()) { setTitleError('El título es requerido'); return }
    setTitleError('')
    setSaving(true)
    try {
      const now = new Date()
      const isVerified = userRole === 'admin' ? form.isPublic : (editingSong?.isVerified ?? false)

      if (editingSong?.id) {
        const songId = editingSong.id;
        const updates = { 
          ...form, 
          isVerified,
          updatedAt: now, 
          userId: user?.id 
        }
        
        await db.songs.update(songId, { ...updates, id: songId })
        if (canSync && user) {
          await updateSong(songId, updates)
        }
      } else {
        const payload: Omit<Song, 'id'> = { 
          ...form, 
          isVerified: userRole === 'admin' ? form.isPublic : false,
          createdAt: now, 
          updatedAt: now, 
          userId: user?.id 
        }
        
        if (canSync && user) {
          const created = await createSong(payload)
          if (created) {
            await db.songs.add(created)
          } else {
            await db.songs.add(payload)
          }
        } else {
          await db.songs.add(payload)
        }
      }
      
      closeEditor()
    } catch (err) {
      console.error('Error saving song:', err)
      alert('Hubo un error al guardar la canción.');
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingSong?.id) return
    if (!window.confirm('¿Eliminar esta canción permanentemente?')) return
    
    setSaving(true)
    try {
      if (canSync && user) await deleteSong(editingSong.id)
      await db.songs.delete(editingSong.id)
      closeEditor()
    } catch (err) {
      console.error('Error deleting song:', err)
      alert('Error al eliminar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={closeEditor}>
      <div 
        className="modal-content song-editor-modal" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '800px', width: '95%', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem' }}>
            <Music size={20} color="var(--blue)" />
            {editingSong ? 'Editar Canción' : 'Nueva Canción'}
          </h2>
          <button className="btn-icon" onClick={closeEditor} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {/* Main Info Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Título *</label>
              <input
                type="text"
                placeholder="Título de la canción"
                value={form.title}
                onChange={e => { set('title', e.target.value); setTitleError('') }}
                className={titleError ? 'error' : ''}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                autoFocus
              />
              {titleError && <span style={{ color: 'var(--red)', fontSize: '11px', marginTop: '4px' }}>{titleError}</span>}
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Artista / Autor</label>
              <input
                type="text"
                placeholder="Opcional"
                value={form.artist}
                onChange={e => set('artist', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Visibility & Language */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'flex-end' }}>
             <div className="form-group">
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Idioma</label>
                <select 
                  value={form.language} 
                  onChange={e => set('language', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                >
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Visibilidad</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button"
                    className={`btn-toggle ${form.isPublic ? 'active' : ''}`}
                    onClick={() => set('isPublic', true)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <Globe size={14} /> Pública
                  </button>
                  <button 
                    type="button"
                    className={`btn-toggle ${!form.isPublic ? 'active' : ''}`}
                    onClick={() => set('isPublic', false)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <Lock size={14} /> Privada
                  </button>
                </div>
              </div>
          </div>

          {/* Lyrics Area - Expanded */}
          <div className="form-group" style={{ flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Letra</label>
            <textarea
              value={form.lyrics}
              onChange={e => set('lyrics', e.target.value)}
              placeholder="Escribe o pega la letra aquí… Usa líneas en blanco para separar estrofas."
              style={{ 
                flex: 1, 
                width: '100%', 
                minHeight: '350px', 
                fontFamily: 'var(--font-mono, monospace)', 
                fontSize: '15px',
                lineHeight: '1.6',
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                resize: 'none',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              spellCheck={false}
              onFocus={(e) => e.target.style.borderColor = 'var(--blue)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {editingSong && (
              <button 
                className="btn-danger" 
                onClick={handleDelete} 
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '10px 16px', borderRadius: '8px', border: 'none', color: 'white', fontWeight: 600, fontSize: '13px', transition: 'opacity 0.2s' }}
              >
                <Trash2 size={16} /> Eliminar
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-ghost" onClick={closeEditor} disabled={saving} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !form.title} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .song-editor-modal {
          background: var(--bg-base);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .song-editor-modal .btn-toggle {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-secondary);
        }
        .song-editor-modal .btn-toggle.active {
          background: var(--blue-dim);
          border-color: var(--blue);
          color: white;
        }
        .song-editor-modal .btn-toggle:hover:not(.active) {
          background: var(--bg-secondary);
        }
        .btn-danger {
          background: var(--red);
        }
        .btn-danger:hover {
          opacity: 0.9;
        }
        .btn-danger:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .btn-ghost:hover {
          background: var(--bg-hover) !important;
          color: var(--text-primary) !important;
        }
      `}</style>
    </div>
  )
}
