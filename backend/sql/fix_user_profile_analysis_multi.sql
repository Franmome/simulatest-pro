-- Permite múltiples análisis por usuario (no solo uno por convocatoria)
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar la restricción única para que un usuario pueda tener varios análisis
--    de la misma convocatoria (cada análisis tiene su propio id)
ALTER TABLE user_profile_analysis
  DROP CONSTRAINT IF EXISTS user_profile_analysis_user_id_convocatoria_id_key;

-- 2. Asegurarse de que created_at esté presente (por si la tabla no lo tenía)
ALTER TABLE user_profile_analysis
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3. Índice para consultas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_user_profile_analysis_user_id
  ON user_profile_analysis (user_id, updated_at DESC);
