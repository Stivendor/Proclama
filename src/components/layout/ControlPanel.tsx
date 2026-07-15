import MediaPanel from '@/components/media/MediaPanel'

// El panel derecho es la galería de fondos y anuncios. Antes mezclaba controles de
// canción (título, ocultar texto) que ya viven en la barra de preview; ahora es
// solo media.
export default function ControlPanel() {
  return <MediaPanel />
}
