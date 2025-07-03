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
    getElements: async (options, context) => { /* ... код без изменений ... */ },
    getActivePageContent: async (selectors, context) => { /* ... код без изменений ... */ },
    
    host_fetch: async (url) => {
        // Просто пересылаем задачу в background, который имеет все права
        return sendMessageToBackground({
            command: "host_fetch",
            data: { url }
        });
    },

    sendMessageToChat: (message) => {
        if (window.activeWorkflowLogger) {
            window.activeWorkflowLogger.addMessage('PYTHON', message.content);
        } else {
            console.warn("[Python Message] Логгер не активен:", message.content);
        }
    }
};