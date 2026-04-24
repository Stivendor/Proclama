import { useState } from 'react'
import { Monitor, Trash2, Loader2, ShieldAlert, LogOut } from 'lucide-react'
import { useAppStore } from '@/stores'
import { revokeDevice, registerDevice, fetchUserDevices } from '@/services/supabase'
import { getDeviceId, getDeviceName } from '@/utils/deviceFingerprint'
import { supabase } from '@/services/supabase'

export default function DeviceBlockedModal() {
  const { userDevices, setUserDevices, setDeviceBlocked, logout } = useAppStore()
  const [revoking, setRevoking] = useState<string | null>(null)

  const handleRevoke = async (deviceRowId: string) => {
    setRevoking(deviceRowId)
    const ok = await revokeDevice(deviceRowId)
    if (ok) {
      const currentDeviceId = getDeviceId()
      const updated = await fetchUserDevices(currentDeviceId)
      setUserDevices(updated)
      // Si ahora hay espacio, desbloquear y registrar este dispositivo
      const otherDevices = updated.filter(d => !d.isCurrent)
      if (otherDevices.length < 2) {
        setDeviceBlocked(false)
        await registerDevice(currentDeviceId, getDeviceName())
      }
    }
    setRevoking(null)
  }

  const handleLogout = async () => {
    logout()
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn(e)
    }
  }

  return (
    <div className="device-blocked-overlay">
      <div className="device-blocked-card">
        <div className="device-blocked-icon">
          <ShieldAlert size={48} />
        </div>
        <h2 className="device-blocked-title">
          Límite de dispositivos alcanzado
        </h2>
        <p className="device-blocked-desc">
          Tu cuenta Pro ya está activa en <strong>2 dispositivos</strong>. 
          Para usar Proclama en este equipo, revoca el acceso de uno de los dispositivos actuales.
        </p>

        <div className="device-blocked-list">
          {userDevices.filter(d => !d.isCurrent).map(device => (
            <div key={device.id} className="device-blocked-item">
              <div className="device-blocked-item-info">
                <Monitor size={20} />
                <div>
                  <div className="device-blocked-item-name">{device.deviceName}</div>
                  <div className="device-blocked-item-date">
                    Último acceso: {new Date(device.lastSeen).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <button
                className="device-blocked-revoke-btn"
                onClick={() => handleRevoke(device.id)}
                disabled={!!revoking}
              >
                {revoking === device.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                Revocar
              </button>
            </div>
          ))}
        </div>

        <button className="device-blocked-logout" onClick={handleLogout}>
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>

      <style>{`
        .device-blocked-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(8, 8, 14, 0.97);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .device-blocked-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          max-width: 460px;
          width: 100%;
          padding: 40px 32px;
          border-radius: 20px;
          background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .device-blocked-icon {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: rgba(201, 166, 88, 0.1);
          display: flex; align-items: center; justify-content: center;
          color: #f0dfb6;
        }

        .device-blocked-title {
          font-size: 20px;
          font-weight: 700;
          color: #f0dfb6;
          text-align: center;
          margin: 0;
        }

        .device-blocked-desc {
          font-size: 14px;
          color: #9aa6bb;
          text-align: center;
          margin: 0;
          line-height: 1.6;
        }
        .device-blocked-desc strong { color: #d5dce7; }

        .device-blocked-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }

        .device-blocked-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          transition: background 0.2s;
        }
        .device-blocked-item:hover { background: rgba(255,255,255,0.06); }

        .device-blocked-item-info {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #9aa6bb;
        }

        .device-blocked-item-name {
          color: #d5dce7;
          font-weight: 600;
          font-size: 14px;
        }

        .device-blocked-item-date {
          color: #778398;
          font-size: 12px;
          margin-top: 2px;
        }

        .device-blocked-revoke-btn {
          background: rgba(255, 60, 60, 0.1);
          border: 1px solid rgba(255, 60, 60, 0.2);
          color: #ff7070;
          border-radius: 8px;
          padding: 8px 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .device-blocked-revoke-btn:hover:not(:disabled) {
          background: rgba(255, 60, 60, 0.18);
          border-color: rgba(255, 60, 60, 0.35);
        }
        .device-blocked-revoke-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .device-blocked-logout {
          background: none;
          border: none;
          color: #778398;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          transition: all 0.2s;
          margin-top: 8px;
        }
        .device-blocked-logout:hover { color: #d5dce7; background: rgba(255,255,255,0.05); }
      `}</style>
    </div>
  )
}
