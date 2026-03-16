# 🎵 Proclama

Sistema profesional de proyección de alabanzas y Biblia para iglesias.  
Inspirado por soluciones como HolyLyrics y EasyWorship, pero diseñado para ser moderno, ligero, gratuito y funcionar directamente en el navegador con sincronización en la nube.

---

## ✨ Características Principales

### 📚 Biblioteca de Alabanzas 
- **Vista de Doble Columna:** Panel izquierdo para búsqueda rápida y panel central para gestión de estrofas en vivo.
- **Proyección Instantánea:** Haz clic en cualquier estrofa para mostrarla inmediatamente en la pantalla secundaria.
- **Búsqueda Inteligente (FTS):** Motor de búsqueda potente que busca no solo por título, sino dentro de toda la letra de las canciones.
- **Base de Datos Masiva:** Soporta miles de canciones (incluye importación base de ~3000 temas cristianos).

### 📖 Biblia Integrada (Omni-Search)
- **Búsqueda Unificada:** Encuentra pasajes por texto (*"En el principio"*), libro (*"Génesis"*) o referencia directa (*"Juan 3:16"*).
- **Navegación con Contexto:** Al buscar un versículo, el lector te lleva automáticamente al capítulo correspondiente para que tengas toda la lectura a mano.
- **Proyección Directa:** Un solo clic en el versículo lo envía al proyector.

### 🎛️ Control de Proyección
- **Ventana Independiente:** Abre una ventana secundaria que puedes mover a tu proyector o TV.
- **Comandos Especiales:** Botones de acceso rápido para Pantalla Negra (B) y Logo de la Iglesia.
- **Personalización Visual:** Ajusta fuentes, colores y fondos desde el panel de ajustes.

### ☁️ Tecnología Híbrida
- **Sincronización Cloud:** Usa **Supabase** para mantener tus canciones y listas de reproducción seguras en la nube.
- **Funcionamiento Offline:** Gracias a **Dexie.js (IndexedDB)**, la aplicación sigue funcionando aunque se pierda el internet durante el culto.
- **Reconocimiento de Audio (Opcional):** Integración con **ACRCloud** para proyectar automáticamente lo que la iglesia está cantando.

---

## 🚀 Instalación y Configuración

### 1. Reclona e Instala
```bash
git clone https://github.com/tu-usuario/proclama.git
cd proclama
npm install
```

### 2. Variables de Entorno
Crea un archivo `.env.local` con tus credenciales de Supabase:
```bash
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

### 3. Inicia el Proyecto
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`.

---

## 🌐 Despliegue (Vercel)

Proclama está listo para ser desplegado en **Vercel** con un solo clic. Asegúrate de configurar las variables de entorno (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) en el panel de control de Vercel para que la base de datos funcione en producción.

---

## 🎹 Atajos de Teclado (Live)

| Tecla | Acción |
|-------|--------|
| `→` / `↓` / `Espacio` | Siguiente estrofa / Versículo |
| `←` / `↑` | Estrofa anterior / Versículo anterior |
| `B` | Activa/Desactiva Pantalla Negra |
| `Esc` | Cierra modales o quita el modo negro |

---

## 📁 Estructura del Proyecto

- `src/pages`: Vistas principales (Biblioteca, Biblia, Editor, Ajustes).
- `src/stores`: Estado global con **Zustand** (Proyección y App).
- `src/services`: Lógica de Supabase, Biblia, Reconocimiento y Proyección.
- `src/data`: Contenido precargado (Biblia RVR1960).
- `src/components`: Componentes reutilizables (Sidebar, Panel de Control, Modales).

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React 18, Vite, TypeScript, Lucide React.
- **Base de Datos:** Supabase (Cloud) + Dexie (Local Persistence).
- **Comunicación:** BroadcastChannel API (Control entre ventanas).
- **Estilos:** Vanilla CSS (Moderno y responsivo).
- **PWA:** vite-plugin-pwa (Instalable en PC/Tablet).

---

## ✝️ Propósito

Este software ha sido creado para facilitar el servicio de proyección en las iglesias de habla hispana, eliminando barreras de costos y ofreciendo una herramienta profesional de código abierto.

**Hecho con amor para el Reino de Dios.**
