// === Локальные компоненты для сайдпанели (React, TypeScript) ===
import { PluginControlPanel } from './components/PluginControlPanel'; // Панель управления выбранным плагином
import { ToastNotifications } from './components/ToastNotifications'; // Всплывающие уведомления
import ThemeSwitcher from '../../options/src/components/ThemeSwitcher';
// === Общие/shared утилиты и хуки (используются во всех частях расширения) ===
import { useStorage } from '@extension/shared'; // Хук для работы с хранилищем
import { exampleThemeStorage, type Theme } from '@extension/storage'; // Пример хранилища для темы
import { cn } from '@extension/ui'; // Утилита для классов
import LocalErrorBoundary from './components/LocalErrorBoundary';
import PluginCard from './components/PluginCard';
// === React хуки ===
import { useState, useEffect, useCallback, useRef } from 'react';
// === Типы для локальных компонентов ===
import type { PanelView } from './components/PluginControlPanel'; // Тип для переключения вкладок панели управления
import './SidePanel.css';
// === Локальное определение типа Plugin (используется только в этой панели) ===
type Plugin = {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  iconUrl?: string;
  manifest?: Record<string, unknown>; // Лучше избегать any, используем Record
  host_permissions?: string[];
  settings?: {
    enabled?: boolean;
    autorun?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

// Per-tab state type
type TabPanelState = {
  showControlPanel: boolean;
  selectedPluginId: string | null;
  panelView: PanelView;
};

// Helper to get state storage key for a specific tab
const getTabStateKey = (tabId: number): string => {
  return `sidepanel_state_${tabId}`;
};

// Helper to load state from localStorage for a tab
const loadTabState = async (tabId: number): Promise<TabPanelState | null> => {
  try {
    if (tabId < 0) {
      console.warn('[SidePanel] Cannot load state for invalid tab ID:', tabId);
      return null;
    }
    const key = getTabStateKey(tabId);
    const result = await chrome.storage.local.get(key);
    const state = result[key];
    if (state) {
      console.log('[SidePanel] Loaded state for tab', tabId, ':', state);
      return state as TabPanelState;
    }
    return null;
  } catch (error) {
    console.error('[SidePanel] Error loading tab state:', error);
    return null;
  }
};

// Helper to save state to localStorage for a tab
const saveTabState = async (tabId: number, state: TabPanelState): Promise<void> => {
  try {
    if (tabId < 0) {
      console.warn('[SidePanel] Cannot save state for invalid tab ID:', tabId);
      return;
    }
    const key = getTabStateKey(tabId);
    console.log('[SidePanel] Saving state for tab', tabId, ':', state);
    await chrome.storage.local.set({ [key]: state });
  } catch (error) {
    console.error('[SidePanel] Error saving tab state:', error);
  }
};

// Helper to clear state from localStorage for a tab
const clearTabState = async (tabId: number): Promise<void> => {
  try {
    if (tabId < 0) {
      console.warn('[SidePanel] Cannot clear state for invalid tab ID:', tabId);
      return;
    }
    const key = getTabStateKey(tabId);
    console.log('[SidePanel] Clearing state for tab', tabId);
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error('[SidePanel] Error clearing tab state:', error);
  }
};

const SidePanel = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('chat');
  const [runningPlugin, setRunningPlugin] = useState<string | null>(null);
  const [pausedPlugin, setPausedPlugin] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
  const [currentTabId, setCurrentTabId] = useState<number>(-1);
  const [theme, setTheme] = useState<Theme>('system');
  const [isLight, setIsLight] = useState(true);
  const [pluginsLoaded, setPluginsLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      const state = await exampleThemeStorage.get();
      setTheme(state.theme);
      setIsLight(state.isLight);
    };
    loadTheme();

    // Подписываемся на изменения
    const unsubscribe = exampleThemeStorage.subscribe(() => {
      loadTheme();
    });

    return unsubscribe;
  }, []);

  // Реф для отслеживания активного порта
  const activePortRef = useRef<chrome.runtime.Port | null>(null);
  const portReadyRef = useRef<boolean>(false);
  const messageQueueRef = useRef<any[]>([]);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  // Функция проверки готовности порта
  const isPortReady = useCallback((): boolean => {
    return portReadyRef.current && activePortRef.current !== null;
  }, []);

  // Функция отправки сообщений через порт
  const sendMessageViaPort = useCallback(async (message: any, retries = 3): Promise<any> => {
    if (!isPortReady()) {
      console.log('[SidePanel] Port not ready, queuing message:', message);
      messageQueueRef.current.push(message);
      return;
    }

    for (let i = 0; i < retries; i++) {
      try {
        if (activePortRef.current) {
          activePortRef.current.postMessage(message);
          console.log('[SidePanel] Message sent via port:', message);
          return;
        } else {
          throw new Error('Port is not available');
        }
      } catch (error) {
        console.warn(`[SidePanel] Port message attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        }
      }
    }

    throw new Error('Failed to send message after all retries');
  }, [isPortReady]);

  // Функция для обработки накопленных сообщений
  const processMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0 && isPortReady()) {
      const message = messageQueueRef.current.shift();
      if (message) {
        sendMessageViaPort(message).catch(error => {
          console.error('[SidePanel] Failed to process queued message:', error);
        });
      }
    }
  }, [isPortReady, sendMessageViaPort]);

  // Функции для работы с уведомлениями

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Исправляем типы для Toast
  // Предположим, что Toast выглядит так:
  type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning';
    duration: number;
    timestamp: number;
  };

  // Исправляем addToastWithDeps, убираем 'info', добавляем duration/timestamp
  const addToastWithDeps = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' = 'success', duration: number = 3000) => {
      const id = Date.now().toString();
      const newToast: Toast = { id, message, type, duration, timestamp: Date.now() };
      setToasts((prev: Toast[]) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast],
  );

  useEffect(() => {
    console.log('[SidePanel] useEffect вызван - загружаем плагины и URL');
    getCurrentTabUrl();
  }, []);

  // Effect to restore saved panel state when tab changes or plugins load
  useEffect(() => {
    if (currentTabId <= 0 || !pluginsLoaded) {
      return;
    }

    const restoreTabState = async () => {
      console.log('[SidePanel] Attempting to restore state for tab', currentTabId);
      const savedState = await loadTabState(currentTabId);

      if (savedState) {
        console.log('[SidePanel] Found saved state, attempting to restore:', savedState);

        // Check if the saved plugin ID exists and is allowed on current URL
        if (savedState.selectedPluginId) {
          const savedPlugin = plugins.find(p => p.id === savedState.selectedPluginId);
          if (savedPlugin && isPluginAllowedOnHost(savedPlugin)) {
            console.log('[SidePanel] Restoring plugin:', savedPlugin.id);
            setSelectedPlugin(savedPlugin);
            setShowControlPanel(savedState.showControlPanel);
            setPanelView(savedState.panelView);
          } else {
            console.warn('[SidePanel] Saved plugin not found or not allowed, clearing state');
            await clearTabState(currentTabId);
            setSelectedPlugin(null);
            setShowControlPanel(false);
            setPanelView('chat');
          }
        } else {
          console.log('[SidePanel] No plugin ID in saved state');
          setSelectedPlugin(null);
          setShowControlPanel(false);
          setPanelView('chat');
        }
      } else {
        console.log('[SidePanel] No saved state found, showing plugins list');
        setSelectedPlugin(null);
        setShowControlPanel(false);
        setPanelView('chat');
      }
    };

    restoreTabState();
  }, [currentTabId, pluginsLoaded, plugins]);

  // Heartbeat механизм для поддержания надежного соединения с retry логикой
  const pingWithRetry = useCallback(async (retries = 3, delay = 1000): Promise<boolean> => {
    console.log('[SidePanel][HEARTBEAT] Starting heartbeat ping with retry');
    for (let i = 0; i < retries; i++) {
      try {
        const pingTime = Date.now();
        console.log(`[SidePanel][HEARTBEAT] Attempt ${i + 1}/${retries} at ${new Date(pingTime).toISOString()}`);

        // Если порт готов, используем его для heartbeat
        if (isPortReady()) {
          await sendMessageViaPort({ type: 'PING' });
          setConnectionStatus('connected');
          console.log(`[SidePanel][HEARTBEAT] ✅ Success via port - latency: ${Date.now() - pingTime}ms`);
          return true;
        } else {
          // Fallback на chrome.runtime.sendMessage
          const response = await chrome.runtime.sendMessage({ type: 'PING' });
          const pongTime = Date.now();
          const latency = pongTime - pingTime;

          if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message || 'Unknown runtime error');
          }
          if (response?.pong) {
            console.log(`[SidePanel][HEARTBEAT] ✅ Success via fallback - latency: ${latency}ms, pong timestamp: ${response.timestamp}`);
            setConnectionStatus('connected');
            return true;
          } else {
            console.warn(`[SidePanel][HEARTBEAT] ⚠️ Invalid response - missing pong, response:`, response);
          }
        }
      } catch (error) {
        console.warn(`[SidePanel][HEARTBEAT] ❌ Attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          console.log(`[SidePanel][HEARTBEAT] Waiting ${delay * (i + 1)}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }
    console.error('[SidePanel][HEARTBEAT] 💥 All heartbeat attempts failed - connection lost');
    setConnectionStatus('disconnected');
    return false;
  }, [isPortReady, sendMessageViaPort]);

  // Функция переподключения порта
  const reconnectPort = useCallback(async () => {
    console.log('[SidePanel] Attempting to reconnect port...');
    try {
      if (activePortRef.current) {
        activePortRef.current.disconnect();
        activePortRef.current = null;
      }

      portReadyRef.current = false;

      const port = chrome.runtime.connect();
      activePortRef.current = port;

      console.log('[SidePanel] New port created:', port.name);

      // Порт готов сразу после создания
      portReadyRef.current = true;

      // Обработчик сообщений от порта
      const messageListener = (msg: any) => {
        console.log('[SidePanel] Received message from background via port:', msg);

        if (msg.type === 'GET_PLUGINS_RESPONSE' && msg.plugins && Array.isArray(msg.plugins)) {
          console.log('[SidePanel] Setting plugins from port message:', msg.plugins);
          setPlugins(msg.plugins);
          setPluginsLoaded(true);
          console.log('[SidePanel] ✅ Plugins loaded successfully');
        } else if (msg.type === 'GET_PLUGINS_RESPONSE' && msg.error) {
          console.error('[SidePanel] Error from background script:', msg.error);
          setPluginsLoaded(true);
          addToastWithDeps('Ошибка загрузки плагинов', 'error');
        }
      };

      // Обработчик отключения порта
      const disconnectListener = () => {
        console.log('[SidePanel] Port disconnected, will attempt reconnection');
        portReadyRef.current = false;
        activePortRef.current = null;
        setConnectionStatus('disconnected');

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
      console.error('[SidePanel] Failed to reconnect port:', error);
      addToastWithDeps('Не удалось переподключить порт', 'error');
    }
  }, [processMessageQueue, addToastWithDeps]);

  // Функция отправки сообщений с retry логикой
  const sendMessageWithRetry = useCallback(async (message: any, retries = 3): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await chrome.runtime.sendMessage(message);
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message || 'Unknown runtime error');
        }
        return response;
      } catch (error) {
        console.warn(`[SidePanel] Message send attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        }
      }
    }
    throw new Error('Failed to send message after all retries');
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    console.log('[SidePanel][HEARTBEAT] 🚀 Starting heartbeat with 10s interval');
    heartbeatIntervalRef.current = setInterval(async () => {
      const success = await pingWithRetry();
      if (!success) {
        console.warn('[SidePanel][HEARTBEAT] ⚠️ Heartbeat failed, attempting to reconnect port...');
        // Попытка переподключения порта
        try {
          await reconnectPort();
        } catch (error) {
          console.error('[SidePanel][HEARTBEAT] ❌ Port reconnection failed:', error);
        }
      }
    }, 10000); // Проверка каждые 10 секунд
  }, [pingWithRetry, reconnectPort]);

  // Остановка heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // useEffect для запуска heartbeat и порта
  useEffect(() => {
    console.log('[SidePanel] Запуск heartbeat механизма и подключения к порту');
    startHeartbeat();

    return () => {
      console.log('[SidePanel] Остановка heartbeat механизма и отключение порта');
      stopHeartbeat();
      if (activePortRef.current) {
        activePortRef.current.disconnect();
      }
    };
  }, [startHeartbeat, stopHeartbeat]);


  useEffect(() => {
    console.log('[SidePanel] useEffect: Starting port-based plugin loading');

    const loadPlugins = async () => {
      try {
        console.log('[SidePanel] Connecting to background script via port...');

        // Инициализируем порт
        await reconnectPort();

        // Ждем готовности порта и отправляем сообщение
        const maxWaitTime = 5000;
        const checkInterval = 100;
        let waitedTime = 0;

        while (!isPortReady() && waitedTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waitedTime += checkInterval;
        }

        if (isPortReady()) {
          await sendMessageViaPort({ type: 'GET_PLUGINS' });
          console.log('[SidePanel] Sent GET_PLUGINS message via port');
        } else {
          throw new Error('Port not ready after waiting');
        }
      } catch (error) {
        console.error('[SidePanel] Error in port-based plugin loading:', error);
        addToastWithDeps('Ошибка связи с background script', 'error');
      }
    };

    loadPlugins();
  }, [reconnectPort, isPortReady, sendMessageViaPort, addToastWithDeps]);

  useEffect(() => {
    // Функция для обновления URL и ID вкладки, затем загрузки сохраненного состояния
    const updateTabAndLoadState = async () => {
      await getCurrentTabUrl();
    };

    // Слушатели событий Chrome
    chrome.tabs.onActivated.addListener(updateTabAndLoadState);
    chrome.tabs.onUpdated.addListener(updateTabAndLoadState);

    // Очистка слушателей при размонтировании
    return () => {
      chrome.tabs.onActivated.removeListener(updateTabAndLoadState);
      chrome.tabs.onUpdated.removeListener(updateTabAndLoadState);
    };
  }, []);

  const getCurrentTabUrl = async () => {
    try {
      console.log('[SidePanel] Получение URL и ID активной вкладки...');

      // Попробуем несколько способов получения активной вкладки
      let activeTab = null;

      // Способ 1: через chrome.tabs.query
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('[SidePanel] Способ 1 - найденные вкладки:', tabs);
        if (tabs[0]?.url) {
          activeTab = tabs[0];
        }
      } catch (error) {
        console.log('[SidePanel] Способ 1 не сработал:', error);
      }

      // Способ 2: через chrome.tabs.query с более широкими параметрами
      if (!activeTab) {
        try {
          const allTabs = await chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
          console.log('[SidePanel] Способ 2 - все вкладки в окне:', allTabs);
          activeTab = allTabs.find(tab => tab.active);
        } catch (error) {
          console.log('[SidePanel] Способ 2 не сработал:', error);
        }
      }

      // Способ 3: через background script с GET_ACTIVE_TAB_INFO
      if (!activeTab) {
        try {
          const response = await sendMessageWithRetry({ type: 'GET_ACTIVE_TAB_INFO' });
          console.log('[SidePanel] Способ 3 - ответ от background (GET_ACTIVE_TAB_INFO):', response);
          if (response?.url) {
            setCurrentTabUrl(response.url);
            if (response.tabId && response.tabId > 0) {
              setCurrentTabId(response.tabId);
            }
            return;
          }
        } catch (error) {
          console.log('[SidePanel] Способ 3 не сработал:', error);
        }
      }

      if (activeTab?.url) {
        console.log('[SidePanel] Устанавливаем URL:', activeTab.url, 'и ID:', activeTab.id);
        setCurrentTabUrl(activeTab.url);
        if (activeTab.id && activeTab.id > 0) {
          setCurrentTabId(activeTab.id);
        } else {
          console.warn('[SidePanel] Tab ID missing or invalid:', activeTab.id);
          setCurrentTabId(-1);
        }
      } else {
        console.log('[SidePanel] URL не найден, activeTab:', activeTab);
        setCurrentTabUrl(null);
        setCurrentTabId(-1);
      }
    } catch (error) {
      console.error('[SidePanel] Ошибка получения URL активной вкладки:', error);
      setCurrentTabUrl(null);
      setCurrentTabId(-1);
    }
  };

  const patternToRegExp = (pattern: string): RegExp | null => {
    if (pattern === '<all_urls>') {
      return /^https?:\/\/.+/;
    }
    const match = pattern.match(/^(\*|http|https):\/\/([^/]+)\/(.*)$/);
    if (!match) return null;
    const [, scheme, host, path] = match;
    const schemeRegex = scheme === '*' ? 'https?' : scheme;
    // Если host начинается с *., то разрешаем и без поддомена
    if (host.startsWith('*.')) {
      const hostWithoutWildcard = host.slice(2);
      // (?:[\\w-]+\\.)*ozon\\.ru — 0 или более поддоменов, включая отсутствие
      const hostRegex = '(?:[\\w-]+\\.)*' + hostWithoutWildcard.replace(/\./g, '\\.');
      const pathRegex = path.replace(/\*/g, '.*');
      return new RegExp(`^${schemeRegex}://${hostRegex}/${pathRegex}$`);
    } else {
      const hostRegex = host.replace(/\./g, '\\.');
      const pathRegex = path.replace(/\*/g, '.*');
      return new RegExp(`^${schemeRegex}://${hostRegex}/${pathRegex}$`);
    }
  };

  const isPluginAllowedOnHost = (plugin: Plugin) => {
    const hostPermissions: string[] = Array.isArray(plugin.manifest?.host_permissions)
      ? (plugin.manifest?.host_permissions as string[])
      : plugin.host_permissions || [];
    const url = currentTabUrl || window.location.href;
    let matched = false;
    const debugInfo = [];

    console.log(`[SidePanel] Проверка плагина '${plugin.name}' для URL: ${url}`);
    console.log(`[SidePanel] host_permissions:`, hostPermissions);

    for (const pattern of hostPermissions) {
      const regex = patternToRegExp(pattern);
      if (!regex) {
        debugInfo.push(`[${plugin.name}] Pattern '${pattern}' не преобразован в RegExp`);
        continue;
      }
      const result = regex.test(url);
      debugInfo.push(`[${plugin.name}] Pattern: '${pattern}' → ${regex} => ${result}`);
      if (result) matched = true;
    }
    if (!matched) {
      // Краткий лог только для отладки, без подробностей
      console.info(`[SidePanel] Плагин '${plugin.name}' не отображается для URL: ${url}`);
    } else {
      // Для успешных тоже можно логировать (опционально)
      console.log(`[SidePanel][DEBUG] Плагин '${plugin.name}' отображается для URL: ${url}`);
    }
    return matched;
  };

  // Удаляю функцию loadPlugins и все связанные с ней вызовы chrome.runtime.sendMessage для загрузки плагинов

  const handlePluginClick = async (plugin: Plugin) => {
    // Открываем панель управления вместо прямого запуска
    setSelectedPlugin(plugin);
    setShowControlPanel(true);
    setPanelView('chat'); // По умолчанию открываем вкладку "Чат"

    // Сохраняем состояние для текущей вкладки
    if (currentTabId > 0) {
      const newState: TabPanelState = {
        showControlPanel: true,
        selectedPluginId: plugin.id,
        panelView: 'chat'
      };
      await saveTabState(currentTabId, newState);
    }
  };

  const handleStartPlugin = async () => {
    if (!selectedPlugin) return;

    setRunningPlugin(selectedPlugin.id);
    setPausedPlugin(null);

    try {
      const pluginName = selectedPlugin.name || selectedPlugin.manifest?.name || selectedPlugin.id;
      // const logger = createRunLogger(`workflow-${selectedPlugin.id}`, `Воркфлоу плагина: ${pluginName}`); // Удалено

      await sendMessageWithRetry({
        type: 'RUN_WORKFLOW',
        pluginId: selectedPlugin.id,
      });

      // const run = logger.getRun(); // Удалено
      // setLogRuns(prev => [run, ...prev]); // Удалено

      addToastWithDeps(`Плагин ${pluginName} запущен`, 'success');
    } catch (error) {
      console.error('Failed to run workflow:', error);
      addToastWithDeps(`Ошибка запуска плагина ${selectedPlugin.name}`, 'error');
    } finally {
      setRunningPlugin(null);
    }
  };

  const handlePausePlugin = async () => {
    if (!selectedPlugin) return;

    if (pausedPlugin === selectedPlugin.id) {
      // Возобновляем
      setPausedPlugin(null);
      addToastWithDeps(`Плагин ${selectedPlugin.name} возобновлен`, 'success');
    } else {
      // Приостанавливаем
      setPausedPlugin(selectedPlugin.id);
      addToastWithDeps(`Плагин ${selectedPlugin.name} приостановлен`, 'warning');
    }
  };

  const handleStopPlugin = async () => {
    if (!selectedPlugin) return;

    try {
      await sendMessageWithRetry({
        type: 'STOP_WORKFLOW',
        pluginId: selectedPlugin.id,
      });

      setRunningPlugin(null);
      setPausedPlugin(null);
      addToastWithDeps(`Плагин ${selectedPlugin.name} остановлен`, 'success');
    } catch (error) {
      console.error('Failed to stop workflow:', error);
      addToastWithDeps(`Ошибка остановки плагина ${selectedPlugin.name}`, 'error');
    }
  };

  const handleClosePanel = async () => {
    setShowControlPanel(false);
    setSelectedPlugin(null);
    setPanelView('chat'); // Сбрасываем на "Чат" при закрытии

    // Очищаем сохраненное состояние для текущей вкладки
    if (currentTabId > 0) {
      await clearTabState(currentTabId);
    }
  };

  // Функция для обновления настроек плагина
  const handleUpdatePluginSetting = async (pluginId: string, setting: string, value: boolean): Promise<void> => {
    try {
      // Отправляем сообщение в background script для обновления настроек
      const response = await sendMessageWithRetry({
        type: 'UPDATE_PLUGIN_SETTING',
        pluginId,
        setting,
        value,
      });

      if (response?.error) {
        throw new Error(response.error);
      }

      // Обновляем локальное состояние плагина
      setPlugins(prevPlugins =>
        prevPlugins.map(plugin =>
          plugin.id === pluginId
            ? {
                ...plugin,
                settings: {
                  ...plugin.settings,
                  [setting]: value,
                },
              }
            : plugin,
        ),
      );

      // Обновляем выбранный плагин, если это он
      if (selectedPlugin?.id === pluginId) {
        setSelectedPlugin(prev =>
          prev
            ? {
                ...prev,
                settings: {
                  ...prev.settings,
                  [setting]: value,
                },
              }
            : null,
        );
      }

      console.log(`[SidePanel] Updated plugin setting for ${pluginId}:`, setting, '=', value);
      addToastWithDeps(`Настройка плагина обновлена`, 'success');
    } catch (error) {
      console.error(`[SidePanel] Failed to update plugin setting for ${pluginId}:`, error);
      addToastWithDeps(`Ошибка обновления настройки плагина`, 'error');
      throw error;
    }
  };


  // HANDLER для сообщений от Pyodide через background - перенос messages в PluginControlPanel
  useEffect(() => {
    const handlePyodideMessage = (message: any, sender: any, sendResponse: any) => {
      console.log('[SidePanel] Принято сообщение от Pyodide:', message);

      if (message.type === 'PYODIDE_MESSAGE') {
        if (!selectedPlugin) {
          console.warn('[SidePanel][PYODIDE_MESSAGE] Игнорируем: selectedPlugin не установлен');
          return true;
        }

        console.log('[SidePanel] PYODIDE_MESSAGE получено:', message.message);

        // Проверяем наличие message.content
        if (!message.message || !message.message.content) {
          console.warn('[SidePanel][PYODIDE_MESSAGE] Игнорируем: message.content отсутствует или пустой', {
            hasMessage: !!message.message,
            hasContent: !!(message.message && message.message.content)
          });
          return true;
        }

        // Отправляем событие в PluginControlPanel через custom event
        console.log('[SidePanel] Отправляем PYODIDE_MESSAGE_UPDATE в PluginControlPanel');

        const customEvent = new CustomEvent('PYODIDE_MESSAGE_UPDATE', {
          detail: {
            type: 'PYODIDE_MESSAGE_UPDATE',
            message: message.message,
            timestamp: message.timestamp
          }
        });

        window.dispatchEvent(customEvent);
        console.log('[SidePanel] Событие PYODIDE_MESSAGE_UPDATE отправлено');

        return true;
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(handlePyodideMessage);
    console.log('[SidePanel] Handler для PYODIDE_MESSAGE зарегистрирован');

    return () => {
      chrome.runtime.onMessage.removeListener(handlePyodideMessage);
      console.log('[SidePanel] Handler для PYODIDE_MESSAGE удален');
    };
  }, [selectedPlugin]);

  // Effect to persist state whenever UI state changes
  useEffect(() => {
    if (currentTabId <= 0) {
      return;
    }

    const state: TabPanelState = {
      showControlPanel,
      selectedPluginId: selectedPlugin?.id || null,
      panelView
    };

    console.log('[SidePanel] Persisting state for tab', currentTabId, ':', state);
    saveTabState(currentTabId, state).catch(error => {
      console.error('[SidePanel] Error persisting tab state:', error);
    });
  }, [showControlPanel, selectedPlugin, panelView, currentTabId]);

  // useEffect для проверки разрешений плагина при изменении URL
  useEffect(() => {
    console.log('[SidePanel] currentTabUrl изменился:', currentTabUrl);

    if (currentTabUrl && selectedPlugin && !isPluginAllowedOnHost(selectedPlugin)) {
      console.log('[SidePanel] Плагин не разрешен для новой страницы, закрываем панель и сбрасываем состояние');
      setSelectedPlugin(null);
      setShowControlPanel(false);
      setRunningPlugin(null);
      setPausedPlugin(null);
    }
  }, [currentTabUrl, selectedPlugin]);

  const isDark = theme === 'dark' || (theme === 'system' && !isLight);

  return (
    <LocalErrorBoundary>
      {/* AI-First: Основной layout сайдпанели, все визуальные компоненты локальные */}
      <div className={cn('App', isDark ? 'bg-gray-800' : 'bg-slate-50')}>
        <header className={cn('App-header', isDark ? 'text-gray-100' : 'text-gray-900')}>
          <div className="header-controls">
            <ThemeSwitcher theme={theme} isLight={isLight} onToggle={exampleThemeStorage.toggle} isInSidebar={true} />

            <button onClick={() => chrome.runtime.openOptionsPage()} className="settings-btn" title="Открыть настройки">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg> 
            </button>
          </div>
        </header>

        <main className="side-panel-main">
          <section className="plugins-section">
            <h3>Доступные плагины</h3>
            <div className="plugins-grid">
              {(() => {
                console.log('[SidePanel] === РЕНДЕР ===');
                console.log('[SidePanel] Состояние plugins:', plugins);
                console.log('[SidePanel] Состояние currentTabUrl:', currentTabUrl);

                const filteredPlugins = plugins.filter(isPluginAllowedOnHost);
                console.log('[SidePanel] Всего плагинов:', plugins.length);
                console.log('[SidePanel] Отфильтрованных плагинов:', filteredPlugins.length);
                console.log('[SidePanel] Отфильтрованные плагины:', filteredPlugins);

                return filteredPlugins.map(plugin => (
                  <PluginCard
                     key={plugin.id}
                     plugin={plugin}
                     selected={selectedPlugin?.id === plugin.id}
                     onClick={() => handlePluginClick(plugin)}
                     isLight={!isDark}
                   />
                ));
              })()}
            </div>
          </section>
          {/* Удалена секция с LogManager */}
        </main>

        {/* Панель управления плагином */}
        {showControlPanel && selectedPlugin && (
          <PluginControlPanel
            plugin={selectedPlugin}
            currentView={panelView}
            isRunning={runningPlugin === selectedPlugin.id}
            isPaused={pausedPlugin === selectedPlugin.id}
            currentTabUrl={currentTabUrl}
            onStart={handleStartPlugin}
            onPause={handlePausePlugin}
            onStop={handleStopPlugin}
            onClose={handleClosePanel}
          />
        )}

        <ToastNotifications toasts={toasts} onRemove={removeToast} />
      </div>
    </LocalErrorBoundary>
  );
};

export default SidePanel;

// TODO: Миниатюризация карточек и панель управления плагином
