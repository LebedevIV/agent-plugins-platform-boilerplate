import type React from 'react';
import OptionsPluginDetails from '../../../options/src/components/PluginDetails';
import type { PluginSettings } from '@extension/storage';

interface PluginDetailsProps {
  plugin: Plugin;
  onUpdateSetting?: (pluginId: string, setting: string, value: boolean) => Promise<void>;
}

type Plugin = {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  iconUrl?: string;
  manifest?: Record<string, unknown>;
  host_permissions?: string[];
  settings?: {
    enabled?: boolean;
    autorun?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export const PluginDetails: React.FC<PluginDetailsProps> = ({ plugin, onUpdateSetting }) => {
  // Адаптируем onUpdateSetting для совместимости с OptionsPluginDetails
  const adaptedOnUpdateSetting = onUpdateSetting ? async (pluginId: string, setting: keyof PluginSettings, value: boolean): Promise<boolean> => {
    try {
      await onUpdateSetting(pluginId, setting as string, value);
      return true; // Успешно
    } catch (error) {
      console.error(`Failed to update setting ${setting}:`, error);
      return false; // Неудача
    }
  } : undefined;

  const adaptedProps = {
    selectedPlugin: {
      ...plugin,
      description: plugin.description || 'Описание не указано',
      icon: plugin.icon || '',
      manifest: plugin.manifest || {} as any
    },
    locale: 'ru' as const,
    onUpdateSetting: adaptedOnUpdateSetting
  };

  return <OptionsPluginDetails {...adaptedProps} />;
};
