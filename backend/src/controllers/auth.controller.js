// auth.controller.js
import jwt from 'jsonwebtoken'

export const login = async (req, res) => {
  try {
    const { email, password } = req.body
    // TODO: verificar con Supabase Auth
    // Por ahora retorna token mock
    const token = jwt.sign({ id: '1', email, rol: 'estudiante' }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' })
    res.json({ token, user: { id: '1', email, nombre: 'Carlos Pérez', rol: 'estudiante' } })
  } catch (err) {
    res.status(401).json({ error: 'Credenciales inválidas' })
  }
}

export const register = async (req, res) => {
  try {
    const { nombre, apellido, email, password, tipo } = req.body
    // TODO: crear usuario en Supabase Auth + tabla usuarios
    const token = jwt.sign({ id: '1', email, rol: 'estudiante' }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' })
    res.status(201).json({ token, user: { id: '1', nombre, email, rol: 'estudiante' } })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

export const googleAuth = async (req, res) => {
  try {
    const { googleToken } = req.body
    // TODO: verificar token de Google con Supabase
    res.json({ message: 'Google OAuth - pendiente de implementar con Supabase' })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}
