import { normalizeForSearch } from '@/utils/text'
import type { HelloAOBibleInfo } from '@/types'

/**
 * Catálogo de HelloAO (`available_translations.json`) con ~1.500 entradas de
 * fuentes mezcladas (ebible.org, etc.). Algunas NO traen `languageName` ni
 * `languageEnglishName` — p.ej. `cug_wbt` y `plj_tsc` — así que todo acceso
 * a esos campos pasa por aquí y nunca asume que existen.
 *
 * Antes el filtrado hacía `b.languageName.toLowerCase()` a secas: con esas dos
 * entradas cualquier búsqueda lanzaba `Cannot read properties of undefined`,
 * React desmontaba el árbol y la pantalla quedaba negra.
 */

/**
 * Nombre del idioma para agrupar/etiquetar: inglés → nativo → código (ej. "cug").
 * Es el mismo criterio que usa el modal para el encabezado de cada grupo.
 */
export function bibleLanguageLabel(bible: HelloAOBibleInfo): string {
  return bible.languageEnglishName || bible.languageName || bible.language || 'Sin idioma'
}

/** Textos sobre los que se busca: nombre, alias, id, idioma y sus variantes. */
export function bibleSearchTexts(bible: HelloAOBibleInfo): string[] {
  return [
    bible.name,
    bible.englishName,
    bible.shortName,
    bible.id,
    bible.language,
    bible.languageName,
    bible.languageEnglishName,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0)
}

/**
 * Filtra el catálogo por nombre de Biblia o de idioma, insensible a tildes,
 * mayúsculas y puntuación ("reina valera" encuentra "Reina-Valera").
 *
 * - Query vacía → se devuelve todo sin tocar los campos.
 * - Query de sólo puntuación (se normaliza a vacío) → sin resultados,
 *   igual que antes: no hay nada con lo que comparar.
 */
export function filterBibles(bibles: HelloAOBibleInfo[], query: string): HelloAOBibleInfo[] {
  if (!query.trim()) return bibles

  const q = normalizeForSearch(query)
  if (!q) return []

  return bibles.filter(bible => bibleSearchTexts(bible).some(t => normalizeForSearch(t).includes(q)))
}

/**
 * Agrupa por idioma y descarta ids repetidos dentro de cada grupo
 * (HelloAO lista la misma traducción más de una vez).
 */
export function groupBiblesByLanguage(
  bibles: HelloAOBibleInfo[]
): Record<string, HelloAOBibleInfo[]> {
  return bibles.reduce((acc, bible) => {
    const lang = bibleLanguageLabel(bible)
    if (!acc[lang]) acc[lang] = []
    if (!acc[lang].find(x => x.id === bible.id)) {
      acc[lang].push(bible)
    }
    return acc
  }, {} as Record<string, HelloAOBibleInfo[]>)
}
