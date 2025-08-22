 import { useStorage } from '@extension/shared';
import { pluginSettingsStorage, updatePluginSettings } from '@extension/storage';
import * as React from 'react';
import type { PluginSettings } from '@extension/storage';

// Типы для сообщений
interface ExtensionMessage {
  type: string;
  plugins?: any[];
  error?: string;
}

interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  manifest: PluginManifest;
  settings?: {
    enabled?: boolean;
    autorun?: boolean;
    [key: string]: unknown;
  };
}

interface PluginManifest {
  author: string;
  last_updated: string;
  permissions?: string[];
  host_permissions?: string[];
  [key: string]: unknown;
}

// Убраны mock данные - теперь используем только данные из background script

const usePlugins = () => {
   const [plugins, setPlugins] = React.useState<Plugin[]>([]);
   const [selectedPlugin, setSelectedPlugin] = React.useState<Plugin | null>(null);
   const [loading, setLoading] = React.useState<boolean>(true);
   const [error, setError] = React.useState<string | null>(null);
   // Получаем настройки плагинов из хранилища
   const [pluginSettings, setPluginSettings] = React.useState<Record<string, PluginSettings>>({});

   // Реф для отслеживания активного порта и предотвращения дублирования
   const activePortRef = React.useRef<chrome.runtime.Port | null>(null);
   const isLoadingRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await pluginSettingsStorage.get();
        setPluginSettings(settings);
      } catch (error) {
        console.error('Failed to load plugin settings:', error);
        setPluginSettings({});
      }
    };
    loadSettings();

    // Подписываемся на изменения
    const unsubscribe = pluginSettingsStorage.subscribe(() => {
      loadSettings();
    });

    return unsubscribe;
  }, []);

  React.useEffect(() => {
    // Предотвращаем дублирование запросов
    if (isLoadingRef.current) {
      console.log('[usePlugins] Request already in progress, skipping...');
      return;
    }

    const fetchPlugins = () => {
      try {
        // Если уже есть активный порт, отключаем его
        if (activePortRef.current) {
          console.log('[usePlugins] Disconnecting existing port');
          activePortRef.current.disconnect();
          activePortRef.current = null;
        }

        setLoading(true);
        setError(null);
        isLoadingRef.current = true;

        console.log('Connecting to background script via port...');

        // Используем port-based communication
        const port = chrome.runtime.connect();
        activePortRef.current = port;

        console.log('Port connected:', port.name);

        const messageListener = (msg: ExtensionMessage) => {
          console.log('Received message from background via port:', msg);

          if (msg.type === 'PLUGINS_RESULT' && msg.plugins && Array.isArray(msg.plugins)) {
            console.log('Setting plugins from port message:', msg.plugins);
            // Обрабатываем плагины с настройками прямо здесь
            const processedPlugins = msg.plugins.map((plugin: any) => {
              const settings = pluginSettings[plugin.id] || {
                enabled: true,
                autorun: false,
              };
              return { ...plugin, settings };
            });
            setPlugins(processedPlugins);
            setLoading(false);
            isLoadingRef.current = false;
          } else if (msg.type === 'PLUGINS_ERROR') {
            console.error('Error from background script:', msg.error);
            setError(msg.error || 'Ошибка загрузки плагинов');
            setPlugins([]);
            setLoading(false);
            isLoadingRef.current = false;
          }
        };

        const disconnectListener = () => {
          console.log('Port disconnected');
          activePortRef.current = null;
          // Если порт был отключен до получения ответа, показываем ошибку
          if (isLoadingRef.current) {
            setError('Соединение с background скриптом потеряно');
            setLoading(false);
            isLoadingRef.current = false;
          }
        };

        port.onMessage.addListener(messageListener);
        port.onDisconnect.addListener(disconnectListener);

        // Добавляем таймаут для ожидания ответа
        const timeoutId = setTimeout(() => {
          if (isLoadingRef.current) {
            console.error('Timeout waiting for background script response');
            setError('Превышено время ожидания ответа от background скрипта');
            setLoading(false);
            isLoadingRef.current = false;
            if (activePortRef.current) {
              activePortRef.current.disconnect();
              activePortRef.current = null;
            }
          }
        }, 10000); // 10 секунд таймаут

        // Проверяем готовность порта и отправляем сообщение
        const sendMessage = () => {
          try {
            if (activePortRef.current) {
              activePortRef.current.postMessage({ type: 'GET_PLUGINS' });
              console.log('Sent GET_PLUGINS message via port');
            } else {
              throw new Error('Port is not available');
            }
          } catch (error) {
            console.error('Failed to send message via port:', error);
            setError('Не удалось отправить запрос к background скрипту');
            setLoading(false);
            isLoadingRef.current = false;
            clearTimeout(timeoutId);
            if (activePortRef.current) {
              activePortRef.current.disconnect();
              activePortRef.current = null;
            }
          }
        };

        // Небольшая задержка для инициализации порта
        setTimeout(sendMessage, 100);

        return () => {
          clearTimeout(timeoutId);
          if (activePortRef.current) {
            activePortRef.current.disconnect();
            activePortRef.current = null;
          }
          isLoadingRef.current = false;
        };
      } catch (e) {
        console.error('[usePlugins] Failed to connect to background:', e);
        setError((e as Error).message);
        setPlugins([]);
        setLoading(false);
        isLoadingRef.current = false;
        return () => {}; // Return empty cleanup function
      }
    };

    const cleanup = fetchPlugins();
    return () => {
      if (cleanup) cleanup();
    };
  }, [pluginSettings]); // Добавляем зависимость от pluginSettings

  // Обновляем выбранный плагин при изменении настроек
  React.useEffect(() => {
    if (selectedPlugin && pluginSettings) {
      const currentSettings = pluginSettings[selectedPlugin.id] || {
        enabled: true,
        autorun: false,
      };

      // Проверяем, действительно ли настройки изменились
      const settingsChanged =
        selectedPlugin.settings?.enabled !== currentSettings.enabled ||
        selectedPlugin.settings?.autorun !== currentSettings.autorun;

      if (settingsChanged) {
        const updatedPlugin = {
          ...selectedPlugin,
          settings: currentSettings,
        };
        setSelectedPlugin(updatedPlugin);
      }
    }
  }, [pluginSettings, selectedPlugin?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- Зависим только от pluginSettings и ID выбранного плагина

  const selectPlugin = React.useCallback((plugin: Plugin) => {
    console.log('[usePlugins] Selecting plugin:', plugin);
    setSelectedPlugin(plugin);
  }, []);

  // Функция для обновления настроек плагина
  const updatePluginSetting = React.useCallback(
    async (pluginId: string, setting: keyof PluginSettings, value: boolean) => {
      try {
        // Отправляем сообщение в background script для обновления настроек
        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_PLUGIN_SETTING',
          pluginId,
          setting,
          value,
        });

        if (response?.error) {
          throw new Error(response.error);
        }

        // После успешного обновления в background, обновляем локальный state
        await updatePluginSettings(pluginId, { [setting]: value });

        // Синхронизируем массив plugins мгновенно
        setPlugins(prevPlugins =>
          prevPlugins.map(plugin =>
            plugin.id === pluginId ? { ...plugin, settings: { ...plugin.settings, [setting]: value } } : plugin,
          ),
        );

        console.log(`[usePlugins] Updated plugin setting for ${pluginId}:`, setting, '=', value);
        return true;
      } catch (error) {
        console.error(`[usePlugins] Failed to update plugin setting for ${pluginId}:`, error);
        throw error;
      }
    },
    [],
  );

  return {
    plugins,
    selectedPlugin,
    loading,
    error,
    selectPlugin,
    updatePluginSetting,
  };
};

// Экспорты в конце файла
export { usePlugins };
export type { Plugin };
