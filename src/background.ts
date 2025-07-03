/**
 * src/background.ts
 * 
 * Фоновый скрипт (Service Worker) нашего расширения.
 * Он является "мозгом" Host-API, обрабатывая запросы от UI,
 * выполняя привилегированные действия (например, доступ к вкладкам)
 * и управляя поведением иконки расширения.
 */

console.log("APP Background Script Loaded (v0.4.1).");

//================================================================//
//  1. РЕАЛИЗАЦИЯ HOST API
//================================================================//

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
          content: document.body.innerText, // innerText здесь подходит для общего контента.
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
   * @param options Опции парсинга, например { selector: 'h2', attribute: 'innerText' }
   */
  async getElements(tabId: number, options: { selector: string; attribute: string }): Promise<any> {
    try {
      console.log(`[Background] Выполняем getElements для вкладки ${tabId} с селектором "${options.selector}"`);
      
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        // Передаем опции как аргумент в функцию, которая будет выполнена на странице
        args: [options],
        func: (opts) => {
          // Этот код выполняется в контексте целевой веб-страницы
          const elements = document.querySelectorAll(opts.selector);

          // Превращаем NodeList в массив и извлекаем данные для каждого элемента
          return Array.from(elements).map(el => {
            // Используем textContent для более надежного извлечения всего текста
            // внутри элемента, игнорируя CSS стили (например, display: none).
            if (opts.attribute === 'textContent' || opts.attribute === 'innerText') {
              return (el as HTMLElement).textContent?.trim() || ''; // .trim() для удаления лишних пробелов
            }
            if (opts.attribute === 'innerHTML') {
                return el.innerHTML;
            }
            // В противном случае, пытаемся получить указанный атрибут (href, src, data-*, и т.д.)
            return el.getAttribute(opts.attribute);
          });
        },
      });

      // executeScript всегда возвращает массив, нам нужен первый результат
      if (results && results[0]) {
        return results[0].result;
      }
      return []; // Если ничего не найдено, возвращаем пустой массив
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
  // Игнорируем сообщения, которые не относятся к нашему API.
  if (request.source !== "app-host-api") return;

  const { command, data, targetTabId } = request;
  console.log(`[Background] Получена команда '${command}' для вкладки ${targetTabId}.`);

  // Маршрутизация команды к соответствующей функции в hostApiImpl
  if (command === "getActivePageContent") {
    if (!targetTabId) {
      sendResponse({ error: "Target tab ID was not provided." });
      return;
    }
    hostApiImpl.getActivePageContent(targetTabId).then(sendResponse);
    return true; // Сообщаем Chrome, что ответ будет асинхронным
  }
  
  if (command === "getElements") {
    if (!targetTabId) {
      sendResponse({ error: "Target tab ID was not provided." });
      return;
    }
    hostApiImpl.getElements(targetTabId, data).then(sendResponse);
    return true; // Сообщаем Chrome, что ответ будет асинхронным
  }

  if (command === "host_fetch") {
    const url = data.url;
    console.log(`[Background] Выполняем делегированный fetch для: ${url}`);
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(jsonData => {
            // --- ▼▼▼ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ ▼▼▼ ---
            // Успешный ответ. Просто отправляем данные.
            sendResponse(jsonData);
            // --- ▲▲▲ КОНЕЦ ИЗМЕНЕНИЯ ▲▲▲ ---
        })
        .catch(err => {
            // Ошибочный ответ. Отправляем объект с полем error.
            sendResponse({ error: true, error_message: err.message });
        });
        
    return true; // Асинхронный ответ
  }
  // Если команда не найдена
  sendResponse({ error: `Unknown command: ${command}` });
});

//================================================================//
//  3. ОБРАБОТЧИК КЛИКА ПО ИКОНКЕ РАСШИРЕНИЯ
//================================================================//

chrome.action.onClicked.addListener((tab) => {
  // URL нашей главной страницы управления.
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