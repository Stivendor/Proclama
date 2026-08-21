import { RefreshCw } from 'lucide-react'
import { useAppStore } from '@/stores'
import { t } from '@/i18n'

export default function ForcedUpdateScreen() {
  const language = useAppStore((state) => state.language)

  const updateApp = async () => {
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      if (registration) {
        await registration.update()
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      }
    } catch (error) {
      console.warn('[AppUpdate] Could not activate service worker:', error)
    } finally {
      window.location.reload()
    }
  }

  return (
    <main
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="forced-update-title"
      style={{
        minHeight: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        textAlign: 'center',
      }}
    >
      <section style={{ maxWidth: 460 }}>
        <RefreshCw size={42} color="var(--gold)" aria-hidden="true" />
        <h1 id="forced-update-title" style={{ margin: '20px 0 10px', fontSize: 26 }}>
          {t(language, 'forcedUpdate.title')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t(language, 'forcedUpdate.message')}
        </p>
        <button
          type="button"
          onClick={() => void updateApp()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 24,
            padding: '11px 18px',
            borderRadius: 'var(--radius)',
            background: 'var(--gold)',
            color: '#08090b',
            fontWeight: 700,
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t(language, 'forcedUpdate.action')}
        </button>
      </section>
    </main>
  )
}
