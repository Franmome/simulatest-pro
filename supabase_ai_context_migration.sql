-- ============================================================
-- MIGRACIÓN: Sistema de tokens IA + respuestas de simulacros
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Saldo de tokens por usuario por compra (500k por defecto)
CREATE TABLE IF NOT EXISTS user_ai_tokens (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  purchase_id  BIGINT  REFERENCES purchases(id) ON DELETE SET NULL,
  tokens_used  BIGINT  NOT NULL DEFAULT 0,
  tokens_limit BIGINT  NOT NULL DEFAULT 500000,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, purchase_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_tokens_user ON user_ai_tokens(user_id);

ALTER TABLE user_ai_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_tokens_select ON user_ai_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ai_tokens_service ON user_ai_tokens FOR ALL USING (true) WITH CHECK (true);

-- 2. Log de uso por llamada (auditoría y billing)
CREATE TABLE IF NOT EXISTS user_ai_usage_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  purchase_id  BIGINT      REFERENCES purchases(id) ON DELETE SET NULL,
  endpoint     VARCHAR(30) NOT NULL, -- 'chat' | 'simulacro' | 'sala' | 'banco'
  modelo       VARCHAR(20) NOT NULL, -- 'gemini' | 'deepseek'
  tokens_in    INT         NOT NULL DEFAULT 0,
  tokens_out   INT         NOT NULL DEFAULT 0,
  tokens_total INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_log_user    ON user_ai_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_log_date    ON user_ai_usage_log(created_at DESC);

ALTER TABLE user_ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_log_select  ON user_ai_usage_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ai_log_service ON user_ai_usage_log FOR ALL   USING (true) WITH CHECK (true);

-- 3. Respuestas de simulacros IA (para que la IA conozca el historial del usuario)
CREATE TABLE IF NOT EXISTS user_simulacro_answers (
  id            BIGSERIAL PRIMARY KEY,
  simulacro_id  BIGINT      REFERENCES user_simulacros(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pregunta_idx  INT         NOT NULL,
  area          VARCHAR(200),
  dificultad    VARCHAR(20),
  es_correcta   BOOLEAN     NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_answers_user ON user_simulacro_answers(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sim_answers_area ON user_simulacro_answers(user_id, area);

ALTER TABLE user_simulacro_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY sim_answers_own     ON user_simulacro_answers FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY sim_answers_service ON user_simulacro_answers FOR SELECT USING (true);

-- 4. Función atómica para incrementar tokens (evita race conditions)
CREATE OR REPLACE FUNCTION increment_ai_tokens(
  p_user_id    UUID,
  p_purchase_id BIGINT,
  p_tokens     BIGINT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_ai_tokens (user_id, purchase_id, tokens_used)
  VALUES (p_user_id, p_purchase_id, p_tokens)
  ON CONFLICT (user_id, purchase_id) DO UPDATE
  SET tokens_used  = user_ai_tokens.tokens_used + p_tokens,
      updated_at   = NOW();
END;
$$;

-- 5. Vista de uso IA por usuario (para el admin panel)
CREATE OR REPLACE VIEW admin_ai_usage AS
SELECT
  u.email,
  t.user_id,
  t.tokens_used,
  t.tokens_limit,
  ROUND((t.tokens_used::NUMERIC / t.tokens_limit) * 100, 1) AS pct_usado,
  t.updated_at
FROM user_ai_tokens t
JOIN auth.users u ON u.id = t.user_id
ORDER BY t.tokens_used DESC;
