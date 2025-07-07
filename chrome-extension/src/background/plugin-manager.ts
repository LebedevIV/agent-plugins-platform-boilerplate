/**
 * Plugin Manager for Agent-Plugins-Platform
 * Manages plugin discovery and loading
 */

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  main_server: string;
  host_permissions?: string[];
  permissions?: string[];
  icon?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  iconUrl: string;
  manifest: PluginManifest;
}

const PLUGIN_DIRS = ['ozon-analyzer', 'google-helper', 'test-plugin', 'time-test'];

export async function getAvailablePlugins(): Promise<Plugin[]> {
  const plugins: Plugin[] = [];
  
  for (const dirName of PLUGIN_DIRS) {
    try {
      const manifestUrl = chrome.runtime.getURL(`plugins/${dirName}/manifest.json`);
      const response = await fetch(manifestUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.statusText}`);
      }

      const manifest: PluginManifest = await response.json();
      
      plugins.push({
        id: dirName,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        icon: manifest.icon,
        iconUrl: chrome.runtime.getURL(`plugins/${dirName}/${manifest.icon || 'icon.svg'}`),
        manifest
      });

    } catch (error) {
      console.error(`Failed to load plugin from '${dirName}':`, error);
    }
  }
  
  return plugins;
}

export async function getPluginManifest(pluginId: string): Promise<PluginManifest | null> {
  try {
    const manifestUrl = chrome.runtime.getURL(`plugins/${pluginId}/manifest.json`);
    const response = await fetch(manifestUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to load manifest for plugin '${pluginId}':`, error);
    return null;
  }
} 