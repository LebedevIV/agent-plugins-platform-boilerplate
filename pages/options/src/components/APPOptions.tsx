import React, { useEffect } from 'react';
import { PROJECT_URL_OBJECT } from '@extension/shared';
import { useAIKeys, usePlugins, useTabs, useTranslations } from '../hooks';
import { IDELayout, PluginsTab, SettingsTab } from './index';

export const APPOptions: React.FC<{ isLight: boolean }> = ({ isLight }) => {
  // Определяем язык из браузера или используем английский по умолчанию
  const browserLocale = chrome.i18n?.getUILanguage?.() || 'en';
  const locale = browserLocale.startsWith('ru') ? 'ru' : 'en';
  
  const { t } = useTranslations(locale);
  const { activeTab, switchTab, isActiveTab } = useTabs('plugins');
  const { plugins, selectedPlugin, loading, error, selectPlugin, updatePluginSetting } = usePlugins();
  const {
    aiKeys,
    customKeys,
    saveAIKeys,
    testAIKeys,
    addCustomKey,
    removeCustomKey,
    updateKey,
    updateCustomKeyName,
    getStatusText,
    getStatusClass
  } = useAIKeys();

  // Make sure we have a selected plugin when tab is 'plugins'
  useEffect(() => {
    if (activeTab === 'plugins' && plugins.length > 0 && !selectedPlugin) {
      selectPlugin(plugins[0]);
    }
  }, [activeTab, plugins, selectedPlugin, selectPlugin]);

  const handleGithubClick = () => {
    chrome.tabs.create(PROJECT_URL_OBJECT);
  };

  return (
    <IDELayout
      activeTab={activeTab}
      onTabChange={switchTab}
      selectedPlugin={selectedPlugin}
      onGithubClick={handleGithubClick}
      locale={locale}
      onUpdatePluginSetting={updatePluginSetting}
      isLight={isLight}
    >
      {isActiveTab('plugins') && (
        <PluginsTab
          plugins={plugins}
          selectedPlugin={selectedPlugin}
          onSelectPlugin={selectPlugin}
          loading={loading}
          error={error}
          locale={locale}
          onUpdatePluginSetting={updatePluginSetting}
        />
      )}

      {isActiveTab('settings') && (
        <SettingsTab
          aiKeys={aiKeys}
          customKeys={customKeys}
          onSave={saveAIKeys}
          onTest={testAIKeys}
          onAddCustomKey={addCustomKey}
          onRemoveCustomKey={removeCustomKey}
          onUpdateKey={updateKey}
          onUpdateCustomKeyName={updateCustomKeyName}
          getStatusText={(status) => getStatusText(status, t)}
          getStatusClass={getStatusClass}
          locale={locale}
        />
      )}
    </IDELayout>
  );
}; 