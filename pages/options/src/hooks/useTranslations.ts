import * as React from 'react';

// Импортируем переводы
import enTranslations from '../locales/en.json';
import ruTranslations from '../locales/ru.json';

const translations = {
  en: enTranslations,
  ru: ruTranslations,
};

export type Locale = 'en' | 'ru';

export const useTranslations = (locale: Locale = 'en') => {
  const t = React.useMemo(() => {
    const dict: any = translations[locale] || {};

    // Функция для получения значения по пути с точками
    const getNestedValue = (obj: any, path: string): string => {
      return path.split('.').reduce((current, key) => {
        return current && current[key] ? current[key] : undefined;
      }, obj);
    };

    return (key: string) => {
      const value = getNestedValue(dict, key);
      return value !== undefined ? value : key;
    };
  }, [locale, translations]);

  return { t, locale };
};
