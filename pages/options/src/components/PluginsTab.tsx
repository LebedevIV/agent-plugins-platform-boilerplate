import React from 'react';
import { cn } from '@extension/ui';
import { Plugin } from '../hooks/usePlugins';
import { useTranslations } from '../hooks/useTranslations';

interface PluginsTabProps {
  plugins: Plugin[];
  selectedPlugin: Plugin | null;
  onSelectPlugin: (plugin: Plugin) => void;
  loading: boolean;
  error: string | null;
  locale?: 'en' | 'ru';
}

export const PluginsTab: React.FC<PluginsTabProps> = ({
  plugins,
  selectedPlugin,
  onSelectPlugin,
  loading,
  error,
  locale = 'en'
}) => {
  const { t } = useTranslations(locale);

  if (loading) {
    return (
      <div className="tab-content active">
        <h2>{t('options.plugins.title')}</h2>
        <div className="loading-state">
          <p>{t('options.plugins.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-content active">
        <h2>{t('options.plugins.title')}</h2>
        <div className="error-state">
          <p>{t('options.plugins.error')}: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content active">
      <h2>{t('options.plugins.title')}</h2>
      <div className="plugins-list">
        {plugins.map((plugin) => (
          <div 
            key={plugin.id}
            className={cn('plugin-item', selectedPlugin?.id === plugin.id && 'selected')}
            onClick={() => onSelectPlugin(plugin)}
          >
            <div className="plugin-info">
              <h3>{plugin.name}</h3>
              <p>{plugin.description}</p>
              <span className="plugin-version">{t('options.plugins.version', { version: plugin.version })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 