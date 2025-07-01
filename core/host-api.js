/**
 * core/host-api.js
 */

export const hostApi = {
    getActivePageContent: async (selectors) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            console.log('[Host-API Bridge] Контекст расширения найден. Ищем целевую вкладку...');
            
            const allTabsInWindow = await chrome.tabs.query({ currentWindow: true });
            const selfUrl = chrome.runtime.getURL('index.html');
            const targetTab = allTabsInWindow.find(tab => 
                tab.url !== selfUrl && (tab.url?.startsWith('http') || tab.url?.startsWith('https'))
            );
            
            if (!targetTab || !targetTab.id) {
                console.error("[Host-API Bridge] Не удалось найти подходящую целевую вкладку (откройте любой сайт).");
                alert("Ошибка: Не найдена вкладка для анализа. Пожалуйста, откройте любой сайт (например, wikipedia.org) в этом же окне.");
                throw new Error("Не удалось найти подходящую целевую вкладку.");
            }
            
            // --- ▼▼▼ УЛУЧШЕННЫЙ ЛОГ ▼▼▼ ---
            console.log(`[Host-API Bridge] Целевая вкладка найдена: ID ${targetTab.id}, URL: "${targetTab.url}". Отправка запроса...`);
            // --- ▲▲▲ КОНЕЦ УЛУЧШЕННОГО ЛОГА ▲▲▲ ---

            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        source: "app-host-api",
                        command: "getActivePageContent",
                        targetTabId: targetTab.id,
                        data: selectors
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            return reject(new Error(chrome.runtime.lastError.message));
                        }
                        if (response.error) {
                            // --- ▼▼▼ УЛУЧШЕННЫЙ ЛОГ ОШИБКИ ▼▼▼ ---
                            const errorMsg = `Ошибка от background.ts при работе с URL "${targetTab.url}": ${response.error}`;
                            console.error(`[Host-API Bridge] ${errorMsg}`);
                            return reject(new Error(errorMsg));
                            // --- ▲▲▲ КОНЕЦ УЛУЧШЕННОГО ЛОГА ОШИБКИ ▲▲▲ ---
                        }
                        
                        console.log('[Host-API Bridge] Получен РЕАЛЬНЫЙ ответ от background.ts:', response);
                        resolve(response);
                    }
                );
            });

        } else {
            console.warn('[Host-API Bridge] Контекст расширения недоступен. Возвращаем мок-данные.');
            await new Promise(r => setTimeout(r, 200));
            return {
                title: "ЗАГЛУШКА (режим разработки)",
                content: "Это контент из заглушки.",
            };
        }
    },
    sendMessageToChat: (message) => {}
};