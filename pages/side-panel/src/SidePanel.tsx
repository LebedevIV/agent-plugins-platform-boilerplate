// === Локальные компоненты для сайдпанели (React, TypeScript) ===
import { PluginControlPanel } from './components/PluginControlPanel'; // Панель управления выбранным плагином
import { ToastNotifications } from './components/ToastNotifications'; // Всплывающие уведомления
import ToggleButton from './components/ToggleButton'; // Кнопка переключения темы
// === Общие/shared утилиты и хуки (используются во всех частях расширения) ===
import { useStorage } from '@extension/shared'; // Хук для работы с хранилищем
import { exampleThemeStorage } from '@extension/storage'; // Пример хранилища для темы
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

const SidePanel = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('chat');
  const [runningPlugin, setRunningPlugin] = useState<string | null>(null);
  const [pausedPlugin, setPausedPlugin] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
  const [isLight, setIsLight] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      const state = await exampleThemeStorage.get();
      setIsLight(state.isLight);
    };
    loadTheme();

    // Подписываемся на изменения
    const unsubscribe = exampleThemeStorage.subscribe(() => {
      loadTheme();
    });

    return unsubscribe;
  }, []);

  const portRef = useRef<chrome.runtime.Port | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

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

  // Heartbeat механизм для поддержания надежного соединения с retry логикой
  const pingWithRetry = useCallback(async (retries = 3, delay = 1000): Promise<boolean> => {
    console.log('[SidePanel][HEARTBEAT] Starting heartbeat ping with retry');
    for (let i = 0; i < retries; i++) {
      try {
        const pingTime = Date.now();
        console.log(`[SidePanel][HEARTBEAT] Attempt ${i + 1}/${retries} at ${new Date(pingTime).toISOString()}`);
        const response = await chrome.runtime.sendMessage({ type: 'PING' });
        const pongTime = Date.now();
        const latency = pongTime - pingTime;

        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
        if (response?.pong) {
          console.log(`[SidePanel][HEARTBEAT] ✅ Success - latency: ${latency}ms, pong timestamp: ${response.timestamp}`);
          setConnectionStatus('connected');
          return true;
        } else {
          console.warn(`[SidePanel][HEARTBEAT] ⚠️ Invalid response - missing pong, response:`, response);
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
  }, []);

  // Функция отправки сообщений с retry логикой
  const sendMessageWithRetry = useCallback(async (message: any, retries = 3): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await chrome.runtime.sendMessage(message);
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
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
        console.warn('[SidePanel][HEARTBEAT] ⚠️ Heartbeat failed, attempting to reconnect...');
        // Попытка переподключения через 5 секунд
        setTimeout(() => {
          console.log('[SidePanel][HEARTBEAT] 🔄 Attempting reconnection...');
          pingWithRetry();
        }, 5000);
      }
    }, 10000); // Проверка каждые 10 секунд
  }, [pingWithRetry]);

  // Остановка heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    console.log('[SidePanel] Запуск heartbeat механизма');
    startHeartbeat();

    return () => {
      console.log('[SidePanel] Остановка heartbeat механизма');
      stopHeartbeat();
    };
  }, [startHeartbeat, stopHeartbeat]);


  useEffect(() => {
    console.log('[SidePanel] useEffect: Начинаем загрузку плагинов через Promise-based подход');

    // Функция для загрузки плагинов через Promise-based подход
    const loadPlugins = async () => {
      try {
        console.log('[SidePanel] === НАЧАЛО ЗАГРУЗКИ ПЛАГИНОВ ===');
        console.log('[SidePanel] Отправляем GET_PLUGINS сообщение в background');
        console.log('[SidePanel] Время отправки:', new Date().toISOString());

        // Проверяем соединение с background перед отправкой
        try {
          const pingResponse = await chrome.runtime.sendMessage({ type: 'PING' });
          if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message);
          }
          if (!pingResponse?.pong) {
            throw new Error('Invalid ping response');
          }
          console.log('[SidePanel] Background доступен');
        } catch (pingError) {
          console.warn('[SidePanel] Background недоступен:', pingError);
          throw new Error('Background script недоступен');
        }

        // Отправляем запрос на получение плагинов и ожидаем ответ через Promise
        console.log('[SidePanel][DEBUG] Отправляем GET_PLUGINS сообщение в background');
        console.log('[SidePanel][DEBUG] Время отправки:', new Date().toISOString());

        const response = await chrome.runtime.sendMessage({ type: 'GET_PLUGINS' });

        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }

        console.log('[SidePanel][DEBUG] Получен ответ от background:', response);

        if (response && response.plugins) {
          console.log('[SidePanel] ✅ Получены плагины:', response.plugins);
          console.log('[SidePanel] Количество плагинов:', response.plugins.length);
          console.log('[SidePanel] Детали плагинов:', response.plugins.map((p: any) => ({
            id: p.id,
            name: p.name,
            version: p.version
          })));

          setPlugins(response.plugins);
          console.log('[SidePanel] ✅ Состояние плагинов обновлено успешно');
          console.log('[SidePanel] ✅ Загрузка плагинов завершена');
        } else {
          console.error('[SidePanel] ❌ Неверный ответ от background:', response);
          console.error('[SidePanel] Структура ответа:', Object.keys(response || {}));
          addToastWithDeps('Получен некорректный ответ от background', 'error');
        }
      } catch (error) {
        console.error('[SidePanel] ❌ Ошибка загрузки плагинов:', error);
        console.error('[SidePanel] Детали ошибки:', {
          error,
          message: (error as Error).message,
          stack: (error as Error).stack,
          name: (error as Error).name
        });
        addToastWithDeps('Ошибка связи с background script', 'error');
      }
    };

    // Загружаем плагины
    loadPlugins();
  }, []);

  useEffect(() => {
    // Функция для обновления URL
    const updateUrl = () => getCurrentTabUrl();

    // Слушатели событий Chrome
    chrome.tabs.onActivated.addListener(updateUrl);
    chrome.tabs.onUpdated.addListener(updateUrl);

    // Очистка слушателей при размонтировании
    return () => {
      chrome.tabs.onActivated.removeListener(updateUrl);
      chrome.tabs.onUpdated.removeListener(updateUrl);
    };
  }, []);

  const getCurrentTabUrl = async () => {
    try {
      console.log('[SidePanel] Получение URL активной вкладки...');

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

      // Способ 3: через background script
      if (!activeTab) {
        try {
          const response = await sendMessageWithRetry({ type: 'GET_ACTIVE_TAB_URL' });
          console.log('[SidePanel] Способ 3 - ответ от background:', response);
          if (response?.url) {
            setCurrentTabUrl(response.url);
            return;
          }
        } catch (error) {
          console.log('[SidePanel] Способ 3 не сработал:', error);
        }
      }

      if (activeTab?.url) {
        console.log('[SidePanel] Устанавливаем URL:', activeTab.url);
        setCurrentTabUrl(activeTab.url);
      } else {
        console.log('[SidePanel] URL не найден, activeTab:', activeTab);
        setCurrentTabUrl(null);
      }
    } catch (error) {
      console.error('[SidePanel] Ошибка получения URL активной вкладки:', error);
      setCurrentTabUrl(null);
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

  const handleClosePanel = () => {
    setShowControlPanel(false);
    setSelectedPlugin(null);
    setPanelView('chat'); // Сбрасываем на "Чат" при закрытии
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
    console.log('[SidePanel] Добавлен handler для PYODIDE_MESSAGE');

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
    };

    chrome.runtime.onMessage.addListener(handlePyodideMessage);
    console.log('[SidePanel] Handler для PYODIDE_MESSAGE зарегистрирован');

    return () => {
      chrome.runtime.onMessage.removeListener(handlePyodideMessage);
      console.log('[SidePanel] Handler для PYODIDE_MESSAGE удален');
    };
  }, [selectedPlugin]);

  // useEffect для автоматического сброса состояния плагина при смене вкладки
  useEffect(() => {
    console.log('[SidePanel] currentTabUrl изменился:', currentTabUrl);

    if (selectedPlugin && currentTabUrl) {
      const isAllowed = isPluginAllowedOnHost(selectedPlugin);
      console.log('[SidePanel] Проверка плагина для новой страницы:', {
        pluginId: selectedPlugin.id,
        pluginName: selectedPlugin.name,
        currentTabUrl,
        isAllowed,
        hostPermissions: selectedPlugin.manifest?.host_permissions || selectedPlugin.host_permissions
      });

      if (!isAllowed) {
        console.log('[SidePanel] Плагин не разрешен для новой страницы, сбрасываем состояние');
        setSelectedPlugin(null);
        setShowControlPanel(false);
        setRunningPlugin(null);
        setPausedPlugin(null);
      } else {
        console.log('[SidePanel] Плагин разрешен для новой страницы, сохраняем состояние');
      }
    } else if (!selectedPlugin) {
      console.log('[SidePanel] Нет выбранного плагина для проверки');
    } else if (!currentTabUrl) {
      console.log('[SidePanel] Нет URL для проверки (currentTabUrl is null)');
    }
  }, [currentTabUrl, selectedPlugin, isPluginAllowedOnHost]);

  return (
    <LocalErrorBoundary>
      {/* AI-First: Основной layout сайдпанели, все визуальные компоненты локальные */}
      <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')}>
        <header className={cn('App-header', isLight ? 'text-gray-900' : 'text-gray-100')}>
          <div className="header-controls">
            <button
              onClick={exampleThemeStorage.toggle}
              title={isLight ? 'Переключить на темную тему' : 'Переключить на светлую тему'}
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '20px'
              }}>
              {isLight ? '🌙' : '☀️'}
            </button>

            <button onClick={() => chrome.runtime.openOptionsPage()} className="settings-btn" title="Открыть настройки">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09A1.65 1.65 0 0 0-1.51 1z" />
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
