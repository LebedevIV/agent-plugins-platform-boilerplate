import '@src/Options.css';
import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SettingsTab } from './components/SettingsTab';
import { PluginsTab } from './components/PluginsTab';
import LocalErrorBoundary from './components/LocalErrorBoundary';
import { usePlugins } from './hooks/usePlugins';
import { useTranslations } from './hooks/useTranslations';
import PluginDetails from './components/PluginDetails';

const Options = function () {
  const [activeTab, setActiveTab] = useState('plugins');
  const { plugins, selectedPlugin, selectPlugin, loading, error } = usePlugins();
  const { t } = useTranslations();

  return (
    <LocalErrorBoundary>
      <PanelGroup direction="horizontal" className="ide-layout">
        <Panel defaultSize={20} minSize={15}>
          <div className="ide-sidebar-left">
            <div className="tab-nav">
              <button
                className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}>
                {t('options_settings_title')}
              </button>
              <button
                className={`tab-button ${activeTab === 'plugins' ? 'active' : ''}`}
                onClick={() => setActiveTab('plugins')}>
                {t('options_plugins_title')}
              </button>
            </div>
          </div>
        </Panel>
        <PanelResizeHandle />
        <Panel>
          <div className="ide-main-content">
            {activeTab === 'settings' && (
              <div className="tab-content active">
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
            )}
            {activeTab === 'plugins' && (
              <div className="tab-content active">
                <PluginsTab
                  plugins={plugins}
                  selectedPlugin={selectedPlugin}
                  onSelectPlugin={selectPlugin}
                  loading={loading}
                  error={error}
                />
              </div>
            )}
          </div>
        </Panel>
        <PanelResizeHandle />
        <Panel defaultSize={40} minSize={30}>
          <div className="ide-sidebar-right">
            {activeTab === 'plugins' && <PluginDetails selectedPlugin={selectedPlugin} />}
          </div>
        </Panel>
      </PanelGroup>
    </LocalErrorBoundary>
  );
};

export default Options;
