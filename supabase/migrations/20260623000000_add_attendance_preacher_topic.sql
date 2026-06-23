-- Predicador y tema del culto (opcionales, solo informativos; no parte de la identidad del registro)
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS preacher text,
  ADD COLUMN IF NOT EXISTS topic text;
