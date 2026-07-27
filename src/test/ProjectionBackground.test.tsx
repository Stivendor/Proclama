import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProjectionBackground from '@/components/projection/ProjectionBackground'
import { DEFAULT_THEME } from '@/stores'

const theme = { ...DEFAULT_THEME }

describe('ProjectionBackground', () => {
  it('no dibuja capa media cuando media es null', () => {
    const { queryByTestId } = render(<ProjectionBackground theme={theme} media={null} variant="preview" />)
    expect(queryByTestId('media-layer')).toBeNull()
  })

  it('media en background mode va detrás del texto (zIndex 2, objectFit fill)', () => {
    const media = { url: 'blob:x', type: 'image', isBackgroundMode: true, name: 'x' } as any
    const { getByTestId, container } = render(<ProjectionBackground theme={theme} media={media} variant="preview" />)
    expect(getByTestId('media-layer').style.zIndex).toBe('2')
    expect(container.querySelector('img')?.style.objectFit).toBe('fill')
  })

  it('anuncio pantalla completa va sobre el texto (zIndex 20, objectFit contain)', () => {
    const media = { url: 'blob:x', type: 'image', isBackgroundMode: false, name: 'x' } as any
    const { getByTestId, container } = render(<ProjectionBackground theme={theme} media={media} variant="preview" />)
    expect(getByTestId('media-layer').style.zIndex).toBe('20')
    expect(container.querySelector('img')?.style.objectFit).toBe('contain')
  })

  it('fondo de video: el preview usa la miniatura y no descarga el MP4', () => {
    const videoTheme = { ...theme, backgroundType: 'video', backgroundVideoUrl: 'https://cdn/v.mp4', backgroundThumbnail: 'https://cdn/v.jpg' } as any
    const prev = render(<ProjectionBackground theme={videoTheme} media={null} variant="preview" />)
    expect(prev.container.querySelector('video')).toBeNull()
    expect(prev.container.querySelector('img')?.getAttribute('src')).toBe('https://cdn/v.jpg')

    const live = render(<ProjectionBackground theme={videoTheme} media={null} variant="live" ytPlayerRef={{ current: null }} />)
    expect(live.container.querySelector('video')?.getAttribute('src')).toBe('https://cdn/v.mp4')
  })

  it('fondo de video sin miniatura: el preview cae al video', () => {
    const videoTheme = { ...theme, backgroundType: 'video', backgroundVideoUrl: 'https://cdn/v.mp4' } as any
    const { container } = render(<ProjectionBackground theme={videoTheme} media={null} variant="preview" />)
    expect(container.querySelector('video')?.getAttribute('src')).toBe('https://cdn/v.mp4')
  })

  it('video de anuncio: muted en preview, con audio en live', () => {
    const media = { url: 'blob:v', type: 'video', isBackgroundMode: false, name: 'v' } as any
    const prev = render(<ProjectionBackground theme={theme} media={media} variant="preview" />)
    expect(prev.container.querySelector('video')?.muted).toBe(true)
    const live = render(<ProjectionBackground theme={theme} media={media} variant="live" ytPlayerRef={{ current: null }} />)
    expect(live.container.querySelector('video')?.muted).toBe(false)
  })
})
