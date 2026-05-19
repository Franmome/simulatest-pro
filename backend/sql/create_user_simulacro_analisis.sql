-- Tabla independiente para guardar el análisis IA de cada simulacro completado
-- Ejecutar en: Supabase → SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.user_simulacro_analisis (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulacro_id       bigint REFERENCES public.user_simulacros(id) ON DELETE SET NULL,
  evaluacion_id      bigint REFERENCES public.evaluations(id) ON DELETE SET NULL,
  cargo              text,
  score_pct          float,
  score_correctas    int,
  score_total        int,
  analisis           jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_simulacro_analisis UNIQUE (simulacro_id)
);

CREATE INDEX IF NOT EXISTS idx_usa_user ON public.user_simulacro_analisis (user_id);
CREATE INDEX IF NOT EXISTS idx_usa_simulacro ON public.user_simulacro_analisis (simulacro_id);

ALTER TABLE public.user_simulacro_analisis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own simulacro analisis"
  ON public.user_simulacro_analisis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own simulacro analisis"
  ON public.user_simulacro_analisis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own simulacro analisis"
  ON public.user_simulacro_analisis FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own simulacro analisis"
  ON public.user_simulacro_analisis FOR DELETE
  USING (auth.uid() = user_id);
