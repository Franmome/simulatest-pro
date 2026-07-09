# Praxia 🎓

Plataforma colombiana de preparación para cargos del sector público (CNSC, Procuraduría, Contraloría, DIAN, Fiscalía). Combina análisis de perfil con IA, simulacros de pruebas, salas competitivas y cuaderno de estudio asistido.

> **Producción:** [simulatest-pro-production.up.railway.app](https://simulatest-pro-production.up.railway.app)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS (Material You) |
| Backend | Node.js (ESM) + Express |
| Base de datos | Supabase (PostgreSQL + Realtime) |
| Autenticación | Supabase Auth + Google OAuth |
| IA principal | Google Gemini 3.5 Flash |
| IA fallback | GPT-4o-mini → DeepSeek V3 |
| Pagos | Wompi (checkout + webhook) |
| Deploy | Railway (auto-deploy desde `main`) |

---

## Funcionalidades principales

### Análisis de Perfil CV
El usuario sube su hoja de vida (PDF/imagen) y selecciona una convocatoria. La IA extrae el perfil, corre un motor de scoring determinista contra todos los OPECs de la convocatoria y devuelve 4 rutas estratégicas con candidaturas viables.

- Extracción de texto: Gemini Vision → Files API → OpenAI Vision → pdfjs → pdf-parse
- Scoring 0-100 por OPEC: educación (25) + experiencia (25) + funciones (25) + sector (10) + vacantes (10) + ciudad (5)
- Arquitectura async: responde inmediatamente con `jobId`, resultado llega por SSE
- Sistema de tickets + pago Wompi

### Análisis de Oferta de Trabajo
El usuario sube su CV + hasta 5 ofertas (PDF/Word/imagen) o selecciona OPECs desde la BD. La IA devuelve semáforo de compatibilidad por oferta con puntos fuertes, brechas y requisitos críticos.

### Simulacros de Pruebas
- **Modo Práctica**: retroalimentación inmediata por pregunta
- **Modo Examen**: sin retroalimentación, timer total
- **Prueba Praxia (IA)**: preguntas generadas por IA según cargo y dificultad
- Banco de preguntas por paquete/evaluación

### Salas de Competencia
Multijugador en tiempo real. El anfitrión crea la sala con un código de 6 caracteres, configura preguntas y timer. Todos compiten simultáneamente. Ranking final, análisis IA de resultados y opción de revancha.

- Packs de preguntas publicados por el admin (JSON)
- O niveles de paquetes comprados por el usuario
- Chat en tiempo real en lobby y post-partida

### Cuaderno IA
Notas asistidas por IA por paquete de estudio. El usuario puede subir documentos, videos de YouTube, archivos de audio y texto manual. La IA genera resúmenes, extrae conceptos clave y responde preguntas sobre el contenido.

### Panel Admin
- CRUD de convocatorias, OPECs, paquetes, evaluaciones y preguntas
- Packs para salas de competencia (JSON upload)
- Gestión de usuarios y accesos
- Tesorería: transacciones Wompi, tickets de análisis
- Consumo de tokens IA por usuario
- Prompts maestros por convocatoria
- Reportes de usuarios
- Entrenamiento IA

---

## Arquitectura de archivos clave

```
backend/
  src/
    index.js                  ← CORS, middlewares, servidor
    controllers/
      ia.controller.js        ← Todo lo de IA (3400+ líneas)
      wompi.controller.js     ← Webhook + checkout Wompi
      evaluacion.controller.js
      paquete.controller.js
    routes/
      ia.routes.js            ← Rutas IA + multer
      wompi.routes.js         ← /api/wompi/webhook + /checkout
    utils/
      tokenTracker.js         ← Saldo tokens por compra
      contextBuilder.js       ← Contexto usuario para prompts
      promptLoader.js         ← Prompts desde BD o defaults
      allowedOrigins.js       ← CORS origins (editar solo aquí)
      modelHealthCache.js     ← Degradación automática de modelos

frontend/
  src/
    pages/
      AnalisisPerfil.jsx      ← Análisis CV (2200+ líneas)
      AnalisisOferta.jsx      ← Análisis oferta trabajo
      Salas.jsx               ← Crear / unirse a sala
      SalaLobby.jsx           ← Sala de espera + chat
      SalaSimulacro.jsx       ← Juego en tiempo real + resultados
      CuadernoIA.jsx          ← Notas asistidas por IA
      DetallePrueba.jsx       ← Paquete: práctica, examen, IA (3000+ líneas)
      Simulacro.jsx           ← Simulacro banco de preguntas
      SimulacroIA.jsx         ← Simulacro generado por IA
      admin/                  ← Panel admin (13 secciones)
    context/
      AnalysisContext.jsx     ← Estado global análisis perfil
    utils/
      generarAnalisisPDF.js   ← PDF de resultados
      supabase.js             ← Cliente Supabase frontend
```

---

## Correr el proyecto localmente

### Requisitos
- Node.js v18+
- Git

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Backend
```bash
cd backend
npm install
npm run dev
# → http://localhost:3000
```

### Variables de entorno

**`frontend/.env`**
```
VITE_SUPABASE_URL=tu_url_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_API_URL=http://localhost:3000
```

**`backend/.env`**
```
PORT=3000
SUPABASE_URL=tu_url_supabase
SUPABASE_SERVICE_KEY=tu_service_key
GEMINI_API_KEY=tu_gemini_key
OPENAI_API_KEY=tu_openai_key
DEEPSEEK_API_KEY=tu_deepseek_key
WOMPI_PUBLIC_KEY=tu_wompi_public_key
WOMPI_INTEGRITY_SECRET=tu_wompi_integrity_secret
WOMPI_EVENTS_SECRET=tu_wompi_events_secret
FRONTEND_URL=http://localhost:5173
```

---

## Deploy

Push a `main` → Railway despliega automáticamente los dos servicios (`simulatest-api` y `simulatest-pro`).

Para cambiar de dominio, editar **únicamente** `backend/src/utils/allowedOrigins.js` y las variables de entorno `FRONTEND_URL` (backend) y `VITE_API_URL` (frontend).

---

## Cascada de modelos IA

```
1. Gemini 3.5 Flash  →  hasta 3 reintentos con backoff (3s / 8s / 20s)
2. GPT-4o-mini       →  si Gemini falla o está degradado
3. DeepSeek V3       →  último recurso
```

Cada fallo se registra en `modelHealthCache` con TTL de 5 minutos. Después de 2 fallos, el modelo se marca como degradado y la cascada lo salta (pero lo intenta una vez más por si se recuperó).

---

## Tablas Supabase principales

| Tabla | Descripción |
|-------|-------------|
| `convocatorias` | Catálogo de convocatorias públicas |
| `opec_maestro` | OPECs por convocatoria |
| `user_analisis_tickets` | Tickets para análisis de perfil |
| `user_oferta_tickets` | Tickets para análisis de oferta |
| `user_profile_analysis` | Resultados de análisis de perfil |
| `user_oferta_analysis` | Resultados de análisis de oferta |
| `rooms` | Salas de competencia |
| `room_participants` | Jugadores por sala |
| `room_messages` | Chat de salas |
| `sala_packs` | Packs de preguntas para salas (JSON) |
| `evaluations` | Evaluaciones del banco de preguntas |
| `levels` | Niveles por evaluación |
| `questions` / `options` | Preguntas y opciones |
| `packages` | Paquetes comerciales |
| `purchases` | Compras de paquetes |
| `transactions` | Historial Wompi |
| `app_config` | Configuración dinámica (precios, prompts) |
| `user_cuaderno_*` | Notas, fuentes y chats del cuaderno IA |

---

## Migración pendiente

```sql
-- Salas con packs de preguntas
CREATE TABLE IF NOT EXISTS sala_packs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text DEFAULT '',
  preguntas jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS sala_pack_id uuid REFERENCES sala_packs(id);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS orden text DEFAULT 'aleatorio';
ALTER TABLE rooms ALTER COLUMN level_id DROP NOT NULL;

-- Prompt por convocatoria
ALTER TABLE convocatorias ADD COLUMN IF NOT EXISTS prompt_contexto TEXT;
ALTER TABLE convocatorias ADD COLUMN IF NOT EXISTS prompt_rutas TEXT;
```

---

## Formato JSON para packs de salas

```json
[
  {
    "texto": "¿Cuál es la norma que regula el servicio civil en Colombia?",
    "opciones": [
      { "letra": "A", "texto": "Ley 909 de 2004",     "es_correcta": true  },
      { "letra": "B", "texto": "Decreto 1083 de 2015", "es_correcta": false },
      { "letra": "C", "texto": "Ley 443 de 1998",     "es_correcta": false },
      { "letra": "D", "texto": "Ley 27 de 1992",      "es_correcta": false }
    ]
  }
]
```
