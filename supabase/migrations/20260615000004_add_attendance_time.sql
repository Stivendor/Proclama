-- Hora opcional del culto (solo informativa, no parte de la identidad del registro)
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS service_time text;
