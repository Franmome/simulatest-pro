import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PRAXIA_PURPLE = [15, 40, 100]
const PRAXIA_LIGHT  = [219, 230, 255]
const GRAY_TEXT     = [30, 41, 59]
const GRAY_LIGHT    = [241, 245, 249]

const RUTA_COLORS = {
  ruta_principal:   { bg: [15, 40, 100],   label: 'RUTA PRINCIPAL — Tu mejor apuesta' },
  ruta_segura:      { bg: [22, 101, 52],   label: 'RUTA SEGURA — Menor competencia' },
  ruta_estrategica: { bg: [30, 64, 175],   label: 'RUTA ESTRATÉGICA — Mejor retorno' },
  ruta_ambiciosa:   { bg: [88, 28, 135],   label: 'RUTA AMBICIOSA — Tu techo competitivo' },
}

function truncate(str, max = 120) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '...' : str
}

function meses(m) {
  if (!m) return '—'
  const a = Math.floor(m / 12)
  const mo = m % 12
  if (a && mo) return `${a}a ${mo}m`
  if (a) return `${a} años`
  return `${mo} meses`
}

function checkPage(doc, y, needed = 30) {
  if (y + needed > 278) { doc.addPage(); return 20 }
  return y
}

function sectionTitle(doc, text, y, marginX) {
  doc.setTextColor(...PRAXIA_PURPLE)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(text, marginX, y)
  return y + 6
}

