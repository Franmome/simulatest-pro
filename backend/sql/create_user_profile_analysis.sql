-- Tabla para guardar los análisis de perfil de cada usuario
-- Ejecutar en: Supabase → SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.user_profile_analysis (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  convocatoria_id     bigint REFERENCES public.convocatorias(id) ON DELETE SET NULL,
  convocatoria_nombre text,
  analisis            jsonb,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_profile_convocatoria UNIQUE (user_id, convocatoria_id)
);

CREATE INDEX IF NOT EXISTS idx_upa_user ON public.user_profile_analysis (user_id);

ALTER TABLE public.user_profile_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own analysis"
  ON public.user_profile_analysis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own analysis"
  ON public.user_profile_analysis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own analysis"
  ON public.user_profile_analysis FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own analysis"
  ON public.user_profile_analysis FOR DELETE
  USING (auth.uid() = user_id);
