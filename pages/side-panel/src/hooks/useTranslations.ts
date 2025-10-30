import * as React from 'react';

// Импортируем переводы из options
import ruTranslations from '../../../options/src/locales/ru.json';

const translations = {
  ru: ruTranslations,
};

export type Locale = 'ru';

export const useTranslations = (locale: Locale = 'ru') => {
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