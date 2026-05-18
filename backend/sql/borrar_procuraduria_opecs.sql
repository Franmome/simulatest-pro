-- ============================================================
--  Borrar TODOS los OPECs de la Procuraduría (reimportar limpio)
--  Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- 1. Borra todos los cargos de la convocatoria PGN-2026
DELETE FROM public.opec_maestro
WHERE convocatoria_id = (
  SELECT id FROM public.convocatorias WHERE codigo = 'PGN-2026'
);

-- (Opcional) Si quieres ver cuántos quedaron antes de borrar,
-- corre este SELECT primero:
-- SELECT COUNT(*) FROM public.opec_maestro
-- WHERE convocatoria_id = (SELECT id FROM public.convocatorias WHERE codigo = 'PGN-2026');
