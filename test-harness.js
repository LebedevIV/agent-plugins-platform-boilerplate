// Импортируем только то, что нужно для отображения карточек плагинов
import { getAvailablePlugins } from './core/plugin-manager.js';
import { createPluginCard } from './ui/PluginCard.js';

// --- Глобальная ЗАГЛУШКА для Host-API ---
// Это критически важная часть. Наш Pyodide-мост (mcp-bridge.js) ищет
// глобальный объект `window.hostApi`, чтобы передать его в Python.
// Мы создаем этот объект здесь, чтобы все работало.
window.hostApi = {
    /**
     * Отправляет сообщение от Python-плагина в наш UI-чат.
     */
    sendMessageToChat: (message) => {
        const chatLog = document.getElementById('chat-log');
        if (!chatLog) return; // Защита на случай, если элемент чата не найден

        // Очищаем стартовое сообщение "Ожидание...", если это первое сообщение
        if (chatLog.textContent === 'Ожидание запуска плагина...') {
            chatLog.textContent = '';
        }

        const messageElement = document.createElement('div');
        // Формируем красивое сообщение для лога
        messageElement.textContent = `[PY] [${new Date().toLocaleTimeString()}] ${message.content}`;
        chatLog.appendChild(messageElement);
        // Автоматически прокручиваем лог вниз, чтобы видеть последние сообщения
        chatLog.scrollTop = chatLog.scrollHeight;
    },
    
    /**
     * Имитирует получение данных с веб-страницы.
     * Возвращает Promise, как это делал бы настоящий асинхронный API.
     */
    getActivePageContent: async (selectors) => {
        console.log('[Host-API заглушка] Python запросил контент страницы с селекторами:', selectors);
        // Имитируем небольшую сетевую задержку для реалистичности
        await new Promise(r => setTimeout(r, 200)); 
        // Возвращаем тестовые данные
        return {
            title: "Заголовок из ЗАГЛУШКИ",
            price: "9999 RUB",
            reviews_count: 123
        };
    }
};

console.log('Тестовый стенд инициализирован.');


// --- Основная функция для отображения карточек плагинов ---
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


// --- Запускаем отображение плагинов при загрузке страницы ---
displayPlugins();