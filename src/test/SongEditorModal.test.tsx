import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SongEditorModal from '@/components/SongEditorModal'
import { createSong, deleteSong, updateSong } from '@/services/supabase'
import { db } from '@/db'

const closeEditor = vi.fn()
let editingSong: any = null

vi.mock('@/db', () => ({
  db: {
    songs: {
      add: vi.fn().mockResolvedValue(77),
      put: vi.fn().mockResolvedValue(77),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

vi.mock('@/hooks/usePlan', () => ({
  usePlan: () => ({ canSync: true }),
}))

vi.mock('@/stores', () => ({
  useAppStore: (selector: any) =>
    selector({
      isEditorOpen: true,
      closeEditor,
      editingSong,
      user: { id: 'user-1' },
      userRole: 'user',
    }),
}))

vi.mock('@/services/supabase', () => ({
  createSong: vi.fn().mockResolvedValue(null),
  updateSong: vi.fn().mockResolvedValue(null),
  deleteSong: vi.fn().mockResolvedValue(true),
}))

describe('SongEditorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    editingSong = null
  })

  it('cierra despues de guardar localmente una cancion nueva aunque Supabase tarde', async () => {
    vi.mocked(createSong).mockReturnValue(new Promise(() => {}) as any)

    render(<SongEditorModal />)

    fireEvent.change(screen.getByPlaceholderText(/titulo|título/i), {
      target: { value: 'Gracia Sublime' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => {
      expect(db.songs.add).toHaveBeenCalled()
      expect(createSong).toHaveBeenCalled()
      expect(closeEditor).toHaveBeenCalled()
    })
  })

  it('cierra despues de guardar localmente una edicion aunque Supabase tarde', async () => {
    editingSong = {
      id: 12,
      remoteId: 99,
      userId: 'user-1',
      title: 'Santo',
      artist: '',
      lyrics: '',
      key: '',
      tags: [],
      language: 'Espanol',
      usageCount: 0,
      isPublic: true,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(updateSong).mockReturnValue(new Promise(() => {}) as any)

    render(<SongEditorModal />)

    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => {
      expect(db.songs.update).toHaveBeenCalledWith(12, expect.objectContaining({
        title: 'Santo',
        remoteId: 99,
        isPublic: true,
        isVerified: false,
      }))
      expect(updateSong).toHaveBeenCalled()
      expect(closeEditor).toHaveBeenCalled()
    })
  })

  it('elimina canciones solo localmente', async () => {
    editingSong = {
      id: 12,
      remoteId: 99,
      userId: 'user-1',
      title: 'Santo',
      artist: '',
      lyrics: '',
      key: '',
      tags: [],
      language: 'Espanol',
      usageCount: 0,
      isPublic: true,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<SongEditorModal />)

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }))

    await waitFor(() => {
      expect(db.songs.delete).toHaveBeenCalledWith(12)
      expect(deleteSong).toHaveBeenCalledWith(99)
      expect(closeEditor).toHaveBeenCalled()
    })
  })
})
