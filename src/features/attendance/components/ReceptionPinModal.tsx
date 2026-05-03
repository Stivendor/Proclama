import { useState, useEffect } from 'react'
import { X, ShieldCheck, Sliders, Copy, Check, Smartphone, Key } from 'lucide-react'
import { supabase } from '@/services/supabase'

interface ReceptionPinModalProps {
  userId: string
  onClose: () => void
}

export function ReceptionPinModal({ userId, onClose }: ReceptionPinModalProps) {
  const [receptionPin, setReceptionPin] = useState<string | null>(null)
  const [loadingPin, setLoadingPin] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function loadPin() {
      let currentUserId = userId
      if (!currentUserId || currentUserId === 'guest') {
        const { data: { session } } = await supabase.auth.getSession()
        currentUserId = session?.user?.id ?? ''
      }
      
      if (!currentUserId) return

      setLoadingPin(true)
      const { data } = await supabase
        .from('church_access_codes')
        .select('pin')
        .eq('user_id', currentUserId)
        .maybeSingle()
        
      if (data) setReceptionPin(data.pin)
      setLoadingPin(false)
    }
    
    loadPin()
  }, [userId])

  const handleGeneratePin = async () => {
    try {
      setLoadingPin(true)
      const newPin = Math.floor(1000 + Math.random() * 9000).toString()

      let currentUserId = userId
      if (!currentUserId || currentUserId === 'guest') {
        const { data: { session } } = await supabase.auth.getSession()
        currentUserId = session?.user?.id ?? ''
      }

      if (!currentUserId) {
        alert('Debes iniciar sesión para generar un PIN de acceso.')
        setLoadingPin(false)
        return
      }

      const { data: existing, error: fetchError } = await supabase
        .from('church_access_codes')
        .select('id')
        .eq('user_id', currentUserId)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (existing) {
        const { error: updateError } = await supabase
          .from('church_access_codes')
          .update({ pin: newPin, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('church_access_codes')
          .insert({ user_id: currentUserId, pin: newPin, label: 'Proclama Principal' })
        if (insertError) throw insertError
      }

      setReceptionPin(newPin)
    } catch (err: any) {
      console.error('Error al generar PIN:', err)
      alert(`Error al generar el PIN: ${err.message || 'Error desconocido'}`)
    } finally {
      setLoadingPin(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/recepcion`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ 
      backgroundColor: 'rgba(0, 0, 0, 0.85)', 
      backdropFilter: 'blur(12px)',
      zIndex: 2000
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ 
        maxWidth: '480px', 
        background: '#16191d', 
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '28px',
        boxShadow: '0 30px 70px -15px rgba(0, 0, 0, 0.8)',
        padding: '32px',
        animation: 'modalFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05))', 
              padding: '12px', 
              borderRadius: '16px',
              border: '1px solid rgba(212, 175, 55, 0.1)'
            }}>
              <ShieldCheck size={28} color="var(--gold)" />
            </div>
            <div>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>Configuración</h2>
              <p style={{ margin: '4px 0 0', color: '#778398', fontSize: '13px', fontWeight: 500 }}>Control de acceso para recepción</p>
            </div>
          </div>
          <button 
            className="modal-close" 
            onClick={onClose} 
            style={{ 
              position: 'static', 
              background: 'rgba(255, 255, 255, 0.04)', 
              borderRadius: '12px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#778398',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* PIN Section */}
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.02)', 
            borderRadius: '24px', 
            padding: '24px', 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={14} color="var(--gold)" />
                <span style={{ fontSize: '12px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>PIN Maestro</span>
              </div>
              <button 
                className="btn-ghost" 
                onClick={handleGeneratePin} 
                disabled={loadingPin}
                style={{ 
                  height: '32px', 
                  fontSize: '12px', 
                  padding: '0 12px', 
                  background: 'rgba(212, 175, 55, 0.1)', 
                  border: '1px solid rgba(212, 175, 55, 0.2)',
                  color: 'var(--gold)',
                  borderRadius: '10px'
                }}
              >
                <Sliders size={12} />
                {receptionPin ? 'Regenerar' : 'Crear'}
              </button>
            </div>

            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              {loadingPin ? (
                <div style={{ fontSize: '48px', fontWeight: 900, color: 'rgba(255,255,255,0.1)' }}>....</div>
              ) : (
                <div style={{ 
                  fontSize: '56px', 
                  fontWeight: 900, 
                  color: '#fff', 
                  letterSpacing: '12px', 
                  textShadow: '0 0 30px rgba(212, 175, 55, 0.3)',
                  fontFamily: 'monospace'
                }}>
                  {receptionPin || '----'}
                </div>
              )}
              <p style={{ margin: '16px 0 0', fontSize: '13px', color: '#778398', lineHeight: 1.5 }}>
                Usa este código para desbloquear el acceso móvil.
              </p>
            </div>
          </div>

          {/* URL Section */}
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.02)', 
            borderRadius: '24px', 
            padding: '24px', 
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Smartphone size={14} color="#778398" />
              <span style={{ fontSize: '12px', color: '#778398', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Enlace de Acceso</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#000', padding: '6px 6px 6px 16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '13px', color: 'rgba(212, 175, 55, 0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {window.location.origin}/recepcion
              </span>
              <button
                className="btn-primary"
                onClick={handleCopy}
                style={{ 
                  height: '36px', 
                  width: '36px', 
                  padding: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: copied ? '#10b981' : 'var(--gold)', 
                  color: '#000',
                  borderRadius: '10px'
                }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div style={{ marginTop: '40px' }}>
          <button 
            className="btn-primary" 
            onClick={onClose}
            style={{ 
              width: '100%', 
              background: 'var(--gold)', 
              color: '#000', 
              fontWeight: 800, 
              height: '56px', 
              borderRadius: '18px',
              fontSize: '16px',
              boxShadow: '0 10px 25px -5px rgba(212, 175, 55, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Cerrar y Guardar
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
