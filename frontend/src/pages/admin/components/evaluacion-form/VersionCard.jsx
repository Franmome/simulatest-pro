import InputField from './InputField'
import { INPUT_CLS } from './lib/constants'

export default function VersionCard({
  version, idx, esModoSimple, modoGuiado, labels,
  niveles, profesiones,
  onActualizar, onEliminar, onDuplicar,
  onProfesionChange, onLevelChange,
  onShowProfModal,
}) {
  const levelSinResolver = version.level_display && !version.level_id
  const profSinResolver = version.profession_display && !version.profession_id

  return (
    <div className={`rounded-2xl border-2 p-5 space-y-4 ${!version.is_active ? 'border-outline-variant/10 opacity-60' : 'border-secondary/20'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-primary/10 text-primary">{idx + 1}</div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
            {esModoSimple ? (modoGuiado ? 'Plan único' : 'Versión única') : (modoGuiado ? 'Plan' : 'Versión')}
          </span>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onDuplicar}
            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Duplicar">
            <span className="material-symbols-outlined text-sm">content_copy</span>
          </button>
          <button type="button" onClick={onEliminar}
            className="p-1.5 text-error hover:bg-error-container/30 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {esModoSimple ? 'Nombre' : labels.profesion}
          </label>
          <input type="text" value={version.display_name}
            onChange={e => onActualizar(version.id, 'display_name', e.target.value)}
            placeholder={esModoSimple ? 'ej: Acceso Completo' : 'ej: Profesional Universitario'}
            className={INPUT_CLS} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Precio (COP)</label>
          <input type="number" value={version.price}
            onChange={e => onActualizar(version.id, 'price', parseInt(e.target.value || '0', 10))}
            placeholder="50000" className={INPUT_CLS} />
        </div>
      </div>

      {!esModoSimple && (
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Profesión asociada <span className="normal-case font-normal">(opcional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={version.profession_display || ''}
              onChange={e => onProfesionChange(version.id, e.target.value)}
              placeholder="ej: Abogado, Contador..."
              className={`${INPUT_CLS} flex-1 ${profSinResolver ? 'border-tertiary/50 ring-1 ring-tertiary/20' : ''}`}
              list={`profesiones-list-${version.id}`}
            />
            <datalist id={`profesiones-list-${version.id}`}>
              {profesiones.map(p => <option key={p.id} value={p.name} />)}
            </datalist>
            <button type="button" onClick={onShowProfModal}
              className="flex-shrink-0 px-3 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
          </div>
          {profSinResolver && (
            <p className="text-[10px] text-tertiary flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">warning</span>
              "{version.profession_display}" no existe. Créala con + o selecciónala de la lista.
            </p>
          )}
          {version.profession_id && !profSinResolver && (
            <p className="text-[10px] text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              Asociada: {version.profession_display}
            </p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          {labels.nivel} {version.is_active ? <span className="text-error">*</span> : ''}
        </label>
        <input
          type="text"
          value={version.level_display || ''}
          onChange={e => onLevelChange(version.id, e.target.value)}
          placeholder="Escribe el nombre del nivel y selecciónalo..."
          className={`${INPUT_CLS} ${levelSinResolver ? 'border-error/50 ring-1 ring-error/20' : version.level_id ? 'border-secondary/40 ring-1 ring-secondary/20' : ''}`}
          list={`niveles-list-${version.id}`}
        />
        <datalist id={`niveles-list-${version.id}`}>
          {niveles.map(n => <option key={n._id} value={n.name} />)}
        </datalist>
        {levelSinResolver && (
          <p className="text-[10px] text-error flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">error</span>
            "{version.level_display}" no coincide con ningún nivel. Selecciónalo de la lista o crea el nivel primero.
          </p>
        )}
        {version.level_id && !levelSinResolver && (
          <p className="text-[10px] text-secondary flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">check_circle</span>
            Nivel asignado: {version.level_display}
          </p>
        )}
        {!version.level_display && version.is_active && (
          <p className="text-[10px] text-error/70 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">info</span>
            Obligatorio para versiones activas. Escribe el nombre del nivel y selecciónalo de la lista.
          </p>
        )}
        {!version.level_display && !version.is_active && (
          <p className="text-[10px] text-on-surface-variant">Escribe el nombre del nivel y selecciónalo de la lista desplegable.</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
        <div className="text-sm font-extrabold text-primary">
          ${Number(version.price || 0).toLocaleString('es-CO')} COP
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <button type="button"
            onClick={() => onActualizar(version.id, 'is_active', !version.is_active)}
            className={`w-10 h-5 rounded-full relative transition-all ${version.is_active ? 'bg-secondary' : 'bg-outline-variant'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${version.is_active ? 'right-0.5' : 'left-0.5'}`} />
          </button>
          <span className="text-xs font-semibold text-on-surface-variant">
            {version.is_active ? 'Visible' : 'Oculta'}
          </span>
        </label>
      </div>
    </div>
  )
}
