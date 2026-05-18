import { useState, useEffect } from 'react'
import { Save, X, Trash2, Globe, Cloud, Music } from 'lucide-react'
import { db } from '@/db'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/stores'
import type { Song } from '@/types'
import { createSong, updateSong, deleteSong } from '@/services/supabase'

const LANGUAGES = ['Español', 'Inglés', 'Portugués', 'Otro']

const EMPTY_SONG: Omit<Song, 'id'> = {
  title: '', artist: '', lyrics: '', key: '', tags: [],
  language: 'Español', usageCount: 0, isPublic: false,
  isVerified: false,
  createdAt: new Date(), updatedAt: new Date()
}

export default function SongEditorModal() {
  const { isEditorOpen, closeEditor, editingSong, user, userRole } = useAppStore(useShallow(s => ({
    isEditorOpen: s.isEditorOpen,
    closeEditor: s.closeEditor,
    editingSong: s.editingSong,
    user: s.user,
    userRole: s.userRole,
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

  const canEditCloud = !!editingSong?.remoteId && (userRole === 'admin' || editingSong.userId === user?.id)
  const isCommunitySong = !!editingSong?.remoteId && !canEditCloud

  const handleSave = async () => {
    if (!form.title.trim()) { setTitleError('El título es requerido'); return }
    setTitleError('')
    setSaving(true)

    try {
      const now = new Date()

      if (editingSong?.id) {
        await db.songs.update(editingSong.id, {
          ...form,
          remoteId: canEditCloud ? editingSong.remoteId : undefined,
          isPublic: canEditCloud ? editingSong.isPublic : false,
          isVerified: canEditCloud ? editingSong.isVerified : false,
          updatedAt: now,
          userId: editingSong.userId,
        })
      } else {
        const localId = await db.songs.add({
          ...form,
          remoteId: undefined,
          isPublic: false,
          isVerified: false,
          createdAt: now,
          updatedAt: now,
          userId: user?.id ?? undefined,
        })

        if (user?.id) {
          createSong({
            ...form,
            createdAt: now,
            updatedAt: now,
            userId: user.id,
          }).then(created => {
            if (created?.remoteId) {
              db.songs.update(localId, {
                remoteId: created.remoteId,
                isPublic: created.isPublic,
                isVerified: created.isVerified,
              })
            }
          }).catch(err => {
            console.error('[Editor] Error al crear en la nube:', err)
            alert('La canción se guardó localmente, pero falló la sincronización a la nube.')
          })
        }
      }

      setSaving(false)
      closeEditor()

      if (!editingSong) {
        useAppStore.getState().setToast(`✅ "${form.title}" guardada en Mi Cancionero`)
      }

      // Sincronizar a la nube después de cerrar (no bloquea el modal)
      if (canEditCloud && editingSong?.remoteId) {
        updateSong(editingSong.remoteId, {
          title: form.title,
          artist: form.artist,
          lyrics: form.lyrics,
          key: form.key,
          tags: form.tags,
          language: form.language,
          isPublic: editingSong.isPublic,
          isVerified: editingSong.isVerified,
          updatedAt: now,
        }).catch(err => {
          console.error('[Editor] Error al actualizar en la nube:', err)
          alert('Los cambios se guardaron localmente, pero falló la sincronización a la nube. Verifica tu conexión.')
        })
      }
    } catch (err) {
      console.error('[Editor] Error fatal al guardar:', err)
      alert('Error al guardar la canción. Verifica tu conexión e intenta de nuevo.')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingSong?.id) return
    if (!window.confirm('¿Eliminar esta canción permanentemente?')) return

    setSaving(true)
    try {
      if (editingSong.remoteId && (userRole === 'admin' || editingSong.userId === user?.id)) {
        deleteSong(editingSong.remoteId).catch(err =>
          console.warn('[Editor] Error al eliminar de la nube:', err)
        )
      }
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
            {editingSong ? (isCommunitySong ? 'Personalizar Canción' : 'Editar Canción') : 'Nueva Canción'}
          </h2>
          <button className="btn-icon" onClick={closeEditor} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {isCommunitySong && (
          <div style={{ 
            background: 'rgba(52, 152, 219, 0.1)', 
            border: '1px solid rgba(52, 152, 219, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            margin: '0 24px 16px',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <Globe size={18} color="var(--blue)" />
            <p style={{ margin: 0, lineHeight: 1.4 }}>
              Esta canción es de la comunidad. Tus ediciones se guardarán como una <strong>copia personal</strong> en tu biblioteca local.
            </p>
          </div>
        )}

        {canEditCloud && (
          <div style={{ 
            background: 'rgba(46, 204, 113, 0.1)', 
            border: '1px solid rgba(46, 204, 113, 0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            margin: '0 24px 16px',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <Cloud size={18} color="var(--green)" />
            <p style={{ margin: 0, lineHeight: 1.4 }}>
              Los cambios se guardarán en la <strong>nube</strong> y estarán disponibles para todos los usuarios.
            </p>
          </div>
        )}

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

          {!user && (
            <div style={{
              background: 'rgba(212, 168, 67, 0.1)',
              border: '1px solid rgba(212, 168, 67, 0.2)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.85rem',
              color: 'var(--gold)',
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}>
              <Globe size={16} />
              <span>Esta canción se guardará localmente y se enviará para revisión de la comunidad.</span>
            </div>
          )}

          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Idioma</label>
            <select
              value={form.language}
              onChange={e => set('language', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
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
