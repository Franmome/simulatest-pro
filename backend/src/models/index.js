// ============================================================
//  MODELOS POO
//  Aplicando: Herencia, Encapsulamiento, Polimorfismo
// ============================================================

// ─── CLASE BASE: Usuario ─────────────────────────────────
export class Usuario {
  #passwordHash  // encapsulamiento: privado

  constructor({ id, nombre, email, passwordHash, rol = 'usuario', activo = true }) {
    this.id           = id
    this.nombre       = nombre
    this.email        = email
    this.#passwordHash = passwordHash
    this.rol          = rol
    this.activo       = activo
    this.fechaRegistro = new Date()
  }

  getPasswordHash() { return this.#passwordHash }

  // Polimorfismo: cada subclase define sus permisos
  getPermisos() { return ['ver_catalogo', 'tomar_simulacro'] }

  toJSON() {
    return { id: this.id, nombre: this.nombre, email: this.email, rol: this.rol, activo: this.activo }
  }
}

// ─── Herencia: Estudiante ─────────────────────────────────
export class Estudiante extends Usuario {
  constructor(data) {
    super({ ...data, rol: 'estudiante' })
    this.nivelAspiracion = data.nivelAspiracion || 'profesional'
    this.perfil          = data.perfil          || 'estudiante'
  }

  getPermisos() {
    return [...super.getPermisos(), 'ver_historial', 'descargar_reporte']
  }
}

// ─── Herencia: Administrador ─────────────────────────────
export class Administrador extends Usuario {
  constructor(data) {
    super({ ...data, rol: 'admin' })
  }

  getPermisos() {
    return [
      ...super.getPermisos(),
      'crear_evaluacion', 'editar_evaluacion', 'eliminar_evaluacion',
      'crear_paquete',    'editar_paquete',    'eliminar_paquete',
      'ver_usuarios',     'gestionar_usuarios',
    ]
  }
}

// ─── CLASE BASE: Evaluacion ──────────────────────────────
export class Evaluacion {
  constructor({ id, titulo, descripcion, categoriaId, activa = true }) {
    this.id          = id
    this.titulo      = titulo
    this.descripcion = descripcion
    this.categoriaId = categoriaId
    this.activa      = activa
  }

  // Polimorfismo: subclases pueden cambiar la lógica de calificación
  calcularPuntaje(respuestasCorrectas, totalPreguntas) {
    return Math.round((respuestasCorrectas / totalPreguntas) * 100)
  }
}

// ─── Herencia: EvaluacionNivel ───────────────────────────
export class EvaluacionNivel extends Evaluacion {
  constructor(data) {
    super(data)
    this.nivelId           = data.nivelId
    this.tiempoLimite      = data.tiempoLimite      || 120  // minutos
    this.numPreguntas      = data.numPreguntas      || 40
    this.puntajeAprobacion = data.puntajeAprobacion || 70   // %
  }

  estaAprobado(puntaje) {
    return puntaje >= this.puntajeAprobacion
  }
}

// ─── CLASE BASE: Paquete ─────────────────────────────────
export class Paquete {
  constructor({ id, nombre, descripcion, precio, activo = true }) {
    this.id          = id
    this.nombre      = nombre
    this.descripcion = descripcion
    this.precio      = precio
    this.activo      = activo
  }

  // Polimorfismo: cada tipo calcula su vencimiento diferente
  calcularFechaVencimiento(fechaInicio) {
    throw new Error('calcularFechaVencimiento debe implementarse en cada subclase')
  }
}

// ─── Herencia: PaqueteSuscripcion ────────────────────────
export class PaqueteSuscripcion extends Paquete {
  constructor(data) {
    super(data)
    this.tipo          = 'suscripcion'
    this.duracionDias  = data.duracionDias || 30
  }

  calcularFechaVencimiento(fechaInicio = new Date()) {
    const fecha = new Date(fechaInicio)
    fecha.setDate(fecha.getDate() + this.duracionDias)
    return fecha
  }
}

// ─── Herencia: PaqueteUnico ──────────────────────────────
export class PaqueteUnico extends Paquete {
  constructor(data) {
    super(data)
    this.tipo             = 'unico'
    this.evaluacionesIds  = data.evaluacionesIds || []  // IDs de evaluaciones incluidas
  }

  calcularFechaVencimiento(fechaInicio = new Date()) {
    // Acceso ilimitado, sin vencimiento
    return null
  }
}
