# 🎵 Proclama

Sistema de proyección de alabanzas para iglesias.  
Inspirado en HolyLyrics/EasyWorship — pero tuyo, gratis y completamente personalizable.

---

## 🚀 Instalación rápida

### Requisitos
- Node.js 18+ ([descargar](https://nodejs.org))
- Chrome o Edge (para multi-monitor y Web Audio API)

### Pasos

```bash
# 1. Clona o entra a la carpeta del proyecto
cd proclama

# 2. Instala dependencias
npm install

# 3. Configura las variables de entorno
# Crea un archivo .env.local con:
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key

# 4. Inicia el servidor de desarrollo
npm run dev

# 5. Abre en el navegador
# http://localhost:5173
```

---

## ☁️ Base de datos en la nube (Supabase)

Proclama usa **Supabase** como backend para sincronizar canciones, setlists y configuraciones en la nube. Además mantiene una copia local con **Dexie.js (IndexedDB)** para rendimiento y funcionamiento offline.

### Tablas en Supabase
| Tabla | Descripción |
|-------|-------------|
| `songs` | Canciones con título, artista, letra, tonalidad, etiquetas e idioma |
| `setlists` | Listas de canciones organizadas por fecha |
| `setlist_songs` | Relación entre setlists y canciones (con posición) |
| `app_settings` | Configuración de la app (credenciales, tema, nombre de iglesia) |

### Optimización de búsqueda
- Índices `btree` en `title` y `artist` para búsquedas rápidas.
- **Full Text Search** en la columna `lyrics` con soporte para español e insensibilidad a acentos (función `immutable_unaccent`).

---

## ⚙️ Configuración inicial

### 1. ACRCloud (Reconocimiento de audio)

1. Crea cuenta gratis en [acrcloud.com](https://console.acrcloud.com)
2. Crea un proyecto tipo **"Audio & Video Recognition"**
3. Copia el **Host**, **Access Key** y **Access Secret**
4. En Proclama → Ajustes → ACRCloud, pega las credenciales

> **Tier gratuito:** 100 solicitudes/día — suficiente para 5-10 servicios por día.

### 2. Búsqueda de letras online

La búsqueda de letras usa **LRCLIB** — API gratuita sin registro.  
Los resultados priorizan artistas y canciones cristianas conocidas (Hillsong, Miel San Marcos, Marcos Witt, etc.) y permite importar directamente a la biblioteca.

---

## 📖 Biblia integrada

Proclama incluye una **Biblia RVR1960 completa** integrada para proyectar versículos durante el culto:
- Navegación por libro, capítulo y versículo.
- Proyección directa de pasajes bíblicos en el TV/proyector.
- Búsqueda rápida de referencias.

---

## 🎛️ Cómo usar durante el culto

### Preparación (antes del servicio)
1. Crear un **Setlist** con las canciones del día
2. Verificar que las letras estén correctas en la biblioteca
3. Conectar el PC a la consola de audio por USB (opcional, para reconocimiento)
4. Hacer clic en **"Abrir Proyección"** → mover esa ventana al TV/proyector
5. Poner la ventana del proyector en pantalla completa (F11)

### Durante el culto
- **Automático:** Activar reconocimiento → Proclama detecta y proyecta sola
- **Manual:** Clic en cualquier canción de la biblioteca → proyecta inmediatamente
- **Navegar estrofas:** Flechas del teclado ← → o clic en la estrofa
- **Pantalla negra:** Tecla `B` o botón "Negro"
- **Entre canciones:** Usa el Setlist activo para navegar con un clic
- **Biblia:** Navega a la sección de Biblia, selecciona el pasaje y proyecta

---

## 📁 Estructura del proyecto

```
src/
  components/
    ControlPanel.tsx       # Control de slides en el panel derecho
    RecognitionPanel.tsx   # Panel de reconocimiento de audio
    OnlineSearchModal.tsx  # Modal para buscar e importar letras online
    Sidebar.tsx            # Navegación lateral
  hooks/
    useAudioRecognition.ts # Hook de captura + ACRCloud
    useKeyboardShortcuts.ts# Atajos de teclado globales
  pages/
    LibraryView.tsx        # Biblioteca de canciones
    SongEditor.tsx         # Crear/editar canciones
    SetlistsView.tsx       # Gestión de setlists
    SettingsView.tsx       # Configuración general
    BibleView.tsx          # Navegador y proyector de Biblia
    ProjectionWindow.tsx   # Ventana fullscreen para TV/proyector
  services/
    supabase.ts            # Cliente Supabase + CRUD + búsqueda FTS
    acrcloud.ts            # API de reconocimiento de audio
    genius.ts              # API de búsqueda de letras (LRCLIB)
    lyricsParser.ts        # Convertir letras → slides para proyección
    projection.ts          # BroadcastChannel + window.open
    bible.ts               # Servicio de datos bíblicos
  stores/
    index.ts               # Zustand (estado global)
  db/
    index.ts               # Dexie.js (IndexedDB local)
  types/
    index.ts               # TypeScript interfaces y tipos
```

---

## 🔧 Comandos

```bash
npm run dev      # Desarrollo (hot reload)
npm run build    # Build de producción
npm run preview  # Preview del build
```

---

## 🌐 Deploy

La aplicación está configurada para desplegarse en **Vercel**:

```bash
npm run build
# Sube automáticamente con `git push` si tienes Vercel conectado
# O sube la carpeta /dist a cualquier hosting estático
```

El archivo `vercel.json` incluye rewrite rules para SPA routing.

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

| Tecnología | Uso |
|------------|-----|
| **React 18 + TypeScript + Vite** | Frontend |
| **Supabase (PostgreSQL)** | Base de datos en la nube + Full Text Search |
| **Dexie.js (IndexedDB)** | Base de datos local offline |
| **Zustand** | Estado global |
| **@dnd-kit** | Drag & drop en setlists |
| **Web Audio API + ACRCloud** | Reconocimiento de audio |
| **LRCLIB API** | Búsqueda de letras de canciones |
| **BroadcastChannel API** | Comunicación entre ventanas sin servidor |
| **vite-plugin-pwa** | Instalable como app de escritorio |

---

## ✝️ Hecho para la iglesia, con amor.
