-- Migración: campos nuevos para datos SIMO-CNSC y campos faltantes
-- Ejecutar en: Supabase → SQL Editor

ALTER TABLE public.opec_maestro
  ADD COLUMN IF NOT EXISTS proceso              text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS funciones            text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS numero_opec          text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manual_url           text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proposito            text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS municipio            text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS departamento         text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proceso_de_seleccion text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS requisito_otros      text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vigencia_salarial    integer  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cierre_inscripciones date     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS anio_convocatoria    integer  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nit_entidad          text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fuente               text     DEFAULT NULL;

-- Índices útiles para filtros en la IA y el admin
CREATE INDEX IF NOT EXISTS idx_opec_municipio    ON public.opec_maestro (municipio);
CREATE INDEX IF NOT EXISTS idx_opec_departamento ON public.opec_maestro (departamento);
CREATE INDEX IF NOT EXISTS idx_opec_fuente       ON public.opec_maestro (fuente);
CREATE INDEX IF NOT EXISTS idx_opec_anio         ON public.opec_maestro (anio_convocatoria);
