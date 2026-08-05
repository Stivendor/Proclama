import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectionState, ProjectionTheme, AppSettings, Song, Setlist, TermsAcceptance, LocalMedia, Slide } from '@/types'
import { parseLyrics } from '@/services/lyricsParser'
import { sendProjectionUpdate, sendMediaCommand, ensureProjectionReady } from '@/services/projection'
import { supabase } from '@/services/supabase'
import type { UserDevice } from '@/services/supabase'
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
  backgroundOverlayOpacity: 0.3,
  backgroundVideoUrl: '',
  fontSizeMax: false,
  titlePosition: 'top',
  verseReferencePosition: 'bottom',
  textUppercase: true,
  fontScale: 1,
  showBibleVersion: true,
  linesPerSlide: 2
}

// ─── Default settings ──────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS: AppSettings = {
  defaultTheme: DEFAULT_THEME,
  attendanceCategories: ['Caballeros', 'Damas', 'Amigos', 'Niños'],
  serviceNameTemplates: [],
  preacherTemplates: []
}

// Al mostrar texto, si hay un fondo favorito marcado, devuelve los overrides para
// activarlo y quitar cualquier media/anuncio que estuviera encima. Null si no aplica
// o si ya está aplicado. ponytail: el favorito tiene prioridad sobre el "fondo
// dinámico" de media — si quieres video de fondo bajo la letra, quita el favorito.
function favoriteBgOverride(
  defaultId: string | null,
  list: LocalMedia[],
  state: ProjectionState
): { theme: ProjectionTheme; media: null } | null {
  if (!defaultId) return null
  const fav = list.find(m => m.id === defaultId && m.type === 'image')
  if (!fav) return null
  const t = state.theme
  if (!state.media && t.backgroundType === 'image' && t.backgroundImageUrl === fav.url) return null
  return { theme: { ...t, backgroundType: 'image', backgroundImageUrl: fav.url }, media: null }
}

