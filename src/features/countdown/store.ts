import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CountdownConfig, CountdownState, CountdownTheme } from '@/types'
import { sendCountdownUpdate } from '@/services/projection'
import { DEFAULT_THEME } from '@/stores'

export const DEFAULT_COUNTDOWN_THEME: CountdownTheme = DEFAULT_THEME as unknown as CountdownTheme

export const DEFAULT_COUNTDOWN_CONFIG: CountdownConfig = {
  title: 'Tiempo restante',
  durationMinutes: 5,
  durationSeconds: 0,
  theme: DEFAULT_COUNTDOWN_THEME
}

interface CountdownStore {
  // Estado que se emite
  config: CountdownConfig
  status: CountdownState['status']
  remainingTime: number
  
  // Acciones
  updateConfig: (config: Partial<CountdownConfig>) => void
  updateTheme: (theme: Partial<CountdownTheme>) => void
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  tick: () => void
}

let timerInterval: number | null = null

export const useCountdownStore = create<CountdownStore>()(
  persist(
    (set, get) => ({
      config: DEFAULT_COUNTDOWN_CONFIG,
      status: 'idle',
      remainingTime: 0,

      updateConfig: (newConfig) => {
        set((state) => ({ config: { ...state.config, ...newConfig } }))
        // Si no está corriendo, actualizar reset state broadcast
        const st = get()
        if (st.status === 'idle') {
          st.reset() // Recalcular reseting
        } else {
          sendCountdownUpdate({ config: st.config, status: st.status, remainingTime: st.remainingTime })
        }
      },

      updateTheme: (newTheme) => {
        set((state) => ({ config: { ...state.config, theme: { ...state.config.theme, ...newTheme } } }))
        const st = get()
        sendCountdownUpdate({ config: st.config, status: st.status, remainingTime: st.remainingTime })
      },

      start: () => {
        const st = get()
        if (st.status === 'idle' || st.status === 'finished') {
          const totalSeconds = st.config.durationMinutes * 60 + st.config.durationSeconds
          set({ status: 'running', remainingTime: totalSeconds })
        } else if (st.status === 'paused') {
          set({ status: 'running' })
        }
        
        sendCountdownUpdate({ config: get().config, status: 'running', remainingTime: get().remainingTime })

        if (!timerInterval) {
          timerInterval = window.setInterval(() => {
            get().tick()
          }, 1000)
        }
      },

      pause: () => {
        set({ status: 'paused' })
        sendCountdownUpdate({ config: get().config, status: 'paused', remainingTime: get().remainingTime })
        if (timerInterval) {
          clearInterval(timerInterval)
          timerInterval = null
        }
      },

      resume: () => {
        get().start()
      },

      reset: () => {
        const totalSeconds = get().config.durationMinutes * 60 + get().config.durationSeconds
        set({ status: 'idle', remainingTime: totalSeconds })
        sendCountdownUpdate({ config: get().config, status: 'idle', remainingTime: totalSeconds })
        if (timerInterval) {
          clearInterval(timerInterval)
          timerInterval = null
        }
      },

      tick: () => {
        const st = get()
        if (st.status !== 'running') return

        if (st.remainingTime <= 1) {
          set({ status: 'finished', remainingTime: 0 })
          sendCountdownUpdate({ config: st.config, status: 'finished', remainingTime: 0 })
          if (timerInterval) {
            clearInterval(timerInterval)
            timerInterval = null
          }
        } else {
          set({ remainingTime: st.remainingTime - 1 })
          sendCountdownUpdate({ config: st.config, status: 'running', remainingTime: st.remainingTime - 1 })
        }
      }
    }),
    {
      name: 'proclama-countdown',
      partialize: (state) => ({ 
        config: state.config
      })
    }
  )
)
