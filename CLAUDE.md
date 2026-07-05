# CLAUDE.md — Praxia: Guía completa para el asistente IA

> Este archivo se lee automáticamente al inicio de cada sesión.
> Objetivo: que Claude Code no rompa lo que ya funciona cuando arregla o añade algo nuevo.

---

## 1. ¿Qué es Praxia?

Plataforma colombiana para aspirantes a cargos del sector público (CNSC, Procuraduría, Contraloría, DIAN, Fiscalía). Funcionalidades principales:
- **Análisis de perfil CV** — el usuario sube su HV, la IA la compara con OPECs y devuelve 4 rutas estratégicas
- **Análisis de oferta de trabajo** — el usuario sube su HV + ofertas (PDF/Word/imagen) o selecciona OPECs desde la BD; la IA compara y devuelve semáforo por oferta
- **Simulacros de pruebas** — preguntas de juicio situado generadas por IA
- **Cuaderno IA** — notas asistidas por IA
- **Salas competitivas** — simulacros multijugador
- **Catálogo de paquetes** — banco de preguntas por cargo/entidad

**Stack:**
- Backend: Node.js (ESM) + Express, corre en **Railway** (servicio `simulatest-api`)
- Frontend: React + Vite + TailwindCSS, corre en **Railway** (servicio `simulatest-pro`)
- Base de datos: **Supabase** (Postgres)
- IA: Gemini 3.5 Flash (principal) + GPT-4o-mini (fallback) + DeepSeek V3 (último recurso)
- Pagos: **Wompi** (checkout + webhook)
- Deploy: push a `main` → Railway despliega automáticamente

---

## 2. Arquitectura de archivos críticos

```
backend/
  src/
    index.js                      ← CORS, middlewares globales, servidor
    controllers/
      ia.controller.js            ← TODO lo de IA: análisis perfil, oferta, tickets, chat, simulacros (3400+ líneas)
      wompi.controller.js         ← Webhook Wompi + generación de checkout (maneja TICKET y OFERTA)
      evaluacion.controller.js    ← CRUD evaluaciones/preguntas
      paquete.controller.js       ← CRUD paquetes del catálogo
    routes/
      ia.routes.js                ← Rutas IA + multer para PDF
      wompi.routes.js             ← /api/wompi/webhook + /api/wompi/checkout
    utils/
      tokenTracker.js             ← Saldo de tokens IA por purchase_id
      contextBuilder.js           ← Construye contexto del usuario para prompts
      promptLoader.js             ← Carga prompts desde BD o defaults
      allowedOrigins.js           ← Lista ÚNICA de origins permitidos (CORS + SSE) — editar aquí al cambiar dominio
      modelHealthCache.js         ← Rastrea fallos por modelo con TTL 5 min; max 2 fallos antes de degradar

frontend/
  src/
    pages/
      AnalisisPerfil.jsx          ← Página principal de análisis CV (2200+ líneas)
      AnalisisOferta.jsx          ← Análisis de oferta de trabajo (HV vs ofertas/OPECs de BD)
      admin/
        AdminAnalisis.jsx         ← Panel admin análisis OPEC: precio tickets + cantidad por compra
        AdminOferta.jsx           ← Panel admin análisis oferta: precio, prompt maestro, usuarios
        AdminTesoreria.jsx        ← Transacciones + usuarios con tickets
    context/
      AnalysisContext.jsx         ← Estado global del job de análisis (status/result/error)
    utils/
      generarAnalisisPDF.js       ← Genera PDF con resultados del análisis
      supabase.js                 ← Cliente Supabase (frontend)
```

---

## 3. Modelos de IA — estado actual

