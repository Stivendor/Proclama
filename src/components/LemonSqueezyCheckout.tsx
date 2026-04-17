import { useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores'

declare global {
  interface Window {
    LemonSqueezy?: {
      Url: {
        Open: (url: string) => void
        Close: () => void
      }
      Refresh: () => void
    }
    createLemonSqueezy?: () => void
  }
}

interface LemonSqueezyCheckoutProps {
  variantId?: string
  storeSlug?: string
  children: React.ReactNode
  className?: string
  onCheckoutOpened?: () => void
  onCheckoutClosed?: () => void
}

export default function LemonSqueezyCheckout({
  variantId,
  storeSlug,
  children,
  className = '',
  onCheckoutOpened,
  onCheckoutClosed,
}: LemonSqueezyCheckoutProps) {
  const user = useAppStore(s => s.user)
  const slug = storeSlug || import.meta.env.VITE_LEMON_SQUEEZY_STORE_SLUG || ''
  const id = variantId || import.meta.env.VITE_LEMON_SQUEEZY_VARIANT_ID || ''
  const checkoutUrl = slug && id ? `https://${slug}.lemonsqueezy.com/checkout/buy/${id}` : ''

  const handleClick = useCallback(() => {
    if (window.LemonSqueezy) {
      window.LemonSqueezy.Url.Open(checkoutUrl)
      onCheckoutOpened?.()
    } else {
      window.open(checkoutUrl, '_blank')
      onCheckoutOpened?.()
    }
  }, [checkoutUrl, onCheckoutOpened])

  useEffect(() => {
    const handleCheckoutClosed = () => {
      onCheckoutClosed?.()
    }

    const interval = setInterval(() => {
      if (window.LemonSqueezy) {
        window.addEventListener('ls-cancel', handleCheckoutClosed)
        window.addEventListener('ls-success', handleCheckoutClosed)
        clearInterval(interval)
      }
    }, 500)

    return () => {
      clearInterval(interval)
      window.removeEventListener('ls-cancel', handleCheckoutClosed)
      window.removeEventListener('ls-success', handleCheckoutClosed)
    }
  }, [onCheckoutClosed])

  return (
    <button
      className={className}
      onClick={handleClick}
      data-lemon-squeezy-checkout={checkoutUrl}
    >
      {children}
    </button>
  )
}

export function useLemonSqueezyCheckout() {
  const openCheckout = useCallback((customData?: Record<string, string | number>) => {
    const storeSlug = import.meta.env.VITE_LEMON_SQUEEZY_STORE_SLUG
    const variantId = import.meta.env.VITE_LEMON_SQUEEZY_VARIANT_ID
    
    if (!storeSlug || !variantId) {
      console.error('Lemon Squeezy not configured. Please set VITE_LEMON_SQUEEZY_STORE_SLUG and VITE_LEMON_SQUEEZY_VARIANT_ID')
      return
    }

    const baseUrl = `https://${storeSlug}.lemonsqueezy.com/checkout/buy/${variantId}`
    
    // Lemon Squeezy espera los datos personalizados como checkout[custom][key]
    const checkoutUrl = new URL(baseUrl)
    if (customData) {
      Object.entries(customData).forEach(([key, value]) => {
        checkoutUrl.searchParams.set(`checkout[custom][${key}]`, String(value))
      })
    }

    if (window.LemonSqueezy) {
      window.LemonSqueezy.Url.Open(checkoutUrl.toString())
    } else {
      window.open(checkoutUrl.toString(), '_blank')
    }
  }, [])

  const closeCheckout = useCallback(() => {
    if (window.LemonSqueezy) {
      window.LemonSqueezy.Url.Close()
    }
  }, [])

  return { openCheckout, closeCheckout }
}
