# 🎵 Proclama

Sistema profesional de proyección de alabanzas y Biblia para iglesias.  
Inspirado por soluciones como HolyLyrics y EasyWorship, pero diseñado para ser moderno, ligero, gratuito y funcionar directamente en el navegador con sincronización en la nube.

---

## ✨ Características Pro

### 🔐 Cuentas y Seguridad (Supabase Auth)
- **Acceso Privado:** Sistema de inicio de sesión seguro para gestionar tu biblioteca.
- **Permisos de Escritura:** Solo usuarios autenticados pueden añadir, editar o borrar canciones.
- **Listas Personales:** Tus Setlists y Ajustes se guardan de forma privada vinculados a tu cuenta.

### 🎬 Fondos Dinámicos (Motion Backgrounds)
- **Soporte de Video:** Proyecta letras sobre videos en bucle (MP4) para una estética moderna.
- **Gradientes e Imágenes:** Cambia instantáneamente entre colores sólidos, imágenes de fondo o videos cinematográficos.
- **Ajustes en Vivo:** Controla la tipografía, sombras y colores directamente desde el panel de ajustes.

### 🖼️ Anuncios y Galería de Media Local
- **Proyección Efímera:** Carga imágenes o videos para anuncios temporales sin llenar tu base de datos cloud.
- **Galería Integrada:** Panel lateral para gestionar múltiples archivos de media listos para proyectar con un clic.
- **Privacidad Total:** Los archivos locales solo existen en tu sesión, garantizando rapidez y seguridad.

### 📚 Biblioteca de Alabanzas Avanzada
- **Búsqueda Online (Genius API):** Encuentra e importa letras de internet directamente a tu base de datos local.
- **Búsqueda Inteligente (FTS):** Motor de búsqueda potente que busca dentro de toda la letra de las canciones.
- **Importación Masiva:** Soporta miles de canciones (incluye base de ~3000 temas cristianos).

### 📖 Biblia Integrada (Omni-Search)
- **Búsqueda Unificada:** Encuentra pasajes por texto, libro o referencia directa (*Juan 3:16*).
- **Navegación Fluida:** Salto automático al capítulo correspondiente al buscar un versículo.
- **Proyección Directa:** Un solo clic envía la Palabra al proyector.

---

## 🎛️ Control de Proyección

- **Ventana Independiente:** Abre una ventana secundaria optimizada para proyectores o TVs.
- **Comandos Especiales:** Accesos rápidos para Pantalla Negra (B) y Logo de la Iglesia.
- **Capas Inteligentes:** Sistema de Z-index que maneja Video > Texto > Logo > Negro de forma fluida.

---

## 🚀 Instalación y Configuración

### 1. Clona e Instala
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

---

## 🎹 Atajos de Teclado (Live)

| Tecla | Acción |
|-------|--------|
| `→` / `↓` / `Espacio` | Siguiente estrofa / Versículo |
| `←` / `↑` | Estrofa anterior / Versículo anterior |
| `B` | Activa/Desactiva Pantalla Negra |
| `Esc` | Cierra modales o quita el modo negro |

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React 18, Vite, TypeScript, Lucide React.
- **Autenticación:** Supabase Auth.
- **Base de Datos:** Supabase (Cloud) + Dexie (Offline Persistence).
- **Comunicación:** BroadcastChannel API.
- **Estilos:** Vanilla CSS con personalización de Scrollbars Premium.
- **PWA:** Instalable en PC/Tablet para uso sin navegador visible.

---

## ✝️ Propósito

Proclama ha sido creado para facilitar el servicio de proyección en las iglesias, eliminando barreras de costos y ofreciendo una herramienta profesional de código abierto.

**Hecho con amor para el Reino de Dios.**
