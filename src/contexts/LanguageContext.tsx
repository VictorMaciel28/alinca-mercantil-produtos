'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import en from '@/i18n/en.json'
import pt from '@/i18n/pt.json'

const translations = { en, pt }

type Language = 'en' | 'pt'
type TranslationKeys = keyof typeof en

interface LanguageContextProps {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKeys) => string
}

const LanguageContext = createContext<LanguageContextProps>({
  language: 'pt',
  setLanguage: () => {},
  t: (key) => key
})

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>('pt')

  useEffect(() => {
    const stored = localStorage.getItem('language') as Language
    if (stored) setLanguage(stored)
  }, [])

  const changeLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('language', lang)
  }

  const t = (key: TranslationKeys) => {
    return translations[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)