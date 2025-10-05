/**
 * Offscreen Document Handler for Direct Pyodide Testing
 * Handles direct Python code execution in offscreen context
 */

/**
 * Offscreen Document Handler for Direct Pyodide Testing
 * Handles direct Python code execution in offscreen context
 * Supports chunked HTML data transfer for large documents
 */
// Маппинг типов анализа на технические имена моделей
const ANALYSIS_TYPE_MAPPING = {
  'basic_analysis': 'gemini-flash',
  'detailed_comparison': 'gemini-pro',
  'deep_analysis': 'gemini-pro',
  'scraping_fallback': 'gemini-flash',
  'compliance_check': 'gemini-flash'
};

// Маппинг технических имён на конкретные модели API
const MODEL_NAME_MAPPING = {
  'gemini-flash': 'gemini-flash-lite-latest:generateContent',
  'gemini-pro': 'gemini-2.5-pro:generateContent'
};

// === CHUNKING HTML DATA RECEIVER ===

// Global state for chunked HTML transfers
const htmlTransfers = new Map();

// Глобальное хранилище для HTML данных из HTML_DIRECT сообщений
const htmlDirectStorage = new Map();

// Функция очистки устаревших HTML_DIRECT записей
function cleanupHtmlDirectStorage() {
  const now = Date.now();
  const expiredThreshold = 300000; // 5 минут таймаут
  const expiredTransfers = [];

  for (const [transferId, data] of htmlDirectStorage.entries()) {
    if (now - data.timestamp > expiredThreshold) {
      expiredTransfers.push(transferId);
    }
  }

  expiredTransfers.forEach(transferId => {
    htmlDirectStorage.delete(transferId);
  });

  if (expiredTransfers.length > 0) {
    logDebug('SYSTEM', `Очищено ${expiredTransfers.length} устаревших HTML_DIRECT записей`);
  }
}

// Обработчик HTML_DIRECT сообщений
async function handleHtmlDirect(message) {
   logDebug('HTML_DIRECT', `HTML_DIRECT сообщение получено: transferId=${message.transferId}, pluginId=${message.pluginId}, htmlLength=${message.htmlData?.length || 0}`);

   // Сохраняем HTML данные в глобальное хранилище
   htmlDirectStorage.set(message.transferId, {
     html: message.htmlData,
     pluginId: message.pluginId,
     pageKey: message.pageKey,
     requestId: message.requestId,
     timestamp: Date.now()
   });

   // Отправляем подтверждение получения
   try {
     chrome.runtime.sendMessage({
       type: 'CONFIRM_HTML_RECEIPT',
       transferId: message.transferId,
       timestamp: Date.now()
     });
     logDebug('HTML_DIRECT', `Подтверждение отправлено для ${message.transferId}`);
   } catch (error) {
     logError('HTML_DIRECT', `Ошибка отправки подтверждения:`, error);
   }
}

let pyodide = null;

// Глобальные переменные для хранения текущих pluginId и pageKey
let currentPluginId = 'ozon-analyzer';
let currentPageKey = 'unknown_page';

// Глобальная переменная для хранения текущей функции отправки ответа
let globalSendResponse = null;

// Переменная для отслеживания retry попыток в sendMessageToChat
let retryCount = 0;

// Глобальные переменные для лучшей коммуникации между JS и Python
let currentExecutionContext = {
  pluginId: 'ozon-analyzer',
  pageKey: 'unknown_page',
  requestId: null,
  geminiApiKey: null,
  messageId: null
};

// Функция для обновления контекста выполнения
function updateExecutionContext(updates) {
  Object.assign(currentExecutionContext, updates);
  logDebug('PYODIDE', 'Execution context updated:', currentExecutionContext);
}

// Функция для безопасного получения контекста выполнения
function getExecutionContext() {
  return { ...currentExecutionContext };
}

// Константы для улучшения стабильности ответов
const RESPONSE_DELAY = 100; // 100мс задержка перед отправкой ответа
const MAX_RESPONSE_RETRIES = 3; // Максимум попыток отправки ответа

// Глобальная функция trackSendResponse для использования вне обработчика сообщений
async function trackSendResponse(response, options = {}) {
  const {
    delay = RESPONSE_DELAY,
    retries = MAX_RESPONSE_RETRIES,
    silent = false
  } = options;

  logDebug('RESPONSE', `Sending response via global tracker: success=${response?.success}, delay=${delay}ms`);

  if (!globalSendResponse || typeof globalSendResponse !== 'function') {
    if (!silent) {
      logWarn('RESPONSE', `⚠️ Global sendResponse not available, response not sent`);
    }
    return false;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Небольшая задержка для стабильности
      if (delay > 0 && attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Проверяем что функция все еще доступна
      if (!globalSendResponse || typeof globalSendResponse !== 'function') {
        if (!silent) {
          logWarn('RESPONSE', `⚠️ Global sendResponse became unavailable during retry ${attempt}`);
        }
        return false;
      }

      logInfo('RESPONSE', `✅ Global response sent successfully (attempt ${attempt + 1})`);
      globalSendResponse(response);
      return true;

    } catch (error) {
      if (!silent) {
        logError('RESPONSE', `❌ Global response send failed (attempt ${attempt + 1}/${retries + 1}):`, error);
      }

      if (attempt < retries) {
        // Ждем перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        continue;
      }
    }
  }

  if (!silent) {
    logError('RESPONSE', `❌ All response send attempts failed after ${retries + 1} tries`);
  }
  return false;
}

// === WORKFLOW EXECUTION SYSTEM ===
// Убрана логика предотвращения дублирования для гарантированного выполнения каждого workflow

// === LOGGING SYSTEM ===

// Логирование уровни
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Текущий уровень логирования (ОТКЛЮЧЕНО для максимальной экономии токенов)
let currentLogLevel = 999; // Уровень выше всех возможных, полностью отключает логирование

// Флаги для разных типов логирования (все отключены для экономии токенов)
const LOG_FLAGS = {
  CHUNKING: false,
  PYODIDE: false,
  EXECUTION: false,
  CHANNEL: false,
  SYSTEM: false,
  HTML_DIRECT: false
};

// Троттлинг для повторяющихся логов
const logThrottleMap = new Map();
const LOG_THROTTLE_INTERVAL = 5000; // 5 секунд

// Оптимизированная функция логирования
function logMessage(level, category, message, ...args) {
  // Проверка уровня логирования
  if (level > currentLogLevel) {
    return;
  }

  // Проверка флагов категории
  if (!LOG_FLAGS[category]) {
    return;
  }

  // Троттлинг для повторяющихся сообщений
  const throttleKey = `${level}-${category}-${message}`;
  const now = Date.now();

  if (logThrottleMap.has(throttleKey)) {
    const lastLog = logThrottleMap.get(throttleKey);
    if (now - lastLog < LOG_THROTTLE_INTERVAL) {
      return;
    }
  }

  logThrottleMap.set(throttleKey, now);

  // Форматирование сообщения
  const prefix = `[${category.toLowerCase()}]`;
  const fullMessage = `${prefix} ${message}`;

  // Выбор метода логирования
  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error(fullMessage, ...args);
      break;
    case LOG_LEVELS.WARN:
      console.warn(fullMessage, ...args);
      break;
    case LOG_LEVELS.INFO:
      console.log(fullMessage, ...args);
      break;
    case LOG_LEVELS.DEBUG:
      console.debug(fullMessage, ...args);
      break;
  }
}

// Вспомогательные функции для разных уровней
function logError(category, message, ...args) {
  logMessage(LOG_LEVELS.ERROR, category, message, ...args);
}

function logWarn(category, message, ...args) {
  logMessage(LOG_LEVELS.WARN, category, message, ...args);
}

function logInfo(category, message, ...args) {
  logMessage(LOG_LEVELS.INFO, category, message, ...args);
}

function logDebug(category, message, ...args) {
  logMessage(LOG_LEVELS.DEBUG, category, message, ...args);
}

// Функция для изменения уровня логирования (для отладки)
function setLogLevel(level) {
  if (typeof level === 'string') {
    currentLogLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
  } else {
    currentLogLevel = level;
  }
  logInfo('SYSTEM', `Log level set to: ${Object.keys(LOG_LEVELS)[currentLogLevel]}`);
}

