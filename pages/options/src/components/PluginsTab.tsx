import { useTranslations } from '../hooks/useTranslations';
import { useEffect } from 'react';
import type { Plugin } from '../hooks/usePlugins';
import LoadingSpinner from './LoadingSpinner';
import ErrorDisplay from './ErrorDisplay';
import PluginCard from './PluginCard';
// import PluginCard from './PluginCard'; // если потребуется локальная реализация

interface PluginsTabProps {
  plugins: Plugin[];
  selectedPlugin: Plugin | null;
  onSelectPlugin: (plugin: Plugin) => void;
  loading: boolean;
  error: string | null;
  locale?: 'en' | 'ru';
}

const PluginsTab = function ({
  plugins,
  selectedPlugin,
  onSelectPlugin,
  loading,
  error,
  locale = 'en',
}: PluginsTabProps) {
  const { t } = useTranslations(locale);

  useEffect(() => {
    if (plugins.length > 0 && !selectedPlugin) {
      onSelectPlugin(plugins[0]);
    }
  }, [plugins, selectedPlugin, onSelectPlugin]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={{ message: error }} />;
  if (!plugins) return <ErrorDisplay error={{ message: 'plugins равен null или undefined' }} />;
  if (!Array.isArray(plugins)) {
    return <ErrorDisplay error={{ message: `plugins не является массивом. plugins = ${JSON.stringify(plugins)}` }} />;
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
      return plugins.map(plugin => (
        <PluginCard
          key={plugin.id}
          plugin={plugin}
          selected={selectedPlugin?.id === plugin.id}
          onClick={() => handlePluginClick(plugin)}
        />
      ));
    } catch (e) {
      return <ErrorDisplay error={e as Error} />;
    }
  };

  return (
    <>
      <h2>{t('options.plugins.title')}</h2>
      <div className="plugins-list">{renderPlugins()}</div>
    </>
  );
};
export { PluginsTab };
