// hooks/useVersionesManager.js
// Gestiona el estado y CRUD de versiones (package_versions) y sus warnings de consistencia.
// Las operaciones de versiones son optimistas donde aplica.

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../../../../../utils/supabase'

export function useVersionesManager({
  id,
  isEdit,
  niveles,
  profesiones,
  savedPkgId,
  savedPkgIdRef,
  setSavedPkg,
  obtenerPackageId,
  addToast,
  setErrorBloque,
}) {
  const [versiones, setVersiones] = useState([])
  const [warnings, setWarnings] = useState([])

  // Helper para obtener packageId seguro (prioriza ref, luego estado, luego null)
  const getSafePackageId = useCallback(() => {
    return savedPkgIdRef.current ?? savedPkgId ?? null
  }, [savedPkgId, savedPkgIdRef])

  // Refs para evitar doble ejecución en agregarVersion y duplicarVersion
  const creatingVersionRef = useRef(false)
  const duplicatingVersionRef = useRef(false)

  // ── Carga inicial ────────────────────────────────────────────────────────────
  async function cargarVersiones() {
    let packageId = getSafePackageId()
    if (!packageId) {
      packageId = await obtenerPackageId()
    }

    if (!packageId) {
      setVersiones([])
      if (isEdit) {
        const { data: pkgDirect } = await supabase
          .from('packages')
          .select('id')
          .contains('evaluations_ids', [parseInt(id, 10)])
          .limit(1)
        if (pkgDirect?.[0]?.id) {
          setSavedPkg(pkgDirect[0].id)
        } else {
          addToast('warning', 'Este paquete necesita ser re-guardado para activar versiones')
          setSavedPkg(-1)
        }
      }
      return
    }
    setSavedPkg(packageId)

    const { data: vers, error } = await supabase
      .from('package_versions')
      .select('*')
      .eq('package_id', packageId)
      .order('sort_order', { ascending: true })

    if (error) { addToast('error', 'Error al cargar versiones: ' + error.message); return }
    if (!vers?.length) { setVersiones([]); return }

    const versionIds = vers.map(v => v.id)

    const { data: pvLevels } = await supabase
      .from('package_version_levels')
      .select('package_version_id, level_id')
      .in('package_version_id', versionIds)

    const levelMap = {}
    pvLevels?.forEach(row => { levelMap[row.package_version_id] = row.level_id })

    const { data: lvs } = await supabase
      .from('levels').select('id, name').eq('evaluation_id', parseInt(id, 10))
    const levelNameMap = {}
    lvs?.forEach(l => { levelNameMap[l.id] = l.name })

    const versionesBase = vers.map(v => {
      const lvId = levelMap[v.id] || null
      return {
        ...v,
        level_id: lvId,
        level_display: lvId ? (levelNameMap[lvId] || '') : '',
        profession_display: '',
      }
    })
    setVersiones(versionesBase)

    const profIds = [...new Set(vers.map(v => v.profession_id).filter(Boolean))]
    if (profIds.length) {
      const { data: profs } = await supabase
        .from('professions').select('id, name').in('id', profIds)
      if (profs?.length) {
        setVersiones(prev =>
          prev.map(v => ({
            ...v,
            profession_display: profs.find(p => p.id === v.profession_id)?.name || '',
          }))
        )
      }
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  async function agregarVersion() {
    if (creatingVersionRef.current) return
    creatingVersionRef.current = true

    try {
      let pkgId = getSafePackageId()
      if (!pkgId) {
        pkgId = await obtenerPackageId()
      }

      if (!pkgId || pkgId < 0) {
        setErrorBloque({
          seccion: 'profesiones',
          message: 'Debes guardar el paquete antes de crear versiones',
          mensajeHumano: 'Primero guarda o publica el paquete para poder agregar versiones.',
          accionSugerida: 'Guarda el paquete (puede ser como borrador) e intenta de nuevo.',
        })
        addToast('warning', 'Primero guarda o publica el paquete para poder agregar versiones.')
        return
      }

      if (!savedPkgId || savedPkgId < 0) { setSavedPkg(pkgId) }

      const { data, error } = await supabase
        .from('package_versions')
        .insert({
          package_id: pkgId,
          profession_id: null,
          display_name: 'Nueva versión',
          price: 0,
          is_active: true,
          sort_order: versiones.length,
        })
        .select()
        .single()

      if (error) {
        addToast('error', 'No se pudo agregar la versión: ' + error.message)
        return
      }

      if (data) {
        setVersiones(prev => [...prev, {
          ...data, level_id: null, level_display: '', profession_display: '',
        }])
      }
    } finally {
      creatingVersionRef.current = false
    }
  }

  async function duplicarVersion(version) {
    // ✅ Protección contra doble click
    if (duplicatingVersionRef.current) return
    duplicatingVersionRef.current = true

    try {
      let packageId = getSafePackageId()
      if (!packageId) {
        packageId = await obtenerPackageId()
      }

      // ✅ Validación más estricta: también rechazar packageId < 0
      if (!packageId || packageId < 0) {
        setErrorBloque({
          seccion: 'profesiones',
          message: 'Debes guardar el paquete antes de duplicar versiones',
          mensajeHumano: 'Primero guarda o publica el paquete.',
          accionSugerida: 'Guarda el paquete e intenta de nuevo.',
        })
        return
      }

      // ✅ Sincronizar savedPkgId si está desactualizado
      if (!savedPkgId || savedPkgId < 0) {
        setSavedPkg(packageId)
      }

      const { data, error } = await supabase
        .from('package_versions')
        .insert({
          package_id: packageId,
          display_name: `${version.display_name} (copia)`,
          price: version.price,
          is_active: version.is_active,
          profession_id: version.profession_id || null,
          sort_order: versiones.length,
        })
        .select()
        .single()

      if (error) {
        addToast('error', 'No se pudo duplicar la versión: ' + error.message)
        return
      }

      if (data) {
        setVersiones(prev => [...prev, {
          ...data,
          level_id: version.level_id,
          level_display: version.level_display || '',
          profession_display: version.profession_display || '',
        }])

        if (version.level_id) {
          await supabase.from('package_version_levels').insert({
            package_version_id: data.id,
            level_id: version.level_id,
          })
        }
        addToast('success', 'Versión duplicada')
      }
    } finally {
      duplicatingVersionRef.current = false
    }
  }

  // Actualización optimista con revert si la BD falla
  async function actualizarVersion(versionId, campo, valor) {
    const versionPrevia = versiones.find(v => v.id === versionId)
    const valorPrevio = versionPrevia?.[campo]

    setVersiones(prev =>
      prev.map(v => v.id === versionId ? { ...v, [campo]: valor } : v)
    )

    const { error } = await supabase
      .from('package_versions')
      .update({ [campo]: valor })
      .eq('id', versionId)

    if (error) {
      setVersiones(prev =>
        prev.map(v => v.id === versionId ? { ...v, [campo]: valorPrevio } : v)
      )
      const msg = `Error al guardar cambio en versión: ${error.message}`
      addToast('error', msg)
      setErrorBloque({ seccion: 'profesiones', message: msg })
    }
  }

  // Resuelve texto libre a profession_id y persiste en BD si coincide
  function handleProfesionDisplayChange(versionId, texto) {
    const match = profesiones.find(p => p.name.toLowerCase() === texto.toLowerCase())
    setVersiones(prev =>
      prev.map(v =>
        v.id === versionId
          ? { ...v, profession_display: texto, profession_id: match ? match.id : null }
          : v
      )
    )

    if (match) {
      supabase
        .from('package_versions')
        .update({ profession_id: match.id })
        .eq('id', versionId)
        .then(({ error }) => {
          if (error) addToast('error', `Error al guardar profesión: ${error.message}`)
        })
    } else if (texto === '') {
      supabase
        .from('package_versions')
        .update({ profession_id: null })
        .eq('id', versionId)
        .then(({ error }) => {
          if (error) addToast('error', `Error al limpiar profesión: ${error.message}`)
        })
    }
  }

  // Solo acepta level_id si el nivel ya existe en BD (id numérico)
  function handleLevelDisplayChange(versionId, texto) {
    const match = niveles.find(n => n.name.toLowerCase() === texto.toLowerCase())
    const levelId = match ? (typeof match._id === 'number' ? match._id : null) : null
    setVersiones(prev =>
      prev.map(v =>
        v.id === versionId ? { ...v, level_display: texto, level_id: levelId } : v
      )
    )
  }

  async function eliminarVersion(versionId) {
    if (!confirm('¿Eliminar esta versión?')) return

    const { error: e1 } = await supabase
      .from('package_version_levels').delete().eq('package_version_id', versionId)
    if (e1) { addToast('error', 'Error al eliminar relaciones de nivel: ' + e1.message); return }

    const { error: e2 } = await supabase
      .from('package_versions').delete().eq('id', versionId)
    if (e2) { addToast('error', 'Error al eliminar versión: ' + e2.message); return }

    setVersiones(prev => prev.filter(v => v.id !== versionId))
    addToast('info', 'Versión eliminada')
  }

  // ── Warnings de consistencia ─────────────────────────────────────────────────

  const calcularWarnings = useCallback(() => {
    const warns = []
    const versionesActivas = versiones.filter(v => v.is_active)

    const nombres = versionesActivas.map(v => v.display_name?.trim().toLowerCase()).filter(Boolean)
    const duplicados = nombres.filter((n, i) => nombres.indexOf(n) !== i)
    if (duplicados.length) {
      warns.push(
        `Hay versiones activas con el mismo nombre: "${duplicados[0]}". ` +
        `Cada versión debe tener un nombre único.`
      )
    }

    const levelIdsUsados = new Set(versiones.map(v => v.level_id).filter(Boolean).map(String))
    const nivelesConId = niveles.filter(n => typeof n._id === 'number')
    const nivelesNoUsados = nivelesConId.filter(n => !levelIdsUsados.has(String(n._id)))
    if (nivelesNoUsados.length) {
      warns.push(
        `${nivelesNoUsados.length} nivel(es) no están asignados a ninguna versión: ` +
        `${nivelesNoUsados.map(n => n.name || 'sin nombre').join(', ')}.`
      )
    }

    for (const v of versionesActivas) {
      if (v.level_display && !v.level_id) {
        warns.push(
          `La versión "${v.display_name}" tiene nivel "${v.level_display}" ` +
          `pero no coincide con ningún nivel real.`
        )
      }
      if (v.profession_display && !v.profession_id) {
        warns.push(
          `La versión "${v.display_name}" tiene profesión "${v.profession_display}" ` +
          `que no existe en la base.`
        )
      }
    }

    setWarnings(warns)
    return warns
  }, [versiones, niveles])

  useEffect(() => { calcularWarnings() }, [versiones, niveles, calcularWarnings])

  return {
    versiones, setVersiones,
    warnings,
    cargarVersiones,
    agregarVersion,
    duplicarVersion,
    actualizarVersion,
    eliminarVersion,
    handleProfesionDisplayChange,
    handleLevelDisplayChange,
  }
}