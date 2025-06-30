const chatLog = document.getElementById('chat-log');

// Это наш "мозг" хоста. В будущем он будет общаться с NanoBrowser.
export const hostApi = {
    /**
     * Получает контент с активной страницы (сейчас возвращает заглушку).
     */
    getActivePageContent: async (selectors) => {
        console.log('[Host API] getActivePageContent вызван с селекторами:', selectors);
        await new Promise(r => setTimeout(r, 200)); // Имитация задержки
        return {
            title: "Тестовый товар с Ozon",
            price: "5999 RUB",
            reviews_count: 150
        };
    },

    /**
     * Отправляет сообщение в UI.
     * Принимает объект вида { content: "..." }
     */
    sendMessageToChat: (message) => {
        console.log('[Host API] sendMessageToChat вызван с сообщением:', message);
        if (!chatLog) return; // Защита, если элемент не найден

        // Очищаем "Ожидание...", если это первое сообщение
        if (chatLog.textContent === 'Ожидание запуска плагина...') {
            chatLog.textContent = '';
        }

        const messageElement = document.createElement('div');
        // Берем текст из свойства .content
        messageElement.textContent = `[${new Date().toLocaleTimeString()}] ${message.content}`;
        chatLog.appendChild(messageElement);
        // Автоматически прокручиваем вниз
        chatLog.scrollTop = chatLog.scrollHeight;
    }
};