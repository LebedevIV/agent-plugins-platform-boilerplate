/**
 * ui/test-harness.js
 * Главный скрипт для нашего UI (index.html).
 */

import { getAvailablePlugins } from '../core/plugin-manager.js';
import { createPluginCard } from './PluginCard.js';
import { hostApi } from '../core/host-api.js';
import { runWorkflow } from '../core/workflow-engine.js';

// --- Глобальная переменная для хранения "активного" логгера ---
// Движок будет устанавливать ее, а hostApi.sendMessageToChat - использовать.
window.activeWorkflowLogger = null;

// --- Инициализация глобального Host-API ---
window.hostApi = hostApi;

// Переопределяем sendMessageToChat, чтобы он использовал активный логгер
window.hostApi.sendMessageToChat = (message) => {
    if (window.activeWorkflowLogger) {
        // Добавляем сообщение от Python в текущий активный лог
        window.activeWorkflowLogger.addMessage('PYTHON', message.content);
    } else {
        // Фоллбэк, если по какой-то причине логгер не был установлен
        console.warn("[Python Message] Логгер не активен:", message.content);
        const chatLog = document.getElementById('chat-log');
        if (chatLog) chatLog.textContent += `[PY] ${message.content}\n`;
    }
};

console.log('Тестовый стенд инициализирован (v0.6.0).');

// --- Основная логика ---

// Централизованная функция для запуска плагина
async function handlePluginRun(plugin) {
    const card = document.querySelector(`.plugin-card[data-plugin-id="${plugin.id}"]`);
    if (!card || card.classList.contains('running')) return;
    
    // UI-реакция на запуск
    card.classList.add('running');
    const icon = card.querySelector('.plugin-icon');
    const originalIconSrc = icon.src;
    icon.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" class="plugin-loader" viewBox="0 0 24 24" fill="none" stroke="%23007bff" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;
    
    try {
        // Вызываем наш движок. Он сам создаст логгер и установит window.activeWorkflowLogger.
        await runWorkflow(plugin.id);
    } catch (error) {
        console.error(`--- КРИТИЧЕСКАЯ ОШИБКА при выполнении плагина ${plugin.name}:`, error);
        if (window.activeWorkflowLogger) {
            window.activeWorkflowLogger.addMessage('ERROR', `Критическая ошибка: ${error.message}`);
        }
    } finally {
        // Возвращаем UI в исходное состояние
        card.classList.remove('running');
        icon.src = originalIconSrc;
        // Сбрасываем активный логгер. Это ВАЖНО.
        window.activeWorkflowLogger = null;
    }
}

// Отображение плагинов
async function displayPlugins() {
    const pluginsListContainer = document.getElementById('plugins-list');
    if (!pluginsListContainer) return;
    
    try {
        const plugins = await getAvailablePlugins();
        pluginsListContainer.innerHTML = '';
        plugins.forEach(plugin => {
            const pluginCard = createPluginCard(plugin);
            // Добавляем атрибут, чтобы мы могли найти эту карточку
            pluginCard.dataset.pluginId = plugin.id;
            // Назначаем наш централизованный обработчик клика
            pluginCard.onclick = () => handlePluginRun(plugin);
            pluginsListContainer.appendChild(pluginCard);
        });
    } catch (error) {
        pluginsListContainer.textContent = `Ошибка при загрузке плагинов: ${error.message}`;
        console.error("Ошибка в displayPlugins:", error);
    }
}

// Настройка вкладок
function setupTabs() {
  const tabContainer = document.querySelector('.tab-nav');
  if (!tabContainer) return;
  tabContainer.addEventListener('click', (event) => {
    const clickedButton = event.target.closest('.tab-button');
    if (!clickedButton) return;
    const tabId = clickedButton.dataset.tab;
    if (!tabId) return;
    tabContainer.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    clickedButton.classList.add('active');
    document.getElementById(tabId)?.classList.remove('hidden');
  });
}

// --- Запускаем все при загрузке страницы ---
displayPlugins();
setupTabs();