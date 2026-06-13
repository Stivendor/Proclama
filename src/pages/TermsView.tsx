import { ArrowLeft, FileText } from 'lucide-react'
import { useAppStore } from '@/stores'
import { CURRENT_TERMS_VERSION, TERMS_LAST_UPDATED } from '@/constants/terms'
import TermsContent from '@/components/terms/TermsContent'

export default function TermsView() {
  const { termsAccepted, setActiveView } = useAppStore(s => ({
    termsAccepted: s.termsAccepted,
    setActiveView: s.setActiveView
  }))

  const formattedAcceptedAt = termsAccepted
    ? new Date(termsAccepted.acceptedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="terms-view">
      <div className="view-header">
        <h1><FileText size={20} /> Términos y Condiciones</h1>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => setActiveView('settings')}>
            <ArrowLeft size={16} /> Volver a Ajustes
          </button>
        </div>
      </div>
      <div className="terms-view-body">
        <div className="terms-view-meta">
          <span>Versión {CURRENT_TERMS_VERSION}</span>
          <span>Última actualización: {TERMS_LAST_UPDATED}</span>
          {formattedAcceptedAt && <span>Aceptado el: {formattedAcceptedAt}</span>}
        </div>
        <TermsContent />
      </div>
    </div>
  )
}
