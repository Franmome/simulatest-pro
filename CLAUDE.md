# CLAUDE.md — Praxia: Guía completa para el asistente IA

> Este archivo se lee automáticamente al inicio de cada sesión.
> Objetivo: que Claude Code no rompa lo que ya funciona cuando arregla o añade algo nuevo.

---

## 1. ¿Qué es Praxia?

Plataforma colombiana para aspirantes a cargos del sector público (CNSC, Procuraduría, Contraloría, DIAN, Fiscalía). Funcionalidades principales:
- **Análisis de perfil CV** — el usuario sube su HV, la IA la compara con OPECs y devuelve 4 rutas estratégicas
- **Simulacros de pruebas** — preguntas de juicio situado generadas por IA
- **Cuaderno IA** — notas asistidas por IA
- **Salas competitivas** — simulacros multijugador
- **Catálogo de paquetes** — banco de preguntas por cargo/entidad

**Stack:**
- Backend: Node.js (ESM) + Express, corre en **Railway** (servicio `simulatest-api`)
- Frontend: React + Vite + TailwindCSS, corre en **Railway** (servicio `simulatest-pro`)
- Base de datos: **Supabase** (Postgres)
- IA: Gemini 2.5 Flash (principal) + DeepSeek V3 (fallback)
- Pagos: **Wompi** (checkout + webhook)
- Deploy: push a `main` → Railway despliega automáticamente

---

## 2. Arquitectura de archivos críticos

```
backend/
  src/
    index.js                      ← CORS, middlewares globales, servidor
    controllers/
      ia.controller.js            ← TODO lo de IA: análisis perfil, tickets, chat, simulacros (2800+ líneas)
      wompi.controller.js         ← Webhook Wompi + generación de checkout
      evaluacion.controller.js    ← CRUD evaluaciones/preguntas
      paquete.controller.js       ← CRUD paquetes del catálogo
    routes/
      ia.routes.js                ← Rutas IA + multer para PDF
      wompi.routes.js             ← /api/wompi/webhook + /api/wompi/checkout
    utils/
      tokenTracker.js             ← Saldo de tokens IA por purchase_id
      contextBuilder.js           ← Construye contexto del usuario para prompts
      promptLoader.js             ← Carga prompts desde BD o defaults

frontend/
  src/
    pages/
      AnalisisPerfil.jsx          ← Página principal de análisis CV (2200+ líneas)
      admin/
        AdminAnalisis.jsx         ← Panel admin: precio tickets + cantidad por compra
        AdminTesoreria.jsx        ← Transacciones + usuarios con tickets
    context/
      AnalysisContext.jsx         ← Estado global del job de análisis (status/result/error)
    utils/
      generarAnalisisPDF.js       ← Genera PDF con resultados del análisis
      supabase.js                 ← Cliente Supabase (frontend)
```

---

## 3. Modelos de IA correctos — NUNCA cambiar estos nombres

| Función | Modelo correcto | Modelo INCORRECTO (no usar) |
|---------|----------------|----------------------------|
| `geminiGenerar()` | `gemini-2.5-flash` | ~~gemini-3.x~~, ~~gemini-2.0-flash~~ |
| `geminiAnalisisPerfil()` | `gemini-2.5-flash` | ~~gemini-3.1-flash-lite~~ |
| `geminiChat()` | `gemini-2.5-flash` | ~~gemini-3.1-flash-lite~~ ← BUG CONOCIDO |
| `deepseekTexto()` | `deepseek-chat` | ~~deepseek-v4-flash~~ ← BUG CONOCIDO |
| `deepseekAnalisisPerfil()` | `deepseek-chat` | ~~deepseek-v4-flash~~ ← BUG CONOCIDO |
| `deepseekChat()` | `deepseek-chat` | ~~deepseek-v4-flash~~ ← BUG CONOCIDO |

**Bugs pendientes de corregir (6 lugares en ia.controller.js):**
- Línea 288: `gemini-3.1-flash-lite` → `gemini-2.5-flash`
- Líneas 309, 364, 375, 402, 864: `deepseek-v4-flash` → `deepseek-chat`

---

## 4. Flujo crítico: Análisis de Perfil CV

Este es el flujo más importante. **Nunca romper ningún paso.**

