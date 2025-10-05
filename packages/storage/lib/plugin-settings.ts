import { createStorage } from './base/base.js';
import { StorageEnum } from './base/enums.js';

export interface PluginSettings {
  enabled: boolean;
  autorun: boolean;
  htmlTransmissionMode?: 'chunks' | 'direct'; // Режим передачи HTML: чанками или напрямую
  response_language?: string; // Язык ответов AI
  enable_deep_analysis?: boolean; // Включить глубокий анализ
  auto_request_deep_analysis?: boolean; // Автоматически запрашивать глубокий анализ
  [key: string]: unknown;
}

export interface PluginSettingsState {
  [pluginId: string]: PluginSettings;
}

// Функция для получения настроек плагина по ID с поддержкой пользовательских настроек
export const getPluginSettingsByIdFallback = (
  pluginId: string,
  settings: PluginSettingsState,
  manifestDefaults?: Partial<PluginSettings>
): PluginSettings => {
  const defaultSettings: PluginSettings = {
    enabled: true, // По умолчанию плагин включен
    autorun: false, // По умолчанию автоматический запуск выключен
    htmlTransmissionMode: 'direct', // По умолчанию прямая передача HTML
    response_language: 'ru', // По умолчанию русский язык
    enable_deep_analysis: true, // По умолчанию глубокий анализ включен
    auto_request_deep_analysis: true, // По умолчанию авто-запрос глубокого анализа
    ...manifestDefaults, // Переопределяем дефолтными значениями из manifest.json
  };

  return settings[pluginId] ?? defaultSettings;
};

// Создаем хранилище для настроек плагинов
export const pluginSettingsStorage = createStorage<PluginSettingsState>(
  'plugin_settings',
  {},
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: false, // Отключаем liveUpdate чтобы избежать бесконечных циклов
  },
);

// Функция для обновления настроек плагина
export const updatePluginSettings = async (pluginId: string, settings: Partial<PluginSettings>): Promise<void> => {
  const currentSettings = await pluginSettingsStorage.get();
  const pluginSettings = getPluginSettingsByIdFallback(pluginId, currentSettings);

  await pluginSettingsStorage.set({
    ...currentSettings,
    [pluginId]: {
      ...pluginSettings,
      ...settings,
    },
  });
};

// Функция для получения настроек плагина
export const getPluginSettings = async (
  pluginId: string,
  manifestDefaults?: Partial<PluginSettings>,
  customSettingsKeys?: string[]
): Promise<PluginSettings> => {
  const storageKeys = [pluginId];
  const storedValues = await pluginSettingsStorage.get();

  console.log(`[DEBUG] storageKeys:`, storageKeys);
  console.log(`[DEBUG] storedValues:`, storedValues);
  console.log(`[DEBUG] manifest options:`, manifestDefaults);
  console.log(`[DEBUG] custom settings keys:`, customSettingsKeys);

  // Читаем пользовательские настройки из chrome.storage.local
  let customSettings: Record<string, boolean | string> = {};
  if (customSettingsKeys && customSettingsKeys.length > 0 && typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const customKeys = customSettingsKeys.map(key => `${pluginId}_${key}`);
      const customStored = await chrome.storage.local.get(customKeys);
      console.log(`[DEBUG] custom settings from local storage:`, customStored);

      // Преобразуем ключи обратно
      Object.entries(customStored).forEach(([key, value]) => {
        const settingName = key.replace(`${pluginId}_`, '');
        if (value !== undefined) {
          customSettings[settingName] = value;
        }
      });

      console.log(`[DEBUG] processed custom settings:`, customSettings);
    } catch (error) {
      console.warn('Failed to load custom settings from chrome.storage.local:', error);
    }
  }

  // Объединяем все настройки: manifest defaults + custom settings + stored values
  const finalDefaults = {
    ...manifestDefaults,
    ...customSettings
  };

  const settings = getPluginSettingsByIdFallback(pluginId, storedValues, finalDefaults);

  console.log(`[DEBUG] final settings:`, settings);

  return settings;
};

// Функция для сброса настроек плагина к значениям по умолчанию
export const resetPluginSettings = async (pluginId: string): Promise<void> => {
  const currentSettings = await pluginSettingsStorage.get();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [pluginId]: removed, ...restSettings } = currentSettings;

  await pluginSettingsStorage.set(restSettings);
};
