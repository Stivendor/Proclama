/**
 * Utilidades para detección simple de idioma (Español vs Inglés)
 */

const SPANISH_KEYWORDS = [
  'de', 'la', 'que', 'el', 'en', 'los', 'del', 'se', 'las', 'un', 'con', 'no', 'una', 'su', 'para', 'es', 'al', 'se', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'esta', 'dios', 'señor', 'espíritu', 'santo', 'padre', 'hijo', 'amor', 'gracia', 'paz', 'fe', 'cristo', 'jesús', 'iglesia', 'cruz'
];

const ENGLISH_KEYWORDS = [
  'the', 'be', 'to', 'of', 'and', 'in', 'that', 'have', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'god', 'lord', 'spirit', 'holy', 'father', 'son', 'love', 'grace', 'peace', 'faith', 'christ', 'jesus', 'church', 'cross'
];

/**
 * Detecta si un texto es más probable que sea Español o Inglés.
 * @param text El texto a analizar
 * @returns 'Español' | 'Inglés'
 */
export function detectLanguage(text: string): 'Español' | 'Inglés' {
  if (!text) return 'Español';
  
  const words = text.toLowerCase().match(/\b(\w+)\b/g);
  if (!words) return 'Español';

  let esScore = 0;
  let enScore = 0;

  words.forEach(word => {
    if (SPANISH_KEYWORDS.includes(word)) esScore++;
    if (ENGLISH_KEYWORDS.includes(word)) enScore++;
  });

  // Los patrones específicos de español (ñ, acentos) dan puntos extra
  if (/[áéíóúñ]/i.test(text)) esScore += 3;

  return enScore > esScore ? 'Inglés' : 'Español';
}

/**
 * Obtiene el código de idioma ISO (opcional para uso futuro)
 */
export function getLanguageCode(lang: 'Español' | 'Inglés'): 'es' | 'en' {
  return lang === 'Español' ? 'es' : 'en';
}
