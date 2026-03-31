import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectionStore } from '@/stores'

export function useKeyboardShortcuts() {
  const { nextSlide, prevSlide, setHideText, hideText } = useProjectionStore(useShallow(s => ({
    nextSlide: s.nextSlide,
    prevSlide: s.prevSlide,
    setHideText: s.setHideText,
    hideText: s.state.hideText
  })))

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
          setHideText(!hideText)
          break
        case 'Escape':
          setHideText(false)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextSlide, prevSlide, setHideText, hideText])
}
