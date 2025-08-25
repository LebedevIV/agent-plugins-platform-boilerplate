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
  console.log('[plugin-manager] Starting getAvailablePlugins with dirs:', PLUGIN_DIRS);

  for (const dirName of PLUGIN_DIRS) {
    try {
      console.log(`[plugin-manager] Processing plugin: ${dirName}`);
      const manifestUrl = chrome.runtime.getURL(`plugins/${dirName}/manifest.json`);
      console.log(`[plugin-manager] Manifest URL for ${dirName}:`, manifestUrl);

      const response = await fetch(manifestUrl);
      console.log(`[plugin-manager] Fetch response for ${dirName}:`, response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.statusText}`);
      }

      const manifest: PluginManifest = await response.json();
      console.log(`[plugin-manager] Parsed manifest for ${dirName}:`, manifest);

      const plugin = {
        id: dirName,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        icon: manifest.icon,
        iconUrl: chrome.runtime.getURL(`plugins/${dirName}/${manifest.icon || 'icon.svg'}`),
        manifest
      };

      console.log(`[plugin-manager] Created plugin object for ${dirName}:`, plugin);
      plugins.push(plugin);

    } catch (error) {
      console.error(`[plugin-manager] Failed to load plugin from '${dirName}':`, error);
      console.error(`[plugin-manager] Error details for ${dirName}:`, {
        message: (error as Error).message,
        stack: (error as Error).stack
      });
    }
  }

  console.log('[plugin-manager] Final plugins array:', plugins);
  console.log('[plugin-manager] Returning', plugins.length, 'plugins');
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