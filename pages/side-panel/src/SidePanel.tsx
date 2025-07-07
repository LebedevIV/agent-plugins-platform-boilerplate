import '@src/SidePanel.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import React, { useState, useEffect } from 'react';
import { PluginCard, Plugin } from './components/PluginCard';
import { LogManager, LogRun, createRunLogger } from './components/LogManager';
import { ToastNotifications, useToastManager } from './components/ToastNotifications';

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [runningPlugin, setRunningPlugin] = useState<string | null>(null);
  const [logRuns, setLogRuns] = useState<LogRun[]>([]);
  const { toasts, addToast, removeToast } = useToastManager();

  // Load plugins on mount
  useEffect(() => {
    loadPlugins();
  }, []);

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
    setSelectedPlugin(plugin);
    setRunningPlugin(plugin.id);
    
    try {
      // Create logger for this run
      const pluginName = plugin.name || plugin.manifest?.name || plugin.id;
      const logger = createRunLogger(`workflow-${plugin.id}`, `Воркфлоу плагина: ${pluginName}`);
      
      // Run workflow
      await chrome.runtime.sendMessage({ 
        type: 'RUN_WORKFLOW', 
        pluginId: plugin.id 
      });
      
      // Add run to logs
      const run = logger.getRun();
      setLogRuns(prev => [run, ...prev]);
      
      addToast(`Плагин ${pluginName} запущен`, 'success');
    } catch (error) {
      console.error('Failed to run workflow:', error);
      addToast(`Ошибка запуска плагина ${pluginName}`, 'error');
    } finally {
      setRunningPlugin(null);
    }
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
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>
      
      <main className="side-panel-main">
        <section className="plugins-section">
          <h3>Доступные плагины</h3>
          <div className="plugins-grid">
            {plugins.map((plugin) => (
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
      
      <ToastNotifications toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
