import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import { supabase } from './utils/supabase'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
      staleTime: 1000 * 60 * 2, // 2 minutos
    }
  }
})

// Capturar errores globales no manejados
window.addEventListener('unhandledrejection', async (event) => {
  try {
    await supabase.from('system_errors').insert({
      severity: 'critical',
      error_code: 'UNHANDLED_REJECTION',
      description: event.reason?.message || String(event.reason),
      status: 'pending'
    })
  } catch (_) {}
})

window.addEventListener('error', async (event) => {
  try {
    await supabase.from('system_errors').insert({
      severity: 'warning',
      error_code: 'JS_ERROR',
      description: event.message || 'Error desconocido',
      status: 'pending'
    })
  } catch (_) {}
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)