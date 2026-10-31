/// <reference types="vite/client" />

interface Window {
  /** Lo fija el script inline de index.html: true si el HTML prerenderizado de la landing se conserva. */
  __SSR_LANDING__?: boolean
}
