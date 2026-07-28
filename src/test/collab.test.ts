import { afterEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/services/supabase'
import { generateToken, collabInfo, collabUpsertSetlist, createCollaborator, CollabOwnerNotPremiumError } from '@/services/collab'

afterEach(() => vi.restoreAllMocks())

describe('generateToken', () => {
  it('genera tokens url-safe de al menos 40 chars, distintos entre si', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(40)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('collabInfo', () => {
  it('mapea la respuesta del RPC', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{ collaborator_name: 'Juan', church_name: 'Casa de Fe' }],
      error: null,
    } as any)
    const info = await collabInfo('tok123')
    expect(supabase.rpc).toHaveBeenCalledWith('collab_info', { p_token: 'tok123' })
    expect(info).toEqual({ collaboratorName: 'Juan', churchName: 'Casa de Fe' })
  })

  it('devuelve null si el token es invalido (error del RPC)', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: { message: 'invalid_token' } } as any)
    expect(await collabInfo('bad')).toBeNull()
  })

  it('propaga el error si es un fallo de red (no invalid_token)', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'TypeError: fetch failed', code: undefined },
    } as any)
    await expect(collabInfo('tok')).rejects.toThrow()
  })
})

describe('collabUpsertSetlist', () => {
  it('envia los parametros con nombres exactos del RPC', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{ id: 'u1', name: 'Domingo', date: '2026-07-12', song_ids: [100], notes: null, updated_by: 'Juan', updated_at: 'x', created_at: 'x', user_id: 'o1' }],
      error: null,
    } as any)
    const r = await collabUpsertSetlist('tok', { name: 'Domingo', date: '2026-07-12', songIds: [100], notes: null })
    expect(supabase.rpc).toHaveBeenCalledWith('collab_upsert_setlist', {
      p_token: 'tok', p_id: null, p_name: 'Domingo', p_date: '2026-07-12', p_song_ids: [100], p_notes: null,
    })
    expect(r?.id).toBe('u1')
  })
})

describe('createCollaborator', () => {
  it('inserta con token generado y devuelve id y token', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'c1', token: 'tokX' }, error: null })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const insertMock = vi.fn().mockReturnValue({ select: selectMock })
    vi.spyOn(supabase, 'from').mockReturnValue({ insert: insertMock } as any)

    const r = await createCollaborator('owner1', 'Juan')
    expect(supabase.from).toHaveBeenCalledWith('collaborators')
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.owner_id).toBe('owner1')
    expect(inserted.name).toBe('Juan')
    expect(inserted.token).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    expect(r).toEqual({ id: 'c1', token: 'tokX' })
  })
})

describe('collabInfo — dueño sin plan Pro', () => {
  it('distingue owner_not_premium de un token inválido', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: { code: '28001', message: 'owner_not_premium' },
    } as any)

    await expect(collabInfo('tok123')).rejects.toBeInstanceOf(CollabOwnerNotPremiumError)
  })

  it('lo reconoce también por el mensaje si el código no viaja', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'owner_not_premium' },
    } as any)

    await expect(collabInfo('tok123')).rejects.toBeInstanceOf(CollabOwnerNotPremiumError)
  })

  it('un token revocado sigue devolviendo null, no el error de plan', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: { code: '28000', message: 'invalid_token' },
    } as any)

    await expect(collabInfo('tok123')).resolves.toBeNull()
  })
})
