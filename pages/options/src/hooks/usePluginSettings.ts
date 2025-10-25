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

// Function to load default prompts from manifest.json
const loadDefaultPromptsFromManifest = async (): Promise<{ basic_analysis: { ru: string; en: string }; deep_analysis: { ru: string; en: string } }> => {
  try {
    // Load manifest.json from the plugin directory
    const manifestResponse = await fetch(chrome.runtime.getURL('plugins/ozon-analyzer/manifest.json'));
    const manifest = await manifestResponse.json();

    const prompts = manifest.options?.prompts;
    if (!prompts) {
      throw new Error('Prompts not found in manifest');
    }

    return {
      basic_analysis: {
        ru: prompts.basic_analysis?.ru?.default || '',
        en: prompts.basic_analysis?.en?.default || '',
      },
      deep_analysis: {
        ru: prompts.deep_analysis?.ru?.default || '',
        en: prompts.deep_analysis?.en?.default || '',
      },
    };
  } catch (error) {
    console.error('Failed to load prompts from manifest:', error);
    // Fallback to hardcoded defaults if manifest loading fails
    return {
      basic_analysis: {
        ru: 'верни слово basic_analysis_ru_default и полное название и версию твоей LLM (например, Gemini flash lite или Gemini 2.5 Pro)',
        en: 'верни слово basic_analysis_en_default и полное название и версию твоей LLM (например, Gemini flash lite или Gemini 2.5 Pro)',
      },
      deep_analysis: {
        ru: 'верни слово deep_analysis_ru_default и полное название и версию твоей LLM (например, Gemini flash lite или Gemini 2.5 Pro)',
        en: 'верни слово deep_analysis_en_default и полное название и версию твоей LLM (например, Gemini flash lite или Gemini 2.5 Pro)',
      },
    };
  }
};

const DEFAULT_SETTINGS: PluginSettings = {
  basic_analysis: {
    ru: {
      llm: '',
      custom_prompt: '',
    },
    en: {
      llm: '',
      custom_prompt: '',
    },
  },
  deep_analysis: {
    ru: {
      llm: '',
      custom_prompt: '',
    },
    en: {
      llm: '',
      custom_prompt: '',
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
    initializeSettings();
  }, []);

  const initializeSettings = async () => {
    try {
      // Load default prompts from manifest first
      const defaultPrompts = await loadDefaultPromptsFromManifest();

      // Create initial settings with manifest defaults
      const initialSettings: PluginSettings = {
        basic_analysis: {
          ru: {
            llm: '',
            custom_prompt: defaultPrompts.basic_analysis.ru,
          },
          en: {
            llm: '',
            custom_prompt: defaultPrompts.basic_analysis.en,
          },
        },
        deep_analysis: {
          ru: {
            llm: '',
            custom_prompt: defaultPrompts.deep_analysis.ru,
          },
          en: {
            llm: '',
            custom_prompt: defaultPrompts.deep_analysis.en,
          },
        },
        api_keys: {
          default: '',
        },
      };

      // Then load user settings and merge with defaults
      await loadSettings(initialSettings);
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      // Fallback to loading with empty defaults
      await loadSettings(DEFAULT_SETTINGS);
    }
  };

  const loadSettings = async (defaultSettings: PluginSettings = DEFAULT_SETTINGS) => {
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
          ...defaultSettings,
          ...storedSettings,
          basic_analysis: {
            ru: {
              ...defaultSettings.basic_analysis.ru,
              ...storedSettings.basic_analysis?.ru,
            },
            en: {
              ...defaultSettings.basic_analysis.en,
              ...storedSettings.basic_analysis?.en,
            },
          },
          deep_analysis: {
            ru: {
              ...defaultSettings.deep_analysis.ru,
              ...storedSettings.deep_analysis?.ru,
            },
            en: {
              ...defaultSettings.deep_analysis.en,
              ...storedSettings.deep_analysis?.en,
            },
          },
          api_keys: decryptedApiKeys,
        });
      } else {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Failed to load plugin settings:', error);
      setSettings(defaultSettings);
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
    newPromptSettings: PluginPromptSettings
  ) => {
    const newSettings = {
      ...settings,
      basic_analysis: {
        ...settings.basic_analysis,
        [language]: newPromptSettings,
      },
    };
    await saveSettings(newSettings);
  };

  const updateDeepAnalysisSettings = async (
    language: 'ru' | 'en',
    newPromptSettings: PluginPromptSettings
  ) => {
    const newSettings = {
      ...settings,
      deep_analysis: {
        ...settings.deep_analysis,
        [language]: newPromptSettings,
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