// constants.js
// Constantes globales del formulario de evaluación.
// Cambiar DEBUG_EVAL_FORM a `true` activa logs detallados por etapa en la consola.

// ============================================================================
// DEBUG
// Cuando está en `true` se imprimen logs [EvaluacionForm], [EvalService] y
// [PackageService] en la consola del navegador con el estado de cada etapa.
// Poner en `false` antes de hacer deploy a producción.
// ============================================================================
export const DEBUG_EVAL_FORM = false

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
export const PROMPT_IA_CSV = `Convierte el siguiente material en preguntas de opción múltiple para un examen de concurso colombiano.

Devuelve ÚNICAMENTE un arreglo JSON válido con esta estructura exacta (sin markdown, sin texto adicional):

[
  {
    "area": "Nombre del área o módulo temático",
    "dificultad": "facil | medio | dificil",
    "enunciado": "Enunciado completo de la pregunta",
    "A": "Texto de la opción A",
    "B": "Texto de la opción B",
    "C": "Texto de la opción C",
    "D": "Texto de la opción D (opcional, puede omitirse)",
    "correcta": "A | B | C | D",
    "explicacion": "Explicación pedagógica breve de por qué es correcta la respuesta y base legal/conceptual si aplica."
  }
]

Reglas obligatorias:
- "correcta" solo puede ser A, B, C o D (mayúscula)
- "dificultad" debe ser exactamente: facil, medio o dificil
- Si la pregunta tiene solo 3 opciones válidas omite D o deja D vacío
- El enunciado no debe revelar la respuesta
- Cada "explicacion" debe citar norma, artículo o principio cuando sea posible
- Genera entre 10 y 30 preguntas por solicitud salvo que se indique lo contrario
- Devuelve solo el JSON, sin comentarios, sin bloques de código markdown

Material a convertir:
[PEGA AQUÍ TU MATERIAL — PDF, TEXTO, NORMA, TEMARIO, ETC.]`

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