| Función | Modelo actual | Notas |
|---------|--------------|-------|
| `geminiGenerar()` | `gemini-3.5-flash` | timeout 90s obligatorio |
| `geminiAnalisisPerfil()` | `gemini-3.5-flash` | timeout 100s |
| `geminiChat()` | `gemini-3.5-flash` | — |
| `deepseekTexto()` | `deepseek-chat` | — |
| `deepseekAnalisisPerfil()` | `deepseek-chat` | — |
| `deepseekChat()` | `deepseek-chat` | — |
| `openaiClient` (GPT) | `gpt-4o-mini` | fallback en cascada de análisis y visión PDF |

**Cascada del análisis** (`analizarConIA` — nivel módulo en ia.controller.js):
```
1. Gemini 3.5 Flash — hasta 3 reintentos con backoff (3s/8s/20s) si 503
   Si marcado como degradado: intenta 1 vez igualmente (puede haberse recuperado)
2. GPT-4o-mini — si Gemini falla o está degradado (AbortSignal 120s)
3. DeepSeek — último recurso (timeout 180s)
```

**INVARIANTE:** Nunca cambiar estos nombres sin verificar que el modelo existe en la API.
**INVARIANTE:** Nunca añadir una llamada a Gemini sin `Promise.race(timeout)`.

---

## 4. Flujo crítico: Análisis de Perfil CV

Este es el flujo más importante. **Nunca romper ningún paso.**

```
1. Usuario sube PDF/imagen + selecciona convocatoria
   → AnalisisPerfil.jsx: solicitarAnalisis() → modal confirmación ticket
   → analizar() → SSE + POST /api/ia/analisis-perfil

2. Frontend → POST /api/ia/analisis-perfil (FormData: pdf + convocatoria_id + preferencias + jobId)
   → multer: uploadPerfil.single('pdf') — SIN límite de tamaño

3. Backend: analizarPerfilCV() — arquitectura ASYNC (evita timeout Railway ~120s)
   FASE 1 (síncrona, <1s):
   a. Verificar ticket (sin consumir aún)
   b. Validar convocatoria_id, archivo presente
   c. Verificar que no haya análisis en curso del mismo usuario (analisesEnCurso Set)
   d. analisesEnCurso.add(userId)  ← ANTES de responder
   e. res.json({ jobId, en_proceso: true })  ← responde YA al frontend
   f. setImmediate(async () => { ... })       ← análisis corre en background

   FASE 2 (background, sin límite de tiempo):
   g. Esperar slot de concurrencia (máx 5 simultáneos — waitSlotAnalisis)
   h. extractCvText(): Gemini Vision inline → Files API → OpenAI Vision → pdfjs-dist → pdf-parse
   i. PASS 1: analizarConIA() con SP_PERFIL (hardcoded dentro de analizarPerfilCV)
      → extrae perfil estructurado: títulos, experiencia, competencias, tarjeta profesional
      → Fallback: Gemini → GPT-4o-mini → DeepSeek
   j. PASS 2 (sin IA): motor de scoring determinista sobre TODOS los OPECs de la convocatoria
      → Filtros duros: nivel educativo, tarjeta profesional, posgrado, experiencia <75%
      → Score 0-100: educación(25)+experiencia(25)+funciones(25)+sector(10)+vacantes(10)+ciudad(5)
   k. PASS 3: analizarConIA() con SP_RUTAS (hardcoded dentro de analizarPerfilCV)
      → IA elige las 4 rutas estratégicas sobre el top 20 OPECs viables
      → Fallback determinista si la IA falla (devuelve ranking básico top 6)
   l. GUARDAR en user_profile_analysis (Supabase)
   m. CONSUMIR ticket (DESPUÉS del éxito, con optimistic locking)
      → .eq('tickets', ticketActual.tickets)  ← garantiza no double-spend
   n. em.emit('done', { analisis, opecs_pendientes, analisis_id, ... })
      → SSE entrega el resultado al frontend
   o. finally: analisesEnCurso.delete(userId) + releaseSlotAnalisis()

4. Frontend recibe resultado por SSE (evento 'listo') → setAnalisis() → render ResultsNew o ResultsOld
   → Todo renderizado con safeStr() + ErrorBoundary (protege contra React error #31)

INVARIANTE CRÍTICA: El ticket SIEMPRE se consume DESPUÉS de em.emit('done').
Nunca mover el consumo de ticket antes de que el análisis esté completo.

INVARIANTE ASYNC: El resultado del análisis llega por SSE, NO por el body del POST.
El POST solo devuelve { jobId, en_proceso: true }. No esperes datos de análisis en el res.json() del POST.

INVARIANTE DOUBLE-SPEND: analisesEnCurso.add(userId) se llama ANTES de res.json().
analisesEnCurso.delete(userId) se llama en el finally del setImmediate Y en el catch de waitSlotAnalisis.
Nunca remover estas llamadas.
```

