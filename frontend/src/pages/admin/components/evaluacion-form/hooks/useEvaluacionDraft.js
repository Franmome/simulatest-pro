// hooks/useEvaluacionDraft.js
// Gestiona el guardado de borrador (evaluación + paquete, sin validación completa).

import { useState } from 'react'
import { saveEvaluation } from '../services/evalService'
import { savePackage } from '../services/packageService'

export function useEvaluacionDraft({
  form,
  versiones,
  modoVersiones,
  savedEvalId,
  savedPkgId,           // ✅ CAMBIO 3: recibir savedPkgId
  setSavedEvalId,
  setSavedPkg,
  setErrorBloque,
}) {
  const [guardandoBorrador, setGuardandoBorrador] = useState(false)
  const [borradorGuardado, setBorradorGuardado] = useState(false)

  async function handleGuardarBorrador() {
    // ✅ CAMBIO 1: evitar doble ejecución
    if (guardandoBorrador) return

    setGuardandoBorrador(true)
    setErrorBloque(null)

    try {
      if (!form.title?.trim()) {
        throw new Error('El nombre del paquete es obligatorio')
      }

      // ✅ CAMBIO 2: usar savedEvalId si existe (edición vs creación)
      const isEditDraft = Boolean(savedEvalId)
      const { evalId } = await saveEvaluation({
        isEdit: isEditDraft,
        id: savedEvalId ?? null,
        form,
      })
      setSavedEvalId(evalId)

      // ✅ CAMBIO 3 (continuación): usar savedPkgId si existe
      const { packageId: pkgId } = await savePackage({
        packageId: savedPkgId ?? null,
        evalId,
        form,
        versiones,
        modoVersiones,
      })
      setSavedPkg(pkgId)

      setBorradorGuardado(true)
      setTimeout(() => setBorradorGuardado(false), 2000)

    } catch (err) {
      // ✅ CAMBIO 4: shape consistente para errorBloque
      setErrorBloque({
        seccion: err.seccion || 'general',
        message: err.message || 'Error al guardar borrador',
        mensajeHumano: err.mensajeHumano || null,
        accionSugerida: err.accionSugerida || null,
        technical: err.technical || null,
      })
    } finally {
      // ✅ CAMBIO 5: limpiar estado en finally
      setGuardandoBorrador(false)
    }
  }

  return {
    guardandoBorrador,
    borradorGuardado,
    handleGuardarBorrador,
  }
}