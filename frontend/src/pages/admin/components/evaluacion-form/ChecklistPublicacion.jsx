import Card from './Card'

export default function ChecklistPublicacion({ form, versiones, niveles, preguntas, materiales, modoGuiado }) {
  const versionesActivas = versiones.filter(v => v.is_active)
  const tieneNombre = Boolean(form.title?.trim())
  const tieneVersionesActivas = versionesActivas.length > 0
  const todasVersionesConPrecio = versionesActivas.every(v => v.price && v.price > 0)
  const todasVersionesConNivel = versionesActivas.every(v => v.level_id)
  const nivelesConPreguntasValidas = niveles.every(nv => {
    const pregs = preguntas[nv._id] || []
    return pregs.length > 0 && pregs.some(p => p.text?.trim())
  })
  const tieneMateriales = materiales.length > 0
  const categoriaAsignada = Boolean(form.category_id)

  const items = [
    { label: modoGuiado ? 'Nombre del plan' : 'Nombre del paquete', ok: tieneNombre },
    { label: modoGuiado ? 'Al menos un plan activo' : 'Al menos una versión activa', ok: tieneVersionesActivas },
    { label: modoGuiado ? 'Precio válido en todos los planes' : 'Precio válido en todas las versiones', ok: todasVersionesConPrecio },
    { label: modoGuiado ? 'Banco de preguntas asignado a cada plan' : 'Nivel asignado a cada versión activa', ok: todasVersionesConNivel },
    { label: 'Preguntas válidas en todos los bancos', ok: nivelesConPreguntasValidas },
    { label: modoGuiado ? 'Recursos de apoyo (opcional)' : 'Material de estudio (opcional)', ok: tieneMateriales, optional: true },
    { label: 'Categoría asignada (recomendado)', ok: categoriaAsignada, optional: true },
  ]

  const completados = items.filter(i => i.ok).length
  const total = items.length

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-sm">✅ Checklist para publicar</h4>
        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">
          {completados}/{total}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className={`material-symbols-outlined text-base ${item.ok ? 'text-secondary' : item.optional ? 'text-on-surface-variant' : 'text-error'}`}>
              {item.ok ? 'check_circle' : item.optional ? 'radio_button_unchecked' : 'cancel'}
            </span>
            <span className={item.ok ? 'text-on-surface' : 'text-on-surface-variant'}>
              {item.label}
              {item.optional && <span className="text-[10px] ml-1 text-on-surface-variant">(opcional)</span>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
