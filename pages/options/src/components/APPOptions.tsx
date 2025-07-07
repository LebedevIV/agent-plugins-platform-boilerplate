import React from 'react';
import { PROJECT_URL_OBJECT } from '@extension/shared';
import { useAIKeys, usePlugins, useTabs, useTranslations } from '../hooks';
import { IDELayout, PluginsTab, SettingsTab } from './index';

export const APPOptions: React.FC = () => {
  // Определяем язык из браузера или используем английский по умолчанию
  const browserLocale = chrome.i18n?.getUILanguage?.() || 'en';
  const locale = browserLocale.startsWith('ru') ? 'ru' : 'en';
  
  const { t } = useTranslations(locale);
  const { activeTab, switchTab, isActiveTab } = useTabs('plugins');
  const { plugins, selectedPlugin, loading, error, selectPlugin } = usePlugins();
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
    >
      {isActiveTab('plugins') && (
        <PluginsTab
          plugins={plugins}
          selectedPlugin={selectedPlugin}
          onSelectPlugin={selectPlugin}
          loading={loading}
          error={error}
          locale={locale}
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