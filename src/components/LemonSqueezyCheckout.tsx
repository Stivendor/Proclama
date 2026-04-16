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

  const checkoutUrl = `${storeSlug || import.meta.env.VITE_LEMON_SQUEEZY_STORE_SLUG}/checkout/buy/${variantId || import.meta.env.VITE_LEMON_SQUEEZY_VARIANT_ID}`

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

    const baseUrl = `${storeSlug}/checkout/buy/${variantId}`
    const params = new URLSearchParams()
    
    if (customData) {
      Object.entries(customData).forEach(([key, value]) => {
        params.set(key, String(value))
      })
    }
    
    const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl

    if (window.LemonSqueezy) {
      window.LemonSqueezy.Url.Open(url)
    } else {
      window.open(url, '_blank')
    }
  }, [])

  const closeCheckout = useCallback(() => {
    if (window.LemonSqueezy) {
      window.LemonSqueezy.Url.Close()
    }
  }, [])

  return { openCheckout, closeCheckout }
}
