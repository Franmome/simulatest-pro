# SimulaTest Pro 🎓

Plataforma de simulacros y evaluaciones académicas con modelo de suscripción.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth + Google OAuth |
| Pagos | Stripe |

---

## 🚀 Cómo correr el proyecto localmente

### 1. Requisitos previos
- Node.js v18 o superior → https://nodejs.org
- Git → https://git-scm.com

### 2. Instalar y correr el Frontend

```bash
cd frontend
npm install
npm run dev
```
Abre http://localhost:5173 en tu navegador.

### 3. Instalar y correr el Backend

```bash
cd backend
npm install
npm run dev
```
El servidor corre en http://localhost:3000

### 4. Variables de entorno

**frontend/.env**
```
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_API_URL=http://localhost:3000
```

**backend/.env**
```
PORT=3000
SUPABASE_URL=tu_url_de_supabase
SUPABASE_SERVICE_KEY=tu_service_key
JWT_SECRET=un_secreto_muy_largo_y_seguro
STRIPE_SECRET_KEY=tu_stripe_secret_key
```

---

## 📁 Estructura del proyecto

```
simulatest-pro/
├── frontend/
│   ├── src/
│   │   ├── components/     ← Componentes reutilizables (Sidebar, Header...)
│   │   ├── pages/          ← Pantallas (Login, Dashboard, Simulacro...)
│   │   ├── styles/         ← CSS global y variables de diseño
│   │   ├── hooks/          ← Custom hooks de React
│   │   ├── context/        ← Estado global (AuthContext, AppContext)
│   │   └── utils/          ← Funciones utilitarias
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── routes/         ← Rutas de la API
│   │   ├── controllers/    ← Lógica de negocio
│   │   ├── models/         ← Clases POO (Usuario, Evaluacion, Paquete...)
│   │   ├── middleware/     ← Auth, validación, errores
│   │   └── config/         ← Conexión Supabase, Stripe
│   └── package.json
│
└── README.md
```

---

## 🔧 Cambiar el nombre de la app

En `frontend/src/utils/app.config.js` cambia una sola línea:

```js
export const APP_NAME = "SimulaTest Pro"; // ← Cambia aquí
```

Y aparece en toda la plataforma automáticamente.

---

## 📌 Pantallas implementadas

- [x] Login
- [x] Registro
- [x] Dashboard
- [x] Catálogo de simulacros
- [x] Detalle de prueba
- [x] Simulacro (con timer y mapa de preguntas)
- [x] Calculando resultados
- [x] Resultado final
- [x] Suscripciones / Planes
- [x] Perfil y progreso

## 📌 Próximos pasos

- [ ] Conectar Supabase (auth real)
- [ ] Panel Admin (subir evaluaciones y paquetes)
- [ ] Integrar Stripe
- [ ] IA para retroalimentación personalizada