```
1. Usuario sube PDF/imagen + selecciona convocatoria
   → AnalisisPerfil.jsx: solicitarAnalisis() → modal confirmación ticket
   → analizar() → runAnalysis() [AnalysisContext global]

2. Frontend → POST /api/ia/analisis-perfil (FormData: pdf + convocatoria_id + preferencias)
   → multer: uploadPerfil.single('pdf') — SIN límite de tamaño

3. Backend: analizarPerfilCV() — ia.controller.js:1510
   a. VERIFICAR ticket (SELECT user_analisis_tickets) — sin consumir todavía
   b. Extraer texto del CV: Gemini Vision para PDF/imagen, mammoth para Word
   c. PASS 1: geminiAnalisisPerfil() con SP_PERFIL → extrae perfil estructurado
      - 3 reintentos si Gemini da 503
      - Fallback a DeepSeek si Gemini falla
      - ⚠️ Si DeepSeek tiene modelo inválido (bug pendiente), el fallback también falla
   d. PASS 2: motor de scoring determinista sobre TODAS las OPECs (sin IA)
   e. PASS 3: geminiAnalisisPerfil() con SP_RUTAS → asigna 4 rutas estratégicas
      - Fallback determinista si la IA falla (devuelve ranking básico)
   f. GUARDAR en user_profile_analysis (Supabase)
   g. CONSUMIR ticket (DESPUÉS del éxito, con optimistic locking)
      .eq('user_id', userId).eq('tickets', ticketActual.tickets)
   h. return res.json({ analisis, opecs_pendientes, analisis_id, ... })

4. Frontend recibe → setAnalisis() → render ResultsNew o ResultsOld
   → Todo renderizado con safeStr() + ErrorBoundary (protege contra React error #31)

INVARIANTE CRÍTICA: El ticket SIEMPRE se consume DESPUÉS de res.json().
Nunca mover el consumo de ticket antes de que el análisis esté completo.
```

---

## 5. Flujo crítico: Tickets + Wompi

```
Referencia Wompi: {uuid_usuario}-TICKET-{cantidad}-{timestamp}
  - uuid tiene 4 guiones → partes[0..4] = uuid, partes[5] = "TICKET", partes[6] = cantidad

Checkout:
  POST /api/ia/tickets/checkout → generateWompiTicketCheckout()
  → Lee precio (app_config.ticket_analisis_precio_cop) y cantidad (app_config.ticket_analisis_cantidad)
  → Genera URL Wompi con signature:integrity = SHA256(ref + amountCents + "COP" + WOMPI_INTEGRITY_SECRET)
  → Redirect después del pago a /analisis-perfil?id=...&env=...

Webhook: POST /api/wompi/webhook → webhookWompi()
  → Verifica firma con WOMPI_EVENTS_SECRET
  → Si partes[5] === "TICKET" → suma tickets en user_analisis_tickets
  → Si pago es de paquete/herramienta → lógica diferente

Frontend post-pago:
  → AnalisisPerfil detecta ?id=...&env=... en URL → muestra banner "Verificando..."
  → Poll fetchTickets() cada 5s hasta 5 veces
  → Cuando ticketBalance > 0 → banner verde "¡Pago exitoso!"
  → Auto-ocultar banner a los 6s

INVARIANTE: NO cambiar el formato de la referencia Wompi sin actualizar también el webhook.
El webhook parsea partes[5] === "TICKET" y partes[6] = cantidad.
```

---

## 6. CORS y manejo de errores — Invariantes

El CORS está configurado en **DOS lugares** en `backend/src/index.js`:
1. Middleware `cors()` (línea ~17) — lista de origins permitidos
2. Error handler global (línea ~51) — repite los headers CORS manualmente

**¿Por qué dos lugares?** Railway puede matar la conexión con 502 antes de que el middleware actúe. El error handler manual garantiza que incluso respuestas de error lleven CORS headers.

```js
// AMBAS listas deben mantenerse sincronizadas:
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://simulatest-pro-production.up.railway.app',
  // Al migrar a dominio propio: añadir 'https://praxia.app'
]
```

**INVARIANTE:** Si añades una nueva origin (ej. dominio propio), actualízala en AMBOS lugares.

---

## 7. Timeouts Gemini — Invariante crítica

Todas las llamadas a Gemini DEBEN tener `Promise.race` con timeout. Railway cierra conexiones sin CORS headers si el proceso dura >90s en el proxy.

```js
// CORRECTO — tiene timeout
async function geminiGenerar(parts, ..., timeoutMs = 90_000) {
  const timeoutP = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Gemini timeout`)), timeoutMs)
  )
  return await Promise.race([model.generateContent(...), timeoutP])
}

