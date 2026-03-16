import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectionState, ProjectionTheme, RecognitionStatus, AppSettings, Song, Setlist, Church } from '@/types'
import { parseLyrics } from '@/services/lyricsParser'
import { sendProjectionUpdate, sendBlack, sendLogo } from '@/services/projection'

// ─── Default theme ─────────────────────────────────────────────────────────────
export const DEFAULT_THEME: ProjectionTheme = {
  background: '#0a0a0f',
  fontFamily: 'Lora, Georgia, serif',
  fontSize: 72,
  textColor: '#ffffff',
  textShadow: true,
  transition: 'fade',
  showTitle: true,
  showVerseLabel: true
}

// ─── Default settings ──────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS: AppSettings = {
  acrcloudHost: '',
  acrcloudAccessKey: '',
  acrcloudAccessSecret: '',
  geniusToken: '',
  recognitionMode: 'assisted',
  recognitionConfidenceThreshold: 70,
  churchName: 'Mi Iglesia',
  churchLogoUrl: '',
  defaultTheme: DEFAULT_THEME
}

// ─── Projection Store ──────────────────────────────────────────────────────────
interface ProjectionStore {
  state: ProjectionState
  projectionWindow: Window | null
  setProjectionWindow: (w: Window | null) => void
  loadSong: (song: Song) => void
  nextSlide: () => void
  prevSlide: () => void
  goToSlide: (index: number) => void
  setBlack: (v: boolean) => void
  setLogo: (v: boolean) => void
  updateTheme: (theme: Partial<ProjectionTheme>) => void
  clearSong: () => void
}

const initialProjectionState: ProjectionState = {
  songId: null,
  songTitle: '',
  slides: [],
  currentSlide: 0,
  isBlack: false,
  isLogo: false,
  theme: DEFAULT_THEME
}

export const useProjectionStore = create<ProjectionStore>((set, get) => ({
  state: initialProjectionState,
  projectionWindow: null,

  setProjectionWindow: (w) => set({ projectionWindow: w }),

  loadSong: (song) => {
    const slides = parseLyrics(song.lyrics)
    set(s => {
      const newState: ProjectionState = {
        ...s.state,
        songId: song.id ?? null,
        songTitle: song.title,
        slides,
        currentSlide: 0,
        isBlack: false,
        isLogo: false
      }
      sendProjectionUpdate(newState)
      return { state: newState }
    })
  },

  nextSlide: () => {
    set(s => {
      if (s.state.currentSlide < s.state.slides.length - 1) {
        const newState = { ...s.state, currentSlide: s.state.currentSlide + 1 }
        sendProjectionUpdate(newState)
        return { state: newState }
      }
      return s
    })
  },

  prevSlide: () => {
    set(s => {
      if (s.state.currentSlide > 0) {
        const newState = { ...s.state, currentSlide: s.state.currentSlide - 1 }
        sendProjectionUpdate(newState)
        return { state: newState }
      }
      return s
    })
  },

  goToSlide: (index) => {
    set(s => {
      if (index >= 0 && index < s.state.slides.length) {
        const newState = { ...s.state, currentSlide: index }
        sendProjectionUpdate(newState)
        return { state: newState }
      }
      return s
    })
  },

  setBlack: (v) => {
    const newState = { ...get().state, isBlack: v, isLogo: false }
    set({ state: newState })
    sendBlack(v)
  },

  setLogo: (v) => {
    const newState = { ...get().state, isLogo: v, isBlack: false }
    set({ state: newState })
    sendLogo(v)
  },

  updateTheme: (theme) => {
    const newState = { ...get().state, theme: { ...get().state.theme, ...theme } }
    set({ state: newState })
    sendProjectionUpdate(newState)
  },

  clearSong: () => {
    const newState = { ...initialProjectionState, theme: get().state.theme }
    set({ state: newState })
    sendProjectionUpdate(newState)
  }
}))

// ─── App Store (settings + UI state) ──────────────────────────────────────────
interface AppStore {
  settings: AppSettings
  updateSettings: (s: Partial<AppSettings>) => void

  // UI
  activeView: 'library' | 'editor' | 'setlists' | 'settings' | 'bible'
  setActiveView: (v: AppStore['activeView']) => void

  editingSong: Song | null
  setEditingSong: (s: Song | null) => void

  activeSetlist: Setlist | null
  setActiveSetlist: (s: Setlist | null) => void

  // Recognition state
  recognitionStatus: RecognitionStatus
  setRecognitionStatus: (s: RecognitionStatus) => void
  detectedSong: { title: string; artist: string; confidence: number } | null
  setDetectedSong: (s: AppStore['detectedSong']) => void

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Auth & Church (Multi-tenancy)
  church: Church | null
  setChurch: (c: Church | null) => void
  user: any | null
  setUser: (u: any | null) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (s) => set(state => ({ settings: { ...state.settings, ...s } })),

      activeView: 'library',
      setActiveView: (v) => set({ activeView: v }),

      editingSong: null,
      setEditingSong: (s) => set({ editingSong: s }),

      activeSetlist: null,
      setActiveSetlist: (s) => set({ activeSetlist: s }),

      recognitionStatus: 'idle',
      setRecognitionStatus: (s) => set({ recognitionStatus: s }),
      detectedSong: null,
      setDetectedSong: (s) => set({ detectedSong: s }),

      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),

      church: null,
      setChurch: (c) => set({ church: c }),

      user: null,
      setUser: (u) => set({ user: u })
    }),
    {
      name: 'proclama-app',
      partialize: (state) => ({ settings: state.settings, church: state.church })
    }
  )
)
