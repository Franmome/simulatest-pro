// hooks/useEvaluacionDraft.js
// Gestiona el guardado de borrador (evaluación + paquete + niveles/preguntas).

import { useState } from 'react'
import { saveEvaluation, saveAllLevels } from '../services/evalService'
import { savePackage } from '../services/packageService'

export function useEvaluacionDraft({
  form,
  niveles,
  preguntas,
  versiones,
  modoVersiones,
  savedEvalId,
  savedPkgId,
  setSavedEvalId,
  setSavedPkg,
  setNiveles,
  setErrorBloque,
}) {
  const [guardandoBorrador, setGuardandoBorrador] = useState(false)
  const [borradorGuardado, setBorradorGuardado] = useState(false)

  async function handleGuardarBorrador() {
    if (guardandoBorrador) return

    setGuardandoBorrador(true)
    setErrorBloque(null)

    try {
      if (!form.title?.trim()) {
        throw new Error('El nombre del paquete es obligatorio')
      }

      // Borrador SIEMPRE inactivo, independiente del toggle "Publicar"
      const formBorrador = { ...form, is_active: false }
      const isEditDraft = Boolean(savedEvalId)

      const { evalId } = await saveEvaluation({
        isEdit: isEditDraft,
        id: savedEvalId ?? null,
        form: formBorrador,
      })
      setSavedEvalId(evalId)

      // Guardar niveles y preguntas si existen
      if (niveles?.length) {
        const { nivelesActualizados } = await saveAllLevels({
          evalId,
          niveles,
          preguntas: preguntas || {},
          isEdit: isEditDraft,
        })
        if (nivelesActualizados && setNiveles) setNiveles(nivelesActualizados)
      }

      const { packageId: pkgId } = await savePackage({
        packageId: savedPkgId ?? null,
        evalId,
        form: formBorrador,
        versiones,
        modoVersiones,
      })
      setSavedPkg(pkgId)

      setBorradorGuardado(true)
      setTimeout(() => setBorradorGuardado(false), 2000)

    } catch (err) {
      setErrorBloque({
        seccion: err.seccion || 'general',
        message: err.message || 'Error al guardar borrador',
        mensajeHumano: err.mensajeHumano || null,
        accionSugerida: err.accionSugerida || null,
        technical: err.technical || null,
      })
    } finally {
      setGuardandoBorrador(false)
    }
  }

  return {
    guardandoBorrador,
    borradorGuardado,
    handleGuardarBorrador,
  }
}