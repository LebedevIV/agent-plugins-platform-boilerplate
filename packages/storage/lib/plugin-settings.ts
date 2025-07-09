import { createStorage } from './base/base.js';
import { StorageEnum } from './base/enums.js';

export interface PluginSettings {
  enabled: boolean;
  autorun: boolean;
  [key: string]: unknown;
}

export interface PluginSettingsState {
  [pluginId: string]: PluginSettings;
}

// Функция для получения настроек плагина по ID
export const getPluginSettingsByIdFallback = (pluginId: string, settings: PluginSettingsState): PluginSettings =>
  settings[pluginId] ?? {
    enabled: true, // По умолчанию плагин включен
    autorun: false, // По умолчанию автоматический запуск выключен
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
export const getPluginSettings = async (pluginId: string): Promise<PluginSettings> => {
  const currentSettings = await pluginSettingsStorage.get();
  return getPluginSettingsByIdFallback(pluginId, currentSettings);
};

// Функция для сброса настроек плагина к значениям по умолчанию
export const resetPluginSettings = async (pluginId: string): Promise<void> => {
  const currentSettings = await pluginSettingsStorage.get();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [pluginId]: removed, ...restSettings } = currentSettings;

  await pluginSettingsStorage.set(restSettings);
};
