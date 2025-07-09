import '@src/SidePanel.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import React, { useState, useEffect } from 'react';
import { PluginCard, Plugin } from './components/PluginCard';
import { LogManager, LogRun, createRunLogger } from './components/LogManager';
import { ToastNotifications, useToastManager } from './components/ToastNotifications';
import { PluginControlPanel, PanelView } from './components/PluginControlPanel';

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [runningPlugin, setRunningPlugin] = useState<string | null>(null);
  const [logRuns, setLogRuns] = useState<LogRun[]>([]);
  const { toasts, addToast, removeToast } = useToastManager();
  const [currentTabUrl, setCurrentTabUrl] = useState<string>('');
  
  // Состояния панели управления
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('details');
  const [pausedPlugin, setPausedPlugin] = useState<string | null>(null);

  // Load plugins on mount
  useEffect(() => {
    loadPlugins();
  }, []);

  // Получить URL активной вкладки
  useEffect(() => {
    chrome.tabs && chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        setCurrentTabUrl(tabs[0].url);
      }
    });
  }, []);

  // Проверка соответствия домена правилам host_permissions
  function patternToRegExp(pattern: string): RegExp | null {
    if (pattern === '<all_urls>') {
      return /^https?:\/\/.+/;
    }
    const match = pattern.match(/^(\*|http|https):\/\/([^/]+)\/(.*)$/);
    if (!match) return null;
    let [, scheme, host, path] = match;
    let schemeRegex = scheme === '*' ? 'https?' : scheme;
    // Если host начинается с *., то разрешаем и без поддомена
    if (host.startsWith('*.')) {
      host = host.slice(2);
      // (?:[\\w-]+\\.)*ozon\\.ru — 0 или более поддоменов, включая отсутствие
      host = '(?:[\\w-]+\\.)*' + host.replace(/\./g, '\\.');
    } else {
      host = host.replace(/\./g, '\\.');
    }
    let pathRegex = path.replace(/\*/g, '.*');
    return new RegExp(`^${schemeRegex}:\/\/${host}\/${pathRegex}$`);
  }

  function isPluginAllowedOnHost(plugin: any) {
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
  }

  const loadPlugins = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PLUGINS' });
      if (response) {
        setPlugins(response);
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
      addToast('Ошибка загрузки плагинов', 'error');
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
        pluginId: selectedPlugin.id 
      });
      
      const run = logger.getRun();
      setLogRuns(prev => [run, ...prev]);
      
      addToast(`Плагин ${pluginName} запущен`, 'success');
    } catch (error) {
      console.error('Failed to run workflow:', error);
      addToast(`Ошибка запуска плагина ${selectedPlugin.name}`, 'error');
    } finally {
      setRunningPlugin(null);
    }
  };

  const handlePausePlugin = async () => {
    if (!selectedPlugin) return;
    
    if (pausedPlugin === selectedPlugin.id) {
      // Возобновляем
      setPausedPlugin(null);
      addToast(`Плагин ${selectedPlugin.name} возобновлен`, 'success');
    } else {
      // Приостанавливаем
      setPausedPlugin(selectedPlugin.id);
      addToast(`Плагин ${selectedPlugin.name} приостановлен`, 'warning');
    }
  };

  const handleStopPlugin = async () => {
    if (!selectedPlugin) return;
    
    try {
      await chrome.runtime.sendMessage({ 
        type: 'STOP_WORKFLOW', 
        pluginId: selectedPlugin.id 
      });
      
      setRunningPlugin(null);
      setPausedPlugin(null);
      addToast(`Плагин ${selectedPlugin.name} остановлен`, 'success');
    } catch (error) {
      console.error('Failed to stop workflow:', error);
      addToast(`Ошибка остановки плагина ${selectedPlugin.name}`, 'error');
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

  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')}>
      <header className={cn('App-header', isLight ? 'text-gray-900' : 'text-gray-100')}>
        <div className="header-controls">
          <button 
            onClick={exampleThemeStorage.toggle}
            className="theme-toggle-btn"
            title={isLight ? 'Переключить на темную тему' : 'Переключить на светлую тему'}
          >
            {isLight ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            )}
          </button>
          
          <button 
            onClick={() => chrome.runtime.openOptionsPage()}
            className="settings-btn"
            title="Открыть настройки"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        </button>
        </div>
      </header>
      
      <main className="side-panel-main">
        <section className="plugins-section">
          <h3>Доступные плагины</h3>
          <div className="plugins-grid">
            {plugins.filter(isPluginAllowedOnHost).map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                isSelected={selectedPlugin?.id === plugin.id}
                isRunning={runningPlugin === plugin.id}
                onClick={() => handlePluginClick(plugin)}
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
        />
      )}
      
      <ToastNotifications toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);

// TODO: Миниатюризация карточек и панель управления плагином
