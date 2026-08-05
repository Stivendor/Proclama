import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import { openProjectionWindow } from '@/services/projection'
import { NAV_ORDER } from '@/constants/nav'

/** Teclas que avanzan (incluye las que mandan los controles de presentación). */
const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ']
const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp']

export function useKeyboardShortcuts() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { nextSlide, prevSlide, setHideText, hideText, isBible } = useProjectionStore(useShallow(s => ({
    nextSlide: s.nextSlide,
    prevSlide: s.prevSlide,
    setHideText: s.setHideText,
    hideText: s.state.hideText,
    isBible: s.state.isBible,
  })))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // No activar si el foco está en un input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const app = useAppStore.getState()

      if (e.altKey) {
        const digit = /^Digit([1-8])$/.exec(e.code)
        if (digit) {
          e.preventDefault()
          app.setActiveView(NAV_ORDER[Number(digit[1]) - 1])
          return
        }
        switch (e.code) {
          case 'KeyP':
            e.preventDefault()
            openProjectionWindow()
            return
          case 'KeyN':
            e.preventDefault()
            app.openEditor()
            return
          case 'KeyB':
            e.preventDefault()
            setHideText(!hideText)
            return
        }
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(v => !v)
        return
      }

      // En la vista Biblia las letras son del buscador rápido, y con un versículo
      // proyectado las flechas las maneja BibleView (avanzan versículo, no slide).
      const inBible = app.activeView === 'bible'
      if (inBible && isBible && (NEXT_KEYS.includes(e.key) || PREV_KEYS.includes(e.key))) return

      if (NEXT_KEYS.includes(e.key)) {
        e.preventDefault()
        nextSlide()
        return
      }
      if (PREV_KEYS.includes(e.key)) {
        e.preventDefault()
        prevSlide()
        return
      }

      switch (e.key) {
        case 't':
        case 'T':
          if (inBible) return
          setHideText(!hideText)
          break
        case 'Escape':
          if (shortcutsOpen) {
            setShortcutsOpen(false)
            return
          }
          setHideText(false)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextSlide, prevSlide, setHideText, hideText, isBible, shortcutsOpen])

  return { shortcutsOpen, closeShortcuts: () => setShortcutsOpen(false) }
}
