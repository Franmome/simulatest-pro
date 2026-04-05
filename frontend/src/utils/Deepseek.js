// src/utils/deepseek.js
// Servicio centralizado para llamadas a DeepSeek API
// La key se lee desde .env — nunca la escribas directo en el código

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY

class DeepSeekService {
  constructor() {
    this.model      = 'deepseek-chat'
    this.maxTokens  = 1024
    this.baseSystem = `Eres un mentor académico experto en preparación para exámenes colombianos: 
ICFES Saber 11, Saber Pro, CNSC, Contraloría General de la República y Procuraduría General de la Nación.
Respondes siempre en español colombiano, de forma clara, pedagógica y motivadora.
Cuando expliques conceptos, usa ejemplos concretos y analogías simples.
Sé conciso pero completo — máximo 3 párrafos por respuesta a menos que el tema lo requiera.
Si el usuario no entiende algo, ofrece una explicación alternativa más simple.`
  }

  /**
   * Envía un mensaje y retorna la respuesta del modelo
   * @param {Array<{role: 'user'|'assistant', content: string}>} messages - historial
   * @param {string} [systemExtra] - contexto adicional al system prompt
   * @returns {Promise<string>} - texto de respuesta
   */
  async chat(messages, systemExtra = '') {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('VITE_DEEPSEEK_API_KEY no está definida en .env')
    }

    const system = systemExtra
      ? `${this.baseSystem}\n\n${systemExtra}`
      : this.baseSystem

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model:      this.model,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: system },
          ...messages,
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err?.error?.message || `Error ${response.status} de DeepSeek`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || 'Sin respuesta del modelo.'
  }

  /**
   * Shorthand para un mensaje único sin historial
   * @param {string} prompt
   * @param {string} [systemExtra]
   * @returns {Promise<string>}
   */
  async ask(prompt, systemExtra = '') {
    return this.chat([{ role: 'user', content: prompt }], systemExtra)
  }
}

// Exportamos una instancia singleton — se reutiliza en toda la app
export const deepseek = new DeepSeekService()