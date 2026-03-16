// ─── Church (Sede IPUC) ───────────────────────────────────────────────────────
export interface Church {
  id: string
  code: string
  name: string
  createdAt: Date
}

// ─── Song ─────────────────────────────────────────────────────────────────────
export interface Song {
  id?: number
  churchId?: string
  title: string
  artist: string
  lyrics: string          // Estrofas separadas por línea en blanco. Etiquetas opcionales: [Coro], [Verso 1], etc.
  key: string             // Tonalidad: Do, Re, Mi... o C, D, E...
  tags: string[]
  language: string
  sourceUrl?: string
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

// ─── Setlist ───────────────────────────────────────────────────────────────────
export interface Setlist {
  id?: number
  churchId?: string
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
  currentSlide: number
  isBlack: boolean
  isLogo: boolean
  theme: ProjectionTheme
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
}

// ─── Reconocimiento de audio ──────────────────────────────────────────────────
export interface RecognitionResult {
  title: string
  artist: string
  confidence: number
  externalId?: string
}

export type RecognitionStatus =
  | 'idle'
  | 'listening'
  | 'detecting'
  | 'found'
  | 'not_found'
  | 'error'

// ─── Broadcast messages entre ventanas ────────────────────────────────────────
export type BroadcastMessage =
  | { type: 'PROJECTION_UPDATE'; payload: ProjectionState }
  | { type: 'NEXT_SLIDE' }
  | { type: 'PREV_SLIDE' }
  | { type: 'GO_TO_SLIDE'; payload: number }
  | { type: 'SET_BLACK'; payload: boolean }
  | { type: 'SET_LOGO'; payload: boolean }
  | { type: 'PING' }
  | { type: 'PONG' }

// ─── Settings de la app ───────────────────────────────────────────────────────
export interface AppSettings {
  acrcloudHost: string
  acrcloudAccessKey: string
  acrcloudAccessSecret: string
  geniusToken: string
  recognitionMode: 'assisted' | 'automatic'
  recognitionConfidenceThreshold: number
  churchName: string
  churchLogoUrl?: string
  defaultTheme: ProjectionTheme
}

// ─── Biblia ───────────────────────────────────────────────────────────────────
export interface BibleBook {
  id: string
  name: string
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