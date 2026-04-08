-- Crear tabla church_notes para Proclama
CREATE TABLE IF NOT EXISTS public.church_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    attendance JSONB,
    notices JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.church_notes ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view their own church notes" ON public.church_notes
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own church notes" ON public.church_notes
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own church notes" ON public.church_notes
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own church notes" ON public.church_notes
    FOR DELETE USING (auth.uid()::text = user_id);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_church_notes_user_date ON public.church_notes(user_id, date);
CREATE INDEX IF NOT EXISTS idx_church_notes_date ON public.church_notes(date);