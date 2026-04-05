// paquete.controller.js
export const getPaquetes   = async (_req, res) => res.json({ paquetes: [] })
export const getPaquete    = async (req,  res) => res.json({ id: req.params.id })
export const comprarPaquete = async (req, res) => res.status(201).json({ ok: true, message: 'Integrar Stripe' })
