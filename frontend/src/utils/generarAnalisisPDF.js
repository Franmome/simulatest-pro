import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PRAXIA_PURPLE = [91, 46, 210]   // #5b2ed2
const PRAXIA_LIGHT  = [237, 230, 255] // #ede6ff
const GRAY_TEXT     = [60, 60, 70]
const GRAY_LIGHT    = [240, 240, 245]

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

export function generarAnalisisPDF(analisis, convNombre) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getWidth()
  const marginX = 15
  let y = 0

  // ── Header band ──────────────────────────────────────────────────────────────
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

  // ── Convocatoria ──────────────────────────────────────────────────────────────
  if (convNombre) {
    doc.setFillColor(...PRAXIA_LIGHT)
    doc.roundedRect(marginX, y, W - marginX * 2, 10, 2, 2, 'F')
    doc.setTextColor(...PRAXIA_PURPLE)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('CONVOCATORIA', marginX + 3, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(truncate(convNombre, 90), marginX + 35, y + 4)
    y += 15
  }

  // ── Perfil del candidato ──────────────────────────────────────────────────────
  const perfil = analisis.perfil_candidato || {}
  const diag   = analisis.diagnostico_general || {}

  doc.setTextColor(...PRAXIA_PURPLE)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('PERFIL DEL CANDIDATO', marginX, y)
  y += 6

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
    alternateRowStyles: {},
  })
  y = doc.lastAutoTable.finalY + 8

  // ── Diagnóstico general ───────────────────────────────────────────────────────
  if (diag.resumen) {
    doc.setTextColor(...PRAXIA_PURPLE)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('DIAGNÓSTICO GENERAL', marginX, y)
    y += 5

    if (diag.nivel_competitividad) {
      doc.setFillColor(...PRAXIA_LIGHT)
      doc.roundedRect(marginX, y, 60, 8, 2, 2, 'F')
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
  }

  // ── Ranking de OPECs ─────────────────────────────────────────────────────────
  const ranking = analisis.ranking_opec_recomendadas || []
  if (ranking.length > 0) {
    doc.setTextColor(...PRAXIA_PURPLE)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('CARGOS RECOMENDADOS', marginX, y)
    y += 4

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
  }

  // ── Detalle por OPEC ─────────────────────────────────────────────────────────
  for (const [i, opec] of ranking.slice(0, 6).entries()) {
    if (y > 240) { doc.addPage(); y = 20 }

    // Encabezado OPEC
    doc.setFillColor(...PRAXIA_PURPLE)
    doc.rect(marginX, y, W - marginX * 2, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(`${i + 1}. ${truncate(opec.denominacion, 60)}`, marginX + 2, y + 5.5)
    doc.text(`${opec.afinidad_porcentaje ?? 0}%`, W - marginX - 2, y + 5.5, { align: 'right' })
    y += 10

    // Info básica
    const infoRows = []
    if (opec.numero_opec)      infoRows.push(['N° OPEC', String(opec.numero_opec)])
    if (opec.num_convocatoria) infoRows.push(['N° Convocatoria', String(opec.num_convocatoria)])
    if (opec.entidad)          infoRows.push(['Entidad', opec.entidad])
    if (opec.dependencia)      infoRows.push(['Dependencia', truncate(opec.dependencia, 80)])
    if (opec.nivel)            infoRows.push(['Nivel / Grado', `${opec.nivel} ${opec.grado ? `— Grado ${opec.grado}` : ''}`.trim()])
    if (opec.salario)          infoRows.push(['Salario', opec.salario])
    if (opec.vacantes)         infoRows.push(['Vacantes totales', String(opec.vacantes)])
    if (opec.ubicaciones_norm?.length > 0) {
      const ciudades = opec.ubicaciones_norm.map(u => `${u.ciudad}${u.vacantes ? ` (${u.vacantes})` : ''}`).join(', ')
      infoRows.push(['Ciudades', truncate(ciudades, 120)])
    }
    if (opec.justificacion) infoRows.push(['Justificación', truncate(opec.justificacion, 120)])

    if (infoRows.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        body: infoRows,
        theme: 'plain',
        styles: { fontSize: 7.5, textColor: GRAY_TEXT, cellPadding: 1.5 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 35, fillColor: GRAY_LIGHT },
          1: { cellWidth: 'auto' },
        },
      })
      y = doc.lastAutoTable.finalY + 4
    }

    // Cumplimiento
    const cum = opec.cumplimiento || {}
    const cumRows = Object.entries(cum)
      .filter(([, v]) => v)
      .map(([k, v]) => [k.replace(/_/g, ' '), v])
    if (cumRows.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [['Requisito', 'Estado']],
        body: cumRows,
        theme: 'grid',
        headStyles: { fillColor: [200, 190, 240], textColor: GRAY_TEXT, fontSize: 7.5, fontStyle: 'bold' },
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

    // Guía para el usuario
    const guia = opec.guia_para_el_usuario || {}
    if (guia.mensaje_claro) {
      doc.setFillColor(245, 243, 255)
      const msgLines = doc.splitTextToSize(`Mensaje: ${guia.mensaje_claro}`, W - marginX * 2 - 6)
      doc.roundedRect(marginX, y, W - marginX * 2, msgLines.length * 4 + 5, 2, 2, 'F')
      doc.setTextColor(...PRAXIA_PURPLE)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.text(msgLines, marginX + 3, y + 4)
      y += msgLines.length * 4 + 8
    }

    // Instrucción para encontrar el cargo
    if (opec.numero_opec || opec.num_convocatoria) {
      if (y > 265) { doc.addPage(); y = 20 }
      doc.setFillColor(237, 230, 255)
      doc.roundedRect(marginX, y, W - marginX * 2, 10, 2, 2, 'F')
      doc.setTextColor(...PRAXIA_PURPLE)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.text('Búsqueda:', marginX + 3, y + 6.5)
      doc.setFont('helvetica', 'normal')
      const simoTxt = `Ingresa a simo-opec.cnsc.gov.co → busca OPEC ${opec.numero_opec || ''} o la denominación del cargo`
      doc.text(simoTxt, marginX + 22, y + 6.5)
      y += 14
    }

    y += 4
  }

  // ── Recomendaciones de HV ────────────────────────────────────────────────────
  const rec = analisis.recomendaciones_para_mejorar_hoja_de_vida || {}
  const recEntries = Object.entries(rec).filter(([, v]) => Array.isArray(v) && v.length > 0)
  if (recEntries.length > 0) {
    if (y > 220) { doc.addPage(); y = 20 }
    doc.setTextColor(...PRAXIA_PURPLE)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('RECOMENDACIONES PARA MEJORAR TU HOJA DE VIDA', marginX, y)
    y += 6

    for (const [key, items] of recEntries) {
      if (y > 255) { doc.addPage(); y = 20 }
      doc.setTextColor(...GRAY_TEXT)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(key.replace(/_/g, ' ').toUpperCase(), marginX, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      for (const item of items.slice(0, 5)) {
        if (y > 270) { doc.addPage(); y = 20 }
        const lines = doc.splitTextToSize(`• ${item}`, W - marginX * 2 - 5)
        doc.text(lines, marginX + 3, y)
        y += lines.length * 4
      }
      y += 3
    }
  }

  // ── Footer en cada página ────────────────────────────────────────────────────
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