function renderRuta(doc, rutaKey, ruta, y, marginX, W) {
  const cfg = RUTA_COLORS[rutaKey] || RUTA_COLORS.ruta_principal

  y = checkPage(doc, y, 40)

  // Encabezado de la ruta (banda de color)
  doc.setFillColor(...cfg.bg)
  doc.rect(marginX, y, W - marginX * 2, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text(cfg.label, marginX + 3, y + 7)
  doc.text(`${ruta.afinidad_porcentaje ?? 0}%`, W - marginX - 3, y + 7, { align: 'right' })
  y += 12

  // Info básica del cargo
  const infoRows = []
  if (ruta.denominacion)      infoRows.push(['Cargo', truncate(ruta.denominacion, 70)])
  if (ruta.entidad)           infoRows.push(['Entidad', truncate(ruta.entidad, 70)])
  if (ruta.numero_opec)       infoRows.push(['N° OPEC', String(ruta.numero_opec)])
  if (ruta.num_convocatoria || ruta.codigo_opec)
                              infoRows.push(['N° Convocatoria', String(ruta.num_convocatoria || ruta.codigo_opec)])
  if (ruta.dependencia)       infoRows.push(['Dependencia', truncate(ruta.dependencia, 80)])
  if (ruta.nivel)             infoRows.push(['Nivel / Grado', `${ruta.nivel}${ruta.grado ? ` — Grado ${ruta.grado}` : ''}`])
  if (ruta.salario)           infoRows.push(['Salario', ruta.salario])
  if (ruta.vacantes)          infoRows.push(['Vacantes', String(ruta.vacantes)])
  if (ruta.riesgo_nivel)      infoRows.push(['Riesgo documental', ruta.riesgo_nivel.toUpperCase()])
  if (ruta.ubicaciones_norm?.length > 0) {
    const ciudades = ruta.ubicaciones_norm.slice(0, 8).map(u => `${u.ciudad}${u.vacantes ? ` (${u.vacantes})` : ''}`).join(', ')
    infoRows.push(['Ciudades', truncate(ciudades, 110)])
  }

  if (infoRows.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      body: infoRows,
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: GRAY_TEXT, cellPadding: 1.8 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 38, fillColor: GRAY_LIGHT },
        1: { cellWidth: 'auto' },
      },
    })
    y = doc.lastAutoTable.finalY + 4
  }

  // Por qué esta ruta
  if (ruta.por_que_esta_ruta) {
    y = checkPage(doc, y, 18)
    const bg = cfg.bg.map(c => Math.min(255, c + 210))
    const msgLines = doc.splitTextToSize(ruta.por_que_esta_ruta, W - marginX * 2 - 8)
    doc.setFillColor(...bg)
    doc.roundedRect(marginX, y, W - marginX * 2, msgLines.length * 4.2 + 7, 2, 2, 'F')
    doc.setTextColor(...cfg.bg)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text('Por qué esta ruta:', marginX + 3, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.text(msgLines, marginX + 3, y + 5 + 4.5)
    y += msgLines.length * 4.2 + 11
  }

  // Cumplimiento
  const cum = ruta.cumplimiento || {}
  const cumRows = Object.entries(cum).filter(([, v]) => v).map(([k, v]) => [k.replace(/_/g, ' '), v])
  if (cumRows.length) {
    y = checkPage(doc, y, 20)
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Requisito', 'Estado']],
      body: cumRows,
      theme: 'grid',
      headStyles: { fillColor: PRAXIA_LIGHT, textColor: GRAY_TEXT, fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: GRAY_TEXT },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 'auto' } },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          const v = String(data.cell.raw || '').toLowerCase()
          if (v === 'cumple') data.cell.styles.textColor = [22, 163, 74]
          else if (v.includes('parcial') || v.includes('validaci')) data.cell.styles.textColor = [180, 120, 0]
          else if (v === 'no cumple') data.cell.styles.textColor = [220, 38, 38]
        }
      },
    })
    y = doc.lastAutoTable.finalY + 4
  }

  // Coincidencias y brechas en columnas
  const coinc = ruta.coincidencias_principales || []
  const brechas = ruta.brechas_concretas || []
  if (coinc.length || brechas.length) {
    y = checkPage(doc, y, 20)
    const rows = Math.max(coinc.length, brechas.length)
    const tableBody = Array.from({ length: rows }, (_, i) => [
      coinc[i] ? `✓ ${truncate(coinc[i], 50)}` : '',
      brechas[i] ? `! ${truncate(brechas[i], 50)}` : '',
    ])
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Coincidencias', 'Brechas']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: PRAXIA_LIGHT, textColor: GRAY_TEXT, fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: GRAY_TEXT },
      didParseCell(data) {
        if (data.section === 'body') {
          if (data.column.index === 0 && data.cell.raw?.startsWith('✓')) data.cell.styles.textColor = [22, 163, 74]
          if (data.column.index === 1 && data.cell.raw?.startsWith('!')) data.cell.styles.textColor = [180, 120, 0]
        }
      },
    })
    y = doc.lastAutoTable.finalY + 4
  }

  // Acciones clave
  if (ruta.acciones_clave?.length > 0) {
    y = checkPage(doc, y, 20)
    doc.setTextColor(...GRAY_TEXT)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Acciones clave antes de postularte:', marginX, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    for (const [j, accion] of ruta.acciones_clave.entries()) {
      y = checkPage(doc, y, 10)
      const lines = doc.splitTextToSize(`${j + 1}. ${accion}`, W - marginX * 2 - 5)
      doc.text(lines, marginX + 3, y)
      y += lines.length * 4 + 1
    }
    y += 3
  }

  // Justificación
  if (ruta.justificacion) {
    y = checkPage(doc, y, 14)
    doc.setTextColor(100, 100, 120)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'italic')
    const lines = doc.splitTextToSize(`Justificación: ${ruta.justificacion}`, W - marginX * 2)
    doc.text(lines, marginX, y)
    y += lines.length * 4 + 3
  }

  // Instrucción SIMO
  if (ruta.numero_opec || ruta.num_convocatoria || ruta.codigo_opec) {
    y = checkPage(doc, y, 12)
    doc.setFillColor(237, 230, 255)
    doc.roundedRect(marginX, y, W - marginX * 2, 10, 2, 2, 'F')
    doc.setTextColor(...PRAXIA_PURPLE)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text('Búsqueda:', marginX + 3, y + 6.5)
    doc.setFont('helvetica', 'normal')
    const simoTxt = `simo-opec.cnsc.gov.co → OPEC ${ruta.numero_opec || ruta.codigo_opec || ''} · ${truncate(ruta.denominacion, 40)}`
    doc.text(simoTxt, marginX + 24, y + 6.5)
    y += 13
  }

  return y + 4
}

