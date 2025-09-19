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

// Heartbeat состояние
interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'connecting';
  lastHeartbeat: number;
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

    // Heartbeat состояние
    const [connectionStatus, setConnectionStatus] = React.useState<ConnectionStatus>({
      status: 'connecting',
      lastHeartbeat: 0
    });

    // Реф для отслеживания активного порта и предотвращения дублирования
    const activePortRef = React.useRef<chrome.runtime.Port | null>(null);
    const isLoadingRef = React.useRef<boolean>(false);
    const heartbeatIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

    // Состояние готовности порта и очередь сообщений
    const portReadyRef = React.useRef<boolean>(false);
    const messageQueueRef = React.useRef<any[]>([]);

    // Функция heartbeat с retry логикой, использующая порт если доступен
    const pingWithRetry = async (retries = 3, delay = 1000): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          // Если порт готов, используем его для heartbeat
          if (isPortReady()) {
            await sendMessageViaPort({ type: 'PING' });
            setConnectionStatus({ status: 'connected', lastHeartbeat: Date.now() });
            return true;
          } else {
            // Fallback на chrome.runtime.sendMessage
            const response = await chrome.runtime.sendMessage({ type: 'PING' });
            if (chrome.runtime.lastError) {
              throw new Error(chrome.runtime.lastError.message);
            }
            if (response?.pong) {
              setConnectionStatus({ status: 'connected', lastHeartbeat: Date.now() });
              return true;
            }
          }
        } catch (error) {
          console.warn(`[usePlugins] Heartbeat attempt ${i + 1} failed:`, error);
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          }
        }
      }
      setConnectionStatus({ status: 'disconnected', lastHeartbeat: Date.now() });
      return false;
    };

    // Запуск heartbeat механизма
    const startHeartbeat = React.useCallback(() => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      heartbeatIntervalRef.current = setInterval(async () => {
        await pingWithRetry();
      }, 10000); // Проверка каждые 10 секунд
    }, [pingWithRetry]);

    // Остановка heartbeat
    const stopHeartbeat = React.useCallback(() => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }, []);

    // Функция проверки готовности порта
    const isPortReady = React.useCallback((): boolean => {
      return portReadyRef.current && activePortRef.current !== null;
    }, []);

    // Функция отправки сообщений через порт с retry логикой
    const sendMessageViaPort = React.useCallback(async (message: any, retries = 3): Promise<void> => {
      if (!isPortReady()) {
        console.log('[usePlugins] Port not ready, queuing message:', message);
        messageQueueRef.current.push(message);
        return;
      }

      for (let i = 0; i < retries; i++) {
        try {
          if (activePortRef.current) {
            activePortRef.current.postMessage(message);
            console.log('[usePlugins] Message sent via port:', message);
            return;
          } else {
            throw new Error('Port is not available');
          }
        } catch (error) {
          console.warn(`[usePlugins] Port message attempt ${i + 1} failed:`, error);
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
          }
        }
      }

      // Fallback на chrome.runtime.sendMessage
      try {
        const response = await chrome.runtime.sendMessage(message);
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
        console.log('[usePlugins] Message sent via fallback:', message, response);
      } catch (error) {
        console.error('[usePlugins] Failed to send message via fallback:', error);
        throw error;
      }
    }, [isPortReady]);

    // Функция для обработки накопленных сообщений
    const processMessageQueue = React.useCallback(() => {
      while (messageQueueRef.current.length > 0 && isPortReady()) {
        const message = messageQueueRef.current.shift();
        if (message) {
          sendMessageViaPort(message).catch(error => {
            console.error('[usePlugins] Failed to process queued message:', error);
          });
        }
      }
    }, [isPortReady, sendMessageViaPort]);

    // Функция переподключения порта
    const reconnectPort = React.useCallback(async () => {
      console.log('[usePlugins] Attempting to reconnect port...');
      try {
        if (activePortRef.current) {
          activePortRef.current.disconnect();
          activePortRef.current = null;
        }

        portReadyRef.current = false;

        const port = chrome.runtime.connect();
        activePortRef.current = port;

        console.log('[usePlugins] New port created:', port.name);

        // Порт готов сразу после создания
        portReadyRef.current = true;

        // Обработчик сообщений от порта
        const messageListener = (msg: ExtensionMessage) => {
          console.log('Received message from background via port:', msg);

          if (msg.type === 'GET_PLUGINS_RESPONSE' && msg.plugins && Array.isArray(msg.plugins)) {
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
          } else if (msg.type === 'GET_PLUGINS_RESPONSE' && msg.error) {
            console.error('Error from background script:', msg.error);
            setError(msg.error || 'Ошибка загрузки плагинов');
            setPlugins([]);
            setLoading(false);
            isLoadingRef.current = false;
          }
        };

        // Обработчик отключения порта
        const disconnectListener = () => {
          console.log('[usePlugins] Port disconnected, will attempt reconnection');
          portReadyRef.current = false;
          activePortRef.current = null;

          // Если загрузка была в процессе, показываем ошибку
          if (isLoadingRef.current) {
            setError('Соединение с background скриптом потеряно');
            setLoading(false);
            isLoadingRef.current = false;
          }

          // Переподключение через 1 секунду
          setTimeout(() => {
            reconnectPort();
          }, 1000);
        };

        port.onMessage.addListener(messageListener);
        port.onDisconnect.addListener(disconnectListener);

        // Обработка накопленных сообщений
        processMessageQueue();

      } catch (error) {
        console.error('[usePlugins] Failed to reconnect port:', error);
        setError('Не удалось переподключить порт');
      }
    }, [processMessageQueue, pluginSettings]);

    // Запуск heartbeat при монтировании
    React.useEffect(() => {
      console.debug('[usePlugins] Starting heartbeat mechanism');
      startHeartbeat();

      return () => {
        console.debug('[usePlugins] Stopping heartbeat mechanism');
        stopHeartbeat();
      };
    }, [startHeartbeat, stopHeartbeat, pingWithRetry]);

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

        // Используем port-based communication с новой логикой
        reconnectPort().then(() => {
          // Ждем готовности порта и отправляем сообщение
          const waitForPortAndSend = async () => {
            const maxWaitTime = 5000; // 5 секунд максимум ожидания
            const checkInterval = 100; // Проверяем каждые 100ms
            let waitedTime = 0;

            while (!isPortReady() && waitedTime < maxWaitTime) {
              await new Promise(resolve => setTimeout(resolve, checkInterval));
              waitedTime += checkInterval;
            }

            if (isPortReady()) {
              try {
                await sendMessageViaPort({ type: 'GET_PLUGINS' });
                console.log('Sent GET_PLUGINS message via port');
              } catch (error) {
                console.error('Failed to send GET_PLUGINS message:', error);
                setError('Не удалось отправить запрос к background скрипту');
                setLoading(false);
                isLoadingRef.current = false;
              }
            } else {
              console.error('Port not ready after waiting');
              setError('Порт не готов для отправки сообщений');
              setLoading(false);
              isLoadingRef.current = false;
            }
          };

          waitForPortAndSend();
        }).catch(error => {
          console.error('[usePlugins] Failed to establish port connection:', error);
          setError('Не удалось установить соединение с background скриптом');
          setPlugins([]);
          setLoading(false);
          isLoadingRef.current = false;
        });

        // Добавляем таймаут для ожидания ответа
        const timeoutId = setTimeout(() => {
          if (isLoadingRef.current) {
            console.error('Timeout waiting for background script response');
            setError('Превышено время ожидания ответа от background скрипта');
            setLoading(false);
            isLoadingRef.current = false;
          }
        }, 15000); // Увеличиваем таймаут до 15 секунд

        return () => {
          clearTimeout(timeoutId);
          if (activePortRef.current) {
            activePortRef.current.disconnect();
            activePortRef.current = null;
          }
          isLoadingRef.current = false;
          portReadyRef.current = false;
          messageQueueRef.current.length = 0; // Очищаем очередь
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
  }, [pluginSettings, reconnectPort, isPortReady, sendMessageViaPort]); // Добавляем зависимости от новых функций

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

  // Функция для обновления настроек плагина с retry логикой
  const updatePluginSetting = React.useCallback(
    async (pluginId: string, setting: keyof PluginSettings, value: boolean, retries = 3): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          // Отправляем сообщение в background script для обновления настроек
          const response = await chrome.runtime.sendMessage({
            type: 'UPDATE_PLUGIN_SETTING',
            pluginId,
            setting,
            value,
          });

          if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message);
          }

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
          console.warn(`[usePlugins] Update setting attempt ${i + 1} failed for ${pluginId}:`, error);
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
          }
        }
      }
      console.error(`[usePlugins] Failed to update plugin setting for ${pluginId} after all retries`);
      throw new Error(`Failed to update plugin setting after ${retries} attempts`);
    },
    [],
  );

  return {
    plugins,
    selectedPlugin,
    loading,
    error,
    connectionStatus,
    selectPlugin,
    updatePluginSetting,
  };
};

// Экспорты в конце файла
export { usePlugins };
export type { Plugin };
