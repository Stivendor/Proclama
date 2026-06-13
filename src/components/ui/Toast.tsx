import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores'

export default function Toast() {
  const { toast, setToast } = useAppStore()
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (toast) {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setToast(null), 4000)
    }
    return () => clearTimeout(timerRef.current)
  }, [toast, setToast])

  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '10px 20px', fontSize: 13,
        zIndex: 10000, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {toast}
    </div>
  )
}