**SP_PERFIL y SP_RUTAS:** Son constantes hardcoded definidas DENTRO de `analizarPerfilCV()` (líneas 1881 y 1977 de ia.controller.js). No se cargan desde app_config. Aquí está la integración del prompt por convocatoria (ver Sección 15).

---

## 5. Flujo crítico: Análisis de Oferta de Trabajo

```
Herramienta nueva: HV del candidato vs ofertas de trabajo (archivos o OPECs de BD).

1. Usuario sube su CV + agrega ofertas (hasta 5 archivos PDF/Word/imagen)
   O selecciona OPECs desde BD (dropdown convocatoria → buscar → modal detalle → añadir)
   Ambos modos pueden combinarse.

2. Frontend → POST /api/ia/analisis-oferta (FormData: cv + ofertas[] + opec_ids JSON + jobId)
   → multer.fields: cv(1) + ofertas(5) — SIN límite de tamaño

3. Backend: analizarOfertaTrabajo() — misma arquitectura ASYNC que análisis perfil
   FASE 1 (<1s): verificar ticket → validar → ofertasEnCurso.add(userId) → res.json({jobId})
   FASE 2 (background):
   a. extractCvText() del CV subido
   b. extractCvText() de cada archivo de oferta (si los hay)
   c. Para opec_ids: fetch desde opec_maestro → buildOpecTextoOferta() → texto estructurado
   d. Obtener prompt maestro desde app_config('oferta_analisis_prompt') con fallback a DEFAULT_OFERTA_PROMPT
   e. Para cada oferta: analizarConIA(promptMaestro, userPrompt) → resultado semáforo
   f. Guardar en user_oferta_analysis
   g. Consumir ticket (igual invariante que perfil)
   h. em.emit('done', resultado) → SSE

4. Resultado por SSE: array de ofertas con { aplica, porcentaje_compatibilidad, semaforo,
   puntos_fuertes, brechas, requisitos_criticos_cumplidos/faltantes, recomendacion, _fuente }

INVARIANTE: ofertasEnCurso.add(userId) ANTES de res.json().
ofertasEnCurso.delete(userId) en el finally Y en catch de waitSlotAnalisis.
INVARIANTE: ticket se consume DESPUÉS de em.emit('done').

Búsqueda de OPECs desde BD:
→ GET /api/ia/oferta/buscar-opecs?convocatoria_id=X&q=Y
→ Busca en opec_maestro por numero_opec, denominacion, codigo
→ buildOpecTextoOferta(opec): convierte OPEC a texto estructurado para la IA
```

---

## 6. Flujo crítico: Tickets + Wompi

