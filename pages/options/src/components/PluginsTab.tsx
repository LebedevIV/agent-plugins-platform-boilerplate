import { useTranslations } from '../hooks/useTranslations';
import { cn } from '@extension/ui';
import { useEffect } from 'react';
import type { Plugin } from '../hooks/usePlugins';
import type React from 'react';

interface PluginsTabProps {
  plugins: Plugin[];
  selectedPlugin: Plugin | null;
  onSelectPlugin: (plugin: Plugin) => void;
  loading: boolean;
  error: string | null;
  locale?: 'en' | 'ru';
  onUpdatePluginSetting?: (pluginId: string, setting: string, value: boolean) => Promise<void>;
}

export const PluginsTab: React.FC<PluginsTabProps> = ({
  plugins,
  selectedPlugin,
  onSelectPlugin,
  loading,
  error,
  locale = 'en',
  onUpdatePluginSetting,
}) => {
  const { t } = useTranslations(locale);

  // Select first plugin if nothing is selected
  useEffect(() => {
    if (plugins.length > 0 && !selectedPlugin) {
      onSelectPlugin(plugins[0]);
    }
  }, [plugins, selectedPlugin, onSelectPlugin]);

  // Убираем лишние логи для предотвращения бесконечных циклов

  if (loading) return <p>Загрузка...</p>;
  if (error) return <p>Ошибка: {error}</p>;
  if (!plugins) return <p>Ошибка: plugins равен null или undefined</p>;
  if (!Array.isArray(plugins)) {
    return <p>Ошибка: plugins не является массивом. plugins = {JSON.stringify(plugins)}</p>;
  }
  if (plugins.length === 0) {
    return <p>Нет доступных плагинов.</p>;
  }

  const handlePluginClick = (plugin: Plugin) => {
    onSelectPlugin(plugin);
    console.log(`[PluginsTab] Selected plugin:`, plugin);
  };

  const renderPlugins = () => {
    try {
      return plugins.map(plugin => {
        const enabled = plugin.settings?.enabled ?? true;
        return (
          <div
            key={plugin.id}
            className={cn('plugin-item', selectedPlugin?.id === plugin.id && 'selected')}
            onClick={() => handlePluginClick(plugin)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handlePluginClick(plugin);
              }
            }}
            role="button"
            tabIndex={0}>
            <div className="plugin-info">
              <h3>{plugin.name}</h3>
              <p>{plugin.description}</p>
              <span className="plugin-version">v{plugin.version}</span>
              <span className={cn('status-badge', enabled ? 'status-active' : 'status-inactive')}>
                {enabled ? 'Активен' : 'Неактивен'}
              </span>
            </div>
            {onUpdatePluginSetting && (
              <button
                className={cn('btn', enabled ? 'btn-secondary' : 'btn-primary')}
                onClick={e => {
                  e.stopPropagation();
                  onUpdatePluginSetting(plugin.id, 'enabled', !enabled);
                }}>
                {enabled ? 'Отключить' : 'Включить'}
              </button>
            )}
          </div>
        );
      });
    } catch (e) {
      console.error('[PluginsTab] Ошибка при рендеринге списка плагинов:', e);
      return <p>Ошибка при отображении плагинов: {(e as Error).message}</p>;
    }
  };

  return (
    <>
      <h2>{t('options.plugins.title')}</h2>
      <div className="plugins-list">{renderPlugins()}</div>
    </>
  );
};
