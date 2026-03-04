# 🎵 Proclama

Sistema de reconocimiento y proyección de alabanzas para iglesias.  
Inspirado en HolyLyrics/EasyWorship — pero tuyo, gratis y completamente personalizable.

---

## 🚀 Instalación rápida

### Requisitos
- Node.js 18+ ([descargar](https://nodejs.org))
- Chrome o Edge (para multi-monitor y Web Audio API)

### Pasos

```bash
# 1. Entra a la carpeta del proyecto
cd proclama

# 2. Instala dependencias
npm install

# 3. Inicia el servidor de desarrollo
npm run dev

# 4. Abre en el navegador
# http://localhost:5173
```

---

## ⚙️ Configuración inicial

### 1. ACRCloud (Reconocimiento de audio)

1. Crea cuenta gratis en [acrcloud.com](https://console.acrcloud.com)
2. Crea un proyecto tipo **"Audio & Video Recognition"**
3. Copia el **Host**, **Access Key** y **Access Secret**
4. En Proclama → Ajustes → ACRCloud, pega las credenciales

> **Tier gratuito:** 100 solicitudes/día — suficiente para 5-10 servicios por día.
> Con tu Behringer X32 conectada por USB, obtendrás señal limpia y alta precisión.

### 2. Letras online (sin configuración)

La búsqueda de letras usa **lyrics.ovh** — API gratuita sin registro.  
Opcionalmente puedes agregar un token de Genius para mejores resultados.

---

## 🎛️ Cómo usar durante el culto

### Preparación (antes del servicio)
1. Crear un **Setlist** con las canciones del día
2. Verificar que las letras estén correctas en la biblioteca
3. Conectar el PC a la consola X32 por USB
4. Hacer clic en **"Abrir Proyección"** → mover esa ventana al TV/proyector
5. Poner la ventana del proyector en pantalla completa (F11)

### Durante el culto
- **Automático:** Activar reconocimiento → Proclama detecta y proyecta solo
- **Manual:** Clic en cualquier canción de la biblioteca → proyecta inmediatamente
- **Navegar estrofas:** Flechas del teclado ← → o clic en la estrofa
- **Pantalla negra:** Tecla `B` o botón "Negro"
- **Entre canciones:** Usa el Setlist activo para navegar con un clic

---

## 📁 Estructura del proyecto

```
src/
  components/       # Componentes reutilizables
    ControlPanel    # Control de slides en el panel derecho
    RecognitionPanel# Panel de reconocimiento de audio
    OnlineSearchModal# Modal para buscar letras online
    Sidebar         # Navegación lateral
  hooks/
    useAudioRecognition  # Hook de captura + ACRCloud
    useKeyboardShortcuts # Atajos de teclado
  pages/
    LibraryView     # Biblioteca de canciones
    SongEditor      # Crear/editar canciones
    SetlistsView    # Gestión de setlists
    SettingsView    # Configuración
    ProjectionWindow# Ventana fullscreen para TV/proyector
  services/
    acrcloud.ts     # API de reconocimiento de audio
    genius.ts       # API de letras online
    lyricsParser.ts # Convertir letras → slides
    projection.ts   # BroadcastChannel + window.open
  stores/
    index.ts        # Zustand (estado global)
  db/
    index.ts        # Dexie.js (IndexedDB)
  types/
    index.ts        # TypeScript types
```

---

## 🔧 Comandos

```bash
npm run dev      # Desarrollo (hot reload)
npm run build    # Build de producción
npm run preview  # Preview del build
```

---

## 🌐 Deploy (opcional)

Para usar desde cualquier PC de la iglesia sin instalar nada:

```bash
npm run build
# Sube la carpeta /dist a Netlify, Vercel, o cualquier hosting estático
```

---

## 🎹 Atajos de teclado

| Tecla | Acción |
|-------|--------|
| → / ↓ / Espacio | Siguiente estrofa |
| ← / ↑ | Estrofa anterior |
| `B` | Pantalla negra / mostrar |
| `Escape` | Quitar pantalla negra |

---

## 📦 Tecnologías

- **React 18 + TypeScript + Vite** — Frontend
- **Dexie.js (IndexedDB)** — Base de datos local offline
- **Zustand** — Estado global
- **@dnd-kit** — Drag & drop en setlists
- **Web Audio API + ACRCloud** — Reconocimiento de audio
- **BroadcastChannel API** — Comunicación entre ventanas sin servidor
- **vite-plugin-pwa** — Instalable como app de escritorio

---

## ✝️ Hecho para la iglesia, con amor.