```
ANÁLISIS DE PERFIL (tabla: user_analisis_tickets):
Referencia Wompi: {uuid_usuario}-TICKET-{cantidad}-{timestamp}
  - partes[5] === "TICKET" → suma tickets en user_analisis_tickets

ANÁLISIS DE OFERTA (tabla: user_oferta_tickets):
Referencia Wompi: {uuid_usuario}-OFERTA-{cantidad}-{timestamp}
  - partes[5] === "OFERTA" → suma tickets en user_oferta_tickets

Checkout perfil:  POST /api/ia/tickets/checkout → lee ticket_analisis_precio_cop / ticket_analisis_cantidad
Checkout oferta:  POST /api/ia/oferta/tickets/checkout → lee ticket_oferta_precio_cop / ticket_oferta_cantidad

Ambos: SHA256(ref + amountCents + "COP" + WOMPI_INTEGRITY_SECRET) = signature:integrity

Webhook: POST /api/wompi/webhook → webhookWompi()
  → Verifica firma con WOMPI_EVENTS_SECRET
  → partes[5] === "TICKET" → user_analisis_tickets
  → partes[5] === "OFERTA" → user_oferta_tickets
  → otro → lógica de paquetes/herramienta

INVARIANTE: NO cambiar el formato de referencia Wompi sin actualizar también el webhook.
El webhook parsea partes[5] para distinguir el tipo de compra.
```

---

## 7. CORS y manejo de errores — Invariantes

Los origins permitidos están en **UN SOLO LUGAR**:
```
backend/src/utils/allowedOrigins.js
```
Este archivo es importado por `index.js` (middleware cors + error handler) y por `ia.controller.js` (SSE handler de progreso). **Al comprar dominio o migrar a Cloud Run, solo editar `allowedOrigins.js`.**

**¿Por qué el SSE tiene su propio CORS?** El SSE usa `res.write()` directo (no el ciclo normal de Express), por eso necesita setear los headers manualmente.

**INVARIANTE:** Para añadir una nueva origin, editar ÚNICAMENTE `allowedOrigins.js`.

---

## 8. Timeouts Gemini — Invariante crítica

**INVARIANTE:** Nunca añadir una nueva llamada a Gemini sin `Promise.race(timeout)`.

```js
// CORRECTO — tiene timeout
async function geminiGenerar(parts, systemInstruction = null, modelId = 'gemini-3.5-flash', timeoutMs = 90_000) {
  const timeoutP = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Gemini timeout`)), timeoutMs)
  )
  return await Promise.race([model.generateContent(...), timeoutP])
}

// ⚠️ BUG PENDIENTE — geminiTexto() NO tiene timeout (línea ~276)
// Afecta: verificarOpec, analizarSala, generarPracticaDesdeIA
```

---

## 9. Tablas Supabase relevantes

| Tabla | Descripción |
|-------|-------------|
| `user_analisis_tickets` | `user_id`, `tickets` (int), `updated_at` — tickets análisis perfil |
| `user_oferta_tickets` | `user_id`, `tickets` (int), `updated_at` — tickets análisis oferta |
| `user_profile_analysis` | `id`, `user_id`, `convocatoria_id`, `convocatoria_nombre`, `analisis` (jsonb), `updated_at` |
| `user_oferta_analysis` | `id`, `user_id`, `analisis` (jsonb), `cantidad_ofertas`, `updated_at` |
| `app_config` | `key` (text PK), `value` (text), `updated_at` — configuración dinámica |
| `convocatorias` | Catálogo de convocatorias públicas (ver campos abajo) |
| `opec_maestro` | OPECs por convocatoria (puede tener miles de filas) |
| `transactions` | Historial de pagos Wompi |
| `user_simulacros` | Simulacros del usuario |
| `user_simulacro_analisis` | Análisis de resultados de simulacros |

**Campos actuales de `convocatorias`:**
`id, codigo, nombre, entidad, anio, descripcion, is_active, departamento, ciudad, plataforma_nombre, plataforma_url`

**app_config keys importantes:**
- `ticket_analisis_precio_cop` → precio tickets análisis perfil (ej. "20000")
- `ticket_analisis_cantidad` → tickets por compra perfil (ej. "2")
- `ticket_oferta_precio_cop` → precio tickets análisis oferta
- `ticket_oferta_cantidad` → tickets por compra oferta
- `oferta_analisis_prompt` → prompt maestro global para análisis de oferta

**Migraciones pendientes:**
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS modo_pruebas boolean DEFAULT false;`
- Migración para prompt por convocatoria (ver Sección 15)

