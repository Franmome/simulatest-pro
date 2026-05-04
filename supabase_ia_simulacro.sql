-- ============================================================
-- MIGRACIÓN: Simulacros personales generados por IA
-- Ejecutar en el SQL Editor de Supabase Dashboard.
-- ============================================================

-- Tabla de simulacros personales generados por IA
-- Cada fila es un banco de preguntas generado para un usuario específico.
-- RLS garantiza que cada usuario solo ve los suyos.
CREATE TABLE IF NOT EXISTS user_simulacros (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evaluacion_id  BIGINT REFERENCES evaluations(id) ON DELETE SET NULL,
  cargo          TEXT,
  preguntas      JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_simulacros_user_idx
  ON user_simulacros (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_simulacros_eval_cargo_idx
  ON user_simulacros (evaluacion_id, cargo);

-- RLS: cada usuario solo accede a sus propios simulacros
ALTER TABLE user_simulacros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_simulacros" ON user_simulacros
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
