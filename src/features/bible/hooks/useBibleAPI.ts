import { useState, useCallback } from 'react'
import type { HelloAOBibleInfo } from '@/types'

export function useBibleAPI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBibles = useCallback(async (): Promise<HelloAOBibleInfo[]> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('https://bible.helloao.org/api/available_translations.json')
      if (!res.ok) throw new Error('API request failed')
      const data = await res.json()
      return data.translations as HelloAOBibleInfo[]
    } catch (err: any) {
      console.error('HelloAO API Error:', err)
      setError(err.message || 'Error conectando a HelloAO API')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    fetchBibles
  }
}
