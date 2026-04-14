import Card from './Card'
import { INPUT_CLS, CSV_COLUMNS, PROMPT_IA_CSV } from './lib/constants'

export default function CsvImportSection({
  nivelActivo, niveles, modoGuiado,
  csvRef, importando, importError, importOk,
  onImportar, onDescargarPlantilla, onCopiarPromptIA, onCopiarInstrucciones,
  setImportError, setImportOk,
}) {
  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="font-bold text-lg font-headline mb-1">Importar preguntas desde CSV</h3>
        <p className="text-sm text-on-surface-variant">
          {modoGuiado ? 'Banco activo' : 'Nivel activo'}:{' '}
          <span className="font-bold text-primary">{niveles.find(n => n._id === nivelActivo)?.name || 'sin nombre'}</span>
        </p>
        <p className="text-xs text-on-surface-variant mt-1">
          Las preguntas importadas se agregarán al {modoGuiado ? 'banco' : 'nivel'} activo indicado arriba. Cámbialo desde el panel lateral.
        </p>
      </div>

      <div className="bg-surface-container rounded-xl p-5 space-y-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">Flujo recomendado</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { n: 1, title: `Crea los ${modoGuiado ? 'bancos' : 'niveles'}`, desc: `Crea un ${modoGuiado ? 'banco' : 'nivel'} por profesión o cargo antes de importar preguntas.` },
            { n: 2, title: `Selecciona el ${modoGuiado ? 'banco' : 'nivel'} activo`, desc: 'El CSV que subas se agregará al activo actual.' },
            { n: 3, title: 'Descarga la plantilla', desc: 'Usa siempre la misma estructura para evitar errores al importar.' },
            { n: 4, title: 'Si usas IA, pásale el prompt', desc: 'Convierte PDFs o bases manuales a CSV usando el prompt de abajo.' },
          ].map(({ n, title, desc }) => (
            <div key={n} className="p-4 bg-surface-container-high rounded-xl">
              <p className="text-xs font-bold text-primary mb-2">{n}. {title}</p>
              <p className="text-xs text-on-surface-variant">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Columnas obligatorias</p>
        <div className="flex flex-wrap gap-2">
          {CSV_COLUMNS.map(col => (
            <span key={col} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${['enunciado', 'A', 'B', 'C', 'D', 'correcta'].includes(col) ? 'bg-primary-fixed text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
              {col}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-primary/5 rounded-xl border border-primary/10 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-primary uppercase tracking-widest">Prompt para IA</p>
          <button type="button" onClick={onCopiarPromptIA}
            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[10px] font-bold">
            Copiar prompt
          </button>
        </div>
        <textarea readOnly value={PROMPT_IA_CSV} rows={10} className={`${INPUT_CLS} resize-none text-[11px]`} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onCopiarInstrucciones}
          className="px-3 py-2 rounded-lg border border-outline-variant text-xs font-bold hover:bg-surface-container transition-colors">
          Copiar instrucciones para Excel / Sheets
        </button>
        <button type="button" onClick={onDescargarPlantilla}
          className="px-3 py-2 rounded-lg border border-outline-variant text-xs font-bold hover:bg-surface-container transition-colors">
          Descargar plantilla CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${importando ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary bg-surface-container-low/50'}`}>
          <span className={`material-symbols-outlined text-3xl mb-2 ${importando ? 'text-primary animate-bounce' : 'text-on-surface-variant'}`}>cloud_upload</span>
          <p className="text-sm font-bold">{importando ? 'Importando...' : 'Haz clic o arrastra tu CSV'}</p>
          <p className="text-xs text-on-surface-variant mt-1">El archivo se agregará al {modoGuiado ? 'banco' : 'nivel'} activo</p>
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={onImportar} />
        </label>

        <div className="border rounded-xl p-6 flex flex-col justify-center gap-2 border-outline-variant bg-surface-container-low/40">
          <p className="text-sm font-bold">Recomendación práctica</p>
          <p className="text-xs text-on-surface-variant">
            Si tienes PDFs o módulos largos, usa el prompt del panel para que la IA convierta todo al formato exacto del CSV. Luego pega el resultado en Excel, guarda como CSV UTF-8 y sube aquí.
          </p>
        </div>
      </div>

      {importError && (
        <div className="p-4 bg-error-container rounded-xl flex items-start gap-3 border border-error/30">
          <span className="material-symbols-outlined text-on-error-container text-lg flex-shrink-0">error</span>
          <div className="flex-1">
            <p className="text-sm text-on-error-container font-bold">Error al importar</p>
            <p className="text-sm text-on-error-container mt-0.5">{importError}</p>
          </div>
          <button type="button" onClick={() => setImportError(null)} className="text-on-error-container/70 hover:text-on-error-container">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {importOk && (
        <div className="p-4 bg-secondary-container/30 rounded-xl flex items-start gap-3 border border-secondary/20">
          <span className="material-symbols-outlined text-secondary text-lg flex-shrink-0">check_circle</span>
          <p className="text-sm text-secondary font-medium flex-1">{importOk}</p>
          <button type="button" onClick={() => setImportOk(null)} className="text-secondary/70 hover:text-secondary">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}
    </Card>
  )
}
