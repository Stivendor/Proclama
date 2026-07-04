import { describe, expect, it } from 'vitest'
import { mapRowToSong } from '@/services/supabase'

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
