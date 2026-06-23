import { useState, useEffect } from 'react'
import type { Notice } from '@/types'

const KEY = 'proclama-notices'

function load(): Notice[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Notice[]) : []
  } catch {
    return []
  }
}

/** Global, date-less notices persisted to localStorage. ponytail: localStorage, move to DB if they ever need sync/dates. */
export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(notices))
  }, [notices])

  const add = (text: string) => {
    const now = new Date().toISOString()
    setNotices(n => [...n, { id: crypto.randomUUID(), text: text.trim(), createdAt: now, updatedAt: now }])
  }

  const update = (id: string, text: string) =>
    setNotices(n => n.map(x => (x.id === id ? { ...x, text: text.trim(), updatedAt: new Date().toISOString() } : x)))

  const remove = (id: string) => setNotices(n => n.filter(x => x.id !== id))

  return { notices, add, update, remove }
}
