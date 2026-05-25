-- Agrega campos de plataforma de inscripción a convocatorias
ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS plataforma_nombre TEXT,
  ADD COLUMN IF NOT EXISTS plataforma_url    TEXT;
