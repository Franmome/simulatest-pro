import { useMemo } from 'react'
import PreguntaCard from './PreguntaCard'
import Card from './Card'

export default function QuestionsSection({
  niveles, nivelActivo,
  preguntas,
  pregExpandida, setPregExpandida,
  moduloActivo, setModuloActivo,
  modoGuiado,
  todosLosModulos,
  onAgregarPregunta,
  onActualizarPregunta,
  onEliminarPregunta,
  onDuplicarPreguntaMismoNivel,
  onDuplicarPreguntaANivel,
}) {
  const pregActivas = preguntas[nivelActivo] || []

  const modulosDelNivelActivo = useMemo(() => {
    const areas = pregActivas.map(p => p.area?.trim()).filter(Boolean)
    return [...new Set(areas)]
  }, [pregActivas])

  const pregsFiltradas = useMemo(() => {
    if (!moduloActivo) return pregActivas
    return pregActivas.filter(p => (p.area?.trim() || '') === moduloActivo)
  }, [pregActivas, moduloActivo])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-lg font-headline">
            Preguntas — {niveles.find(n => n._id === nivelActivo)?.name || (modoGuiado ? 'Banco' : 'Nivel')}
            {moduloActivo && <span className="text-primary ml-2">› {moduloActivo}</span>}
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {moduloActivo
              ? `${pregsFiltradas.length} pregunta${pregsFiltradas.length !== 1 ? 's' : ''} en este módulo`
              : `${pregActivas.length} pregunta${pregActivas.length !== 1 ? 's' : ''} en este ${modoGuiado ? 'banco' : 'nivel'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {moduloActivo && (
            <button type="button" onClick={() => setModuloActivo(null)}
              className="flex items-center gap-1 text-xs text-on-surface-variant hover:bg-surface-container px-3 py-1.5 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>
              Quitar filtro
            </button>
          )}
          <button type="button" onClick={() => onAgregarPregunta(moduloActivo || '')}
            className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/90 transition-all">
            <span className="material-symbols-outlined text-sm">add</span>
            Agregar pregunta{moduloActivo ? ` en "${moduloActivo}"` : ''}
          </button>
        </div>
      </div>

      {!moduloActivo && modulosDelNivelActivo.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">category</span>
            {modoGuiado ? 'Módulos' : 'Áreas temáticas'}
          </p>
          <div className="flex flex-wrap gap-2">
            {modulosDelNivelActivo.map(mod => (
              <button key={mod} type="button" onClick={() => setModuloActivo(mod)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-secondary-container/40 text-secondary hover:bg-secondary-container/60 transition-colors">
                {mod}
                <span className="bg-secondary text-on-secondary rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                  {pregActivas.filter(p => p.area?.trim() === mod).length}
                </span>
              </button>
            ))}
            <button type="button" onClick={() => onAgregarPregunta('')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined text-sm">add</span>
              Nuevo módulo
            </button>
          </div>
        </div>
      )}

      {!moduloActivo && pregActivas.filter(p => !p.area?.trim()).length > 0 && (
        <div className="p-3 bg-tertiary-container/20 rounded-xl border border-tertiary/20">
          <p className="text-xs font-bold text-tertiary mb-1">
            {pregActivas.filter(p => !p.area?.trim()).length} pregunta(s) sin {modoGuiado ? 'módulo' : 'área temática'}
          </p>
          <p className="text-xs text-on-surface-variant">Asigna un módulo a cada pregunta para organizarlas mejor.</p>
        </div>
      )}

      {pregsFiltradas.length === 0 ? (
        <Card className="p-10 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">quiz</span>
          <p className="font-semibold text-sm">
            {moduloActivo ? `Sin preguntas en el módulo "${moduloActivo}"` : `Sin preguntas en este ${modoGuiado ? 'banco' : 'nivel'}`}
          </p>
          <p className="text-xs mt-1">Agrégalas manualmente o importa desde CSV</p>
        </Card>
      ) : (
        pregsFiltradas.map((preg, i) => (
          <PreguntaCard key={preg._id} preg={preg} idx={i}
            expandido={pregExpandida === preg._id}
            onToggle={() => setPregExpandida(pregExpandida === preg._id ? null : preg._id)}
            onChange={datos => onActualizarPregunta(nivelActivo, preg._id, datos)}
            onDelete={() => onEliminarPregunta(nivelActivo, preg._id)}
            onDuplicate={() => onDuplicarPreguntaMismoNivel(nivelActivo, preg)}
            onDuplicarANivel={(p, destId) => onDuplicarPreguntaANivel(p, destId)}
            modoGuiado={modoGuiado}
            modulos={todosLosModulos}
            nivelActivo={nivelActivo}
            niveles={niveles}
          />
        ))
      )}
    </div>
  )
}
