// validation.js
// Función de validación del formulario de evaluación antes de guardar.
// Lanza errores etiquetados con sección para que el banner navegue al tab correcto.

export function validarAntesDeGuardar({ form, niveles, versiones, preguntas, isDraft = false }) {
  if (!form.title.trim()) {
    throw Object.assign(
      new Error('El nombre del paquete es obligatorio.'),
      {
        seccion: 'general',
        mensajeHumano: 'El nombre del paquete no puede estar vacío.',
        accionSugerida: 'Escribe un nombre en la pestaña "Info del Paquete".',
      }
    )
  }
  if (niveles.some(n => !n.name.trim())) {
    throw Object.assign(
      new Error('Todos los niveles deben tener nombre.'),
      {
        seccion: 'niveles',
        mensajeHumano: 'Uno o más niveles no tienen nombre asignado.',
        accionSugerida: 'Ve a la pestaña "Niveles" y asigna un nombre a cada uno.',
      }
    )
  }

  if (!isDraft) {
    const versionesActivas = versiones.filter(v => v.is_active)
    if (!versionesActivas.length) {
      throw Object.assign(
        new Error('Debes tener al menos una versión activa.'),
        {
          seccion: 'profesiones',
          mensajeHumano: 'No hay versiones activas en el paquete.',
          accionSugerida: 'Ve a "Versiones y Precios" y activa al menos una versión.',
        }
      )
    }

    for (const v of versionesActivas) {
      if (!v.display_name?.trim()) {
        throw Object.assign(
          new Error('Todas las versiones activas deben tener nombre.'),
          {
            seccion: 'profesiones',
            mensajeHumano: 'Una versión activa no tiene nombre.',
            accionSugerida: 'Asigna un nombre a todas las versiones activas.',
          }
        )
      }
      if (!v.price || v.price <= 0) {
        throw Object.assign(
          new Error(`La versión "${v.display_name}" debe tener un precio válido.`),
          {
            seccion: 'profesiones',
            mensajeHumano: `El precio de "${v.display_name}" es 0 o no válido.`,
            accionSugerida: 'Ingresa un precio mayor a 0 en la versión.',
          }
        )
      }
      if (!v.level_id && !v.level_display) {
        throw Object.assign(
          new Error(`La versión "${v.display_name}" debe tener un banco de preguntas asignado.`),
          {
            seccion: 'profesiones',
            mensajeHumano: `"${v.display_name}" no tiene nivel asignado.`,
            accionSugerida: 'Escribe el nombre del nivel y selecciónalo de la lista.',
          }
        )
      }
      if (v.level_display && !v.level_id) {
        throw Object.assign(
          new Error(`La versión "${v.display_name}" tiene un banco que no coincide con ningún nivel real.`),
          {
            seccion: 'profesiones',
            mensajeHumano: `El nivel "${v.level_display}" no existe o no fue seleccionado de la lista.`,
            accionSugerida: 'Selecciona el nivel desde la lista desplegable.',
          }
        )
      }
      if (v.level_id !== null && typeof v.level_id !== 'number') {
        throw Object.assign(
          new Error(`La versión "${v.display_name}" tiene un banco que no ha sido guardado aún.`),
          {
            seccion: 'niveles',
            mensajeHumano: 'El nivel aún no existe en la BD (es nuevo).',
            accionSugerida: 'Guarda los niveles primero antes de asignarlos a versiones.',
          }
        )
      }
    }
  }

  for (const nv of niveles) {
    const pregs = preguntas[nv._id] || []
    if (pregs.length === 0 || pregs.every(p => !p.text?.trim())) {
      throw Object.assign(
        new Error(`El nivel "${nv.name || 'sin nombre'}" no tiene preguntas válidas.`),
        {
          seccion: 'preguntas',
          mensajeHumano: `"${nv.name || 'sin nombre'}" no tiene preguntas con enunciado.`,
          accionSugerida: 'Agrega al menos una pregunta con enunciado a este nivel.',
        }
      )
    }
  }
}
