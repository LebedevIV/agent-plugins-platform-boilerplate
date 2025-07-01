/**
 * ui/PluginCard.js
 */

// Импортируем наш новый движок
export function createPluginCard(plugin) {
    const card = document.createElement('div');
    card.className = 'plugin-card clickable';
    const icon = document.createElement('img');
    icon.className = 'plugin-icon';
    if (plugin.icon) {
        icon.src = `public/plugins/${plugin.id}/${plugin.icon}`;
    }
    icon.alt = `${plugin.name} icon`;
    icon.onerror = () => { icon.src = `data:image/svg+xml;utf8,...`; }; // SVG-код заглушки
    const content = document.createElement('div');
    content.className = 'plugin-content';
    const header = document.createElement('div');
    header.className = 'plugin-header';
    const name = document.createElement('span');
    name.className = 'plugin-name';
    name.textContent = plugin.name;
    const version = document.createElement('span');
    version.className = 'plugin-version';
    version.textContent = `v${plugin.version}`;
    header.append(name, version);
    const description = document.createElement('p');
    description.className = 'plugin-description';
    description.textContent = plugin.description;
    content.append(header, description);
    card.append(icon, content);
    return card;
}