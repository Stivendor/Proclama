-- Índice único en backgrounds.url: permite que los seeds de catálogo
-- (imágenes/videos de Pexels) sean idempotentes con ON CONFLICT (url) DO NOTHING.
create unique index if not exists backgrounds_url_key on public.backgrounds(url);
