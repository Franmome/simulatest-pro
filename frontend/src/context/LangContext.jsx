import { createContext, useContext, useState } from 'react'
import { T } from '../i18n/translations'

const LangCtx = createContext({ lang: 'es', t: k => k, changeLang: () => {} })

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'es')

  // t('config.perfil.title') → string in current lang, fallback to es
  function t(key) {
    const keys = key.split('.')
    const resolve = (obj) => keys.reduce((o, k) => o?.[k], obj)
    return resolve(T[lang]) ?? resolve(T['es']) ?? key
  }

  function changeLang(l) {
    setLang(l)
    localStorage.setItem('lang', l)
    // RTL support for Arabic
    document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr')
  }

  return (
    <LangCtx.Provider value={{ lang, t, changeLang }}>
      {children}
    </LangCtx.Provider>
  )
}

export function useLang() { return useContext(LangCtx) }
