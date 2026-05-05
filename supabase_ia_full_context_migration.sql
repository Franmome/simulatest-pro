-- ============================================================
-- SimulaTest Pro — Migración: Contexto IA Completo
-- Objetivo: capturar absolutamente todo lo que hace el usuario
-- para que la IA pueda analizarlo y dar retroalimentación real.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

-- ── 1. Enriquecer user_simulacros ────────────────────────────
-- Guardar configuración del simulacro y resultado final

ALTER TABLE user_simulacros
  ADD COLUMN IF NOT EXISTS cantidad_preguntas    INT,
  ADD COLUMN IF NOT EXISTS tiempo_por_pregunta   INT,         -- segundos por pregunta, NULL = sin límite
  ADD COLUMN IF NOT EXISTS dificultad_config     TEXT,        -- 'mixta' | 'facil' | 'medio' | 'dificil'
  ADD COLUMN IF NOT EXISTS score_correctas       INT,
  ADD COLUMN IF NOT EXISTS score_total           INT,
  ADD COLUMN IF NOT EXISTS score_pct             NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS tiempo_total_segundos INT,
  ADD COLUMN IF NOT EXISTS completado            BOOLEAN DEFAULT FALSE;

-- ── 2. Enriquecer user_simulacro_answers ─────────────────────
-- Guardar contexto completo de cada pregunta para que la IA
-- pueda decirle al usuario EXACTAMENTE por qué falló

ALTER TABLE user_simulacro_answers
  ADD COLUMN IF NOT EXISTS enunciado        TEXT,
  ADD COLUMN IF NOT EXISTS opcion_elegida   CHAR(1),          -- A, B o C (lo que marcó el usuario)
  ADD COLUMN IF NOT EXISTS opcion_correcta  CHAR(1),          -- A, B o C (la respuesta correcta)
  ADD COLUMN IF NOT EXISTS explicacion      TEXT,             -- explicación de la pregunta
  ADD COLUMN IF NOT EXISTS tiempo_segundos  INT;              -- tiempo que tardó en responder

-- ── 3. Tabla: vistas de material de estudio ──────────────────
-- Registra qué materiales consultó el usuario y cuánto tiempo

