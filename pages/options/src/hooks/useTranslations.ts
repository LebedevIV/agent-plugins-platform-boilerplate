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
    const dict: Record<string, string> = translations[locale] || {};
    return (key: string) => dict[key] || key;
  }, [locale, translations]);

  return { t, locale };
};
