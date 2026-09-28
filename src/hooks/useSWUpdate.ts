import { useState, useEffect, useCallback } from 'react'

export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

    let reg: ServiceWorkerRegistration | null = null
    let updateInterval: ReturnType<typeof setInterval> | null = null
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void reg?.update()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    const watchInstalling = (sw: ServiceWorker | null) => {
      if (!sw) return
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateAvailable(true)
        }
        // Un worker que pasa a `redundant` mientras se instalaba es una
        // instalación fallida: workbox se rinde si una URL de la precaché
        // responde 404 (`bad-precaching-response`). El SW viejo sigue
        // controlando la página, así que la app "funciona" pero no se actualiza
        // y el botón nunca aparece. `node scripts/check-pwa.mjs` lo previene.
        if (sw.state === 'redundant') {
          console.warn(
            '[SW] El nuevo service worker falló al instalar (estado "redundant"). ' +
            'Revisa que /sw.js no tenga URLs precacheadas que respondan 404.'
          )
        }
      })
    }

    navigator.serviceWorker.register('/sw.js').then(r => {
      reg = r

      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true)
        return
      }

      watchInstalling(reg.installing)

      reg.addEventListener('updatefound', () => {
        watchInstalling(reg?.installing ?? null)
      })

      void reg.update().catch((error) => console.warn('[SW] Update check failed:', error))
      updateInterval = setInterval(() => {
        void reg?.update().catch((error) => console.warn('[SW] Update check failed:', error))
      }, 60000)
    }).catch((error) => {
      console.warn('[SW] Registration failed:', error)
    })

    return () => {
      if (updateInterval) clearInterval(updateInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const updateApp = useCallback(() => {
    navigator.serviceWorker?.getRegistration().then(r => {
      if (r?.waiting) {
        r.waiting.postMessage({ type: 'SKIP_WAITING' })
        setTimeout(() => window.location.reload(), 800)
        return
      }
      void r?.update().catch((error) => console.warn('[SW] Update request failed:', error))
    })
  }, [])

  return { updateAvailable, updateApp }
}
