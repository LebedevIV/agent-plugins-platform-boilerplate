import React from 'react';
import { cn } from '@extension/ui';
import { TabType } from '../hooks/useTabs';
import { Plugin } from '../hooks/usePlugins';
import { PluginDetails } from './PluginDetails';
import { useTranslations } from '../hooks/useTranslations';

interface IDELayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  selectedPlugin: Plugin | null;
  onGithubClick: () => void;
  locale?: 'en' | 'ru';
}

export const IDELayout: React.FC<IDELayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  selectedPlugin,
  onGithubClick,
  locale = 'en'
}) => {
  const { t } = useTranslations(locale);

  return (
    <div className="ide-layout">
      <aside className="ide-sidebar-left">
        <header>
          <button onClick={onGithubClick} className="logo-button">
            <h1>{t('options.title')}</h1>
          </button>
          <p>{t('options.subtitle')}</p>
        </header>
        <nav className="tab-nav">
          <button 
            className={cn('tab-button', activeTab === 'plugins' && 'active')}
            onClick={() => onTabChange('plugins')}
          >
            {t('options.tabs.plugins')}
          </button>
          <button 
            className={cn('tab-button', activeTab === 'settings' && 'active')}
            onClick={() => onTabChange('settings')}
          >
            {t('options.tabs.settings')}
          </button>
        </nav>
      </aside>

      <main className="ide-main-content">
        {children}
      </main>

      <aside className="ide-sidebar-right">
        <PluginDetails selectedPlugin={selectedPlugin} locale={locale} />
      </aside>
    </div>
  );
}; 