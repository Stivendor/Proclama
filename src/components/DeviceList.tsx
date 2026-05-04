import { useEffect, useState } from 'react'
import { Monitor, Trash2, Loader2, Edit2, Check, X } from 'lucide-react'
import { fetchUserDevices, revokeDevice, registerDevice, updateDeviceName } from '@/services/supabase'
import type { UserDevice } from '@/services/supabase'
import { getDeviceId, getDeviceName } from '@/utils/deviceFingerprint'
import { useAppStore } from '@/stores'

export default function DeviceList() {
  const { setUserDevices } = useAppStore()
  const [devices, setDevices] = useState<UserDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const load = async () => {
    setLoading(true)
    const currentId = getDeviceId()
    const currentName = getDeviceName()
    // Registrar/actualizar este dispositivo y obtener la lista completa
    const list = await registerDevice(currentId, currentName)
    setDevices(list)
    setUserDevices(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleRevoke = async (deviceRowId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas revocar este dispositivo? Se cerrará la sesión en ese equipo.')) return
    setRevoking(deviceRowId)
    await revokeDevice(deviceRowId)
    await load()
    setRevoking(null)
  }

  const startEdit = (device: UserDevice) => {
    setEditingId(device.id)
    setEditName(device.deviceName)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim() || savingEdit) return
    setSavingEdit(true)
    const ok = await updateDeviceName(editingId, editName.trim())
    if (ok) {
      setDevices(prev => prev.map(d => d.id === editingId ? { ...d, deviceName: editName.trim() } : d))
      setEditingId(null)
    }
    setSavingEdit(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#778398', fontSize: 13, padding: '8px 0' }}>
        <Loader2 size={14} className="spin" /> Cargando dispositivos…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {devices.map(device => (
        <div key={device.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: '10px',
          background: device.isCurrent ? 'rgba(201,166,88,0.08)' : 'rgba(255,255,255,0.04)',
          border: device.isCurrent ? '1px solid rgba(201,166,88,0.2)' : '1px solid rgba(255,255,255,0.06)',
          transition: 'background 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Monitor size={18} color={device.isCurrent ? '#f0dfb6' : '#9aa6bb'} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingId === device.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="text"
                      className="input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      autoFocus
                      style={{ 
                        height: '24px', padding: '2px 8px', fontSize: '13px', 
                        width: '140px', background: 'rgba(255,255,255,0.05)'
                      }}
                    />
                    <button onClick={saveEdit} disabled={savingEdit} className="btn-icon" style={{ width: 24, height: 24 }}>
                      {savingEdit ? <Loader2 size={12} className="spin" /> : <Check size={12} color="#4ade80" />}
                    </button>
                    <button onClick={cancelEdit} disabled={savingEdit} className="btn-icon" style={{ width: 24, height: 24 }}>
                      <X size={12} color="#ff7070" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span style={{ color: device.isCurrent ? '#f0dfb6' : '#d5dce7', fontWeight: 600, fontSize: '13px' }}>
                      {device.deviceName}
                    </span>
                    <button 
                      onClick={() => startEdit(device)} 
                      className="btn-icon" 
                      style={{ opacity: 0.5, width: 20, height: 20 }}
                      title="Renombrar dispositivo"
                    >
                      <Edit2 size={10} />
                    </button>
                  </>
                )}
                {device.isCurrent && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                    borderRadius: '999px', background: 'rgba(201,166,88,0.2)', color: '#f0dfb6',
                    letterSpacing: '0.5px',
                  }}>
                    ESTE EQUIPO
                  </span>
                )}
              </div>
              <div style={{ color: '#778398', fontSize: '12px', marginTop: 2 }}>
                Último acceso: {new Date(device.lastSeen).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
          {!device.isCurrent && (
            <button
              onClick={() => handleRevoke(device.id)}
              disabled={!!revoking}
              style={{
                background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.2)',
                color: '#ff7070', borderRadius: '8px', padding: '6px 12px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
                fontWeight: 500, transition: 'all 0.2s',
              }}
            >
              {revoking === device.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
              Revocar
            </button>
          )}
        </div>
      ))}
      {devices.length === 0 && (
        <div style={{ color: '#778398', fontSize: 13, padding: '8px 0' }}>
          No hay dispositivos registrados.
        </div>
      )}
    </div>
  )
}
