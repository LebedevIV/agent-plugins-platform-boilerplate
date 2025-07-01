/**
 * ui/test-harness.js
 * 
 * Главный скрипт для нашего UI (index.html).
 * Его задачи:
 * 1. Управлять UI (переключение вкладок).
 * 2. Найти и отобразить все доступные плагины.
 * 3. Собрать и инициализировать глобальный объект `window.hostApi`.
 */

// Импортируем все необходимые модули
import { getAvailablePlugins } from '../core/plugin-manager.js';
import { createPluginCard } from './PluginCard.js';
import { hostApi } from '../core/host-api.js';

// --- Функция для настройки логики вкладок ---
function setupTabs() {
  const tabContainer = document.querySelector('.tab-nav');
  if (!tabContainer) return; // Защита, если навигации нет

  const tabButtons = tabContainer.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabContainer.addEventListener('click', (event) => {
    const clickedButton = event.target.closest('.tab-button');
    if (!clickedButton) return; // Клик был не по кнопке

    const tabId = clickedButton.dataset.tab;
    if (!tabId) return;

    // Убираем активность со всех кнопок и контента
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.add('hidden'));

    // Добавляем активность нужной кнопке и контенту
    clickedButton.classList.add('active');
    const activeContent = document.getElementById(tabId);
    if (activeContent) {
      activeContent.classList.remove('hidden');
    }
  });
}

// --- Инициализация глобального Host-API ---
// 1. Берем за основу `hostApi` из `core/host-api.js` (с getActivePageContent, getElements).
window.hostApi = hostApi;

// 2. Добавляем функцию `sendMessageToChat`, которая работает с DOM этой страницы.
window.hostApi.sendMessageToChat = (message) => {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return;

    if (chatLog.textContent.includes('Ожидание запуска плагина...')) {
        chatLog.textContent = '';
    }

    const messageElement = document.createElement('div');
    messageElement.textContent = `[PY] [${new Date().toLocaleTimeString()}] ${message.content}`;
    chatLog.appendChild(messageElement);
    chatLog.scrollTop = chatLog.scrollHeight;
};

console.log('Тестовый стенд инициализирован (v0.5.0).');

// --- Основная логика отображения плагинов ---
const pluginsListContainer = document.getElementById('plugins-list');

async function displayPlugins() {
    if (!pluginsListContainer) return;
    try {
        const plugins = await getAvailablePlugins();
        if (plugins.length === 0) {
            pluginsListContainer.textContent = 'Плагины не найдены.';
            return;
        }
        pluginsListContainer.innerHTML = ''; // Очищаем "Загрузка..."
        plugins.forEach(plugin => {
            const pluginCard = createPluginCard(plugin);
            pluginsListContainer.appendChild(pluginCard);
        });
    } catch (error) {
        pluginsListContainer.textContent = 'Ошибка при загрузке плагинов.';
        console.error("Ошибка в displayPlugins:", error);
    }
}

// --- Запускаем все при загрузке страницы ---
displayPlugins();
setupTabs();