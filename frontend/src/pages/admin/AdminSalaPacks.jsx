import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'

const EJEMPLO_JSON = `[
  {
    "texto": "¿Cuál es la norma que regula el servicio civil en Colombia?",
    "opciones": [
      { "letra": "A", "texto": "Ley 909 de 2004",    "es_correcta": true  },
      { "letra": "B", "texto": "Decreto 1083 de 2015","es_correcta": false },
      { "letra": "C", "texto": "Ley 443 de 1998",    "es_correcta": false },
      { "letra": "D", "texto": "Ley 27 de 1992",     "es_correcta": false }
    ]
  }
]`

export default function AdminSalaPacks() {
  const [packs,    setPacks]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)   // null | 'crear' | pack (editar)
  const [form,     setForm]     = useState({ nombre: '', descripcion: '', preguntas_json: '', is_active: false })
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [jsonErr,  setJsonErr]  = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('sala_packs')
      .select('id, nombre, descripcion, is_active, created_at, preguntas')
      .order('created_at', { ascending: false })
    setPacks(data || [])
    setLoading(false)
  }

  function abrirCrear() {
    setForm({ nombre: '', descripcion: '', preguntas_json: EJEMPLO_JSON, is_active: false })
    setError(''); setJsonErr('')
    setModal('crear')
  }

  function abrirEditar(pack) {
    setForm({
      nombre:        pack.nombre,
      descripcion:   pack.descripcion || '',
      preguntas_json: JSON.stringify(pack.preguntas, null, 2),
      is_active:     pack.is_active,
    })
    setError(''); setJsonErr('')
    setModal(pack)
  }

  function validarJson(txt) {
    try {
      const p = JSON.parse(txt)
      if (!Array.isArray(p))               { setJsonErr('Debe ser un array JSON [...]'); return null }
      if (!p.length)                        { setJsonErr('El array no puede estar vacío'); return null }
      for (const [i, q] of p.entries()) {
        if (!q.texto?.trim())               { setJsonErr(`Pregunta ${i+1}: falta "texto"`); return null }
        if (!Array.isArray(q.opciones) || q.opciones.length < 2)
                                            { setJsonErr(`Pregunta ${i+1}: necesita al menos 2 opciones`); return null }
        if (!q.opciones.some(o => o.es_correcta))
                                            { setJsonErr(`Pregunta ${i+1}: ninguna opción marcada como correcta`); return null }
      }
      setJsonErr('')
      return p
    } catch (e) {
      setJsonErr('JSON inválido: ' + e.message)
      return null
    }
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    const preguntas = validarJson(form.preguntas_json)
    if (!preguntas) return
    setSaving(true); setError('')
    try {
      const payload = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), preguntas, is_active: form.is_active }
      const { error: err } = modal === 'crear'
        ? await supabase.from('sala_packs').insert(payload)
        : await supabase.from('sala_packs').update(payload).eq('id', modal.id)
      if (err) throw err
      setModal(null)
      await cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivo(pack) {
    await supabase.from('sala_packs').update({ is_active: !pack.is_active }).eq('id', pack.id)
    setPacks(prev => prev.map(p => p.id === pack.id ? { ...p, is_active: !p.is_active } : p))
  }

  async function eliminar(pack) {
    if (!window.confirm(`¿Eliminar "${pack.nombre}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('sala_packs').delete().eq('id', pack.id)
    setPacks(prev => prev.filter(p => p.id !== pack.id))
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm'
  const numPregs = (json) => { try { const p = JSON.parse(json); return Array.isArray(p) ? p.length : 0 } catch { return 0 } }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Packs para Salas</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Conjuntos de preguntas que los usuarios eligen al crear una sala de competencia</p>
        </div>
        <button onClick={abrirCrear}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-sm">add</span>Nuevo pack
        </button>
      </div>

      {/* SQL hint */}
      <div className="card p-4 mb-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-600 text-sm shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
          <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-bold">Migración requerida en Supabase SQL Editor:</p>
            <code className="block bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded font-mono text-[10px] leading-relaxed">
              {`CREATE TABLE IF NOT EXISTS sala_packs (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, nombre text NOT NULL, descripcion text DEFAULT '', preguntas jsonb NOT NULL DEFAULT '[]', is_active boolean DEFAULT false, created_at timestamptz DEFAULT now());`}
              <br />
              {`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS sala_pack_id uuid REFERENCES sala_packs(id);`}
              <br />
              {`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS orden text DEFAULT 'aleatorio';`}
              <br />
              {`ALTER TABLE rooms ALTER COLUMN level_id DROP NOT NULL;`}
            </code>
            <p>Si ya ejecutaste esta migración puedes ignorar este mensaje.</p>
          </div>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : packs.length === 0 ? (
        <div className="card p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl mb-3 block opacity-20">sports_esports</span>
          <p className="font-semibold">No hay packs aún</p>
          <p className="text-xs mt-1">Crea el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packs.map(pack => (
            <div key={pack.id} className="card p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${pack.is_active ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>sports_esports</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm truncate">{pack.nombre}</p>
                  {pack.is_active
                    ? <span className="text-[10px] font-bold bg-secondary text-white px-2 py-0.5 rounded-full shrink-0">Publicado</span>
                    : <span className="text-[10px] font-bold bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full shrink-0">Borrador</span>
                  }
                </div>
                {pack.descripcion && <p className="text-xs text-on-surface-variant mt-0.5 truncate">{pack.descripcion}</p>}
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {Array.isArray(pack.preguntas) ? pack.preguntas.length : 0} preguntas
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleActivo(pack)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border-2 transition-all active:scale-95
                    ${pack.is_active ? 'border-error text-error hover:bg-error-container/20' : 'border-secondary text-secondary hover:bg-secondary-container/30'}`}>
                  {pack.is_active ? 'Despublicar' : 'Publicar'}
                </button>
                <button onClick={() => abrirEditar(pack)}
                  className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant transition-colors">
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                <button onClick={() => eliminar(pack)}
                  className="p-2 rounded-xl hover:bg-error-container/30 text-error transition-colors">
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col">
            <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between shrink-0">
              <h2 className="font-extrabold text-lg">{modal === 'crear' ? 'Nuevo pack' : 'Editar pack'}</h2>
              <button onClick={() => setModal(null)} className="p-1 rounded-full hover:bg-surface-container">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-error-container/30 rounded-xl border border-error/20 text-error text-sm font-bold">
                  <span className="material-symbols-outlined text-sm">error</span>{error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nombre del pack</label>
                <input value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej. Razonamiento Lógico CNSC 2024"
                  className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Descripción (opcional)</label>
                <input value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Breve descripción del contenido"
                  className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Preguntas (JSON)</label>
                  <span className="text-[11px] text-secondary font-bold">
                    {numPregs(form.preguntas_json) > 0 ? `${numPregs(form.preguntas_json)} preguntas` : ''}
                  </span>
                </div>
                <textarea
                  value={form.preguntas_json}
                  onChange={e => { setForm(f => ({ ...f, preguntas_json: e.target.value })); setJsonErr('') }}
                  rows={14}
                  spellCheck={false}
                  className={`${inputCls} font-mono text-xs resize-y`}
                />
                {jsonErr && (
                  <p className="text-xs text-error font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>{jsonErr}
                  </p>
                )}
                <div className="bg-surface-container-low rounded-xl p-3 text-[10px] text-on-surface-variant space-y-1">
                  <p className="font-bold text-on-surface">Formato requerido por pregunta:</p>
                  <p><code>texto</code> — string con el enunciado</p>
                  <p><code>opciones</code> — array con: <code>letra</code> (A/B/C/D), <code>texto</code>, <code>es_correcta</code> (boolean)</p>
                  <p>Exactamente una opción debe tener <code>"es_correcta": true</code></p>
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-primary shrink-0" />
                <div>
                  <p className="text-sm font-bold">Publicar inmediatamente</p>
                  <p className="text-xs text-on-surface-variant">Los usuarios verán este pack al crear una sala</p>
                </div>
              </label>
            </div>

            <div className="p-5 border-t border-outline-variant/20 flex gap-3 shrink-0">
              <button onClick={() => setModal(null)}
                className="flex-1 py-3 border border-outline-variant rounded-xl font-bold text-sm">
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {saving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : modal === 'crear' ? 'Crear pack' : 'Guardar cambios'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
