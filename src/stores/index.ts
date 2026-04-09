import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectionState, ProjectionTheme, AppSettings, Song, Setlist, TermsAcceptance } from '@/types'
import { parseLyrics } from '@/services/lyricsParser'
import { sendProjectionUpdate, sendMediaCommand } from '@/services/projection'
import { supabase } from '@/services/supabase'
import type { BackgroundAsset } from '@/types'
import { CURRENT_TERMS_VERSION } from '@/constants/terms'

// ─── Canvas size de referencia (16:9) ──────────────────────────────────────────
export const CANVAS_SIZE = { width: 1920, height: 1080 } as const
export const DEFAULT_THEME: ProjectionTheme = {
  background: '#0a0a0f',
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 72,
  textColor: '#ffffff',
  textShadow: true,
  transition: 'fade',
  showTitle: false,
  showVerseLabel: false,
  backgroundType: 'color',
  backgroundBlur: 0,
  backgroundDarkness: 0,
  backgroundOverlayOpacity: 0.3,
  backgroundVideoUrl: '',
  fontSizeMax: false,
  titlePosition: 'top',
  verseReferencePosition: 'bottom',
  textUppercase: true,
  fontScale: 1
}

// ─── Default settings ──────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS: AppSettings = {
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
      hideText: false,
    }
    set({ state: newState })
    sendProjectionUpdate(newState)
  },

  nextSlide: () => {
    set(s => {
      if (s.state.currentSlide < s.state.slides.length - 1) {
        const newState = { ...s.state, currentSlide: s.state.currentSlide + 1, hideText: false }
        sendProjectionUpdate(newState)
        return { state: newState }
      }
      return s
    })
  },

  prevSlide: () => {
    set(s => {
      if (s.state.currentSlide > 0) {
        const newState = { ...s.state, currentSlide: s.state.currentSlide - 1, hideText: false }
        sendProjectionUpdate(newState)
        return { state: newState }
      }
      return s
    })
  },

  goToSlide: (index) => {
    set(s => {
      if (index >= 0 && index < s.state.slides.length) {
        const newState = { ...s.state, currentSlide: index, hideText: false }
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
  userPlan: 'free' | 'premium'
  setUserPlan: (p: 'free' | 'premium') => void
  authStatus: 'loading' | 'authenticated' | 'unauthenticated'
  setAuthStatus: (s: 'loading' | 'authenticated' | 'unauthenticated') => void
  
  guestMode: boolean
  setGuestMode: (v: boolean) => void
  
  activeView: 'library' | 'editor' | 'setlists' | 'settings' | 'bible' | 'countdown' | 'notes' | 'terms'
  setActiveView: (v: AppStore['activeView']) => void

  editingSong: Song | null
  setEditingSong: (s: Song | null) => void

  activeSetlist: Setlist | null
  setActiveSetlist: (s: Setlist | null) => void

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Layout
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setIsSidebarOpen: (o: boolean) => void


  // Backgrounds
  backgrounds: BackgroundAsset[]
  backgroundsLastFetch: number | null
  fetchBackgrounds: () => Promise<void>

  // Onboarding
  onboardingDone: boolean
  setOnboardingDone: (v: boolean) => void

  // Terms & Conditions
  termsAccepted: TermsAcceptance | null
  termsSyncPending: boolean
  acceptTerms: (version: string) => Promise<void>
  checkTermsVersion: () => boolean
  setTermsAccepted: (t: TermsAcceptance | null) => void
  setTermsSyncPending: (v: boolean) => void

  logout: () => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (s) => set(state => ({ settings: { ...state.settings, ...s } })),

      user: null,
      setUser: (u) => set({ user: u }),
      userRole: null,
      setUserRole: (r) => set({ userRole: r }),
      userPlan: 'free',
      setUserPlan: (p) => set({ userPlan: p }),
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

      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),

      isSidebarOpen: true,
      toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
      setIsSidebarOpen: (o) => set({ isSidebarOpen: o }),


      backgrounds: [],
      backgroundsLastFetch: null,
      fetchBackgrounds: async () => {
        const { backgrounds, backgroundsLastFetch } = get()
        const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
        
        // Check if cache is fresh
        if (backgrounds.length > 0 && backgroundsLastFetch && Date.now() - backgroundsLastFetch < CACHE_TTL) {
          return // Use cached data
        }
        
        const { data } = await supabase.from('backgrounds').select('*').order('created_at', { ascending: false })
        if (data) set({ backgrounds: data, backgroundsLastFetch: Date.now() })
      },

      onboardingDone: false,
      setOnboardingDone: (v) => set({ onboardingDone: v }),

      termsAccepted: null,
      termsSyncPending: false,
      setTermsAccepted: (t) => set({ termsAccepted: t }),
      setTermsSyncPending: (v) => set({ termsSyncPending: v }),

      checkTermsVersion: () => {
        const { termsAccepted } = get()
        if (!termsAccepted) return true
        return termsAccepted.version !== CURRENT_TERMS_VERSION
      },

      acceptTerms: async (version) => {
        const acceptedAt = new Date().toISOString()
        const acceptance: TermsAcceptance = { version, acceptedAt }
        set({ termsAccepted: acceptance, termsSyncPending: false })
        // Sync con Supabase si hay usuario autenticado
        const { user } = get()
        if (user?.id) {
          try {
            const { syncTermsAcceptance } = await import('@/services/supabase')
            const ok = await syncTermsAcceptance(user.id, version, acceptedAt)
            if (!ok) set({ termsSyncPending: true })
          } catch {
            set({ termsSyncPending: true })
          }
        }
      },

      logout: () => set({ 
        user: null, 
        userRole: null, 
        userPlan: 'free', 
        authStatus: 'unauthenticated', 
        guestMode: false,
        termsAccepted: null,
        activeSetlist: null,
        editingSong: null
      }),
    }),
    {
      name: 'proclama-app',
      partialize: (state) => ({ 
        settings: state.settings, 
        isSidebarOpen: state.isSidebarOpen, 
        onboardingDone: state.onboardingDone,
        guestMode: state.guestMode,
        termsAccepted: state.termsAccepted,
        termsSyncPending: state.termsSyncPending,
      })
    }
  )
)
