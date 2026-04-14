import NivelCard from './NivelCard'

export default function LevelsSection({
  niveles, preguntas, modoGuiado, labels,
  onAgregarNivel, onActualizarNivel, onEliminarNivel, onDuplicarNivel,
  onVerPreguntas,
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg font-headline">{modoGuiado ? 'Bancos de preguntas' : 'Niveles de preguntas'}</h3>
        <button type="button" onClick={onAgregarNivel}
          className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/90 transition-all">
          <span className="material-symbols-outlined text-sm">add</span>
          {modoGuiado ? 'Agregar banco' : 'Agregar nivel'}
        </button>
      </div>

      <div className="p-3 bg-surface-container rounded-xl text-xs text-on-surface-variant">
        💡 <strong>¿Cuándo crear {modoGuiado ? 'bancos' : 'niveles'}?</strong> Si todos los usuarios ven las mismas preguntas, usa un solo {modoGuiado ? 'banco' : 'nivel'}. Si cada profesión o cargo tiene preguntas distintas, crea un {modoGuiado ? 'banco' : 'nivel'} por cada uno. Luego asigna cada {modoGuiado ? 'banco' : 'nivel'} a su {modoGuiado ? 'plan' : 'versión'} en la pestaña <strong>{labels.versiones}</strong>.
      </div>

      {niveles.map((nv, i) => (
        <NivelCard key={nv._id} nivel={nv} idx={i}
          onChange={datos => onActualizarNivel(nv._id, datos)}
          onDelete={() => onEliminarNivel(nv._id)}
          onDuplicate={() => onDuplicarNivel(nv)}
          preguntasCount={(preguntas[nv._id] || []).length}
          modoGuiado={modoGuiado}
          onVerPreguntas={() => onVerPreguntas(nv._id)}
        />
      ))}
    </div>
  )
}
