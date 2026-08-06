-- premium_interest: guardar QUÉ función disparó el interés.
--
-- Hasta ahora la tabla sólo decía "este correo levantó la mano", y el unique por
-- email dejaba una sola fila por persona. Lo que necesitamos medir es distinto:
-- cuál de las funciones Pro mueve a la gente, y por eso una misma persona debe
-- poder levantar la mano por varias.
--
-- La tabla está vacía en producción (0 filas al 2026-08-06), así que el default
-- no reescribe historia de nadie.

ALTER TABLE public.premium_interest
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'landing';

-- Una fila por (correo, función): repetir el mismo botón sigue chocando contra
-- el unique y el cliente lo trata como "ya registrado".
-- El unique viejo llegó como CONSTRAINT, así que hay que soltarlo por ahí: su
-- índice no se puede borrar directamente mientras la constraint lo sostenga.
ALTER TABLE public.premium_interest
  DROP CONSTRAINT IF EXISTS premium_interest_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS premium_interest_email_source_key
  ON public.premium_interest (email, source);

CREATE INDEX IF NOT EXISTS premium_interest_source_idx
  ON public.premium_interest (source);
