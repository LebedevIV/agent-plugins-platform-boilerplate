import { useMemo } from 'react';

// Импортируем переводы
import enTranslations from '../locales/en.json';
import ruTranslations from '../locales/ru.json';

const translations = {
  en: enTranslations,
  ru: ruTranslations
};

export type Locale = 'en' | 'ru';

export const useTranslations = (locale: Locale = 'en') => {
  const t = useMemo(() => {
    const currentTranslations = translations[locale] || translations.en;
    
    return (key: string, params?: Record<string, string | number>) => {
      const keys = key.split('.');
      let value: any = currentTranslations;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          // Fallback to English if translation not found
          value = keys.reduce((obj, k) => obj?.[k], translations.en);
          break;
        }
      }
      
      if (typeof value === 'string') {
        // Replace parameters
        if (params) {
          return Object.entries(params).reduce((str, [key, val]) => {
            return str.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
          }, value);
        }
        return value;
      }
      
      return key; // Return key if translation not found
    };
  }, [locale]);

  return { t, locale };
}; 