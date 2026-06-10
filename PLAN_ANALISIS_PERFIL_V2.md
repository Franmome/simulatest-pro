# Plan: Sistema Todo-Terreno Análisis de Perfil v2
> Creado: 2026-06-10 | Estado: EN ANÁLISIS — no se ha tocado código aún

---

## Problema raíz

El sistema actual es un flujo lineal sin checkpoints. Cuando Gemini Vision falla (503, timeout),
la extracción devuelve 0 chars y el análisis continúa de todas formas.
Resultado: usuario gasta ticket, recibe análisis vacío o incompleto.

Casos reales de falla en producción (logs 2026-06-09):
- PDF comprimido con imágenes (~3MB) → Gemini Vision timeout → 0 chars → análisis basura
- Gemini 2.5 Flash saturado → 503 × 2 reintentos → DeepSeek fallback
- DeepSeek hit max_tokens=8192 (hardcoded) → JSON truncado → solo 1 ruta de 4
- PDF de 26MB → funciona a veces, falla otras (depende de carga de Gemini)

---

## Precios reales por modelo (verificados 2026-06-10)

| Modelo | Input /1M tokens | Output /1M tokens | Output máx | Tiene Vision |
|--------|-----------------|-------------------|-----------|-------------|
| `gemini-3.5-flash` | $1.50 USD | $9.00 USD | **65,536** tokens | ✅ |
| `gemini-2.5-pro` | $1.25–$2.50 USD | $10.00–$15.00 USD | desconocido | ✅ |
| `deepseek-v4-flash` | $0.14 USD | **$0.28 USD** | **384,000** tokens | ❌ |
| `deepseek-v4-pro` | $0.435 USD | $0.87 USD | **384,000** tokens | ❌ |
| `gpt-5.4-mini` | $0.75 USD | $4.50 USD | **128,000** tokens | ✅ |
| `gpt-5.4` | $2.50 USD | $15.00 USD | 128,000 tokens | ✅ |
| `gpt-5.5` | $5.00 USD | $30.00 USD | 128,000 tokens | ✅ |

**NOTA CRÍTICA DEEPSEEK:** El límite de 8192 tokens que vimos en los logs NO es límite del modelo.
Es el `max_tokens: 8192` hardcodeado en nuestro código. El modelo soporta hasta 384K.
Además: `deepseek-chat` = `deepseek-v4-flash` (se depreca el 2026-07-24 — ya usamos el nombre correcto).

### Costo estimado por análisis de perfil en Praxia

Un análisis típico usa ~22K tokens de entrada y ~10K de salida:

| Estrategia | Costo por análisis | En COP (~4200 COP/USD) |
|-----------|-------------------|----------------------|
| Solo Gemini 3.5 Flash | **~$0.12 USD** | ~$504 COP |
| Solo DeepSeek v4-flash | **~$0.006 USD** | ~$25 COP |
| Solo GPT-5.4-mini | **~$0.06 USD** | ~$252 COP |
| Cascada (Gemini → DS → OAI) | **~$0.05–0.15 USD** | ~$210–630 COP |

Ticket se vende a ~$10.000–$20.000 COP. Costo de IA = ~2–5% del ingreso. Muy sostenible.

---

## Modelos de IA disponibles (verificados 2026-06-10)

### Gemini (Google) — TIENEN VISION/PDF
| Model ID | Output máx | Visión/PDF | Uso |
|----------|-----------|-----------|-----|
| `gemini-3.5-flash` | 65,536 tokens | ✅ | **Principal — nuevo stable** |
| `gemini-3.1-pro` | desconocido | ✅ | Preview — no usar en prod |
| `gemini-2.5-pro` | desconocido | ✅ | Backup complejo |
| `gemini-2.5-flash` | desconocido | ✅ | Código actual — desactualizado |

**CAMBIO PENDIENTE:** Actualizar `gemini-2.5-flash` → `gemini-3.5-flash` en todo el código.

### DeepSeek — SIN VISION
| Model ID | Output máx | Visión | Uso |
|----------|-----------|--------|-----|
| `deepseek-v4-flash` | **384,000 tokens** | ❌ | Análisis texto — muy rápido |
| `deepseek-v4-pro` | desconocido | ❌ | Análisis complejo |

**IMPORTANTE:** DeepSeek NO puede leer PDFs ni imágenes.
El bug de 8192 tokens truncados era por `max_tokens: 8192` hardcodeado en el código —
NO es límite del modelo. Quitando ese límite, DeepSeek puede generar hasta 384K tokens.

