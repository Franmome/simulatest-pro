import Card from './Card'
import InputField from './InputField'
import HelpBox from './HelpBox'
import { INPUT_CLS } from './lib/constants'

export default function GeneralSection({
  form, setForm,
  categorias,
  showCatModal, setShowCatModal,
  nuevaCategoria, setNuevaCategoria,
  guardandoCat,
  onAgregarCategoria,
}) {
  return (
    <Card className="p-6 space-y-5">
      <h3 className="font-bold text-lg font-headline">Información del Paquete</h3>

      <InputField label="Nombre del paquete" required>
        <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="ej: Contraloría General de la República" className={INPUT_CLS} required />
      </InputField>

      <InputField label="Descripción" hint="Qué incluye este paquete">
        <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Describe qué cubre este paquete, áreas temáticas, cantidad de preguntas..." className={`${INPUT_CLS} resize-none`} />
      </InputField>

      <InputField label="Categoría">
        <div className="flex gap-2">
          <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className={`${INPUT_CLS} flex-1`}>
            <option value="">Sin categoría</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" onClick={() => setShowCatModal(true)}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
            <span className="material-symbols-outlined text-sm">add</span>
            Nueva
          </button>
        </div>
      </InputField>

      <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
        <div>
          <p className="text-sm font-bold">Publicar paquete</p>
          <p className="text-xs text-on-surface-variant">Visible en planes y disponible para compra</p>
        </div>
        <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
          className={`w-12 h-6 rounded-full transition-all relative ${form.is_active ? 'bg-secondary' : 'bg-outline-variant'}`}>
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.is_active ? 'right-0.5' : 'left-0.5'}`} />
        </button>
      </div>

      <HelpBox title="Cómo funciona esta sección" items={[
        'Aquí defines la información general del paquete que se publica en la plataforma.',
        'Si activas "Publicar paquete", aparecerá disponible para compra.',
        'La descripción debe explicar qué incluye: simulacros, módulos, videos y material.',
      ]} />

      {/* Modal: nueva categoría */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCatModal(false)}>
          <div className="bg-surface rounded-xl p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-1 text-lg">Nueva categoría</h3>
            <p className="text-xs text-on-surface-variant mb-4">La categoría se guardará y seleccionará automáticamente.</p>
            <input type="text" value={nuevaCategoria}
              onChange={e => setNuevaCategoria(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onAgregarCategoria() }}
              placeholder="ej: Contraloría, ICFES, Procuraduría..."
              className={INPUT_CLS} autoFocus />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setShowCatModal(false)}
                className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container rounded-xl">
                Cancelar
              </button>
              <button type="button" onClick={onAgregarCategoria} disabled={guardandoCat || !nuevaCategoria.trim()}
                className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-bold disabled:opacity-40 flex items-center gap-2">
                {guardandoCat && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
