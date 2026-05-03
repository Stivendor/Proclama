import { useState } from 'react'
import { KeyRound, Users, Check, ArrowLeft } from 'lucide-react'
import { supabase } from '@/services/supabase'
import AttendanceForm from '@/features/attendance/components/AttendanceForm'
import ServiceNameSelector from '@/features/attendance/components/ServiceNameSelector'
import { todayISO, parseField } from '@/features/attendance/utils/validation'

interface ChurchData {
  userId: string
  label: string
  isPremium: boolean
  categories: string[]
  settings: {
    serviceNameTemplates?: string[]
  }
}

export default function RecepcionView() {
  const [pin, setPin] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  
  const [churchData, setChurchData] = useState<ChurchData | null>(null)
  
  const [serviceName, setServiceName] = useState('')
  const [att, setAtt] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) return
    
    setIsVerifying(true)
    setError('')
    
    try {
      const { data, error: rpcError } = await supabase.rpc('validate_church_pin', { pin_code: pin })
      
      if (rpcError) throw rpcError
      
      if (!data || data.length === 0) {
        throw new Error('PIN inválido')
      }
      
      const churchInfo = data[0]
      if (!churchInfo.is_premium) {
        throw new Error('Esta iglesia no tiene el plan Premium requerido para el modo recepción.')
      }
      
      setChurchData({
        userId: churchInfo.user_id,
        label: churchInfo.label,
        isPremium: churchInfo.is_premium,
        categories: churchInfo.latest_categories || ['Caballeros', 'Damas', 'Amigos', 'Niños'],
        settings: churchInfo.settings || {}
      })
      
      // Initialize attendance values
      setAtt(new Array((churchInfo.latest_categories || [1, 2, 3, 4]).length).fill(''))
    } catch (err: any) {
      setError(err.message || 'Error al verificar el PIN')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSave = async () => {
    if (!churchData) return
    setIsSaving(true)
    setSaveError('')
    setSuccessMsg('')
    
    try {
      const numericValues = att.map(parseField)
      
      const { error: saveErr } = await supabase.rpc('submit_reception_attendance', {
        p_pin: pin,
        p_date: todayISO(),
        p_service_name: serviceName.trim(),
        p_category_names: churchData.categories,
        p_category_values: numericValues
      })
      
      if (saveErr) throw saveErr
      
      setSuccessMsg('Asistencia guardada con éxito.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err: any) {
      setSaveError(err.message || 'Error al guardar la asistencia')
    } finally {
      setIsSaving(false)
    }
  }

  // --- PIN Entry View ---
  if (!churchData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 400, width: '100%', background: 'var(--bg-secondary)', padding: 32, borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: 16, borderRadius: '50%' }}>
              <KeyRound size={32} color="var(--gold)" />
            </div>
          </div>
          <h1 style={{ textAlign: 'center', marginBottom: 8, fontSize: 24 }}>Recepción de Asistencia</h1>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
            Ingresa el PIN numérico de tu iglesia para registrar la asistencia.
          </p>
          
          <form onSubmit={handleVerify}>
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                className="input"
                placeholder="Ej. 4821"
                value={pin}
                onChange={e => setPin(e.target.value)}
                style={{ textAlign: 'center', fontSize: 24, letterSpacing: 4, padding: '16px 12px' }}
                autoFocus
              />
            </div>
            
            {error && <p className="field-error" style={{ textAlign: 'center', marginBottom: 16 }}>{error}</p>}
            
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16 }}
              disabled={isVerifying || !pin.trim()}
            >
              {isVerifying ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // --- Reception Form View ---
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '16px 16px 64px 16px', background: 'var(--bg-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            className="btn-icon" 
            onClick={() => setChurchData(null)}
            title="Cambiar PIN"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="var(--gold)" />
              {churchData.label}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Modo Recepción</p>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 20 }}>
          <label className="attendance-field-label" style={{ display: 'block', marginBottom: 8 }}>Nombre del culto</label>
          <ServiceNameSelector
            serviceName={serviceName}
            setServiceName={setServiceName}
            serviceNameTemplates={churchData.settings.serviceNameTemplates || []}
            onAddTemplate={() => {}} // Disabled in reception mode for safety
            onDeleteTemplate={() => {}} // Disabled in reception mode for safety
            onEnter={handleSave}
          />
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            Registrar Asistentes
          </h2>
          
          <AttendanceForm
            categories={churchData.categories}
            onUpdateCategories={() => {}} // Disabled
            values={att}
            onChangeValues={setAtt}
            onSave={handleSave}
            isLoading={isSaving}
            error={saveError}
            onClearError={() => setSaveError('')}
            readonlyCategories={true}
          />

          {successMsg && (
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(34, 197, 94, 0.1)', color: 'var(--green)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Check size={16} />
              {successMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
