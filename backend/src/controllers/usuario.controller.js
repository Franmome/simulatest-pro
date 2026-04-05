export const getPerfil    = async (req, res) => res.json({ user: req.user })
export const getHistorial = async (req, res) => res.json({ historial: [] })
export const updatePerfil = async (req, res) => res.json({ updated: true })
