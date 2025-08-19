import '@src/Options.css';
import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SettingsTab } from './components/SettingsTab';
import { PluginsTab } from './components/PluginsTab';
import LocalErrorBoundary from './components/LocalErrorBoundary';
import { usePlugins } from './hooks/usePlugins';
import { useTranslations } from './hooks/useTranslations';
import PluginDetails from './components/PluginDetails';
import ThemeSwitcher from './components/ThemeSwitcher';

type Theme = 'light' | 'dark' | 'system';

const Options = function () {
  const [activeTab, setActiveTab] = useState('plugins');
  const { plugins, selectedPlugin, selectPlugin, loading, error } = usePlugins();
  const { t } = useTranslations();
  const [layout, setLayout] = useState<number[] | undefined>();
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    chrome.storage.local.get(['optionsPanelLayout', 'theme'], result => {
      if (result.optionsPanelLayout && Array.isArray(result.optionsPanelLayout)) {
        console.log('Loaded layout:', result.optionsPanelLayout);
        setLayout(result.optionsPanelLayout);
      }
      if (result.theme) {
        setTheme(result.theme);
      }
    });
  }, []);

  const handleLayout = (sizes: number[]) => {
    console.log('Saving layout:', sizes);
    setLayout(sizes);
    chrome.storage.local.set({ optionsPanelLayout: sizes });
  };

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
  };

  return (
    <LocalErrorBoundary>
      <PanelGroup
        direction="horizontal"
        className="ide-layout"
        onLayout={handleLayout}
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
            <ThemeSwitcher theme={theme} setTheme={handleSetTheme} />
          </div>
        </Panel>
        <PanelResizeHandle id="sidebar-left-resize-handle" />
        <Panel defaultSize={30} id="main-content-panel">
          <div className="ide-main-content" id="main-content">
            {activeTab === 'settings' && (
              <div className="tab-content active" id="settings-tab-content">
                <div id="settings-tab">
                  <SettingsTab
                    aiKeys={[]}
                    customKeys={[]}
                    onSave={() => {}}
                    onTest={() => {}}
                    onAddCustomKey={() => {}}
                    onRemoveCustomKey={() => {}}
                    onUpdateKey={() => {}}
                    onUpdateCustomKeyName={() => {}}
                    getStatusText={() => ''}
                    getStatusClass={() => ''}
                    theme="light"
                    setTheme={() => {}}
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
      </PanelGroup>
    </LocalErrorBoundary>
  );
};

export default Options;
