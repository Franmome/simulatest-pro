-- ============================================================
--  MIGRACIÓN: Agregar "proceso" y "funciones" a opec_maestro
--  Ejecutar en: Supabase → SQL Editor
-- ============================================================

ALTER TABLE public.opec_maestro
  ADD COLUMN IF NOT EXISTS proceso   text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS funciones text[]        DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_opec_proceso ON public.opec_maestro (proceso);
