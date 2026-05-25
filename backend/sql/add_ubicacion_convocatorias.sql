-- Agrega departamento y ciudad a la tabla convocatorias
-- Ejecutar en Supabase SQL Editor

ALTER TABLE convocatorias
  ADD COLUMN IF NOT EXISTS departamento TEXT,
  ADD COLUMN IF NOT EXISTS ciudad       TEXT;

-- Índices para filtros en tiempo real
CREATE INDEX IF NOT EXISTS idx_convocatorias_departamento ON convocatorias (departamento);
CREATE INDEX IF NOT EXISTS idx_convocatorias_ciudad       ON convocatorias (ciudad);
