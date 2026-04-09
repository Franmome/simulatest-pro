import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../utils/supabase'

// ── Círculo de score animado ──────────────────────────────────────────────────
function CirculoScore({ score, aprueba, passingScore }) {
  const [animScore, setAnimScore] = useState(0)
  const radio    = 54
  const circunf  = 2 * Math.PI * radio
  const progreso = (animScore / 100) * circunf
  const color    = aprueba ? '#1b6d24' : '#ba1a1a'

  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0
      const step = () => {
        start += 2
        setAnimScore(Math.min(start, score))
        if (start < score) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 300)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="relative w-44 h-44 flex items-center justify-center flex-shrink-0">
      <svg width="176" height="176" className="-rotate-90">
        {/* Track */}
        <circle cx="88" cy="88" r={radio} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="12" />
        {/* Puntaje mínimo indicador */}
        {passingScore && (
          <circle
            cx="88" cy="88" r={radio}
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="12"
            strokeDasharray={`2 ${circunf - 2}`}
            strokeDashoffset={-((passingScore / 100) * circunf)}
          />
        )}
        {/* Score */}
        <circle
          cx="88" cy="88" r={radio}
          fill="none"
          stroke="white"
          strokeWidth="12"
          strokeDasharray={`${progreso} ${circunf}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-extrabold font-headline text-white leading-none">
          {animScore}%
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-white/70 mt-1">
          {aprueba ? '✓ Aprobado' : '✗ No aprobó'}
        </span>
        {passingScore && (
          <span className="text-[10px] text-white/50 mt-1">
            Mínimo {passingScore}%
          </span>
        )}
      </div>
    </div>
  )
}

// ── Formato de duración ───────────────────────────────────────────────────────
function formatDuracion(startTime, endTime) {
  if (!startTime || !endTime) return null
  const ms  = new Date(endTime) - new Date(startTime)
  const min = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

// ── Tarjeta de pregunta en revisión ──────────────────────────────────────────
function TarjetaPregunta({ resp, idx, expandidoDefault = false }) {
  const [expandido, setExpandido] = useState(expandidoDefault)
  const pregunta       = resp.questions
  const opcionElegida  = pregunta?.options?.find(o => o.id === resp.selected_option_id)
  const opcionCorrecta = pregunta?.options?.find(o => o.is_correct)

  return (
    <div className={`card border-l-4 overflow-hidden transition-all ${
      resp.is_correct ? 'border-secondary' : 'border-error'
    }`}>
      {/* Header clickeable */}
      <button
        className="w-full p-5 flex items-start gap-3 text-left hover:bg-surface-container-high/30 transition-colors"
        onClick={() => setExpandido(e => !e)}
      >
        <span
          className={`material-symbols-outlined flex-shrink-0 mt-0.5 ${resp.is_correct ? 'text-secondary' : 'text-error'}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {resp.is_correct ? 'check_circle' : 'cancel'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
            Pregunta {idx + 1}
            {!resp.is_correct && opcionElegida && (
              <span className="ml-2 text-error normal-case font-normal">
                · Tu respuesta: <strong>{opcionElegida.letter}.</strong>
              </span>
            )}
            {!resp.selected_option_id && (
              <span className="ml-2 text-on-surface-variant normal-case font-normal italic">· Sin responder</span>
            )}
          </p>
          <p className="font-semibold text-on-surface leading-snug line-clamp-2">
            {pregunta?.text}
          </p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0 transition-transform"
          style={{ transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </button>

      {/* Detalle expandible */}
      {expandido && (
        <div className="px-5 pb-5 border-t border-outline-variant/20">
          {/* Opciones */}
          <div className="space-y-2 mt-4 mb-4">
            {pregunta?.options
              ?.slice()
              .sort((a, b) => (a.letter || '').localeCompare(b.letter || ''))
              .map(op => {
                const esElegida  = op.id === resp.selected_option_id
                const esCorrecta = op.is_correct

                let cls = 'p-3 rounded-xl border text-sm flex items-start gap-2 '
                if (esCorrecta && esElegida)  cls += 'border-secondary bg-secondary-container/40 font-semibold'
                else if (esCorrecta)          cls += 'border-secondary bg-secondary-container/20 font-semibold'
                else if (esElegida)           cls += 'border-error bg-error-container/20'
                else                          cls += 'border-outline-variant/20 opacity-40'

                return (
                  <div key={op.id} className={cls}>
                    <span className={`font-bold flex-shrink-0 w-5 ${
                      esCorrecta ? 'text-secondary' : esElegida ? 'text-error' : 'text-on-surface-variant'
                    }`}>
                      {op.letter}.
                    </span>
                    <span className="flex-1">{op.text}</span>
                    {esCorrecta && (
                      <span className="material-symbols-outlined text-secondary text-sm flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    )}
                    {esElegida && !esCorrecta && (
                      <span className="material-symbols-outlined text-error text-sm flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                    )}
                  </div>
                )
              })}
          </div>

          {/* Respuesta correcta si falló */}
          {!resp.is_correct && opcionCorrecta && (
            <div className="flex items-center gap-2 text-xs font-semibold text-secondary mb-3 bg-secondary-container/20 px-3 py-2 rounded-lg">
              <span className="material-symbols-outlined text-sm">check</span>
              Correcta: {opcionCorrecta.letter}. {opcionCorrecta.text}
            </div>
          )}

          {/* Explicación */}
          {pregunta?.explanation && (
            <div className="bg-surface-container p-4 rounded-xl border-l-4 border-primary/40">
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lightbulb</span>
                Explicación
              </p>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {pregunta.explanation}
              </p>
            </div>
          )}

          {!resp.selected_option_id && (
            <p className="text-xs text-on-surface-variant italic">No respondiste esta pregunta.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ResultadoFinal() {
  const navigate = useNavigate()
  const location = useLocation()
  const state    = location.state

  const [respuestas, setRespuestas]     = useState([])
  const [attemptData, setAttemptData]   = useState(null)
  const [loading, setLoading]           = useState(true)
  const [tabActiva, setTabActiva]       = useState('incorrectas')
  const [busqueda, setBusqueda]         = useState('')
  const [copiado, setCopiado]           = useState(false)
  const [expandirTodo, setExpandirTodo] = useState(false)

  useEffect(() => {
    if (!state?.attemptId) {
      navigate('/catalogo')
      return
    }
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      // Cargar attempt para tiempos reales
      const { data: attempt } = await supabase
        .from('attempts')
        .select('start_time, end_time, score')
        .eq('id', state.attemptId)
        .maybeSingle()

      setAttemptData(attempt)

      // Cargar respuestas con preguntas y opciones
      const { data, error } = await supabase
        .from('answers')
        .select(`
          id,
          is_correct,
          selected_option_id,
          questions(id, text, explanation,
            options(id, text, letter, is_correct)
          )
        `)
        .eq('attempt_id', state.attemptId)
        .order('id')

      if (error) throw error
      setRespuestas(data || [])
    } catch (err) {
      console.error('Error cargando respuestas:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!state?.attemptId) return null

  const {
    score,
    correctas,
    total,
    aprueba,
    nivelNombre,
    evalTitulo,
    levelId,
    passingScore,
  } = state

  const duracion    = attemptData ? formatDuracion(attemptData.start_time, attemptData.end_time) : null
  const incorrectas = respuestas.filter(r => !r.is_correct)
  const correctasList = respuestas.filter(r => r.is_correct)
  const sinResponder  = respuestas.filter(r => !r.selected_option_id)

  const listaBase = tabActiva === 'incorrectas' ? incorrectas
                  : tabActiva === 'correctas'   ? correctasList
                  : respuestas

  const lista = busqueda.trim()
    ? listaBase.filter(r =>
        r.questions?.text?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : listaBase

  function copiarResumen() {
    const texto = `SimulaTest Pro — ${evalTitulo}${nivelNombre ? ` · ${nivelNombre}` : ''}
Score: ${score}% (${aprueba ? 'Aprobado ✓' : 'No aprobó ✗'})
Correctas: ${correctas}/${total}
${duracion ? `Tiempo: ${duracion}` : ''}`
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="p-6 pb-24 max-w-4xl animate-fade-in">

      {/* ── Hero resultado ─────────────────────────────────────────────────── */}
      <div className={`rounded-3xl p-8 mb-6 ${
        aprueba
          ? 'bg-gradient-to-br from-secondary to-[#217128]'
          : 'bg-gradient-to-br from-error to-[#93000a]'
      }`}>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <CirculoScore score={score} aprueba={aprueba} passingScore={passingScore} />

          <div className="flex-1 text-center md:text-left">
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">
              {evalTitulo}{nivelNombre && ` · ${nivelNombre}`}
            </p>
            <h1 className="text-4xl font-extrabold font-headline text-white leading-tight mb-2">
              {aprueba ? '¡Felicitaciones!' : 'Sigue practicando'}
            </h1>
            <p className="text-white/80 text-base mb-5">
              {aprueba
                ? `Superaste el simulacro con ${score}% de aciertos.`
                : `Obtuviste ${score}%. Necesitas repasar algunos temas.`}
            </p>

            {/* Mini stats en el hero */}
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              {[
                { icon: 'check_circle', val: correctas,         label: 'correctas',   color: 'bg-white/20' },
                { icon: 'cancel',       val: total - correctas, label: 'incorrectas',  color: 'bg-white/10' },
                { icon: 'quiz',         val: total,             label: 'preguntas',    color: 'bg-white/10' },
                ...(duracion ? [{ icon: 'timer', val: duracion, label: 'duración', color: 'bg-white/10' }] : []),
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-2 px-4 py-2 rounded-full ${s.color} text-white`}>
                  <span className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                  <span className="font-bold text-sm">{s.val}</span>
                  <span className="text-white/60 text-xs">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Botón copiar resumen */}
          <button
            onClick={copiarResumen}
            className="flex-shrink-0 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Copiar resumen"
          >
            <span className="material-symbols-outlined text-xl">
              {copiado ? 'check' : 'content_copy'}
            </span>
          </button>
        </div>

        {/* Barra visual: puntaje mínimo vs obtenido */}
        {passingScore && (
          <div className="mt-6">
            <div className="flex justify-between text-xs text-white/60 mb-1">
              <span>0%</span>
              <span className="text-white/80">Mínimo: {passingScore}%</span>
              <span>100%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden relative">
              {/* Línea mínimo */}
              <div
                className="absolute top-0 h-full w-0.5 bg-white/50 z-10"
                style={{ left: `${passingScore}%` }}
              />
              {/* Tu puntaje */}
              <div
                className={`h-full rounded-full transition-all duration-1000 ${aprueba ? 'bg-white' : 'bg-white/60'}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Mensaje motivacional ─────────────────────────────────────────── */}
      {!aprueba && incorrectas.length > 0 && (
        <div className="card p-4 mb-6 flex items-start gap-3 border border-tertiary/30 bg-tertiary-container/20">
          <span className="material-symbols-outlined text-tertiary flex-shrink-0 mt-0.5"
            style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
          <div>
            <p className="font-semibold text-on-surface text-sm">
              Tienes {incorrectas.length} {incorrectas.length === 1 ? 'pregunta' : 'preguntas'} para repasar
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Revisa las explicaciones abajo — entender los errores es la clave para mejorar.
            </p>
          </div>
        </div>
      )}

      {sinResponder.length > 0 && (
        <div className="card p-4 mb-6 flex items-start gap-3 border border-error/30 bg-error-container/10">
          <span className="material-symbols-outlined text-error flex-shrink-0 mt-0.5">warning</span>
          <p className="text-sm text-on-surface">
            <strong>{sinResponder.length}</strong> {sinResponder.length === 1 ? 'pregunta quedó' : 'preguntas quedaron'} sin responder.
          </p>
        </div>
      )}

      {/* ── Revisión detallada ───────────────────────────────────────────── */}
      <div className="mb-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-xl font-bold font-headline flex-shrink-0">Revisión detallada</h2>

          <div className="flex gap-1 flex-wrap">
            {[
              { key: 'incorrectas', label: `Incorrectas`, count: incorrectas.length },
              { key: 'correctas',   label: `Correctas`,   count: correctasList.length },
              { key: 'todas',       label: `Todas`,       count: respuestas.length },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setTabActiva(t.key); setBusqueda('') }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                  tabActiva === t.key
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                {t.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  tabActiva === t.key ? 'bg-white/20' : 'bg-surface-container-highest'
                }`}>{t.count}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Búsqueda */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar pregunta…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-9 pr-3 py-2 text-xs bg-surface-container-high rounded-full border border-outline-variant/30 focus:outline-none focus:border-primary w-44"
              />
            </div>

            {/* Expandir todo */}
            <button
              onClick={() => setExpandirTodo(e => !e)}
              className="p-2 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant transition-all"
              title={expandirTodo ? 'Contraer todo' : 'Expandir todo'}
            >
              <span className="material-symbols-outlined text-sm">
                {expandirTodo ? 'unfold_less' : 'unfold_more'}
              </span>
            </button>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-6 animate-pulse space-y-3">
                <div className="h-3 bg-surface-container-high rounded w-3/4" />
                <div className="h-3 bg-surface-container-high rounded w-full" />
                <div className="h-3 bg-surface-container-high rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : lista.length === 0 ? (
          <div className="card p-10 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">
              {busqueda ? 'search_off' : tabActiva === 'incorrectas' ? 'celebration' : 'quiz'}
            </span>
            <p className="font-semibold">
              {busqueda
                ? 'Sin resultados para esa búsqueda'
                : tabActiva === 'incorrectas'
                  ? '¡Sin errores! Perfecto puntaje en esta categoría.'
                  : 'No hubo respuestas correctas'}
            </p>
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="mt-3 text-xs text-primary underline"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Contador de resultados si hay búsqueda */}
            {busqueda && (
              <p className="text-xs text-on-surface-variant mb-2">
                {lista.length} resultado{lista.length !== 1 ? 's' : ''} para "{busqueda}"
              </p>
            )}
            {lista.map((resp, idx) => (
              <TarjetaPregunta
                key={resp.id}
                resp={resp}
                idx={listaBase.indexOf(resp)}
                expandidoDefault={expandirTodo || tabActiva === 'incorrectas' && incorrectas.length <= 5}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Acciones finales ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
        <button
          onClick={() => navigate('/catalogo')}
          className="py-3 px-5 bg-surface-container-high text-on-surface font-bold rounded-full hover:bg-surface-container-highest transition-all flex items-center justify-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-lg">grid_view</span>
          Catálogo
        </button>

        <button
          onClick={() => levelId
            ? navigate(`/simulacro/${levelId}`)
            : navigate(-2)
          }
          className="py-3 px-5 btn-primary flex items-center justify-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-lg">replay</span>
          Intentar de nuevo
        </button>

        <button
          onClick={() => navigate('/perfil')}
          className="py-3 px-5 border border-primary text-primary font-bold rounded-full hover:bg-primary-fixed transition-all flex items-center justify-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-lg">bar_chart</span>
          Mi progreso
        </button>
      </div>

      {/* Nota al pie */}
      <p className="text-center text-xs text-on-surface-variant mt-6 opacity-60">
        Resultado guardado automáticamente · {new Date().toLocaleDateString('es-CO', { dateStyle: 'medium' })}
      </p>
    </div>
  )
}