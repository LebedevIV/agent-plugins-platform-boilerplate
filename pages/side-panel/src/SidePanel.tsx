import { LogManager, createRunLogger } from './components/LogManager';
import { PluginControlPanel } from './components/PluginControlPanel';
import { ToastNotifications } from './components/ToastNotifications';
import { PluginCard } from '../../../packages/ui/lib/components/PluginCard';
import { withErrorBoundary, withSuspense, useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useEffect, useCallback } from 'react';
import type { Plugin } from './components/PluginCard';
import type { PanelView } from './components/PluginControlPanel';
import './SidePanel.css';

const SidePanel = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('chat');
  const [runningPlugin, setRunningPlugin] = useState<string | null>(null);
  const [pausedPlugin, setPausedPlugin] = useState<string | null>(null);
  const [logRuns, setLogRuns] = useState<Array<{ id: string; title: string; logs: string[] }>>([]);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>(
    [],
  );
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
  const { isLight } = useStorage(exampleThemeStorage);

  // Функции для работы с уведомлениями
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToastWithDeps = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' = 'info', duration: number = 3000) => {
      const id = Date.now().toString();
      const newToast = { id, message, type };
      setToasts(prev => [...prev, newToast]);

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

  const getCurrentTabUrl = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        setCurrentTabUrl(tabs[0].url);
      }
    } catch (error) {
      console.error('Failed to get current tab URL:', error);
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
    const hostPermissions = plugin.manifest?.host_permissions || plugin.host_permissions || [];
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
      const logger = createRunLogger(`workflow-${selectedPlugin.id}`, `Воркфлоу плагина: ${pluginName}`);

      await chrome.runtime.sendMessage({
        type: 'RUN_WORKFLOW',
        pluginId: selectedPlugin.id,
      });

      const run = logger.getRun();
      setLogRuns(prev => [run, ...prev]);

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

  const clearLogs = () => {
    setLogRuns([]);
  };

  // Функция для обновления настроек плагина
  const handleUpdatePluginSetting = async (pluginId: string, setting: string, value: boolean) => {
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
      return true;
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
                onToggle={enabled => handleUpdatePluginSetting(plugin.id, 'enabled', enabled)}
              />
            ))}
          </div>
        </section>

        <section className="logs-section">
          <LogManager runs={logRuns} onClear={clearLogs} />
        </section>
      </main>

      {/* Панель управления плагином */}
      {showControlPanel && selectedPlugin && (
        <PluginControlPanel
          plugin={selectedPlugin}
          currentView={panelView}
          isRunning={runningPlugin === selectedPlugin.id}
          isPaused={pausedPlugin === selectedPlugin.id}
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