CREATE TABLE IF NOT EXISTS user_material_views (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  evaluacion_id   INT,
  material_id     BIGINT,                                     -- FK referencia al material
  material_nombre TEXT,
  material_tipo   TEXT,                                       -- 'pdf' | 'video' | 'link' | 'doc'
  segundos_visto  INT     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Tabla: respuestas por pregunta en salas ───────────────
-- Actualmente solo guardamos score final; ahora guardamos cada respuesta

CREATE TABLE IF NOT EXISTS user_sala_answers (
  id              BIGSERIAL PRIMARY KEY,
  sala_codigo     TEXT NOT NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pregunta_idx    INT  NOT NULL,
  area            TEXT,
  dificultad      TEXT,
  enunciado       TEXT,
  opcion_elegida  CHAR(1),
  opcion_correcta CHAR(1),
  es_correcta     BOOLEAN NOT NULL,
  tiempo_segundos INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Vistas para el contexto IA ────────────────────────────

-- Vista: estadísticas por área (simulacros + salas combinados)
CREATE OR REPLACE VIEW user_area_stats AS
SELECT
  user_id,
  area,
  COUNT(*)                                                              AS total_preguntas,
  SUM(CASE WHEN es_correcta THEN 1 ELSE 0 END)                         AS total_correctas,
  ROUND(
    100.0 * SUM(CASE WHEN es_correcta THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1
  )                                                                     AS pct_correcto,
  ROUND(AVG(tiempo_segundos) FILTER (WHERE tiempo_segundos IS NOT NULL), 0)
                                                                        AS avg_segundos,
  MAX(created_at)                                                       AS ultima_practica
FROM (
  SELECT user_id, area, es_correcta, tiempo_segundos, created_at
  FROM user_simulacro_answers
  UNION ALL
  SELECT user_id, area, es_correcta, tiempo_segundos, created_at
  FROM user_sala_answers
) combinado
WHERE area IS NOT NULL
GROUP BY user_id, area;

-- Vista: últimas respuestas incorrectas con contexto (para retroalimentación IA)
CREATE OR REPLACE VIEW user_respuestas_incorrectas AS
SELECT
  user_id,
  area,
  enunciado,
  opcion_elegida,
  opcion_correcta,
  explicacion,
  tiempo_segundos,
  created_at
FROM user_simulacro_answers
WHERE es_correcta = FALSE
  AND enunciado   IS NOT NULL
ORDER BY created_at DESC;

-- Vista: resumen global por usuario (para admin y contexto rápido IA)
CREATE OR REPLACE VIEW user_ia_resumen AS
SELECT
  u.id AS user_id,
  COUNT(DISTINCT s.id)                                                  AS total_simulacros,
  ROUND(AVG(s.score_pct) FILTER (WHERE s.score_pct IS NOT NULL), 1)    AS avg_score_pct,
  MAX(s.created_at)                                                     AS ultimo_simulacro,
  COUNT(sa.id)                                                          AS total_respuestas,
  SUM(CASE WHEN sa.es_correcta THEN 1 ELSE 0 END)                      AS total_correctas,
  COUNT(DISTINCT rp.room_id)                                            AS salas_jugadas,
  COUNT(DISTINCT mv.id)                                                 AS materiales_vistos
FROM auth.users u
LEFT JOIN user_simulacros          s  ON s.user_id  = u.id
LEFT JOIN user_simulacro_answers   sa ON sa.user_id = u.id
LEFT JOIN room_participants        rp ON rp.user_id = u.id
LEFT JOIN user_material_views      mv ON mv.user_id = u.id
GROUP BY u.id;

-- ── 6. Función RPC: completar simulacro ──────────────────────
-- El frontend llama esto al terminar un simulacro para guardar el score final

CREATE OR REPLACE FUNCTION completar_simulacro(
  p_simulacro_id   BIGINT,
  p_user_id        UUID,
  p_correctas      INT,
  p_total          INT,
  p_tiempo_segundos INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_simulacros
  SET
    score_correctas       = p_correctas,
    score_total           = p_total,
    score_pct             = ROUND(100.0 * p_correctas / NULLIF(p_total, 0), 2),
    tiempo_total_segundos = p_tiempo_segundos,
    completado            = TRUE
  WHERE id      = p_simulacro_id
    AND user_id = p_user_id;
END;
$$;

-- ── 7. Índices de rendimiento ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sim_answers_user_date
  ON user_simulacro_answers(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sim_answers_area
  ON user_simulacro_answers(user_id, area, es_correcta);

CREATE INDEX IF NOT EXISTS idx_sala_answers_user_date
  ON user_sala_answers(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sala_answers_area
  ON user_sala_answers(user_id, area, es_correcta);

CREATE INDEX IF NOT EXISTS idx_material_views_user
  ON user_material_views(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulacros_score
  ON user_simulacros(user_id, score_pct, created_at DESC);

-- ── 8. RLS (Row Level Security) ───────────────────────────────

ALTER TABLE user_material_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sala_answers   ENABLE ROW LEVEL SECURITY;

-- Usuarios solo ven sus propios datos
CREATE POLICY "own_material_views" ON user_material_views
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "own_sala_answers" ON user_sala_answers
  FOR ALL USING (auth.uid() = user_id);

-- Service role (backend) accede a todo
CREATE POLICY "service_material_views" ON user_material_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_sala_answers" ON user_sala_answers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 9. Vista admin ────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_user_activity AS
SELECT
  u.email,
  r.total_simulacros,
  r.avg_score_pct,
  r.ultimo_simulacro,
  r.total_respuestas,
  r.total_correctas,
  r.salas_jugadas,
  r.materiales_vistos
FROM auth.users u
JOIN user_ia_resumen r ON r.user_id = u.id
ORDER BY r.ultimo_simulacro DESC NULLS LAST;
