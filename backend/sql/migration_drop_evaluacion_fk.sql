-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ MIGRACIÓN: Eliminar FK constraint en user_simulacros.evaluacion_id     │
-- │                                                                         │
-- │ En el nuevo modelo, evaluacion_id puede contener un package_id          │
-- │ (cuando se accede por /paquete/:pkgId). Sin esta migración, los        │
-- │ simulacros se guardan con evaluacion_id=null y no aparecen al usuario. │
-- │                                                                         │
-- │ INSTRUCCIONES: Correr este SQL en el SQL Editor de Supabase una sola vez│
-- └─────────────────────────────────────────────────────────────────────────┘

-- Elimina el FK constraint (nombre estándar de Supabase)
ALTER TABLE public.user_simulacros
  DROP CONSTRAINT IF EXISTS user_simulacros_evaluacion_id_fkey;

-- Por si el nombre es diferente, intenta variantes comunes
ALTER TABLE public.user_simulacros
  DROP CONSTRAINT IF EXISTS fk_user_simulacros_evaluacion;

ALTER TABLE public.user_simulacros
  DROP CONSTRAINT IF EXISTS user_simulacros_evaluacion_id_fk;

-- Confirmar que ya no hay FK sobre evaluacion_id
-- (Debe devolver 0 filas si la migración funcionó)
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.user_simulacros'::regclass
  AND contype = 'f'
  AND conname ILIKE '%evaluacion%';