// ─── Projection Store ──────────────────────────────────────────────────────────
interface ProjectionStore {
  state: ProjectionState
  projectionWindow: Window | null
  setProjectionWindow: (w: Window | null) => void
  loadSong: (song: Song, isBible?: boolean, initialSlide?: number) => void
  // Proyecta slides ya parseados (asistencia u otro contenido) con la misma
  // normalización que loadSong: limpia media/anuncio, muestra el texto y aplica
  // el fondo favorito. Evita el path divergente que armaba el estado a mano.
  projectSlides: (title: string, slides: Slide[]) => void
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
  localMediaList: import('@/types').LocalMedia[]
  setLocalMediaList: (list: import('@/types').LocalMedia[] | ((prev: import('@/types').LocalMedia[]) => import('@/types').LocalMedia[])) => void
  localMediaFolders: import('@/types').LocalMediaFolder[]
  setLocalMediaFolders: (list: import('@/types').LocalMediaFolder[] | ((prev: import('@/types').LocalMediaFolder[]) => import('@/types').LocalMediaFolder[])) => void
  selectedMediaFolderId: string | null
  setSelectedMediaFolderId: (folderId: string | null) => void
  toggleMediaObjectFit: () => void
  currentSong: import('@/types').Song | null
  // Id de la media local marcada como fondo predeterminado (se aplica vía theme).
  defaultBackgroundMediaId: string | null
  setDefaultBackgroundMediaId: (id: string | null) => void
  // Fondos fijados al recuadro (BackgroundShelf). El activo sigue siendo defaultBackgroundMediaId.
  pinnedBackgroundIds: string[]
  setPinnedBackgroundIds: (updater: string[] | ((prev: string[]) => string[])) => void
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

export const useProjectionStore = create<ProjectionStore>()(
  persist(
    (set, get) => ({
      state: initialProjectionState,
      projectionWindow: null,
      localMediaList: [],
      localMediaFolders: [],
      selectedMediaFolderId: null,
      currentSong: null,
      defaultBackgroundMediaId: null,
      setDefaultBackgroundMediaId: (id) => set({ defaultBackgroundMediaId: id }),
      pinnedBackgroundIds: [],
      setPinnedBackgroundIds: (updater) => set((s) => ({
        pinnedBackgroundIds: typeof updater === 'function' ? updater(s.pinnedBackgroundIds) : updater
      })),

      setLocalMediaList: (updater) => set((s) => ({
        localMediaList: typeof updater === 'function' ? updater(s.localMediaList) : updater
      })),

      setLocalMediaFolders: (updater) => set((s) => ({
        localMediaFolders: typeof updater === 'function' ? updater(s.localMediaFolders) : updater
      })),

      setSelectedMediaFolderId: (folderId) => set({ selectedMediaFolderId: folderId }),

      setProjectionWindow: (w) => set({ projectionWindow: w }),

      loadSong: (song, isBible = false, initialSlide = -1) => {
        const s = get()
        const fav = favoriteBgOverride(s.defaultBackgroundMediaId, s.localMediaList, s.state)
        const theme = fav?.theme ?? s.state.theme
        const newState: ProjectionState = {
          ...s.state,
          theme,
          media: null,
          songId: isBible ? null : song.id || null,
          songTitle: song.title,
          songArtist: song.artist,
          isBible,
          lyricsRaw: song.lyrics,
          slides: parseLyrics(song.lyrics, theme.linesPerSlide ?? 2),
          currentSlide: initialSlide,
          hideText: false,
        }
        const doUpdate = (newWindow: Window | null) => {
          if (newWindow) set({ projectionWindow: newWindow })
          set({ state: newState, currentSong: isBible ? null : song })
          sendProjectionUpdate(newState)
        }
        if (isBible) {
          ensureProjectionReady(get().projectionWindow).then(doUpdate)
        } else {
          doUpdate(null)
        }
      },

      projectSlides: (title, slides) => {
        const s = get()
        const fav = favoriteBgOverride(s.defaultBackgroundMediaId, s.localMediaList, s.state)
        const theme = fav?.theme ?? s.state.theme
        const newState: ProjectionState = {
          ...s.state,
          theme,
          media: null,
          mediaStatus: undefined,
          songId: null,
          songTitle: title,
          songArtist: undefined,
          isBible: false,
          lyricsRaw: undefined,
          slides,
          currentSlide: 0,
          hideText: false,
        }
        set({ state: newState, currentSong: null })
        sendProjectionUpdate(newState)
      },

      nextSlide: () => {
        set(s => {
          const { currentSlide, slides } = s.state
          if (currentSlide < slides.length - 1) {
            const nextIndex = currentSlide === -1 ? 0 : currentSlide + 1
            const fav = favoriteBgOverride(s.defaultBackgroundMediaId, s.localMediaList, s.state)
            const newState = { ...s.state, ...(fav ?? {}), media: null, currentSlide: nextIndex, hideText: false }
            sendProjectionUpdate(newState)
            
            // Add to history only when presenting
            if (s.currentSong) {
              useAppStore.getState().addRecentSong(s.currentSong)
            }

            return { state: newState }
          }
          return s
        })
      },

      prevSlide: () => {
        set(s => {
          if (s.state.currentSlide > 0) {
            const fav = favoriteBgOverride(s.defaultBackgroundMediaId, s.localMediaList, s.state)
            const newState = { ...s.state, ...(fav ?? {}), media: null, currentSlide: s.state.currentSlide - 1, hideText: false }
            sendProjectionUpdate(newState)
            
            if (s.currentSong) {
              useAppStore.getState().addRecentSong(s.currentSong)
            }

            return { state: newState }
          }
          return s
        })
      },

      goToSlide: (index) => {
        const s = get()
        if (index >= 0 && index < s.state.slides.length) {
          const fav = favoriteBgOverride(s.defaultBackgroundMediaId, s.localMediaList, s.state)
          const newState = { ...s.state, ...(fav ?? {}), media: null, currentSlide: index, hideText: false }
          const doUpdate = (newWindow: Window | null) => {
            if (newWindow) set({ projectionWindow: newWindow })
            set({ state: newState })
            sendProjectionUpdate(newState)
            if (s.currentSong) {
              useAppStore.getState().addRecentSong(s.currentSong)
            }
          }
          ensureProjectionReady(get().projectionWindow).then(doUpdate)
        }
      },

      updateTheme: (theme) => {
        const currentState = get().state
        const newTheme = { ...currentState.theme, ...theme }
        let slides = currentState.slides

        // Si cambió la cantidad de líneas por slide y hay una canción cargada, reparceamos
        if (theme.linesPerSlide !== undefined && currentState.lyricsRaw && !currentState.isBible) {
          slides = parseLyrics(currentState.lyricsRaw, theme.linesPerSlide ?? 2)
        }

        const newState = { ...currentState, theme: newTheme, slides }
        
        // Si el usuario cambia el tipo de fondo desde la galería, quitamos el media local activo
        // para asegurar que el nuevo fondo sea visible.
        if (theme.backgroundType !== undefined) {
          newState.media = null
          // Elegir un fondo distinto del favorito activo lo desactiva. Si no, favoriteBgOverride
          // reimpondría la imagen favorita sobre el fondo elegido (p.ej. un video) al navegar slides.
          const favId = get().defaultBackgroundMediaId
          if (favId) {
            const fav = get().localMediaList.find(m => m.id === favId)
            const picksFavorite = theme.backgroundType === 'image' && theme.backgroundImageUrl === fav?.url
            if (!picksFavorite) set({ defaultBackgroundMediaId: null })
          }
        }

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
          // La letra solo se presenta sobre el fondo activo del recuadro: proyectar
          // cualquier media la oculta, quitarla la restaura (navegar slides también).
          const newState = { ...s.state, media, mediaStatus: undefined, hideText: !!media }
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

      toggleMediaObjectFit: () => {
        set(s => {
          if (!s.state.media) return s
          const currentFit = s.state.media.objectFit || (s.state.media.isBackgroundMode ? 'fill' : 'contain')
          // "Estirado" = fill (deforma para llenar el TV); "Ajustado" = contain (sin deformar).
          const newFit = currentFit === 'contain' ? 'fill' : 'contain'
          const newState = {
            ...s.state,
            media: { ...s.state.media, objectFit: newFit as 'cover' | 'contain' | 'fill' }
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
    }),
    {
      name: 'proclama-projection',
      partialize: (s) => ({
        state: {
          ...initialProjectionState,
          theme: s.state.theme
        },
        defaultBackgroundMediaId: s.defaultBackgroundMediaId,
        pinnedBackgroundIds: s.pinnedBackgroundIds
      })
    }
  )
)

// ─── App Store (settings + UI state) ──────────────────────────────────────────
interface AppStore {
  settings: AppSettings
  updateSettings: (s: Partial<AppSettings>) => void

  // Auth
  user: any | null
  setUser: (u: any | null) => void
  fetchCloudSettings: () => Promise<void>
  userRole: 'admin' | 'user' | null
  setUserRole: (r: 'admin' | 'user' | null) => void
  userPlan: 'free' | 'trial' | 'paid' | 'founding'
  setUserPlan: (p: 'free' | 'trial' | 'paid' | 'founding') => void
  premiumExpiresAt: string | null
  setPremiumExpiresAt: (v: string | null) => void
  trialStartedAt: string | null
  setTrialStartedAt: (v: string | null) => void
  authStatus: 'loading' | 'authenticated' | 'unauthenticated'
  setAuthStatus: (s: 'loading' | 'authenticated' | 'unauthenticated') => void
  
  guestMode: boolean
  setGuestMode: (v: boolean) => void
  
  activeView: 'library' | 'setlists' | 'settings' | 'bible' | 'timer' | 'notices' | 'notes' | 'terms' | 'fondos' | 'reports' | 'admin-users'
  setActiveView: (v: AppStore['activeView']) => void
  // Internal: registered by RouterSync so setActiveView can push history
  _navigate: ((path: string) => void) | null
  _setNavigate: (fn: (path: string) => void) => void

  isEditorOpen: boolean;
  setEditorOpen: (o: boolean) => void;
  editingSong: Song | null;
  setEditingSong: (s: Song | null) => void;
  openEditor: (song?: Song | null) => void;
  closeEditor: () => void;
  /** Callback opcional invocado con el id local al CREAR una canción (no al editar). Se limpia en closeEditor. */
  editorOnSaved: ((localId: number) => void) | null;
  setEditorOnSaved: (cb: ((localId: number) => void) | null) => void;

  activeSetlist: Setlist | null
  setActiveSetlist: (s: Setlist | null) => void

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Layout
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setIsSidebarOpen: (o: boolean) => void

  // Modal de atajos de teclado (?): en un store para que tanto el hook global
  // como los listeners de vistas concretas (p. ej. BibleView) puedan cederle
  // el paso sin prop-drilling.
  shortcutsOpen: boolean
  setShortcutsOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  
  liveSlidesViewGrid: boolean
  setLiveSlidesViewGrid: (v: boolean) => void


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

  // Device control
  deviceBlocked: boolean
  setDeviceBlocked: (v: boolean) => void
  userDevices: UserDevice[]
  setUserDevices: (devices: UserDevice[]) => void

  logout: () => void
  goToLanding: () => void
  forceLanding: boolean
  setForceLanding: (v: boolean, section?: string | null) => void
  forceLandingSection: string | null

  landingShowAuth: boolean
  setLandingShowAuth: (v: boolean) => void

  recentSongs: Song[]
  addRecentSong: (song: Song) => void
  clearRecentSongs: () => void

  toast: string | null
  setToast: (msg: string | null) => void

  language: 'es' | 'en'
  setLanguage: (lang: 'es' | 'en') => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: async (s) => {
        set(state => ({ settings: { ...state.settings, ...s } }))
        
        // Sync to cloud if logged in — use get() AFTER set() to get updated settings
        const { user } = get()
        const updatedSettings = get().settings
        if (user?.id) {
          try {
            const { updateUserSettings } = await import('@/services/supabase')
            await updateUserSettings(user.id, updatedSettings)
          } catch (err) {
            console.error('[Store] Error syncing settings to cloud:', err)
          }
        }
      },

      user: null,
      setUser: (u) => {
        set({ user: u })
      },

      fetchCloudSettings: async () => {
        const { user, settings } = get()
        if (!user?.id) return
        try {
          const { fetchUserSettings, updateUserSettings } = await import('@/services/supabase')
          const cloudSettings = await fetchUserSettings(user.id)
          
          if (cloudSettings && Object.keys(cloudSettings).length > 0) {
            // Merge cloud settings into local
            set(state => ({ settings: { ...state.settings, ...cloudSettings } }))
          } else {
            // Cloud settings are empty — push local settings to cloud (initial sync)
            await updateUserSettings(user.id, settings)
          }
        } catch (err) {
          console.error('[Store] Error fetching cloud settings:', err)
        }
      },
      userRole: null,
      setUserRole: (r) => set({ userRole: r }),
      userPlan: 'free',
      setUserPlan: (p) => set({ userPlan: p }),
      premiumExpiresAt: null,
      setPremiumExpiresAt: (v) => set({ premiumExpiresAt: v }),
      trialStartedAt: null,
      setTrialStartedAt: (v) => set({ trialStartedAt: v }),
      authStatus: 'loading',
      setAuthStatus: (s) => set({ authStatus: s }),

      guestMode: false,
      setGuestMode: (v) => set({ guestMode: v }),

      activeView: 'library',
      setActiveView: (v) => {
        set({ activeView: v })
        get()._navigate?.('/' + v)
      },
      _navigate: null,
      _setNavigate: (fn) => set({ _navigate: fn }),

      recentSongs: [],
      addRecentSong: (song) => set(s => {
        const updated = [song, ...s.recentSongs.filter(rs => rs.id !== song.id)].slice(0, 10)
        return { recentSongs: updated }
      }),
      clearRecentSongs: () => set({ recentSongs: [] }),

      isEditorOpen: false,
      setEditorOpen: (o) => set({ isEditorOpen: o }),
      editingSong: null,
      setEditingSong: (s) => set({ editingSong: s }),
      openEditor: (song) => set({ editingSong: song ?? null, isEditorOpen: true }),
      closeEditor: () => set({ editingSong: null, isEditorOpen: false, editorOnSaved: null }),
      editorOnSaved: null,
      setEditorOnSaved: (cb) => set({ editorOnSaved: cb }),

      activeSetlist: null,
      setActiveSetlist: (s) => set({ activeSetlist: s }),

      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),

      isSidebarOpen: true,
      toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
      setIsSidebarOpen: (o) => set({ isSidebarOpen: o }),

      shortcutsOpen: false,
      setShortcutsOpen: (v) => set(state => ({
        shortcutsOpen: typeof v === 'function' ? (v as (prev: boolean) => boolean)(state.shortcutsOpen) : v
      })),

      liveSlidesViewGrid: false,
      setLiveSlidesViewGrid: (v) => set({ liveSlidesViewGrid: v }),


      backgrounds: [],
      backgroundsLastFetch: null,
      fetchBackgrounds: async () => {
        const { data } = await supabase.from('backgrounds').select('*').order('created_at', { ascending: false })
        if (data) set({
          backgrounds: data.map((b) => ({ ...b, thumbnailUrl: b.thumbnail_url ?? undefined })),
          backgroundsLastFetch: Date.now(),
        })
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

      deviceBlocked: false,
      setDeviceBlocked: (v) => set({ deviceBlocked: v }),
      userDevices: [],
      setUserDevices: (devices) => set({ userDevices: devices }),

      logout: () => set({
        user: null,
        userRole: null,
        userPlan: 'free',
        premiumExpiresAt: null,
        trialStartedAt: null,
        authStatus: 'unauthenticated',
        guestMode: false,
        // NO borrar termsAccepted para que persista entre guest y logged in
        activeSetlist: null,
        editingSong: null
      }),

      goToLanding: () => set({ forceLanding: true }),

      forceLanding: false,
      forceLandingSection: null,
      setForceLanding: (v, section) => set({ forceLanding: v, forceLandingSection: section ?? null }),

      landingShowAuth: false,
      setLandingShowAuth: (v) => set({ landingShowAuth: v }),

      toast: null,
      setToast: (msg) => set({ toast: msg }),

      language: 'es',
      setLanguage: (lang) => {
        set({ language: lang })
        document.documentElement.lang = lang
      },
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
        liveSlidesViewGrid: state.liveSlidesViewGrid,
        language: state.language,
      })
    }
  )
)
