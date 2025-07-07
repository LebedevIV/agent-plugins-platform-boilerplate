import { useState, useEffect } from 'react';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  manifest?: {
    main_server: string;
    host_permissions?: string[];
    permissions?: string[];
  };
}

export const usePlugins = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load plugins on mount
  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await chrome.runtime.sendMessage({ type: 'GET_PLUGINS' });
      if (response) {
        setPlugins(response);
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
      setError('Ошибка загрузки плагинов');
    } finally {
      setLoading(false);
    }
  };

  const selectPlugin = (plugin: Plugin) => {
    setSelectedPlugin(plugin);
  };

  const clearSelection = () => {
    setSelectedPlugin(null);
  };

  return {
    plugins,
    selectedPlugin,
    loading,
    error,
    selectPlugin,
    clearSelection,
    reloadPlugins: loadPlugins
  };
}; 