export function generarAnalisisPDF(analisis, convNombre) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const marginX = 15
  let y = 0

  // ── Header ───────────────────────────────────────────────────────────────────
  doc.setFillColor(...PRAXIA_PURPLE)
  doc.rect(0, 0, W, 38, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('PRAXIA', marginX, 15)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Plataforma de preparación para concursos de méritos', marginX, 21)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Análisis de Perfil Profesional', marginX, 31)
  const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(fecha, W - marginX, 31, { align: 'right' })
  y = 46

  // ── Convocatoria ─────────────────────────────────────────────────────────────
  if (convNombre) {
    doc.setFillColor(...PRAXIA_LIGHT)
    doc.roundedRect(marginX, y, W - marginX * 2, 10, 2, 2, 'F')
    doc.setTextColor(...PRAXIA_PURPLE)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('CONVOCATORIA', marginX + 3, y + 7)
    doc.setFont('helvetica', 'normal')
    doc.text(truncate(convNombre, 90), marginX + 37, y + 7)
    y += 15
  }

  // ── Perfil del candidato ──────────────────────────────────────────────────────
  const perfil = analisis.perfil_candidato || {}
  const diag   = analisis.diagnostico_general || {}

  y = sectionTitle(doc, 'PERFIL DEL CANDIDATO', y, marginX)

  const perfilRows = [
    ['Nombre', perfil.nombre || '—'],
    ['Profesión', perfil.profesion_principal || '—'],
    ['Nivel de formación', perfil.nivel_formacion || '—'],
    ['Títulos', (perfil.titulos_identificados || []).join(', ') || '—'],
    ['Experiencia total', meses(perfil.experiencia_total_estimada_meses)],
    ['Exp. sector público', meses(perfil.experiencia_sector_publico_meses)],
    ['Áreas de experiencia', (perfil.areas_experiencia || []).join(', ') || '—'],
    ['Tarjeta profesional', perfil.tarjeta_profesional?.estado || '—'],
  ].filter(([, v]) => v && v !== '—')

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    body: perfilRows,
    theme: 'plain',
    styles: { fontSize: 8, textColor: GRAY_TEXT, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, fillColor: GRAY_LIGHT },
      1: { cellWidth: 'auto' },
    },
  })
  y = doc.lastAutoTable.finalY + 8

  // ── Diagnóstico general ───────────────────────────────────────────────────────
  if (diag.resumen) {
    y = checkPage(doc, y, 30)
    y = sectionTitle(doc, 'DIAGNÓSTICO GENERAL', y, marginX)

    if (diag.nivel_competitividad) {
      doc.setFillColor(...PRAXIA_LIGHT)
      doc.roundedRect(marginX, y, 65, 8, 2, 2, 'F')
      doc.setTextColor(...PRAXIA_PURPLE)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(diag.nivel_competitividad.toUpperCase(), marginX + 3, y + 5.5)
      y += 12
    }

    doc.setTextColor(...GRAY_TEXT)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(diag.resumen, W - marginX * 2)
    doc.text(lines, marginX, y)
    y += lines.length * 4.5 + 6

    // Fortalezas y debilidades
    const forts = diag.fortalezas_principales || []
    const debs  = diag.debilidades_principales || []
    if (forts.length || debs.length) {
      const rows = Array.from({ length: Math.max(forts.length, debs.length) }, (_, i) => [
        forts[i] ? `✓ ${truncate(forts[i], 55)}` : '',
        debs[i]  ? `! ${truncate(debs[i], 55)}`  : '',
      ])
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [['Fortalezas', 'Áreas de mejora']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: PRAXIA_LIGHT, textColor: GRAY_TEXT, fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, textColor: GRAY_TEXT },
        didParseCell(data) {
          if (data.section === 'body') {
            if (data.column.index === 0 && data.cell.raw?.startsWith('✓')) data.cell.styles.textColor = [22, 163, 74]
            if (data.column.index === 1 && data.cell.raw?.startsWith('!')) data.cell.styles.textColor = [180, 100, 0]
          }
        },
      })
      y = doc.lastAutoTable.finalY + 8
    }
  }

  // ── 4 Rutas estratégicas (nuevo motor) ───────────────────────────────────────
  const rutas = analisis.rutas
  if (rutas && Object.keys(rutas).length > 0) {
    y = checkPage(doc, y, 20)
    y = sectionTitle(doc, 'TUS 4 RUTAS ESTRATÉGICAS', y, marginX)

    // Tabla resumen de las 4 rutas
    const rutasOrden = ['ruta_principal', 'ruta_segura', 'ruta_estrategica', 'ruta_ambiciosa']
    const resumenRutas = rutasOrden
      .filter(k => rutas[k]?.denominacion)
      .map(k => {
        const r = rutas[k]
        const cfg = RUTA_COLORS[k]
        return [
          cfg.label.split('—')[0].trim(),
          truncate(r.denominacion, 40),
          truncate(r.entidad, 28),
          `${r.nivel || ''} ${r.grado ? `G${r.grado}` : ''}`.trim(),
          `${r.afinidad_porcentaje ?? 0}%`,
          r.vacantes ? String(r.vacantes) : '—',
        ]
      })

    if (resumenRutas.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [['Ruta', 'Cargo', 'Entidad', 'Nivel', 'Afinidad', 'Vac.']],
        body: resumenRutas,
        theme: 'striped',
        headStyles: { fillColor: PRAXIA_PURPLE, textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: GRAY_TEXT },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 42 },
          2: { cellWidth: 32 },
          3: { cellWidth: 18 },
          4: { cellWidth: 14, halign: 'center' },
          5: { cellWidth: 12, halign: 'center' },
        },
      })
      y = doc.lastAutoTable.finalY + 10
    }

    // Detalle de cada ruta
    for (const key of rutasOrden) {
      if (!rutas[key]?.denominacion) continue
      y = checkPage(doc, y, 40)
      y = renderRuta(doc, key, rutas[key], y, marginX, W)
    }
  }

  // ── Fallback: ranking antiguo (análisis históricos) ───────────────────────────
  const ranking = analisis.ranking_opec_recomendadas || []
  if (!rutas && ranking.length > 0) {
    y = checkPage(doc, y, 20)
    y = sectionTitle(doc, 'CARGOS RECOMENDADOS', y, marginX)

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['#', 'Cargo', 'Entidad', 'Nivel', 'Afinidad', 'Decisión']],
      body: ranking.map((o, i) => [
        i + 1,
        truncate(o.denominacion, 40),
        truncate(o.entidad, 30),
        `${o.nivel || ''} ${o.grado ? `G${o.grado}` : ''}`.trim(),
        `${o.afinidad_porcentaje ?? 0}%`,
        truncate(o.guia_para_el_usuario?.decision_recomendada || '', 35),
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRAXIA_PURPLE, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: GRAY_TEXT },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 45 },
        2: { cellWidth: 35 },
        3: { cellWidth: 20 },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 'auto' },
      },
    })
    y = doc.lastAutoTable.finalY + 10

    for (const [i, opec] of ranking.slice(0, 6).entries()) {
      if (y > 240) { doc.addPage(); y = 20 }
      doc.setFillColor(...PRAXIA_PURPLE)
      doc.rect(marginX, y, W - marginX * 2, 8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}. ${truncate(opec.denominacion, 60)}`, marginX + 2, y + 5.5)
      doc.text(`${opec.afinidad_porcentaje ?? 0}%`, W - marginX - 2, y + 5.5, { align: 'right' })
      y += 10

      const infoRows = []
      if (opec.numero_opec)      infoRows.push(['N° OPEC', String(opec.numero_opec)])
      if (opec.num_convocatoria) infoRows.push(['N° Convocatoria', String(opec.num_convocatoria)])
      if (opec.entidad)          infoRows.push(['Entidad', opec.entidad])
      if (opec.dependencia)      infoRows.push(['Dependencia', truncate(opec.dependencia, 80)])
      if (opec.nivel)            infoRows.push(['Nivel / Grado', `${opec.nivel} ${opec.grado ? `— Grado ${opec.grado}` : ''}`.trim()])
      if (opec.salario)          infoRows.push(['Salario', opec.salario])
      if (opec.vacantes)         infoRows.push(['Vacantes', String(opec.vacantes)])
      if (opec.ubicaciones_norm?.length > 0) {
        const ciudades = opec.ubicaciones_norm.map(u => `${u.ciudad}${u.vacantes ? ` (${u.vacantes})` : ''}`).join(', ')
        infoRows.push(['Ciudades', truncate(ciudades, 120)])
      }
      if (opec.justificacion)    infoRows.push(['Justificación', truncate(opec.justificacion, 120)])

      if (infoRows.length) {
        autoTable(doc, {
          startY: y,
          margin: { left: marginX, right: marginX },
          body: infoRows,
          theme: 'plain',
          styles: { fontSize: 7.5, textColor: GRAY_TEXT, cellPadding: 1.5 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35, fillColor: GRAY_LIGHT }, 1: { cellWidth: 'auto' } },
        })
        y = doc.lastAutoTable.finalY + 4
      }

      const guia = opec.guia_para_el_usuario || {}
      if (guia.mensaje_claro) {
        const msgLines = doc.splitTextToSize(`Mensaje: ${guia.mensaje_claro}`, W - marginX * 2 - 6)
        doc.setFillColor(245, 243, 255)
        doc.roundedRect(marginX, y, W - marginX * 2, msgLines.length * 4 + 5, 2, 2, 'F')
        doc.setTextColor(...PRAXIA_PURPLE)
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        doc.text(msgLines, marginX + 3, y + 4)
        y += msgLines.length * 4 + 8
      }
      y += 4
    }
  }

  // ── Recomendaciones de HV ─────────────────────────────────────────────────────
  const rec = analisis.recomendaciones_para_mejorar_hoja_de_vida || {}
  const recEntries = Object.entries(rec).filter(([, v]) => Array.isArray(v) && v.length > 0)
  if (recEntries.length > 0) {
    y = checkPage(doc, y, 30)
    y = sectionTitle(doc, 'RECOMENDACIONES PARA MEJORAR TU HOJA DE VIDA', y, marginX)

    for (const [key, items] of recEntries) {
      y = checkPage(doc, y, 20)
      doc.setTextColor(...GRAY_TEXT)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(key.replace(/_/g, ' ').toUpperCase(), marginX, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      for (const item of items.slice(0, 5)) {
        y = checkPage(doc, y, 10)
        const lines = doc.splitTextToSize(`• ${item}`, W - marginX * 2 - 5)
        doc.text(lines, marginX + 3, y)
        y += lines.length * 4
      }
      y += 3
    }
  }

  // ── Acciones prioritarias ─────────────────────────────────────────────────────
  const acciones = analisis.acciones_prioritarias || []
  if (acciones.length > 0) {
    y = checkPage(doc, y, 25)
    y = sectionTitle(doc, 'ACCIONES PRIORITARIAS', y, marginX)
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['#', 'Acción', 'Motivo']],
      body: acciones.map(a => [a.prioridad ?? '', truncate(a.accion, 70), truncate(a.motivo, 60)]),
      theme: 'striped',
      headStyles: { fillColor: PRAXIA_LIGHT, textColor: GRAY_TEXT, fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: GRAY_TEXT },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 80 }, 2: { cellWidth: 'auto' } },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Footer en cada página ─────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(...PRAXIA_PURPLE)
    doc.rect(0, 287, W, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Generado por Praxia · Plataforma de preparación para concursos de méritos del sector público colombiano', marginX, 293)
    doc.text(`Pág. ${p} / ${totalPages}`, W - marginX, 293, { align: 'right' })
  }

  const nombreCandidato = (analisis.perfil_candidato?.nombre || 'analisis').replace(/\s+/g, '_').toLowerCase()
  doc.save(`praxia_analisis_${nombreCandidato}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
