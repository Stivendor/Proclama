import Dexie, { Table } from 'dexie'
import type { Song, Setlist, AppSettings } from '@/types'

export class ProclamaDB extends Dexie {
  songs!: Table<Song>
  setlists!: Table<Setlist>
  settings!: Table<AppSettings & { id: number }>

  constructor() {
    super('ProclamaDB')
    this.version(3).stores({
      songs:    '++id, title, artist, language, usageCount, createdAt',
      setlists: '++id, name, date, createdAt',
      settings: '++id'
    })
  }
}

export const db = new ProclamaDB()

