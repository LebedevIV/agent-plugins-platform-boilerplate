/**
 * core/host-api.js
 * 
 * API-мост для связи Python-кода с браузером.
 * Предоставляет JavaScript-инструменты, которые можно вызывать из воркфлоу.
 */

// --- Вспомогательные функции, вынесенные для чистоты кода ---

/**
 * Оборачивает chrome.runtime.sendMessage в Promise для удобства и централизованной обработки.
 * @param {object} message - Сообщение для отправки в background.ts.
 * @returns {Promise<any>}
 */
function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            // Добавляем обязательный источник ко всем сообщениям
            { source: "app-host-api", ...message },
            (response) => {
                // Обработка системных ошибок связи
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                // Обработка логических ошибок от background.ts
                if (response && response.error) {
                    return reject(new Error(response.error));
                }
                resolve(response);
            }
        );
    });
}

/**
 * Находит подходящую целевую вкладку (не страницу самого расширения),
 * используя логгер из переданного контекста для сообщений.
 * @param {object} context - Контекст выполнения воркфлоу, содержащий логгер.
 * @returns {Promise<chrome.tabs.Tab>}
 */
async function findTargetTab(context) {
    const logger = context.logger;
    logger.addMessage('HOST', 'Ищем целевую вкладку...');
    
    const allTabsInWindow = await chrome.tabs.query({ currentWindow: true });
    const selfUrl = chrome.runtime.getURL('index.html');
    
    const targetTab = allTabsInWindow.find(tab => 
        tab.url !== selfUrl && (tab.url?.startsWith('http') || tab.url?.startsWith('https'))
    );
    
    if (!targetTab) {
        const errorMsg = "Не найдена подходящая вкладка для анализа (откройте любой сайт в этом же окне).";
        logger.addMessage('ERROR', errorMsg);
        throw new Error(errorMsg);
    }
    
    logger.addMessage('HOST', `Целевая вкладка найдена: ${targetTab.url.substring(0, 70)}...`);
    return targetTab;
}

// --- Главный экспортируемый объект API ---
export const hostApi = {
    /**
     * Находит элементы по CSS-селектору и возвращает их текст или атрибут.
     * @param {object} options - Объект с опциями, например { selector: 'h2', attribute: 'innerText' }.
     * @param {object} context - Контекст выполнения воркфлоу, содержащий логгер.
     * @returns {Promise<string[]>}
     */
    getElements: async (options, context) => {
        // Проверяем, работаем ли мы в реальном расширении
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            const targetTab = await findTargetTab(context);
            context.logger.addMessage('HOST', `Выполняем парсинг по селектору "${options.selector}"...`);
            return sendMessageToBackground({
                command: "getElements",
                targetTabId: targetTab.id,
                data: options
            });
        } else {
            // Заглушка для режима разработки (vite)
            context.logger.addMessage('HOST', `ЗАГЛУШКА: Возвращаем мок-данные для селектора "${options.selector}".`);
            await new Promise(r => setTimeout(r, 150));
            return [`Мок-результат для "${options.selector}" 1`, `Мок-результат 2`];
        }
    },

    /**
     * Получает весь текстовый контент с целевой веб-страницы.
     * @param {object} selectors - В данный момент не используется, для совместимости.
     * @param {object} context - Контекст выполнения воркфлоу, содержит логгер.
     * @returns {Promise<object>}
     */
    getActivePageContent: async (selectors, context) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            const targetTab = await findTargetTab(context);
            context.logger.addMessage('HOST', `Получаем весь контент страницы...`);
            return sendMessageToBackground({
                command: "getActivePageContent",
                targetTabId: targetTab.id,
                data: selectors
            });
        } else {
            // Заглушка для режима разработки (vite)
            context.logger.addMessage('HOST', 'ЗАГЛУШКА: Возвращаем мок-данные для getActivePageContent.');
            await new Promise(r => setTimeout(r, 200));
            return { title: "ЗАГЛУШКА", content: "Это контент из заглушки." };
        }
    },

    /**
     * Эта функция НЕ вызывается движком напрямую. Она вызывается из Python.
     * Ее реальная реализация находится в `ui/test-harness.js`.
     * @param {object} message - Объект сообщения от Python, например { content: "..." }.
     */
    sendMessageToChat: (message) => {
        // Эта реализация-заглушка нужна только для того, чтобы функция существовала.
        // `window.hostApi.sendMessageToChat` в `test-harness.js` переопределит ее.
        console.warn("Вызвана заглушка sendMessageToChat в host-api.js.");
    }
};