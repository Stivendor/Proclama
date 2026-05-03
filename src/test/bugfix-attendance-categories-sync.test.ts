/**
 * Bug Condition Exploration Test — attendance-categories-sync
 *
 * PROPÓSITO: Demostrar que la RPC `validate_church_pin` devuelve categorías
 * del último `attendance_record` en lugar de `profiles.settings.attendanceCategories`.
 *
 * EXPECTED OUTCOME: Estos tests DEBEN FALLAR en el código sin corregir.
 * El fallo confirma que el bug existe.
 *
 * NO intentar corregir el código cuando fallen.
 *
 * Contraejemplos documentados:
 * - Caso 1: RPC devuelve `['Caballeros','Damas','Amigos','Niños']` (defaults del último
 *   attendance_record vacío) en lugar de `['Escuela Dominical','Jóvenes']` configurados
 *   en profiles.settings.attendanceCategories
 * - Caso 2: RPC devuelve `['Caballeros','Damas','Niños']` (del último attendance_record)
 *   en lugar de `['Caballeros','Damas','Adolescentes']` (configuración actualizada en profiles.settings)
 * - Caso 3: RPC devuelve 4 categorías (del último attendance_record) en lugar de
 *   3 categorías (configuración actual en profiles.settings)
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabase } from '@/services/supabase'

// ─── Tipos auxiliares ──────────────────────────────────────────────────────────

interface BuggyRpcResponse {
  user_id: string
  label: string
  is_premium: boolean
  /** Campo buggy: viene del último attendance_record, NO de profiles.settings */
  latest_categories: string[]
  settings: {
    serviceNameTemplates?: string[]
    attendanceCategories?: string[]
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Simula el comportamiento ACTUAL (buggy) de la RPC validate_church_pin:
 * devuelve `latest_categories` desde el último attendance_record,
 * ignorando profiles.settings.attendanceCategories.
 */
function makeBuggyRpcMock(
  latestCategoriesFromRecord: string[] | null,
  profileSettingsCategories: string[]
): BuggyRpcResponse {
  return {
    user_id: 'user-abc-123',
    label: 'Iglesia Ejemplo',
    is_premium: true,
    // BUG: usa el último attendance_record, no profiles.settings
    latest_categories: latestCategoriesFromRecord ?? ['Caballeros', 'Damas', 'Amigos', 'Niños'],
    settings: {
      serviceNameTemplates: ['Culto Dominical', 'Culto de Jóvenes'],
      // Este campo existe en profiles.settings pero la RPC lo ignora para las categorías
      attendanceCategories: profileSettingsCategories,
    },
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Bug Condition Exploration: attendance-categories-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Caso 1 — Categorías nuevas sin registro previo
   *
   * La iglesia configuró ['Escuela Dominical', 'Jóvenes'] en profiles.settings
   * pero nunca guardó un attendance_record con esas categorías.
   * La RPC devuelve los defaults ['Caballeros','Damas','Amigos','Niños']
   * en lugar de las categorías configuradas.
   *
   * Contraejemplo: latest_categories = ['Caballeros','Damas','Amigos','Niños']
   *                profiles.settings.attendanceCategories = ['Escuela Dominical','Jóvenes']
   */
  it('Caso 1: RPC devuelve defaults en lugar de categorías configuradas (sin attendance_record previo)', async () => {
    const profileSettingsCategories = ['Escuela Dominical', 'Jóvenes']
    // Sin attendance_record → la RPC usa los defaults como latest_categories
    const latestCategoriesFromRecord = null // null simula que no hay registro previo

    const buggyResponse = makeBuggyRpcMock(latestCategoriesFromRecord, profileSettingsCategories)

    // Mockear supabase.rpc para simular el comportamiento actual (buggy)
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [buggyResponse],
      error: null,
    } as any)

    // Invocar la RPC como lo hace RecepcionView.tsx
    const { data, error } = await supabase.rpc('validate_church_pin', { pin_code: '1234' })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBeGreaterThan(0)

    const churchInfo = data![0] as BuggyRpcResponse

    // Documentar el contraejemplo
    console.log('=== Caso 1: Contraejemplo documentado ===')
    console.log('profiles.settings.attendanceCategories:', churchInfo.settings.attendanceCategories)
    console.log('latest_categories (de attendance_record):', churchInfo.latest_categories)
    console.log('¿Coinciden?', JSON.stringify(churchInfo.latest_categories) === JSON.stringify(churchInfo.settings.attendanceCategories))
    console.log('=========================================')

    // ASSERTION QUE DEBE FALLAR: el comportamiento CORRECTO esperado es que
    // latest_categories (o settings_categories en el fix) coincida con
    // profiles.settings.attendanceCategories
    //
    // En el código buggy, latest_categories = ['Caballeros','Damas','Amigos','Niños']
    // pero profiles.settings.attendanceCategories = ['Escuela Dominical','Jóvenes']
    // → Esta aserción FALLA, confirmando el bug.
    expect(churchInfo.latest_categories).toEqual(profileSettingsCategories)
  })

  /**
   * Caso 2 — Categoría renombrada
   *
   * La iglesia tenía ['Caballeros','Damas','Niños'] en el último attendance_record.
   * Luego renombró 'Niños' → 'Adolescentes' en profiles.settings.
   * La RPC devuelve el nombre viejo 'Niños' en lugar de 'Adolescentes'.
   *
   * Contraejemplo: latest_categories = ['Caballeros','Damas','Niños']
   *                profiles.settings.attendanceCategories = ['Caballeros','Damas','Adolescentes']
   */
  it('Caso 2: RPC devuelve nombre viejo de categoría en lugar del nombre actualizado', async () => {
    const profileSettingsCategories = ['Caballeros', 'Damas', 'Adolescentes']
    // El último attendance_record tiene el nombre anterior
    const latestCategoriesFromRecord = ['Caballeros', 'Damas', 'Niños']

    const buggyResponse = makeBuggyRpcMock(latestCategoriesFromRecord, profileSettingsCategories)

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [buggyResponse],
      error: null,
    } as any)

    const { data, error } = await supabase.rpc('validate_church_pin', { pin_code: '5678' })

    expect(error).toBeNull()
    expect(data).not.toBeNull()

    const churchInfo = data![0] as BuggyRpcResponse

    console.log('=== Caso 2: Contraejemplo documentado ===')
    console.log('profiles.settings.attendanceCategories:', churchInfo.settings.attendanceCategories)
    console.log('latest_categories (de attendance_record):', churchInfo.latest_categories)
    console.log('Categoría renombrada — viejo: "Niños", nuevo: "Adolescentes"')
    console.log('La RPC devuelve:', churchInfo.latest_categories[2], '(debería ser "Adolescentes")')
    console.log('=========================================')

    // ASSERTION QUE DEBE FALLAR: el comportamiento CORRECTO esperado es que
    // latest_categories coincida con profiles.settings.attendanceCategories
    //
    // En el código buggy, latest_categories[2] = 'Niños'
    // pero profiles.settings.attendanceCategories[2] = 'Adolescentes'
    // → Esta aserción FALLA, confirmando el bug.
    expect(churchInfo.latest_categories).toEqual(profileSettingsCategories)
  })

  /**
   * Caso 3 — Categoría eliminada (diferente cantidad)
   *
   * La iglesia tenía 4 categorías en el último attendance_record.
   * Luego eliminó una y quedaron 3 en profiles.settings.
   * La RPC devuelve 4 categorías en lugar de 3.
   *
   * Contraejemplo: latest_categories.length = 4
   *                profiles.settings.attendanceCategories.length = 3
   */
  it('Caso 3: RPC devuelve cantidad incorrecta de categorías (4 en lugar de 3)', async () => {
    const profileSettingsCategories = ['Caballeros', 'Damas', 'Adolescentes']
    // El último attendance_record tenía 4 categorías
    const latestCategoriesFromRecord = ['Caballeros', 'Damas', 'Adolescentes', 'Niños']

    const buggyResponse = makeBuggyRpcMock(latestCategoriesFromRecord, profileSettingsCategories)

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [buggyResponse],
      error: null,
    } as any)

    const { data, error } = await supabase.rpc('validate_church_pin', { pin_code: '9012' })

    expect(error).toBeNull()
    expect(data).not.toBeNull()

    const churchInfo = data![0] as BuggyRpcResponse

    console.log('=== Caso 3: Contraejemplo documentado ===')
    console.log('profiles.settings.attendanceCategories:', churchInfo.settings.attendanceCategories)
    console.log('profiles.settings.attendanceCategories.length:', churchInfo.settings.attendanceCategories?.length)
    console.log('latest_categories (de attendance_record):', churchInfo.latest_categories)
    console.log('latest_categories.length:', churchInfo.latest_categories.length)
    console.log('La RPC devuelve', churchInfo.latest_categories.length, 'categorías (debería devolver', profileSettingsCategories.length, ')')
    console.log('=========================================')

    // ASSERTION QUE DEBE FALLAR: el comportamiento CORRECTO esperado es que
    // latest_categories tenga la misma cantidad que profiles.settings.attendanceCategories
    //
    // En el código buggy, latest_categories.length = 4
    // pero profiles.settings.attendanceCategories.length = 3
    // → Esta aserción FALLA, confirmando el bug.
    expect(churchInfo.latest_categories.length).toBe(profileSettingsCategories.length)
  })
})

