-- ============================================================
-- MIGRACIÓN: Integración Gemini IA (Praxia)
-- Ejecutar en el SQL Editor de Supabase Dashboard.
-- ============================================================

-- 1. Agregar columna has_ai_chat a packages
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS has_ai_chat BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Crear tabla de caché de bancos de preguntas generados por IA
CREATE TABLE IF NOT EXISTS bancos_preguntas (
  id             BIGSERIAL PRIMARY KEY,
  pdf_hash       TEXT NOT NULL,
  evaluacion_id  BIGINT REFERENCES evaluations(id) ON DELETE CASCADE,
  nivel_id       BIGINT REFERENCES levels(id) ON DELETE SET NULL,
  cargo          TEXT,
  preguntas      JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para lookup por hash + evaluación (usado en caché)
CREATE UNIQUE INDEX IF NOT EXISTS bancos_preguntas_hash_eval_idx
  ON bancos_preguntas (pdf_hash, evaluacion_id);

-- Índice adicional para búsqueda solo por hash
CREATE INDEX IF NOT EXISTS bancos_preguntas_hash_idx
  ON bancos_preguntas (pdf_hash);

-- 3. Row Level Security (bancos solo accesibles por el backend con service key)
ALTER TABLE bancos_preguntas ENABLE ROW LEVEL SECURITY;

-- Permitir todo al service role (backend usa SUPABASE_SERVICE_KEY)
CREATE POLICY "service_full_access" ON bancos_preguntas
  FOR ALL USING (TRUE) WITH CHECK (TRUE);
