// === Локальные компоненты для сайдпанели (React, TypeScript) ===
import { PluginControlPanel } from './components/PluginControlPanel'; // Панель управления выбранным плагином
import { ToastNotifications } from './components/ToastNotifications'; // Всплывающие уведомления
// === Общие/shared утилиты и хуки (используются во всех частях расширения) ===
import { withErrorBoundary, withSuspense, useStorage } from '@extension/shared'; // HOC для обработки ошибок, Suspense и хук для работы с хранилищем
import { exampleThemeStorage } from '@extension/storage'; // Пример хранилища для темы
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui'; // Утилита для классов, компонент ошибки и спиннер
import { PluginCard } from '@extension/ui/lib/components/PluginCard'; // Общий компонент карточки плагина (React)
// === React хуки ===
import { useState, useEffect, useCallback } from 'react';
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
  const { isLight } = useStorage(exampleThemeStorage);

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
    loadPlugins();
    getCurrentTabUrl();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          const response = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_URL' });
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
    console.log('[SidePanel] Проверка плагина', plugin.name, 'host_permissions:', hostPermissions, 'url:', url);
    return hostPermissions.some((pattern: string) => {
      const regex = patternToRegExp(pattern);
      if (!regex) return false;
      const result = regex.test(url);
      console.log('[SidePanel] Pattern:', pattern, '->', regex, '=>', result);
      return result;
    });
  };

  const loadPlugins = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PLUGINS' });
      if (response) {
        // Загружаем настройки плагинов из хранилища
        const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_PLUGIN_SETTINGS' });
        const pluginSettings = settingsResponse || {};

        // Объединяем плагины с их настройками
        const pluginsWithSettings = response.map((plugin: Plugin) => ({
          ...plugin,
          settings: pluginSettings[plugin.id] || { enabled: true, autorun: false },
        }));

        setPlugins(pluginsWithSettings);
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
      addToastWithDeps('Ошибка загрузки плагинов', 'error');
    }
  };

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

      await chrome.runtime.sendMessage({
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
      await chrome.runtime.sendMessage({
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
      const response = await chrome.runtime.sendMessage({
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

  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')}>
      <header className={cn('App-header', isLight ? 'text-gray-900' : 'text-gray-100')}>
        <div className="header-controls">
          <button
            onClick={exampleThemeStorage.toggle}
            className="theme-toggle-btn"
            title={isLight ? 'Переключить на темную тему' : 'Переключить на светлую тему'}>
            {isLight ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
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
            {plugins.filter(isPluginAllowedOnHost).map(plugin => (
              <PluginCard
                key={plugin.id}
                id={plugin.id}
                name={plugin.name}
                version={plugin.version}
                description={plugin.description}
                icon={plugin.icon}
                iconUrl={plugin.iconUrl}
                enabled={plugin.settings?.enabled ?? true}
                selected={selectedPlugin?.id === plugin.id}
                onClick={() => handlePluginClick(plugin)}
                onToggle={async (enabled: boolean): Promise<void> => {
                  await handleUpdatePluginSetting(plugin.id, 'enabled', enabled);
                }}
              />
            ))}
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
          onViewChange={setPanelView}
          onStart={handleStartPlugin}
          onPause={handlePausePlugin}
          onStop={handleStopPlugin}
          onClose={handleClosePanel}
          onUpdateSetting={handleUpdatePluginSetting}
        />
      )}

      <ToastNotifications toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);

// TODO: Миниатюризация карточек и панель управления плагином
