import { useCallback } from 'react'

interface MercadoPagoCheckoutOptions {
  userId?: string
  userEmail?: string
}

export function useMercadoPagoCheckout() {
  const openCheckout = useCallback(async (options?: MercadoPagoCheckoutOptions) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://proclama.lat'
    const functionUrl = '***REMOVED***/functions/v1/create-mercadopago-preference'
    
    // Get the anon key from supabase client
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    
    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          userId: options?.userId,
          userEmail: options?.userEmail,
          price: 49900,
          currency: 'COP',
          successUrl: origin,
          failureUrl: origin,
          pendingUrl: origin
        })
      })
      
      if (!response.ok) {
        const err = await response.json()
        console.error('Error creating preference:', err)
        alert('Error al crear preferencia de pago. Intenta de nuevo.')
        return
      }
      
      const data = await response.json()
      console.log('Preference created:', data)
      
      // Abrir el link de pago
      const initPoint = data?.init_point || data?.sandbox_init_point
      if (initPoint) {
        window.open(initPoint, '_blank')
      } else {
        console.error('No init_point in response:', data)
        alert('Error al obtener enlace de pago.')
      }
    } catch (error) {
      console.error('Error creating MercadoPago preference:', error)
      alert('Error de conexión. Revisa la consola.')
    }
  }, [])

  const closeCheckout = useCallback(() => {
    // Not applicable for MercadoPago
  }, [])

  return { openCheckout, closeCheckout }
}

export default function MercadoPagoCheckoutButton({
  children,
  className = '',
  onClick
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  const { openCheckout } = useMercadoPagoCheckout()

  const handleClick = () => {
    openCheckout()
    onClick?.()
  }

  return (
    <button className={className} onClick={handleClick}>
      {children}
    </button>
  )
}