/**
 * core/host-api.js
 * 
 * API-мост для связи Python-кода с браузером.
 * Его главная задача — предоставить асинхронную функцию getActivePageContent.
 */

export const hostApi = {
    /**
     * Получает контент с активной в данный момент страницы.
     * Определяет, запущен ли код в контексте расширения, и действует соответственно.
     */
    getActivePageContent: async (selectors) => {
        // Проверяем, доступны ли API расширений Chrome.
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            // Мы работаем как расширение.
            console.log('[Host-API Bridge] Контекст расширения найден. Ищем активную вкладку...');
            
            // ШАГ 1: Явно запрашиваем у Chrome информацию об активной вкладке в текущем окне.
            // Это самый надежный способ получить ID цели для наших действий.
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!activeTab || !activeTab.id) {
                // Это может произойти, если попап открыт, но нет активного окна (например, все свернуто).
                console.error("[Host-API Bridge] Не удалось найти активную вкладку.");
                throw new Error("Не удалось найти активную вкладку.");
            }
            
            console.log(`[Host-API Bridge] Активная вкладка найдена: ID ${activeTab.id}. Отправка запроса в background.ts.`);

            // ШАГ 2: Отправляем сообщение фоновому скрипту, передавая ID цели.
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        source: "app-host-api",
                        command: "getActivePageContent",
                        targetTabId: activeTab.id, // Явно передаем ID вкладки.
                        data: selectors
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('[Host-API Bridge] Ошибка связи с background.ts:', chrome.runtime.lastError.message);
                            return reject(new Error(chrome.runtime.lastError.message));
                        }
                        if (response.error) {
                            console.error('[Host-API Bridge] Ошибка от background.ts:', response.error);
                            return reject(new Error(response.error));
                        }
                        
                        console.log('[Host-API Bridge] Получен РЕАЛЬНЫЙ ответ от background.ts:', response);
                        resolve(response);
                    }
                );
            });

        } else {
            // Мы работаем на сервере разработки (vite), где chrome.* API недоступны.
            // Возвращаем тестовые данные, чтобы можно было вести разработку UI.
            console.warn('[Host-API Bridge] Контекст расширения недоступен. Возвращаем мок-данные.');
            await new Promise(r => setTimeout(r, 200)); // Имитация задержки.
            return {
                title: "ЗАГЛУШКА (режим разработки)",
                content: "Это контент, полученный из заглушки в core/host-api.js, так как chrome.runtime недоступен.",
            };
        }
    },

    /**
     * Эта функция является частью контракта API, но ее реализация
     * будет добавлена в `window.hostApi` из файла `test-harness.js`.
     */
    sendMessageToChat: (message) => {}
};