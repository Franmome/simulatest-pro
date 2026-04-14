// constants.js
// Constantes globales del formulario de evaluación.
// Cambiar DEBUG_EVAL_FORM a `true` activa logs detallados por etapa en la consola.

// ============================================================================
// DEBUG
// Cuando está en `true` se imprimen logs [EvaluacionForm], [EvalService] y
// [PackageService] en la consola del navegador con el estado de cada etapa.
// Poner en `false` antes de hacer deploy a producción.
// ============================================================================
export const DEBUG_EVAL_FORM = true

// ============================================================================
// CLASE CSS REUTILIZABLE PARA INPUTS
// Aplica el estilo base de todos los campos de texto/select del formulario.
// ============================================================================
export const INPUT_CLS =
  'w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 ' +
  'rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 ' +
  'focus:border-primary/40 transition-all placeholder:text-on-surface-variant/50'

// ============================================================================
// LETRAS DE OPCIONES
// Orden fijo de las opciones de cada pregunta.
// ============================================================================
export const LETRAS = ['A', 'B', 'C', 'D']

// ============================================================================
// COLUMNAS DEL CSV
// Define el orden exacto que debe tener la plantilla exportada y el CSV importado.
// ============================================================================
export const CSV_COLUMNS = [
  'area',
  'dificultad',
  'enunciado',
  'A',
  'B',
  'C',
  'D',
  'correcta',
  'explicacion',
]

// ============================================================================
// PROMPT PARA IA
// Texto listo para pegar en ChatGPT/Gemini/Claude y convertir material en CSV.
// ============================================================================
export const PROMPT_IA_CSV = `Convierte este material en preguntas para un archivo CSV con esta estructura exacta:
area,dificultad,enunciado,A,B,C,D,correcta,explicacion

Reglas:
- "correcta" solo puede ser A, B, C o D
- no cambies el orden de las columnas
- no agregues columnas extra
- cada fila debe representar una sola pregunta
- "dificultad" debe ser: facil, medio o dificil
- "explicacion" debe ser breve, clara y útil para retroalimentación
- devuelve únicamente el CSV limpio, sin markdown, sin comentarios y sin explicación adicional`

// ============================================================================
// MAPA DE ETIQUETAS POR SECCIÓN
// Usado por ErrorBanner para mostrar el nombre legible de la pestaña donde
// ocurrió el error.
// ============================================================================
export const TAB_LABEL_MAP = {
  general: 'Info del Paquete',
  profesiones: 'Versiones y Precios',
  niveles: 'Niveles',
  preguntas: 'Preguntas',
  material: 'Material de Estudio',
  importar: 'Importar CSV',
}
