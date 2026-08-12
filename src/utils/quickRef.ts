/**
 * ¿El número tecleado ya no puede crecer sin salirse del máximo?
 * Juan tiene 21 capítulos: "3" ya es único (no existe el 30), "2" no (existen 20 y 21).
 * Sirve igual para capítulos y para versículos.
 */
export function isCompleteNumber(value: string, max: number): boolean {
  if (!/^\d+$/.test(value) || max < 1) return false
  const n = parseInt(value, 10)
  return n >= 1 && n <= max && n * 10 > max
}

/**
 * Separa una referencia escrita de corrido ("3:16", "3 16", "3") en sus partes.
 * Devuelve cadenas porque los inputs de la búsqueda rápida trabajan con texto.
 */
export function parseChapterVerse(text: string): { chapter: string; verse: string } {
  const nums = text.match(/\d+/g)
  if (!nums) return { chapter: '', verse: '' }
  return { chapter: nums[0], verse: nums[1] ?? '' }
}