// Функция для изменения флагов логирования
function setLogFlag(category, enabled) {
  LOG_FLAGS[category] = enabled;
  logInfo('SYSTEM', `Log flag ${category}: ${enabled}`);
}

// === CHANNEL SAFETY UTILITIES ===

// Глобальная переменная для предотвращения спама логов ошибок
let lastChannelErrorLog = 0;
const LOG_THROTTLE_MS = 5000; // 5 секунд между логами

// Проверка доступности chrome.runtime
function isChromeRuntimeAvailable() {
  return !!(chrome && chrome.runtime && chrome.runtime.sendMessage);
}

// Безопасная отправка сообщения с проверками и логированием
async function safeSendMessage(message, options = {}) {
  const {
    timeout = 15000, // Увеличен до 15 секунд таймаут
    retries = 2,     // Увеличено до 2 повторных попыток по умолчанию
    retryDelay = 1000,
    silent = false
  } = options;

  // Генерируем новый messageId для каждого retry с форматом pyodide_${timestamp}_${retryCount}_${randomId}
  const messageId = `pyodide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const messageWithId = { ...message, messageId };

  if (!isChromeRuntimeAvailable()) {
    if (!silent) {
      const now = Date.now();
      if (now - lastChannelErrorLog > LOG_THROTTLE_MS) {
        console.warn('[offscreen][CHANNEL] chrome.runtime not available, skipping message:', message.type, 'ID:', messageId);
        lastChannelErrorLog = now;
      }
    }
    return { success: false, error: 'chrome.runtime not available' };
  }

  let lastAttempt = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        // Генерируем НОВЫЙ messageId для каждого retry
        const retryMessageId = `pyodide_${Date.now()}_${attempt}_${Math.random().toString(36).substr(2, 9)}`;
        const retryMessageWithId = { ...message, messageId: retryMessageId };

        logDebug('CHANNEL', `Retry attempt ${attempt}/${retries} with new messageId ${retryMessageId} (${message.type})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        const sendPromise = new Promise((resolve, reject) => {
          try {
            chrome.runtime.sendMessage(retryMessageWithId, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          } catch (error) {
            reject(error);
          }
        });

        if (timeout > 0) {
          const timeoutPromise = new Promise((_, reject) => {
            const timeoutId = setTimeout(() => {
              logWarn('CHANNEL', `Message timeout after ${timeout}ms for type: ${message.type}, ID: ${retryMessageId}`);
              reject(new Error(`Message send timeout after ${timeout}ms`));
            }, timeout);
            // Очистка таймера при успешном выполнении
            return () => clearTimeout(timeoutId);
          });
          lastAttempt = await Promise.race([sendPromise, timeoutPromise]);
        } else {
          lastAttempt = await sendPromise;
        }

        logDebug('CHANNEL', `Retry message sent successfully: ${message.type}, ID: ${retryMessageId}`);
        return { success: true, response: lastAttempt };
      }

      // Первая попытка с оригинальным messageId
      const sendPromise = new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(messageWithId, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        } catch (error) {
          reject(error);
        }
      });

      if (timeout > 0) {
        const timeoutPromise = new Promise((_, reject) => {
          const timeoutId = setTimeout(() => {
            logWarn('CHANNEL', `Message timeout after ${timeout}ms for type: ${message.type}, ID: ${messageId}`);
            reject(new Error(`Message send timeout after ${timeout}ms`));
          }, timeout);
          // Очистка таймера при успешном выполнении
          return () => clearTimeout(timeoutId);
        });
        lastAttempt = await Promise.race([sendPromise, timeoutPromise]);
      } else {
        lastAttempt = await sendPromise;
      }

      // logDebug('CHANNEL', `Message sent successfully: ${message.type}, ID: ${messageId}`);
      return { success: true, response: lastAttempt };

    } catch (error) {
      lastAttempt = error;

      if (!silent) {
        const now = Date.now();
        if (now - lastChannelErrorLog > LOG_THROTTLE_MS) {
          console.error(`[offscreen][CHANNEL] Message send failed (attempt ${attempt + 1}/${retries + 1}):`, error.message, `ID: ${messageId}`);
          lastChannelErrorLog = now;
        }
      }

      if (attempt < retries) {
        continue; // Попробовать еще раз
      }
    }
  }

  return { success: false, error: lastAttempt?.message || 'Unknown error' };
}

// Синхронная версия для простых случаев (без таймаута)
function safeSendMessageSync(message, silent = false) {
  if (!isChromeRuntimeAvailable()) {
    if (!silent) {
      const now = Date.now();
      if (now - lastChannelErrorLog > LOG_THROTTLE_MS) {
        console.warn('[offscreen][CHANNEL] chrome.runtime not available, skipping sync message:', message.type);
        lastChannelErrorLog = now;
      }
    }
    return { success: false, error: 'chrome.runtime not available' };
  }

  try {
    chrome.runtime.sendMessage(message);
    return { success: true };
  } catch (error) {
    if (!silent) {
      const now = Date.now();
      if (now - lastChannelErrorLog > LOG_THROTTLE_MS) {
        console.error('[offscreen][CHANNEL] Sync message send failed:', error.message);
        lastChannelErrorLog = now;
      }
    }
    return { success: false, error: error.message };
  }
}

