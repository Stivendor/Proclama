import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ReportSongModal from '@/components/ReportSongModal'
import { createSongReport } from '@/services/supabase'

vi.mock('@/services/supabase', () => ({
  createSongReport: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    user: { id: 'store-user-id' },
  }),
  useProjectionStore: (selector: any) =>
    selector({
      state: {
        songId: 42,
        songTitle: 'Santo',
      },
    }),
}))

describe('ReportSongModal', () => {
  it('envia reportes de canciones como anonimos aunque exista un usuario en el store', async () => {
    render(<ReportSongModal isOpen onClose={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: /enviar reporte/i }))

    await waitFor(() => {
      expect(createSongReport).toHaveBeenCalledWith(42, 'lyrics_error', '', null)
    })
  })
})
