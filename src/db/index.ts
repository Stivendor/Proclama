import Dexie, { Table } from 'dexie'
import type { Song, Setlist, AppSettings } from '@/types'

export class ProclamaDB extends Dexie {
  songs!: Table<Song>
  setlists!: Table<Setlist>
  settings!: Table<AppSettings & { id: number }>

  constructor() {
    super('ProclamaDB')
    this.version(2).stores({
      songs:    '++id, churchId, title, artist, language, usageCount, createdAt',
      setlists: '++id, churchId, name, date, createdAt',
      settings: '++id, churchId'
    })
  }
}

export const db = new ProclamaDB()

