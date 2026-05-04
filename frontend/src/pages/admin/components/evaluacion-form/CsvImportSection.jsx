import { useState } from 'react'
import Card from './Card'
import { INPUT_CLS, CSV_COLUMNS, PROMPT_IA_CSV } from './lib/constants'

const DIFF_COLOR = {
  facil:   'bg-secondary-container/40 text-secondary',
  medio:   'bg-tertiary-container/30 text-tertiary',
  dificil: 'bg-error-container/40 text-error',
}

function PreviewTabla({ preguntas, fileName, tipo, onConfirmar, onCancelar }) {
  const [pagina, setPagina] = useState(0)
  const POR_PAG = 5
  const totalPag = Math.ceil(preguntas.length / POR_PAG)
  const slice = preguntas.slice(pagina * POR_PAG, (pagina + 1) * POR_PAG)

  const correctas = preguntas.filter(p => p.options.some(o => o.is_correct && o.text)).length
  const sinExplicacion = preguntas.filter(p => !p.explanation).length

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex flex-wrap gap-3 p-4 bg-secondary-container/20 rounded-xl border border-secondary/20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-lg">check_circle</span>
          <span className="text-sm font-bold text-secondary">{preguntas.length} preguntas listas</span>
        </div>
        <span className="text-on-surface-variant text-xs mt-0.5">desde {fileName} ({tipo})</span>
        {sinExplicacion > 0 && (
          <span className="text-xs text-tertiary flex items-center gap-1 ml-auto">
            <span className="material-symbols-outlined text-sm">info</span>
            {sinExplicacion} sin explicación
          </span>
        )}
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        {['facil','medio','dificil'].map(d => {
          const n = preguntas.filter(p => p.difficulty === d).length
          return (
            <div key={d} className={`p-3 rounded-xl text-center ${DIFF_COLOR[d]}`}>
              <p className="text-lg font-extrabold">{n}</p>
              <p className="text-[10px] font-bold uppercase">{d}</p>
            </div>
          )
        })}
      </div>

      {/* Tabla preview */}
      <div className="rounded-xl overflow-hidden border border-outline-variant/20">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-surface-container-low text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">
              <th className="px-3 py-2 w-8">#</th>
              <th className="px-3 py-2">Enunciado</th>
              <th className="px-3 py-2 w-20">Área</th>
              <th className="px-3 py-2 w-16">Dif.</th>
              <th className="px-3 py-2 w-16">Correcta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {slice.map((p, i) => {
              const correcta = p.options.find(o => o.is_correct)
              return (
                <tr key={p._id} className="hover:bg-surface-container-low/40">
                  <td className="px-3 py-2 text-on-surface-variant">{pagina * POR_PAG + i + 1}</td>
                  <td className="px-3 py-2 text-on-surface max-w-[260px]">
                    <p className="truncate font-medium">{p.text}</p>
                    {p.explanation && (
                      <p className="text-on-surface-variant truncate mt-0.5">{p.explanation}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-on-surface-variant">{p.area || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${DIFF_COLOR[p.difficulty] || ''}`}>
                      {p.difficulty}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-bold text-secondary">{correcta?.letter}</span>
                    <span className="text-on-surface-variant ml-1 text-[10px] truncate block max-w-[80px]">{correcta?.text}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {totalPag > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-outline-variant/10 bg-surface-container-low/30">
            <span className="text-[10px] text-on-surface-variant">
              Mostrando {pagina * POR_PAG + 1}–{Math.min((pagina+1)*POR_PAG, preguntas.length)} de {preguntas.length}
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => setPagina(p => Math.max(0, p-1))} disabled={pagina === 0}
                className="w-6 h-6 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button type="button" onClick={() => setPagina(p => Math.min(totalPag-1, p+1))} disabled={pagina >= totalPag-1}
                className="w-6 h-6 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex gap-3">
        <button type="button" onClick={onCancelar}
          className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
          Cancelar
        </button>
        <button type="button" onClick={onConfirmar}
          className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm">add_circle</span>
          Agregar {preguntas.length} preguntas al nivel
        </button>
      </div>
    </div>
  )
}

export default function CsvImportSection({
  nivelActivo, niveles, modoGuiado,
  csvRef, importando,
  importError, importOk,
  preview,
  onProcesarArchivo,
  onConfirmarImport,
  onCancelarPreview,
  onDescargarCSV,
  onDescargarJSON,
  onCopiarPromptIA,
  onCopiarInstrucciones,
  setImportError, setImportOk,
}) {
  const [tab, setTab] = useState('subir') // 'subir' | 'prompt' | 'formato'
  const [promptCopiado, setPromptCopiado] = useState(false)

  const nivelActualNombre = niveles.find(n => n._id === nivelActivo)?.name

  async function handleCopiarPrompt() {
    await onCopiarPromptIA()
    setPromptCopiado(true)
    setTimeout(() => setPromptCopiado(false), 2500)
  }

  return (
    <Card className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg font-headline">Importar preguntas</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {modoGuiado ? 'Banco' : 'Nivel'} destino:{' '}
            <span className="font-bold text-primary">
              {nivelActualNombre || 'sin nombre — selecciónalo en el panel lateral'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-secondary bg-secondary-container/30 px-3 py-1.5 rounded-full">
          <span className="material-symbols-outlined text-sm">upload_file</span>
          CSV · JSON
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-container rounded-full p-1 gap-0.5">
        {[
          { key: 'subir',   label: 'Subir archivo',  icon: 'cloud_upload' },
          { key: 'prompt',  label: 'Prompt IA',      icon: 'auto_awesome' },
          { key: 'formato', label: 'Referencia',      icon: 'list_alt' },
        ].map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${
              tab === t.key ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}>
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: SUBIR ─────────────────────────────────────────────────────── */}
      {tab === 'subir' && (
        <div className="space-y-4">
          {!preview ? (
            <>
              {/* Drop zone */}
              <label className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-3 ${
                importando
                  ? 'border-primary bg-primary/5'
                  : 'border-outline-variant hover:border-primary hover:bg-primary/5 bg-surface-container-low/40'
              }`}>
                <span className={`material-symbols-outlined text-4xl ${importando ? 'text-primary animate-bounce' : 'text-on-surface-variant/50'}`}>
                  {importando ? 'hourglass_top' : 'upload_file'}
                </span>
                <div>
                  <p className="font-bold text-sm text-on-surface">
                    {importando ? 'Procesando archivo...' : 'Arrastra o haz clic para seleccionar'}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">CSV o JSON · máximo 10 MB</p>
                </div>
                <input
                  ref={csvRef}
                  type="file"
                  accept=".csv,.json"
                  className="hidden"
                  onChange={onProcesarArchivo}
                  disabled={importando}
                />
              </label>

              {/* Plantillas */}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={onDescargarCSV}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-low/50 hover:border-primary hover:bg-primary/5 transition-all text-xs font-bold text-on-surface-variant">
                  <span className="material-symbols-outlined text-lg text-primary">description</span>
                  <div className="text-left">
                    <p className="text-on-surface font-bold">Plantilla CSV</p>
                    <p className="font-normal opacity-70">5 preguntas de ejemplo</p>
                  </div>
                </button>
                <button type="button" onClick={onDescargarJSON}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-low/50 hover:border-primary hover:bg-primary/5 transition-all text-xs font-bold text-on-surface-variant">
                  <span className="material-symbols-outlined text-lg text-tertiary">data_object</span>
                  <div className="text-left">
                    <p className="text-on-surface font-bold">Plantilla JSON</p>
                    <p className="font-normal opacity-70">3 preguntas de ejemplo</p>
                  </div>
                </button>
              </div>

              <button type="button" onClick={onCopiarInstrucciones}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-outline-variant text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-sm">content_copy</span>
                Copiar instrucciones para Excel / Google Sheets
              </button>
            </>
          ) : (
            <PreviewTabla
              preguntas={preview.preguntas}
              fileName={preview.fileName}
              tipo={preview.tipo}
              onConfirmar={onConfirmarImport}
              onCancelar={onCancelarPreview}
            />
          )}

          {/* Mensajes */}
          {importError && (
            <div className="p-4 bg-error-container rounded-xl flex items-start gap-3 border border-error/30">
              <span className="material-symbols-outlined text-on-error-container text-lg flex-shrink-0">error</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-on-error-container">Error al procesar</p>
                <p className="text-xs text-on-error-container/80 mt-0.5 whitespace-pre-wrap">{importError}</p>
              </div>
              <button type="button" onClick={() => setImportError(null)} className="text-on-error-container/60 hover:text-on-error-container">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {importOk && !preview && (
            <div className="p-4 bg-secondary-container/30 rounded-xl flex items-center gap-3 border border-secondary/20">
              <span className="material-symbols-outlined text-secondary text-lg">check_circle</span>
              <p className="text-sm font-medium text-secondary flex-1">{importOk}</p>
              <button type="button" onClick={() => setImportOk(null)} className="text-secondary/60 hover:text-secondary">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: PROMPT IA ──────────────────────────────────────────────────── */}
      {tab === 'prompt' && (
        <div className="space-y-4">
          <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-1">
            <p className="text-xs font-bold text-primary">¿Cómo usar este prompt?</p>
            <ol className="text-xs text-on-surface-variant space-y-1 list-decimal pl-4">
              <li>Copia el prompt de abajo.</li>
              <li>Pégalo en ChatGPT, Gemini, Claude o cualquier IA.</li>
              <li>Reemplaza el marcador al final con tu material (PDF, norma, temario, texto).</li>
              <li>La IA te devuelve un JSON listo para importar aquí.</li>
              <li>Guarda el JSON como <code className="bg-surface-container px-1 rounded text-primary">.json</code> y súbelo en "Subir archivo".</li>
            </ol>
          </div>

          <div className="relative">
            <textarea
              readOnly
              value={PROMPT_IA_CSV}
              rows={14}
              className={`${INPUT_CLS} resize-none text-[11px] font-mono`}
            />
            <button
              type="button"
              onClick={handleCopiarPrompt}
              className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                promptCopiado
                  ? 'bg-secondary text-on-secondary'
                  : 'bg-primary text-on-primary hover:bg-primary/90'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {promptCopiado ? 'check' : 'content_copy'}
              </span>
              {promptCopiado ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-surface-container rounded-xl text-xs text-on-surface-variant space-y-1">
              <p className="font-bold text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-primary">tips_and_updates</span>
                Tip — PDFs grandes
              </p>
              <p>Divide el PDF en secciones temáticas y genera 10–20 preguntas por sección. El resultado será más preciso.</p>
            </div>
            <div className="p-3 bg-surface-container rounded-xl text-xs text-on-surface-variant space-y-1">
              <p className="font-bold text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-secondary">verified</span>
                Tip — Calidad
              </p>
              <p>Revisa siempre el JSON antes de importar. Usa la vista previa para detectar preguntas mal formuladas o respuestas incorrectas.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: REFERENCIA ────────────────────────────────────────────────── */}
      {tab === 'formato' && (
        <div className="space-y-5">
          {/* Columnas CSV */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Formato CSV</p>
            <div className="rounded-xl overflow-hidden border border-outline-variant/20">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-surface-container-low text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">
                    <th className="px-3 py-2">Columna</th>
                    <th className="px-3 py-2">Requerido</th>
                    <th className="px-3 py-2">Valores válidos</th>
                    <th className="px-3 py-2">Ejemplo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {[
                    { col:'area',       req:false, vals:'Texto libre',             ej:'Derecho Fiscal' },
                    { col:'dificultad', req:false, vals:'facil · medio · dificil', ej:'medio' },
                    { col:'enunciado',  req:true,  vals:'Texto',                   ej:'¿Cuál es el órgano de control fiscal?' },
                    { col:'A',          req:true,  vals:'Texto',                   ej:'Procuraduría' },
                    { col:'B',          req:true,  vals:'Texto',                   ej:'Contraloría' },
                    { col:'C',          req:true,  vals:'Texto',                   ej:'Fiscalía' },
                    { col:'D',          req:false, vals:'Texto (opcional)',         ej:'Defensoría' },
                    { col:'correcta',   req:true,  vals:'A · B · C · D',           ej:'B' },
                    { col:'explicacion',req:false, vals:'Texto',                   ej:'La Contraloría ejerce vigilancia fiscal...' },
                  ].map(r => (
                    <tr key={r.col} className="hover:bg-surface-container-low/30">
                      <td className="px-3 py-2 font-bold font-mono text-primary">{r.col}</td>
                      <td className="px-3 py-2">
                        {r.req
                          ? <span className="text-error font-bold">Sí</span>
                          : <span className="text-on-surface-variant">No</span>}
                      </td>
                      <td className="px-3 py-2 text-on-surface-variant">{r.vals}</td>
                      <td className="px-3 py-2 text-on-surface-variant italic truncate max-w-[120px]">{r.ej}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* JSON */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Formato JSON</p>
            <p className="text-xs text-on-surface-variant">
              Arreglo de objetos. Soporta opciones planas (<code className="text-primary bg-surface-container px-1 rounded">A, B, C, D</code>) o anidadas (<code className="text-primary bg-surface-container px-1 rounded">opciones: {'{A, B, C, D}'}</code>).
            </p>
            <pre className="text-[10px] bg-surface-container rounded-xl p-4 overflow-x-auto text-on-surface-variant leading-relaxed">{`[
  {
    "area": "Derecho Administrativo",
    "dificultad": "medio",
    "enunciado": "¿Cuál es el término de prescripción disciplinaria?",
    "A": "3 años",
    "B": "5 años",
    "C": "10 años",
    "D": "12 años",
    "correcta": "C",
    "explicacion": "Ley 1952 de 2019 — 10 años."
  },
  {
    "area": "Gestión Pública",
    "dificultad": "facil",
    "enunciado": "¿Qué es el SIG?",
    "opciones": {
      "A": "Sistema Integrado de Gestión",
      "B": "Sistema de Información Gubernamental",
      "C": "Sistema de Indicadores de Gestión"
    },
    "correcta": "A",
    "explicacion": "El SIG integra los diferentes sistemas de gestión de las entidades."
  }
]`}</pre>
            <div className="flex gap-2">
              <button type="button" onClick={onDescargarCSV}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-outline-variant text-xs font-bold hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-sm">description</span>
                Descargar CSV
              </button>
              <button type="button" onClick={onDescargarJSON}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-outline-variant text-xs font-bold hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-sm">data_object</span>
                Descargar JSON
              </button>
            </div>
          </div>

          {/* Errores frecuentes */}
          <div className="p-4 bg-error-container/20 rounded-xl border border-error/15 space-y-2">
            <p className="text-xs font-bold text-error flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span>
              Errores frecuentes
            </p>
            <ul className="text-xs text-on-surface-variant space-y-1 list-disc pl-4">
              <li>CSV guardado como UTF-16 o ANSI en vez de <strong>UTF-8</strong> → caracteres rotos.</li>
              <li><code className="text-error">correcta</code> en minúsculas (<code>b</code>) → debe ser mayúscula (<code>B</code>).</li>
              <li>Comillas tipográficas <code>" "</code> en vez de rectas <code>"</code> → error de parseo.</li>
              <li>Coma dentro del enunciado sin comillas → columnas desplazadas.</li>
              <li>Fila vacía al final del archivo → pregunta con enunciado vacío.</li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  )
}
