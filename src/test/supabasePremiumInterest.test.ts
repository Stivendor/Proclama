import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabase, registerPremiumInterest } from '@/services/supabase'

/**
 * Tests para registerPremiumInterest.
 * Usa vi.spyOn sobre el cliente supabase ya instanciado.
 */

describe('registerPremiumInterest', () => {
  let fromSpy: ReturnType<typeof vi.spyOn>

  const mockChain = (insertResult: { error: any }) => {
    const insertMock = vi.fn().mockResolvedValue(insertResult)
    fromSpy = vi.spyOn(supabase, 'from').mockReturnValue({ insert: insertMock } as any)
    return insertMock
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retorna success:true cuando el insert es exitoso', async () => {
    mockChain({ error: null })
    const result = await registerPremiumInterest('test@example.com')
    expect(result.success).toBe(true)
    expect(result.alreadyRegistered).toBe(false)
  })

  it('llama a supabase.from("premium_interest")', async () => {
    mockChain({ error: null })
    await registerPremiumInterest('test@example.com')
    expect(fromSpy).toHaveBeenCalledWith('premium_interest')
  })

  it('retorna alreadyRegistered:true en error de unique violation (23505)', async () => {
    mockChain({ error: { code: '23505', message: 'duplicate key' } })
    const result = await registerPremiumInterest('existing@example.com')
    expect(result.success).toBe(true)
    expect(result.alreadyRegistered).toBe(true)
  })

  it('retorna success:false en error genérico', async () => {
    mockChain({ error: { code: '500', message: 'server error' } })
    const result = await registerPremiumInterest('test@example.com')
    expect(result.success).toBe(false)
  })

  it('inserta el email tal como se recibe', async () => {
    const insertMock = mockChain({ error: null })
    await registerPremiumInterest('test@example.com')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    )
  })

  // Sin la fuente sólo sabríamos que alguien levantó la mano, no por cuál
  // función — que es el dato que decide qué se cobra.
  it('guarda la función que disparó el interés', async () => {
    const insertMock = mockChain({ error: null })
    await registerPremiumInterest('test@example.com', 'user-1', 'collaborators')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'collaborators', user_id: 'user-1' })
    )
  })

  it('sin fuente explícita registra la landing', async () => {
    const insertMock = mockChain({ error: null })
    await registerPremiumInterest('test@example.com')
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ source: 'landing' }))
  })
})
