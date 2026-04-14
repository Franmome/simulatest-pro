// Activar para ver logs de etapas en consola
export const DEBUG_EVAL_FORM = false

export const INPUT_CLS = `w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30
  rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20
  focus:border-primary/40 transition-all placeholder:text-on-surface-variant/50`

export const LETRAS = ['A', 'B', 'C', 'D']

export const CSV_COLUMNS = ['area', 'dificultad', 'enunciado', 'A', 'B', 'C', 'D', 'correcta', 'explicacion']

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

export const TAB_LABEL_MAP = {
  general: 'Info del Paquete',
  profesiones: 'Versiones y Precios',
  niveles: 'Niveles',
  preguntas: 'Preguntas',
  material: 'Material de Estudio',
  importar: 'Importar CSV',
}
