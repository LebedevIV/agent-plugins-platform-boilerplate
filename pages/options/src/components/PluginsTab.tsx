import { PluginCard } from '../../../../packages/ui/lib/components/PluginCard';
import { useTranslations } from '../hooks/useTranslations';
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
          <PluginCard
            key={plugin.id}
            id={plugin.id}
            name={plugin.name}
            version={plugin.version}
            description={plugin.description}
            icon={plugin.icon}
            iconUrl={plugin.iconUrl}
            enabled={enabled}
            selected={selectedPlugin?.id === plugin.id}
            onClick={() => handlePluginClick(plugin)}
            onToggle={
              onUpdatePluginSetting ? enabled => onUpdatePluginSetting(plugin.id, 'enabled', enabled) : undefined
            }
          />
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
