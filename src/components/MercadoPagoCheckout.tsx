import { useCallback } from 'react'
import { supabase } from '@/services/supabase'

interface MercadoPagoCheckoutOptions {
  userId?: string
  userEmail?: string
  planType?: 'monthly' | 'annual'
}

export function useMercadoPagoCheckout() {
  const openCheckout = useCallback(async (options?: MercadoPagoCheckoutOptions) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://proclama.lat'
    const functionUrl = `${supabaseUrl}/functions/v1/create-mercadopago-subscription`

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert('Debes iniciar sesión para continuar con el pago.')
      return
    }

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: session.user.id,
          userEmail: session.user.email,
          planType: options?.planType || 'monthly',
          successUrl: origin,
          failureUrl: origin,
          pendingUrl: origin
        })
      })
      
      if (!response.ok) {
        const err = await response.json()
        console.error('Error creating preapproval:', JSON.stringify(err, null, 2))
        alert('Error al crear suscripción. Intenta de nuevo.')
        return
      }
      
      const data = await response.json()
      console.log('Preapproval created:', data)
      
      // Abrir el link de pago (Preapproval usa init_point)
      const initPoint = data?.init_point || data?.sandbox_init_point
      if (initPoint) {
        window.location.href = initPoint
      } else {
        console.error('No init_point in response:', data)
        alert('Error al obtener enlace de pago.')
      }
    } catch (error) {
      console.error('Error creating MercadoPago preapproval:', error)
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