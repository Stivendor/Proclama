import Dexie, { Table } from 'dexie'
import type { Song, Setlist, AppSettings, ChurchNote } from '@/types'

export class ProclamaDB extends Dexie {
  songs!: Table<Song>
  setlists!: Table<Setlist>
  settings!: Table<AppSettings & { id: number }>
  church_notes!: Table<ChurchNote>

  constructor() {
    super('ProclamaDB')
    this.version(3).stores({
      songs:    '++id, title, artist, language, usageCount, createdAt',
      setlists: '++id, name, date, createdAt',
      settings: '++id'
    })
    this.version(4).stores({
      church_notes: '++id, date, userId, [date+userId]'
    })
    this.version(5).stores({
      songs: '++id, title, artist, language, usageCount, userId, createdAt'
    })
  }
}

export const db = new ProclamaDB()

