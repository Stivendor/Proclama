

// ─── Song ─────────────────────────────────────────────────────────────────────
export interface Song {
  id?: number
  userId?: string         // UUID del usuario propietario (Supabase)
  title: string
  artist: string
  lyrics: string          // Estrofas separadas por línea en blanco. Etiquetas opcionales: [Coro], [Verso 1], etc.
  key: string             // Tonalidad: Do, Re, Mi... o C, D, E...
  tags: string[]
  language: string
  sourceUrl?: string
  usageCount: number
  isPublic: boolean      // Indica si la canción es visible para todos
  isVerified: boolean     // Solo las canciones verificadas aparecen públicamente
  createdAt: Date
  updatedAt: Date
}

// ─── Setlist ───────────────────────────────────────────────────────────────────
export interface Setlist {
  id?: number
  userId?: string     // UUID del usuario (Supabase)
  name: string
  date: Date
  songIds: number[]
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// ─── Slide (estrofa para proyección) ──────────────────────────────────────────
export interface Slide {
  index: number
  label: string           // [Coro], [Verso 1], etc.
  lines: string[]
}

// ─── Estado de proyección ─────────────────────────────────────────────────────
export interface ProjectionState {
  songId: number | null
  songTitle: string
  slides: Slide[]
  lyricsRaw?: string
  currentSlide: number
  isBible?: boolean
  theme: ProjectionTheme
  media?: {
    url: string
    type: 'image' | 'video'
    isBackgroundMode?: boolean
  } | null
  hideText?: boolean
  mediaStatus?: {
    currentTime: number
    duration: number
    isPlaying: boolean
  }
}

// ─── Tema visual ──────────────────────────────────────────────────────────────
export interface ProjectionTheme {
  background: string      // color hex o 'image'
  backgroundImage?: string
  fontFamily: string
  fontSize: number        // px
  textColor: string
  textShadow: boolean
  transition: 'fade' | 'slide' | 'instant'
  showTitle: boolean
  showVerseLabel: boolean
  backgroundType?: 'color' | 'video' | 'image' | 'gradient'
  backgroundVideoUrl?: string
  backgroundImageUrl?: string
  backgroundThumbnail?: string
  backgroundBlur?: number
  backgroundOverlayOpacity?: number
  fontSizeMax?: boolean
  titlePosition?: 'top' | 'bottom' | 'none'
  verseReferencePosition?: 'top' | 'bottom'
  textUppercase?: boolean
  maxFontSize?: number  // cap para el auto-fit (px). undefined = sin límite
  fontScale?: number    // multiplicador manual (ej: 0.8 para encoger, 1.2 para agrandar)
  linesPerSlide?: number // cantidad máxima de líneas por slide
}

export interface BackgroundAsset {
  id: string
  url: string
  thumbnailUrl: string
  type: 'image' | 'video'
  category?: string
}

// ─── Contador Regresivo (Countdown) ───────────────────────────────────────────
export interface CountdownTheme {
  background: string
  backgroundType: 'color' | 'image' | 'video'
  backgroundImageUrl?: string
  backgroundThumbnail?: string
  backgroundVideoUrl?: string
  backgroundBlur?: number
  backgroundOverlayOpacity?: number
  fontFamily: string
  fontSize: number
  textColor: string
  timerColor?: string
  textShadow: boolean
}

export interface CountdownConfig {
  title: string
  durationMinutes: number
  durationSeconds: number
  theme: CountdownTheme
}

export interface CountdownState {
  config: CountdownConfig
  status: 'idle' | 'running' | 'paused' | 'finished'
  remainingTime: number
}

// ─── Broadcast messages entre ventanas ────────────────────────────────────────
export type BroadcastMessage =
  | { type: 'PROJECTION_UPDATE'; payload: ProjectionState }
  | { type: 'NEXT_SLIDE' }
  | { type: 'PREV_SLIDE' }
  | { type: 'GO_TO_SLIDE'; payload: number }
  | { type: 'PING' }
  | { type: 'PONG' }
  | { type: 'MEDIA_COMMAND'; payload: { action: 'play' | 'pause' | 'seek'; value?: number } }
  | { type: 'MEDIA_STATUS'; payload: { currentTime: number; duration: number; isPlaying: boolean } }
  | { type: 'COUNTDOWN_UPDATE'; payload: CountdownState }

// ─── Settings de la app ───────────────────────────────────────────────────────
export interface AppSettings {
  churchName: string
  churchLogoUrl?: string
  defaultTheme: ProjectionTheme
  attendanceCategories: string[]
}

// ─── Biblia ───────────────────────────────────────────────────────────────────
export interface BibleBook {
  id: string
  name: string
  nameEn: string
  chapters: number
  testament: 'AT' | 'NT'
}

export interface BibleVerse {
  book: string
  chapter: number
  verse: number
  text: string
}

export interface BibleSlide {
  reference: string   // "Juan 3:16"
  text: string
  translation: string
}

// ─── Terms & Conditions ───────────────────────────────────────────────────────
export interface TermsAcceptance {
  version: string      // "1.0"
  acceptedAt: string   // ISO 8601
}

// ─── Church Notes ─────────────────────────────────────────────────────────────
export interface Notice {
  id: string          // nanoid() — UUID local
  text: string
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
}

export interface AttendanceBreakdown {
  values?: number[]
  caballeros?: number
  damas?: number
  amigos?: number
  ninos?: number
}

/** Asistencia por fecha; Dexie + Supabase `attendance_records` (no mezclar con `church_notes`). */
export interface AttendanceRecord {
  id?: number
  remoteId?: string
  userId: string
  date: string
  serviceName?: string
  values?: number[]
  caballeros?: number
  damas?: number
  amigos?: number
  ninos?: number
  createdAt: string
  updatedAt: string
}

export interface ChurchNote {
  id?: number         // Dexie autoincrement (local)
  remoteId?: string   // UUID de Supabase
  userId: string      // user.id o 'guest'
  date: string        // 'YYYY-MM-DD'
  serviceName?: string // nombre libre del culto (ej. "Culto Dominical", "Vigilia")
  attendance?: AttendanceBreakdown
  notices: Notice[]
  createdAt: string
  updatedAt: string
}

// ─── API.Bible / HelloAO Interfaces ─────────────────────────────────────────────
export interface HelloAOBibleInfo {
  id: string
  name: string
  englishName: string
  language: string
  languageName: string
  languageEnglishName: string
  shortName: string
  totalNumberOfChapters: number
  totalNumberOfVerses: number
}

export interface ImportedBibleReference {
  id: string      // ID from HelloAO (usually short like BSB, AAB)
  name: string    
  languageId: string
  languageName: string
  importedAt: number
}
