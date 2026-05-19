import { useState, useEffect, useCallback } from 'react'

export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

    let reg: ServiceWorkerRegistration | null = null
    let updateInterval: ReturnType<typeof setInterval> | null = null

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg?.update()
    })

    const watchInstalling = (sw: ServiceWorker | null) => {
      if (!sw) return
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateAvailable(true)
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

      reg.update()
      updateInterval = setInterval(() => { reg?.update() }, 60000)
    })

    return () => {
      if (updateInterval) clearInterval(updateInterval)
    }
  }, [])

  const updateApp = useCallback(() => {
    navigator.serviceWorker?.getRegistration().then(r => {
      if (r?.waiting) {
        r.waiting.postMessage({ type: 'SKIP_WAITING' })
        setTimeout(() => window.location.reload(), 800)
      }
    })
  }, [])

  return { updateAvailable, updateApp }
}
