import Card from './Card'
import InputField from './InputField'
import { INPUT_CLS } from './lib/constants'

export default function NivelCard({ nivel, idx, onChange, onDelete, preguntasCount, onDuplicate, modoGuiado, onVerPreguntas }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">{idx + 1}</div>
        <h4 className="font-bold text-sm flex-1">{nivel.name || (modoGuiado ? `Banco ${idx + 1}` : `Nivel ${idx + 1}`)}</h4>
        <button type="button" onClick={onVerPreguntas}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors">
          <span className="material-symbols-outlined text-sm">quiz</span>
          {preguntasCount} preg.
        </button>
        {idx > 0 && (
          <button type="button" onClick={onDelete} className="p-1.5 text-error hover:bg-error-container/30 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
        <button type="button" onClick={onDuplicate} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Duplicar">
          <span className="material-symbols-outlined text-sm">content_copy</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField label={modoGuiado ? 'Nombre del banco' : 'Nombre del nivel'} required>
          <input type="text" value={nivel.name} onChange={e => onChange({ ...nivel, name: e.target.value })}
            placeholder={modoGuiado ? 'ej: Banco principal' : 'ej: Profesional Universitario'} className={INPUT_CLS} />
        </InputField>
        <InputField label="Descripción">
          <input type="text" value={nivel.description} onChange={e => onChange({ ...nivel, description: e.target.value })}
            placeholder="Descripción breve" className={INPUT_CLS} />
        </InputField>
        <InputField label="Tiempo límite (minutos)" required>
          <input type="number" min={10} max={360} value={nivel.time_limit}
            onChange={e => onChange({ ...nivel, time_limit: Number(e.target.value) })} className={INPUT_CLS} />
        </InputField>
        <InputField label="Puntaje de aprobación (%)">
          <input type="number" min={50} max={100} value={nivel.passing_score}
            onChange={e => onChange({ ...nivel, passing_score: Number(e.target.value) })} className={INPUT_CLS} />
        </InputField>
      </div>

      <div className="mt-3 pt-3 border-t border-outline-variant/10">
        <button type="button" onClick={onVerPreguntas}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
          <span className="material-symbols-outlined text-sm">edit_note</span>
          Ver y editar preguntas de este {modoGuiado ? 'banco' : 'nivel'} ({preguntasCount})
        </button>
      </div>
    </Card>
  )
}
