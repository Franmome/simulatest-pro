import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { useFetch } from '../hooks/useFetch'

const ICONOS_CATEGORIA = {
  'CNSC': 'gavel', 'ICFES': 'school', 'Saber Pro': 'history_edu',
  'Procuraduría': 'balance', 'Contraloría': 'account_balance',
  'Defensoría': 'shield', 'DIAN': 'receipt_long', 'TyT': 'engineering',
}
const COLORES_CATEGORIA = {
  'CNSC': 'from-primary to-primary-container',
  'ICFES': 'from-tertiary to-tertiary-container',
  'Saber Pro': 'from-secondary to-[#217128]',
  'Procuraduría': 'from-[#003d9b] to-[#1b6d24]',
  'Contraloría': 'from-primary to-[#0052cc]',
  'Defensoría': 'from-slate-400 to-slate-500',
  'DIAN': 'from-[#b45309] to-[#92400e]',
  'TyT': 'from-[#6d28d9] to-[#4c1d95]',
}
const inputCls = "w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"

function formatTiempo(m) {
  if (!m) return '—'
  if (m >= 60) return `${Math.floor(m/60)}h ${m%60>0?`${m%60}m`:''}`.trim()
  return `${m}m`
}
function tiempoRelativo(fecha) {
  const d = Math.floor((Date.now()-new Date(fecha))/1000)
  if (d<3600) return `hace ${Math.floor(d/60)} min`
  if (d<86400) return `hace ${Math.floor(d/3600)} h`
  if (d<604800) return `hace ${Math.floor(d/86400)} días`
  return new Date(fecha).toLocaleDateString('es-CO')
}
function iconoMaterial(t){return{pdf:'picture_as_pdf',video:'play_circle',link:'link',doc:'description'}[t]||'attachment'}
function colorMaterial(t){return{pdf:'text-red-500 bg-red-50',video:'text-blue-600 bg-blue-50',link:'text-primary bg-primary/10',doc:'text-amber-600 bg-amber-50'}[t]||'text-on-surface-variant bg-surface-container'}

