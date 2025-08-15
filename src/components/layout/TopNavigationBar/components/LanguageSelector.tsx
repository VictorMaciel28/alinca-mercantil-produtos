'use client'

import { useLanguage } from '@/contexts/LanguageContext'

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="relative inline-block text-left">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as 'en' | 'pt')}
        className="bg-white border border-gray-300 text-gray-700 py-2 pl-3 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
      >
        <option value="pt">PT</option>
        <option value="en">EN</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
      </div>
    </div>
  )
}


export default LanguageSelector