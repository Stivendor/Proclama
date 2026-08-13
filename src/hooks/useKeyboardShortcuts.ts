import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import { NAV_ORDER } from '@/constants/nav'
import { db } from '@/db'
import { canCreateSongFromProfile } from '@/hooks/usePlan'

/** Teclas que avanzan (incluye las que mandan los controles de presentación). */
const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ']
const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp']

/**
 * Alt+N bajo el mismo límite de plan que el botón "Nueva" de la biblioteca; si
 * no alcanza, lleva a la biblioteca, donde el botón explica por qué (candado).
 */
async function openEditorWithinPlan() {
  const app = useAppStore.getState()
  const profile = { plan: app.userPlan, role: app.userRole, premiumExpiresAt: app.premiumExpiresAt }
  let ownSongCount = 0
  try {
    if (app.user?.id) ownSongCount = await db.songs.where('userId').equals(app.user.id).count()
  } catch { /* sin conteo se asume 0, igual que la biblioteca */ }

  if (canCreateSongFromProfile(profile, ownSongCount)) app.openEditor()
  else app.setActiveView('library')
}

export function useKeyboardShortcuts() {
  const shortcutsOpen = useAppStore(s => s.shortcutsOpen)
  const setShortcutsOpen = useAppStore(s => s.setShortcutsOpen)
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

      // Con un modal encima, Espacio y las flechas movían la proyección y Escape
      // reponía el texto: el operador cree estar cerrando un diálogo y está
      // cambiando lo que ve la congregación.
      if (document.querySelector('.modal-overlay')) return

      const app = useAppStore.getState()

      if (e.altKey) {
        const digit = /^Digit([1-8])$/.exec(e.code)
        if (digit) {
          e.preventDefault()
          app.setActiveView(NAV_ORDER[Number(digit[1]) - 1])
          return
        }
        // Sin atajo para la ventana de proyección: los navegadores no dejan
        // traer al frente de forma fiable una ventana en segundo plano, así que
        // el atajo parecía muerto. Se usa el botón "Abrir Proyección".
        switch (e.code) {
          case 'KeyN':
            e.preventDefault()
            openEditorWithinPlan()
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
        app.setShortcutsOpen(v => !v)
        return
      }

      // Con el modal de atajos abierto no debe llegar nada más a la proyección
      // (evita que ↑/↓/Espacio mientras se lee la lista cambien el slide que
      // ve la congregación a espaldas del operador). Escape sigue cerrando.
      if (app.shortcutsOpen) {
        if (e.key === 'Escape') app.setShortcutsOpen(false)
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
          setHideText(false)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextSlide, prevSlide, setHideText, hideText, isBible])

  return { shortcutsOpen, closeShortcuts: () => setShortcutsOpen(false) }
}
