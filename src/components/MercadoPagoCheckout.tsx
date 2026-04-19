import { useCallback } from 'react'

interface MercadoPagoCheckoutOptions {
  userId?: string
  userEmail?: string
}

export function useMercadoPagoCheckout() {
  const openCheckout = useCallback(async (options?: MercadoPagoCheckoutOptions) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://proclama.lat'
    const functionUrl = 'https://ydyozanakkzpgldqcdjj.supabase.co/functions/v1/create-mercadopago-preference'
    
    const supabaseAnonKey = 'bb2051aa7654052dc22821d10a7310db0ab43ac00ef3f878479bb8635ea6242'
    
    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        mode: 'cors',
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
        console.error('Error creating preference:', JSON.stringify(err, null, 2)) // ← stringify
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