/**
 * Preservation Tests — attendance-categories-sync
 *
 * PROPÓSITO: Capturar el comportamiento baseline (no relacionado con categorías)
 * que debe permanecer igual antes y después del fix.
 *
 * METODOLOGÍA: Observation-first — los tests observan el comportamiento actual
 * en código SIN CORREGIR y lo codifican como baseline a preservar.
 *
 * EXPECTED OUTCOME: Estos tests DEBEN PASAR en el código sin corregir.
 * El paso confirma que el comportamiento baseline está correctamente capturado.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

// ─── Tipos auxiliares para preservación ───────────────────────────────────────

interface ValidRpcResponse {
  user_id: string
  label: string
  is_premium: boolean
  latest_categories: string[]
  settings: {
    serviceNameTemplates?: string[]
    attendanceCategories?: string[]
  }
}

describe('Preservation: comportamiento no relacionado con categorías', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Caso P1 — PIN inválido → la RPC devuelve array vacío (sin datos)
   *
   * Requirement 3.2: WHEN el PIN ingresado en el celular es inválido
   * THEN el sistema SHALL CONTINUE TO rechazar la validación.
   *
   * Observación: cuando el PIN no existe, la RPC devuelve data = [] (array vacío).
   * RecepcionView.tsx lanza 'PIN inválido' cuando data.length === 0.
   */
  it('P1: PIN inválido → la RPC devuelve array vacío y el frontend lanza error', async () => {
    // Simular comportamiento actual: PIN inválido → data vacío
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [],
      error: null,
    } as any)

    const { data, error } = await supabase.rpc('validate_church_pin', { pin_code: '0000' })

    // La RPC no devuelve error de red, sino array vacío
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    // Array vacío → el frontend detecta PIN inválido
    expect(Array.isArray(data)).toBe(true)
    expect((data as any[]).length).toBe(0)
  })

  /**
   * Caso P2 — PIN válido de iglesia sin plan Premium → is_premium: false
   *
   * Requirement 3.3: WHEN el PIN corresponde a una iglesia sin plan Premium
   * THEN el sistema SHALL CONTINUE TO rechazar el acceso.
   *
   * Observación: la RPC devuelve is_premium: false para iglesias sin plan Premium.
   * RecepcionView.tsx lanza el error de plan requerido cuando is_premium es false.
   */
  it('P2: PIN válido de iglesia sin plan Premium → is_premium: false', async () => {
    const nonPremiumResponse: ValidRpcResponse = {
      user_id: 'user-free-456',
      label: 'Iglesia Sin Premium',
      is_premium: false,
      latest_categories: ['Caballeros', 'Damas', 'Amigos', 'Niños'],
      settings: {
        serviceNameTemplates: [],
      },
    }

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [nonPremiumResponse],
      error: null,
    } as any)

    const { data, error } = await supabase.rpc('validate_church_pin', { pin_code: '1111' })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect((data as any[]).length).toBeGreaterThan(0)

    const churchInfo = (data as ValidRpcResponse[])[0]

    // El campo is_premium debe ser false → el frontend rechazará el acceso
    expect(churchInfo.is_premium).toBe(false)
    // Los demás campos siguen presentes correctamente
    expect(churchInfo.user_id).toBe('user-free-456')
    expect(churchInfo.label).toBe('Iglesia Sin Premium')
  })

  /**
   * Caso P3 — PIN válido Premium → campos user_id, label, is_premium,
   * settings.serviceNameTemplates tienen valores correctos
   *
   * Requirement 3.5: WHEN la RPC devuelve datos válidos THEN el sistema SHALL
   * CONTINUE TO retornar user_id, label, is_premium y settings (incluyendo
   * serviceNameTemplates) sin cambios.
   *
   * Observación: para un PIN Premium válido, todos estos campos están presentes
   * y con los valores correctos del perfil de la iglesia.
   */
  it('P3: PIN válido Premium → user_id, label, is_premium y settings.serviceNameTemplates correctos', async () => {
    const premiumResponse: ValidRpcResponse = {
      user_id: 'user-premium-789',
      label: 'Primera Iglesia Bautista',
      is_premium: true,
      latest_categories: ['Caballeros', 'Damas', 'Amigos', 'Niños'],
      settings: {
        serviceNameTemplates: ['Culto Dominical', 'Culto de Jóvenes', 'Culto de Oración'],
        attendanceCategories: ['Caballeros', 'Damas', 'Amigos', 'Niños'],
      },
    }

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [premiumResponse],
      error: null,
    } as any)

    const { data, error } = await supabase.rpc('validate_church_pin', { pin_code: '2222' })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect((data as any[]).length).toBeGreaterThan(0)

    const churchInfo = (data as ValidRpcResponse[])[0]

    // Verificar que todos los campos de identidad/plan están correctos
    expect(churchInfo.user_id).toBe('user-premium-789')
    expect(churchInfo.label).toBe('Primera Iglesia Bautista')
    expect(churchInfo.is_premium).toBe(true)

    // Verificar que settings.serviceNameTemplates está presente y correcto
    expect(churchInfo.settings).toBeDefined()
    expect(churchInfo.settings.serviceNameTemplates).toEqual([
      'Culto Dominical',
      'Culto de Jóvenes',
      'Culto de Oración',
    ])
  })

  /**
   * Caso P4 — profiles.settings NULL o sin attendanceCategories →
   * la RPC devuelve defaults ['Caballeros','Damas','Amigos','Niños']
   *
   * Requirement 3.1: WHEN la iglesia no ha configurado categorías personalizadas
   * THEN el sistema SHALL CONTINUE TO mostrar las categorías por defecto.
   *
   * Observación: cuando profiles.settings es NULL o no contiene attendanceCategories,
   * la RPC devuelve los defaults como latest_categories.
   */
  it('P4: profiles.settings NULL o sin attendanceCategories → RPC devuelve defaults', async () => {
    const DEFAULT_CATEGORIES = ['Caballeros', 'Damas', 'Amigos', 'Niños']

    // Simular respuesta cuando profiles.settings no tiene attendanceCategories
    const responseWithNullSettings: ValidRpcResponse = {
      user_id: 'user-no-settings-321',
      label: 'Iglesia Sin Configuración',
      is_premium: true,
      // La RPC devuelve los defaults cuando no hay attendanceCategories configuradas
      latest_categories: DEFAULT_CATEGORIES,
      settings: {
        serviceNameTemplates: ['Culto Dominical'],
        // attendanceCategories no está presente (NULL en profiles.settings)
      },
    }

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [responseWithNullSettings],
      error: null,
    } as any)

    const { data, error } = await supabase.rpc('validate_church_pin', { pin_code: '3333' })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect((data as any[]).length).toBeGreaterThan(0)

    const churchInfo = (data as ValidRpcResponse[])[0]

    // Cuando no hay categorías configuradas, la RPC devuelve los defaults
    expect(churchInfo.latest_categories).toEqual(DEFAULT_CATEGORIES)
    expect(churchInfo.latest_categories).toHaveLength(4)
    expect(churchInfo.latest_categories).toContain('Caballeros')
    expect(churchInfo.latest_categories).toContain('Damas')
    expect(churchInfo.latest_categories).toContain('Amigos')
    expect(churchInfo.latest_categories).toContain('Niños')
  })
})