### OpenAI — TIENEN VISION
| Model ID | Output máx | Visión/PDF | Uso |
|----------|-----------|-----------|-----|
| `gpt-5.5` | 128,000 tokens | ✅ | Solo casos extremos (caro) |
| `gpt-5.4` | 128,000 tokens | ✅ | Backup confiable |
| `gpt-5.4-mini` | 128,000 tokens | ✅ | **Backup primario — precio/calidad** |
| `gpt-5.4-nano` | desconocido | ✅ | Ultra barato si necesario |

**Para PDF con OpenAI:** Convertir páginas a imágenes base64 con `pdf2pic` + `sharp`.

---

## Arquitectura propuesta: Orquestador con QC por etapas

```
┌─────────────────────────────────────────────────────────┐
│                    SUPERVISOR                           │
│  Coordina etapas, mantiene contexto, valida calidad    │
└─────────────────────────────────────────────────────────┘
           │
    ┌──────▼──────┐
    │  ETAPA 1    │  Extracción PDF — VISION OBLIGATORIA
    │  QC: chars  │  Primario: gemini-3.5-flash
    └──────┬──────┘  Fallback: gpt-5.4-mini (con pdf2pic)
           │ ✓ texto ≥ 300 chars y parece una HV
    ┌──────▼──────┐
    │  ETAPA 2    │  Extracción de perfil JSON (pass2a)
    │  QC: JSON   │  Primario: gemini-3.5-flash
    └──────┬──────┘  Fallback 1: deepseek-v4-flash
           │         Fallback 2: gpt-5.4-mini
           │ ✓ tiene profesion_principal, experiencia
    ┌──────▼──────┐
    │  ETAPA 3    │  Scoring determinista (sin IA) ✓ ya funciona
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  ETAPA 4    │  Generación de rutas (pass2b)
    │  QC: 4 rut  │  Primario: gemini-3.5-flash
    └──────┬──────┘  Fallback 1: deepseek-v4-flash (sin max_tokens limit)
           │         Fallback 2: gpt-5.4-mini
           │ ✓ 4 rutas completas — si faltan, fill-in call
    ┌──────▼──────┐
    │  ETAPA 5    │  Ensamblado final + metadata de calidad
    └─────────────┘
```

### Lógica de cascada para cada etapa

```js
// Ejemplo conceptual del orquestador
async function orchestrate(stage, payload, cascade) {
  for (const model of cascade) {
    try {
      const result = await callModel(model, payload, { timeout: model.timeout })
      const qc = validateStage(stage, result)
      if (qc.passed) {
        recordModelHealth(model.id, 'success')
        return { result, model: model.id, qc }
      }
      console.warn(`[QC] ${stage} - ${model.id} pasó pero calidad baja: ${qc.reason}`)
    } catch (e) {
      recordModelHealth(model.id, e.status || 'error')
      console.warn(`[Cascade] ${stage} - ${model.id} falló: ${e.message}`)
    }
  }
  throw new Error(`Todos los modelos fallaron en ${stage}`)
}
```

---

## Cascadas por etapa

### Etapa 1 — Extracción PDF (solo modelos con Vision)
```
1. gemini-3.5-flash  (timeout: 90s)
2. gpt-5.4-mini      (timeout: 90s, requiere pdf2pic para convertir páginas)
```
Paralelismo: pdf-parse corre siempre en paralelo como supplemento de texto plano.
Si Gemini Vision da ≥300 chars → usar Gemini. Si no → combinar con pdf-parse si dio texto.

### Etapa 2 — Perfil JSON (texto, sin vision)
```
1. gemini-3.5-flash  (timeout: 100s)
2. deepseek-v4-flash (timeout: 120s, sin max_tokens hardcodeado)
3. gpt-5.4-mini      (timeout: 90s)
```

### Etapa 4 — Rutas estratégicas (texto, sin vision)
```
1. gemini-3.5-flash  (timeout: 120s, output hasta 65K)
2. deepseek-v4-flash (timeout: 180s, output hasta 384K — quitar límite 8192)
3. gpt-5.4-mini      (timeout: 120s, output hasta 128K)
```
QC: si llegan < 4 rutas → fill-in call con contexto de las ya generadas.

---

## Sistema de health check dinámico

Caché en memoria (5 min TTL) que registra:
- Último resultado de cada modelo (success / 503 / timeout)
- Tasa de fallo en últimos N requests
- Si modelo tiene >2 fallos recientes → saltarlo y ir al siguiente en cascada

No hace pre-flight requests. Aprende de cada llamada real.

---

## Sistema de reporte de errores

### Frontend
- Botón "Reportar problema" en:
  - Pantalla de análisis (cuando hay error)
  - Resultado del análisis (si el resultado parece incompleto)
