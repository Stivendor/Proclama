import { useEffect, useState } from 'react'
import { X, Copy, Check, UserPlus, Ban } from 'lucide-react'
import {
  createCollaborator, listCollaborators, revokeCollaborator, collabLink,
  type CollaboratorRow,
} from '@/services/collab'

export default function CollaboratorsModal({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const [rows, setRows] = useState<CollaboratorRow[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const refresh = () => listCollaborators(ownerId).then(setRows).catch(e => console.warn('[Collab] refresh failed', e))
  useEffect(() => { refresh() }, [ownerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const created = await createCollaborator(ownerId, name)
    setBusy(false)
    if (created) {
      setName('')
      await refresh()
      copy(created.id, created.token)
    } else {
      alert('No se pudo crear el colaborador. Revisa tu conexión.')
    }
  }

  const copy = (id: string, token: string) => {
    const link = collabLink(token)
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {
      // Fallback: mostrar el enlace para copiarlo a mano
      window.prompt('No se pudo copiar automáticamente. Copia el enlace:', link)
    })
  }

  const revoke = async (row: CollaboratorRow) => {
    if (!confirm(`¿Revocar el acceso de "${row.name}"? Su enlace dejará de funcionar.`)) return
    await revokeCollaborator(row.id)
    refresh()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="collab-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Colaboradores</h3>
          <button className="btn-icon-xs" onClick={onClose}><X size={14} /></button>
        </div>

        <p style={{ fontSize: '.85rem', opacity: .75 }}>
          Comparte un enlace para que el líder de alabanza arme los repertorios desde su casa,
          sin necesidad de cuenta. Los cambios se sincronizan solos.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="Nombre (ej. Juan — alabanza)"
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={create} disabled={busy}>
            <UserPlus size={14} /> Crear enlace
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          {rows.map(r => (
            <div key={r.id} className="setlist-song-item" style={{ cursor: 'default', opacity: r.revokedAt ? .5 : 1 }}>
              <div className="setlist-song-info">
                <span className="setlist-song-name">{r.name}{r.revokedAt ? ' (revocado)' : ''}</span>
                <span className="setlist-song-artist">
                  {r.lastSeenAt ? `Último acceso: ${new Date(r.lastSeenAt).toLocaleDateString()}` : 'Nunca ha entrado'}
                </span>
              </div>
              {!r.revokedAt && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon-xs" title="Copiar enlace" onClick={() => copy(r.id, r.token)}>
                    {copiedId === r.id ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                  <button className="btn-icon-xs danger" title="Revocar acceso" onClick={() => revoke(r)}>
                    <Ban size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <p style={{ opacity: .6, textAlign: 'center' }}>Sin colaboradores todavía.</p>}
        </div>
      </div>
    </div>
  )
}