function TabMaterial({packageId,tienePlan}){
  const {data,loading,error,retry}=useFetch(async()=>{
    if(!packageId) return []
    const {data,error}=await supabase.from('study_materials').select('*').eq('package_id',packageId).eq('is_active',true).order('folder').order('sort_order')
    if(error) throw new Error(error.message)
    return data||[]
  },[packageId])
  const materiales=data||[]
  const carpetas=materiales.reduce((a,m)=>{if(!a[m.folder])a[m.folder]=[];a[m.folder].push(m);return a},{})
  if(!tienePlan) return(
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-primary text-3xl" style={{fontVariationSettings:"'FILL' 1"}}>lock</span>
      </div>
      <h3 className="font-extrabold text-lg mb-2">Contenido exclusivo</h3>
      <p className="text-on-surface-variant text-sm max-w-xs">Adquiere el paquete para acceder a todo el material de estudio incluido.</p>
    </div>
  )
  if(loading) return <div className="space-y-4 animate-pulse">{[1,2,3].map(i=><div key={i} className="h-24 bg-surface-container-high rounded-2xl"/>)}</div>
  if(error) return(
    <div className="flex flex-col items-center gap-3 py-12">
      <span className="material-symbols-outlined text-error text-4xl">error</span>
      <p className="text-sm text-on-surface-variant">{error}</p>
      <button onClick={retry} className="text-primary text-sm font-bold underline">Reintentar</button>
    </div>
  )
  if(materiales.length===0) return(
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-on-surface-variant text-3xl">folder_open</span>
      </div>
      <h3 className="font-bold text-lg mb-1">Sin material aún</h3>
      <p className="text-on-surface-variant text-sm">El equipo está preparando el contenido. Pronto estará disponible.</p>
    </div>
  )
  return(
    <div className="space-y-6">
      {Object.entries(carpetas).map(([carpeta,items])=>(
        <div key={carpeta}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary text-lg" style={{fontVariationSettings:"'FILL' 1"}}>folder</span>
            <h3 className="font-extrabold text-sm uppercase tracking-widest text-primary">{carpeta}</h3>
            <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{items.length}</span>
          </div>
          <div className="space-y-2">
            {items.map(m=>(
              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 hover:border-primary/30 hover:shadow-md transition-all group">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMaterial(m.type)}`}>
                  <span className="material-symbols-outlined text-xl" style={{fontVariationSettings:"'FILL' 1"}}>{iconoMaterial(m.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm group-hover:text-primary transition-colors truncate">{m.title}</p>
                  {m.description&&<p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{m.description}</p>}
                </div>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors flex-shrink-0">open_in_new</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DetallePrueba(){
  const navigate=useNavigate()
  const {id}=useParams()
  const {user}=useAuth()
  const [tabActiva,setTabActiva]=useState('simulacro')
  const [nivelSeleccionado,setNivelSeleccionado]=useState(null)
  const [modalModo,setModalModo]=useState(null)
  const [modalConfirm,setModalConfirm]=useState(false)
  const [configPractica,setConfigPractica]=useState({orden:'aleatorio',cantidad:20,cantidad_custom:'',tipo_cantidad:'preset',con_retro:true,timer_pregunta:90})
  const [configExamen,setConfigExamen]=useState({cantidad:0,cantidad_custom:'',tipo_cantidad:'all'})

  const {data,loading,error,retry}=useFetch(async()=>{
    const {data:evalData,error:evalErr}=await supabase.from('evaluations').select('*, categories(id, name)').eq('id',id).maybeSingle()
    if(evalErr) throw new Error(evalErr.message)
    if(!evalData) throw new Error('Evaluación no encontrada')
    const {data:levels,error:levErr}=await supabase.from('levels').select('id, name, description, time_limit, passing_score, sort_order').eq('evaluation_id',id).order('sort_order',{ascending:true})
    if(levErr) throw new Error(levErr.message)
    const niveles=levels||[]
    let pregsPorNivel={},totalPregs=0
    if(niveles.length){
      const {data:qCounts}=await supabase.from('questions').select('level_id').in('level_id',niveles.map(l=>l.id))
      ;(qCounts||[]).forEach(q=>{pregsPorNivel[q.level_id]=(pregsPorNivel[q.level_id]||0)+1})
      totalPregs=Object.values(pregsPorNivel).reduce((s,c)=>s+c,0)
    }
    let intentosPorNivel={}
    if(user?.id&&niveles.length){
      const {data:intentosData}=await supabase.from('attempts').select('id, level_id, score, status, start_time').eq('user_id',user.id).in('level_id',niveles.map(l=>l.id)).order('start_time',{ascending:false})
      ;(intentosData||[]).forEach(i=>{if(!intentosPorNivel[i.level_id])intentosPorNivel[i.level_id]=i})
    }
    let tienePlan=false,packageId=null
    if(user?.id){
      const {data:compra}=await supabase.from('purchases').select('package_id').eq('user_id',user.id).eq('status','active').gte('end_date',new Date().toISOString()).order('end_date',{ascending:false}).limit(1).maybeSingle()
      if(compra){tienePlan=true;packageId=compra.package_id}
    }
    return {ev:evalData,niveles,pregsPorNivel,intentosPorNivel,totalPregs,tienePlan,packageId}
  },[id,user?.id])

  const ev=data?.ev??null
  const niveles=data?.niveles??[]
  const pregsPorNivel=data?.pregsPorNivel??{}
  const intentosPorNivel=data?.intentosPorNivel??{}
  const totalPregs=data?.totalPregs??0
  const tienePlan=data?.tienePlan??false
  const packageId=data?.packageId??null
  const nivelActual=nivelSeleccionado??(niveles.length?niveles[0]:null)
  const pregsNivel=nivelActual?(pregsPorNivel[nivelActual.id]||0):0
  const intentoActual=nivelActual?intentosPorNivel[nivelActual.id]:null
  const cantPracticaDisplay=configPractica.tipo_cantidad==='all'?pregsNivel:configPractica.tipo_cantidad==='custom'?(parseInt(configPractica.cantidad_custom)>0?Math.min(parseInt(configPractica.cantidad_custom),pregsNivel):null):Math.min(configPractica.cantidad,pregsNivel)
  const cantPractica=cantPracticaDisplay??Math.min(configPractica.cantidad,pregsNivel)
  const cantExamenDisplay=configExamen.tipo_cantidad==='all'?pregsNivel:configExamen.tipo_cantidad==='custom'?(parseInt(configExamen.cantidad_custom)>0?Math.min(parseInt(configExamen.cantidad_custom),pregsNivel):null):(configExamen.cantidad||pregsNivel)
  const cantExamen=cantExamenDisplay??pregsNivel
  const totalIntentos=Object.values(intentosPorNivel).length
  const nivCompletados=Object.values(intentosPorNivel).filter(a=>a.status==='completed').length
  const mejorScore=Object.values(intentosPorNivel).filter(a=>a.score!=null).reduce((max,a)=>Math.max(max,a.score),0)

  function abrirModal(modo){
    if(!user){navigate('/login');return}
    if(!tienePlan){navigate('/planes');return}
    if(!nivelActual) return
    if(pregsNivel===0){alert('Este nivel aún no tiene preguntas.');return}
    if(modo==='examen') setConfigExamen(c=>({...c,cantidad:pregsNivel,cantidad_custom:'',tipo_cantidad:'all'}))
    if(modo==='practica') setConfigPractica(c=>({...c,cantidad:Math.min(20,pregsNivel),cantidad_custom:'',tipo_cantidad:'preset'}))
    setModalModo(modo)
  }
  function confirmarInicio(){
    setModalConfirm(false);setModalModo(null)
    const p=new URLSearchParams({modo:modalModo})
    if(modalModo==='practica'){
      p.set('orden',configPractica.orden)
      p.set('cantidad',Math.min(cantPractica,pregsNivel))
      p.set('retro',configPractica.con_retro?'1':'0')
      p.set('timer',configPractica.timer_pregunta)
    } else {
      p.set('cantidad',Math.min(cantExamen,pregsNivel))
    }
    navigate(`/simulacro/${nivelActual.id}?${p.toString()}`)
  }
  function irASala(){
    if(!user){navigate('/login');return}
    if(!tienePlan){navigate('/planes');return}
    navigate('/salas')
  }

  if(loading) return(
    <div className="p-6 pb-20 max-w-4xl animate-pulse space-y-6">
      <div className="h-48 bg-surface-container-high rounded-3xl"/>
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i=><div key={i} className="h-20 bg-surface-container-high rounded-xl"/>)}</div>
      <div className="h-32 bg-surface-container-high rounded-2xl"/>
    </div>
  )
  if(error||!ev) return(
    <div className="p-8 flex flex-col items-center justify-center min-h-64 gap-4">
      <span className="material-symbols-outlined text-5xl text-error opacity-50">error</span>
      <p className="text-on-surface-variant font-semibold">{error||'Evaluación no encontrada'}</p>
      <div className="flex gap-3">
        <button onClick={retry} className="btn-primary px-6 py-2">Reintentar</button>
        <button onClick={()=>navigate('/catalogo')} className="px-6 py-2 rounded-full border border-outline-variant text-sm font-semibold">Volver al catálogo</button>
      </div>
    </div>
  )

  const catNombre=ev.categories?.name??'General'
  const icono=ICONOS_CATEGORIA[catNombre]||'quiz'
  const colorGrad=COLORES_CATEGORIA[catNombre]||'from-primary to-primary-container'
  const durMax=niveles.length?formatTiempo(Math.max(...niveles.map(l=>l.time_limit??0))):'—'
  const aprobMax=niveles.length?`${Math.max(...niveles.map(l=>l.passing_score??0))}%`:'—'

  return(
    <div className="p-4 md:p-8 pb-24 max-w-4xl animate-fade-in">
      <button onClick={()=>navigate('/catalogo')} className="flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm font-semibold mb-6 transition-colors group">
        <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        Volver al catálogo
      </button>

      {/* Hero */}
      <div className={`bg-gradient-to-br ${colorGrad} rounded-3xl p-6 md:p-8 text-white mb-6 relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-16 translate-x-16"/>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-10 -translate-x-10"/>
        <div className="relative z-10">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-3xl" style={{fontVariationSettings:"'FILL' 1"}}>{icono}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 bg-white/10 px-2 py-0.5 rounded-full">{catNombre}</span>
              <h1 className="text-xl md:text-3xl font-extrabold leading-tight mt-1">{ev.title}</h1>
            </div>
            {tienePlan&&<span className="shrink-0 flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full"><span className="material-symbols-outlined text-sm" style={{fontVariationSettings:"'FILL' 1"}}>verified</span>Activo</span>}
          </div>
          <p className="text-white/80 text-sm leading-relaxed line-clamp-2">{ev.description||'Simulacro oficial con preguntas actualizadas.'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {val:totalPregs||'—',label:'Preguntas',icon:'quiz',color:'text-primary'},
          {val:durMax,label:'Duración',icon:'timer',color:'text-tertiary'},
          {val:niveles.length,label:'Niveles',icon:'layers',color:'text-secondary'},
          {val:aprobMax,label:'Aprobación',icon:'verified',color:'text-on-background'},
        ].map(s=>(
          <div key={s.label} className="card p-3 text-center">
            <span className={`material-symbols-outlined text-xl ${s.color} mb-0.5 block`}>{s.icon}</span>
            <span className={`text-lg font-extrabold block ${s.color}`}>{s.val}</span>
            <p className="text-[10px] text-on-surface-variant font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Historial */}
      {user&&totalIntentos>0&&(
        <div className="bg-surface-container-low rounded-2xl p-4 mb-6 border border-outline-variant/15">
          <p className="font-bold text-sm mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-primary text-lg">history</span>Tu historial</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xl font-extrabold text-primary">{totalIntentos}</p><p className="text-xs text-on-surface-variant">Intentos</p></div>
            <div><p className="text-xl font-extrabold text-secondary">{nivCompletados}</p><p className="text-xs text-on-surface-variant">Completados</p></div>
            <div><p className={`text-xl font-extrabold ${mejorScore>=70?'text-secondary':'text-error'}`}>{mejorScore}%</p><p className="text-xs text-on-surface-variant">Mejor score</p></div>
          </div>
        </div>
      )}

      {/* Selector nivel */}
      {niveles.length>1&&(
        <div className="mb-6">
          <p className="text-sm font-bold text-on-surface-variant mb-3">Selecciona el nivel</p>
          <div className="flex flex-wrap gap-2">
            {niveles.map(nv=>{
              const sel=nivelActual?.id===nv.id
              const completado=intentosPorNivel[nv.id]?.status==='completed'
              return(
                <button key={nv.id} onClick={()=>setNivelSeleccionado(nv)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${sel?'border-primary bg-primary text-white shadow-md':'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}>
                  {completado&&<span className="material-symbols-outlined text-sm" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>}
                  {nv.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Info nivel */}
      {nivelActual&&(
        <div className="card p-5 mb-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-extrabold text-lg">{nivelActual.name}</h3>
              {nivelActual.description&&<p className="text-on-surface-variant text-sm mt-0.5">{nivelActual.description}</p>}
            </div>
            {intentoActual&&(
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ml-2 ${intentoActual.score>=(nivelActual.passing_score||70)?'bg-secondary-container text-secondary':'bg-error-container text-error'}`}>
                Último: {intentoActual.score??'—'}% · {tiempoRelativo(intentoActual.start_time)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-bold text-on-surface-variant">
            {pregsNivel>0&&<span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">quiz</span>{pregsNivel} preguntas</span>}
            {nivelActual.time_limit>0&&<span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">timer</span>{formatTiempo(nivelActual.time_limit)}</span>}
            {nivelActual.passing_score>0&&<span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">verified</span>Aprobación {nivelActual.passing_score}%</span>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-container-low rounded-2xl mb-6">
        {[{key:'simulacro',icon:'quiz',label:'Simulacros'},{key:'material',icon:'menu_book',label:'Material de Estudio'}].map(t=>(
          <button key={t.key} onClick={()=>setTabActiva(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${tabActiva===t.key?'bg-white shadow-sm text-primary':'text-on-surface-variant hover:text-on-surface'}`}>
            <span className="material-symbols-outlined text-lg" style={{fontVariationSettings:tabActiva===t.key?"'FILL' 1":"'FILL' 0"}}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido tab */}
      {tabActiva==='material'?(
        <TabMaterial packageId={packageId} tienePlan={tienePlan}/>
      ):(
        <>
          {tienePlan?(
            <div className="space-y-3">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Selecciona tu modo</p>
              <button onClick={()=>abrirModal('practica')} disabled={pregsNivel===0}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-secondary/30 bg-secondary-container/10 hover:border-secondary hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-50 text-left group">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-white text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>school</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-secondary">Modo Práctica</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Retroalimentación · Timer por pregunta · Configurable</p>
                  {pregsNivel>0&&<div className="flex gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">Hasta {pregsNivel} preguntas</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">Retro incluida</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">Modo flexible</span>
                  </div>}
                </div>
                <span className="material-symbols-outlined text-secondary shrink-0">arrow_forward</span>
              </button>
              <button onClick={()=>abrirModal('examen')} disabled={pregsNivel===0}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-primary/30 bg-primary-fixed/10 hover:border-primary hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-50 text-left group">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-white text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>timer</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-primary">Modo Examen</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Sin ayudas · Condiciones reales · Timer total</p>
                  {pregsNivel>0&&<div className="flex gap-1.5 mt-2 flex-wrap">
                    {nivelActual?.time_limit>0&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{formatTiempo(nivelActual.time_limit)}</span>}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Aprobación {nivelActual?.passing_score??70}%</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Sin ayudas</span>
                  </div>}
                </div>
                <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
              </button>
              <button onClick={irASala}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-tertiary/30 bg-tertiary-container/10 hover:border-tertiary hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-50 text-left group">
                <div className="w-12 h-12 rounded-xl bg-tertiary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-white text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>groups</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-tertiary">Sala en línea</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Compite con otros · Código de sala · Ranking en vivo</p>
                </div>
                <span className="material-symbols-outlined text-tertiary shrink-0">arrow_forward</span>
              </button>
              {pregsNivel===0&&<p className="text-xs text-on-surface-variant text-center pt-2">⚠️ Este nivel aún no tiene preguntas disponibles</p>}
            </div>
          ):(
            <div className={`bg-gradient-to-r ${colorGrad} rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
              <div className="text-white">
                <p className="font-bold text-lg">¿Listo para practicar?</p>
                <p className="text-white/70 text-sm mt-1">Adquiere el paquete para acceder a todos los modos</p>
              </div>
              <button onClick={()=>navigate('/planes')} className="bg-white text-primary font-bold px-6 py-3 rounded-full hover:shadow-lg transition-all active:scale-95 whitespace-nowrap text-sm shrink-0">Ver planes →</button>
            </div>
          )}
        </>
      )}

      {/* Modal Práctica */}
      {modalModo==='practica'&&!modalConfirm&&(
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white" style={{fontVariationSettings:"'FILL' 1"}}>school</span>
              </div>
              <div><h3 className="font-extrabold text-lg">Modo Práctica</h3><p className="text-xs text-on-surface-variant">Configura tu sesión</p></div>
            </div>
            <div className="space-y-4 mb-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">format_list_numbered</span>Preguntas</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[10,20,30,50].filter(n=>n<=pregsNivel).map(n=>(
                    <button key={n} onClick={()=>setConfigPractica(c=>({...c,cantidad:n,cantidad_custom:'',tipo_cantidad:'preset'}))}
                      className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${configPractica.tipo_cantidad==='preset'&&configPractica.cantidad===n?'border-secondary bg-secondary-container/30 text-secondary':'border-outline-variant/30 text-on-surface-variant'}`}>{n}</button>
                  ))}
                  <button onClick={()=>setConfigPractica(c=>({...c,tipo_cantidad:'all',cantidad_custom:''}))}
                    className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${configPractica.tipo_cantidad==='all'?'border-secondary bg-secondary-container/30 text-secondary':'border-outline-variant/30 text-on-surface-variant'}`}>Todas ({pregsNivel})</button>
                </div>
                <input type="number" min={1} max={pregsNivel} value={configPractica.cantidad_custom} onChange={e=>setConfigPractica(c=>({...c,cantidad_custom:e.target.value,tipo_cantidad:'custom'}))} placeholder={`Personalizado (máx. ${pregsNivel})`} className={`${inputCls} ${configPractica.tipo_cantidad==='custom'?'ring-2 ring-secondary':''}`}/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">shuffle</span>Orden</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{v:'aleatorio',l:'🔀 Aleatorio'},{v:'original',l:'📋 Original'}].map(o=>(
                    <button key={o.v} onClick={()=>setConfigPractica(c=>({...c,orden:o.v}))}
                      className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${configPractica.orden===o.v?'border-secondary bg-secondary-container/30 text-secondary':'border-outline-variant/30 text-on-surface-variant'}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">timer</span>Tiempo por pregunta</label>
                <div className="flex flex-wrap gap-2">
                  {[{v:0,l:'Sin límite'},{v:60,l:'1 min'},{v:90,l:'1:30'},{v:120,l:'2 min'},{v:180,l:'3 min'}].map(o=>(
                    <button key={o.v} onClick={()=>setConfigPractica(c=>({...c,timer_pregunta:o.v}))}
                      className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${configPractica.timer_pregunta===o.v?'border-secondary bg-secondary-container/30 text-secondary':'border-outline-variant/30 text-on-surface-variant'}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">psychology</span>Retroalimentación</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{v:true,l:'✅ Con retro'},{v:false,l:'❌ Sin retro'}].map(o=>(
                    <button key={String(o.v)} onClick={()=>setConfigPractica(c=>({...c,con_retro:o.v}))}
                      className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${configPractica.con_retro===o.v?'border-secondary bg-secondary-container/30 text-secondary':'border-outline-variant/30 text-on-surface-variant'}`}>{o.l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-secondary-container/20 rounded-2xl p-4 mb-5 space-y-1.5 text-sm border border-secondary/10">
              <p className="font-bold text-xs uppercase tracking-wider text-secondary mb-2">Resumen</p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Preguntas</span><span className="font-bold">{cantPracticaDisplay??'—'}</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Orden</span><span className="font-bold capitalize">{configPractica.orden}</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Timer</span><span className="font-bold">{configPractica.timer_pregunta===0?'Sin límite':`${configPractica.timer_pregunta}s por pregunta`}</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Retro</span><span className={`font-bold ${configPractica.con_retro?'text-secondary':'text-error'}`}>{configPractica.con_retro?'✔ Incluida':'✖ Sin retro'}</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Tiempo estimado</span><span className="font-bold">{configPractica.timer_pregunta===0?'Libre':cantPracticaDisplay!=null?`~${Math.ceil(cantPractica*configPractica.timer_pregunta/60)} min`:'—'}</span></p>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setModalModo(null)} className="flex-1 py-3 rounded-full border border-outline-variant font-bold text-sm">Cancelar</button>
              <button onClick={()=>setModalConfirm(true)} className="flex-1 py-3 rounded-full bg-secondary text-white font-bold text-sm active:scale-95 transition-all">Continuar →</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Examen */}
      {modalModo==='examen'&&!modalConfirm&&(
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white" style={{fontVariationSettings:"'FILL' 1"}}>timer</span>
              </div>
              <div><h3 className="font-extrabold text-lg">Modo Examen</h3><p className="text-xs text-on-surface-variant">Condiciones reales de prueba</p></div>
            </div>
            <div className="space-y-4 mb-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">format_list_numbered</span>Preguntas</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[50,100,150,200].filter(n=>n<=pregsNivel).map(n=>(
                    <button key={n} onClick={()=>setConfigExamen(c=>({...c,cantidad:n,cantidad_custom:'',tipo_cantidad:'preset'}))}
                      className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${configExamen.tipo_cantidad==='preset'&&configExamen.cantidad===n?'border-primary bg-primary-fixed/30 text-primary':'border-outline-variant/30 text-on-surface-variant'}`}>{n}</button>
                  ))}
                  <button onClick={()=>setConfigExamen(c=>({...c,tipo_cantidad:'all',cantidad_custom:''}))}
                    className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${configExamen.tipo_cantidad==='all'?'border-primary bg-primary-fixed/30 text-primary':'border-outline-variant/30 text-on-surface-variant'}`}>Completo ({pregsNivel})</button>
                </div>
                <input type="number" min={1} max={pregsNivel} value={configExamen.cantidad_custom} onChange={e=>setConfigExamen(c=>({...c,cantidad_custom:e.target.value,tipo_cantidad:'custom'}))} placeholder={`Personalizado (máx. ${pregsNivel})`} className={`${inputCls} ${configExamen.tipo_cantidad==='custom'?'ring-2 ring-primary':''}`}/>
              </div>
            </div>
            <div className="bg-primary-fixed/20 rounded-2xl p-4 mb-4 space-y-1.5 text-sm border border-primary/10">
              <p className="font-bold text-xs uppercase tracking-wider text-primary mb-2">Condiciones del examen</p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Preguntas</span><span className="font-bold">{cantExamenDisplay??'—'}</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Duración total</span><span className="font-bold">{formatTiempo(nivelActual?.time_limit)}</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Aprobación</span><span className="font-bold">{nivelActual?.passing_score??70}%</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Retroalimentación</span><span className="font-bold text-error">✖ No disponible</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Cambiar respuesta</span><span className="font-bold text-error">✖ No permitido</span></p>
            </div>
            <div className="bg-error-container/20 rounded-xl p-3 mb-5 flex items-start gap-2">
              <span className="material-symbols-outlined text-error text-sm shrink-0 mt-0.5">warning</span>
              <p className="text-xs text-error font-medium">Una vez iniciado no podrás ver las respuestas correctas hasta terminar.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setModalModo(null)} className="flex-1 py-3 rounded-full border border-outline-variant font-bold text-sm">Cancelar</button>
              <button onClick={()=>setModalConfirm(true)} className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-all">Iniciar examen →</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación */}
      {modalConfirm&&(
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-fade-in text-center">
            <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center ${modalModo==='practica'?'bg-secondary':'bg-primary'}`}>
              <span className="material-symbols-outlined text-white text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>{modalModo==='practica'?'school':'timer'}</span>
            </div>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full mb-3 ${modalModo==='practica'?'bg-secondary-container text-secondary':'bg-primary-container text-primary'}`}>
              {modalModo==='practica'?'Flexible':'Condiciones reales'}
            </span>
            <h3 className="font-extrabold text-xl mb-1">¿Listo para empezar?</h3>
            <p className="text-on-surface-variant text-sm mb-4 font-bold">{nivelActual?.name}</p>
            <div className={`rounded-2xl p-4 mb-5 text-left space-y-2.5 border ${modalModo==='practica'?'bg-secondary-container/15 border-secondary/20':'bg-primary-container/15 border-primary/20'}`}>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant">Preguntas</span>
                <span className="font-bold">{modalModo==='practica'?cantPractica:cantExamen}</span>
              </div>
              {modalModo==='practica'?(
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-on-surface-variant">Orden</span>
                    <span className="font-bold capitalize">{configPractica.orden}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-on-surface-variant">Retro</span>
                    <span className={`font-bold ${configPractica.con_retro?'text-secondary':'text-error'}`}>{configPractica.con_retro?'✔ Incluida':'✖ Sin retro'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-on-surface-variant">Timer</span>
                    <span className="font-bold">{configPractica.timer_pregunta===0?'Sin límite':`${configPractica.timer_pregunta}s / pregunta`}</span>
                  </div>
                </>
              ):(
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-on-surface-variant">Duración</span>
                    <span className="font-bold">{formatTiempo(nivelActual?.time_limit)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-on-surface-variant">Aprobación</span>
                    <span className="font-bold">{nivelActual?.passing_score??70}%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-on-surface-variant">Retroalimentación</span>
                    <span className="font-bold text-error">✖ No disponible</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setModalConfirm(false)} className="flex-1 py-3 rounded-full border border-outline-variant font-bold text-sm">Volver</button>
              <button onClick={confirmarInicio} className={`flex-1 py-3 rounded-full font-bold text-sm text-white active:scale-95 transition-all flex items-center justify-center gap-2 ${modalModo==='practica'?'bg-secondary':'bg-primary'}`}>
                <span className="material-symbols-outlined text-sm" style={{fontVariationSettings:"'FILL' 1"}}>rocket_launch</span>¡Empezar!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}