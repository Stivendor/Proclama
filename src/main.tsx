import { ViteReactSSG } from 'vite-react-ssg/single-page'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

const isSSR = typeof window === 'undefined'

export const createRoot = ViteReactSSG(
  isSSR ? (
    <MemoryRouter>
      <App />
    </MemoryRouter>
  ) : (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
)
