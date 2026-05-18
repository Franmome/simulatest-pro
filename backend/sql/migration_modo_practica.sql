-- ============================================================
--  MIGRACIÓN: Columna simulacro_origen_id en user_simulacros
--  Ejecutar en: Supabase → SQL Editor
-- ============================================================

ALTER TABLE public.user_simulacros
  ADD COLUMN IF NOT EXISTS simulacro_origen_id bigint
    REFERENCES public.user_simulacros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_simulacros_origen ON public.user_simulacros (simulacro_origen_id);
