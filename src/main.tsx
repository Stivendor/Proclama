import { ViteReactSSG } from 'vite-react-ssg/single-page'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

export const createRoot = ViteReactSSG(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
