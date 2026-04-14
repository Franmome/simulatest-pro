import { useState } from 'react'
import InputField from './InputField'
import { INPUT_CLS, LETRAS } from './lib/constants'

export default function PreguntaCard({
  preg, idx, onChange, onDelete, onDuplicate,
  expandido, onToggle, modoGuiado, modulos,
  nivelActivo, niveles, onDuplicarANivel,
}) {
  const tieneCorrecta = preg.options.some(o => o.is_correct)
  const [showDupMenu, setShowDupMenu] = useState(false)

  function setOpcion(i, field, value) {
    const opts = [...preg.options]
    if (field === 'is_correct') {
      opts.forEach((o, j) => { opts[j] = { ...o, is_correct: j === i } })
    } else {
      opts[i] = { ...opts[i], [field]: value }
    }
    onChange({ ...preg, options: opts })
  }

  return (
    <div className={`rounded-xl border transition-all ${tieneCorrecta ? 'border-outline-variant/20' : 'border-error/30 bg-error-container/5'}`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${tieneCorrecta ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'}`}>
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-on-surface">
            {preg.text || <span className="text-on-surface-variant italic">Pregunta sin enunciado</span>}
          </p>
          {preg.area && (
            <p className="text-[10px] text-on-surface-variant truncate">
              {modoGuiado ? 'Módulo' : 'Área'}: {preg.area}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!tieneCorrecta && (
            <span className="text-[10px] font-bold text-error bg-error-container px-2 py-0.5 rounded-full">Sin correcta</span>
          )}
          <span className="material-symbols-outlined text-on-surface-variant text-lg">
            {expandido ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {expandido && (
        <div className="px-4 pb-4 space-y-4 border-t border-outline-variant/10 pt-4">
          <InputField label="Enunciado" required>
            <textarea rows={3} value={preg.text} onChange={e => onChange({ ...preg, text: e.target.value })}
              placeholder="Escribe la pregunta aquí..." className={`${INPUT_CLS} resize-none`} />
          </InputField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label={modoGuiado ? 'Módulo' : 'Área temática'}>
              <input
                type="text"
                value={preg.area}
                onChange={e => onChange({ ...preg, area: e.target.value })}
                placeholder={modoGuiado ? 'ej: Derecho Fiscal' : 'ej: Derecho Fiscal'}
                className={INPUT_CLS}
                list={`modulos-list-${preg._id}`}
              />
              <datalist id={`modulos-list-${preg._id}`}>
                {modulos.filter(Boolean).map(m => <option key={m} value={m} />)}
              </datalist>
            </InputField>
            <InputField label="Dificultad">
              <select value={preg.difficulty} onChange={e => onChange({ ...preg, difficulty: e.target.value })} className={INPUT_CLS}>
                <option value="facil">Fácil</option>
                <option value="medio">Medio</option>
                <option value="dificil">Difícil</option>
              </select>
            </InputField>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Opciones — marca la correcta</p>
            {preg.options.map((op, i) => (
              <div key={op.letter} className="flex items-center gap-3">
                <button type="button" onClick={() => setOpcion(i, 'is_correct', true)}
                  className={`w-8 h-8 rounded-full flex-shrink-0 font-bold text-sm transition-all ${op.is_correct ? 'bg-secondary text-on-secondary shadow-md' : 'bg-surface-container text-on-surface-variant hover:bg-secondary-container'}`}>
                  {op.letter}
                </button>
                <input type="text" value={op.text} onChange={e => setOpcion(i, 'text', e.target.value)}
                  placeholder={`Opción ${op.letter}`}
                  className={`${INPUT_CLS} flex-1 ${op.is_correct ? 'border-secondary/40 ring-1 ring-secondary/20' : ''}`} />
                {op.is_correct && (
                  <span className="material-symbols-outlined text-secondary text-lg flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                )}
              </div>
            ))}
          </div>

          <InputField label="Explicación (retroalimentación)">
            <textarea rows={2} value={preg.explanation} onChange={e => onChange({ ...preg, explanation: e.target.value })}
              placeholder="Explica por qué la respuesta es correcta..." className={`${INPUT_CLS} resize-none`} />
          </InputField>

          <div className="flex justify-between items-center">
            <div className="relative">
              <button type="button" onClick={() => setShowDupMenu(v => !v)}
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-sm">content_copy</span>
                Duplicar a otro nivel
              </button>
              {showDupMenu && (
                <div className="absolute left-0 top-9 z-20 bg-surface rounded-xl shadow-lg border border-outline-variant/20 min-w-[180px]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-3 pt-3 pb-1">Copiar al nivel:</p>
                  {niveles.filter(n => n._id !== nivelActivo).map(n => (
                    <button key={n._id} type="button"
                      onClick={() => { onDuplicarANivel(preg, n._id); setShowDupMenu(false) }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-surface-container transition-colors">
                      {n.name || 'Sin nombre'}
                    </button>
                  ))}
                  {niveles.filter(n => n._id !== nivelActivo).length === 0 && (
                    <p className="px-3 py-2 text-xs text-on-surface-variant">No hay otros niveles</p>
                  )}
                  <button type="button" onClick={() => setShowDupMenu(false)}
                    className="w-full text-left px-3 py-2 text-xs text-error hover:bg-error-container/20 transition-colors border-t border-outline-variant/10">
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={onDuplicate}
                className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container px-3 py-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-sm">add_circle</span>
                Duplicar aquí
              </button>
              <button type="button" onClick={onDelete}
                className="flex items-center gap-1.5 text-xs font-bold text-error hover:bg-error-container/30 px-3 py-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-sm">delete</span>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
