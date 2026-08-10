import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db'
import { createSong } from '@/services/supabase'
import { importLyricsResult } from '@/services/lyricsImport'
import type { LyricsResult } from '@/services/lyricsSearch'

vi.mock('@/db', () => ({
  db: {
    songs: {
      add: vi.fn().mockResolvedValue(77),
      update: vi.fn().mockResolvedValue(1),
    },
  },
}))

vi.mock('@/services/supabase', () => ({
  createSong: vi.fn().mockResolvedValue(null),
}))

const resultado: LyricsResult = {
  id: 42,
  title: 'Bienvenido Espíritu Santo',
  artist: 'Miel San Marcos',
  lyrics: 'Bienvenido\nEspíritu Santo\n\nEres bienvenido\naquí',
  knownArtist: true,
  alreadyInLibrary: false,
}

describe('importLyricsResult', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('escribe en Dexie con el id local devuelto', async () => {
    const song = await importLyricsResult(resultado, null)
    expect(db.songs.add).toHaveBeenCalledOnce()
    expect(song.id).toBe(77)
    expect(song.title).toBe('Bienvenido Espíritu Santo')
    expect(song.lyrics).toContain('Espíritu Santo')
  })

  it('entra invisible para terceros y encolada para aprobación', async () => {
    const song = await importLyricsResult(resultado, null)
    expect(song.isPublic).toBe(true)
    expect(song.isVerified).toBe(false)
  })

  it('guarda la procedencia', async () => {
    const song = await importLyricsResult(resultado, null)
    expect(song.sourceUrl).toContain('lrclib.net')
    expect(song.sourceUrl).toContain('42')
  })

  it('en modo invitado no toca Supabase', async () => {
    await importLyricsResult(resultado, null)
    expect(createSong).not.toHaveBeenCalled()
  })

  it('con sesión sube a Supabase y guarda el remoteId', async () => {
    vi.mocked(createSong).mockResolvedValueOnce({ remoteId: 900 } as never)
    await importLyricsResult(resultado, 'uuid-del-usuario')
    expect(createSong).toHaveBeenCalledOnce()
    expect(db.songs.update).toHaveBeenCalledWith(77, { remoteId: 900 })
  })

  it('si el upload falla la canción sigue en local y no lanza', async () => {
    vi.mocked(createSong).mockResolvedValueOnce(null)
    const song = await importLyricsResult(resultado, 'uuid-del-usuario')
    expect(song.id).toBe(77)
    expect(db.songs.update).not.toHaveBeenCalled()
  })
})
