import Dexie, { Table } from 'dexie'
import type { Song, Setlist, AppSettings, ChurchNote, AttendanceRecord, ImportedBibleReference } from '@/types'

export class ProclamaDB extends Dexie {
  songs!: Table<Song>
  setlists!: Table<Setlist>
  settings!: Table<AppSettings & { id: number }>
  church_notes!: Table<ChurchNote>
  attendance_records!: Table<AttendanceRecord>
  imported_bibles!: Table<ImportedBibleReference>
  bible_books_cache!: Table<{ bibleId: string; books: any[] }>
  bible_chapters_cache!: Table<{ bibleId: string; bookId: string; chapterId: string; verses: any[] }>
  local_media!: Table<{ id: string; name: string; type: 'image' | 'video'; size: number; createdAt: number; file: Blob }>


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
    this.version(6).stores({
      attendance_records: '++id, date, userId, [date+userId], remoteId'
    })
    this.version(7).stores({
      imported_bibles: 'id, name, languageId, importedAt',
      bible_books_cache: 'bibleId',
      bible_chapters_cache: '[bibleId+bookId+chapterId], bibleId, bookId'
    })
    this.version(8).stores({
      local_media: 'id, name, type, createdAt'
    })
  }
}

export const db = new ProclamaDB()

