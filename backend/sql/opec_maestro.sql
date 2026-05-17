-- ============================================================
--  SIMULATEST PRO — Convocatorias OPEC
--  Ejecutar en: Supabase → SQL Editor (todo de una sola vez)
-- ============================================================

-- ── 0. Limpieza de versiones anteriores ─────────────────────
DROP TABLE IF EXISTS public.opec_maestro      CASCADE;
DROP TABLE IF EXISTS public.procuraduria_opecs CASCADE;
DROP TABLE IF EXISTS public.convocatorias      CASCADE;


-- ============================================================
--  TABLA 1: convocatorias
--  Un registro por concurso de selección.
--  El usuario elige una convocatoria → el sistema carga todos
--  sus OPECs y la IA analiza el CV contra ellos.
-- ============================================================

CREATE TABLE public.convocatorias (
  id          bigserial    PRIMARY KEY,
  codigo      text         NOT NULL UNIQUE,
  -- ejemplos de codigo: "PGN-2026", "TERRITORIAL-12-2025", "DIAN-2025"

  nombre      text         NOT NULL,
  -- nombre visible en el dropdown del usuario
  -- ej: "Procuraduría General — Nacional 2026"

  entidad     text         NOT NULL,
  -- institución madre, para agrupar en UI
  -- ej: "Procuraduría General de la Nación"

  anio        integer,
  descripcion text,
  is_active   boolean      DEFAULT true,
  created_at  timestamptz  DEFAULT now()
);

CREATE INDEX idx_convocatorias_entidad ON public.convocatorias (entidad);
CREATE INDEX idx_convocatorias_active  ON public.convocatorias (is_active);

ALTER TABLE public.convocatorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backend_full_access" ON public.convocatorias;
CREATE POLICY "backend_full_access" ON public.convocatorias
  USING (true) WITH CHECK (true);


-- ── Convocatorias iniciales ──────────────────────────────────
--   Agregar aquí cada nuevo concurso antes de importar sus OPECs.

INSERT INTO public.convocatorias (codigo, nombre, entidad, anio, descripcion) VALUES
  (
    'PGN-2026',
    'Procuraduría General de la Nación — Nacional 2026',
    'Procuraduría General de la Nación',
    2026,
    'Convocatoria nacional 2026 — 290 cargos del nivel central'
  );

-- Cuando llegue Territorial 12, agregar así:
-- INSERT INTO public.convocatorias (codigo, nombre, entidad, anio, descripcion) VALUES
--   ('TERRITORIAL-12-2025', 'Procuraduría — Territorial 12 (2025)',
--    'Procuraduría General de la Nación', 2025, '...');


-- ============================================================
--  TABLA 2: opec_maestro
--  Cargos individuales. Cada cargo pertenece a UNA convocatoria.
--  entidad se repite aquí (desnormalizado) para que el análisis
--  de perfil haga queries rápidas sin join.
-- ============================================================

CREATE TABLE public.opec_maestro (
  id                         bigserial    PRIMARY KEY,

  convocatoria_id            bigint       NOT NULL
                             REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  -- FK a la convocatoria padre — campo clave para filtrar

  entidad                    text         NOT NULL DEFAULT 'Procuraduría General de la Nación',
  -- desnormalizado desde convocatorias.entidad para queries rápidas

  num_convocatoria           text,
  -- número del OPEC dentro del concurso: "01-2026", "042-2026", etc.

  denominacion               text         NOT NULL,
  nivel                      text,
  codigo                     text,
  grado                      integer,
  salario                    bigint,
  vacantes                   integer      DEFAULT 1,
  dependencia                text,
  area_estudio               text,
  requiere_posgrado          boolean      DEFAULT false,
  requiere_tarjeta           boolean      DEFAULT false,
  exp_anios                  integer      DEFAULT 0,
  exp_tipo                   text,
  estudio_texto              text,
  exp_texto                  text,
  conocimientos              text[]       DEFAULT '{}',
  competencias_transversales jsonb        DEFAULT '{}',
  competencias_perfil        jsonb        DEFAULT '{}',
  ubicaciones                jsonb        DEFAULT '[]',
  is_active                  boolean      DEFAULT true,
  created_at                 timestamptz  DEFAULT now(),
  updated_at                 timestamptz  DEFAULT now()
);

-- Índices
CREATE INDEX idx_opec_convocatoria ON public.opec_maestro (convocatoria_id);
CREATE INDEX idx_opec_entidad      ON public.opec_maestro (entidad);
CREATE INDEX idx_opec_nivel        ON public.opec_maestro (nivel);
CREATE INDEX idx_opec_exp          ON public.opec_maestro (exp_anios);
CREATE INDEX idx_opec_posgrado     ON public.opec_maestro (requiere_posgrado);
CREATE INDEX idx_opec_active       ON public.opec_maestro (is_active);
CREATE INDEX idx_opec_area         ON public.opec_maestro (area_estudio);

ALTER TABLE public.opec_maestro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backend_full_access" ON public.opec_maestro;
CREATE POLICY "backend_full_access" ON public.opec_maestro
  USING (true) WITH CHECK (true);
