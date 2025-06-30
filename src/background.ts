/**
 * src/background.ts
 * 
 * Фоновый скрипт (Service Worker) нашего расширения.
 * Он обрабатывает запросы от UI и выполняет действия с помощью chrome.* API.
 */

console.log("APP Background Script Loaded (v0.2.4).");

/**
 * Объект с реализацией реальных действий.
 */
const hostApiImpl = {
  /**
   * Выполняет скрипт на указанной вкладке для получения ее содержимого.
   * @param tabId ID вкладки, на которой нужно выполнить скрипт.
   */
  async getActivePageContent(tabId: number): Promise<any> {
    try {
      console.log(`[Background] Выполняем executeScript для вкладки ${tabId}...`);
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        // Эта функция будет сериализована, отправлена на страницу и выполнена там.
        func: () => ({
          title: document.title,
          content: document.body.innerText.substring(0, 5000) // Ограничиваем объем.
        }),
      });

      if (results && results[0] && results[0].result) {
        console.log(`[Background] Успешно получили контент со вкладки ${tabId}.`);
        return results[0].result;
      } else {
        console.warn(`[Background] Не получили результат от executeScript для вкладки ${tabId}.`);
        return { error: "Could not retrieve content from the page." };
      }
    } catch (e: any) {
      console.error(`[Background] Ошибка при выполнении executeScript для вкладки ${tabId}:`, e);
      return { error: e.message };
    }
  },
};

/**
 * Главный слушатель сообщений.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Игнорируем сообщения, которые не относятся к нашему API.
  if (request.source !== "app-host-api") {
    return;
  }

  const { command, data, targetTabId } = request;
  
  console.log(`[Background] Получена команда '${command}' для вкладки ${targetTabId}.`);

  if (command === "getActivePageContent") {
    // Теперь мы используем ID вкладки, который нам явно передали в сообщении.
    if (!targetTabId) {
      sendResponse({ error: "Target tab ID was not provided in the message." });
      return; // Отвечаем синхронно, поэтому `true` не нужно.
    }

    // Вызываем нашу асихронную функцию, передавая ей колбэк sendResponse
    hostApiImpl.getActivePageContent(targetTabId).then(sendResponse);
    
    // Возвращаем `true`, чтобы сообщить Chrome, что ответ будет асинхронным.
    // Это КЛЮЧЕВОЙ момент для асинхронных `onMessage` листенеров.
    return true;
  }

  // Обработка неизвестных команд
  sendResponse({ error: `Unknown command: ${command}` });
});