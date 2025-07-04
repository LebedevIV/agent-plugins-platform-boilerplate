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

// ================================================================ //
// Адаптивный Механизм Запросов v2.0
// ================================================================ //

/**
 * Извлекает хостнейм из строки URL.
 * @param url - Строка URL.
 * @returns Хостнейм или null, если URL некорректен.
 */
function getHostname(url: string): string | null {
    try {
        return new URL(url).hostname;
    } catch (e) {
        console.error("[Background] Некорректный URL:", url);
        return null;
    }
}

/**
 * Сохраняет номер успешной попытки для данного хоста.
 * @param hostname - Хост, для которого сохраняется статистика.
 * @param attempt - Номер попытки (1-based), на которой запрос удался.
 */
async function saveSuccessfulAttempt(hostname: string, attempt: number): Promise<void> {
    try {
        const result = await chrome.storage.local.get("fetch_stats");
        const stats = result.fetch_stats || {};
        if (!stats[hostname]) {
            stats[hostname] = [];
        }
        stats[hostname].push(attempt);
        // Опционально: можно ограничить размер массива, чтобы он не рос бесконечно
        // stats[hostname] = stats[hostname].slice(-100);
        await chrome.storage.local.set({ "fetch_stats": stats });
    } catch (e) {
        console.error("[Background] Не удалось сохранить статистику запросов:", e);
    }
}

/**
 * "Адаптивный Механизм Запросов v2.0"
 * Выполняет сетевые запросы с адаптивным количеством попыток и проверкой сети.
 * @param url - URL для запроса.
 * @param options - Опции для fetch.
 * @param initialDelay - Начальная задержка в мс.
 */
async function fetchWithRetry(url: string, options: RequestInit = {}, initialDelay = 500) {
    const hostname = getHostname(url);
    if (!hostname) {
        throw new Error("Некорректный URL для выполнения запроса.");
    }

    // 1. Адаптивный расчет количества попыток
    const statsData = await chrome.storage.local.get("fetch_stats");
    const hostStats: number[] = statsData.fetch_stats?.[hostname] || [];
    const maxAttemptFromStats = hostStats.length > 0 ? Math.max(...hostStats) : 0;
    const retries = hostStats.length > 0 ? Math.max(10, maxAttemptFromStats + 5) : 10;

    console.log(`[Background] Адаптивный fetch для ${hostname}. Попыток: ${retries}. Статистика: [${hostStats.join(', ')}]`);

    for (let i = 0; i < retries; i++) {
        const attemptNum = i + 1;
        try {
            console.log(`[Background] Попытка #${attemptNum}/${retries} для: ${url}`);
            const response = await fetch(url, options);

            // Ошибки уровня HTTP (4xx, 5xx) не считаются сетевыми сбоями, прекращаем попытки.
            if (!response.ok) {
                throw new Error(`HTTP ошибка! Статус: ${response.status}`);
            }

            // Успех! Сохраняем статистику и возвращаем результат.
            await saveSuccessfulAttempt(hostname, attemptNum);
            console.log(`[Background] Успех на попытке #${attemptNum} для ${hostname}.`);
            return await response.json();

        } catch (error: any) {
            console.warn(`[Background] Ошибка на попытке #${attemptNum}:`, error.message);

            // 2. Проверка сетевого подключения после 5 неудач
            if (attemptNum === 5) {
                console.log("[Background] 5 попыток не удалось. Проверяем сетевое подключение...");
                try {
                    await fetch("https://www.google.com", { method: 'HEAD', mode: 'no-cors' });
                    console.log("[Background] Тест сети пройден. Продолжаем попытки.");
                } catch (networkTestError) {
                    console.error("[Background] Тест сети провалился. Прерываем запрос.", networkTestError);
                    throw new Error("Проблема с сетевым подключением");
                }
            }

            // Если это последняя попытка, выбрасываем ошибку.
            if (attemptNum === retries) {
                console.error(`[Background] Все ${retries} попыток для ${url} провалились. Сдаюсь.`);
                throw error;
            }

            // Экспоненциальная задержка перед следующей попыткой
            const delay = initialDelay * Math.pow(2, i);
            await new Promise(resolve => setTimeout(resolve, delay));
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
        
        // Оборачиваем вызов в try...catch, чтобы поймать ошибки до самого fetch
        (async () => {
            try {
                const jsonData = await fetchWithRetry(url);
                sendResponse({ error: false, data: jsonData });
            } catch (err: any) {
                console.error('[Background] КРИТИЧЕСКАЯ ОШИБКА в fetchWithRetry:', err);
                sendResponse({ error: true, error_message: err.message });
            }
        })();
        
        return true; // Асинхронный ответ

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