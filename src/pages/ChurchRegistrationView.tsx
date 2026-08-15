import { useState } from 'react'
import { Music2, Church, Loader2, ChevronRight, Globe } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useAppStore } from '@/stores'
import { LATAM_COUNTRIES } from '@/constants/latamLocations'

interface ChurchRegistrationViewProps {
  userId: string
  userDisplayName?: string | null
  onComplete: () => void
}

/**
 * Vista de registro rápido de iglesia para usuarios que se autenticaron con Google
 * y necesitan completar su perfil (full_name, churchName, city).
 * Diseño Gold & Black, coherente con la identidad visual de Proclama.
 */
export default function ChurchRegistrationView({ userId, userDisplayName, onComplete }: ChurchRegistrationViewProps) {
  const [fullName, setFullName] = useState(userDisplayName || '')
  const [churchName, setChurchName] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [customCountry, setCustomCountry] = useState('')
  const [customCity, setCustomCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (skip = false) => {
    if (!fullName.trim()) {
      setError('Ingresa tu nombre para continuar.')
      return
    }

    setLoading(true)
    setError(null)

    const finalCountry = skip
      ? ''
      : country === 'OTHER'
      ? customCountry.trim()
      : country;
    const finalCity = skip
      ? ''
      : city === 'OTHER'
      ? customCity.trim()
      : city;

    try {
      const settingsUpdate: Record<string, string> = {}
      if (!skip && churchName.trim()) settingsUpdate.churchName = churchName.trim()
      if (!skip && finalCountry) settingsUpdate.country = finalCountry
      if (!skip && finalCity) settingsUpdate.city = finalCity

      // Merge with existing settings
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', userId)
        .maybeSingle()

      const mergedSettings = {
        ...(existingProfile?.settings || {}),
        ...settingsUpdate,
        onboardingComplete: true,
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          settings: mergedSettings,
        })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      // Update cloud settings in the store
      try {
        const { updateSettings } = useAppStore.getState()
        updateSettings(mergedSettings as any)
      } catch {}

      onComplete()
    } catch (err: any) {
      console.error('Church registration error:', err)
      setError(err?.message || 'Error al guardar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="church-reg-overlay">
      <div className="church-reg-card">
        <div className="church-reg-header">
          <div className="church-reg-logo">
            <Music2 size={28} color="#c9a658" />
            <span>Proclama <span>Pro</span></span>
          </div>
          <div className="church-reg-icon-wrap">
            <Church size={32} color="#c9a658" />
          </div>
          <h1>Completa tu perfil</h1>
          <p>Solo necesitamos unos datos más para personalizar tu experiencia.</p>
        </div>

        <div className="church-reg-form">
          <div className="church-reg-input-group">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="church-reg-input-icon"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <input
              type="text"
              placeholder="Tu nombre completo"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              autoComplete="name"
              autoFocus
            />
          </div>

          <div className="church-reg-input-group">
            <Church size={16} className="church-reg-input-icon" />
            <input
              type="text"
              placeholder="Nombre de tu iglesia"
              value={churchName}
              onChange={e => setChurchName(e.target.value)}
              autoComplete="organization"
            />
          </div>

          {/* Selector de País */}
          <div className="church-reg-input-group">
            <Globe size={16} className="church-reg-input-icon" />
            <select
              value={country}
              onChange={e => {
                setCountry(e.target.value)
                setCity('')
              }}
              className="church-reg-select"
            >
              <option value="" disabled>Selecciona tu país</option>
              {LATAM_COUNTRIES.map(c => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
              <option value="OTHER">Otro / No listado</option>
            </select>
          </div>

          {/* Input manual de País */}
          {country === 'OTHER' && (
            <div className="church-reg-input-group">
              <Globe size={16} className="church-reg-input-icon" />
              <input
                type="text"
                placeholder="Escribe tu país"
                value={customCountry}
                onChange={e => setCustomCountry(e.target.value)}
              />
            </div>
          )}

          {/* Selector de Ciudad */}
          {country && country !== 'OTHER' && (
            <div className="church-reg-input-group">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="church-reg-input-icon"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                className="church-reg-select"
              >
                <option value="" disabled>Selecciona tu ciudad</option>
                {LATAM_COUNTRIES.find(c => c.name === country)?.cities.map(ct => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
                <option value="OTHER">Otra ciudad / No listada</option>
              </select>
            </div>
          )}

          {/* Input manual de Ciudad */}
          {(city === 'OTHER' || country === 'OTHER') && (
            <div className="church-reg-input-group">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="church-reg-input-icon"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <input
                type="text"
                placeholder="Escribe tu ciudad"
                value={customCity}
                onChange={e => setCustomCity(e.target.value)}
              />
            </div>
          )}

          <button
            type="button"
            className="church-reg-btn-primary"
            onClick={() => handleSave(false)}
            disabled={loading}
          >
            {loading ? <Loader2 className="spin" size={18} /> : <>Continuar <ChevronRight size={18} /></>}
          </button>

          <button
            type="button"
            className="church-reg-btn-secondary"
            onClick={() => handleSave(true)}
            disabled={loading}
          >
            Omitir por ahora
          </button>

          {error && <div className="church-reg-error">{error}</div>}
        </div>

        <p className="church-reg-hint">Podrás actualizar estos datos más adelante en Ajustes.</p>
      </div>

      <style>{`
        .church-reg-overlay {
          position: fixed;
          inset: 0;
          background: #05070d;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 3000;
        }
        .church-reg-card {
          background: #0f131c;
          border-radius: 20px;
          border: 1px solid rgba(201, 166, 88, 0.12);
          padding: 40px 32px;
          max-width: 420px;
          width: 100%;
          box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 80px rgba(201, 166, 88, 0.04);
          animation: churchCardIn 0.35s ease-out;
        }
        @keyframes churchCardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .church-reg-header {
          text-align: center;
          margin-bottom: 28px;
        }
        .church-reg-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .church-reg-logo span {
          font-family: 'Montserrat', sans-serif;
          font-size: 22px;
          font-weight: 600;
          color: white;
        }
        .church-reg-logo span span {
          color: #c9a658;
        }
        .church-reg-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(201, 166, 88, 0.1);
          border: 2px solid rgba(201, 166, 88, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }
        .church-reg-header h1 {
          font-family: 'Montserrat', sans-serif;
          font-size: 22px;
          color: white;
          margin: 0 0 8px;
          font-weight: 700;
        }
        .church-reg-header p {
          color: var(--text-secondary);
          font-size: 14px;
          margin: 0;
        }

        /* ── Form ── */
        .church-reg-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .church-reg-input-group {
          position: relative;
          display: flex;
          align-items: center;
        }
        .church-reg-input-icon {
          position: absolute;
          left: 14px;
          color: #5a6577;
          pointer-events: none;
          z-index: 1;
          flex-shrink: 0;
        }
        .church-reg-input-group input {
          width: 100%;
          padding: 14px 14px 14px 42px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          color: white;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .church-reg-input-group input:focus {
          border-color: rgba(201, 166, 88, 0.5);
          box-shadow: 0 0 0 3px rgba(201, 166, 88, 0.08);
        }
        .church-reg-select {
          width: 100%;
          padding: 14px 14px 14px 42px;
          background: #0f131c;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          color: white;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
          cursor: pointer;
        }
        .church-reg-select:focus {
          border-color: rgba(201, 166, 88, 0.5);
          box-shadow: 0 0 0 3px rgba(201, 166, 88, 0.08);
        }
        .church-reg-select option {
          background: #0f131c;
          color: white;
        }
        .church-reg-input-group input::placeholder {
          color: #5a6577;
        }

        /* ── Buttons ── */
        .church-reg-btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px 20px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #d5b164, #bc933b);
          color: #05070d;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 8px 24px rgba(201, 166, 88, 0.2);
          margin-top: 4px;
        }
        .church-reg-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 32px rgba(201, 166, 88, 0.3);
        }
        .church-reg-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .church-reg-btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px 20px;
          border-radius: 12px;
          border: 1px solid rgba(201, 166, 88, 0.25);
          background: transparent;
          color: #c9a658;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .church-reg-btn-secondary:hover:not(:disabled) {
          background: rgba(201, 166, 88, 0.06);
          border-color: rgba(201, 166, 88, 0.45);
        }
        .church-reg-btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Error ── */
        .church-reg-error {
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(252, 129, 129, 0.1);
          border: 1px solid rgba(252, 129, 129, 0.2);
          color: #fca5a5;
          font-size: 13px;
          text-align: center;
        }

        /* ── Hint ── */
        .church-reg-hint {
          text-align: center;
          color: var(--text-muted);
          font-size: 12px;
          margin: 20px 0 0;
        }

        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .church-reg-card {
            padding: 32px 20px;
            border-radius: 16px;
          }
        }
      `}</style>
    </div>
  )
}
