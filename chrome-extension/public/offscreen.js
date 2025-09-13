/**
 * Offscreen Document Handler for Direct Pyodide Testing
 * Handles direct Python code execution in offscreen context
 */

/**
 * Offscreen Document Handler for Direct Pyodide Testing
 * Handles direct Python code execution in offscreen context
 * Supports chunked HTML data transfer for large documents
 */

// === CHUNKING HTML DATA RECEIVER ===

// Global state for chunked HTML transfers
const htmlTransfers = new Map();

let pyodide = null;

// Глобальные переменные для хранения текущих pluginId и pageKey
let currentPluginId = 'ozon-analyzer';
let currentPageKey = 'unknown_page';

// Глобальная функция trackSendResponse для использования вне обработчика сообщений
function trackSendResponse(response) {
  logDebug('RESPONSE', `Sending response: ${JSON.stringify(response)}`);
  return true;
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

// Текущий уровень логирования (по умолчанию INFO, debug отключен)
let currentLogLevel = LOG_LEVELS.INFO;

// Флаги для разных типов логирования
const LOG_FLAGS = {
  CHUNKING: true,
  PYODIDE: true,
  EXECUTION: true,
  CHANNEL: true
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

      logDebug('CHANNEL', `Message sent successfully: ${message.type}, ID: ${messageId}`);
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
    pyodide.globals.set('js', {
      sendMessageToChat: async (message) => {
        logDebug('PYODIDE', 'JS bridge attempting to send message');
        try {
          const jsMessage = message.toJs ? message.toJs({ dict_converter: Object.fromEntries }) : message;
          // Immediate отправка без await и таймаутов для PYODIDE_MESSAGE
          const messageId = `pyodide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          chrome.runtime.sendMessage({
            type: 'PYODIDE_MESSAGE',
            messageId: messageId,
            pluginId: currentPluginId,
            pageKey: currentPageKey,
            message: {
              role: 'plugin',
              content: `📨 Execute result: ${typeof jsMessage === 'string' ? jsMessage : JSON.stringify(jsMessage)}`,
              timestamp: Date.now()
            }
          });
          logInfo('PYODIDE', `PYODIDE_MESSAGE отправлено immediate с ID: ${messageId}`);

          return Promise.resolve({ success: true });
        } catch (error) {
          logError('PYODIDE', 'Unexpected error in sendMessageToChat:', error);
          return Promise.resolve({ success: false, error: error.message });
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

          // For offscreen context, we'll simulate a simple response with timeout
          const llmPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
              const response = `Mock LLM response for ${jsModelAlias}: ${JSON.stringify(jsOptions)}`;
              logDebug('PYODIDE', 'LLM call completed successfully');
              resolve(pyodide.toPy({ result: response }));
            }, Math.random() * 100 + 50); // Имитация задержки 50-150мс
          });

          // Таймаут 5 секунд для LLM вызова
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('LLM call timeout')), 5000)
          );

          const result = await Promise.race([llmPromise, timeoutPromise]);
          return result;

        } catch (error) {
          logError('PYODIDE', 'LLM call failed:', error);
          const errorResponse = `LLM call failed: ${error.message}`;
          return pyodide.toPy({ error: errorResponse });
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
      }
    });

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
      handleStartWorkflowAfterChunks(message, sendResponse);
      return true; // Keep channel open for async response

    default:
      logWarn('CHUNKING', 'Unknown chunk message type:', message.type);
  }

  return false;
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

  // Send acknowledgment - SYNCHRONOUS to prevent channel closure errors
  try {
    chrome.runtime.sendMessage({
      type: 'HTML_CHUNK_ACK',
      transferId,
      chunkIndex,
      received: true,
      messageId: `ack_${Date.now()}_${transferId}_${chunkIndex}`
    });
    logDebug('CHUNKING', `HTML_CHUNK_ACK sent synchronously for chunk ${chunkIndex}`);
  } catch (error) {
    logError('CHUNKING', `Failed to send HTML_CHUNK_ACK for chunk ${chunkIndex}:`, error);
  }

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
    trackSendResponse(errorResponse);
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
    console.log(`[offscreen][CHUNKING] Preparing ${selectedTransfer.chunks.length} chunks for Python:`);
    selectedTransfer.chunks.forEach((chunk, idx) => {
      console.log(`[offscreen][CHUNKING] Chunk ${idx}: ${chunk ? chunk.length : 0} characters`);
    });
    console.log(`[offscreen][CHUNKING] Total expected length: ${workflowPayload.page_html.totalLength}`);

    // Execute workflow and let Python handle chunk reconstruction
    const result = await executeWorkflowWithChunks(pluginId, pageKey, workflowPayload, requestId, sendResponse);

    console.log('[offscreen][CHUNKING] Workflow execution completed');

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
    trackSendResponse(errorResponse);
  }
}

// Function to execute workflow with chunk metadata or assembled HTML
async function executeWorkflowWithChunks(pluginId, pageKey, workflowPayload, requestId, sendResponse) {
  const startTime = Date.now();
  logInfo('EXECUTION', `Запуск workflow для pluginId: ${pluginId}, pageKey: ${pageKey}, requestId: ${requestId} в ${new Date(startTime).toISOString()}`);
  logInfo('EXECUTION', `Шаг 1: Инициализация Pyodide - ${new Date(Date.now()).toISOString()}`);

  try {
    // Initialize Pyodide if needed
    if (!pyodide) {
      logInfo('EXECUTION', `Шаг 2: Инициализация Pyodide - ${new Date(Date.now()).toISOString()}`);
      await initializePyodide();
      logInfo('EXECUTION', `Шаг 3: Pyodide инициализирован - ${new Date(Date.now()).toISOString()}`);
    } else {
      logInfo('EXECUTION', `Шаг 2: Pyodide уже инициализирован - ${new Date(Date.now()).toISOString()}`);
    }

    // Send progress message to chat - immediate отправка
    const progressMessageId = `pyodide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    chrome.runtime.sendMessage({
      type: 'PYODIDE_MESSAGE',
      messageId: progressMessageId,
      pluginId: pluginId,
      pageKey: pageKey,
      message: {
        role: 'plugin',
        content: '🔄 Запуск выполнения workflow с собранными данными...',
        timestamp: Date.now()
      }
    });
    logInfo('EXECUTION', `Прогресс сообщение отправлено immediate с ID: ${progressMessageId}`);

    // Load the Python script URL
    logInfo('EXECUTION', `Шаг 4: Загрузка Python скрипта - ${new Date(Date.now()).toISOString()}`);
    const pyScriptUrl = chrome.runtime.getURL(`/plugins/${pluginId}/mcp_server.py`);

    const response = await fetch(pyScriptUrl);
    if (!response.ok) {
      throw new Error(`Failed to load Python script: ${response.status}`);
    }

    const pythonCode = await response.text();
    logInfo('EXECUTION', `Шаг 5: Python скрипт загружен (${pythonCode.length} символов) - ${new Date(Date.now()).toISOString()}`);

    // Execute the Python code
    await pyodide.runPythonAsync(pythonCode);

    // Get the main workflow function
    const workflowFunction = pyodide.globals.get('analyze_ozon_product');
    if (!workflowFunction) {
      throw new Error('Main workflow function analyze_ozon_product not found in Python script');
    }

    // Execute the workflow with detailed logging
    logInfo('EXECUTION', `Шаг 6: Вызов Python функции analyze_ozon_product - ${new Date(Date.now()).toISOString()}`);

    // === НОВАЯ СИСТЕМА ПЕРЕДАЧИ ДАННЫХ ЧЕРЕЗ PYODIDE.GLOBALS ===
    logDebug('PYODIDE', 'Starting data transmission to Pyodide globals');

    // Проверить, есть ли page_html в workflowPayload
    if (workflowPayload.page_html && typeof workflowPayload.page_html === 'object' && workflowPayload.page_html.__isChunkedString) {
      logInfo('PYODIDE', 'Detected chunk data for transmission');

      // Извлечь метаданные из chunk структуры
      const chunkMetadata = workflowPayload.page_html;
      const chunkCount = chunkMetadata.chunkCount;

      // Установить метаданные в Pyodide globals
      pyodide.globals.set('page_html_chunk_count', chunkCount);
      pyodide.globals.set('page_html_total_length', chunkMetadata.totalLength);

      // Установить все чанки в Pyodide globals
      for (let i = 0; i < chunkCount; i++) {
        const chunkKey = `page_html_chunk_${i}`;
        const chunkValue = workflowPayload[chunkKey] || '';
        pyodide.globals.set(chunkKey, chunkValue);
      }
      logInfo('PYODIDE', `All ${chunkCount} chunks set in globals`);

    } else {
      logInfo('PYODIDE', 'No chunk data found, using direct transmission');

      // Fallback: установить page_html напрямую если нет chunks
      if (workflowPayload.page_html && typeof workflowPayload.page_html === 'string') {
        pyodide.globals.set('page_html', workflowPayload.page_html);
        logInfo('PYODIDE', `page_html set directly, length: ${workflowPayload.page_html.length}`);
      } else {
        logWarn('PYODIDE', 'page_html not found or has wrong type');
      }
    }

    // Вызвать Python функцию БЕЗ аргументов - данные уже в globals
    logInfo('PYODIDE', 'Calling Python function analyze_ozon_product()');

    let resultProxy;
    try {
      console.log('[DIAGNOSTIC] Starting call to analyze_ozon_product()');
      resultProxy = await pyodide.runPythonAsync('analyze_ozon_product()');
      console.log('[DIAGNOSTIC] Call to analyze_ozon_product() completed, received result proxy');
      logInfo('PYODIDE', 'Python function called successfully');
    } catch (callError) {
      console.error('[DIAGNOSTIC] Call to analyze_ozon_product() failed:', callError);
      throw callError;
    }

    let result;
    if (resultProxy) {
      // Проверяем, есть ли метод toJs
      const hasToJs = typeof resultProxy.toJs === 'function';
      if (hasToJs) {
        try {
          result = resultProxy.toJs({ dict_converter: Object.fromEntries });
          console.log('[DIAGNOSTIC] toJs() conversion successful');
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
          console.error('[DIAGNOSTIC] toJs() conversion failed:', conversionError);
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

    logInfo('EXECUTION', `Шаг 7: Python функция выполнена успешно - ${new Date(Date.now()).toISOString()}`);
    logInfo('EXECUTION', 'Workflow-engine executed successfully');

    // Send success message to chat - immediate отправка
    const successMessageId = `pyodide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    chrome.runtime.sendMessage({
      type: 'PYODIDE_MESSAGE',
      messageId: successMessageId,
      pluginId: pluginId,
      pageKey: pageKey,
      message: {
        role: 'plugin',
        content: `✅ Workflow выполнена успешно с собранными данными.`,
        timestamp: Date.now()
      }
    });
    logInfo('EXECUTION', `Success сообщение отправлено immediate с ID: ${successMessageId}`);

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
    logDebug('EXECUTION', `Response payload: ${JSON.stringify(successResponse).substring(0, 200)}...`);
    trackSendResponse(successResponse);

  } catch (error) {
    logError('EXECUTION', 'Workflow execution failed:', error);
    const errorTime = Date.now();
    logError('EXECUTION', `Workflow завершен с ошибкой за ${errorTime - startTime}мс в ${new Date(errorTime).toISOString()}`);

    // Send error message to chat - immediate отправка
    const errorMessageId = `pyodide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    chrome.runtime.sendMessage({
      type: 'PYODIDE_MESSAGE',
      messageId: errorMessageId,
      pluginId: pluginId,
      pageKey: pageKey,
      message: {
        role: 'plugin',
        content: `❌ Ошибка выполнения workflow: ${error.message}`,
        timestamp: Date.now()
      }
    });
    logError('EXECUTION', `Error сообщение отправлено immediate с ID: ${errorMessageId}`);

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
    trackSendResponse(errorResponse);
  }
}

// Handle messages from background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  const messageId = message.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  logInfo('CHANNEL', `📨 OFFSCREEN MESSAGE RECEIVED: type=${message.type}, messageId=${messageId}, timestamp=${new Date().toISOString()}`);

  // Track response status
  let responseSent = false;
  const trackSendResponse = (response) => {
    if (responseSent) {
      logWarn('CHANNEL', `DUPLICATE sendResponse call for messageId=${messageId}, type=${message.type}`);
      return;
    }
    responseSent = true;
    logInfo('CHANNEL', `📤 OFFSCREEN RESPONSE SENT: type=${message.type}, messageId=${messageId}, success=${response?.success !== false}`);
    sendResponse(response);
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

    return true;
  }

  // Handle transfer status check from background
  if (message.type === 'CHECK_TRANSFER_STATUS') {
    const { transferId } = message;
    const transfer = htmlTransfers.get(transferId);

    return {
      transferExists: !!transfer,
      assembledNotified: transfer?.assembledNotified || false,
      completed: transfer?.completed || false
    };
  }

  // Handle PING messages for health checks
  if (message.type === 'PING') {
    const pingResponse = { pong: true, timestamp: Date.now() };
    logDebug('CHANNEL', `PING received, sending PONG response`);
    trackSendResponse(pingResponse);
    return true;
  }

  // Handle chunked messages first
  if (message.type === 'HTML_CHUNK' || message.type === 'HTML_CHUNK_COMPLETE' || message.type === 'START_WORKFLOW_AFTER_CHUNKS') {
    return handleChunkedMessage(message, sendResponse);
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

  try {
   // Initialize Pyodide if needed
   if (!pyodide) {
    logInfo('EXECUTION', 'Initializing Pyodide...');
    await initializePyodide();
   }

    // Extract workflow parameters (уже определены выше)
    const transferId = message.transferId;
    const useChunks = message.useChunks || false;

    // ОБНОВИТЬ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ JS BRIDGE - ИСПРАВЛЕНИЕ HARDCODED PAGEKEY
    currentPluginId = pluginId;
    currentPageKey = pageKey;

    // ПОЛУЧАЕМ HTML ДАННЫЕ ИЗ CHUNKS ИЛИ НАПРЯМУЮ
    let workflowPayload;
    if (useChunks && transferId) {
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
    } else if (message.pageHtml) {
      // ПРЯМАЯ ПЕРЕДАЧА HTML ДАННЫХ (FALLBACK)
      workflowPayload = { page_html: message.pageHtml };
      logInfo('EXECUTION', `Using direct pageHtml from message: ${message.pageHtml.length} chars`);
    } else {
      throw new Error('No HTML data provided - neither chunks nor direct pageHtml available');
    }

     logInfo('EXECUTION', `Starting workflow-engine with pluginId: ${pluginId}`);

     // Send progress message to chat - immediate отправка
     const workflowProgressMessageId = `pyodide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
     chrome.runtime.sendMessage({
       type: 'PYODIDE_MESSAGE',
       messageId: workflowProgressMessageId,
       pluginId: pluginId,
       pageKey: pageKey,
       message: {
         role: 'plugin',
         content: '🔄 Запуск выполнения workflow с chunk данными...',
         timestamp: Date.now()
       }
     });
     logInfo('EXECUTION', `Workflow progress сообщение отправлено immediate с ID: ${workflowProgressMessageId}`);

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
     logInfo('EXECUTION', `Шаг 8: Запуск executeWorkflowWithChunks - ${new Date(Date.now()).toISOString()}`);
     const result = await executeWorkflowWithChunks(pluginId, pageKey, workflowPayload, requestId, sendResponse);
     logInfo('EXECUTION', `Шаг 9: executeWorkflowWithChunks завершен - ${new Date(Date.now()).toISOString()}`);
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
    trackSendResponse(errorResponse);
  }

   return true; // Keep channel open for async response
 }

  return false;
});

logInfo('SYSTEM', 'Offscreen document ready, waiting for messages...');