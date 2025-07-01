/**
 * core/host-api.js
 * 
 * API-мост для связи Python-кода с браузером.
 * Предоставляет JavaScript-инструменты, которые можно вызывать из воркфлоу.
 */

export const hostApi = {
    /**
     * Получает весь текстовый контент с целевой веб-страницы.
     * @param {object} selectors - В данный момент не используется, для совместимости.
     * @returns {Promise<object>} - Promise с объектом { title, content }.
     */
    getActivePageContent: async (selectors) => {
        // Логика этой функции остается без изменений
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            const targetTab = await findTargetTab();
            if (!targetTab) throw new Error("Целевая вкладка не найдена.");

            console.log(`[Host-API Bridge] getActivePageContent -> URL: "${targetTab.url}". Отправка запроса...`);
            return sendMessageToBackground({
                command: "getActivePageContent",
                targetTabId: targetTab.id,
                data: selectors
            });
        } else {
            // Заглушка для разработки
            console.warn('[Host-API Bridge] Контекст расширения недоступен. Возвращаем мок-данные для getActivePageContent.');
            await new Promise(r => setTimeout(r, 200));
            return {
                title: "ЗАГЛУШКА (режим разработки)",
                content: "Это контент из заглушки в core/host-api.js.",
            };
        }
    },

    // --- ▼▼▼ НАШ НОВЫЙ ИНСТРУМЕНТ ▼▼▼ ---
    /**
     * Находит элементы по CSS-селектору и возвращает их текст или атрибут.
     * @param {object} options - Объект с опциями, например { selector: 'h2', attribute: 'innerText' }.
     * @returns {Promise<string[]>} - Promise с массивом строк.
     */
    getElements: async (options) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            const targetTab = await findTargetTab();
            if (!targetTab) throw new Error("Целевая вкладка не найдена.");

            console.log(`[Host-API Bridge] getElements -> URL: "${targetTab.url}". Опции:`, options);
            return sendMessageToBackground({
                command: "getElements", // Новая команда
                targetTabId: targetTab.id,
                data: options // Передаем опции (селектор и атрибут)
            });
        } else {
            // Заглушка для разработки
            console.warn('[Host-API Bridge] Контекст расширения недоступен. Возвращаем мок-данные для getElements.');
            await new Promise(r => setTimeout(r, 150));
            return [`Мок-результат для селектора "${options.selector}" 1`, `Мок-результат 2`];
        }
    },
    // --- ▲▲▲ КОНЕЦ НОВОГО ИНСТРУМЕНТА ▲▲▲ ---


    /**
     * Эта функция является частью контракта API, но ее реализация
     * "внедряется" в объект window.hostApi из файла test-harness.js.
     */
    sendMessageToChat: (message) => {}
};


// --- Вспомогательные функции для чистоты кода ---

/**
 * Находит подходящую целевую вкладку (не страницу самого расширения).
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
async function findTargetTab() {
    console.log('[Host-API Bridge] Ищем целевую вкладку...');
    const allTabsInWindow = await chrome.tabs.query({ currentWindow: true });
    const selfUrl = chrome.runtime.getURL('index.html');
    
    const targetTab = allTabsInWindow.find(tab => 
        tab.url !== selfUrl && (tab.url?.startsWith('http') || tab.url?.startsWith('https'))
    );
    
    if (!targetTab) {
        console.error("[Host-API Bridge] Не удалось найти подходящую целевую вкладку (откройте любой сайт).");
        alert("Ошибка: Не найдена вкладка для анализа. Пожалуйста, откройте любой сайт (например, wikipedia.org) в этом же окне.");
        return null;
    }
    return targetTab;
}

/**
 * Оборачивает chrome.runtime.sendMessage в Promise для удобства.
 * @param {object} message - Сообщение для отправки в background.ts.
 * @returns {Promise<any>}
 */
function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            // Добавляем обязательный источник ко всем сообщениям
            { source: "app-host-api", ...message },
            (response) => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                if (response && response.error) {
                    return reject(new Error(response.error));
                }
                resolve(response);
            }
        );
    });
}