import es from './es'
import en from './en'

const translations: Record<string, Record<string, unknown>> = { es, en }

export function t(lang: string, path: string, params?: Record<string, string | number>): string {
  const langTranslations = translations[lang] ?? es
  let result: unknown = langTranslations
  const keys = path.split('.')
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key]
    } else {
      return path
    }
  }
  if (typeof result !== 'string') return path
  if (params) {
    return result.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
  }
  return result
}
