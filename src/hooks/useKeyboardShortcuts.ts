import { useEffect } from 'react'
import { useProjectionStore } from '@/stores'

export function useKeyboardShortcuts() {
  const { nextSlide, prevSlide, setHideText, state } = useProjectionStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // No activar si el foco está en un input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          nextSlide()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          prevSlide()
          break
        case 't':
        case 'T':
          setHideText(!state.hideText)
          break
        case 'Escape':
          setHideText(false)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextSlide, prevSlide, setHideText, state.hideText])
}
