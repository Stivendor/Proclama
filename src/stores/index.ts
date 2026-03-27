import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectionState, ProjectionTheme, RecognitionStatus, AppSettings, Song, Setlist } from '@/types'
import { parseLyrics } from '@/services/lyricsParser'
import { sendProjectionUpdate, sendMediaCommand } from '@/services/projection'
import { supabase } from '@/services/supabase'
import type { BackgroundAsset } from '@/types'

// ─── Default theme ─────────────────────────────────────────────────────────────
export const DEFAULT_THEME: ProjectionTheme = {
  background: '#0a0a0f',
  fontFamily: 'Lora, Georgia, serif',
  fontSize: 72,
  textColor: '#ffffff',
  textShadow: true,
  transition: 'fade',
  showTitle: true,
  showVerseLabel: true,
  backgroundType: 'color',
  backgroundBlur: 0,
  backgroundOverlayOpacity: 0.3,
  backgroundVideoUrl: '',
  fontSizeMax: false,
  titlePosition: 'top',
  verseReferencePosition: 'top'
}

// ─── Default settings ──────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS: AppSettings = {
  acrcloudHost: '',
  acrcloudAccessKey: '',
  acrcloudAccessSecret: '',
  geniusToken: '',
  recognitionMode: 'assisted',
  recognitionConfidenceThreshold: 70,
  churchName: '',
  churchLogoUrl: '',
  defaultTheme: DEFAULT_THEME
}

// ─── Projection Store ──────────────────────────────────────────────────────────
interface ProjectionStore {
  state: ProjectionState
  projectionWindow: Window | null
  setProjectionWindow: (w: Window | null) => void
  loadSong: (song: Song, isBible?: boolean) => void
  nextSlide: () => void
  prevSlide: () => void
  goToSlide: (index: number) => void
  updateTheme: (theme: Partial<ProjectionTheme>) => void
  clearSong: () => void
  setMedia: (media: ProjectionState['media']) => void
  setHideText: (v: boolean) => void
  setMediaStatus: (status: ProjectionState['mediaStatus']) => void
  sendMediaCommand: (action: 'play' | 'pause' | 'seek', value?: number) => void
  toggleMediaBackground: () => void
}

const initialProjectionState: ProjectionState = {
  songId: null,
  songTitle: '',
  slides: [],
  currentSlide: 0,
  theme: DEFAULT_THEME,
  media: null,
  hideText: false
}

export const useProjectionStore = create<ProjectionStore>((set, get) => ({
  state: initialProjectionState,
  projectionWindow: null,

  setProjectionWindow: (w) => set({ projectionWindow: w }),

  loadSong: (song, isBible = false) => {
    const newState: ProjectionState = {
      ...get().state,
      songId: song.id || null,
      songTitle: song.title,
      isBible,
      slides: parseLyrics(song.lyrics),
      currentSlide: 0,
    }
    set({ state: newState })
    sendProjectionUpdate(newState)
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

  updateTheme: (theme) => {
    const newState = { ...get().state, theme: { ...get().state.theme, ...theme } }
    set({ state: newState })
    sendProjectionUpdate(newState)
  },

  clearSong: () => {
    const newState = { ...initialProjectionState, theme: get().state.theme }
    set({ state: newState })
    sendProjectionUpdate(newState)
  },

  setMedia: (media) => {
    set(s => {
      const newState = { ...s.state, media, mediaStatus: undefined }
      sendProjectionUpdate(newState)
      return { state: newState }
    })
  },

  setHideText: (v) => {
    const newState = { ...get().state, hideText: v }
    set({ state: newState })
    sendProjectionUpdate(newState)
  },

  toggleMediaBackground: () => {
    set(s => {
      if (!s.state.media) return s
      const newState = { 
        ...s.state, 
        media: { ...s.state.media, isBackgroundMode: !s.state.media.isBackgroundMode } 
      }
      sendProjectionUpdate(newState)
      return { state: newState }
    })
  },

  setMediaStatus: (mediaStatus) => {
    set(s => ({ state: { ...s.state, mediaStatus } }))
  },

  sendMediaCommand: (action, value) => {
    sendMediaCommand(action, value)
  }
}))

// ─── App Store (settings + UI state) ──────────────────────────────────────────
interface AppStore {
  settings: AppSettings
  updateSettings: (s: Partial<AppSettings>) => void

  // Auth
  user: any | null
  setUser: (u: any | null) => void
  userRole: 'admin' | 'user' | null
  setUserRole: (r: 'admin' | 'user' | null) => void
  authStatus: 'loading' | 'authenticated' | 'unauthenticated'
  setAuthStatus: (s: 'loading' | 'authenticated' | 'unauthenticated') => void
  
  guestMode: boolean
  setGuestMode: (v: boolean) => void
  
  activeView: 'library' | 'editor' | 'setlists' | 'settings' | 'bible' | 'countdown'
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

  // Layout
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setIsSidebarOpen: (o: boolean) => void

  // Backgrounds
  backgrounds: BackgroundAsset[]
  fetchBackgrounds: () => Promise<void>

  // Onboarding
  onboardingDone: boolean
  setOnboardingDone: (v: boolean) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (s) => set(state => ({ settings: { ...state.settings, ...s } })),

      user: null,
      setUser: (u) => set({ user: u }),
      userRole: null,
      setUserRole: (r) => set({ userRole: r }),
      authStatus: 'loading',
      setAuthStatus: (s) => set({ authStatus: s }),

      guestMode: false,
      setGuestMode: (v) => set({ guestMode: v }),

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

      isSidebarOpen: true,
      toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
      setIsSidebarOpen: (o) => set({ isSidebarOpen: o }),

      backgrounds: [],
      fetchBackgrounds: async () => {
        const { data } = await supabase.from('backgrounds').select('*').order('created_at', { ascending: false })
        if (data) set({ backgrounds: data })
      },

      onboardingDone: false,
      setOnboardingDone: (v) => set({ onboardingDone: v }),
    }),
    {
      name: 'proclama-app',
      partialize: (state) => ({ 
        settings: state.settings, 
        isSidebarOpen: state.isSidebarOpen, 
        onboardingDone: state.onboardingDone,
        guestMode: state.guestMode
      })
    }
  )
)
