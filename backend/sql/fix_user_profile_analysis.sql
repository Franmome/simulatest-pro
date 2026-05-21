-- Migración: arreglar tabla user_profile_analysis
-- Ejecutar en: Supabase → SQL Editor → Run
-- Seguro de ejecutar aunque la tabla ya exista

-- 1. Crear tabla con estructura completa (si no existe)
CREATE TABLE IF NOT EXISTS public.user_profile_analysis (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  convocatoria_id     bigint,
  convocatoria_nombre text,
  analisis            jsonb,
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT uq_user_profile_analysis UNIQUE (user_id, convocatoria_id)
);

-- 2. Agregar columnas faltantes si la tabla ya existía (idempotente)
ALTER TABLE public.user_profile_analysis
  ADD COLUMN IF NOT EXISTS convocatoria_nombre text,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz DEFAULT now();

-- 3. Índice
CREATE INDEX IF NOT EXISTS idx_upa_user ON public.user_profile_analysis (user_id);

-- 4. RLS
ALTER TABLE public.user_profile_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own profile analysis"    ON public.user_profile_analysis;
DROP POLICY IF EXISTS "users insert own profile analysis" ON public.user_profile_analysis;
DROP POLICY IF EXISTS "users update own profile analysis" ON public.user_profile_analysis;
DROP POLICY IF EXISTS "users delete own profile analysis" ON public.user_profile_analysis;

CREATE POLICY "users see own profile analysis"
  ON public.user_profile_analysis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own profile analysis"
  ON public.user_profile_analysis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own profile analysis"
  ON public.user_profile_analysis FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own profile analysis"
  ON public.user_profile_analysis FOR DELETE
  USING (auth.uid() = user_id);
