import '@src/Options.css';
import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SettingsTab } from './components/SettingsTab';
import { PluginsTab } from './components/PluginsTab';
import LocalErrorBoundary from './components/LocalErrorBoundary';
import { usePlugins } from './hooks/usePlugins';
import { useTranslations } from './hooks/useTranslations';
import { useAIKeys } from './hooks/useAIKeys';
import PluginDetails from './components/PluginDetails';
import ThemeSwitcher from './components/ThemeSwitcher';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';

type ThemeStorageState = {
  theme: 'light' | 'dark';
  isLight: boolean;
};

type Theme = 'light' | 'dark' | 'system';

const Options = function () {
   const [activeTab, setActiveTab] = useState('plugins');
   const { plugins, selectedPlugin, selectPlugin, loading, error } = usePlugins();
   const { t } = useTranslations();
   const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
   const [isLight, setIsLight] = useState(true);

   // AI Keys management
   const {
     aiKeys,
     customKeys,
     saveAIKeys,
     testAIKeys,
     addCustomKey,
     removeCustomKey,
     updateKey,
     updateCustomKeyName,
     createGetStatusText,
     getStatusClass,
   } = useAIKeys();

   // Create getStatusText function with current translation
   const getStatusText = createGetStatusText(t);

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

  // Определяем, показывать ли правую панель (только для вкладки plugins)
  const showRightPanel = activeTab === 'plugins';

  const handleLayout = (sizes: number[]) => {
    console.log('Saving layout:', sizes);
    chrome.storage.local.set({ optionsPanelLayout: sizes });
  };

  return (
    <LocalErrorBoundary>
      <PanelGroup
        direction="horizontal"
        className="ide-layout"
        onLayout={handleLayout}
        autoSaveId={showRightPanel ? "options-panel-layout-plugins" : "options-panel-layout-settings"}
        id="options-panel-group">
        <Panel
          defaultSize={20}
          minSize={15}
          id="sidebar-left-panel"
          className="flex flex-col">
          <div className="ide-sidebar-left" id="sidebar-left-content">
            <div className="tab-nav" id="tab-navigation">
              <button
                id="settings-tab-button"
                className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}>
                {t('options_settings_title')}
              </button>
              <button
                id="plugins-tab-button"
                className={`tab-button ${activeTab === 'plugins' ? 'active' : ''}`}
                onClick={() => setActiveTab('plugins')}>
                {t('options_plugins_title')}
              </button>
            </div>
          </div>
          <div id="theme-switcher" className="mb-auto p-2 flex justify-center">
            <ThemeSwitcher theme={theme} isLight={isLight} onToggle={exampleThemeStorage.toggle} />
          </div>
        </Panel>
        <PanelResizeHandle id="sidebar-left-resize-handle" />
        <Panel defaultSize={showRightPanel ? 30 : 80} id="main-content-panel">
          <div className="ide-main-content" id="main-content">
            {activeTab === 'settings' && (
              <div className="tab-content active" id="settings-tab-content">
                <div id="settings-tab">
                  <SettingsTab
                    aiKeys={aiKeys}
                    customKeys={customKeys}
                    onSave={saveAIKeys}
                    onTest={testAIKeys}
                    onAddCustomKey={addCustomKey}
                    onRemoveCustomKey={removeCustomKey}
                    onUpdateKey={updateKey}
                    onUpdateCustomKeyName={updateCustomKeyName}
                    getStatusText={getStatusText}
                    getStatusClass={getStatusClass}
                    theme={theme === 'system' ? (isLight ? 'light' : 'dark') : theme}
                    setTheme={(newTheme) => setTheme(newTheme)}
                  />
                </div>
              </div>
            )}
            {activeTab === 'plugins' && (
              <div className="tab-content active" id="plugins-tab-content">
                <div id="plugins-tab">
                  <PluginsTab
                    plugins={plugins}
                    selectedPlugin={selectedPlugin}
                    onSelectPlugin={selectPlugin}
                    loading={loading}
                    error={error}
                  />
                </div>
              </div>
            )}
          </div>
        </Panel>
        {showRightPanel && (
          <>
            <PanelResizeHandle id="sidebar-right-resize-handle" />
            <Panel defaultSize={50} minSize={30} id="sidebar-right-panel">
              <div className="ide-sidebar-right" id="sidebar-right-content">
                {activeTab === 'plugins' && (
                  <div id="plugin-details-container">
                    <div id="plugin-details">
                      <PluginDetails selectedPlugin={selectedPlugin} />
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>
    </LocalErrorBoundary>
  );
};

export default Options;