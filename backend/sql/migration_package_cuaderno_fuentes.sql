-- Materiales base del cuaderno subidos por el admin por paquete
-- Se comparten con todos los usuarios del paquete (costo de ingestión una sola vez)
CREATE TABLE IF NOT EXISTS public.package_cuaderno_fuentes (
  id          SERIAL PRIMARY KEY,
  package_id  INTEGER NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  nombre      TEXT    NOT NULL,
  tipo        TEXT    NOT NULL DEFAULT 'archivo', -- 'archivo' | 'youtube'
  texto       TEXT    NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pcf_package_id ON public.package_cuaderno_fuentes(package_id);
