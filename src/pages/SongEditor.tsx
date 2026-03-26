import { useState, useEffect } from 'react'
import { Save, X, Play, Eye, Tag, Plus, Menu, Cloud, CloudOff } from 'lucide-react'
import { db } from '@/db'
import { useAppStore, useProjectionStore } from '@/stores'
import { parseLyrics } from '@/services/lyricsParser'
import type { Song } from '@/types'
import { createSong, updateSong } from '@/services/supabase'

const VERSE_LABELS = ['[Verso 1]', '[Verso 2]', '[Coro]', '[Pre-Coro]', '[Puente]', '[Final]', '[Intro]']
const LANGUAGES = ['Español', 'Inglés', 'Portugués', 'Otro']
const KEYS = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si',
              'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const EMPTY_SONG: Omit<Song, 'id'> = {
  title: '', artist: '', lyrics: '', key: '', tags: [],
  language: 'Español', usageCount: 0, isPublic: true,
  isVerified: false,
  createdAt: new Date(), updatedAt: new Date()
}

export default function SongEditor() {
  const { editingSong, setEditingSong, setActiveView, isSidebarOpen, toggleSidebar, user, userRole } = useAppStore()
  const { loadSong } = useProjectionStore()

  const [form, setForm] = useState<Omit<Song, 'id'>>(editingSong ? { ...editingSong } : { ...EMPTY_SONG })
  const [tagInput, setTagInput] = useState('')
  const [previewSlide, setPreviewSlide] = useState(0)
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState('')

  const slides = parseLyrics(form.lyrics)

  useEffect(() => {
    setPreviewSlide(0)
  }, [form.lyrics])

  const set = (key: keyof typeof form, value: any) =>
    setForm(f => ({ ...f, [key]: value }))

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      set('tags', [...form.tags, t])
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => set('tags', form.tags.filter(t => t !== tag))

  const insertLabel = (label: string) => {
    const textarea = document.getElementById('lyrics-textarea') as HTMLTextAreaElement
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const before = value.slice(0, selectionStart)
    const after = value.slice(selectionEnd)
    const newVal = `${before}${before && !before.endsWith('\n') ? '\n' : ''}${label}\n${after}`
    set('lyrics', newVal)
    setTimeout(() => {
      textarea.focus()
      const pos = before.length + (before && !before.endsWith('\n') ? 1 : 0) + label.length + 1
      textarea.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setTitleError('El título es requerido'); return }
    setTitleError('')
    setSaving(true)
    try {
      const now = new Date()
      const isVerified = userRole === 'admin' ? form.isPublic : false

      if (editingSong?.id) {
        // Actualizar en Supabase
        const updates = { 
          ...form, 
          isVerified: userRole === 'admin' ? form.isPublic : (editingSong.isVerified ?? false),
          updatedAt: now, 
          userId: user?.id 
        }
        const updated = await updateSong(editingSong.id, updates)
        // Reflejar en Dexie
        await db.songs.update(editingSong.id, { ...(updated ?? { ...updates, id: editingSong.id }) })
      } else {
        const payload: Omit<Song, 'id'> = { 
          ...form, 
          isVerified,
          createdAt: now, 
          updatedAt: now, 
          userId: user?.id 
        }
        const created = await createSong(payload)
        if (created) {
          await db.songs.add(created)
        } else {
          await db.songs.add(payload as any)
        }
      }
      setEditingSong(null)
      setActiveView('library')
    } finally {
      setSaving(false)
    }
  }

  const handleProjectNow = () => {
    if (!form.title) return
    loadSong({ ...form, id: editingSong?.id })
  }

  return (
    <div className="song-editor">
      {/* Header */}
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <h1>{editingSong ? 'Editar Canción' : 'Nueva Canción'}</h1>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => { setEditingSong(null); setActiveView('library') }}>
            <X size={15} /> Cancelar
          </button>
          <button className="btn-ghost" onClick={handleProjectNow} disabled={!form.title}>
            <Play size={15} /> Proyectar ahora
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="editor-body">
        {/* Form */}
        <div className="editor-form">
          {/* Metadata */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="song-title">Título *</label>
              <input
                id="song-title"
                type="text"
                placeholder="Título de la canción"
                value={form.title}
                onChange={e => { set('title', e.target.value); if (e.target.value.trim()) setTitleError('') }}
                required aria-required="true" aria-describedby={titleError ? 'title-error' : undefined}
                className={titleError ? 'error' : ''}
                autoComplete="off"
              />
              {titleError && <span id="title-error" role="alert" style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>{titleError}</span>}
            </div>
            <div className="form-group">
              <label>Artista / Autor</label>
              <input
                type="text"
                placeholder="Nombre del artista / autor"
                value={form.artist}
                onChange={e => set('artist', e.target.value)}
                autoComplete="organization"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tonalidad</label>
              <select value={form.key} onChange={e => set('key', e.target.value)}>
                <option value="">Sin tonalidad</option>
                {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Idioma</label>
              <select value={form.language} onChange={e => set('language', e.target.value)}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="privacy-label">Visibilidad</label>
              {user ? (
                <>
                  <div className="privacy-buttons">
                    <button 
                      type="button"
                      className={`privacy-btn ${form.isPublic ? 'active public' : ''}`} 
                      onClick={() => set('isPublic', true)}
                    >
                      <Cloud size={14} /> Pública
                    </button>
                    <button 
                      type="button"
                      className={`privacy-btn ${!form.isPublic ? 'active private' : ''}`} 
                      onClick={() => set('isPublic', false)}
                    >
                      <CloudOff size={14} /> Solo yo
                    </button>
                  </div>
                  <p className="privacy-hint">
                    {form.isPublic 
                      ? (userRole === 'admin' 
                          ? '🌐 Visible para todos (Verificada).' 
                          : '⏳ Requiere verificación de un administrador.') 
                      : '🔒 Solo tú podrás ver esta canción.'}
                  </p>
                </>
              ) : (
                <div className="local-only-hint" style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '11px', display: 'flex', gap: '8px', alignItems: 'center', lineHeight: '1.4' }}>
                  <CloudOff size={12} color="var(--text-muted)" />
                  <span>Modo local. Inicia sesión para compartir.</span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="form-group">
            <label><Tag size={13} /> Etiquetas</label>
            <div className="tag-input-row">
              <input
                type="text" placeholder="Añadir etiqueta..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <button className="btn-ghost" onClick={addTag}><Plus size={14} /></button>
            </div>
            <div className="tags-row">
              {form.tags.map(t => (
                <span key={t} className="tag removable" onClick={() => removeTag(t)}>
                  {t} ×
                </span>
              ))}
            </div>
          </div>

          {/* Lyrics toolbar */}
          <div className="form-group lyrics-group">
            <label>Letra</label>
            <div className="lyrics-toolbar">
              {VERSE_LABELS.map(lbl => (
                <button key={lbl} className="btn-label" onClick={() => insertLabel(lbl)}>
                  {lbl}
                </button>
              ))}
            </div>
            <textarea
              id="lyrics-textarea"
              className="lyrics-textarea"
              placeholder="Escribe o pega la letra aquí…&#10;&#10;Usa líneas en blanco para separar estrofas.&#10;Puedes usar etiquetas como [Coro] o [Verso 1]."
              value={form.lyrics}
              onChange={e => set('lyrics', e.target.value)}
              spellCheck={false}
              rows={18}
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="editor-preview">
          <div className="preview-header">
            <Eye size={14} />
            Vista previa — {slides.length} estrofas
          </div>

          {/* Mini projection preview */}
          <div className="mini-projection">
            {slides.length > 0 ? (
              <>
                {slides[previewSlide]?.label && (
                  <div className="mini-label">{slides[previewSlide].label}</div>
                )}
                {slides[previewSlide]?.lines.map((line, i) => (
                  <div key={i} className="mini-line">{line}</div>
                ))}
              </>
            ) : (
              <div className="mini-empty">Escribe la letra para ver la vista previa</div>
            )}
          </div>

          {/* Slide navigation */}
          <div className="preview-slides">
            {slides.map((slide, i) => (
              <button
                key={i}
                className={`preview-slide-btn ${i === previewSlide ? 'active' : ''}`}
                onClick={() => setPreviewSlide(i)}
              >
                {slide.label && <span className="slide-label-mini">{slide.label}</span>}
                <span>{slide.lines[0]?.slice(0, 30)}{(slide.lines[0]?.length ?? 0) > 30 ? '…' : ''}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
