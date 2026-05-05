-- Migración: campos de facturación + preferencias en users
-- Ejecutar en Supabase SQL Editor

-- Datos personales / facturación
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone            TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS documento_tipo   TEXT DEFAULT 'CC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS documento_numero TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ciudad           TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS departamento     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS direccion        TEXT;

-- Preferencias de notificaciones (JSON)
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB
  DEFAULT '{"resultados":true,"recordatorios":true,"novedades":false,"tips":true}'::jsonb;

-- Preferencias de UI (JSON)
ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_prefs JSONB
  DEFAULT '{"modoOscuro":false,"idioma":"es","autoguardar":true,"sonidos":false,"timerVisible":true}'::jsonb;
