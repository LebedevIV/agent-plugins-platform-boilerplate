/**
 * src/background.ts
 * 
 * Фоновый скрипт (Service Worker) нашего расширения.
 * Он обрабатывает запросы от UI и выполняет действия с помощью chrome.* API,
 * а также управляет поведением иконки расширения.
 */

console.log("APP Background Script Loaded (v0.3.0).");

//================================================================//
//  1. РЕАЛИЗАЦИЯ HOST API (ДЛЯ ВЗАИМОДЕЙСТВИЯ С PYTHON)
//================================================================//

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

//================================================================//
//  2. СЛУШАТЕЛЬ СООБЩЕНИЙ ОТ UI
//================================================================//

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Игнорируем сообщения, которые не относятся к нашему API.
  if (request.source !== "app-host-api") {
    return;
  }

  const { command, data, targetTabId } = request;
  
  console.log(`[Background] Получена команда '${command}' для вкладки ${targetTabId}.`);

  if (command === "getActivePageContent") {
    // Используем ID вкладки, который нам явно передали в сообщении.
    if (!targetTabId) {
      sendResponse({ error: "Target tab ID was not provided in the message." });
      return; 
    }

    hostApiImpl.getActivePageContent(targetTabId).then(sendResponse);
    
    // Возвращаем `true` для асинхронного ответа.
    return true;
  }

  // Обработка неизвестных команд
  sendResponse({ error: `Unknown command: ${command}` });
});


//================================================================//
//  3. ОБРАБОТЧИК КЛИКА ПО ИКОНКЕ РАСШИРЕНИЯ (НОВЫЙ КОД)
//================================================================//

chrome.action.onClicked.addListener((tab) => {
  // URL нашей главной страницы управления. 
  // `chrome.runtime.getURL` создает полный, правильный путь к файлу
  // внутри расширения, например: chrome-extension://<ID>/index.html
  const platformPageUrl = chrome.runtime.getURL('index.html');

  // Ищем, не открыта ли уже наша страница, чтобы не создавать дубликаты.
  chrome.tabs.query({ url: platformPageUrl }, (tabs) => {
    if (tabs.length > 0) {
      // Если вкладка найдена, активируем ее и ее окно.
      chrome.tabs.update(tabs[0].id!, { active: true });
      if (tabs[0].windowId) {
          chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    } else {
      // Если вкладка не найдена, создаем новую.
      chrome.tabs.create({ url: platformPageUrl });
    }
  });
});