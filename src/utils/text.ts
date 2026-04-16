/**
 * Normaliza texto eliminando tildes y acentos para búsquedas insensibles.
 * Ej: "sumérgeme" -> "sumergeme"
 */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Verifica si `query` está contenido en `text`, ignorando tildes y mayúsculas.
 */
export function containsIgnoreAccents(text: string, query: string): boolean {
  return normalizeText(text).includes(normalizeText(query))
}