---

## 10. Variables de entorno en Railway

**Backend (simulatest-api):**
```
SUPABASE_URL, SUPABASE_SERVICE_KEY
GEMINI_API_KEY
DEEPSEEK_API_KEY
OPENAI_API_KEY                    ← requerido para fallback GPT-4o-mini en análisis y visión PDF
WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET, WOMPI_EVENTS_SECRET
FRONTEND_URL=https://simulatest-pro-production.up.railway.app
RAILWAY_PUBLIC_DOMAIN (auto)
```

**Frontend (simulatest-pro):**
```
VITE_API_URL=https://simulatest-api-production.up.railway.app
```

---

## 11. Formato safeStr + ErrorBoundary (anti React error #31)

La IA a veces devuelve objetos donde se esperan strings en los arrays del análisis.
Todos los renders de arrays de resultados DEBEN usar `safeStr()`:

```js
// AnalisisPerfil.jsx y AnalisisOferta.jsx — safeStr() convierte cualquier valor a string legible
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

## 12. Workflow de desarrollo

```
feature/xxx  →  develop  →  main (producción)
hotfix/xxx   →  main (directamente, para bugs críticos)
```

- `main` = producción, Railway despliega automático
- Probar siempre en localhost antes de merge a main
- No hacer push a main a menos que el trabajo sea significativo y probado

---

## 13. Bugs conocidos (pendientes de fix)

| # | Severidad | Descripción | Archivo | Fix |
|---|-----------|-------------|---------|-----|
| 1 | MEDIO | `geminiTexto()` sin timeout | ia.controller.js:~276 | Añadir Promise.race(90_000) — afecta verificarOpec, analizarSala, generarPracticaDesdeIA |
| 2 | BAJO | `modo_pruebas` columna pendiente de migración | Supabase | `ALTER TABLE users ADD COLUMN IF NOT EXISTS modo_pruebas boolean DEFAULT false;` |
| 3 | BAJO | `SYSTEM_PROMPT_ANALISIS_PERFIL` constante ~3KB nunca usada | ia.controller.js:~1748 | Eliminar — el código usa SP_PERFIL y SP_RUTAS definidos dentro del handler |
| 4 | BAJO | `top10Ids`, `descartadosIds`, `perfil_base` computados pero nunca leídos | ia.controller.js:~1877,1929,1930 | Eliminar las tres líneas |
| 5 | BAJO | `masOpecs` usa DeepSeek directo sin cascada de fallback | ia.controller.js:~2203 | Reemplazar `deepseekAnalisisPerfil(...)` por `analizarConIA(...)` |
| 6 | BAJO | `fileSizeWarning` no se limpia al eliminar un archivo | AnalisisPerfil.jsx:~1517 | Añadir `setFileSizeWarning(null)` en `removeFile()` |
| 7 | BAJO | Health cache: Gemini puede quedar degradado indefinidamente durante spikes sostenidos | modelHealthCache.js | El TTL de 5 min se reinicia con cada `recordFailure` — estudiar si conviene añadir un techo de intentos |

---

## 14. Dominio personalizado / migración a Cloud Run — pendiente

Cuando se compre el dominio (praxia.app o similar):

**Código — UN SOLO archivo a editar:**
```js
// backend/src/utils/allowedOrigins.js
export const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://simulatest-pro-production.up.railway.app',
  'https://praxia.app',  // ← añadir aquí
]
```

**Variables de entorno a actualizar (3):**
- Backend: `FRONTEND_URL` → nueva URL del frontend
- Frontend: `VITE_API_URL` → nueva URL del backend
- Wompi: redirect URL del checkout si cambia el dominio del frontend

---

## 15. Prompt específico por convocatoria — DISEÑO PENDIENTE DE IMPLEMENTAR

**Problema:** Hoy SP_PERFIL y SP_RUTAS son constantes globales dentro de `analizarPerfilCV()`. Todas las convocatorias usan el mismo prompt. Una convocatoria de la DIAN (conocimientos tributarios críticos) necesita instrucciones distintas a una de la Fiscalía (experiencia investigativa).

**Solución diseñada:**

### Migración Supabase (correr antes de implementar):
```sql
ALTER TABLE convocatorias
  ADD COLUMN IF NOT EXISTS prompt_contexto TEXT,
  ADD COLUMN IF NOT EXISTS prompt_rutas    TEXT;