- Captura: userId, convId, fileName, fileSize, analisisId, errorMsg,
           modelo usado, etapa donde falló, timestamp, userAgent

### Backend
- `POST /api/reportes/error` → guarda en Supabase
- Tabla `error_reports`: id, user_id, tipo, datos_json, created_at, resuelto

### Admin
- Nueva sección en panel admin: "Reportes de error"
- Lista con: usuario, tipo error, fecha, estado (nuevo/revisado/resuelto)
- Click para ver detalles completos del error

---

## Lista de cambios de código requeridos

### Cambios de librería
- [ ] Instalar `pdf2pic` + `sharp` (para convertir PDF a imágenes para OpenAI Vision)
- [ ] Verificar si `@google/generative-ai` ya soporta `gemini-3.5-flash` (probablemente sí)
- [ ] Verificar que `openai` npm package está instalado y tiene OPENAI_API_KEY en Railway

### ia.controller.js
- [ ] Actualizar todos los modelos Gemini de `gemini-2.5-flash` a `gemini-3.5-flash`
- [ ] Quitar `max_tokens: 8192` hardcodeado en llamadas DeepSeek (o subir a 32768+)
- [ ] Reescribir `extractCvText()` → nuevo `extractCvTextResilient()` con cascada Gemini→OpenAI
- [ ] Agregar QC gate post-extracción (validar chars mínimos y estructura HV)
- [ ] Reescribir `analizarPerfilCV()` → usar orquestador con QC por etapa
- [ ] Agregar fill-in call cuando rutas < 4
- [ ] Agregar `geminiTexto()` timeout (bug conocido)
- [ ] Agregar `recordModelHealth()` / cache de salud de modelos
- [ ] Agregar endpoint `POST /api/reportes/error`

### Frontend AnalisisPerfil.jsx
- [ ] Agregar botón "Reportar problema" en pantalla de error
- [ ] Agregar botón "Algo está mal en mi resultado" en pantalla de resultados
- [ ] Modal de reporte: captura comentario del usuario + datos automáticos
- [ ] Validar ticketBalance > 0 antes de abrir modal de confirmación (bug #4)

### Admin panel
- [ ] Nueva página AdminReportes.jsx
- [ ] Ruta en admin router
- [ ] Tabla Supabase `error_reports` (SQL pendiente)

### CLAUDE.md
- [ ] Actualizar sección de modelos con info real de 2026

---

## SQL pendiente (ejecutar en Supabase)

```sql
-- Tabla para reportes de error de usuarios
CREATE TABLE IF NOT EXISTS error_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  tipo text NOT NULL,               -- 'extraccion_pdf' | 'analisis' | 'resultado' | 'otro'
  datos jsonb NOT NULL DEFAULT '{}', -- contexto completo del error
  comentario_usuario text,
  resuelto boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Índice para admin
CREATE INDEX IF NOT EXISTS error_reports_created_at_idx ON error_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS error_reports_resuelto_idx ON error_reports(resuelto);

-- RLS: solo el owner y admins pueden ver
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can insert own" ON error_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins can read all" ON error_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
);
```

---

## Orden de implementación (por impacto)

1. **Quitar `max_tokens: 8192`** — 1 línea, máximo impacto inmediato (fix truncación)
2. **Actualizar modelos Gemini → 3.5-flash** — varias líneas, mejora calidad y estabilidad
3. **`extractCvTextResilient()`** — núcleo del sistema todo-terreno
4. **QC gate post-extracción** — bloquea análisis con PDF vacío
5. **Orquestador con cascada para pass2a y pass2b** — completa el sistema
6. **Fill-in call rutas** — asegura 4 rutas siempre
7. **Sistema de reporte de errores** — frontend + backend + admin
8. **Health cache de modelos** — optimización final

---

## Estado actual de implementación

| Paso | Estado | Notas |
|------|--------|-------|
| Análisis completo | ✅ Hecho | Este documento |
| Modelos verificados | ✅ Hecho | Ver tabla arriba |
| SQL creado | ⏳ Pendiente | Ver sección SQL |
| Código: quitar max_tokens | ⏳ Pendiente | |
| Código: modelos actualizados | ⏳ Pendiente | |
| Código: extractCvTextResilient | ⏳ Pendiente | |
| Código: QC gate | ⏳ Pendiente | |
| Código: orquestador cascada | ⏳ Pendiente | |
| Código: fill-in rutas | ⏳ Pendiente | |
| Código: reporte de errores | ⏳ Pendiente | |
| Código: admin panel errores | ⏳ Pendiente | |
