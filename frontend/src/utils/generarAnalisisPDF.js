import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Design tokens ─────────────────────────────────────────────────────────────
const PRIMARY    = [15, 40, 100]
const PRI_LIGHT  = [235, 240, 255]
const GRAY       = [30, 41, 59]
const GRAY_LIGHT = [241, 245, 249]
const GREEN      = [22, 101, 52]
const AMBER      = [146, 64, 14]
const RED        = [185, 28, 28]

// Estados de decisión PIN permitidos (página 7 de la maqueta)
const PIN_STATES = {
  VIABLE:       { text: 'COMPRA VIABLE CON REVISIÓN DOCUMENTAL BÁSICA',                 color: GREEN },
  CONDICIONADA: { text: 'COMPRA CONDICIONADA A COINCIDENCIA DE SOPORTES EN SIMO',       color: AMBER },
  NO_CRITICO:   { text: 'NO COMPRAR HASTA VALIDAR SOPORTE CRÍTICO',                      color: [180, 80, 0] },
  NO_COMPRAR:   { text: 'NO COMPRAR ACTUALMENTE',                                        color: RED },
  FUTURA:       { text: 'OPCIÓN FUTURA O NO PRIORIZADA PARA ESTE PIN',                   color: [80, 80, 80] },
}

// Mapeo de valores antiguos a nuevos estados
function resolveEstadoPin(ruta) {
  if (ruta.estado_decision_pin) return ruta.estado_decision_pin
  const v = (ruta.decision_pin || '').toLowerCase()
  if (v === 'comprar_con_verificacion' || v === 'viable') return PIN_STATES.VIABLE.text
  if (v === 'verificar')   return PIN_STATES.CONDICIONADA.text
  if (v === 'no_comprar')  return PIN_STATES.NO_COMPRAR.text
  return PIN_STATES.CONDICIONADA.text
}

function resolveEstadoColor(estadoText) {
  const t = (estadoText || '').toUpperCase()
  if (t.includes('VIABLE CON REVISIÓN'))    return GREEN
  if (t.includes('CONDICIONADA'))           return AMBER
  if (t.includes('NO COMPRAR HASTA'))       return [180, 80, 0]
  if (t.includes('NO COMPRAR ACTUAL'))      return RED
  if (t.includes('FUTURA'))                 return [80, 80, 80]
  return AMBER
}

// Rutas máximo 3 (sin ruta_ambiciosa)
const RUTAS_ORDEN = ['ruta_principal', 'ruta_segura', 'ruta_estrategica']
const RUTA_CFG = {
  ruta_principal:   { label: 'Ruta 1 — Opción principal', etiqueta: 'Principal',   color: PRIMARY },
  ruta_segura:      { label: 'Ruta 2 — Opción segura',    etiqueta: 'Segura',      color: GREEN   },
  ruta_estrategica: { label: 'Ruta 3 — Opción estratégica', etiqueta: 'Estratégica', color: [30, 64, 175] },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const tr = (str, max = 100) => !str ? '' : String(str).length > max ? String(str).slice(0, max) + '…' : String(str)

function strFromObj(v) {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return v.titulo || v.nombre || v.descripcion || v.text || JSON.stringify(v)
  return String(v)
}

function fmtMeses(m) {
  if (!m) return 'N/D'
  const yrs = Math.floor(m / 12); const mos = m % 12
  return yrs > 0 ? `${yrs} año${yrs > 1 ? 's' : ''}${mos > 0 ? ` ${mos} mes${mos > 1 ? 'es' : ''}` : ''}` : `${mos} mes${mos > 1 ? 'es' : ''}`
}

function checkPage(doc, y, needed = 30) {
  if (y + needed > 272) { doc.addPage(); return 22 }
  return y
}

function seccion(doc, titulo, y, marginX, color = PRIMARY) {
  doc.setTextColor(...color)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, marginX, y)
  return y + 5
}