// Initialize Pyodide when the offscreen document loads
async function initializePyodide() {
  if (pyodide) {
    logDebug('EXECUTION', 'Pyodide already initialized');
    return pyodide;
  }

  try {
    logInfo('PYODIDE', 'Starting Pyodide initialization...');

    // Load Pyodide
    const script = document.createElement('script');
    script.src = './pyodide/pyodide.js';
    document.head.appendChild(script);

    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
    });

    // Initialize Pyodide instance
    pyodide = await window.loadPyodide({
      indexURL: './pyodide/',
      jsglobals: window
    });

    logInfo('PYODIDE', 'Pyodide initialized successfully');

    // Setup js bridge for Python scripts compatibility
    logInfo('PYODIDE', 'Setting up js bridge for Python scripts...');

    // Создаем улучшенный js bridge с лучшей обработкой контекста
    const jsBridge = {
      // Функция для обновления контекста выполнения
      updateContext: (context) => {
        updateExecutionContext(context);
        logDebug('PYODIDE', 'Context updated from Python:', context);
        return true;
      },

      // Функция для получения текущего контекста
      getContext: () => {
        const context = getExecutionContext();
        logDebug('PYODIDE', 'Context requested by Python:', context);
        return context;
      },

      sendMessageToChat: (message) => {
        logDebug('PYODIDE', 'JS bridge attempting to send message');
        try {
          const jsMessage = message.toJs ? message.toJs({ dict_converter: Object.fromEntries }) : message;

          // Исправление: правильно обрабатываем объект с полем content
          let content;
          if (typeof jsMessage === 'string') {
            content = jsMessage;
          } else if (jsMessage && typeof jsMessage === 'object' && jsMessage.content) {
            content = jsMessage.content;
          } else {
            content = JSON.stringify(jsMessage);
          }

          // Асинхронная отправка с Promise и таймаутом для предотвращения ошибок каналов
          const messageId = `pyodide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          // logInfo('PYODIDE', `sendMessageToChat starting for messageId: ${messageId}, content length: ${content.length}`);

          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              logError('PYODIDE', `sendMessageToChat timeout after 30s for messageId: ${messageId}, pluginId: ${currentPluginId}, pageKey: ${currentPageKey}`);
              logError('PYODIDE', `Timeout details: content length=${content.length}, type=${typeof content}`);
              resolve({ success: false, error: 'Timeout after 30 seconds' });
            }, 30000); // 30 секунд таймаут

            try {
              const pyodideMessage = {
                type: 'PYODIDE_MESSAGE',
                messageId: messageId,
                pluginId: currentPluginId,
                pageKey: currentPageKey,
                message: {
                  role: 'plugin',
                  content: content,
                  timestamp: Date.now()
                }
              };

              // Проверка доступности chrome.runtime
              if (!chrome.runtime || !chrome.runtime.sendMessage) {
                clearTimeout(timeoutId);
                logError('PYODIDE', 'chrome.runtime.sendMessage not available');
                resolve({ success: false, error: 'chrome.runtime.sendMessage not available' });
                return;
              }

              chrome.runtime.sendMessage(pyodideMessage, (response) => {
                clearTimeout(timeoutId);
                if (chrome.runtime.lastError) {
                  logError('PYODIDE', 'Promise rejected in sendMessageToChat:', chrome.runtime.lastError.message);
                  resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  // logDebug('PYODIDE', 'Message sent successfully');
                  resolve({ success: true, data: response });
                }
              });
            } catch (error) {
              clearTimeout(timeoutId);
              logError('PYODIDE', 'Unexpected error in sendMessageToChat:', error);
              resolve({ success: false, error: error.message });
            }
          });
        } catch (error) {
          logError('PYODIDE', 'Unexpected error in sendMessageToChat:', error);
          return Promise.resolve({ success: false, error: error.message });
        }
      },

      // Функция для повторных попыток отправки сообщений
      sendWithRetry: async (content, messageId, currentPluginId, currentPageKey, retryAttempt) => {
        // logDebug('PYODIDE', `sendWithRetry called with attempt ${retryAttempt + 1}/3 for messageId: ${messageId}`);

        // Сброс retryCount для новой попытки
        const originalRetryCount = retryCount;
        retryCount = retryAttempt;

        const maxRetries = 3;
        const currentAttempt = retryAttempt + 1;

        try {
          // Проверяем доступность js bridge
          const jsBridge = pyodide.globals.get('js');
          if (!jsBridge || typeof jsBridge.sendMessageToChat !== 'function') {
            throw new Error('sendMessageToChat not available in js bridge');
          }

          // logDebug('PYODIDE', `sendWithRetry: Attempting to send message, attempt ${currentAttempt}/${maxRetries}`);

          // Попытка отправки сообщения
          const result = await jsBridge.sendMessageToChat(content);

          // logInfo('PYODIDE', `sendWithRetry completed successfully on attempt ${currentAttempt} for messageId: ${messageId}`);
          return result;

        } catch (error) {
          // logError('PYODIDE', `sendWithRetry failed on attempt ${currentAttempt}/${maxRetries} for messageId: ${messageId}:`, error);

          // Восстанавливаем оригинальное значение retryCount
          retryCount = originalRetryCount;

          // Улучшенная обработка ошибок с экспоненциальной задержкой
          if (currentAttempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryAttempt), 10000); // Экспоненциальная задержка, максимум 10 секунд
            // logInfo('PYODIDE', `Retrying after ${delay}ms, attempt ${currentAttempt + 1}/${maxRetries}`);

            await new Promise(resolve => setTimeout(resolve, delay));

            try {
              // Проверяем, что js bridge все еще доступен
              const jsBridge = pyodide.globals.get('js');
              if (jsBridge && typeof jsBridge.sendMessageToChat === 'function') {
                // Рекурсивный вызов с увеличенным счетчиком попыток
                return await sendWithRetry(content, messageId, currentPluginId, currentPageKey, retryAttempt + 1);
              } else {
                throw new Error('js bridge became unavailable during retry');
              }
            } catch (retryError) {
              logError('PYODIDE', `Retry attempt ${currentAttempt + 1} also failed:`, retryError);

              // Если это последняя попытка, пробрасываем ошибку
              if (currentAttempt >= maxRetries) {
                throw new Error(`All ${maxRetries} retry attempts failed. Last error: ${retryError.message}`);
              }

              throw retryError;
            }
          }

          // Все попытки исчерпаны
          // logError('PYODIDE', `All ${maxRetries} retry attempts exhausted for messageId: ${messageId}`);
          throw new Error(`sendWithRetry failed after ${maxRetries} attempts: ${error.message}`);
        }
      },
      host_fetch: (url) => {
        logDebug('PYODIDE', 'host_fetch called:', url);
        const jsUrl = url.toJs ? url.toJs() : url;
        return fetch(jsUrl)
          .then(response => response.text())
          .then(data => pyodide.toPy(data));
      },
      llm_call: async (modelAlias, options) => {
        logDebug('PYODIDE', 'llm_call called:', { modelAlias, options: options?.toJs ? options.toJs() : options });

        try {
          const jsOptions = options?.toJs ? options.toJs() : options;
          const jsModelAlias = modelAlias?.toJs ? modelAlias.toJs() : modelAlias;

          // 1. Обработка modelAlias - убрать :generateContent если присутствует
          const cleanedModelAlias = jsModelAlias.replace(':generateContent', '');
          logDebug('PYODIDE', `Cleaned model alias: ${cleanedModelAlias}`);

          // Преобразовать тип анализа в техническое имя модели
          const technicalModelName = ANALYSIS_TYPE_MAPPING[cleanedModelAlias] || cleanedModelAlias;

          // Преобразовать техническое имя в конкретную модель API
          const finalModelName = MODEL_NAME_MAPPING[technicalModelName] || technicalModelName;

          logDebug('PYODIDE', `Model mapping: ${cleanedModelAlias} -> ${technicalModelName} -> ${finalModelName}`);

          // 2. Получение API ключа из параметров или глобальной переменной
          let apiKey = jsOptions.apiKey;

          // Если API ключ не передан в параметрах, пытаемся получить из глобальной переменной
          if (!apiKey) {
            apiKey = window.geminiApiKey;
          }

          // Если API ключ все еще не найден, возвращаем понятное сообщение об ошибке
          if (!apiKey) {
            throw new Error('Gemini API key not provided. Please ensure the API key is configured in the extension settings and passed to the LLM call.');
          }

          logDebug('PYODIDE', 'Gemini API key retrieved successfully');

          // 3. Подготовка данных для запроса к Gemini API
          const requestBody = {
            contents: [{
              parts: [{
                text: jsOptions.prompt || jsOptions.message || JSON.stringify(jsOptions)
              }]
            }],
            generationConfig: {
              temperature: jsOptions.temperature || 0.7,
              topK: jsOptions.topK || 40,
              topP: jsOptions.topP || 0.95,
              maxOutputTokens: jsOptions.maxOutputTokens || 1024,
              stopSequences: jsOptions.stopSequences || []
            }
          };

          // 4. HTTP запрос к Gemini API - исправление двойной подстановки :generateContent
          // Проверяем, содержит ли finalModelName уже :generateContent
          let urlModelName = finalModelName;
          if (!finalModelName.includes(':generateContent')) {
            // Добавляем :generateContent только если его нет
            urlModelName = `${finalModelName}:generateContent`;
          }

          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${urlModelName}?key=${apiKey}`;

          logDebug('PYODIDE', `Making request to Gemini API: ${geminiUrl}`);

          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${errorData}`);
          }

          const responseData = await response.json();
          logDebug('PYODIDE', 'Gemini API response received successfully');

          // 5. Обработка ответа от Gemini API
          if (!responseData.candidates || !responseData.candidates[0] || !responseData.candidates[0].content) {
            throw new Error('Invalid response format from Gemini API');
          }

          const generatedText = responseData.candidates[0].content.parts
            .map(part => part.text)
            .join('');

          if (!generatedText) {
            throw new Error('No text generated by Gemini API');
          }

          logDebug('PYODIDE', `LLM call completed successfully, response length: ${generatedText.length}`);

          // ВОЗВРАЩАЕМ РЕЗУЛЬТАТ С ДОПОЛНИТЕЛЬНОЙ ИНФОРМАЦИЕЙ ДЛЯ ДИАГНОСТИКИ
          const resultObject = {
            result: generatedText,
            model: cleanedModelAlias,
            response_length: generatedText.length,
            raw_response: responseData
          };

          return pyodide.toPy(resultObject);

        } catch (error) {
          logError('PYODIDE', 'LLM call failed:', error);

          // Graceful fallback - возвращаем понятное сообщение об ошибке
          const errorMessage = error.message.includes('API key not found')
            ? 'Gemini API key not configured. Please set your API key in the extension settings.'
            : `Gemini API call failed: ${error.message}`;

          return pyodide.toPy({ error: errorMessage });
        }
      },
      get_setting: (settingName, defaultValue, category) => {
        logDebug('PYODIDE', 'get_setting called:', { settingName, defaultValue, category });
        const jsSettingName = settingName?.toJs ? settingName.toJs() : settingName;
        const jsDefaultValue = defaultValue?.toJs ? defaultValue.toJs() : defaultValue;
        const jsCategory = category?.toJs ? category.toJs() : category;

        // For offscreen context, return default value
        logDebug('PYODIDE', 'Returning default value for setting:', jsSettingName, jsDefaultValue);
        return Promise.resolve(pyodide.toPy(jsDefaultValue));
      },

      // Функция для логирования ошибок из Python
      logError: (message, error) => {
        logError('PYTHON', `Python error: ${message}`, error?.toJs ? error.toJs() : error);
        return true;
      },

      // Функция для логирования из Python
      logInfo: (message) => {
        logInfo('PYTHON', `Python log: ${message}`);
        return true;
      },

      // Функция для логирования напрямую в консоль из Python
      consoleLog: (message) => {
        console.log(`[PYTHON_LOG] ${message}`);
        return true;
      }
    };

    // Устанавливаем js bridge в глобальные переменные Pyodide
    pyodide.globals.set('js', jsBridge);

    // Делаем sendWithRetry доступной в глобальном контексте для Python кода
    pyodide.globals.set('sendWithRetry', jsBridge.sendWithRetry);

    logInfo('PYODIDE', 'js bridge setup completed');

    // DEBUG: Verify js bridge is properly set
    logDebug('PYODIDE', 'Verifying js bridge setup...');
    try {
      const jsObj = pyodide.globals.get('js');
      logDebug('PYODIDE', 'js object available:', jsObj ? 'YES' : 'NO');
      if (jsObj) {
        const jsKeys = Object.keys(jsObj);
        logDebug('PYODIDE', 'Available js functions:', jsKeys);
        logDebug('PYODIDE', 'js.sendMessageToChat function:', typeof jsObj.sendMessageToChat);
        logDebug('PYODIDE', 'js.host_fetch function:', typeof jsObj.host_fetch);
      }
    } catch (debugError) {
      logError('PYODIDE', 'Failed to verify js bridge:', debugError);
    }

    return pyodide;

  } catch (error) {
    console.error('[offscreen] Failed to initialize Pyodide:', error);
    throw error;
  }
}

// Execute Python code and return result
async function executePythonCode(pythonCode) {
  if (!pyodide) {
    throw new Error('Pyodide not initialized');
  }

  try {
    logInfo('EXECUTION', 'Executing Python code');

    // Execute the code using Pyodide
    const result = await pyodide.runPythonAsync(pythonCode);

    // Convert result to JavaScript if it's a Pyodide object
    let jsResult = result;
    if (result && typeof result.toJs === 'function') {
      jsResult = result.toJs();
    }

    logInfo('EXECUTION', 'Python execution completed successfully');
    return jsResult;

  } catch (error) {
    logError('EXECUTION', 'Python execution failed:', error);
    throw error;
  }
}

// Function to handle chunked HTML messages
function handleChunkedMessage(message, sendResponse) {
  logDebug('CHUNKING', `Received ${message.type}: transferId=${message.transferId}, chunk=${message.chunkIndex}/${message.totalChunks}, size=${message.chunkData ? message.chunkData.length : 'N/A'}`);

  switch (message.type) {
    case 'HTML_CHUNK':
      handleHtmlChunk(message);
      break;

    case 'HTML_CHUNK_COMPLETE':
      handleHtmlChunkComplete(message);
      break;

    case 'START_WORKFLOW_AFTER_CHUNKS':
      // handleStartWorkflowAfterChunks уже вызывает sendResponse() синхронно
      // поэтому НЕ возвращаем true для избежания ошибок канала
      logDebug('CHUNKING', 'Processing START_WORKFLOW_AFTER_CHUNKS synchronously');
      handleStartWorkflowAfterChunks(message, sendResponse);
      break;

    default:
      logWarn('CHUNKING', 'Unknown chunk message type:', message.type);
  }

  // Всегда возвращаем false - sendResponse уже вызван синхронно во всех обработчиках
  // Это предотвращает ошибки "message channel closed before a response was received"
  logDebug('CHUNKING', `handleChunkedMessage returning false for message type: ${message.type}`);
  return false;
}

// Асинхронная функция для отправки подтверждений чанков без блокировки
async function sendChunkAcknowledgment(transferId, chunkIndex) {
  const ackMessage = {
    type: 'HTML_CHUNK_ACK',
    transferId,
    chunkIndex,
    received: true,
    messageId: `ack_${Date.now()}_${transferId}_${chunkIndex}`,
    timestamp: Date.now()
  };

  try {
    // Используем safeSendMessage с коротким таймаутом и retry логикой
    const result = await safeSendMessage(ackMessage, {
      timeout: 5000,    // 5 секунд таймаут для подтверждений
      retries: 3,       // 3 повторные попытки
      retryDelay: 500,  // 500мс между попытками
      silent: true      // Тихий режим - не логировать повторяющиеся ошибки
    });

    if (result.success) {
      logDebug('CHUNKING', `HTML_CHUNK_ACK sent successfully for chunk ${chunkIndex}, transfer ${transferId}`);
    } else {
      logWarn('CHUNKING', `HTML_CHUNK_ACK failed for chunk ${chunkIndex}, transfer ${transferId}: ${result.error}`);
    }

    return result;
  } catch (error) {
    logError('CHUNKING', `Critical error sending HTML_CHUNK_ACK for chunk ${chunkIndex}, transfer ${transferId}:`, error);
    throw error;
  }
}

// Function to handle individual HTML chunks
function handleHtmlChunk(chunkMessage) {
  const { transferId, chunkIndex, totalChunks, chunkData, metadata } = chunkMessage;

  if (!htmlTransfers.has(transferId)) {
    // Initialize new transfer
    htmlTransfers.set(transferId, {
      chunks: new Array(totalChunks),
      receivedChunks: 0,
      metadata,
      completed: false,
      assembledNotified: false // Track if background acknowledged HTML_ASSEMBLED
    });
    logInfo('CHUNKING', `Initialized new transfer: ${transferId} (${totalChunks} chunks)`);
  }

  const transfer = htmlTransfers.get(transferId);
  if (!transfer) return;

  // Store the chunk
  transfer.chunks[chunkIndex] = chunkData;
  transfer.receivedChunks++;

  // Diagnostic logging for chunk storage (only on error)
  if (transfer.chunks[chunkIndex] === undefined) {
    logError('CHUNKING', `FAILED to store chunk ${chunkIndex}!`);
  }

  logDebug('CHUNKING', `Stored chunk ${chunkIndex + 1}/${totalChunks} for transfer ${transferId}`);

  // Send acknowledgment - ASYNCHRONOUS to prevent blocking chunk processing
  sendChunkAcknowledgment(transferId, chunkIndex).catch(error => {
    logError('CHUNKING', `Failed to send HTML_CHUNK_ACK for chunk ${chunkIndex}:`, error);
  });

  // Check if transfer is complete
  if (transfer.receivedChunks === totalChunks) {
    logInfo('CHUNKING', `All chunks received for transfer ${transferId}`);

    // Automatically mark transfer as completed when all chunks are received
    transfer.completed = true;

    // Assemble the complete HTML from all chunks
    const assembledHtml = transfer.chunks.join('');
    logInfo('CHUNKING', `Successfully assembled HTML for transfer ${transferId}, total length: ${assembledHtml.length}`);

    // Send HTML_ASSEMBLED message to background with extracted pluginId and pageKey
    safeSendMessageSync({
      type: 'HTML_ASSEMBLED',
      transferId,
      pluginId: transfer.metadata?.pluginId,
      pageKey: transfer.metadata?.pageKey,
      requestId: transfer.metadata?.requestId,
      html: assembledHtml,
      metadata: transfer.metadata
    });

    // Mark that we have notified background about assembly completion
    transfer.assembledNotified = true;

    logDebug('CHUNKING', `Sent HTML_ASSEMBLED message to background for transfer ${transferId}`);
  }
}

// Function to handle chunk completion
function handleHtmlChunkComplete(message) {
  const { transferId } = message;
  const transfer = htmlTransfers.get(transferId);

  if (!transfer) {
    logError('CHUNKING', `Completion message for unknown transfer: ${transferId}`);
    return;
  }

  // Mark transfer as completed
  transfer.completed = true;
  logInfo('CHUNKING', `Transfer ${transferId} marked as completed`);
}

// Function to start workflow after chunks are received
async function handleStartWorkflowAfterChunks(message, sendResponse) {
  const { pluginId, pageKey, requestId } = message;

  logInfo('CHUNKING', `Запуск workflow для pluginId: ${pluginId}, pageKey: ${pageKey}, requestId: ${requestId}`);

  // Find the most recent completed transfer
  let selectedTransfer = null;
  let lastReceivedTimestamp = 0;

  logDebug('CHUNKING', `Searching for completed transfers among ${htmlTransfers.size} total transfers`);
  for (const [transferId, transfer] of htmlTransfers.entries()) {
    if (transfer.metadata?.timestamp > lastReceivedTimestamp && transfer.completed && transfer.receivedChunks === transfer.chunks.length) {
      selectedTransfer = transfer;
      lastReceivedTimestamp = transfer.metadata.timestamp;
    }
  }

  if (!selectedTransfer) {
    logError('CHUNKING', 'No completed HTML transfers found for workflow');
    const errorResponse = { error: 'No completed HTML transfers found' };
    logInfo('CHUNKING', `Sending error response: ${JSON.stringify(errorResponse)}`);
    sendResponse(errorResponse);
    return;
  }

  logInfo('CHUNKING', 'Starting workflow with chunk metadata for Python assembly');

  try {
    // Prepare chunk metadata for Python reconstruction instead of assembling here
    const chunkMetadata = {
      __isChunkedString: true,
      originalKey: 'page_html',
      chunkCount: selectedTransfer.chunks.length,
      totalLength: selectedTransfer.chunks.reduce((sum, chunk) => sum + (chunk ? chunk.length : 0), 0)
    };

    // Create input data with chunk metadata + all chunks
    const workflowPayload = { page_html: chunkMetadata };

    // Add all chunks to payload
    for (let i = 0; i < selectedTransfer.chunks.length; i++) {
      workflowPayload[`page_html_chunk_${i}`] = selectedTransfer.chunks[i] || '';
    }

    // Log chunk details for debugging
    logDebug('CHUNKING', `Preparing ${selectedTransfer.chunks.length} chunks for Python, total length: ${workflowPayload.page_html.totalLength}`);

    // Execute workflow and let Python handle chunk reconstruction
    const result = await executeWorkflowWithChunks(pluginId, pageKey, workflowPayload, requestId, sendResponse);

    logInfo('CHUNKING', `Workflow execution completed`);

    logInfo('CHUNKING', `Workflow успешно завершен для pluginId: ${pluginId}, requestId: ${requestId}`);

  } catch (error) {
    logError('CHUNKING', 'Workflow execution failed:', error);
    console.error('[offscreen][CHUNKING] Workflow execution failed:', error);

    logError('CHUNKING', `Workflow завершен с ошибкой для pluginId: ${pluginId}, requestId: ${requestId}`);

    const errorResponse = {
      error: error.message,
      pluginId,
      requestId
    };
    logInfo('CHUNKING', `Sending error response for workflow: ${JSON.stringify(errorResponse)}`);
    sendResponse(errorResponse);
  }
}

// Function to execute workflow with chunk metadata or assembled HTML
async function executeWorkflowWithChunks(pluginId, pageKey, workflowPayload, requestId, pluginSettings, sendResponse) {
  const startTime = Date.now();
  logInfo('EXECUTION', `Запуск workflow для pluginId: ${pluginId}, pageKey: ${pageKey}, requestId: ${requestId} в ${new Date(startTime).toISOString()}`);
  // logInfo('EXECUTION', `Шаг 1: Инициализация Pyodide - ${new Date(Date.now()).toISOString()}`);

  try {
    // Initialize Pyodide if needed
    if (!pyodide) {
      // logInfo('EXECUTION', `Шаг 2: Инициализация Pyodide - ${new Date(Date.now()).toISOString()}`);
      await initializePyodide();
      // logInfo('EXECUTION', `Шаг 3: Pyodide инициализирован - ${new Date(Date.now()).toISOString()}`);
    } else {
      // logInfo('EXECUTION', `Шаг 2: Pyodide уже инициализирован - ${new Date(Date.now()).toISOString()}`);
    }

    logInfo('EXECUTION', `Workflow запускается`);

    // Load the Python script URL
    // logInfo('EXECUTION', `Шаг 4: Загрузка Python скрипта - ${new Date(Date.now()).toISOString()}`);
    const pyScriptUrl = chrome.runtime.getURL(`/plugins/${pluginId}/mcp_server.py`);

    const response = await fetch(pyScriptUrl);
    if (!response.ok) {
      throw new Error(`Failed to load Python script: ${response.status}`);
    }

    const pythonCode = await response.text();
    // logInfo('EXECUTION', `Шаг 5: Python скрипт загружен (${pythonCode.length} символов) - ${new Date(Date.now()).toISOString()}`);

    // Execute the Python code
    await pyodide.runPythonAsync(pythonCode);

    // Get the main workflow function
    const workflowFunction = pyodide.globals.get('analyze_ozon_product');
    if (!workflowFunction) {
      throw new Error('Main workflow function analyze_ozon_product not found in Python script');
    }

    // Execute the workflow with detailed logging
    // logInfo('EXECUTION', `Шаг 6: Вызов Python функции analyze_ozon_product - ${new Date(Date.now()).toISOString()}`);

    // === НОВАЯ СИСТЕМА ПЕРЕДАЧИ ДАННЫХ ЧЕРЕЗ PYODIDE.GLOBALS ===
    logDebug('PYODIDE', 'Starting data transmission to Pyodide globals');

    // ДИАГНОСТИКА: Проверить тип и структуру workflowPayload.page_html
    // logInfo('PYODIDE', `🔍 WORKFLOW PAYLOAD DIAGNOSTIC:`);
    // logInfo('PYODIDE', `🔍 workflowPayload.page_html type: ${typeof workflowPayload.page_html}`);
    if (workflowPayload.page_html && typeof workflowPayload.page_html === 'object') {
      logInfo('PYODIDE', `🔍 workflowPayload.page_html keys: ${Object.keys(workflowPayload.page_html)}`);
      logInfo('PYODIDE', `🔍 __isChunkedString: ${workflowPayload.page_html.__isChunkedString}`);
      logInfo('PYODIDE', `🔍 chunkCount: ${workflowPayload.page_html.chunkCount}`);
    } else if (workflowPayload.page_html && typeof workflowPayload.page_html === 'string') {
      // logInfo('PYODIDE', `🔍 workflowPayload.page_html length: ${workflowPayload.page_html.length} chars`);
    }

    // Проверить, есть ли page_html в workflowPayload
    if (workflowPayload.page_html && typeof workflowPayload.page_html === 'object' && workflowPayload.page_html.__isChunkedString) {
      logInfo('PYODIDE', '✅ Detected chunk data for transmission (CHUNK BRANCH)');

      // Извлечь метаданные из chunk структуры
      const chunkMetadata = workflowPayload.page_html;
      const chunkCount = chunkMetadata.chunkCount;

      logInfo('PYODIDE', `Setting up chunk data transmission for ${chunkCount} chunks`);

      // НЕМЕДЛЕННО УСТАНОВИТЬ ВСЕ ПЕРЕМЕННЫЕ ПРЯМО ПЕРЕД ВЫЗОВОМ PYTHON ФУНКЦИИ
      // Это критично - установка должна происходить в том же контексте выполнения
      try {
        // Очистить старые переменные
        try { pyodide.globals.delete('page_html_chunk_count'); } catch(e) {}
        try { pyodide.globals.delete('page_html_total_length'); } catch(e) {}
        try { pyodide.globals.delete('page_html'); } catch(e) {}

        // Установить новые переменные
        pyodide.globals.set('page_html_chunk_count', chunkCount);
        pyodide.globals.set('page_html_total_length', chunkMetadata.totalLength);

        // Установить все чанки
        for (let i = 0; i < chunkCount; i++) {
          const chunkKey = `page_html_chunk_${i}`;
          const chunkValue = workflowPayload[chunkKey] || '';
          try { pyodide.globals.delete(chunkKey); } catch(e) {} // Очистить старую
          pyodide.globals.set(chunkKey, chunkValue);
        }

        logInfo('PYODIDE', `✅ All chunk variables set successfully: count=${chunkCount}, totalLength=${chunkMetadata.totalLength}`);

        // НЕМЕДЛЕННАЯ ВЕРИФИКАЦИЯ В ТОМ ЖЕ КОНТЕКСТЕ
        const verifyCount = pyodide.globals.get('page_html_chunk_count');
        const verifyLength = pyodide.globals.get('page_html_total_length');

        if (verifyCount === chunkCount && verifyLength === chunkMetadata.totalLength) {
          logInfo('PYODIDE', '✅ Chunk variables verified successfully');
        } else {
          logError('PYODIDE', `❌ Verification failed: count=${verifyCount}/${chunkCount}, length=${verifyLength}/${chunkMetadata.totalLength}`);
        }

      } catch (setError) {
        logError('PYODIDE', 'Error setting chunk variables in globals:', setError);
        throw setError;
      }

    } else {
      // logInfo('PYODIDE', '🔄 No chunk data found, using direct transmission (DIRECT BRANCH)');

      // Fallback: установить page_html напрямую если нет chunks
      if (workflowPayload.page_html && typeof workflowPayload.page_html === 'string') {
        try { pyodide.globals.delete('page_html'); } catch(e) {} // Очистить старую
        pyodide.globals.set('page_html', workflowPayload.page_html);
        // logInfo('PYODIDE', `page_html set directly, length: ${workflowPayload.page_html.length}`);

        // === ИСПРАВЛЕНИЕ: Симулировать chunk логику для совместимости с Python кодом ===
        logInfo('PYODIDE', '🔧 FIXING: Simulating chunk variables for direct HTML transmission');

        // Очистить старые chunk переменные
        try { pyodide.globals.delete('page_html_chunk_count'); } catch(e) {}
        try { pyodide.globals.delete('page_html_total_length'); } catch(e) {}
        try { pyodide.globals.delete('page_html_chunk_0'); } catch(e) {}

        // Установить chunk переменные для совместимости с Python
        pyodide.globals.set('page_html_chunk_count', 1);
        pyodide.globals.set('page_html_total_length', workflowPayload.page_html.length);
        pyodide.globals.set('page_html_chunk_0', workflowPayload.page_html);

        logInfo('PYODIDE', `✅ Chunk variables simulated: count=1, totalLength=${workflowPayload.page_html.length}`);

        // Верификация всех переменных
        const verifyCount = pyodide.globals.get('page_html_chunk_count');
        const verifyLength = pyodide.globals.get('page_html_total_length');
        const verifyChunk0 = pyodide.globals.get('page_html_chunk_0');
        const verifyHtml = pyodide.globals.get('page_html');

        if (verifyCount === 1 &&
            verifyLength === workflowPayload.page_html.length &&
            verifyChunk0 === workflowPayload.page_html &&
            verifyHtml === workflowPayload.page_html) {
          // logInfo('PYODIDE', '✅ All variables verified successfully - Python compatibility ensured');
        } else {
          logError('PYODIDE', `❌ Verification failed: count=${verifyCount}/1, length=${verifyLength}/${workflowPayload.page_html.length}, chunk0_length=${verifyChunk0 ? verifyChunk0.length : 'null'}/${workflowPayload.page_html.length}`);
        }
      } else {
        logWarn('PYODIDE', 'page_html not found or has wrong type');
      }
    }

    // Установить pluginSettings в Pyodide globals
    if (pluginSettings) {
      try {
        pyodide.globals.set('plugin_settings', pluginSettings);
        logInfo('PYODIDE', 'pluginSettings set in Pyodide globals');
      } catch (setError) {
        logError('PYODIDE', 'Error setting pluginSettings in globals:', setError);
      }
    }

    // ВЫЗВАТЬ PYTHON ФУНКЦИЮ НЕМЕДЛЕННО ПОСЛЕ УСТАНОВКИ ПЕРЕМЕННЫХ
    logInfo('PYODIDE', 'Calling Python function analyze_ozon_product()');

    // Проверка доступности Python функций перед вызовом
    if (typeof pyodide.globals.get('analyze_ozon_product') === 'undefined') {
      console.error("[PYODIDE_DEBUG] analyze_ozon_product function not found in Pyodide globals");
      throw new Error("analyze_ozon_product function not found in Pyodide globals");
    }

    // Подготовить input_data с pluginSettings для передачи в Python функцию
    const inputData = { pluginSettings: pluginSettings };
    pyodide.globals.set('input_data', inputData);

    console.log("[PYODIDE_DEBUG] Starting Pyodide execution...");
    let resultProxy;
    try {
      resultProxy = await pyodide.runPythonAsync('analyze_ozon_product(input_data)');

      logInfo('PYODIDE', 'Python function called successfully');
    } catch (callError) {
      console.error("[PYODIDE_DEBUG] Pyodide execution error:", callError);
      throw callError;
    }

    let result;
    if (resultProxy) {
      // Проверяем, есть ли метод toJs
      const hasToJs = typeof resultProxy.toJs === 'function';
      if (hasToJs) {
        try {
          result = resultProxy.toJs({ dict_converter: Object.fromEntries });
          logInfo('PYODIDE', 'toJs() conversion successful');

          // Проверяем результат на наличие ошибок
          if (result && typeof result === 'object') {
            if (result.error || result.status === 'error') {
              logError('PYODIDE', 'Python function returned error:', result);
            } else {
              logInfo('PYODIDE', 'Python function completed successfully');
            }
          }

          // Проверяем на утечки памяти
          if (typeof resultProxy.destroy === 'function') {
            resultProxy.destroy();
          }

        } catch (conversionError) {
          logError('PYODIDE', 'toJs() conversion failed:', conversionError);
          // Попытка альтернативной конвертации
          try {
            result = resultProxy.toJs();
            resultProxy.destroy();
          } catch (fallbackError) {
            throw conversionError; // Пробрасываем оригинальную ошибку
          }
        }
      } else {
        throw new Error('Pyodide result proxy does not have toJs method');
      }
    } else {
      throw new Error('Pyodide workflow function returned null/undefined result');
    }

    // logInfo('EXECUTION', `Шаг 7: Python функция выполнена успешно - ${new Date(Date.now()).toISOString()}`);
    logInfo('EXECUTION', 'Workflow-engine executed successfully');

    logInfo('EXECUTION', `Workflow успешно завершен`);

    const endTime = Date.now();
    logInfo('EXECUTION', `Workflow успешно завершен за ${endTime - startTime}мс в ${new Date(endTime).toISOString()}`);

    // Send response back
    const successResponse = {
      success: true,
      result: result,
      pluginId: pluginId,
      requestId: requestId,
      timestamp: Date.now()
    };
    logInfo('EXECUTION', `Sending success response for workflow: pluginId=${pluginId}, requestId=${requestId}`);
    const responsePayload = JSON.stringify(successResponse);
    logDebug('EXECUTION', `Response payload: ${typeof responsePayload === 'string' ? responsePayload.substring(0, 200) : String(responsePayload).substring(0, 200)}...`);
    sendResponse(successResponse);

  } catch (error) {
    logError('EXECUTION', 'Workflow execution failed:', error);
    const errorTime = Date.now();
    logError('EXECUTION', `Workflow завершен с ошибкой за ${errorTime - startTime}мс в ${new Date(errorTime).toISOString()}`);

    // Сообщение об ошибке убрано согласно требованиям - только логирование
    logError('EXECUTION', `Workflow завершился с ошибкой: ${error.message}`);

    // Send error response back
    const errorResponse = {
      success: false,
      error: error.message,
      pluginId: pluginId,
      requestId: requestId,
      timestamp: Date.now()
    };
    logInfo('EXECUTION', `Sending error response for workflow: pluginId=${pluginId}, requestId=${requestId}, error=${error.message}`);
    logDebug('EXECUTION', `Error response payload: ${JSON.stringify(errorResponse)}`);
    sendResponse(errorResponse);
  }
}

// Handle messages from background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  const messageId = message.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  // Закомментировано: повторяющиеся verbose логи для GET_PLUGIN_CHAT и GET_PLUGIN_CHAT_DRAFT
  // if (message.type !== 'GET_PLUGIN_CHAT' && message.type !== 'GET_PLUGIN_CHAT_DRAFT') {
  //   logInfo('CHANNEL', `📨 OFFSCREEN MESSAGE RECEIVED: type=${message.type}, messageId=${messageId}, timestamp=${new Date().toISOString()}`);
  // }

  // Track response status
  let responseSent = false;

  // Установить глобальную функцию отправки ответа
  globalSendResponse = sendResponse;

  const trackSendResponse = (response) => {
    if (responseSent) {
      logWarn('CHANNEL', `DUPLICATE sendResponse call for messageId=${messageId}, type=${message.type}`);
      return;
    }
    responseSent = true;
    logInfo('CHANNEL', `📤 OFFSCREEN RESPONSE SENT: type=${message.type}, messageId=${messageId}, success=${response?.success !== false}`);
    try {
      sendResponse(response);
    } catch (error) {
      logError('CHANNEL', `❌ sendResponse failed for messageId=${messageId}:`, error);
    }
  };

  // Функция очистки глобальной переменной при завершении
  const cleanupGlobalSendResponse = () => {
    globalSendResponse = null;
    logDebug('CHANNEL', 'Global sendResponse cleaned up');
  };

  // Handle HTML_ASSEMBLED confirmation from background to cleanup transfer
  if (message.type === 'HTML_ASSEMBLED_CONFIRMED') {
    const { transferId } = message;

    if (htmlTransfers.has(transferId)) {
      htmlTransfers.delete(transferId);
      logDebug('CHUNKING', `Transfer ${transferId} cleaned up after background confirmation`);
    } else {
      logWarn('CHUNKING', `Transfer ${transferId} not found for cleanup confirmation`);
    }

    // Send confirmation response and return true
    trackSendResponse({ success: true, messageId: messageId });
    return true;
  }

  // Handle HTML_ASSEMBLED rejection from background
  if (message.type === 'HTML_ASSEMBLED_REJECTED') {
    const { transferId, reason } = message;

    logError('CHUNKING', `Transfer ${transferId} REJECTED by background: ${reason}`);

    if (htmlTransfers.has(transferId)) {
      const transfer = htmlTransfers.get(transferId);
      // Mark transfer as failed but keep it for diagnostics
      transfer.failed = true;
      transfer.failureReason = reason;
    } else {
      logWarn('CHUNKING', `Transfer ${transferId} not found to mark as failed`);
    }

    // Send confirmation response and return true
    trackSendResponse({ success: true, messageId: messageId });
    return true;
  }

  // Handle transfer status check from background
  if (message.type === 'CHECK_TRANSFER_STATUS') {
    const { transferId } = message;
    const transfer = htmlTransfers.get(transferId);

    const statusResponse = {
      transferExists: !!transfer,
      assembledNotified: transfer?.assembledNotified || false,
      completed: transfer?.completed || false,
      messageId: messageId
    };

    trackSendResponse(statusResponse);
    return true;
  }

  // Handle PING messages for health checks
  if (message.type === 'PING') {
    const pingResponse = { pong: true, timestamp: Date.now() };
    logDebug('CHANNEL', `PING received, sending PONG response`);
    trackSendResponse(pingResponse);
    return true;
  }

  // Handle HTML_DIRECT messages
  if (message.type === 'HTML_DIRECT') {
    logInfo('HTML_DIRECT', `Received HTML_DIRECT message: transferId=${message.transferId}, pluginId=${message.pluginId}`);
    handleHtmlDirect(message);
    trackSendResponse({ success: true, messageId: messageId });
    return true;
  }

  // Handle chunked messages first
  if (message.type === 'HTML_CHUNK' || message.type === 'HTML_CHUNK_COMPLETE' || message.type === 'START_WORKFLOW_AFTER_CHUNKS') {
    return handleChunkedMessage(message, sendResponse);
  }

  // Handle HTML_DIRECT messages
  if (message.type === 'HTML_DIRECT') {
    handleHtmlDirect(message)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        logError('HTML_DIRECT', `Ошибка обработчика:`, error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  if (message.type === 'TEST_PYODIDE_DIRECT_EXEC') {
    try {
      // Initialize Pyodide if needed
      if (!pyodide) {
        await initializePyodide();
      }

      // Execute the Python code
      const result = await executePythonCode(message.pythonCode);

      // Send response back
      const response = {
        success: true,
        result: result,
        requestId: message.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - message.timestamp
      };

      logInfo('EXECUTION', `Sending success response for EXECUTE_PYTHON_CODE: testName=${message.testName}, requestId=${message.requestId}`);
      trackSendResponse(response);

    } catch (error) {
      logError('EXECUTION', 'Test execution failed:', error);

      const errorResponse = {
        success: false,
        error: error.message,
        requestId: message.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - message.timestamp
      };
      logInfo('EXECUTION', `Sending error response for TEST_PYODIDE_DIRECT_EXEC: requestId=${message.requestId}, error=${error.message}`);
      trackSendResponse(errorResponse);
    }

    logInfo('EXECUTION', 'Processing TEST_PYODIDE_DIRECT_EXEC asynchronously - sendResponse will be called');
    return true; // Keep channel open for async response
  }

  // === РУЧНОЕ ТЕСТИРОВАНИЕ PYODIDE ===

  if (message.type === 'INITIALIZE_PYODIDE') {
    logInfo('PYODIDE', 'Initializing Pyodide for manual testing');

    try {
      // Initialize Pyodide if not already done
      if (!pyodide) {
        await initializePyodide();
      }

      logInfo('PYODIDE', 'Pyodide ready for manual testing');

      const response = {
        success: true,
        result: 'Pyodide initialized successfully',
        timestamp: Date.now()
      };
      logInfo('PYODIDE', `Sending success response for INITIALIZE_PYODIDE`);
      trackSendResponse(response);

    } catch (error) {
      logError('PYODIDE', 'Initialization failed:', error);

      const errorResponse = {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
      logInfo('PYODIDE', `Sending error response for INITIALIZE_PYODIDE: error=${error.message}`);
      trackSendResponse(errorResponse);
    }

    return true;
  }

  if (message.type === 'EXECUTE_PYTHON_CODE') {
    logInfo('EXECUTION', 'Executing Python code for manual testing');
    logDebug('EXECUTION', `Test: ${message.testName}, error test: ${message.isErrorTest}`);

    try {
      // Ensure Pyodide is initialized
      if (!pyodide) {
        await initializePyodide();
      }

      let result;
      let success = true;

      try {
        // Execute the Python code
        result = await executePythonCode(message.code);
      } catch (pythonError) {
        // If this is an error test, we expect the error
        if (message.isErrorTest) {
          logInfo('EXECUTION', 'Expected error in error test:', pythonError.message);
          result = 'Error correctly caught: ' + pythonError.message;
          success = false;
        } else {
          // Unexpected error
          throw pythonError;
        }
      }

      logInfo('EXECUTION', `Test execution completed: ${success ? 'SUCCESS' : 'FAILED'}`);

      const response = {
        success: success,
        result: result,
        error: success ? null : result,
        testName: message.testName,
        requestId: message.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - (message.timestamp || 0)
      };

      trackSendResponse(response);

    } catch (error) {
      logError('EXECUTION', 'Execution failed:', error);

      const errorResponse = {
        success: false,
        error: error.message,
        testName: message.testName,
        requestId: message.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - (message.timestamp || 0)
      };
      logInfo('EXECUTION', `Sending error response for EXECUTE_PYTHON_CODE: testName=${message.testName}, requestId=${message.requestId}, error=${error.message}`);
      trackSendResponse(errorResponse);
    }
  
    logInfo('EXECUTION', 'Processing EXECUTE_PYTHON_CODE asynchronously - sendResponse will be called');
    return true;
  }

 // === EXECUTE_WORKFLOW HANDLER FOR ENHANCED CHUNKING EXECUTION ===
 if (message.type === 'EXECUTE_WORKFLOW') {
  const workflowStartTime = Date.now();
  logInfo('EXECUTION', `EXECUTE_WORKFLOW получено в ${new Date(workflowStartTime).toISOString()}`);
  logInfo('EXECUTION', `PluginId: ${message.pluginId}, PageKey: ${message.pageKey}, RequestId: ${message.requestId}`);

  // Убираем проверки дублирования - гарантируем выполнение каждого EXECUTE_WORKFLOW
  const pluginId = message.pluginId || 'ozon-analyzer';
  const pageKey = message.pageKey || 'unknown_page';
  const requestId = message.requestId || `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logInfo('EXECUTION', `Запуск workflow гарантирован для ${pluginId}:${pageKey}:${requestId}`);

  // Функция для отправки ответа background.js
  const sendWorkflowResponse = (response) => {
    logInfo('EXECUTION', `Отправка ответа background.js: success=${response?.success}, timestamp=${new Date().toISOString()}`);
    try {
      sendResponse(response);
      logInfo('EXECUTION', `✅ Ответ успешно отправлен background.js`);
    } catch (error) {
      logError('EXECUTION', `❌ Ошибка отправки ответа background.js:`, error);
    }
  };

  try {
   // Initialize Pyodide if needed
   if (!pyodide) {
    logInfo('EXECUTION', 'Initializing Pyodide...');
    await initializePyodide();
   }

    // Extract workflow parameters (уже определены выше)
    const transferId = message.transferId;
    const useChunks = message.useChunks || false;
    const pluginSettings = message.pluginSettings;

    // ОБНОВИТЬ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ JS BRIDGE - ИСПРАВЛЕНИЕ HARDCODED PAGEKEY
    currentPluginId = pluginId;
    currentPageKey = pageKey;

    // ДОБАВИТЬ ЭТУ СТРОКУ:
    window.geminiApiKey = message.geminiApiKey;

    // ПОЛУЧАЕМ HTML ДАННЫЕ ИЗ HTML_DIRECT STORAGE ИЛИ НАПРЯМУЮ
    let workflowPayload;
    if (useChunks && transferId) {
      // Используем chunks если указано
      logInfo('EXECUTION', 'Using enhanced chunking - preparing chunk metadata');

      // ЖДЕМ ДОСТУПНОСТИ CHUNKS И ПОДГОТАВЛИВАЕМ METADATA ДЛЯ PYTHON
      const maxWaitTime = 30000; // 30 секунд максимум
      const startWaitTime = Date.now();

      while (Date.now() - startWaitTime < maxWaitTime) {
        const transfer = htmlTransfers.get(transferId);
        if (transfer && transfer.completed && transfer.chunks.every(chunk => chunk !== undefined)) {
          logInfo('CHUNKING', `Preparing ${transfer.chunks.length} chunks for Python assembly`);

          // Prepare chunk metadata for Python reconstruction instead of assembling here
          const chunkMetadata = {
            __isChunkedString: true,
            originalKey: 'page_html',
            chunkCount: transfer.chunks.length,
            totalLength: transfer.chunks.reduce((sum, chunk) => sum + (chunk ? chunk.length : 0), 0)
          };

          // Create input data with chunk metadata + all chunks
          workflowPayload = { page_html: chunkMetadata };

          // Add all chunks to payload
          for (let i = 0; i < transfer.chunks.length; i++) {
            workflowPayload[`page_html_chunk_${i}`] = transfer.chunks[i] || '';
          }

          // Log chunk summary for debugging
          logDebug('CHUNKING', `Total chunks: ${transfer.chunks.length}, expected length: ${workflowPayload.page_html.totalLength}`);
          break;
        }

        // ЖДЕМ НЕМНОГО ПЕРЕД СЛЕДУЮЩЕЙ ПРОВЕРКОЙ
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!workflowPayload) {
        throw new Error(`Timeout waiting for chunk data preparation (transferId: ${transferId})`);
      }
    } else if (htmlDirectStorage.has(transferId)) {
      // ПРИОРИТЕТ 1: Используем HTML_DIRECT storage
      const htmlDirectData = htmlDirectStorage.get(transferId);
      workflowPayload = { page_html: htmlDirectData.html };
      logDebug('EXECUTION', `Найден HTML в HTML_DIRECT storage для transfer ${transferId}, длина: ${htmlDirectData.html.length}`);

      // Очищаем использованные данные для предотвращения утечек памяти
      htmlDirectStorage.delete(transferId);
      cleanupHtmlDirectStorage();
    } else if (message.pageHtml || message.htmlData || message.html) {
      // ПРИОРИТЕТ 2: Прямая передача HTML данных
      const pageHtml = message.pageHtml || message.htmlData || message.html;
      workflowPayload = { page_html: pageHtml };
      logDebug('EXECUTION', `Используем прямой pageHtml, длина: ${pageHtml.length}`);
    } else {
      throw new Error('Нет HTML данных - ни chunks, ни HTML_DIRECT storage, ни прямой pageHtml/htmlData/html недоступны');
    }

     logInfo('EXECUTION', `Starting workflow-engine with pluginId: ${pluginId}`);

     logInfo('EXECUTION', `Workflow с chunk данными запускается`);

     // Debug logging for workflow payload
     logDebug('EXECUTION', `Workflow payload keys: ${Object.keys(workflowPayload).length}`);
     if (workflowPayload.page_html) {
       if (typeof workflowPayload.page_html === 'string') {
         logDebug('EXECUTION', `page_html length: ${workflowPayload.page_html.length} chars`);
       } else if (workflowPayload.page_html.__isChunkedString) {
         logDebug('EXECUTION', `Chunk metadata: ${workflowPayload.page_html.chunkCount} chunks, ${workflowPayload.page_html.totalLength} total`);
       }
     }

     // Execute workflow with chunks
     // logInfo('EXECUTION', `Шаг 8: Запуск executeWorkflowWithChunks - ${new Date(Date.now()).toISOString()}`);
     const result = await executeWorkflowWithChunks(pluginId, pageKey, workflowPayload, requestId, pluginSettings, sendWorkflowResponse);
     // logInfo('EXECUTION', `Шаг 9: executeWorkflowWithChunks завершен - ${new Date(Date.now()).toISOString()}`);
     logInfo('EXECUTION', 'Workflow execution completed');

   } catch (error) {
    logError('EXECUTION', 'CRITICAL ERROR:', error);
    const errorTime = Date.now();
    logError('EXECUTION', `Workflow завершен с ошибкой за ${errorTime - workflowStartTime}мс в ${new Date(errorTime).toISOString()}`);

    const errorResponse = {
      success: false,
      error: error.message,
      pluginId: message.pluginId,
      requestId: message.requestId,
      timestamp: Date.now()
    };
    logInfo('EXECUTION', `Sending error response for EXECUTE_WORKFLOW: ${JSON.stringify(errorResponse)}`);
    sendWorkflowResponse(errorResponse);
   }

   logInfo('EXECUTION', 'Processing EXECUTE_WORKFLOW asynchronously - sendResponse will be called');
   return true; // Keep channel open for async response
  }

  // Очистка глобальной переменной после завершения обработки сообщения
  cleanupGlobalSendResponse();

  return false;
});

