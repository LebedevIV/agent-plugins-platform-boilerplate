import * as React from 'react';
import { APIKeyManager } from '../utils/encryption';

export interface PluginSettings {
  basic_analysis: {
    ru: {
      llm: string;
      custom_prompt: string;
    };
    en: {
      llm: string;
      custom_prompt: string;
    };
  };
  deep_analysis: {
    ru: {
      llm: string;
      custom_prompt: string;
    };
    en: {
      llm: string;
      custom_prompt: string;
    };
  };
  api_keys: {
    default: string; // encrypted
  };
}

export interface PluginPromptSettings {
  llm: string;
  custom_prompt: string;
}

const STORAGE_KEY = 'plugin-ozon-analyzer-settings';

const DEFAULT_SETTINGS: PluginSettings = {
  basic_analysis: {
    ru: {
      llm: '',
      custom_prompt: 'Проведи базовый анализ товара на Ozon. Опиши основные характеристики, преимущества и недостатки.',
    },
    en: {
      llm: '',
      custom_prompt: 'Perform basic analysis of the product on Ozon. Describe main characteristics, advantages and disadvantages.',
    },
  },
  deep_analysis: {
    ru: {
      llm: '',
      custom_prompt: 'Проведи глубокий анализ товара на Ozon. Включи детальное описание, сравнение с конкурентами, анализ отзывов и рекомендации по улучшению.',
    },
    en: {
      llm: '',
      custom_prompt: 'Perform deep analysis of the product on Ozon. Include detailed description, competitor comparison, review analysis and improvement recommendations.',
    },
  },
  api_keys: {
    default: '',
  },
};

export const usePluginSettings = () => {
  const [settings, setSettings] = React.useState<PluginSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      const storedSettings = result[STORAGE_KEY];

      if (storedSettings) {
        // Расшифровываем API ключи
        const decryptedApiKeys = { ...storedSettings.api_keys };
        if (storedSettings.api_keys?.default) {
          decryptedApiKeys.default = await APIKeyManager.getDecryptedKey('ozon-analyzer-default') || '';
        }

        setSettings({
          ...DEFAULT_SETTINGS,
          ...storedSettings,
          basic_analysis: {
            ru: {
              ...DEFAULT_SETTINGS.basic_analysis.ru,
              ...storedSettings.basic_analysis?.ru,
            },
            en: {
              ...DEFAULT_SETTINGS.basic_analysis.en,
              ...storedSettings.basic_analysis?.en,
            },
          },
          deep_analysis: {
            ru: {
              ...DEFAULT_SETTINGS.deep_analysis.ru,
              ...storedSettings.deep_analysis?.ru,
            },
            en: {
              ...DEFAULT_SETTINGS.deep_analysis.en,
              ...storedSettings.deep_analysis?.en,
            },
          },
          api_keys: decryptedApiKeys,
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error('Failed to load plugin settings:', error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: PluginSettings) => {
    try {
      // Шифруем API ключи перед сохранением
      const settingsToSave = { ...newSettings };
      if (newSettings.api_keys?.default) {
        await APIKeyManager.saveEncryptedKey('ozon-analyzer-default', newSettings.api_keys.default);
      } else {
        await APIKeyManager.removeKey('ozon-analyzer-default');
      }

      // Убираем API ключи из объекта настроек, которые сохраняются в plain JSON
      settingsToSave.api_keys = { default: '' };

      await chrome.storage.local.set({ [STORAGE_KEY]: settingsToSave });
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save plugin settings:', error);
      throw error;
    }
  };

  const updateBasicAnalysisSettings = async (
    language: 'ru' | 'en',
    settings: PluginPromptSettings
  ) => {
    const newSettings = {
      ...settings,
      basic_analysis: {
        ...settings.basic_analysis,
        [language]: settings,
      },
    };
    await saveSettings(newSettings);
  };

  const updateDeepAnalysisSettings = async (
    language: 'ru' | 'en',
    settings: PluginPromptSettings
  ) => {
    const newSettings = {
      ...settings,
      deep_analysis: {
        ...settings.deep_analysis,
        [language]: settings,
      },
    };
    await saveSettings(newSettings);
  };

  const updateAPIKey = async (key: string) => {
    const newSettings = {
      ...settings,
      api_keys: {
        default: key,
      },
    };
    await saveSettings(newSettings);
  };

  const getBasicAnalysisSettings = (language: 'ru' | 'en'): PluginPromptSettings => {
    return settings.basic_analysis[language];
  };

  const getDeepAnalysisSettings = (language: 'ru' | 'en'): PluginPromptSettings => {
    return settings.deep_analysis[language];
  };

  const getAPIKey = (): string => {
    return settings.api_keys?.default || '';
  };

  const resetToDefaults = async () => {
    await saveSettings(DEFAULT_SETTINGS);
  };

  return {
    settings,
    isLoading,
    updateBasicAnalysisSettings,
    updateDeepAnalysisSettings,
    updateAPIKey,
    getBasicAnalysisSettings,
    getDeepAnalysisSettings,
    getAPIKey,
    resetToDefaults,
    saveSettings,
    loadSettings,
  };
};