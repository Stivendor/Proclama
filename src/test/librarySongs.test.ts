import { describe, expect, it } from 'vitest'
import { mapRowToSong } from '@/services/supabase'
import { inUnifiedLibrary, dedupImported } from '@/utils/librarySongs'
import type { Song } from '@/types'

describe('mapRowToSong', () => {
  it('mapea rejection_reason a rejectionReason', () => {
    const song = mapRowToSong({
      id: 1, user_id: 'u1', title: 'T', artist: null, lyrics: null, key: null,
      tags: null, language: null, is_public: false, is_verified: false,
      rejection_reason: 'letra incompleta', usage_count: 0, created_at: null, updated_at: null,
    } as any)
    expect(song.rejectionReason).toBe('letra incompleta')
  })

  it('rejection_reason null queda undefined', () => {
    const song = mapRowToSong({
      id: 2, user_id: null, title: 'T2', artist: null, lyrics: null, key: null,
      tags: null, language: null, is_public: true, is_verified: true,
      rejection_reason: null, usage_count: 0, created_at: null, updated_at: null,
    } as any)
    expect(song.rejectionReason).toBeUndefined()
  })
})

const base: Song = {
  title: 'x', artist: '', lyrics: '', key: '', tags: [], language: 'Español',
  usageCount: 0, isPublic: false, isVerified: false, createdAt: new Date(), updatedAt: new Date(),
}

describe('inUnifiedLibrary', () => {
  it('incluye canciones propias en cualquier estado', () => {
    expect(inUnifiedLibrary({ ...base, userId: 'u1', isPublic: false }, 'u1')).toBe(true)
    expect(inUnifiedLibrary({ ...base, userId: 'u1', isPublic: true, rejectionReason: null }, 'u1')).toBe(true)
  })

  it('incluye comunidad solo si publica Y verificada', () => {
    expect(inUnifiedLibrary({ ...base, remoteId: 9, userId: 'otro', isPublic: true, isVerified: true }, 'u1')).toBe(true)
    expect(inUnifiedLibrary({ ...base, remoteId: 9, userId: 'otro', isPublic: true, isVerified: false }, 'u1')).toBe(false)
    expect(inUnifiedLibrary({ ...base, remoteId: 9, userId: 'otro', isPublic: false }, 'u1')).toBe(false)
  })

  it('incluye locales sin remoteId (guest) y admin ve todo', () => {
    expect(inUnifiedLibrary({ ...base }, undefined)).toBe(true)
    expect(inUnifiedLibrary({ ...base, remoteId: 9, userId: 'otro', isPublic: true, isVerified: false }, 'admin1', true)).toBe(true)
  })
})

describe('dedupImported', () => {
  it('oculta el original de comunidad cuando existe mi copia importada', () => {
    const original: Song = { ...base, id: 1, remoteId: 100, userId: 'otro', isPublic: true, isVerified: true }
    const miCopia: Song = { ...base, id: 2, userId: 'u1', importadaDe: 100 }
    const out = dedupImported([original, miCopia], 'u1')
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe(2)
  })

  it('no oculta nada si la copia es de otro usuario', () => {
    const original: Song = { ...base, id: 1, remoteId: 100, userId: 'u1', isPublic: true, isVerified: true }
    const copiaAjena: Song = { ...base, id: 2, userId: 'u1', importadaDe: 999 }
    expect(dedupImported([original, copiaAjena], 'u1')).toHaveLength(2)
  })
})
