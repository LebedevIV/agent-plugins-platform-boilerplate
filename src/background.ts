/**
 * src/background.ts
 * 
 * Фоновый скрипт (Service Worker) нашего расширения.
 * Он является "мозгом" Host-API, обрабатывая запросы от UI,
 * выполняя привилегированные действия (например, доступ к вкладкам)
 * и управляя поведением иконки расширения.
 */

console.log("APP Background Script Loaded (v0.9.0 - Resilient Fetch).");

//================================================================//
//  1. РЕАЛИЗАЦИЯ HOST API
//================================================================//

/**
 * Новая, отказоустойчивая функция для выполнения сетевых запросов.
 * Делает несколько попыток с увеличивающейся задержкой при сетевых сбоях.
 * @param url - URL для запроса.
 * @param options - Опции для fetch.
 * @param retries - Количество попыток.
 * @param delay - Начальная задержка в миллисекундах.
 */
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 10, delay = 500) {
  for (let i = 0; i < retries; i++) {
      try {
          console.log(`[Background] Попытка #${i + 1} для fetch: ${url}`);
          const response = await fetch(url, options);
          if (!response.ok) {
              // Если статус 4xx или 5xx, это ошибка сервера, повторять бессмысленно.
              throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return await response.json(); // Успех!
      } catch (error) {
          // Ловим сетевые ошибки (Failed to fetch, ERR_CONNECTION_CLOSED)
          const isLastAttempt = i === retries - 1;
          console.warn(`[Background] Ошибка на попытке #${i + 1}:`, error.message);
          if (isLastAttempt) {
              // Если это была последняя попытка, пробрасываем ошибку дальше.
              console.error(`[Background] Все ${retries} попыток провалились. Сдаюсь.`);
              throw error;
          }
          // Ждем перед следующей попыткой, увеличивая задержку (экспоненциальный рост)
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
  }
}

/**
 * Объект, содержащий логику для всех инструментов, доступных в Host-API.
 */
const hostApiImpl = {
  /**
   * Получает базовый контент (заголовок и весь текст) со страницы.
   * @param tabId ID вкладки для анализа.
   */
  async getActivePageContent(tabId: number): Promise<any> {
    try {
      console.log(`[Background] Выполняем getActivePageContent для вкладки ${tabId}...`);
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => ({
          title: document.title,
          content: document.body.innerText,
        }),
      });

      if (results && results[0]) {
        return results[0].result;
      }
      return { error: "Could not retrieve content." };
    } catch (e: any) {
      console.error(`[Background] Ошибка в getActivePageContent:`, e);
      return { error: e.message };
    }
  },

  /**
   * Находит элементы по CSS-селектору и извлекает их текст или атрибут.
   * @param tabId ID целевой вкладки.
   * @param options Опции парсинга.
   */
  async getElements(tabId: number, options: { selector: string; attribute: string }): Promise<any> {
    try {
      console.log(`[Background] Выполняем getElements для вкладки ${tabId} с селектором "${options.selector}"`);
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        args: [options],
        func: (opts) => {
          const elements = document.querySelectorAll(opts.selector);
          return Array.from(elements).map(el => {
            if (opts.attribute === 'textContent' || opts.attribute === 'innerText') {
              return (el as HTMLElement).textContent?.trim() || '';
            }
            if (opts.attribute === 'innerHTML') {
                return el.innerHTML;
            }
            return el.getAttribute(opts.attribute);
          });
        },
      });

      if (results && results[0]) {
        return results[0].result;
      }
      return [];
    } catch (e: any) {
      console.error(`[Background] Ошибка в getElements:`, e);
      return { error: e.message };
    }
  }
};

//================================================================//
//  2. ГЛАВНЫЙ СЛУШАТЕЛЬ СООБЩЕНИЙ
//================================================================//

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ваш вариант `return;` правильнее для краткости. Я вернул его.
  if (request.source !== "app-host-api") return;

  const { command, data, targetTabId } = request;
  console.log(`[Background] Получена команда '${command}' для вкладки ${targetTabId || 'N/A'}.`);

  // Маршрутизация команд
  switch (command) {
    case "getActivePageContent":
      if (!targetTabId) {
        sendResponse({ error: "Target tab ID was not provided." });
        return false;
      }
      hostApiImpl.getActivePageContent(targetTabId).then(sendResponse);
      return true;

    case "getElements":
      if (!targetTabId) {
        sendResponse({ error: "Target tab ID was not provided." });
        return false;
      }
      hostApiImpl.getElements(targetTabId, data).then(sendResponse);
      return true;

    case "host_fetch":
      const url = data.url;
      console.log(`[Background] Получена задача на отказоустойчивый fetch для: ${url}`);
      // Вызываем нашу новую умную функцию
      fetchWithRetry(url)
          .then(jsonData => {
              sendResponse({ error: false, data: jsonData });
          })
          .catch(err => {
              sendResponse({ error: true, error_message: err.message });
          });
      return true;

    default:
      sendResponse({ error: `Unknown command: ${command}` });
      return false;
  }
});

//================================================================//
//  3. ОБРАБОТЧИК КЛИКА ПО ИКОНКЕ РАСШИРЕНИЯ
//================================================================//

chrome.action.onClicked.addListener((tab) => {
  const platformPageUrl = chrome.runtime.getURL('index.html');
  chrome.tabs.query({ url: platformPageUrl }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id!, { active: true });
      if (tabs[0].windowId) {
          chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    } else {
      chrome.tabs.create({ url: platformPageUrl });
    }
  });
});