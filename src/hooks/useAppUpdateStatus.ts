import { useEffect, useState } from 'react'
import { APP_VERSION, isVersionSupported } from '@/constants/appVersion'
import { getAppUpdateConfig } from '@/services/supabase'

export function useAppUpdateStatus(enabled = true) {
  const [required, setRequired] = useState(false)
  const [checking, setChecking] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setChecking(false)
      return
    }

    let cancelled = false

    const checkForRequiredUpdate = async () => {
      setChecking(true)
      const config = await getAppUpdateConfig()
      if (cancelled) return

      setRequired(
        Boolean(config?.forceUpdate) &&
        !isVersionSupported(APP_VERSION, config?.minSupportedVersion ?? ''),
      )
      setChecking(false)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForRequiredUpdate()
    }

    void checkForRequiredUpdate()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled])

  return { checking, required }
}
