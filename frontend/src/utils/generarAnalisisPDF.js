import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Design tokens ─────────────────────────────────────────────────────────────
const PRIMARY    = [15, 40, 100]
const PRI_LIGHT  = [235, 240, 255]
const GRAY       = [30, 41, 59]
const GRAY_LIGHT = [241, 245, 249]

const PIN_CFG = {
  comprar_con_verificacion: { color: [22, 101, 52],  badge: 'COMPRAR CON VERIFICACIÓN' },
  verificar:                { color: [146, 64, 14],  badge: 'VERIFICAR ANTES DE COMPRAR' },
  no_comprar:               { color: [185, 28, 28],  badge: 'NO COMPRAR AHORA' },
}

const RUTA_CFG = {
  ruta_principal:   { num: 1, label: 'Ruta 1 — Opción principal para compra de PIN',  color: [15, 40, 100]  },
  ruta_segura:      { num: 2, label: 'Ruta 2 — Opción segura',                         color: [22, 101, 52]  },
  ruta_estrategica: { num: 3, label: 'Ruta 3 — Opción estratégica',                    color: [30, 64, 175]  },
  ruta_ambiciosa:   { num: 4, label: 'Ruta 4 — Opción ambiciosa',                      color: [88, 28, 135]  },
}

const VRM_L = {
  'viable':                   'Cumple requisitos mínimos. Procede con revisión normal de documentos en SIMO.',
  'viable con verificacion':  'Cumple la base pero confirma documentos en SIMO antes de pagar el PIN.',
  'no viable':                'No cumple requisitos mínimos. Alto riesgo de inadmisión si compra el PIN ahora.',
}
const VA_L = {
  'potencial bajo':  'Los antecedentes adicionales no suman significativamente en esta OPEC.',
  'potencial medio': 'La especialización o experiencia adicional puede ayudar si son adicionales al mínimo exigido.',
  'potencial alto':  'Los antecedentes son sólidos y fortalecen la posición competitiva en la OPEC.',
}
const HAB_L = {
  'no aplica': 'La profesión o OPEC no exige tarjeta, matrícula ni registro profesional.',
  'verificar': 'Confirmar si la profesión/OPEC requiere habilitación; cargar soporte en SIMO si aplica.',
  'cumple':    'Habilitación cubierta. Verificar que el soporte esté cargado y vigente en SIMO.',
}

function tr(str, max = 100) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

function checkPage(doc, y, needed = 30) {
  if (y + needed > 275) { doc.addPage(); return 22 }
  return y
}

function pageHeader(doc, W, marginX, convNombre) {
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, W, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('PRAXIA — Análisis de opciones para compra de PIN', marginX, 10)
  if (convNombre) {
    doc.setFont('helvetica', 'normal')
    doc.text(tr(convNombre, 70), W - marginX, 10, { align: 'right' })
  }
}

function leftBox(doc, title, body, y, marginX, W, bgRgb = PRI_LIGHT, titleColor = PRIMARY) {
  const bodyLines = doc.splitTextToSize(body, W - marginX * 2 - 9)
  const h = (title ? 6 : 0) + bodyLines.length * 4.2 + 8
  doc.setFillColor(...bgRgb)
  doc.rect(marginX, y, W - marginX * 2, h, 'F')
  doc.setFillColor(...titleColor)
  doc.rect(marginX, y, 3, h, 'F')
  let ty = y + 5.5
  if (title) {
    doc.setTextColor(...titleColor)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(title, marginX + 6, ty)
    ty += 5.5
  }
  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(bodyLines, marginX + 6, ty)
  return y + h + 4
}

