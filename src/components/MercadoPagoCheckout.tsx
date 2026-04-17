import { useCallback } from 'react'
import { useAppStore } from '@/stores'

interface MercadoPagoCheckoutOptions {
  userId?: string
  userEmail?: string
}

export function useMercadoPagoCheckout() {
  const openCheckout = useCallback(async (options?: MercadoPagoCheckoutOptions) => {
    const accessToken = import.meta.env.VITE_MERCADOPAGO_ACCESS_TOKEN
    
    if (!accessToken) {
      console.error('MercadoPago not configured. Access token missing.')
      console.log('Available env vars:', import.meta.env)
      return
    }

    const title = import.meta.env.VITE_MERCADOPAGO_TITLE || 'Proclama Pro'
    const price = Number(import.meta.env.VITE_MERCADOPAGO_PRICE) || 49900
    const currency = import.meta.env.VITE_MERCADOPAGO_CURRENCY || 'COP'
const webhookUrl = import.meta.env.VITE_MERCADOPAGO_WEBHOOK_URL || 'https://ydyozanakkzpgldqcdjj.supabase.co/functions/v1/mercadopago-webhook'
    const origin = window.location.origin || 'http://localhost:5174'
    
    const payload = {
      transaction_amount: price,
      description: title,
      items: [
        {
          title: title,
          description: 'Acceso de por vida a Proclama Pro',
          unit_price: price,
          quantity: 1,
          currency_id: currency
        }
      ],
      payer: {
        email: options?.userEmail || 'cliente@proclama.app'
      },
      external_reference: options?.userId || crypto.randomUUID(),
      notification_url: webhookUrl,
      back_urls: {
        success: origin,
        failure: origin,
        pending: origin
      },
      payment_methods: {
        installments: 1
      }
    }

    console.log('Payload:', JSON.stringify(payload, null, 2))

    try {
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      console.log('MercadoPago response status:', response.status)
      console.log('MercadoPago response:', JSON.stringify(data, null, 2))

      if (data.init_point) {
        window.open(data.init_point, '_blank')
      } else if (data.sandbox_init_point) {
        window.open(data.sandbox_init_point, '_blank')
      } else {
        console.error('MercadoPago preference error:', data)
        alert('Error al crear preferencia de pago. Revisa la consola.')
      }
    } catch (error) {
      console.error('Error creating MercadoPago preference:', error)
      alert('Error de conexión con MercadoPago. Revisa la consola.')
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
  const { user } = useAppStore(s => ({ user: s.user }))

  const handleClick = () => {
    openCheckout({
      userId: user?.id,
      userEmail: user?.email || undefined
    })
    onClick?.()
  }

  return (
    <button className={className} onClick={handleClick}>
      {children}
    </button>
  )
}