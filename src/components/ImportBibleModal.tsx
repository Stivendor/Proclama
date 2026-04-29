import React, { useState, useEffect } from 'react'
import { X, Search, Lock, Download, Check } from 'lucide-react'
import { usePlan } from '@/hooks/usePlan'
import { useBibleAPI } from '@/hooks/useBibleAPI'
import { useAppStore } from '@/stores'
import { db } from '@/db'
import type { HelloAOBibleInfo, ImportedBibleReference } from '@/types'

interface ImportBibleModalProps {
  onClose: () => void
  onImportSuccess?: () => void
}

export default function ImportBibleModal({ onClose, onImportSuccess }: ImportBibleModalProps) {
  const { isPremium } = usePlan()
  const setActiveView = useAppStore(s => s.setActiveView)
  const { fetchBibles, loading, error } = useBibleAPI()

  const [bibles, setBibles] = useState<HelloAOBibleInfo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isPremium) {
      loadBibles()
    }
  }, [isPremium])

  useEffect(() => {
    const loadImported = async () => {
      const all = await db.imported_bibles.toArray()
      setImportedIds(new Set(all.map(b => b.id)))
    }
    loadImported()
  }, [])

  const loadBibles = async () => {
    const results = await fetchBibles()
    setBibles(results)
  }

  const handleImport = async (bible: HelloAOBibleInfo) => {
    if (importedIds.has(bible.id)) return

    try {
      const record: ImportedBibleReference = {
        id: bible.id,
        name: bible.name,
        languageId: bible.language,
        languageName: bible.languageEnglishName || bible.languageName || bible.language,
        importedAt: Date.now()
      }

      await db.imported_bibles.put(record)
      setImportedIds(prev => new Set(prev).add(bible.id))

      if (onImportSuccess) onImportSuccess()
    } catch (err) {
      console.error('Error importando biblia:', err)
      alert('Hubo un error al intentar guardar la Biblia localmente.')
    }
  }

  const filteredBibles = bibles.filter(b => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return b.name.toLowerCase().includes(q) ||
      b.englishName.toLowerCase().includes(q) ||
      b.languageName.toLowerCase().includes(q) ||
      (b.languageEnglishName && b.languageEnglishName.toLowerCase().includes(q))
  })

  const groupedBibles = filteredBibles.reduce((acc, bible) => {
    const lang = bible.languageEnglishName || bible.languageName || bible.language
    if (!acc[lang]) acc[lang] = []
    // Evitar meter lo mismo dos veces por ids repetidos en HelloAO
    if (!acc[lang].find(x => x.id === bible.id)) {
      acc[lang].push(bible)
    }
    return acc
  }, {} as Record<string, HelloAOBibleInfo[]>)

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '600px',
          width: '90%',
          height: '70vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#0d1117',
          borderRadius: '12px',
          border: '1px solid var(--border-color)'
        }}
      >
        <div
          className="modal-header"
          style={{
            padding: '20px',
            display: 'flex', // Eliminamos el borderBottom de aquí para usar la línea personalizada
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Importar Biblias (HelloAO)</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        {/* ESTA ES LA LÍNEA LARGA QUE SUBRAYA TODO */}
        <div style={{
          height: '1px',
          width: '100%',
          background: 'linear-gradient(90deg, transparent, var(--border-color), transparent)',
          opacity: 0.8
        }} />

        {!isPremium ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center',
            background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(139, 92, 246, 0.1) 100%)',
            position: 'absolute',
            inset: 0,
            top: '73px',
            zIndex: 10
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px'
            }}>
              <Lock size={32} color="#d4a843" />
            </div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Función Proclama Pro</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '400px', lineHeight: 1.5 }}>
              Desbloquea el acceso a cientos de traducciones bíblicas en docenas de idiomas instantáneamente.
            </p>
            <button 
              className="btn-primary" 
              onClick={() => { useAppStore.getState().setForceLanding(true, 'planes'); onClose(); }}
              style={{ 
                padding: '12px 32px', 
                fontSize: '1.1rem', 
                background: '#d4a843', 
                color: '#0d1117', 
                borderRadius: '8px', 
                border: 'none', 
                cursor: 'pointer', 
                fontWeight: 600 
              }}
            >
              Ver Planes Pro
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 12px',
                gap: '8px'
              }}>
                <Search size={18} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Buscar por idioma o nombre de Biblia..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-color)',
                    outline: 'none',
                    fontSize: '1rem'
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {loading && bibles.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                  Cargando biblioteca de Biblias...
                </div>
              ) : error ? (
                <div style={{ textAlign: 'center', color: '#ff4444', marginTop: '40px' }}>
                  <p>{error}</p>
                  <button className="btn-ghost" onClick={loadBibles} style={{ marginTop: '12px' }}>Reintentar</button>
                </div>
              ) : Object.keys(groupedBibles).length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                  No se encontraron biblias para tu búsqueda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {Object.entries(groupedBibles).map(([language, langBibles]) => (
                    <div key={language}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        {language}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {langBibles.map(b => {
                          const isImported = importedIds.has(b.id)
                          return (
                            <div
                              key={b.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px',
                                background: 'var(--bg-body)',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 500, marginBottom: '4px' }}>{b.name} <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{b.id}</span></div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                  {b.totalNumberOfChapters} Capítulos • {b.totalNumberOfVerses} Versículos
                                </div>
                              </div>

                              <button
                                className={isImported ? "btn-ghost" : "btn-primary"}
                                style={{
                                  minWidth: '110px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  opacity: isImported ? 0.7 : 1,
                                  cursor: isImported ? 'default' : 'pointer'
                                }}
                                onClick={() => handleImport(b)}
                                disabled={isImported}
                              >
                                {isImported ? (
                                  <>
                                    <Check size={16} /> Importada
                                  </>
                                ) : (
                                  <>
                                    <Download size={16} /> Agregar
                                  </>
                                )}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

