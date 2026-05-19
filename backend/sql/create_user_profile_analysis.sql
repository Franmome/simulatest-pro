-- Tabla para guardar análisis de perfil de candidatos
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.user_profile_analysis (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  convocatoria_id     bigint REFERENCES public.convocatorias(id) ON DELETE SET NULL,
  convocatoria_nombre text,
  analisis            jsonb,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_profile_convocatoria UNIQUE (user_id, convocatoria_id)
);

-- Índice para consultas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_user_profile_analysis_user_id
  ON public.user_profile_analysis (user_id, updated_at DESC);

-- RLS: cada usuario solo ve y gestiona sus propios análisis
ALTER TABLE public.user_profile_analysis ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profile_analysis' AND policyname = 'own_analyses_select'
  ) THEN
    CREATE POLICY own_analyses_select ON public.user_profile_analysis
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profile_analysis' AND policyname = 'own_analyses_insert'
  ) THEN
    CREATE POLICY own_analyses_insert ON public.user_profile_analysis
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profile_analysis' AND policyname = 'own_analyses_update'
  ) THEN
    CREATE POLICY own_analyses_update ON public.user_profile_analysis
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profile_analysis' AND policyname = 'own_analyses_delete'
  ) THEN
    CREATE POLICY own_analyses_delete ON public.user_profile_analysis
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