// ⚠️ BUG PENDIENTE — geminiTexto() NO tiene timeout (línea 276)
// Afecta: verificarOpec, analizarSala, generarPracticaDesdeIA
```

**INVARIANTE:** Nunca añadir una nueva llamada a Gemini sin `Promise.race(timeout)`.

---

## 8. Tablas Supabase relevantes

| Tabla | Descripción |
|-------|-------------|
| `user_analisis_tickets` | `user_id`, `tickets` (int), `updated_at` |
| `user_profile_analysis` | `id`, `user_id`, `convocatoria_id`, `convocatoria_nombre`, `analisis` (jsonb), `updated_at` |
| `app_config` | `key` (text PK), `value` (text), `updated_at` — configuración dinámica |
| `convocatorias` | Catálogo de convocatorias públicas |
| `opec_maestro` | OPECs por convocatoria (puede tener miles de filas) |
| `transactions` | Historial de pagos Wompi |
| `user_simulacros` | Simulacros del usuario |
| `user_simulacro_analisis` | Análisis de resultados de simulacros |

**app_config keys importantes:**
- `ticket_analisis_precio_cop` → precio en COP (ej. "20000")
- `ticket_analisis_cantidad` → tickets por compra (ej. "2")

**Migraciones pendientes:**
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS modo_pruebas boolean DEFAULT false;`

---

## 9. Variables de entorno en Railway

**Backend (simulatest-api):**
```
SUPABASE_URL, SUPABASE_SERVICE_KEY
GEMINI_API_KEY
DEEPSEEK_API_KEY
WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET, WOMPI_EVENTS_SECRET
FRONTEND_URL=https://simulatest-pro-production.up.railway.app
RAILWAY_PUBLIC_DOMAIN (auto)
```

**Frontend (simulatest-pro):**
```
VITE_API_URL=https://simulatest-api-production.up.railway.app
```

---

## 10. Formato safeStr + ErrorBoundary (anti React error #31)

La IA a veces devuelve objetos donde se esperan strings en los arrays del análisis.
Todos los renders de arrays de resultados DEBEN usar `safeStr()`:

```js
// AnalisisPerfil.jsx — safeStr() convierte cualquier valor a string legible
function safeStr(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    const s = v.accion || v.texto || v.value || v.denominacion || v.nombre || JSON.stringify(v)
    return typeof s === 'string' ? s : JSON.stringify(v)
  }
  return String(v)
}
```

`ErrorBoundary` envuelve `ResultsNew` y `ResultsOld` para que un crash en el render
no borre toda la página — muestra un mensaje de error amigable en su lugar.

---

## 11. Workflow de desarrollo (NUNCA hacer push directo a main con usuarios activos)

```
feature/xxx  →  develop  →  main (producción)
hotfix/xxx   →  main (directamente, para bugs críticos)
```

- `main` = producción, Railway despliega automático
- `develop` = staging (Railway puede conectarse aquí también si se configura)
- Probar siempre en localhost antes de merge a main
- No hacer push a main a menos que el trabajo sea significativo y probado

---

## 12. Bugs conocidos (pendientes de fix)

| # | Severidad | Descripción | Archivo:línea | Fix |
|---|-----------|-------------|--------------|-----|
| 1 | CRÍTICO | `gemini-3.1-flash-lite` modelo inválido en geminiChat | ia.controller.js:288 | Cambiar a `gemini-2.5-flash` |
| 2 | CRÍTICO | `deepseek-v4-flash` modelo inválido (×5) | ia.controller.js:309,364,375,402,864 | Cambiar a `deepseek-chat` |
| 3 | MEDIO | `geminiTexto()` sin timeout | ia.controller.js:276 | Añadir Promise.race(90_000) |
| 4 | BAJO | Modal análisis no valida saldo 0 antes de abrir | AnalisisPerfil.jsx:1459 | Check ticketBalance antes de setShowTicketConfirm |
| 5 | BAJO | `modo_pruebas` columna pendiente de migración | Supabase | SQL: ver sección 8 |

---

## 13. Dominio personalizado — pendiente

Cuando se compre el dominio (praxia.app o similar), hay exactamente 4 archivos de código y 3 env vars en Railway que cambiar. Ver memoria: `project_migracion_dominio.md`.

---

## 14. Reglas de oro para Claude Code en este proyecto

1. **Leer el archivo completo antes de editar** si tiene más de 500 líneas
2. **Nunca mover el consumo de ticket** — siempre DESPUÉS de res.json()
3. **Nunca cambiar el formato de referencia Wompi** sin actualizar el webhook
4. **Nunca añadir llamada a Gemini sin timeout**
5. **Nunca cambiar los modelos de IA** sin verificar que el nombre es válido
6. **Siempre sincronizar** las dos listas de CORS origins (cors() y ALLOWED_ORIGINS)
7. **Probar en localhost antes de push** — los usuarios reales están activos
8. **No hacer push a main** si el cambio no es significativo y probado
9. Antes de tocar `AnalisisPerfil.jsx`, leer el archivo completo — tiene 2200+ líneas con lógica interdependiente
10. Antes de tocar `ia.controller.js`, leer las funciones afectadas — tiene 2800+ líneas
