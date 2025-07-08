const PLUGIN_DIRS = ['ozon-analyzer', 'google-helper', 'test-plugin', 'time-test'];

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
                name: manifest.name,
                version: manifest.version,
                description: manifest.description,
                iconUrl: `/plugins/${dirName}/${manifest.icon}`,
                manifest
            });

        } catch (error) {
            console.error(`Failed to load plugin from '${dirName}':`, error);
        }
    }
    
    return plugins;
}