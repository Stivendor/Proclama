import { useEffect } from 'react'

const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Outfit:wght@400;700;900&family=Rubik:wght@400;700;900&family=Lexend:wght@400;700;900&family=Kanit:wght@400;700;900&family=Urbanist:wght@400;700;900&family=Nunito:wght@400;700;900&family=Inter:wght@400;700;900&family=Playfair+Display:wght@400;700;900&family=Lora:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;700&display=swap'

const FONTS_PRECONNECT = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]

interface FontLoaderProps {
  children?: React.ReactNode
}

export default function FontLoader({ children }: FontLoaderProps) {
  useEffect(() => {
    // Add preconnect hints
    FONTS_PRECONNECT.forEach(href => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link')
        link.rel = 'preconnect'
        link.href = href
        link.crossOrigin = 'anonymous'
        document.head.appendChild(link)
      }
    })

    // Add fonts stylesheet
    if (!document.querySelector(`link[href="${FONTS_URL}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONTS_URL
      document.head.appendChild(link)
    }
  }, [])

  return <>{children}</>
}

export { FONTS_URL, FONTS_PRECONNECT }
