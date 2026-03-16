import { useState } from 'react'
import { useAppStore } from '@/stores'
import { fetchChurchByCode } from '@/services/supabase'
import { LogIn } from 'lucide-react'

export default function ChurchLogin() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setChurch = useAppStore(s => s.setChurch)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setError(null)

    try {
      const churchData = await fetchChurchByCode(code.trim())
      if (churchData) {
        setChurch({
          id: churchData.id,
          code: churchData.code,
          name: churchData.name,
          createdAt: new Date(churchData.created_at)
        })
      } else {
        setError('Código de sede IPUC no encontrado.')
      }
    } catch (err) {
      setError('Ocurrió un error al verificar la conexión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#0a0a0f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ maxWidth: '400px', width: '100%', padding: '2rem', backgroundColor: '#14141d', borderRadius: '12px', border: '1px solid #2a2a35' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Proclama IPUC</h1>
          <p style={{ color: '#888', margin: 0 }}>Introduce el código de tu congregación para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <input
              type="text"
              placeholder="Ej. IPUC-CENTRAL"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              className="w-full"
              style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#0a0a0f', color: '#fff', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ color: '#ff4d4f', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || !code.trim()}
            className="btn-primary"
            style={{ width: '100%', padding: '0.75rem', justifyContent: 'center', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <LogIn size={18} />
            {loading ? 'Verificando...' : 'Entrar a mi congregación'}
          </button>
        </form>
      </div>
    </div>
  )
}
