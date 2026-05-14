import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSongReport, supabase, updateSong } from '@/services/supabase'

describe('createSongReport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('permite enviar reportes anonimos con user_id null', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    vi.spyOn(supabase, 'from').mockReturnValue({ insert: insertMock } as any)

    const success = await createSongReport(42, 'lyrics_error', 'Falta el coro', null)

    expect(success).toBe(true)
    expect(supabase.from).toHaveBeenCalledWith('song_reports')
    expect(insertMock).toHaveBeenCalledWith({
      song_id: 42,
      reason: 'lyrics_error',
      details: 'Falta el coro',
      user_id: null,
    })
  })

  it('devuelve false si Supabase no responde antes del timeout', async () => {
    vi.useFakeTimers()
    vi.spyOn(supabase, 'from').mockReturnValue({
      insert: vi.fn().mockReturnValue(new Promise(() => {})),
    } as any)

    const resultPromise = createSongReport(42, 'lyrics_error', '', null, { timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(100)

    await expect(resultPromise).resolves.toBe(false)
  })
})

describe('updateSong', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('no registra error cuando se intenta actualizar sin usuario autenticado', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await updateSong(42, { usageCount: 3 })

    expect(result).toBeNull()
    expect(consoleError).not.toHaveBeenCalledWith('User not authenticated for update')
  })
})
