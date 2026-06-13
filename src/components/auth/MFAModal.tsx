import { useState, useEffect } from 'react'
import { X, ShieldCheck, ShieldOff, Copy, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/services/supabase'
import QRCode from 'qrcode'

interface MFAModalProps {
  onClose: () => void
}

type Step = 'status' | 'enroll' | 'verify' | 'disable'

export default function MFAModal({ onClose }: MFAModalProps) {
  const [step, setStep] = useState<Step>('status')
  const [loading, setLoading] = useState(true)
  const [isMFAEnabled, setIsMFAEnabled] = useState(false)
  const [existingFactorId, setExistingFactorId] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    checkMFAStatus()
  }, [])

  async function checkMFAStatus() {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      const totp = data.totp.find(f => f.status === 'verified')
      if (totp) {
        setIsMFAEnabled(true)
        setExistingFactorId(totp.id)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function startEnroll() {
    setActionLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (error) throw error
      setSecret(data.totp.secret)
      setFactorId(data.id)
      setStep('enroll') // Muestra el paso inmediatamente
      // QR en background
      QRCode.toDataURL(data.totp.uri).then(setQrDataUrl)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function verifyEnroll() {
    if (code.length !== 6) { setError('El código debe tener 6 dígitos'); return }
    setActionLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      if (error) throw error
      setIsMFAEnabled(true)
      setStep('status')
      setCode('')
    } catch (err: any) {
      setError('Código incorrecto. Intenta de nuevo.')
    } finally {
      setActionLoading(false)
    }
  }

  async function disableMFA() {
    if (!existingFactorId) return
    setActionLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: existingFactorId })
      if (error) throw error
      setIsMFAEnabled(false)
      setExistingFactorId(null)
      setStep('status')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 440 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="var(--gold)" />
            Autenticación de dos factores
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 className="spin" size={28} color="var(--gold)" />
            </div>

          ) : step === 'status' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Estado actual */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                background: isMFAEnabled ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                borderRadius: 10, border: `1px solid ${isMFAEnabled ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`
              }}>
                {isMFAEnabled
                  ? <ShieldCheck size={28} color="var(--green)" />
                  : <ShieldOff size={28} color="var(--text-muted)" />
                }
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                    {isMFAEnabled ? 'MFA activado' : 'MFA desactivado'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {isMFAEnabled
                      ? 'Tu cuenta está protegida con un segundo factor'
                      : 'Agrega una capa extra de seguridad a tu cuenta'}
                  </p>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Con MFA activado necesitarás un código de tu app de autenticación
                (Google Authenticator, Authy, etc.) cada vez que inicies sesión.
              </p>

              {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={onClose}>Cancelar</button>
                {isMFAEnabled ? (
                  <button
                    className="btn-primary"
                    style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
                    onClick={() => { setError(''); setStep('disable') }}
                  >
                    <ShieldOff size={14} /> Desactivar MFA
                  </button>
                ) : (
                  <button className="btn-primary" onClick={startEnroll} disabled={actionLoading}>
                    {actionLoading
                      ? <><Loader2 className="spin" size={14} /> Cargando...</>
                      : <><ShieldCheck size={14} /> Activar MFA</>
                    }
                  </button>
                )}
              </div>
            </div>

          ) : step === 'enroll' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Escanea este código QR con tu app de autenticación:
              </p>

              {/* QR Code */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  padding: 12, background: '#fff', borderRadius: 10,
                  border: '1px solid var(--border)',
                  width: 204, height: 204,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {qrDataUrl
                    ? <img src={qrDataUrl} alt="QR MFA" style={{ width: 180, height: 180, display: 'block' }} />
                    : <Loader2 className="spin" size={28} color="#999" />
                  }
                </div>
              </div>

              {/* Clave manual */}
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-muted)' }}>
                  ¿No puedes escanear? Ingresa la clave manualmente:
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <code style={{
                    flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
                    borderRadius: 8, border: '1px solid var(--border)',
                    fontSize: 12, letterSpacing: 2, color: 'var(--text-primary)',
                    wordBreak: 'break-all'
                  }}>
                    {secret}
                  </code>
                  <button className="btn-icon" onClick={copySecret} title="Copiar">
                    {copied ? <Check size={16} color="var(--green)" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* Código de verificación */}
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Ingresa el código de 6 dígitos para confirmar:
                </label>
                <input
                  type="text"
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
                  style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }}
                  autoFocus
                />
              </div>

              {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={() => { setStep('status'); setError('') }}>
                  Atrás
                </button>
                <button className="btn-primary" onClick={verifyEnroll} disabled={actionLoading || code.length !== 6}>
                  {actionLoading
                    ? <><Loader2 className="spin" size={14} /> Verificando...</>
                    : <><Check size={14} /> Confirmar</>
                  }
                </button>
              </div>
            </div>

          ) : step === 'disable' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                padding: 16, background: 'rgba(239,68,68,0.08)',
                borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)'
              }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                  ¿Desactivar MFA?
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Tu cuenta quedará protegida solo con tu contraseña. Podrás reactivarlo en cualquier momento.
                </p>
              </div>

              {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={() => { setStep('status'); setError('') }}>
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
                  onClick={disableMFA}
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? <><Loader2 className="spin" size={14} /> Desactivando...</>
                    : <><ShieldOff size={14} /> Sí, desactivar</>
                  }
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}