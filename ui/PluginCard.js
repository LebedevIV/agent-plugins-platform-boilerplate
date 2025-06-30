/**
 * ui/PluginCard.js
 * 
 * Отвечает за создание DOM-элемента (карточки) для одного плагина.
 * Также вешает на карточку обработчик клика для запуска плагина.
 */

import { runTool } from '../bridge/mcp-bridge.js';

export function createPluginCard(plugin) {
    const card = document.createElement('div');
    card.className = 'plugin-card clickable'; 

    const icon = document.createElement('img');
    icon.className = 'plugin-icon';
    
    // --- ИСПРАВЛЕНИЕ ПУТИ К ИКОНКЕ ---
    // Наша сборка копирует папку 'public' целиком в 'dist'.
    // Поэтому все пути к ресурсам из нее должны начинаться с 'public/'.
    icon.src = `public/plugins/${plugin.id}/${plugin.icon}`;

    icon.alt = `${plugin.name} icon`;
    icon.onerror = () => {
        // Запасная иконка, если основная не загрузилась
        icon.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ccc"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-2 .9-2 2v3.81l-1.46 1.46c-.19.19-.3.44-.3.71V17c0 .55.45 1 1 1h3v3c0 1.1.9 2 2 2h3.81l1.46 1.46c.19.19.44.3.71.3H17c.55 0 1-.45 1-1v-3h3c1.1 0 2-.9 2-2v-3.81l1.46-1.46c.19-.19.3-.44.3-.71V12c0-.55-.45-1-1-1z"/></svg>`;
    };
    
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
    
    const originalIconSrc = icon.src; 
    const loaderIconSrc = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" class="plugin-loader" viewBox="0 0 24 24" fill="none" stroke="%23007bff" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;

    card.onclick = async () => {
        if (card.classList.contains('running')) return;

        console.log(`▶️ Запускается плагин: ${plugin.name}`);
        card.classList.add('running');
        icon.src = loaderIconSrc;
        
        try {
            const result = await runTool(
                plugin.id,
                'analyze-ozon-product',
                { page_url: 'https://www.ozon.ru/product/some-product-id' }
            );
            console.log(`✅ УСПЕХ от плагина ${plugin.name}:`);
            console.log(result);
        } catch (error) {
            console.error(`❌ ОШИБКА от плагина ${plugin.name}:`, error);
            alert(`Ошибка при выполнении плагина ${plugin.name}. Подробности в консоли (F12).`);
        } finally {
            card.classList.remove('running');
            icon.src = originalIconSrc;
        }
    };
    
    card.append(icon, content);
    return card;
}