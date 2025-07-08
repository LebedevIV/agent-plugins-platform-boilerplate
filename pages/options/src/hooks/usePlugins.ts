import { useState, useEffect, useCallback } from 'react';
import { useStorage } from '@extension/shared';
import { pluginSettingsStorage, PluginSettings, updatePluginSettings } from '@extension/storage';

interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  manifest: PluginManifest;
  settings?: PluginSettings;
}

interface PluginManifest {
  author: string;
  last_updated: string;
  permissions?: string[];
  host_permissions?: string[];
  [key: string]: any;
}

// Инициализация заглушечных данных
const mockPlugins = [
  {
    id: 'google-helper',
    name: 'Google Helper',
    version: '1.0.0',
    description: 'Помощник для поисковых запросов в Google',
    icon: 'icon.svg',
    manifest: { 
      author: 'APP Team', 
      last_updated: '2023-04-01',
      permissions: ['storage', 'tabs'],
      host_permissions: ['*://*.google.com/*', '*://*.gmail.com/*']
    }
  },
  {
    id: 'ozon-analyzer',
    name: 'Ozon Analyzer',
    version: '1.1.0',
    description: 'Анализ товаров и цен на Ozon',
    icon: 'icon.svg',
    manifest: { 
      author: 'APP Team', 
      last_updated: '2023-05-15',
      permissions: ['storage', 'tabs', 'webRequest'],
      host_permissions: ['*://*.ozon.ru/*']
    }
  },
  {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '0.5.0',
    description: 'Тестовый плагин для отладки',
    icon: 'icon.svg',
    manifest: { 
      author: 'APP Developer', 
      last_updated: '2023-03-20',
      permissions: ['storage'],
      host_permissions: ['*://localhost/*', '*://127.0.0.1/*']
    }
  },
  {
    id: 'time-test',
    name: 'Time Test',
    version: '0.2.0',
    description: 'Плагин для работы с временными метками',
    icon: 'icon.svg',
    manifest: { 
      author: 'APP Developer', 
      last_updated: '2023-02-10',
      permissions: ['alarms'],
      host_permissions: ['*://time.is/*']
    }
  }
];

const usePlugins = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Получаем настройки плагинов из хранилища
  const pluginSettings = useStorage(pluginSettingsStorage);

  // Объединяем данные плагинов с их настройками
  const processPluginsWithSettings = useCallback((rawPlugins: Plugin[]) => {
    return rawPlugins.map(plugin => {
      const settings = pluginSettings[plugin.id] || { 
        enabled: true, 
        autorun: false 
      };
      
      return {
        ...plugin,
        settings
      };
    });
  }, [pluginSettings]);

  useEffect(() => {
    const fetchPlugins = async () => {
      try {
        setLoading(true);
        
        try {
          console.log('Fetching plugins from background script...');
        const response = await chrome.runtime.sendMessage({ type: 'GET_PLUGINS' });
          console.log('Response from background:', response);
          
        if (response && Array.isArray(response)) {
            console.log('Setting plugins from response:', response);
            const processedPlugins = processPluginsWithSettings(response);
            setPlugins(processedPlugins);
          } else {
            console.log('Using mock plugins data');
            const processedPlugins = processPluginsWithSettings(mockPlugins);
            setPlugins(processedPlugins);
          }
        } catch (e) {
          console.warn('Error fetching plugins from background, using mock data:', e);
          const processedPlugins = processPluginsWithSettings(mockPlugins);
          setPlugins(processedPlugins);
        }
        
        setLoading(false);
      } catch (e) {
        console.error('[usePlugins] Failed to fetch plugins:', e);
        setError((e as Error).message);
        setPlugins([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlugins();
  }, [processPluginsWithSettings]);

  // Обновляем выбранный плагин при изменении настроек
  useEffect(() => {
    if (selectedPlugin && pluginSettings) {
      const updatedPlugin = {
        ...selectedPlugin,
        settings: pluginSettings[selectedPlugin.id] || { 
          enabled: true, 
          autorun: false 
        }
      };
      setSelectedPlugin(updatedPlugin);
    }
  }, [pluginSettings, selectedPlugin]);

  const selectPlugin = useCallback((plugin: Plugin) => {
    console.log('[usePlugins] Selecting plugin:', plugin);
    setSelectedPlugin(plugin);
  }, []);

  // Функция для обновления настроек плагина
  const updatePluginSetting = useCallback(async (
    pluginId: string, 
    setting: keyof PluginSettings, 
    value: boolean
  ) => {
    try {
      // Отправляем сообщение в background script для обновления настроек
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_PLUGIN_SETTING',
        pluginId,
        setting,
        value
      });
      
      if (response?.error) {
        throw new Error(response.error);
      }
      
      // После успешного обновления в background, обновляем локальный state
      await updatePluginSettings(pluginId, { [setting]: value });
      
      console.log(`[usePlugins] Updated plugin setting for ${pluginId}:`, setting, '=', value);
      return true;
    } catch (error) {
      console.error(`[usePlugins] Failed to update plugin setting for ${pluginId}:`, error);
      throw error;
    }
  }, []);

  return { 
    plugins, 
    selectedPlugin, 
    loading, 
    error, 
    selectPlugin, 
    updatePluginSetting 
  };
};

// Экспорты в конце файла
export { usePlugins };
export type { Plugin }; 