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
 * Сохраняет данные об успешной попытке для данного хоста.
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
        
        const attemptData = {
            successful_attempt_number: attempt,
            success_timestamp: Math.floor(Date.now() / 1000)
        };

        stats[hostname].push(attemptData);
        // Опционально: можно ограничить размер массива, чтобы он не рос бесконечно
        // stats[hostname] = stats[hostname].slice(-100);
        await chrome.storage.local.set({ "fetch_stats": stats });
    } catch (e) {
        console.error("[Background] Не удалось сохранить статистику запросов:", e);
    }
}

/**
 * Проверяет, является ли объект валидной записью статистики.
 * Обеспечивает обратную совместимость и устойчивость к поврежденным данным.
 * @param statObject - Объект для проверки.
 * @returns true, если объект валиден, иначе false.
 */
function isValidStatObject(statObject: any): statObject is { successful_attempt_number: number, success_timestamp: number } {
    return (
        statObject &&
        typeof statObject === 'object' &&
        !Array.isArray(statObject) && // Убедимся, что это не массив
        typeof statObject.successful_attempt_number === 'number' &&
        typeof statObject.success_timestamp === 'number'
    );
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
    const hostStats: any[] = statsData.fetch_stats?.[hostname] || [];
    
    // Фильтруем статистику, чтобы отсеять невалидные или устаревшие записи.
    const validHostStats = hostStats.filter(isValidStatObject);

    const attemptNumbers = validHostStats.map(s => s.successful_attempt_number);
    const maxAttemptFromStats = attemptNumbers.length > 0 ? Math.max(...attemptNumbers) : 0;
    const retries = validHostStats.length > 0 ? Math.max(10, maxAttemptFromStats + 5) : 10;

    console.log(`[Background] Адаптивный fetch для ${hostname}. Попыток: ${retries}. Валидная статистика (номера попыток): [${attemptNumbers.join(', ')}]`);

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

            // Если это последняя попытка, запускаем финальную логику.
            if (attemptNum === retries) {
                console.error(`[Background] Все ${retries} попыток для ${url} провалились. Запускаем финальную проверку.`);
                
                // Новая логика: проверяем сеть и, если она в порядке, даем совет от LLM.
                try {
                    // Проверяем, доступен ли интернет в принципе.
                    await fetch("https://www.google.com", { method: 'HEAD', mode: 'no-cors' });
                    
                    // Если тест сети прошел, значит, проблема на стороне сервера.
                    console.log("[Background] Сеть в порядке. Проблема, вероятно, на стороне сервера. Запрашиваем совет у LLM...");
                    
                    // Передаем только валидную статистику
                    const advice = await hostApiImpl.getPredictiveConnectionAdvice({ hostname, stats: validHostStats });
                    const enhancedError = new Error(
                        `Сервис '${hostname}' недоступен после ${retries} попыток. Рекомендация: ${advice}`
                    );
                    throw enhancedError;

                } catch (finalError: any) {
                    // Если мы сами сгенерировали ошибку с советом, перебрасываем ее.
                    if (finalError.message.includes("Рекомендация:")) {
                        throw finalError;
                    }
                    
                    // Если же провалился тест сети, значит, проблема у пользователя.
                    console.error("[Background] Финальный тест сети провалился. Проблема с локальным подключением.");
                    throw new Error(`Все ${retries} попыток провалились, и проверка сети не удалась. Проверьте ваше интернет-соединение.`);
                }
            }

            // Экспоненциальная задержка перед следующей попыткой
            const delay = initialDelay * Math.pow(2, i);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Чистая функция для анализа массива статистики соединений.
 * @param stats - Массив объектов статистики.
 * @returns Объект с анализом по часам и дням недели.
 */
const analyze = (stats: { successful_attempt_number: number, success_timestamp: number }[]) => {
    const hourlyAttempts = new Array(24).fill(0);
    const dailyAttempts = new Array(7).fill(0);

    stats.forEach(stat => {
        const date = new Date(stat.success_timestamp * 1000);
        const hour = date.getHours();
        const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...

        hourlyAttempts[hour]++;
        dailyAttempts[day]++;
    });

    // Для простоты возвращаем общее количество успешных попыток по срезам.
    // В реальном приложении здесь могла бы быть более сложная логика для вычисления "среднего".
    return {
        bestHours: hourlyAttempts,
        bestDays: dailyAttempts,
    };
};


/**
 * Объект, содержащий логику для всех инструментов, доступных в Host-API.
 */
const hostApiImpl = {
  /**
   * (Имитация) Получает предиктивные рекомендации от LLM по поводу соединения.
   * @param hostname Имя хоста.
   * @param stats Собранная статистика по попыткам.
   */
  async getPredictiveConnectionAdvice({ hostname, stats }: { hostname: string, stats: any[] }): Promise<string> {
    console.log(`[Background] Запрос рекомендаций LLM для ${hostname}`);

    // 1. Формирование промпта для LLM
    const prompt = `
      Анализ стабильности соединения для хоста: ${hostname}.
      
      Вот история успешных подключений (в формате JSON):
      ${JSON.stringify(stats, null, 2)}

      Основываясь на этих данных, дай краткий (1-2 предложения) совет пользователю.
      Когда лучше всего пробовать подключиться? Есть ли какие-то паттерны?
      Например: "Лучшее время для подключения - рабочие часы, особенно после обеда. Избегайте подключения ранним утром."
      Ответ должен быть только текстом совета, без лишних фраз.
    `;

    console.log("[Background] Сформированный промпт для LLM:", prompt);

    // 2. Плейсхолдер для вызова LLM API
    // =======================================================================
    // TODO: ВСТАВИТЬ РЕАЛЬНЫЙ ВЫЗОВ LLM API (GEMINI FLASH) ЗДЕСЬ
    // Примерный код:
    // const apiKey = 'YOUR_GEMINI_API_KEY';
    // const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent?key=${apiKey}`;
    // const response = await fetch(apiUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    // });
    // const data = await response.json();
    // const advice = data.candidates[0].content.parts[0].text;
    // return advice;
    // =======================================================================
    
    // 3. Возвращаем моковый (заранее заготовленный) ответ
    const mockAdvice = "По нашим данным, соединение с этим сервисом наиболее стабильно в будние дни после полудня. Попробуйте повторить запрос в это время.";
    
    // Имитируем небольшую задержку, как при реальном API вызове
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log("[Background] Моковый ответ от LLM:", mockAdvice);
    return mockAdvice;
  },

  /**
   * Анализирует статистику соединений для заданного хоста.
   * @param hostname Имя хоста для анализа.
   */
  async analyzeConnectionStats({ hostname }: { hostname: string }): Promise<any> {
    try {
      console.log(`[Background] Анализ статистики для: ${hostname}`);
      const result = await chrome.storage.local.get("fetch_stats");
      const stats: any[] = result.fetch_stats?.[hostname] || [];
      
      // Фильтруем статистику перед анализом
      const validStats = stats.filter(isValidStatObject);

      if (validStats.length === 0) {
        return { bestHours: new Array(24).fill(0), bestDays: new Array(7).fill(0), message: "Статистика отсутствует или невалидна." };
      }

      // Используем чистую функцию для анализа
      return analyze(validStats);

    } catch (e: any) {
      console.error(`[Background] Ошибка в analyzeConnectionStats:`, e);
      return { error: e.message };
    }
  },

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

    case "analyzeConnectionStats":
      if (!data || !data.hostname) {
        sendResponse({ error: "Hostname was not provided." });
        return false;
      }
      hostApiImpl.analyzeConnectionStats(data).then(sendResponse);
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