// ── Main export ───────────────────────────────────────────────────────────────
export function generarAnalisisPDF(analisis, convNombre = '') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const marginX = 14
  const rutasOrden = ['ruta_principal', 'ruta_segura', 'ruta_estrategica', 'ruta_ambiciosa']
  const rutasDisp = rutasOrden.filter(k => analisis.rutas?.[k]?.denominacion)
  let y = 0

  // ═══════════════════════════════════════════════════════════════
  // PÁGINA 1 — Resumen ejecutivo
  // ═══════════════════════════════════════════════════════════════
  pageHeader(doc, W, marginX, convNombre)
  y = 24

  // Título
  doc.setTextColor(...PRIMARY)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('PRAXIA', W / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('Análisis rápido de opciones para compra de PIN', W / 2, y, { align: 'center' })
  y += 8

  // ── Perfil del candidato ──────────────────────────────────────────
  const pc = analisis.perfil_candidato
  if (pc) {
    doc.setTextColor(...PRIMARY)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Perfil del candidato', marginX, y)
    y += 4

    const fmtMeses = (m) => {
      if (!m) return 'N/D'
      const yrs = Math.floor(m / 12)
      const mos = m % 12
      return yrs > 0 ? `${yrs} año${yrs > 1 ? 's' : ''} ${mos > 0 ? `${mos} meses` : ''}`.trim() : `${mos} meses`
    }

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      body: [
        ['Nombre',                pc.nombre || 'N/D'],
        ['Profesión',             pc.profesion_principal || 'N/D'],
        ['Nivel de formación',    pc.nivel_formacion || 'N/D'],
        ['Títulos identificados', (pc.titulos_identificados || []).join(', ') || 'N/D'],
        ['Experiencia total',     fmtMeses(pc.experiencia_total_estimada_meses)],
        ['Exp. sector público',   fmtMeses(pc.experiencia_sector_publico_meses)],
        ['Áreas de experiencia',  (pc.areas_experiencia || []).join(', ') || 'N/D'],
        ['Tarjeta profesional',   pc.tarjeta_profesional?.estado || 'N/D'],
      ],
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 48, fillColor: GRAY_LIGHT, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    })
    y = doc.lastAutoTable.finalY + 4

    const diag = analisis.diagnostico_general
    if (diag) {
      const rows = []
      if (diag.nivel_competitividad) rows.push(['Competitividad', diag.nivel_competitividad])
      if (diag.resumen_ejecutivo)    rows.push(['Resumen',        tr(diag.resumen_ejecutivo, 200)])
      const fort = (diag.fortalezas || []).map(f => `• ${f}`).join('\n')
      if (fort) rows.push(['Fortalezas', fort])
      const mej = (diag.areas_de_mejora || []).map(m => `• ${m}`).join('\n')
      if (mej) rows.push(['Áreas de mejora', mej])

      if (rows.length > 0) {
        autoTable(doc, {
          startY: y,
          margin: { left: marginX, right: marginX },
          head: [['Diagnóstico general', '']],
          body: rows,
          theme: 'plain',
          headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
          styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2 },
          columnStyles: { 0: { cellWidth: 48, fillColor: GRAY_LIGHT, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
        })
        y = doc.lastAutoTable.finalY + 6
      }
    }
  }

  // Objetivo en una frase
  const objetivo = analisis.objetivo_frase || analisis.diagnostico_general?.resumen_ejecutivo || ''
  if (objetivo) {
    y = leftBox(doc, 'Objetivo en una frase', objetivo, y, marginX, W)
  }

  // Definiciones VRM / VA / Habilitación
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['VRM', 'VA', 'Habilitación']],
    body: [[
      'Requisitos mínimos: estudio, experiencia y documentos obligatorios. Si falla, hay riesgo de no admisión.',
      'Antecedentes: estudios o experiencia adicional que podrían sumar después de cumplir VRM.',
      'Tarjeta, matrícula o registro. Solo aplica si la profesión, OPEC, MEFCL o norma lo exige.',
    ]],
    theme: 'plain',
    headStyles: { fillColor: GRAY_LIGHT, textColor: GRAY, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 7.5, textColor: GRAY, cellPadding: 3 },
  })
  y = doc.lastAutoTable.finalY + 6

  // Tabla resumen decisión PIN
  doc.setTextColor(...PRIMARY)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Decisión preliminar para compra de PIN', marginX, y)
  y += 5

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['OPEC', 'Ruta', 'Decisión PIN', 'Motivo claro', 'Acción antes de pagar']],
    body: rutasDisp.map(key => {
      const r = analisis.rutas[key]
      const cfg = RUTA_CFG[key]
      const decTexto = r.decision_pin_texto || PIN_CFG[r.decision_pin]?.badge || ''
      const rutaLabel = cfg.num === 1 ? 'Principal' : cfg.num === 2 ? 'Segura' : cfg.num === 3 ? 'Estratégica' : 'Ambiciosa'
      return [
        `${r.codigo_opec || ''}\n${tr(r.denominacion, 35)}\n${tr(r.entidad, 30)}`,
        rutaLabel,
        decTexto,
        tr(r.motivo_claro || r.justificacion, 80),
        tr(r.accion_antes_de_pagar || r.antes_de_pagar?.[0] || '', 80),
      ]
    }),
    theme: 'striped',
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 22 },
      2: { cellWidth: 36, fontStyle: 'bold' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const ruta = analisis.rutas?.[rutasDisp[data.row.index]]
        const pinColor = PIN_CFG[ruta?.decision_pin]?.color
        if (pinColor) data.cell.styles.textColor = pinColor
      }
    },
  })
  y = doc.lastAutoTable.finalY + 6

  // Recomendación ejecutiva
  const recEjec = analisis.recomendacion_ejecutiva || ''
  if (recEjec) {
    y = checkPage(doc, y, 25)
    y = leftBox(doc, 'Recomendación ejecutiva', recEjec, y, marginX, W)
  }

  // ═══════════════════════════════════════════════════════════════
  // PÁGINA 2 — Semáforo + Validación técnica + Documentos
  // ═══════════════════════════════════════════════════════════════
  doc.addPage()
  pageHeader(doc, W, marginX, convNombre)
  y = 24

  // Semáforo
  const sem = analisis.semaforo
  if (sem?.verde || sem?.amarillo || sem?.rojo) {
    doc.setTextColor(...PRIMARY)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Semáforo antes de pagar el PIN', marginX, y)
    y += 5
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      body: [
        [{ content: 'Verde — avanzar con revisión normal',   styles: { fontStyle: 'bold', textColor: [22, 101, 52]  } }, sem.verde   || ''],
        [{ content: 'Amarillo — verificar antes de comprar', styles: { fontStyle: 'bold', textColor: [146, 64, 14]  } }, sem.amarillo || ''],
        [{ content: 'Rojo — no comprar todavía',             styles: { fontStyle: 'bold', textColor: [185, 28, 28]  } }, sem.rojo    || ''],
      ],
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: GRAY, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 55, fillColor: GRAY_LIGHT }, 1: { cellWidth: 'auto' } },
    })
    y = doc.lastAutoTable.finalY + 6
  }

  // Validación técnica resumida
  doc.setTextColor(...PRIMARY)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Validación técnica resumida', marginX, y)
  y += 5
  const rp = analisis.rutas?.ruta_principal || {}
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Aspecto', 'Estado preliminar', 'Qué significa para ti', 'Acción concreta']],
    body: [
      [{ content: 'VRM\nRequisitos mínimos', styles: { fontStyle: 'bold' } },
        rp.vrm || 'Cumple / requiere verificación según OPEC',
        'Puedes avanzar solo si estudio, experiencia y documentos coinciden con la OPEC oficial.',
        'Validar OPEC, MEFCL, soportes y documentos asociados en SIMO.'],
      [{ content: 'VA\nAntecedentes', styles: { fontStyle: 'bold' } },
        rp.va || 'Potencial medio',
        'La especialización y experiencia adicional pueden ayudar si son adicionales al requisito mínimo y relacionadas.',
        'No usar VA para compensar incumplimiento de experiencia mínima.'],
      [{ content: 'Habilitación\nprofesional', styles: { fontStyle: 'bold' } },
        rp.habilitacion || 'Requiere verificación',
        'La tarjeta, matrícula o registro no aplica a todas las carreras; se valida según profesión, OPEC y norma.',
        'Cargar soporte si aplica y validar fecha para cómputo de experiencia.'],
      [{ content: 'Experiencia\ndepurada', styles: { fontStyle: 'bold' } },
        'Pendiente por traslapos',
        'El tiempo simultáneo no se suma doble; puede cambiar el total válido.',
        'Recalcular experiencia con fechas exactas y certificaciones completas.'],
      [{ content: 'Equivalencias', styles: { fontStyle: 'bold' } },
        'No evidenciadas',
        'No deben aplicarse por suposición.',
        'Usarlas solo si OPEC/MEFCL/Acuerdo las permite expresamente.'],
    ],
    theme: 'striped',
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' }, 1: { cellWidth: 35 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 45 } },
  })
  y = doc.lastAutoTable.finalY + 6

  // Documentos que deciden la compra
  y = checkPage(doc, y, 45)
  doc.setTextColor(...PRIMARY)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Documentos que deciden la compra', marginX, y)
  y += 5
  const perfil = analisis.perfil_candidato || {}
  const docRows = []
  for (const t of (perfil.titulos_identificados || []).slice(0, 2)) {
    docRows.push([tr(t, 50), 'VRM — requisito de estudio', 'No admisión si la OPEC exige esa profesión y el soporte no está asociado.'])
  }
  for (const p of (perfil.posgrados_identificados || []).slice(0, 1)) {
    docRows.push([tr(p, 50), 'VRM o VA según OPEC', 'Puede no servir si no se relaciona con propósito y funciones.'])
  }
  docRows.push(['Certificaciones laborales', 'VRM/VA — experiencia', 'Riesgo medio/alto si no tienen fechas y funciones.'])
  if (perfil.tarjeta_profesional?.estado !== 'no_aplica') {
    docRows.push(['Tarjeta, matrícula o registro', 'Habilitación / cómputo experiencia', 'Solo afecta si aplica por profesión, OPEC, MEFCL o norma.'])
  }
  if (docRows.length === 0) {
    docRows.push(['Título profesional', 'VRM — requisito de estudio', 'No admisión si la OPEC exige esa profesión.'])
    docRows.push(['Certificaciones laborales', 'VRM/VA — experiencia', 'Riesgo medio/alto si no tienen fechas y funciones.'])
  }
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Documento', 'Uso', 'Riesgo si falta']],
    body: docRows,
    theme: 'striped',
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: 35 }, 2: { cellWidth: 'auto' } },
  })

  // ═══════════════════════════════════════════════════════════════
  // PÁGINAS 3+ — Detalle por ruta
  // ═══════════════════════════════════════════════════════════════
  for (const key of rutasOrden) {
    const ruta = analisis.rutas?.[key]
    if (!ruta?.denominacion) continue

    doc.addPage()
    pageHeader(doc, W, marginX, convNombre)
    y = 24

    const cfg = RUTA_CFG[key]
    const pinKey = ruta.decision_pin || 'verificar'
    const pinCfg = PIN_CFG[pinKey] || PIN_CFG.verificar
    const decTexto = ruta.decision_pin_texto || pinCfg.badge

    // Banda título de ruta
    doc.setFillColor(...cfg.color)
    doc.rect(marginX, y, W - marginX * 2, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(cfg.label, marginX + 3, y + 7)
    y += 13

    // Badges: DECISIÓN | AFINIDAD | RIESGO
    const bW = (W - marginX * 2) / 3
    const riesgoColor = ruta.riesgo_nivel === 'bajo' ? [22, 101, 52] : ruta.riesgo_nivel === 'alto' ? [185, 28, 28] : [146, 64, 14]
    const badges = [
      { text: `DECISIÓN: ${decTexto}`, color: pinCfg.color, x: marginX },
      { text: `AFINIDAD ${ruta.afinidad_porcentaje ?? 0}%`,   color: PRIMARY,      x: marginX + bW },
      { text: `RIESGO ${(ruta.riesgo_nivel || 'MEDIO').toUpperCase()}`, color: riesgoColor, x: marginX + bW * 2 },
    ]
    for (const b of badges) {
      doc.setFillColor(...b.color)
      doc.rect(b.x, y, bW - 1, 9, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      const bLines = doc.splitTextToSize(b.text, bW - 4)
      doc.text(bLines[0], b.x + 2, y + 6)
    }
    y += 13

    // Tabla de datos de la OPEC
    const dataRows = [
      ['OPEC', ruta.codigo_opec || '', 'Entidad', tr(ruta.entidad, 45)],
      ['Cargo', `${ruta.denominacion} ${ruta.nivel || ''} ${ruta.grado ? `G${ruta.grado}` : ''}`.trim(), 'Ciudad', ruta.ciudad || tr(ruta.ubicaciones_norm?.[0]?.ciudad, 30) || ''],
      ['Salario', ruta.salario || '', 'Vacantes', String(ruta.vacantes || 1)],
    ]
    const porQueTxt = ruta.por_que_conviene || ruta.por_que_esta_ruta || ''
    const puntoCrit  = ruta.punto_critico   || ruta.riesgo_explica   || ''
    if (porQueTxt || puntoCrit) {
      dataRows.push(['Por qué conviene', tr(porQueTxt, 80), 'Punto crítico', tr(puntoCrit, 80)])
    }
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      body: dataRows,
      theme: 'plain',
      styles: { fontSize: 8, textColor: GRAY, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 28, fillColor: GRAY_LIGHT },
        1: { cellWidth: 'auto' },
        2: { fontStyle: 'bold', cellWidth: 25, fillColor: GRAY_LIGHT },
        3: { cellWidth: 'auto' },
      },
    })
    y = doc.lastAutoTable.finalY + 4

    // Tabla de control VRM/VA/Habilitación/Equivalencias
    const vrmE = ruta.vrm || (ruta.cumplimiento?.experiencia === 'cumple' ? 'viable' : 'viable con verificacion')
    const vaE  = ruta.va  || 'potencial medio'
    const habE = ruta.habilitacion || (ruta.cumplimiento?.tarjeta_profesional === 'no aplica' ? 'no aplica' : 'verificar')
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Control', 'Resultado', 'Lectura para el aspirante']],
      body: [
        [{ content: 'VRM\nRequisitos mínimos', styles: { fontStyle: 'bold' } }, vrmE, VRM_L[vrmE] || VRM_L['viable con verificacion']],
        [{ content: 'VA\nAntecedentes',        styles: { fontStyle: 'bold' } }, vaE,  VA_L[vaE]  || VA_L['potencial medio']],
        [{ content: 'Habilitación',            styles: { fontStyle: 'bold' } }, habE, HAB_L[habE] || HAB_L['no aplica']],
        [{ content: 'Equivalencias',           styles: { fontStyle: 'bold' } }, 'No necesarias preliminarmente', 'No aplicar si no están expresamente previstas por OPEC/MEFCL/Acuerdo.'],
      ],
      theme: 'striped',
      headStyles: { fillColor: cfg.color, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 32, fontStyle: 'bold' }, 1: { cellWidth: 40 }, 2: { cellWidth: 'auto' } },
    })
    y = doc.lastAutoTable.finalY + 5

    // Antes de pagar el PIN
    const antesItems = ruta.antes_de_pagar?.length > 0 ? ruta.antes_de_pagar : (ruta.acciones_clave || [])
    if (antesItems.length > 0) {
      y = checkPage(doc, y, 20)
      doc.setTextColor(...PRIMARY)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Antes de pagar el PIN', marginX, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...GRAY)
      for (const item of antesItems.slice(0, 3)) {
        y = checkPage(doc, y, 8)
        const lines = doc.splitTextToSize(`— ${item}`, W - marginX * 2 - 5)
        doc.text(lines, marginX + 3, y)
        y += lines.length * 4.5
      }
      y += 3
    }

    // Decisión sugerida
    const decSugerida = ruta.decision_sugerida || ruta.justificacion || ''
    if (decSugerida) {
      y = checkPage(doc, y, 22)
      y = leftBox(doc, 'Decisión sugerida', decSugerida, y, marginX, W, [240, 253, 244], [22, 101, 52])
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ÚLTIMA PÁGINA — Descartadas + Checklist + Decisión final
  // ═══════════════════════════════════════════════════════════════
  const descartados = analisis.cargos_descartados_relevantes || []
  const decFinal    = analisis.decision_final_resumida || ''
  const tieneExtra  = descartados.length > 0 || decFinal

  if (tieneExtra) {
    doc.addPage()
    pageHeader(doc, W, marginX, convNombre)
    y = 24

    if (descartados.length > 0) {
      doc.setTextColor(...PRIMARY)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Opción no recomendada para comprar ahora', marginX, y)
      y += 5
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [['OPEC', 'Cargo', 'Motivo de descarte', 'Decisión']],
        body: descartados.map(d => [
          d.codigo_opec || '',
          tr(`${d.denominacion || ''} — ${d.entidad || ''}`, 50),
          tr(d.motivo_descarte || d.brecha_principal, 80),
          d.decision || 'No pagar PIN actualmente. Revisar como opción futura.',
        ]),
        theme: 'striped',
        headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 45 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 42, fontStyle: 'bold', textColor: [185, 28, 28] } },
      })
      y = doc.lastAutoTable.finalY + 6
    }

    // Checklist final
    y = checkPage(doc, y, 55)
    doc.setTextColor(...PRIMARY)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Checklist final antes de comprar cualquier PIN', marginX, y)
    y += 5
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['No.', 'Verificación', 'Resultado esperado']],
      body: [
        ['1', 'Código OPEC, entidad, municipio, grado y salario.',     'Coinciden con la opción seleccionada.'],
        ['2', 'Título profesional y posgrado.',                         'Legibles y asociados en SIMO.'],
        ['3', 'Tarjeta, matrícula o registro.',                         'Cargado solo si aplica por profesión/OPEC/norma.'],
        ['4', 'Certificaciones laborales.',                             'Incluyen fechas, cargo y funciones.'],
        ['5', 'Experiencia traslapada.',                                'No se suma doble.'],
        ['6', 'Equivalencias.',                                         'Solo se usan si están expresamente permitidas.'],
        ['7', 'Funciones relacionadas.',                                'Coinciden con el propósito de la OPEC.'],
        ['8', 'Decisión de compra.',                                    'Solo comprar si VRM es viable y riesgo documental no es alto.'],
      ],
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 80 }, 2: { cellWidth: 'auto' } },
    })
    y = doc.lastAutoTable.finalY + 6

    if (decFinal) {
      y = checkPage(doc, y, 22)
      y = leftBox(doc, 'Decisión final resumida', decFinal, y, marginX, W, PRI_LIGHT)
    }

    // Disclaimer
    y = checkPage(doc, y, 12)
    doc.setTextColor(120, 120, 120)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    const disc = 'Advertencia: este informe es orientativo, técnico y preventivo. La decisión final debe validarse en SIMO, OPEC oficial, Acuerdo de Convocatoria, Anexo Técnico y MEFCL. Praxia no garantiza admisión, puntaje, elegibilidad ni nombramiento.'
    const dLines = doc.splitTextToSize(disc, W - marginX * 2)
    doc.text(dLines, marginX, y)
  }

  // ═══════════════════════════════════════════════════════════════
  // OPECs adicionales exploradas (si las hay)
  // ═══════════════════════════════════════════════════════════════
  const ranking = analisis.ranking_opec_recomendadas || []
  if (ranking.length > 0) {
    doc.addPage()
    pageHeader(doc, W, marginX, convNombre)
    y = 24
    doc.setTextColor(...PRIMARY)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('OPECs adicionales exploradas', marginX, y)
    y += 5

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['#', 'Cargo', 'Entidad', 'Nivel', 'Afinidad', 'Decisión recomendada']],
      body: ranking.map((o, i) => [
        i + 1,
        tr(o.denominacion, 40),
        tr(o.entidad, 30),
        `${o.nivel || ''} ${o.grado ? `G${o.grado}` : ''}`.trim(),
        `${o.afinidad_porcentaje ?? 0}%`,
        tr(o.guia_para_el_usuario?.decision_recomendada || o.guia_para_el_usuario?.mensaje_claro || '', 40),
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: GRAY, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 50 }, 2: { cellWidth: 35 }, 3: { cellWidth: 22 }, 4: { cellWidth: 16, halign: 'center' }, 5: { cellWidth: 'auto' } },
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // Footer en todas las páginas
  // ═══════════════════════════════════════════════════════════════
  const total = doc.internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFillColor(...PRIMARY)
    doc.rect(0, 285, W, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('PRAXIA — Análisis de Perfil para Concurso de Méritos', marginX, 291)
    doc.text(`Página ${p} de ${total}`, W - marginX, 291, { align: 'right' })
  }

  doc.save(`praxia_analisis_pin_${Date.now()}.pdf`)
}