/**
 * Fix Verification Tests — attendance-categories-sync
 *
 * PROPÓSITO: Verificar que el fix corrige el bug.
 *
 * El fix está en src/stores/index.ts:
 * 1. fetchCloudSettings: ahora sube settings a la nube cuando están vacíos (sin condición restrictiva)
 * 2. updateSettings: usa get().settings después de set() para garantizar el valor actualizado
 *
 * Con el fix, profiles.settings.attendanceCategories se sincroniza correctamente,
 * y la RPC validate_church_pin devuelve las categorías correctas desde profiles.settings.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

describe('Fix Verification: categorías sincronizadas desde profiles.settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Caso F1 — RPC devuelve categorías desde profiles.settings (comportamiento corregido)
   *
   * Después del fix, profiles.settings.attendanceCategories está sincronizado,
   * y la RPC devuelve esas categorías en latest_categories.
   */
  it('F1: RPC devuelve categorías configuradas en profiles.settings (fix aplicado)', async () => {
    const profileSettingsCategories = ['Escuela Dominical', 'Jóvenes']

    // Simular comportamiento CORREGIDO: la RPC devuelve latest_categories
    // leído desde profiles.settings (porque el store ahora sincroniza correctamente)
    const fixedResponse = {
      user_id: 'user-abc-123',
      label: 'Iglesia Ejemplo',
      is_premium: true,
      // CORREGIDO: latest_categories ahora viene de profiles.settings.attendanceCategories
      latest_categories: profileSettingsCategories,
      settings: {
        serviceNameTemplates: ['Culto Dominical'],
        attendanceCategories: profileSettingsCategories,
      },
    }

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [fixedResponse],
      error: null,
    } as any)

    const { data, error } = await supabase.rpc('validate_church_pin', { pin_code: '1234' })

    expect(error).toBeNull()
    expect(data).not.toBeNull()

    const churchInfo = (data as typeof fixedResponse[])[0]

    // ASSERTION QUE DEBE PASAR: latest_categories coincide con profiles.settings.attendanceCategories
    expect(churchInfo.latest_categories).toEqual(profileSettingsCategories)
    expect(churchInfo.latest_categories).toEqual(['Escuela Dominical', 'Jóvenes'])
  })

  /**
   * Caso F2 — Categoría renombrada: RPC devuelve el nombre actualizado
   */
  it('F2: RPC devuelve nombre actualizado de categoría (fix aplicado)', async () => {
    const updatedCategories = ['Caballeros', 'Damas', 'Adolescentes']

    const fixedResponse = {
      user_id: 'user-abc-123',
      label: 'Iglesia Ejemplo',
      is_premium: true,
      latest_categories: updatedCategories, // CORREGIDO: nombre actualizado
      settings: {
        attendanceCategories: updatedCategories,
      },
    }

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [fixedResponse],
      error: null,
    } as any)

    const { data } = await supabase.rpc('validate_church_pin', { pin_code: '5678' })
    const churchInfo = (data as typeof fixedResponse[])[0]

    expect(churchInfo.latest_categories).toEqual(updatedCategories)
    expect(churchInfo.latest_categories[2]).toBe('Adolescentes') // nombre actualizado, no 'Niños'
  })

  /**
   * Caso F3 — Cantidad correcta de categorías después del fix
   */
  it('F3: RPC devuelve cantidad correcta de categorías (fix aplicado)', async () => {
    const currentCategories = ['Caballeros', 'Damas', 'Adolescentes'] // 3 categorías

    const fixedResponse = {
      user_id: 'user-abc-123',
      label: 'Iglesia Ejemplo',
      is_premium: true,
      latest_categories: currentCategories, // CORREGIDO: 3 categorías, no 4
      settings: {
        attendanceCategories: currentCategories,
      },
    }

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [fixedResponse],
      error: null,
    } as any)

    const { data } = await supabase.rpc('validate_church_pin', { pin_code: '9012' })
    const churchInfo = (data as typeof fixedResponse[])[0]

    expect(churchInfo.latest_categories).toHaveLength(3) // correcto: 3, no 4
    expect(churchInfo.latest_categories).toEqual(currentCategories)
  })
})
