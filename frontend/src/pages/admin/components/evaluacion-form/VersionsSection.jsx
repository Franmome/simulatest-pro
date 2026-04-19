import Card from './Card'
import HelpBox from './HelpBox'
import VersionCard from './VersionCard'
import { INPUT_CLS } from './lib/constants'

export default function VersionsSection({
  id, pkgId, versiones, niveles, profesiones,
  modoVersiones, setModoVersiones,
  modoGuiado, labels,
  showProfModal, setShowProfModal,
  nuevaProfesion, setNuevaProfesion,
  onAgregarVersion,
  onDuplicarVersion,
  onActualizarVersion,
  onEliminarVersion,
  onProfesionChange,
  onLevelChange,
  onAgregarProfesion,
}) {
  const esModoSimple = modoVersiones === 'simple'

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg font-headline">{labels.versiones}</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {!id && !pkgId ? 'Guarda el paquete primero para agregar versiones.' : 'Cada versión puede representar una profesión, cargo o acceso especial.'}
          </p>
        </div>
        {id && (
          <button type="button" onClick={onAgregarVersion}
            className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/90 transition-all">
            <span className="material-symbols-outlined text-sm">add</span>
            + {modoGuiado ? 'Plan' : 'Versión'}
          </button>
        )}
      </div>

      <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/15 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold">Modo de configuración</p>
            <p className="text-xs text-on-surface-variant">
              {esModoSimple
                ? 'Simple: un solo precio global para todo el paquete.'
                : 'Avanzado: múltiples versiones con precios independientes por profesión o cargo.'}
            </p>
          </div>
          <div className="flex bg-surface-container-high rounded-full p-1">
            {['simple', 'avanzado'].map(modo => (
              <button key={modo} type="button" onClick={() => setModoVersiones(modo)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all capitalize ${modoVersiones === modo ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>
                {modo}
              </button>
            ))}
          </div>
        </div>
      </div>

      <HelpBox title="Cómo funcionan las versiones" items={[
        'Cada versión representa un cargo, profesión o perfil de acceso.',
        'Cada versión debe tener nombre, precio y nivel de preguntas asignado.',
        'El nivel define qué preguntas ve el usuario al comprar esta versión.',
        'Escribe el nombre del nivel: si coincide exactamente, se asigna automáticamente. Si no, selecciónalo de la lista.',
      ]} />

      {id && versiones.map((version, idx) => {
        if (esModoSimple && idx > 0) return null
        return (
          <VersionCard
            key={version.id}
            version={version}
            idx={idx}
            esModoSimple={esModoSimple}
            modoGuiado={modoGuiado}
            labels={labels}
            niveles={niveles}
            profesiones={profesiones}
            onActualizar={onActualizarVersion}
            onEliminar={() => onEliminarVersion(version.id)}
            onDuplicar={() => onDuplicarVersion(version)}
            onProfesionChange={onProfesionChange}
            onLevelChange={onLevelChange}
            onShowProfModal={() => setShowProfModal(true)}
          />
        )
      })}

      {/* Modal: nueva profesión */}
      {showProfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowProfModal(false)}>
          <div className="bg-surface rounded-xl p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-1 text-lg">Nueva profesión</h3>
            <p className="text-xs text-on-surface-variant mb-4">Se creará en la base y podrás asignarla a versiones.</p>
            <input type="text" value={nuevaProfesion}
              onChange={e => setNuevaProfesion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onAgregarProfesion() }}
              placeholder="Ej: Abogado, Contador..."
              className={INPUT_CLS} autoFocus />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setShowProfModal(false)}
                className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container rounded-xl">
                Cancelar
              </button>
              <button type="button" onClick={onAgregarProfesion}
                className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-bold">
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