```

- `prompt_contexto` (≤800 chars): descripción de la entidad, qué perfil busca, qué pesa más. Se inyecta en PASS 1 (SP_PERFIL) y PASS 3 (SP_RUTAS).
- `prompt_rutas` (≤2000 chars): instrucciones específicas del proceso de selección, puntuación, documentos requeridos. Solo se inyecta en PASS 3 (SP_RUTAS).
- Si ambos son NULL → comportamiento actual sin cambio alguno.

### Cómo se inyectan (backend — analizarPerfilCV):
```js
// Ya existe: const convRow = convocatoria leída de BD
const promptContexto = convRow.prompt_contexto?.trim() || null
const promptRutas    = convRow.prompt_rutas?.trim()    || null

// PASS 1 — SP_PERFIL con contexto adicional si existe
const SP_PERFIL_FINAL = promptContexto
  ? SP_PERFIL + `\n\n--- CONTEXTO DE ESTA CONVOCATORIA ---\n${promptContexto}`
  : SP_PERFIL

// PASS 3 — SP_RUTAS con instrucciones específicas
const extras = [promptContexto, promptRutas].filter(Boolean).join('\n\n')
const SP_RUTAS_FINAL = extras
  ? SP_RUTAS + `\n\n--- INSTRUCCIONES ESPECÍFICAS PARA ESTA CONVOCATORIA ---\n${extras}`
  : SP_RUTAS
```

### Admin UI (pendiente crear):
- En el formulario de edición de convocatoria (AdminConvocatorias o similar), agregar pestaña "Prompt IA"
- Dos textareas: `prompt_contexto` (contexto general) y `prompt_rutas` (instrucciones de rutas)
- Mostrar preview de cómo quedaría el prompt final
- `createConvocatoria` y `updateConvocatoria` ya necesitan recibir y guardar estos campos

### INVARIANTE: El JSON schema de SP_RUTAS nunca debe modificarse ni moverse.
Solo se añaden instrucciones ANTES del esquema JSON. Esto garantiza que rescueAnalisis() siga funcionando.

---

## 16. Reglas de oro para Claude Code en este proyecto

1. **Leer el archivo completo antes de editar** si tiene más de 500 líneas
2. **Nunca mover el consumo de ticket** — siempre DESPUÉS de em.emit('done') en el background job
3. **Nunca cambiar el formato de referencia Wompi** sin actualizar el webhook (partes[5] determina el tipo)
4. **Nunca añadir llamada a Gemini sin timeout** (`Promise.race`)
5. **Nunca cambiar los modelos de IA** sin verificar que el nombre existe en la API
6. **Para cambiar origins CORS**, editar solo `backend/src/utils/allowedOrigins.js`
7. **Probar en localhost antes de push** — los usuarios reales están activos
8. **No hacer push a main** si el cambio no es significativo y probado
9. Antes de tocar `AnalisisPerfil.jsx`, leer el archivo completo — tiene 2200+ líneas con lógica interdependiente
10. Antes de tocar `ia.controller.js`, leer las funciones afectadas — tiene 3400+ líneas
11. **`analisesEnCurso` y `ofertasEnCurso`** — ambos Sets siguen la misma invariante: add ANTES de responder, delete en finally Y en catch
12. **SP_PERFIL y SP_RUTAS** están hardcoded dentro de `analizarPerfilCV()` — no son constantes globales ni vienen de app_config
