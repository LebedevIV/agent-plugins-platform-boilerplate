const PLUGIN_DIRS = ['ozon-analyzer'];

export async function getAvailablePlugins() {
    const plugins = [];
    
    for (const dirName of PLUGIN_DIRS) {
        try {
            const manifestUrl = `/plugins/${dirName}/manifest.json`;
            const response = await fetch(manifestUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch manifest: ${response.statusText}`);
            }

            const manifest = await response.json();
            
            plugins.push({
                id: dirName,
                ...manifest,
                iconUrl: `/plugins/${dirName}/${manifest.icon}`
            });

        } catch (error) {
            console.error(`Failed to load plugin from '${dirName}':`, error);
        }
    }
    
    return plugins;
}