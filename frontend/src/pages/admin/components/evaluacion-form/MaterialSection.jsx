import Card from './Card'
import InputField from './InputField'
import { INPUT_CLS } from './lib/constants'
import { iconoMaterial } from './lib/helpers'

export default function MaterialSection({
  id, pkgId, materiales, versiones,
  nuevoMat, setNuevoMat,
  matError, setMatError,
  guardandoMat,
  onAgregarMaterial,
  onEliminarMaterial,
}) {
  const carpetas = [...new Set(materiales.map(m => m.folder))]

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-lg font-headline">Material de Estudio</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          {!id && !pkgId ? 'Guarda el paquete primero para agregar material.' : 'Sube archivos o agrega enlaces externos. El material se asigna a todas las versiones activas.'}
        </p>
      </div>

      {matError && (
        <div className="flex items-start gap-3 p-4 bg-error-container rounded-xl border border-error/30">
          <span className="material-symbols-outlined text-on-error-container text-lg flex-shrink-0">error</span>
          <p className="text-sm text-on-error-container font-medium flex-1">{matError}</p>
          <button type="button" onClick={() => setMatError(null)} className="text-on-error-container/70 hover:text-on-error-container">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {!id && !pkgId ? (
        <div className="p-8 text-center text-on-surface-variant bg-surface-container rounded-xl">
          <span className="material-symbols-outlined text-3xl opacity-40 mb-2 block">lock</span>
          <p className="text-sm font-semibold">Guarda el paquete primero</p>
        </div>
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">add_circle</span>
              Agregar nuevo recurso
            </h4>

            <div className="space-y-3">
              <div className="flex gap-2 p-1 bg-surface-container rounded-full">
                <button type="button"
                  onClick={() => setNuevoMat(m => ({ ...m, source_type: 'upload', url: '', file: null }))}
                  className={`flex-1 py-2 rounded-full text-xs font-bold transition flex items-center justify-center gap-1 ${nuevoMat.source_type === 'upload' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  Subir archivo
                </button>
                <button type="button"
                  onClick={() => setNuevoMat(m => ({ ...m, source_type: 'link', file: null }))}
                  className={`flex-1 py-2 rounded-full text-xs font-bold transition flex items-center justify-center gap-1 ${nuevoMat.source_type === 'link' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-sm">link</span>
                  Pegar enlace
                </button>
              </div>

              {nuevoMat.source_type === 'upload' ? (
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${nuevoMat.file ? 'border-secondary bg-secondary-container/10' : 'border-outline-variant hover:border-primary'}`}>
                  <input type="file" accept=".pdf,.doc,.docx,.mp4,.mov,.avi,.jpg,.jpeg,.png,.xlsx,.pptx"
                    onChange={e => {
                      const file = e.target.files[0]
                      if (!file) return
                      let tipo = nuevoMat.type
                      if (file.type.includes('pdf')) tipo = 'pdf'
                      else if (file.type.includes('video')) tipo = 'video'
                      else if (file.type.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) tipo = 'doc'
                      setMatError(null)
                      setNuevoMat(m => ({ ...m, file, type: tipo, title: m.title || file.name.replace(/\.[^.]+$/, '') }))
                    }}
                    className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    {nuevoMat.file ? (
                      <div className="space-y-1">
                        <span className="material-symbols-outlined text-3xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {iconoMaterial(nuevoMat.type)}
                        </span>
                        <p className="text-sm font-bold text-secondary">{nuevoMat.file.name}</p>
                        <p className="text-xs text-on-surface-variant">{(nuevoMat.file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <p className="text-[10px] text-primary underline cursor-pointer">Cambiar archivo</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="material-symbols-outlined text-3xl text-primary">upload_file</span>
                        <p className="text-sm font-bold">Haz clic para seleccionar</p>
                        <p className="text-xs text-on-surface-variant">PDF, Word, Excel, PowerPoint, Videos (máx. 50MB)</p>
                      </div>
                    )}
                  </label>
                  {nuevoMat.uploading && (
                    <div className="mt-3 w-full bg-surface-container-high rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${nuevoMat.uploadProgress || 30}%` }} />
                    </div>
                  )}
                </div>
              ) : (
                <InputField label="URL / Link externo" required>
                  <input type="url" value={nuevoMat.url}
                    onChange={e => { setMatError(null); setNuevoMat(m => ({ ...m, url: e.target.value })) }}
                    placeholder="https://drive.google.com/... o https://youtube.com/..."
                    className={INPUT_CLS} />
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    Útil para videos de YouTube, documentos de Drive, páginas web, etc.
                  </p>
                </InputField>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField label="Título" required>
                  <input type="text" value={nuevoMat.title}
                    onChange={e => setNuevoMat(m => ({ ...m, title: e.target.value }))}
                    placeholder="ej: Guía de Control Fiscal" className={INPUT_CLS} />
                </InputField>
                <InputField label="Tipo de recurso">
                  <select value={nuevoMat.type}
                    onChange={e => setNuevoMat(m => ({ ...m, type: e.target.value }))}
                    className={INPUT_CLS}>
                    <option value="pdf">📄 PDF</option>
                    <option value="video">🎥 Video</option>
                    <option value="link">🔗 Link externo</option>
                    <option value="doc">📝 Documento Word/Excel</option>
                  </select>
                </InputField>
                <InputField label="Carpeta" hint="Para organizar">
                  <input type="text" value={nuevoMat.folder}
                    onChange={e => setNuevoMat(m => ({ ...m, folder: e.target.value }))}
                    placeholder="ej: Módulo 1, Videos..." className={INPUT_CLS}
                    list="carpetas-existentes" />
                  <datalist id="carpetas-existentes">{carpetas.map(c => <option key={c} value={c} />)}</datalist>
                </InputField>
                <InputField label="Descripción" hint="Opcional">
                  <input type="text" value={nuevoMat.description}
                    onChange={e => setNuevoMat(m => ({ ...m, description: e.target.value }))}
                    placeholder="Breve descripción..." className={INPUT_CLS} />
                </InputField>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
                <div>
                  <p className="text-sm font-bold">Material compartido</p>
                  <p className="text-xs text-on-surface-variant">Visible para todas las versiones activas del paquete.</p>
                </div>
                <button type="button" onClick={() => setNuevoMat(m => ({ ...m, is_shared: !m.is_shared }))}
                  className={`w-12 h-6 rounded-full transition-all relative ${nuevoMat.is_shared ? 'bg-secondary' : 'bg-outline-variant'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${nuevoMat.is_shared ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              <button type="button" onClick={onAgregarMaterial}
                disabled={guardandoMat || !nuevoMat.title.trim() || (nuevoMat.source_type === 'link' && !nuevoMat.url.trim()) || (nuevoMat.source_type === 'upload' && !nuevoMat.file)}
                className="w-full py-3 bg-secondary text-on-secondary rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-secondary/90 transition-all flex items-center justify-center gap-2">
                {guardandoMat
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Subiendo...</>
                  : <><span className="material-symbols-outlined text-sm">add</span>Agregar recurso</>}
              </button>
            </div>
          </Card>

          {materiales.length === 0 ? (
            <div className="p-10 text-center text-on-surface-variant bg-surface-container rounded-2xl">
              <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">folder_open</span>
              <p className="font-semibold text-sm">Sin material agregado</p>
              <p className="text-xs mt-1 opacity-70">Sube un archivo o pega un enlace externo arriba</p>
            </div>
          ) : (
            carpetas.map(carpeta => (
              <div key={carpeta}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                  <h4 className="font-extrabold text-sm uppercase tracking-widest text-primary">{carpeta}</h4>
                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                    {materiales.filter(m => m.folder === carpeta).length}
                  </span>
                </div>
                <div className="space-y-2">
                  {materiales.filter(m => m.folder === carpeta).map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/15">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.type === 'pdf' ? 'bg-red-50 text-red-500' : m.type === 'video' ? 'bg-blue-50 text-blue-600' : m.type === 'link' ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-600'}`}>
                        <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{iconoMaterial(m.type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm truncate">{m.title}</p>
                          {m.is_shared && <span className="text-[10px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-bold">Compartido</span>}
                          {m.source_type === 'upload' && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Archivo local</span>}
                          {m.source_type === 'link' && <span className="text-[10px] bg-tertiary/10 text-tertiary px-2 py-0.5 rounded-full font-bold">Enlace externo</span>}
                        </div>
                        {m.description && <p className="text-xs text-on-surface-variant truncate">{m.description}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <a href={m.url} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline truncate">
                            {m.source_type === 'upload' ? 'Descargar archivo' : 'Abrir enlace'}
                          </a>
                          {m.file_size > 0 && (
                            <span className="text-[10px] text-on-surface-variant">{(m.file_size / 1024 / 1024).toFixed(1)} MB</span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => onEliminarMaterial(m.id)}
                        className="p-1.5 text-error hover:bg-error-container/30 rounded-lg transition-colors flex-shrink-0">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}