function infoBox(doc, texto, y, marginX, W, bgColor = PRI_LIGHT, barColor = PRIMARY) {
  const lines = doc.splitTextToSize(texto, W - marginX * 2 - 9)
  const h = lines.length * 4.5 + 8
  doc.setFillColor(...bgColor)
  doc.rect(marginX, y, W - marginX * 2, h, 'F')
  doc.setFillColor(...barColor)
  doc.rect(marginX, y, 3, h, 'F')
  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(lines, marginX + 7, y + 5.5)
  return y + h + 4
}

function pageHeader(doc, W, marginX, convNombre) {
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, W, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('PRAXIA — Análisis de opciones para compra de PIN', marginX, 9)
  doc.setFont('helvetica', 'normal')
  doc.text('Maqueta corregida de salida PDF', W - marginX, 9, { align: 'right' })
  // disclaimer footer top
  doc.setFontSize(6.5)
  doc.setTextColor(255, 255, 255)
  doc.text('Informe orientativo, técnico y preventivo. Validar siempre en SIMO, OPEC oficial, Acuerdo, Anexo Técnico y MEFCL.', marginX, 13)
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export function generarAnalisisPDF(analisis, convNombre = '') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const marginX = 14
  const rutasDisp = RUTAS_ORDEN.filter(k => analisis.rutas?.[k]?.denominacion)
  let y = 0

  // ═══════════════════════════════════════════════════════════════
  // PÁGINA 1 — Portada + Perfil + Decisión preliminar
  // ═══════════════════════════════════════════════════════════════
  pageHeader(doc, W, marginX, convNombre)
  y = 22

  // Título principal
  doc.setTextColor(...PRIMARY)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('PRAXIA', marginX, y)
  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('Análisis de opciones para compra de PIN', marginX, y)
  y += 3
  doc.setFontSize(7.5)
  doc.setTextColor(100, 100, 100)
  doc.text('Objetivo de esta maqueta', marginX, y + 3)
  doc.setFont('helvetica', 'normal')
  const objText = 'Este PDF muestra el informe de análisis: sin [object Object], con máximo tres rutas principales, con evidencia detectada, desglose de afinidad y opciones de alto potencial separadas del ranking principal.'
  const objLines = doc.splitTextToSize(objText, W - marginX * 2)
  doc.text(objLines, marginX, y + 7)
  y += 7 + objLines.length * 4.5 + 4

  // ── Perfil del candidato ──────────────────────────────────────
  y = seccion(doc, 'Perfil del candidato', y, marginX)
  const pc = analisis.perfil_candidato || {}

  const titulosStr = (pc.titulos_identificados || [])
    .map(t => strFromObj(t)).filter(Boolean).join('; ') || 'N/D'
  const competitividad = analisis.diagnostico_general?.nivel_competitividad || pc.nivel_competitividad || 'N/D'

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    body: [
      [{ content: 'Nombre',               styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, pc.nombre || 'N/D',
       { content: 'Profesión',            styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, pc.profesion_principal || 'N/D',
       { content: 'Nivel de formación',   styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, pc.nivel_formacion || 'N/D'],
      [{ content: 'Títulos identificados',styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, titulosStr,
       { content: 'Experiencia total',    styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, fmtMeses(pc.experiencia_total_estimada_meses),
       { content: 'Exp. sector público',  styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, fmtMeses(pc.experiencia_sector_publico_meses)],
      [{ content: 'Tarjeta profesional',  styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, strFromObj(pc.tarjeta_profesional?.estado) || 'N/D',
       { content: 'Competitividad',       styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, competitividad,
       { content: 'Estrategia',           styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, 'Decisión antes de compra de PIN'],
    ],
    theme: 'plain',
    styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 30 }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 32 }, 5: { cellWidth: 'auto' } },
  })
  y = doc.lastAutoTable.finalY + 6

  // ── Decisión preliminar para compra de PIN ────────────────────
  y = seccion(doc, 'Decisión preliminar para compra de PIN', y, marginX)
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['OPEC', 'Ruta', 'Estado decisión PIN', 'Motivo claro', 'Acción antes de pagar']],
    body: rutasDisp.map(key => {
      const r = analisis.rutas[key]
      const cfg = RUTA_CFG[key]
      const estado = resolveEstadoPin(r)
      const motivo = tr(r.motivo_claro || r.por_que_conviene || r.justificacion, 90)
      const accion = tr(r.soporte_critico_antes_de_pagar || r.accion_antes_de_pagar || (r.antes_de_pagar || [])[0] || '', 90)
      return [r.codigo_opec || r.numero_opec || '', cfg.etiqueta, estado, motivo, accion]
    }),
    theme: 'grid',
    headStyles: { fillColor: GRAY, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 48, fontStyle: 'bold' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 'auto' },
    },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 2) {
        const ruta = analisis.rutas?.[rutasDisp[data.row.index]]
        if (ruta) data.cell.styles.textColor = resolveEstadoColor(resolveEstadoPin(ruta))
      }
    },
  })
  y = doc.lastAutoTable.finalY + 5

  // Nota de lectura
  y = infoBox(doc,
    'Nota de lectura: La tabla principal solo debe mostrar tres rutas. Las opciones de alto salario o alto potencial que tengan soporte crítico pendiente deben pasar a una sección separada, no a una Ruta 4.',
    y, marginX, W, [255, 251, 235], AMBER)

  // ═══════════════════════════════════════════════════════════════
  // PÁGINA 2 — Evidencia detectada + Validación técnica
  // ═══════════════════════════════════════════════════════════════
  doc.addPage()
  pageHeader(doc, W, marginX, convNombre)
  y = 22

  // ── Evidencia detectada por Praxia ────────────────────────────
  y = seccion(doc, 'Evidencia detectada por Praxia', y, marginX)
  y = infoBox(doc,
    'Esta tabla es obligatoria porque explica qué encontró la IA y cómo se usa cada soporte. Evita que el informe solo diga "cumple" sin mostrar la base de la decisión.',
    y, marginX, W, PRI_LIGHT)

  const evidencia = analisis.evidencia_detectada_praxia || []
  if (evidencia.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Evidencia detectada', 'Tipo', 'Uso en VRM', 'Uso en VA', 'Uso en habilitación', 'Confianza', 'Riesgo si no coincide en SIMO', 'Acción']],
      body: evidencia.map(e => [
        tr(strFromObj(e.evidencia || e.titulo), 30),
        tr(strFromObj(e.tipo), 18),
        tr(strFromObj(e.uso_vrm), 30),
        tr(strFromObj(e.uso_va), 25),
        tr(strFromObj(e.uso_habilitacion), 25),
        tr(strFromObj(e.confianza), 12),
        tr(strFromObj(e.riesgo_simo || e.riesgo), 30),
        tr(strFromObj(e.accion), 30),
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      styles: { fontSize: 7, textColor: GRAY, cellPadding: 2 },
    })
    y = doc.lastAutoTable.finalY + 6
  } else {
    // Construir evidencia básica desde perfil si no viene del backend
    const pc2 = analisis.perfil_candidato || {}
    const evRows = []
    for (const t of (pc2.titulos_identificados || []).slice(0, 2)) {
      evRows.push([tr(strFromObj(t), 30), 'Título académico', 'VRM / habilitación si aplica', 'Puede apoyar VA si adicional al mínimo', 'Tarjeta profesional / ejercicio', 'Alta', 'Medio si no está cargado en SIMO', 'Verificar diploma y soporte en SIMO.'])
    }
    for (const p of (pc2.posgrados_identificados || []).slice(0, 1)) {
      evRows.push([tr(strFromObj(p), 30), 'Posgrado', 'VRM si la OPEC lo exige; si no, VA', 'VA potencial si pertinente', 'No aplica directamente', 'Media-alta', 'Medio si no coincide con área exigida', 'Validar relación con funciones y MEFCL.'])
    }
    if (pc2.tarjeta_profesional?.estado !== 'no_aplica') {
      evRows.push(['Tarjeta profesional', 'Habilitación', 'Puede impactar VRM o experiencia', 'No suma por sí sola en VA', 'Acredita habilitación profesional', 'Alta', 'Alto si la OPEC la exige y no está cargada', 'Cargar soporte vigente y verificar fecha.'])
    }
    evRows.push(['Certificaciones laborales', 'Experiencia', 'Acredita experiencia mínima con fechas y funciones', 'Puede sumar VA si adicional', 'No aplica', 'Media', 'Alto si faltan funciones, fechas o firma', 'Revisar fechas, cargo, funciones y firma.'])
    if (evRows.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [['Evidencia detectada', 'Tipo', 'Uso en VRM', 'Uso en VA', 'Uso en habilitación', 'Confianza', 'Riesgo si no coincide en SIMO', 'Acción']],
        body: evRows,
        theme: 'striped',
        headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
        styles: { fontSize: 6.8, textColor: GRAY, cellPadding: 2 },
      })
      y = doc.lastAutoTable.finalY + 6
    }
  }

  // ── Validación técnica resumida ───────────────────────────────
  y = checkPage(doc, y, 60)
  y = seccion(doc, 'Validación técnica resumida', y, marginX)
  const rp = analisis.rutas?.ruta_principal || {}
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Aspecto', 'Estado preliminar', 'Qué significa para ti', 'Acción concreta']],
    body: [
      ['VRM — Requisitos mínimos', rp.vrm || 'Viable con verificación',
        'El aspirante puede avanzar solo si estudio, experiencia y documentos coinciden con la OPEC oficial.',
        'Validar OPEC, MEFCL, soportes y documentos asociados en SIMO.'],
      ['VA — Antecedentes', rp.va || 'Potencial alto',
        'La especialización y experiencia adicional pueden ayudar solo después de cumplir VRM.',
        'No usar VA para compensar incumplimiento de experiencia mínima.'],
      ['Habilitación profesional', rp.habilitacion || 'Cumple / requiere verificación según OPEC',
        'La tarjeta, matrícula o registro se valida según profesión, OPEC, MEFCL o norma.',
        'Cargar soporte si aplica y validar fecha para cómputo de experiencia.'],
      ['Experiencia depurada', 'Pendiente por traslapos',
        'El tiempo simultáneo no se suma doble; puede cambiar el total válido.',
        'Recalcular con fechas exactas y certificaciones completas.'],
      ['Equivalencias', 'No evidenciadas',
        'No deben aplicarse por suposición.',
        'Usarlas solo si OPEC, MEFCL, Acuerdo o Anexo Técnico las permite expresamente.'],
    ],
    theme: 'grid',
    headStyles: { fillColor: GRAY, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold', fillColor: GRAY_LIGHT }, 1: { cellWidth: 40 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 50 } },
  })

  // ═══════════════════════════════════════════════════════════════
  // PÁGINAS 3-5 — Detalle de cada ruta (máx 3)
  // ═══════════════════════════════════════════════════════════════
  for (const key of rutasDisp) {
    const ruta = analisis.rutas[key]
    const cfg  = RUTA_CFG[key]

    doc.addPage()
    pageHeader(doc, W, marginX, convNombre)
    y = 22

    // Título de ruta
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...cfg.color)
    doc.text(cfg.label, marginX, y)
    y += 8

    const estado      = resolveEstadoPin(ruta)
    const estadoColor = resolveEstadoColor(estado)
    const soporte     = tr(ruta.soporte_critico_antes_de_pagar || ruta.punto_critico || ruta.riesgo_explica || '', 120)
    const riesgo      = ruta.riesgo_nivel || (ruta.decision_pin === 'no_comprar' ? 'Alto' : ruta.decision_pin === 'verificar' ? 'Medio' : 'Bajo')

    // Tabla de datos básicos de la OPEC
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      body: [
        [{ content: 'Campo',    styles: { fontStyle: 'bold', fillColor: GRAY } },
         { content: 'Dato',     styles: { fontStyle: 'bold', fillColor: GRAY, textColor: [255,255,255] } },
         { content: 'Campo',    styles: { fontStyle: 'bold', fillColor: GRAY } },
         { content: 'Dato',     styles: { fontStyle: 'bold', fillColor: GRAY, textColor: [255,255,255] } }],
        [{ content: 'OPEC',     styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, ruta.codigo_opec || ruta.numero_opec || '',
         { content: 'Entidad',  styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, tr(ruta.entidad, 45)],
        [{ content: 'Cargo',    styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, tr(ruta.denominacion, 45),
         { content: 'Ciudad',   styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, tr(ruta.ciudad || '', 30)],
        [{ content: 'Nivel / grado', styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, `${ruta.nivel || ''} ${ruta.grado ? `G${ruta.grado}` : ''}`.trim(),
         { content: 'Salario',  styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, tr(ruta.salario || '', 20)],
        [{ content: 'Vacantes', styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, String(ruta.vacantes || 1),
         { content: 'Riesgo',   styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, riesgo],
      ],
      theme: 'plain',
      styles: { fontSize: 8, textColor: GRAY, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 25 }, 3: { cellWidth: 'auto' } },
    })
    y = doc.lastAutoTable.finalY + 3

    // Banda: Estado decisión PIN + Soporte crítico
    const bandH = soporte ? 14 : 10
    doc.setFillColor(...estadoColor)
    doc.rect(marginX, y, (W - marginX * 2) * 0.55, bandH, 'F')
    doc.setFillColor(...GRAY)
    doc.rect(marginX + (W - marginX * 2) * 0.55 + 1, y, (W - marginX * 2) * 0.44, bandH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('Estado decisión PIN', marginX + 2, y + 4)
    const estadoLines = doc.splitTextToSize(estado, (W - marginX * 2) * 0.5)
    doc.setFontSize(6.5)
    doc.text(estadoLines[0] || '', marginX + 2, y + 9)
    const cx = marginX + (W - marginX * 2) * 0.55 + 3
    doc.setFontSize(7)
    doc.text('Soporte crítico antes de pagar', cx, y + 4)
    if (soporte) {
      const sLines = doc.splitTextToSize(soporte, (W - marginX * 2) * 0.42)
      doc.setFontSize(6.5)
      doc.text(sLines[0] || '', cx, y + 9)
    }
    y += bandH + 5

    // Validación técnica
    y = checkPage(doc, y, 40)
    y = seccion(doc, 'Validación técnica', y, marginX, cfg.color)
    const vrmE = ruta.vrm || 'Viable'
    const vaE  = ruta.va  || 'Potencial medio'
    const habE = ruta.habilitacion || 'Requiere verificación'
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Control', 'Resultado', 'Lectura para el aspirante']],
      body: [
        ['VRM', vrmE, tr(ruta.vrm_lectura || '', 120) || 'Cumple la base; la compra queda condicionada a que los documentos en SIMO coincidan con lo analizado por Praxia.'],
        ['VA', vaE, tr(ruta.va_lectura || '', 120) || 'La especialización y experiencia adicional pueden fortalecer la competitividad si no fueron usadas como requisito mínimo.'],
        ['Habilitación', habE, tr(ruta.habilitacion_lectura || '', 120) || 'Validar si la OPEC o MEFCL la exige para experiencia, ejercicio o posesión.'],
        ['Equivalencias', 'No evidenciadas', 'No aplicar equivalencias si no están expresamente previstas en OPEC, MEFCL, Acuerdo o Anexo Técnico.'],
      ],
      theme: 'grid',
      headStyles: { fillColor: cfg.color, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold', fillColor: GRAY_LIGHT }, 1: { cellWidth: 40 }, 2: { cellWidth: 'auto' } },
    })
    y = doc.lastAutoTable.finalY + 5

    // Desglose de afinidad total para PIN
    y = checkPage(doc, y, 50)
    y = seccion(doc, 'Desglose de afinidad total para PIN', y, marginX, cfg.color)

    const desglose = ruta.desglose_afinidad_total_para_pin || ruta.desglose_afinidad || []
    if (desglose.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [['Factor ponderado', 'Resultado']],
        body: [
          ...desglose.map(d => [tr(strFromObj(d.factor), 60), tr(strFromObj(d.resultado || d.valor), 100)]),
          [{ content: 'Afinidad total para PIN', styles: { fontStyle: 'bold' } },
           { content: `${ruta.afinidad_porcentaje ?? 0}/100`, styles: { fontStyle: 'bold' } }],
        ],
        theme: 'grid',
        headStyles: { fillColor: GRAY_LIGHT, textColor: GRAY, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
        styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2.5 },
        columnStyles: { 0: { cellWidth: 90, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
      })
    } else {
      // Construir desglose aproximado con datos existentes
      const afinidad = ruta.afinidad_porcentaje ?? 0
      const rows = [
        ['Formación requerida 25%',      `${Math.round(afinidad * 0.25)}/25 — validar título y nivel según OPEC.`],
        ['Experiencia requerida 25%',    `${Math.round(afinidad * 0.25)}/25 — validar meses y funciones relacionadas.`],
        ['Funciones relacionadas 20%',   `${Math.round(afinidad * 0.20)}/20 — relación con propósito y funciones de la OPEC.`],
        ['Riesgo documental 15%',        `${Math.round(afinidad * 0.15)}/15 — condicionado a soportes en SIMO.`],
        ['Vacantes / ubicación 10%',     `${Math.round(afinidad * 0.10)}/10 — número de vacantes y ciudad.`],
        ['Retorno estratégico 5%',       `${Math.round(afinidad * 0.05)}/5 — salario y coherencia profesional.`],
        [{ content: 'Afinidad total para PIN', styles: { fontStyle: 'bold' } },
         { content: `${afinidad}/100`, styles: { fontStyle: 'bold' } }],
      ]
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [['Factor ponderado', 'Resultado']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: GRAY_LIGHT, textColor: GRAY, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
        styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2.5 },
        columnStyles: { 0: { cellWidth: 90, fontStyle: 'bold', fillColor: [248, 249, 250] }, 1: { cellWidth: 'auto' } },
      })
    }
    y = doc.lastAutoTable.finalY + 5

    // Justificación y acciones
    y = checkPage(doc, y, 40)
    y = seccion(doc, 'Justificación y acciones', y, marginX, cfg.color)
    const porQue    = tr(ruta.por_que_conviene || ruta.por_que_esta_ruta || '', 180)
    const riesgos   = tr(ruta.riesgos || ruta.punto_critico || ruta.riesgo_explica || '', 180)
    const docs      = tr((ruta.documentos_a_verificar || ruta.antes_de_pagar || []).join('; '), 180)
    const observ    = tr(ruta.observacion_pago_pin || ruta.decision_sugerida || ruta.justificacion || '', 180)
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Aspecto', 'Detalle']],
      body: [
        [{ content: 'Por qué conviene',       styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, porQue || 'Ver validación técnica.'],
        [{ content: 'Riesgos',                styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, riesgos || 'Validar documentos en SIMO antes de pagar.'],
        [{ content: 'Documentos a verificar', styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, docs || 'Título; certificaciones laborales; tarjeta profesional si aplica.'],
        [{ content: 'Observación de pago PIN',styles: { fontStyle: 'bold', fillColor: GRAY_LIGHT } }, observ || 'Proceder solo si soportes en SIMO coinciden con la evidencia detectada.'],
      ],
      theme: 'plain',
      headStyles: { fillColor: cfg.color, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 'auto' } },
    })
    y = doc.lastAutoTable.finalY + 3
  }

  // ═══════════════════════════════════════════════════════════════
  // ÚLTIMA PÁGINA — Alto potencial + Descartadas + Checklist
  // ═══════════════════════════════════════════════════════════════
  doc.addPage()
  pageHeader(doc, W, marginX, convNombre)
  y = 22

  // Opciones de alto potencial no priorizadas
  const altoPot = analisis.opec_alto_potencial_no_priorizadas || []
  if (altoPot.length > 0) {
    y = seccion(doc, 'Opciones de alto potencial no priorizadas para este PIN', y, marginX)
    y = infoBox(doc,
      'Estas opciones pueden ser atractivas por salario, nivel o proyección, pero no deben aparecer como Ruta 4 dentro del ranking principal. Se muestran separadas porque requieren validación estricta antes de considerarse.',
      y, marginX, W, [255, 251, 235], AMBER)
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['OPEC', 'Entidad', 'Empleo', 'Ciudad', 'Motivo de potencial', 'Razón de no priorización', 'Condición futura', 'Decisión PIN']],
      body: altoPot.map(o => [
        o.codigo_opec || o.numero_opec || '',
        tr(o.entidad, 25),
        tr(o.denominacion, 25),
        tr(o.ciudad, 15),
        tr(strFromObj(o.motivo_potencial), 35),
        tr(strFromObj(o.razon_no_priorizacion), 35),
        tr(strFromObj(o.condicion_futura), 35),
        { content: tr(o.decision_pin || PIN_STATES.FUTURA.text, 30), styles: { fontStyle: 'bold', textColor: [80,80,80] } },
      ]),
      theme: 'striped',
      headStyles: { fillColor: GRAY, textColor: 255, fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      styles: { fontSize: 6.8, textColor: GRAY, cellPadding: 2 },
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // OPECs descartadas relevantes
  const descartados = analisis.cargos_descartados_relevantes || []
  if (descartados.length > 0) {
    y = checkPage(doc, y, 35)
    y = seccion(doc, 'OPEC descartadas relevantes', y, marginX)
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['OPEC', 'Cargo', 'Motivo de descarte', 'Riesgo principal']],
      body: descartados.map(d => [
        d.codigo_opec || '',
        tr(d.denominacion, 40),
        tr(d.motivo_descarte || d.brecha_principal, 90),
        { content: tr(d.riesgo_principal || d.decision || 'Riesgo alto de inadmisión.', 40), styles: { fontStyle: 'bold', textColor: RED } },
      ]),
      theme: 'striped',
      headStyles: { fillColor: GRAY, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 45 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 40 } },
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // Checklist final
  y = checkPage(doc, y, 55)
  y = seccion(doc, 'Checklist final antes de comprar cualquier PIN', y, marginX)
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['No.', 'Verificación', 'Resultado esperado']],
    body: [
      ['1', 'Código OPEC, entidad, municipio, grado y salario.',     'Coinciden con la opción seleccionada.'],
      ['2', 'Título profesional y posgrado.',                         'Legibles, correctos y asociados en SIMO.'],
      ['3', 'Tarjeta, matrícula o registro.',                         'Cargado si aplica por profesión, OPEC, MEFCL o norma.'],
      ['4', 'Certificaciones laborales.',                             'Incluyen fechas, cargo, funciones, firma y datos verificables.'],
      ['5', 'Experiencia traslapada.',                                'No se suma doble.'],
      ['6', 'Equivalencias.',                                         'Solo se usan si están expresamente permitidas.'],
      ['7', 'Funciones relacionadas.',                                'Coinciden con el propósito y funciones de la OPEC.'],
      ['8', 'Decisión de compra.',                                    'Solo comprar si VRM es viable y riesgo documental no es alto.'],
    ],
    theme: 'grid',
    headStyles: { fillColor: GRAY, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' }, 1: { cellWidth: 85 }, 2: { cellWidth: 'auto' } },
  })
  y = doc.lastAutoTable.finalY + 6

  // Advertencia final
  y = checkPage(doc, y, 18)
  y = infoBox(doc,
    'Advertencia final: Este análisis es orientativo, técnico y preventivo. La decisión final debe validarse en SIMO, OPEC oficial, Acuerdo de Convocatoria, Anexo Técnico y MEFCL. Praxia no garantiza admisión, puntaje, elegibilidad ni nombramiento.',
    y, marginX, W, [255, 251, 235], AMBER)

  // ═══════════════════════════════════════════════════════════════
  // FOOTER en todas las páginas
  // ═══════════════════════════════════════════════════════════════
  const total = doc.internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFillColor(245, 245, 245)
    doc.rect(0, 283, W, 14, 'F')
    doc.setTextColor(120, 120, 120)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'italic')
    doc.text('Informe orientativo, técnico y preventivo. Validar siempre en SIMO, OPEC oficial, Acuerdo, Anexo Técnico y MEFCL.', marginX, 289)
    doc.setFont('helvetica', 'normal')
    doc.text(`Página ${p}`, W - marginX, 289, { align: 'right' })
  }

  doc.save(`praxia_analisis_pin_${Date.now()}.pdf`)
}