// ДОБАВИТЬ ЛОГИ ДЛЯ ДИАГНОСТИКИ ПРОБЛЕМЫ С .THEN()
logInfo('SYSTEM', 'Message listener already registered above - checking result...');
const listenerResultValue = undefined; // chrome.runtime.onMessage.addListener всегда возвращает undefined
logInfo('SYSTEM', `chrome.runtime.onMessage.addListener result: ${listenerResultValue}`);
logInfo('SYSTEM', `Type of result: ${typeof listenerResultValue}`);
if (listenerResultValue === undefined) {
  logWarn('SYSTEM', '⚠️ addListener returned undefined - this is expected, no .then() needed');
} else {
  logInfo('SYSTEM', '✅ addListener returned a value - checking if it has .then() method');
  logInfo('SYSTEM', `Has .then method: ${typeof listenerResultValue.then === 'function'}`);
}

// ДОБАВИТЬ ОБРАБОТКУ БЕЗ .THEN() - ТОЛЬКО ЛОГИ
if (listenerResultValue && typeof listenerResultValue.then === 'function') {
  logInfo('SYSTEM', 'Result has .then() method - using Promise handling');
  listenerResultValue.then(() => {
    logDebug('SYSTEM', 'Message handler setup completed successfully');
  }).catch((error) => {
    logError('SYSTEM', 'Error in message handler setup:', error);
    // cleanupGlobalSendResponse(); // Функция определена в обработчике выше
  });
} else {
  logInfo('SYSTEM', 'Result does not have .then() method - no Promise handling needed');
  logDebug('SYSTEM', 'Message handler setup completed (no Promise)');
}

logInfo('SYSTEM', 'Offscreen document ready, waiting for messages...');