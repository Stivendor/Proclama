import { ViteReactSSG } from 'vite-react-ssg/single-page'
import App from './App.tsx'
import './index.css'

export const createRoot = ViteReactSSG(
  <App />
)

if ('serviceWorker' in navigator) {
  // Cuando Vite PWA (autoUpdate) instala un nuevo SW, recarga automáticamente
  // para que el usuario siempre tenga la última versión de la app sin vaciar caché.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
