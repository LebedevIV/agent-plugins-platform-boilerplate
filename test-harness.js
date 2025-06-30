/**
 * test-harness.js
 * 
 * Главный скрипт для нашего UI (index.html).
 * Его задачи:
 * 1. Найти и отобразить все доступные плагины.
 * 2. Собрать и инициализировать глобальный объект `window.hostApi`,
 *    который будет использоваться мостом к Python.
 */

// Импортируем все необходимые модули
import { getAvailablePlugins } from './core/plugin-manager.js';
import { createPluginCard } from './ui/PluginCard.js';
import { hostApi } from './core/host-api.js'; // <-- ВАЖНО: импортируем наш API-мост

// --- Инициализация глобального Host-API ---
// Мы комбинируем API из разных частей:
// 1. Берем за основу `hostApi` из `core/host-api.js` - он содержит
//    функцию `getActivePageContent`, которая умеет общаться с background.js.
window.hostApi = hostApi;

// 2. Добавляем (или переопределяем) функцию `sendMessageToChat`.
//    Эта функция должна быть здесь, потому что только этот скрипт имеет
//    прямой доступ к DOM-элементам `index.html`.
window.hostApi.sendMessageToChat = (message) => {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return; // Защита на случай, если элемент чата не найден

    // Очищаем стартовое сообщение, если это первое сообщение от плагина
    if (chatLog.textContent.includes('Ожидание запуска плагина...')) {
        chatLog.textContent = '';
    }

    const messageElement = document.createElement('div');
    // Формируем красивое сообщение для лога
    messageElement.textContent = `[PY] [${new Date().toLocaleTimeString()}] ${message.content}`;
    chatLog.appendChild(messageElement);
    // Автоматически прокручиваем лог вниз
    chatLog.scrollTop = chatLog.scrollHeight;
};

console.log('Тестовый стенд инициализирован.');

// --- Основная логика отображения плагинов ---
const pluginsListContainer = document.getElementById('plugins-list');

async function displayPlugins() {
    try {
        const plugins = await getAvailablePlugins();
        if (plugins.length === 0) {
            pluginsListContainer.textContent = 'Плагины не найдены.';
            return;
        }
        pluginsListContainer.innerHTML = ''; // Очищаем "Загрузка..."
        plugins.forEach(plugin => {
            // Для каждого найденного плагина создаем и добавляем его карточку
            const pluginCard = createPluginCard(plugin);
            pluginsListContainer.appendChild(pluginCard);
        });
    } catch (error) {
        pluginsListContainer.textContent = 'Ошибка при загрузке плагинов.';
        console.error(error);
    }
}

// Запускаем отображение плагинов при загрузке страницы
displayPlugins();