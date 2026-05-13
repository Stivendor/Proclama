-- Complementos para attendance_records
-- Índice compuesto para consultas por usuario + fecha (el patrón de query más común)
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date
  ON public.attendance_records (user_id, date);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_records_updated_at
  ON public.attendance_records;
CREATE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
