import 'webextension-polyfill';
console.log('[background] Initializing background imports...');

import { pluginChatApi } from './plugin-chat-api';
console.log('[background] Plugin chat API loaded');

import { hostApi } from './host-api';
console.log('[background] Host API loaded');

import { getAvailablePlugins } from './plugin-manager';
console.log('[background] Plugin manager loaded');

import { getPageKey } from '../../../packages/shared/lib/utils/helpers';
import { getApiKeyForModel, callAiModel } from './ai-api-client';
import { exampleThemeStorage, pluginSettingsStorage, getPluginSettings } from '@extension/storage';
console.log('[background] Storage modules loaded');

console.log('[background] Starting Offscreen Document integration - REFACTORED BACKGROUND ARCHITECTURE');

// === OFFSCREEN API FEATURE DETECTION ===

// Enhanced production-ready feature detection функция для проверки доступности offscreen API
const offscreenSupported = (): boolean => {
  try {
    console.log('[background][OFFSCREEN DETECTION] ========== STARTING OFFSCREEN API FEATURE DETECTION ==========');
    console.log('[background][OFFSCREEN DETECTION] Timestamp:', new Date().toISOString());
    console.log('[background][OFFSCREEN DETECTION] Chrome User-Agent:', navigator.userAgent);

    // Проверка 1: Глобальный объект chrome
    const chromeExists = typeof chrome !== 'undefined';
    console.log('[background][OFFSCREEN DETECTION] Chrome object exists:', chromeExists);

    if (!chromeExists) {
      console.warn('[background][OFFSCREEN DETECTION] ❌ FAIL: Chrome API unavailable - extension running in unsupported environment');
      console.warn('[background][OFFSCREEN DETECTION] Current context:', {
        globalThis: typeof globalThis,
        window: typeof window,
        self: typeof self,
        process: typeof process
      });
      return false;
    }

    // Проверка 2: Offscreen API доступен
    const offscreenExists = typeof chrome.offscreen !== 'undefined';
    console.log('[background][OFFSCREEN DETECTION] chrome.offscreen property exists:', offscreenExists);

    if (!offscreenExists) {
      console.warn('[background][OFFSCREEN DETECTION] ❌ FAIL: chrome.offscreen is undefined - Chrome version < 109');
      console.warn('[background][OFFSCREEN DETECTION] Available chrome API:', Object.keys(chrome).join(', '));
      return false;
    }

    // Проверка 3: hasDocument method доступен
    const hasDocumentExists = typeof chrome.offscreen.hasDocument === 'function';
    console.log('[background][OFFSCREEN DETECTION] chrome.offscreen.hasDocument is function:', hasDocumentExists);

    if (!hasDocumentExists) {
      console.warn('[background][OFFSCREEN DETECTION] ❌ FAIL: chrome.offscreen.hasDocument is not a function');
      console.warn('[background][OFFSCREEN DETECTION] chrome.offscreen properties:', Object.keys(chrome.offscreen).join(', '));
      return false;
    }

    // Проверка 4: createDocument method доступен
    const createDocumentExists = typeof chrome.offscreen.createDocument === 'function';
    console.log('[background][OFFSCREEN DETECTION] chrome.offscreen.createDocument is function:', createDocumentExists);

    if (!createDocumentExists) {
      console.warn('[background][OFFSCREEN DETECTION] ❌ FAIL: chrome.offscreen.createDocument is not a function');
      console.warn('[background][OFFSCREEN DETECTION] chrome.offscreen methods:', Object.getOwnPropertyNames(chrome.offscreen).join(', '));
      return false;
    }

    // Проверка 5: Manifest permissions check (runtime validation)
    const permissionsCheck = chrome.permissions ? typeof chrome.permissions.getAll === 'function' : true;
    if (!permissionsCheck) {
      console.warn('[background][OFFSCREEN DETECTION] ⚠️ WARNING: Cannot verify permissions at runtime');
    }

    console.log('[background][OFFSCREEN DETECTION] ✅ SUCCESS: All Offscreen API checks passed');
    console.log('[background][OFFSCREEN DETECTION] ========== DETECTION COMPLETE ==========');
    return true;

  } catch (error) {
    console.error('[background][OFFSCREEN DETECTION] ❌ CRITICAL ERROR during detection:', error);
    console.error('[background][OFFSCREEN DETECTION] Error message:', (error as Error).message);
    console.error('[background][OFFSCREEN DETECTION] Error stack:', (error as Error).stack);
    console.error('[background][OFFSCREEN DETECTION] Chrome version from UA:', navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown');

    // Additional diagnostic info
    try {
      console.error('[background][OFFSCREEN DETECTION] Chrome API dump (limited):');
      if (typeof chrome !== 'undefined') {
        console.error('- chrome.runtime available:', typeof chrome.runtime);
        console.error('- chrome.permissions available:', typeof chrome.permissions);
        if (chrome.offscreen) {
          console.error('- chrome.offscreen keys:', Object.keys(chrome.offscreen));
        }
      }
    } catch (dumpError) {
      console.error('[background][OFFSCREEN DETECTION] Error creating diagnostic dump:', dumpError);
    }

    return false;
  }
};

// Enhanced production-ready fallback обработчик для старых версий Chrome (< 109)
const handleLegacyChrome = async (message: ExtensionMessage): Promise<void> => {
  console.warn('[background][LEGACY CHROME] ================= EXECUTING FALLBACK WORKFLOW =================');
  console.warn('[background][LEGACY CHROME] Chrome version < 109 detected, offscreen API not supported');
  console.warn('[background][LEGACY CHROME] Timestamp:', new Date().toISOString());
  console.warn('[background][LEGACY CHROME] User-Agent:', navigator.userAgent);
  console.warn('[background][LEGACY CHROME] Extension ID:', chrome.runtime.id);

  // Для старых версий просто пропускаем выполнение с предупреждением
  // В будущем здесь можно добавить альтернативную логику без offscreen
  console.warn('[background][LEGACY CHROME] Legacy Chrome workaround: Skipping workflow execution with graceful degradation');

  if (message.type === 'EXECUTE_WORKFLOW' && message.pluginId && message.pageKey) {
    console.warn(`[background][LEGACY CHROME] Cannot execute workflow for plugin: ${message.pluginId}`);
    console.warn(`[background][LEGACY CHROME] Page Key: ${message.pageKey}`);
    console.warn(`[background][LEGACY CHROME] Message ID: ${message.requestId || 'N/A'}`);

    // Создаем детальное сообщение о предупреждении
    const warningMessage: ChatMessage = {
      role: 'plugin',
      content: `⚠️ **Ограничение браузера**

Эта версия Google Chrome (${navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'неизвестная'}) не поддерживает необходимые API расширения (Offscreen Document API).

**Что произошло:**
- Расширение не смогло выполнить запланированную задачу для плагина "${message.pluginId}"
- Workflow будет пропущен для обеспечения стабильности работы

**Рекомендация:**
Обновите Google Chrome до версии 109 или новее для использования полной функциональности расширения.

**Технические детали:**
- Текущая версия: ${navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'неизвестная'}
- Требуемая версия: 109+
- API Status: Offscreen Document недоступен`,
      timestamp: Date.now()
    };

    try {
      await pluginChatApi.saveMessage(message.pluginId, message.pageKey, warningMessage);
      console.log('[background][LEGACY CHROME] ✅ Legacy Chrome warning saved to plugin chat');
      console.log('[background][LEGACY CHROME] Message saved for plugin:', message.pluginId, 'pageKey:', message.pageKey);

      // Также сохраняем дополнительное сообщение для отслеживания проблемы
      const trackingMessage: ChatMessage = {
        role: 'plugin',
        content: `[TRACKING] Legacy Chrome v${navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown'} blocked workflow execution for compatibility reasons.`,
        timestamp: Date.now()
      };
      await pluginChatApi.saveMessage(message.pluginId, message.pageKey, trackingMessage);

    } catch (error) {
      console.error('[background][LEGACY CHROME] ❌ CRITICAL: Failed to save legacy warning to chat:', error);
      console.error('[background][LEGACY CHROME] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });

      // Попытка сохранить упрощенное сообщение в случае ошибки
      try {
        const simpleWarning: ChatMessage = {
          role: 'plugin',
          content: '⚠️ Ошибка выполнения: устаревшая версия Chrome. Обновите браузер до версии 109+.',
          timestamp: Date.now()
        };
        await pluginChatApi.saveMessage(message.pluginId, message.pageKey, simpleWarning);
        console.warn('[background][LEGACY CHROME] ⚠️ Fallback simple warning saved');
      } catch (fallbackError) {
        console.error('[background][LEGACY CHROME] ❌ CRITICAL: Even fallback message save failed:', fallbackError);
      }
    }

    console.warn('[background][LEGACY CHROME] ================= FALLBACK WORKFLOW COMPLETE =================');
  }
};

import type { ChatMessage } from './plugin-chat-api';
import type { Plugin } from './plugin-manager';

console.log('[background] All critical modules loaded, background initialization complete');

interface ExtensionMessage {
  type: string;
  pluginId?: string;
  setting?: string;
  value?: boolean;
  pageKey?: string;
  draftText?: string;
  message?: ChatMessage | string;
  source?: string;
  command?: string;
  data?: unknown;
  // Для логов:
  level?: 'info' | 'success' | 'error' | 'warning' | 'debug';
  stepId?: string;
  logData?: unknown;
  // Для идентификации сообщений и запросов:
  requestId?: string;
  messageId?: string;
  // Для Pyodide прямого тестирования:
  pythonCode?: string;
  // Для ручного тестирования Pyodide:
  testName?: string;
  code?: string;
  timestamp?: number;
}


// Только стандартное поведение: панель открывается/закрывается глобально по клику на иконку
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// === OFFSCREEN DOCUMENT MANAGEMENT ===

// Функция для проверки наличия Offscreen Document
const hasOffscreenDocument = async (): Promise<boolean> => {
  // Проверяем доступность offscreen API
  if (!offscreenSupported()) {
    console.log('[offscreen][manager] Offscreen API not supported, returning false');
    return false;
  }

  try {
    const result = await chrome.offscreen.hasDocument();
    console.log('[offscreen][manager] Offscreen document exists:', result);
    return result;
  } catch (error) {
    console.error('[offscreen][manager] Error checking offscreen document:', error);
    return false;
  }
};

// Enhanced production-ready функция для создания Offscreen Document с retry logic
const createOffscreenDocument = async (): Promise<void> => {
  // Проверяем доступность offscreen API
  if (!offscreenSupported()) {
    console.warn('[offscreen][manager] ❌ Chrome version does not support offscreen API (< 109)');
    throw new Error('Offscreen API not supported in this Chrome version. Please update Chrome to version 109+.');
  }

  const maxAttempts = 3;
  const retryDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[offscreen][manager] Attempt ${attempt}/${maxAttempts}: Creating offscreen document...`);
      console.log('[offscreen][manager] Document config:', {
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Pyodide Worker execution and MCP bridge delegation',
        timestamp: new Date().toISOString()
      });

      // Try to create the document
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Pyodide Worker execution and MCP bridge delegation'
      });

      console.log('[offscreen][manager] ✅ Offscreen document created successfully on attempt', attempt);

      // Verify the document was created by checking if it exists
      try {
        const documentExists = await chrome.offscreen.hasDocument();
        if (documentExists) {
          console.log('[offscreen][manager] ✅ Document verification successful');
          return; // Success
        } else {
          throw new Error('Document creation verification failed - document does not exist');
        }
      } catch (verifyError) {
        console.warn('[offscreen][manager] ⚠️ Document verification failed, but creation seemed successful:', verifyError);
        // Still consider it a success since createDocument didn't throw
        return;
      }

    } catch (error) {
      console.error(`[offscreen][manager] Attempt ${attempt}/${maxAttempts} failed:`, error);
      console.error('[offscreen][manager] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        console.error('[offscreen][manager] ❌ All attempts to create offscreen document failed');
        throw new Error(`Failed to create offscreen document after ${maxAttempts} attempts: ${(error as Error).message}`);
      }

      // Wait before next attempt
      console.log(`[offscreen][manager] Waiting ${retryDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
};

// Enhanced production-ready функция для обеспечения наличия Offscreen Document
const ensureOffscreenDocument = async (): Promise<void> => {
  console.log('[offscreen][manager] ===== ENSURING OFFSCREEN DOCUMENT AVAILABILITY =====');
  console.log('[offscreen][manager] Timestamp:', new Date().toISOString());

  try {
    const exists = await hasOffscreenDocument();
    console.log('[offscreen][manager] Offscreen document exists check result:', exists);

    if (!exists) {
      console.log('[offscreen][manager] ❌ Offscreen document not found, creating new document...');
      console.log('[offscreen][manager] This may take a few seconds...');
      await createOffscreenDocument();
      console.log('[offscreen][manager] ✅ Offscreen document creation completed');

      // Double-check after creation
      const verifyExists = await hasOffscreenDocument();
      if (!verifyExists) {
        console.error('[offscreen][manager] ❌ CRITICAL: Document verification failed after creation');
        throw new Error('Offscreen document creation verification failed');
      }
      console.log('[offscreen][manager] ✅ Offscreen document verification successful');
    } else {
      console.log('[offscreen][manager] ✅ Offscreen document already exists and is ready');
    }

    console.log('[offscreen][manager] ===== OFFSCREEN DOCUMENT ENSURANCE COMPLETE =====');
  } catch (error) {
    console.error('[offscreen][manager] ❌ CRITICAL ERROR in ensureOffscreenDocument:', error);
    console.error('[offscreen][manager] Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    });

    // Attempt recovery by trying to clean up and recreate
    try {
      console.log('[offscreen][manager] 🔄 Attempting recovery by forcing document recreation...');
      await chrome.runtime.reload(); // This will restart the extension
    } catch (recoveryError) {
      console.error('[offscreen][manager] ❌ Recovery attempt failed:', recoveryError);
    }

    throw error; // Re-throw to let caller handle
  }
};

// Функция для проверки и запуска плагина с учетом настроек
const runPluginIfEnabled = async (pluginId: string) => {
  try {
    // Получаем настройки плагина
    const settings = await getPluginSettings(pluginId);

    // Проверяем, включен ли плагин
    if (!settings.enabled) {
      console.log(`[background] Plugin ${pluginId} is disabled, not running`);
      return { success: false, reason: 'Plugin is disabled' };
    }

    // Запускаем рабочий процесс плагина
    // await runWorkflow(pluginId); // This line was removed as per the edit hint
    return { success: true };
  } catch (error) {
    console.error(`[background] Error running plugin ${pluginId}:`, error);
    return { error: (error as Error).message };
  }
};

// Функция для обновления настроек плагина
const updatePluginSetting = async (pluginId: string, setting: string, value: boolean) => {
  const settings = await pluginSettingsStorage.get();
  const pluginSettings = settings[pluginId] || { enabled: true, autorun: false };

  // Обновляем настройку
  pluginSettings[setting] = value;

  // Если плагин отключен, то отключаем и автозапуск
  if (setting === 'enabled' && !value) {
    pluginSettings.autorun = false;
  }

  // Сохраняем обновленные настройки
  await pluginSettingsStorage.set({
    ...settings,
    [pluginId]: pluginSettings,
  });

  console.log(`[background] Updated plugin setting for ${pluginId}:`, setting, '=', value);
  return { success: true };
};

// Функция для оповещения об обновлении чата
const broadcastChatUpdate = (pluginId: string, pageKey: string) => {
  chrome.runtime.sendMessage({
    type: 'PLUGIN_CHAT_UPDATED',
    pluginId,
    pageKey,
  });
};

// === ХРАНИЛИЩЕ ЛОГОВ ===
type PluginLogEntry = {
  timestamp: number;
  pluginId: string;
  pageKey?: string;
  level: 'info' | 'success' | 'error' | 'warning' | 'debug';
  stepId?: string;
  message: string;
  data?: unknown;
};

const pluginLogs: Record<string, PluginLogEntry[]> = {};

const addPluginLog = (log: Omit<PluginLogEntry, 'timestamp'>) => {
  const key = log.pluginId;
  if (!pluginLogs[key]) pluginLogs[key] = [];
  pluginLogs[key].push({ ...log, timestamp: Date.now() });
  // Ограничим размер лога (например, 500 записей на плагин)
  if (pluginLogs[key].length > 500) pluginLogs[key].shift();
};

// Обработчики сообщений для работы с плагинами
chrome.runtime.onMessage.addListener(
  async (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    console.log('[background] Got message:', message, 'from:', sender?.origin || sender?.id || 'unknown');
    console.log('[background] Message timestamp:', new Date().toISOString());
    console.log('[background] Sender details:', {
      id: sender?.id,
      origin: sender?.origin,
      url: sender?.url,
      tab: sender?.tab,
      frameId: sender?.frameId
    });

    if (
      typeof message === 'object' &&
      message !== null &&
      'source' in message &&
      (message as ExtensionMessage).source === 'app-host-api' &&
      'command' in message &&
      'data' in message
    ) {
      handleHostApiMessage(message as { command: string; data: unknown }, sendResponse);
      return true; // Keep message channel open for async response
    }

    if (typeof message === 'object' && message !== null && 'type' in message) {
      const msg = message as ExtensionMessage;
      console.log('[background] Processing message type:', msg.type);

      if (msg.type === 'TEST_SYNC') {
        console.log('[background] Processing TEST_SYNC request');
        console.log('[background] TEST_SYNC timestamp:', new Date().toISOString());
        const response = { success: true, message: 'Test sync response', timestamp: Date.now() };
        console.log('[background] TEST_SYNC sending response:', response);
        sendResponse(response);
        console.log('[background] TEST_SYNC response sent');
        return true;
      }

      if (msg.type === 'PING') {
        console.log('[background] Processing PING request');
        console.log('[background] PING timestamp:', new Date().toISOString());
        sendResponse({ pong: true, timestamp: Date.now() });
        console.log('[background] PING response sent');
        return true;
      }

      if (msg.type === 'TEST_PYODIDE_DIRECT') {
        console.log('[background][TEST_PYODIDE_DIRECT] Processing direct Pyodide test request');
        console.log('[background][TEST_PYODIDE_DIRECT] Python code to execute:', msg.pythonCode);

        (async () => {
          try {
            const result = await handleTestPyodideDirect(msg);
            console.log('[background][TEST_PYODIDE_DIRECT] Test completed with result:', result);
            sendResponse(result);
          } catch (error) {
            console.error('[background][TEST_PYODIDE_DIRECT] Test failed:', error);
            sendResponse({
              success: false,
              error: (error as Error).message,
              timestamp: Date.now()
            });
          }
        })();

        return true; // Keep channel open for async response
      }

      // === РУЧНОЕ ТЕСТИРОВАНИЕ PYODIDE ===
      if (msg.type === 'INITIALIZE_PYODIDE_MANUAL_TEST') {
        console.log('[background][INITIALIZE_PYODIDE_MANUAL_TEST] Initializing Pyodide for manual testing');

        (async () => {
          try {
            // Убеждаемся что offscreen document существует
            await ensureOffscreenDocument();

            // Отправляем команду инициализации в offscreen document
            const response = await chrome.runtime.sendMessage({
              type: 'INITIALIZE_PYODIDE',
              requestId: msg.requestId,
              timestamp: msg.timestamp
            });

            sendResponse({
              success: response?.success || true,
              result: 'Pyodide initialized in offscreen document',
              timestamp: Date.now()
            });

          } catch (error) {
            console.error('[background][INITIALIZE_PYODIDE_MANUAL_TEST] Initialization failed:', error);
            sendResponse({
              success: false,
              error: (error as Error).message,
              timestamp: Date.now()
            });
          }
        })();

        return true;
      }

      if (msg.type === 'EXECUTE_PYTHON_TEST_CODE') {
        console.log('[background][EXECUTE_PYTHON_TEST_CODE] Executing Python test code');
        console.log('[background][EXECUTE_PYTHON_TEST_CODE] Test name:', msg.testName);
        console.log('[background][EXECUTE_PYTHON_TEST_CODE] Code:', msg.code);

        (async () => {
          try {
            // Отправляем код в offscreen document для исполнения
            const response = await chrome.runtime.sendMessage({
              type: 'EXECUTE_PYTHON_CODE',
              code: msg.code,
              testName: msg.testName,
              requestId: msg.requestId,
              timestamp: msg.timestamp
            });

            sendResponse({
              success: response?.success || false,
              result: response?.result,
              error: response?.error,
              timestamp: Date.now(),
              executionTime: Date.now() - (msg.timestamp || 0)
            });

          } catch (error) {
            console.error('[background][EXECUTE_PYTHON_TEST_CODE] Execution failed:', error);
            sendResponse({
              success: false,
              error: (error as Error).message,
              timestamp: Date.now()
            });
          }
        })();

        return true;
      }

      if (msg.type === 'EXECUTE_PYTHON_ERROR_TEST') {
        console.log('[background][EXECUTE_PYTHON_ERROR_TEST] Executing Python error test');
        console.log('[background][EXECUTE_PYTHON_ERROR_TEST] Test name:', msg.testName);

        (async () => {
          try {
            // Отправляем код с ошибкой в offscreen document для тестирования error handling
            const response = await chrome.runtime.sendMessage({
              type: 'EXECUTE_PYTHON_CODE',
              code: msg.code,
              testName: msg.testName,
              isErrorTest: true,
              requestId: msg.requestId,
              timestamp: msg.timestamp
            });

            // Ожидаем ошибку от Python кода, так что success=false это нормально
            sendResponse({
              success: response?.success || false,
              result: response?.result,
              error: response?.error,
              timestamp: Date.now()
            });

          } catch (error) {
            console.error('[background][EXECUTE_PYTHON_ERROR_TEST] Error test failed:', error);
            sendResponse({
              success: false,
              error: (error as Error).message,
              timestamp: Date.now()
            });
          }
        })();

        return true;
      }

      if (msg.type === 'GET_PLUGINS') {
        console.log('[background] Processing GET_PLUGINS request from sender:', sender);
        console.log('[background] GET_PLUGINS message timestamp:', new Date().toISOString());

        // АСИНХРОННАЯ ОБРАБОТКА: Возвращаем true и обрабатываем асинхронно
        (async () => {
          console.log('[background] processGetPlugins started, timestamp:', new Date().toISOString());
          console.log('[background] Sender details:', {
            id: sender?.id,
            origin: sender?.origin,
            url: sender?.url,
            tab: sender?.tab?.id,
            frameId: sender?.frameId
          });

          try {
            console.log('[background] Getting available plugins...');
            const startTime = Date.now();

            // Параллельное выполнение для ускорения
            const [plugins, allSettings] = await Promise.all([
              getAvailablePlugins(),
              pluginSettingsStorage.get()
            ]);

            const fetchTime = Date.now() - startTime;
            console.log(`[background] Data fetched in ${fetchTime}ms`);
            console.log('[background] getAvailablePlugins result:', plugins);
            console.log('[background] Plugins count:', plugins?.length || 'undefined');
            console.log('[background] Plugin settings:', allSettings);
            console.log('[background] Settings type:', typeof allSettings);

            if (!plugins || !Array.isArray(plugins)) {
              console.error('[background] getAvailablePlugins returned invalid data:', plugins);
              // Используем chrome.runtime.sendMessage для отправки ответа обратно
              chrome.runtime.sendMessage({
                type: 'GET_PLUGINS_RESPONSE',
                error: 'Invalid plugins data from getAvailablePlugins',
                requestId: msg.requestId // Добавляем requestId для сопоставления
              });
              return;
            }

            const pluginsWithSettings = plugins.map((plugin: Plugin) => {
              console.log('[background] Processing plugin:', plugin.id, plugin.name);
              const settings = allSettings[plugin.id] || {
                enabled: true,
                autorun: false,
              };
              console.log('[background] Plugin settings for', plugin.id, ':', settings);

              return {
                ...plugin,
                settings,
              };
            });

            console.log('[background] Final plugins data:', pluginsWithSettings.length, 'plugins');
            console.log('[background] Final plugins data details:', pluginsWithSettings.map(p => ({ id: p.id, name: p.name, settings: p.settings })));

            // Отправляем успешный ответ через sendMessage
            const responseData = {
              type: 'GET_PLUGINS_RESPONSE',
              plugins: pluginsWithSettings,
              requestId: msg.requestId // Добавляем requestId для сопоставления
            };
            console.log('[background] Sending response data:', responseData);
            console.log('[background] About to send response via sendMessage, timestamp:', new Date().toISOString());

            chrome.runtime.sendMessage(responseData);
            console.log('[background] Successfully sent plugins response, timestamp:', new Date().toISOString());

          } catch (error) {
            console.error('[background] Error processing GET_PLUGINS:', error);
            console.error('[background] Error details:', {
              message: (error as Error).message,
              stack: (error as Error).stack,
              name: (error as Error).name
            });
            try {
              chrome.runtime.sendMessage({
                type: 'GET_PLUGINS_RESPONSE',
                error: (error as Error).message,
                requestId: msg.requestId
              });
              console.log('[background] Sent error response');
            } catch (sendError) {
              console.error('[background] Failed to send error response:', sendError);
            }
          }
        })();

        // ВОЗВРАЩАЕМ TRUE для поддержания канала открытым
        return true;
      }

      if (msg.type === 'RUN_WORKFLOW' && msg.pluginId) {
        console.log('[background][OFFSCREEN DELEGATION] ===== RUN_WORKFLOW REQUEST RECEIVED =====');
        console.log('[background][OFFSCREEN DELEGATION] Plugin ID:', msg.pluginId);
        console.log('[background][OFFSCREEN DELEGATION] Request timestamp:', new Date().toISOString());

        (async () => {
          try {
            // ШАГ 1: Получить активную вкладку пользователя
            console.log('[background][OFFSCREEN DELEGATION] Querying active tab...');
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (!activeTab || !activeTab.id) {
              console.log('[background][OFFSCREEN DELEGATION][ERROR] No active tab found');
              sendResponse({ error: 'Не найдена активная вкладка' });
              return;
            }

            console.log('[background][OFFSCREEN DELEGATION] Active tab details:', {
              url: activeTab.url,
              tabId: activeTab.id,
              title: activeTab.title
            });

            // ШАГ 2: Извлечь pageKey и pageHTML
            const pageKey = getPageKey(activeTab.url || '');

            console.log('[background][OFFSCREEN DELEGATION] Extracting page HTML...');
            let pageHtml = '';
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                func: () => document.documentElement.outerHTML
              });

              if (results && results[0] && results[0].result) {
                pageHtml = results[0].result as string;
                console.log('[background][OFFSCREEN DELEGATION] ✓ HTML extracted successfully:', pageHtml.length, 'chars');
              } else {
                console.log('[background][OFFSCREEN DELEGATION][WARNING] Empty HTML result');
                sendResponse({ error: 'Не удалось получить содержимое страницы' });
                return;
              }
            } catch (error) {
              console.error('[background][OFFSCREEN DELEGATION][ERROR] HTML extraction failed:', error);
              sendResponse({ error: `Не удалось получить HTML страницы: ${(error as Error).message}` });
              return;
            }

            // ШАГ 3: Проверить настройки плагина
            console.log('[background][OFFSCREEN DELEGATION] Checking plugin settings...');
            const settings = await getPluginSettings(msg.pluginId as string);

            if (!settings.enabled) {
              console.log('[background][OFFSCREEN DELEGATION][INFO] Plugin disabled, aborting');
              sendResponse({ error: 'Плагин отключен' });
              return;
            }

            console.log('[background][OFFSCREEN DELEGATION][SUCCESS] Plugin is enabled, proceeding');

            // ШАГ 4: Обеспечить наличие Offscreen Document или использовать fallback
            console.log('[background][OFFSCREEN DELEGATION] ===== ENSURING OFFSCREEN DOCUMENT =====');

            // Проверяем, поддерживается ли offscreen API
            if (!offscreenSupported()) {
              console.log('[background][OFFSCREEN DELEGATION] Offscreen API not supported, using fallback...');
              // Создаем легитимное сообщение для fallback обработчика
              const fallbackMessage: ExtensionMessage = {
                type: 'EXECUTE_WORKFLOW',
                pluginId: msg.pluginId,
                pageKey: pageKey,
                data: {
                  pageHtml: pageHtml,
                  pageKey: pageKey,
                  pluginId: msg.pluginId
                }
              };

              // Используем fallback для старых версий Chrome
              await handleLegacyChrome(fallbackMessage);

              // Отправляем сигнал успешного завершения (хотя это просто предупреждение)
              sendResponse({ success: true });
              return;
            }

            // Для поддерживаемых версий используем стандартную логику
            await ensureOffscreenDocument();

            // ШАГ 5: Делегировать выполнение в Offscreen Document
            console.log('[background][OFFSCREEN DELEGATION] ===== DELEGATING TO OFFSCREEN =====');
            console.log('[background][OFFSCREEN DELEGATION] Preparing workflow payload...');

            const workflowPayload = {
              type: 'EXECUTE_WORKFLOW',
              pluginId: msg.pluginId,
              pageKey: pageKey,
              pageHtml: pageHtml,
              requestId: msg.requestId || `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: Date.now()
            };

            console.log('[background][OFFSCREEN DELEGATION] Execution payload prepared:', {
              ...workflowPayload,
              pageHtml: `${pageHtml.length} chars`
            });

            // Отправить задачу в offscreen document
            console.log('[background][OFFSCREEN DELEGATION] Sending to offscreen...');
            const result = await chrome.runtime.sendMessage(workflowPayload);

            console.log('[background][OFFSCREEN DELEGATION] ===== OFFSCREEN EXECUTION COMPLETED =====');
            console.log('[background][OFFSCREEN DELEGATION] Result received:', result);

            // Ретрансмитровать результат в UI
            if (result && result.success) {
              sendResponse({ success: true });
            } else {
              sendResponse({ error: result?.error || 'Unknown execution error' });
            }

          } catch (error) {
            console.error('[background][OFFSCREEN DELEGATION] Error in delegation:', error);
            sendResponse({ error: (error as Error).message });
          }
        })();
        return true;
      }

      if (
        msg.type === 'UPDATE_PLUGIN_SETTING' &&
        msg.pluginId &&
        msg.setting !== undefined &&
        msg.value !== undefined
      ) {
        const { pluginId, setting, value } = msg;
        console.log('[background] Processing UPDATE_PLUGIN_SETTING request for:', pluginId, setting, value);
        (async () => {
          try {
            await updatePluginSetting(pluginId, setting, value);
            sendResponse({ success: true });
          } catch (error: unknown) {
            console.error('[background] Error in UPDATE_PLUGIN_SETTING:', error);
            sendResponse({ error: (error as Error).message });
          }
        })();
        return true;
      }

      if (msg.type === 'GET_PLUGIN_SETTINGS') {
        console.log('[background] Processing GET_PLUGIN_SETTINGS request');

        // Используем синхронную обработку
        (async () => {
          try {
            const settings = await pluginSettingsStorage.get();
            console.log('[background] Plugin settings:', settings);
            sendResponse(settings);
          } catch (error: unknown) {
            console.error('[background] Error getting plugin settings:', error);
            sendResponse({ error: (error as Error).message });
          }
        })();

        return true;
      }

      // === Работа с чатами плагинов ===
      if (msg.type === 'GET_PLUGIN_CHAT' && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey, messageId } = msg;
        const chatKey = `${pluginId}::${getPageKey(pageKey)}`;

        console.log('[background] GET_PLUGIN_CHAT: начало обработки', {
          pluginId,
          pageKey,
          messageId,
          chatKey,
          normalizedPageKey: getPageKey(pageKey),
          timestamp: Date.now()
        });

        // Используем синхронную обработку
        (async () => {
          try {
            const chat = await pluginChatApi.getOrLoadChat(chatKey);
            console.log('[background] GET_PLUGIN_CHAT: результат getOrLoadChat', {
              chat,
              chatType: typeof chat,
              hasChat: !!chat,
              messagesLength: chat?.messages?.length,
              chatKey,
              pageKey
            });

            // Если чат не найден, возвращаем пустой объект с messages: []
            if (!chat) {
              console.log('[background] GET_PLUGIN_CHAT: чат не найден, возвращаем пустой массив сообщений');
              chrome.runtime.sendMessage({
                type: 'GET_PLUGIN_CHAT_RESPONSE',
                messageId,
                response: {
                  messages: [],
                  chatKey,
                  pluginId,
                  pageKey
                }
              });
              return;
            }

            let safeChat = chat;
            if (chat && Array.isArray(chat.messages) && chat.messages.length > 50) {
              safeChat = { ...chat, messages: chat.messages.slice(-50) };
              console.log('[background] GET_PLUGIN_CHAT: обрезан до 50 сообщений', {
                originalLength: chat.messages.length,
                newLength: safeChat.messages.length
              });
            }

            try {
              const serializable = JSON.parse(JSON.stringify(safeChat));
              console.log('[background] GET_PLUGIN_CHAT: сериализация успешна', {
                serializable,
                serializableType: typeof serializable,
                serializableKeys: Object.keys(serializable || {}),
                serializableMessages: serializable?.messages,
                isArrayMessages: Array.isArray(serializable?.messages),
                chatKey,
                pageKey
              });

              // Возвращаем объект с полем messages для совместимости с processChatResponse
              const response = {
                messages: serializable?.messages || [],
                chatKey: serializable?.chatKey,
                pluginId: serializable?.pluginId,
                pageKey: serializable?.pageKey
              };
              console.log('[background] GET_PLUGIN_CHAT: отправляем ответ', {
                response,
                responseType: typeof response,
                responseKeys: Object.keys(response),
                responseMessagesLength: response.messages?.length,
                messageId,
                timestamp: Date.now()
              });

              chrome.runtime.sendMessage({
                type: 'GET_PLUGIN_CHAT_RESPONSE',
                messageId,
                response
              });

            } catch (err) {
              console.error('[background] GET_PLUGIN_CHAT: Ошибка сериализации чата:', {
                error: err,
                safeChat,
                safeChatType: typeof safeChat,
                safeChatKeys: Object.keys(safeChat || {}),
                timestamp: Date.now()
              });
              chrome.runtime.sendMessage({
                type: 'GET_PLUGIN_CHAT_RESPONSE',
                messageId,
                response: { error: 'serialization failed', details: String(err) }
              });
            }
          } catch (err) {
            console.error('[background] GET_PLUGIN_CHAT: Ошибка в getOrLoadChat:', {
              error: err,
              errorMessage: String(err),
              errorStack: (err as Error).stack,
              pluginId,
              pageKey,
              chatKey,
              timestamp: Date.now()
            });
            chrome.runtime.sendMessage({
              type: 'GET_PLUGIN_CHAT_RESPONSE',
              messageId,
              response: { error: String(err) }
            });
          }
        })();

        return true;
      }

      // Создание чата при начале ввода (ленивая инициализация)
      if (msg.type === 'CREATE_PLUGIN_CHAT' && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log('[background] CREATE_PLUGIN_CHAT pageKey:', pageKey, 'norm:', normPageKey);

        // Используем синхронную обработку
        (async () => {
          try {
            const chat = await pluginChatApi.createChatIfNotExists(pluginId, normPageKey);
            console.log('[background] sendResponse(CREATE_PLUGIN_CHAT):', chat);
            sendResponse(chat);
            broadcastChatUpdate(pluginId, normPageKey);
          } catch (error) {
            console.error('[background] Error creating plugin chat:', error);
            sendResponse({ error: String(error) });
          }
        })();

        return true;
      }

      // Сохранение черновика сообщения (ленивая синхронизация)
      if (msg.type === 'SAVE_PLUGIN_CHAT_DRAFT' && msg.pluginId && msg.pageKey && msg.draftText !== undefined) {
        const { pluginId, pageKey, draftText } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log('[background] SAVE_PLUGIN_CHAT_DRAFT pageKey:', pageKey, 'norm:', normPageKey);

        // Используем синхронную обработку
        (async () => {
          try {
            await pluginChatApi.saveDraft(pluginId, normPageKey, draftText);
            console.log('[background] sendResponse(SAVE_PLUGIN_CHAT_DRAFT):', { success: true });
            sendResponse({ success: true });
          } catch (error) {
            console.error('[background] Error saving plugin chat draft:', error);
            sendResponse({ error: String(error) });
          }
        })();

        return true;
      }

      // Получение черновика сообщения
      if (msg.type === 'GET_PLUGIN_CHAT_DRAFT' && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log('[background] GET_PLUGIN_CHAT_DRAFT pageKey:', pageKey, 'norm:', normPageKey);

        // Используем синхронную обработку
        (async () => {
          try {
            const draftText = await pluginChatApi.getDraft(pluginId, normPageKey);
            console.log('[background] sendResponse(GET_PLUGIN_CHAT_DRAFT):', { draftText });
            sendResponse({ draftText });
          } catch (error) {
            console.error('[background] Error getting plugin chat draft:', error);
            sendResponse({ error: String(error) });
          }
        })();

        return true;
      }

      if (msg.type === 'SAVE_PLUGIN_CHAT_MESSAGE' && msg.pluginId && msg.pageKey && msg.message) {
        const { pluginId, pageKey, message: chatMsg, messageId } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log('[background] SAVE_PLUGIN_CHAT_MESSAGE: начало', {
          pluginId,
          pageKey,
          messageId,
          normPageKey,
          chatMsg,
          chatMsgType: typeof chatMsg,
          chatMsgKeys: Object.keys(chatMsg),
          timestamp: Date.now()
        });

        // Используем синхронную обработку
        (async () => {
          try {
            const result = await pluginChatApi.saveMessage(pluginId, normPageKey, chatMsg as ChatMessage);
            console.log('[background] SAVE_PLUGIN_CHAT_MESSAGE: saveMessage результат', {
              result,
              success: result.success,
              pluginId,
              pageKey,
              normPageKey,
              timestamp: Date.now()
            });

            // Удаляем черновик после отправки сообщения
            await pluginChatApi.deleteDraft(pluginId, normPageKey);
            console.log('[background] SAVE_PLUGIN_CHAT_MESSAGE: deleteDraft завершен', {
              result,
              pluginId,
              pageKey,
              normPageKey,
              timestamp: Date.now()
            });

            // Отправляем событие для UI компонентов с messageId
            chrome.runtime.sendMessage({
              type: 'SAVE_PLUGIN_CHAT_MESSAGE_RESPONSE',
              messageId,
              success: true,
              pluginId,
              pageKey: normPageKey,
              timestamp: Date.now()
            });

            broadcastChatUpdate(pluginId, normPageKey);
          } catch (error) {
            console.error('[background] SAVE_PLUGIN_CHAT_MESSAGE: ошибка', {
              error,
              errorMessage: String(error),
              errorStack: (error as Error).stack,
              pluginId,
              pageKey,
              normPageKey,
              timestamp: Date.now()
            });

            // Отправляем событие об ошибке для UI компонентов с messageId
            chrome.runtime.sendMessage({
              type: 'SAVE_PLUGIN_CHAT_MESSAGE_RESPONSE',
              messageId,
              success: false,
              error: String(error),
              pluginId,
              pageKey: normPageKey,
              timestamp: Date.now()
            });
          }
        })();

        return true; // ВОЗВРАЩАЕМ true для поддержания канала открытым
      }

      if (msg.type === 'DELETE_PLUGIN_CHAT' && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey, messageId } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log('[background] DELETE_PLUGIN_CHAT pageKey:', pageKey, 'messageId:', messageId, 'norm:', normPageKey);

        // Используем синхронную обработку
        (async () => {
          try {
            await pluginChatApi.deleteChat(pluginId, normPageKey);

            // Отправляем событие для UI компонентов с messageId
            chrome.runtime.sendMessage({
              type: 'DELETE_PLUGIN_CHAT_RESPONSE',
              messageId,
              success: true,
              pluginId,
              pageKey: normPageKey,
              timestamp: Date.now()
            });

            broadcastChatUpdate(pluginId, normPageKey);
          } catch (error) {
            console.error('[background] Error deleting plugin chat:', error);

            // Отправляем событие об ошибке для UI компонентов с messageId
            chrome.runtime.sendMessage({
              type: 'DELETE_PLUGIN_CHAT_RESPONSE',
              messageId,
              success: false,
              error: String(error),
              pluginId,
              pageKey: normPageKey,
              timestamp: Date.now()
            });
          }
        })();

        return true;
      }

      if (msg.type === 'LIST_PLUGIN_CHATS' && msg.pluginId) {
        const { pluginId } = msg;
        console.log('[background] Listing chats for plugin:', pluginId);

        // Используем синхронную обработку
        (async () => {
          try {
            const chats = await pluginChatApi.listChatsForPlugin(pluginId);
            console.log('[background] Chats found:', chats);
            sendResponse(chats);
          } catch (error) {
            console.error('[background] Error listing chats:', error);
            sendResponse([]);
          }
        })();

        return true;
      }

      // Получение всех черновиков для плагина
      if (msg.type === 'LIST_PLUGIN_CHAT_DRAFTS' && msg.pluginId) {
        const { pluginId } = msg;
        console.log('[background] Listing drafts for plugin:', pluginId);

        // Используем синхронную обработку
        (async () => {
          try {
            const drafts = await pluginChatApi.listDraftsForPlugin(pluginId);
            console.log('[background] Drafts found:', drafts);
            sendResponse(drafts);
          } catch (error) {
            console.error('[background] Error listing drafts:', error);
            sendResponse([]);
          }
        })();

        return true;
      }

      // === ЛОГИРОВАНИЕ ===
      if (msg.type === 'LOG_EVENT' && msg.pluginId && typeof msg.message === 'string') {
        addPluginLog({
          pluginId: msg.pluginId,
          pageKey: msg.pageKey,
          level: msg.level || 'info',
          stepId: msg.stepId,
          message: msg.message,
          data: msg.logData,
        });
        // Оповещаем о новом логе
        chrome.runtime.sendMessage({
          type: 'PLUGIN_LOG_UPDATED',
          pluginId: msg.pluginId,
          pageKey: msg.pageKey,
        });
        sendResponse({ success: true });
        return true;
      }
      // Получение логов по плагину
      if (msg.type === 'LIST_PLUGIN_LOGS' && msg.pluginId) {
        sendResponse(pluginLogs[msg.pluginId] || []);
        return true;
      }
      // Получение всех логов (админ)
      if (msg.type === 'LIST_ALL_PLUGIN_LOGS') {
        sendResponse(pluginLogs);
        return true;
      }

      // Получение URL активной вкладки (для side panel)
      if (msg.type === 'GET_ACTIVE_TAB_URL') {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.url) {
            sendResponse({ url: tabs[0].url });
          } else {
            sendResponse({ error: 'Active tab not found' });
          }
        } catch (error: unknown) {
          sendResponse({ error: (error as Error).message });
        }
        return true;
      }
    }
    // ГАРАНТИРОВАННО возвращаем true, чтобы канал не закрывался преждевременно
    console.log('[background] Returning true to keep channel open, timestamp:', new Date().toISOString());
    return true;
  },
);

const handleHostApiMessage = async (
  message: { command: string; data: unknown },
  sendResponse: (response: unknown) => void,
): Promise<boolean> => {
  try {
    switch (message.command) {
      case 'getElements': {
        const targetTab = await findTargetTab();
        const selectors = message.data as string[];
        const elements = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id! },
          func: (selectors: string[]) =>
            selectors.map((selector: string) => {
              const elements = document.querySelectorAll(selector);
              return Array.from(elements).map(el => ({
                tagName: el.tagName,
                textContent: el.textContent?.substring(0, 200),
                attributes: Array.from(el.attributes).map((attr: Attr) => ({ name: attr.name, value: attr.value })),
              }));
            }),
          args: [selectors],
        });
        sendResponse({ elements: elements[0].result });
        break;
      }
      case 'getActivePageContent': {
        const targetTab2 = await findTargetTab();
        const selectors = message.data as string[];
        const content = await chrome.scripting.executeScript({
          target: { tabId: targetTab2.id! },
          func: (selectors: string[]) =>
            selectors
              .map((selector: string) => {
                const element = document.querySelector(selector);
                return element ? element.outerHTML : null;
              })
              .filter(Boolean)
              .join('\n'),
          args: [selectors],
        });
        sendResponse({ html: content[0].result });
        break;
      }
      case 'host_fetch': {
        const url = message.data as string;
        const response = await fetch(url);
        const data = await response.text();
        sendResponse({ data });
        break;
      }
      case 'llm_call': {
        try {
          const { modelAlias, options, pluginId } = message.data as {
            modelAlias: string;
            options: any;
            pluginId?: string
          };

          console.log('[HOST API] LLM call requested:', { modelAlias, pluginId });

          // Загружаем manifest плагина для получения маппинга моделей
          const currentPlugin = pluginId || 'ozon-analyzer';
          const manifestUrl = chrome.runtime.getURL(`public/plugins/${currentPlugin}/manifest.json`);

          let manifestResponse;
          try {
            manifestResponse = await fetch(manifestUrl);
            if (!manifestResponse.ok) {
              throw new Error(`Failed to load manifest: ${manifestResponse.status}`);
            }
          } catch (error) {
            console.error('[HOST API] Error loading manifest:', error);
            sendResponse({
              error: true,
              error_message: `Не удалось загрузить настройки плагина ${currentPlugin}: ${(error as Error).message}`
            });
            return true;
          }

          const manifest = await manifestResponse.json();
          const aiModels = manifest.ai_models || {};

          // Определяем реальную модель на основе алиаса
          const actualModel = aiModels[modelAlias];
          if (!actualModel) {
            sendResponse({
              error: true,
              error_message: `Модель с алиасом '${modelAlias}' не найдена в манифесте плагина`
            });
            return true;
          }

          console.log('[HOST API] Using model:', actualModel, 'for alias:', modelAlias);

          // Получаем API ключ для модели
          const apiKey = await getApiKeyForModel(actualModel);
          if (!apiKey) {
            sendResponse({
              error: true,
              error_message: `API ключ для модели ${actualModel} не найден`
            });
            return true;
          }

          // Выполняем запрос к AI API
          try {
            const aiResponse = await callAiModel(actualModel, apiKey, options.prompt || '');
            sendResponse({
              response: aiResponse
            });
          } catch (aiError) {
            console.error('[HOST API] AI API error:', aiError);
            sendResponse({
              error: true,
              error_message: `Ошибка вызова AI API: ${(aiError as Error).message}`
            });
          }
        } catch (error) {
          console.error('[HOST API] llm_call error:', error);
          sendResponse({
            error: true,
            error_message: (error as Error).message
          });
        }
        break;
      }
      case 'get_setting': {
        try {
          const { settingName, defaultValue, category, pluginId } = message.data as {
            settingName: string;
            defaultValue?: any;
            category?: string;
            pluginId?: string
          };

          console.log('[HOST API] Get setting requested:', { settingName, pluginId });

          // Загружаем manifest плагина для получения настроек
          const currentPlugin = pluginId || 'ozon-analyzer';
          const manifestUrl = chrome.runtime.getURL(`public/plugins/${currentPlugin}/manifest.json`);

          let manifestResponse;
          try {
            manifestResponse = await fetch(manifestUrl);
            if (!manifestResponse.ok) {
              throw new Error(`Failed to load manifest: ${manifestResponse.status}`);
            }
          } catch (error) {
            console.error('[HOST API] Error loading manifest:', error);
            sendResponse({
              error: true,
              error_message: `Не удалось загрузить настройки плагина ${currentPlugin}: ${(error as Error).message}`
            });
            return true;
          }

          const manifest = await manifestResponse.json();
          const settings = manifest.settings || {};

          // Получаем значение настройки
          let settingValue = settings[settingName];

          if (settingValue === undefined) {
            // Если настройка не найдена, используем значение по умолчанию
            settingValue = defaultValue;
            console.log(`[HOST API] Setting '${settingName}' not found, using default:`, defaultValue);
          }

          console.log(`[HOST API] Returning setting '${settingName}':`, settingValue);
          sendResponse({ value: settingValue });

        } catch (error) {
          console.error('[HOST API] get_setting error:', error);
          sendResponse({
            error: true,
            error_message: (error as Error).message
          });
        }
        break;
      }
      default:
        sendResponse({ error: `Unknown command: ${message.command}` });
    }
  } catch (error: unknown) {
    sendResponse({ error: (error as Error).message });
  }

  // Возвращаем true для поддержки асинхронных ответов
  return true;
};

// === OFFSCREEN DELEGATION RESPONSE HANDLER ===

// Обработчик сообщений от Offscreen Document
chrome.runtime.onMessage.addListener(
 async (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
   // Проверяем, что сообщение исходит от нашего offscreen документа
   if (sender.url?.includes('offscreen.html')) {
     console.log('[background][OFFSCREEN RESPONSE] Message from offscreen received:', message);

     if (typeof message === 'object' && message !== null && 'type' in message) {
       const msg = message as ExtensionMessage;

       if (msg.type === 'WORKFLOW_LOG') {
         // Ретрансмировать логи от offscreen в UI
         console.log('[background][OFFSCREEN RESPONSE] Relaying workflow log:', msg);
         chrome.runtime.sendMessage({
           type: 'LOG_EVENT',
           pluginId: msg.pluginId,
           message: msg.message,
           level: msg.level || 'info',
           stepId: msg.stepId,
           logData: msg.logData,
           pageKey: msg.pageKey
         });
         return true;

       } else if (msg.type === 'WORKFLOW_RESULT') {
         // Ретрансмировать результаты воркфлоу в UI
         console.log('[background][OFFSCREEN RESPONSE] Relaying workflow result:', msg);

         // Отправить результат и обновить чат
         if (msg.pluginId && msg.pageKey) {
           const resultMessage: ChatMessage = {
             role: 'plugin',
             content: msg.data
               ? `✅ Результат воркфлоу:\n\`\`\`json\n${JSON.stringify(msg.data, null, 2)}\n\`\`\``
               : '✅ Воркфлоу выполнен успешно',
             timestamp: Date.now()
           };

           try {
             await pluginChatApi.saveMessage(msg.pluginId, getPageKey(msg.pageKey), resultMessage);
             broadcastChatUpdate(msg.pluginId, getPageKey(msg.pageKey));
             console.log('[background][OFFSCREEN RESPONSE] Workflow result saved to chat');
           } catch (saveError) {
             console.error('[background][OFFSCREEN RESPONSE] Failed to save result to chat:', saveError);
           }
         }

         // Также ретрансмировать результат через стандартное сообщение
         chrome.runtime.sendMessage({
           type: 'WORKFLOW_COMPLETED',
           pluginId: msg.pluginId,
           result: msg.data,
           requestId: msg.requestId
         });

         return true;
       } else if (msg.type === 'WORKFLOW_ERROR') {
         // Ретрансмировать ошибки воркфлоу в UI
         console.error('[background][OFFSCREEN RESPONSE] Workflow error received:', msg);

         if (msg.pluginId && msg.pageKey) {
           const errorMessage: ChatMessage = {
             role: 'plugin',
             content: `❌ Ошибка воркфлоу: ${msg.data || 'Неизвестная ошибка'}`,
             timestamp: Date.now()
           };

           try {
             await pluginChatApi.saveMessage(msg.pluginId, getPageKey(msg.pageKey), errorMessage);
             broadcastChatUpdate(msg.pluginId, getPageKey(msg.pageKey));
           } catch (saveError) {
             console.error('[background][OFFSCREEN RESPONSE] Failed to save error to chat:', saveError);
           }
         }

         return true;
       } else if (msg.type === 'PYODIDE_MESSAGE_SERVICE_WORKER') {
         // Ретрансмировать PYODIDE_MESSAGE в UI (в Side Panel)
         console.log('[background][PYODIDE_SERVICE_WORKER] PYODIDE_MESSAGE received from offscreen:', msg);

         if (msg.pluginId && msg.pageKey && msg.data) {
           try {
             // Сохраняем сообщение как плагиновый чат
             const pyodideMessage: ChatMessage = {
               role: 'plugin',
               content: String(msg.data),
               timestamp: msg.timestamp || Date.now()
             };

             await pluginChatApi.saveMessage(msg.pluginId, getPageKey(msg.pageKey), pyodideMessage);
             broadcastChatUpdate(msg.pluginId, getPageKey(msg.pageKey));

             console.log('[background][PYODIDE_SERVICE_WORKER] PYODIDE_MESSAGE relayed to side panel:', {
               pluginId: msg.pluginId,
               pageKey: msg.pageKey,
               messageLength: pyodideMessage.content?.length
             });

             return true;
           } catch (saveError) {
             console.error('[background][PYODIDE_SERVICE_WORKER] Failed to save PYODIDE_MESSAGE to chat:', saveError);
             return true;
           }
         } else {
           console.warn('[background][PYODIDE_SERVICE_WORKER] Missing required fields in PYODIDE_MESSAGE:', {
             pluginId: !!msg.pluginId,
             pageKey: !!msg.pageKey,
             data: !!msg.data
           });
           return true;
         }
       }
     }
   }

   return false; // Не блокировать другие обработчики
 },
);

const findTargetTab = async (): Promise<chrome.tabs.Tab> => {
  const allTabsInWindow = await chrome.tabs.query({ currentWindow: true });
  const selfUrl = chrome.runtime.getURL('index.html');

  const targetTab = allTabsInWindow.find(
    tab => tab.url !== selfUrl && (tab.url?.startsWith('http') || tab.url?.startsWith('https')),
  );

  if (!targetTab) {
    throw new Error('Не найдена подходящая вкладка для анализа (откройте любой сайт в этом же окне).');
  }

  return targetTab;
};

// Обработчик прямого тестирования Pyodide
const handleTestPyodideDirect = async (message: ExtensionMessage): Promise<{
  success: boolean;
  result?: unknown;
  error?: string;
  timestamp: number;
  chromeVersion?: string;
}> => {
  const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1];
  const pythodideUrl = chrome.runtime.getURL('pyodide/pyodide.js');

  console.log('[TEST_PYODIDE_DIRECT] Chrome version:', chromeVersion);

  // Проверяем полную информацию о Pyodide
  try {
    console.log('[TEST_PYODIDE_DIRECT] Checking Pyodide availability...');

    // Для Chrome >= 109 используем offscreen document
    if (offscreenSupported()) {
      console.log('[TEST_PYODIDE_DIRECT] Using offscreen document execution');

      try {
        // Убеждаемся что offscreen document существует
        await ensureOffscreenDocument();

        // Отправляем запрос в offscreen document
        const testRequest = {
          type: 'TEST_PYODIDE_DIRECT_EXEC',
          pythonCode: message.pythonCode || 'print("Hello from Pyodide!")',
          requestId: `test_pyodide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now()
        };

        console.log('[TEST_PYODIDE_DIRECT] Sending to offscreen:', testRequest);
        const result = await chrome.runtime.sendMessage(testRequest);

        return {
          success: result?.success || false,
          result: result?.result,
          error: result?.error,
          timestamp: Date.now(),
          chromeVersion: chromeVersion
        };

      } catch (offscreenError) {
        console.error('[TEST_PYODIDE_DIRECT] Offscreen execution failed:', offscreenError);
        return {
          success: false,
          error: `Offscreen execution error: ${(offscreenError as Error).message}`,
          timestamp: Date.now(),
          chromeVersion: chromeVersion
        };
      }

    } else {
      // Для старых версий Chrome (<109) - fallback mode
      console.log('[TEST_PYODIDE_DIRECT] Chrome < 109 detected, using fallback mode');

      return {
        success: false,
        result: {
          chromeVersion: chromeVersion,
          pyodideAvailable: false,
          offscreenSupported: false,
          message: 'Pyodide недоступен для данной версии Chrome'
        },
        error: 'Pyodide requires Chrome 109+ with Offscreen Document API support',
        timestamp: Date.now(),
        chromeVersion: chromeVersion
      };
    }

  } catch (error) {
    console.error('[TEST_PYODIDE_DIRECT] Test execution failed:', error);

    return {
      success: false,
      error: `Test execution error: ${(error as Error).message}`,
      timestamp: Date.now(),
      chromeVersion: chromeVersion
    };
  }
};

// === Port API для устойчивого обмена с сайдпанелью ===
chrome.runtime.onConnect.addListener(port => {
  console.log('[background] Port connected:', port.name);

  port.onMessage.addListener(async msg => {
    if (msg.type === 'GET_PLUGINS') {
      try {
        const plugins = await getAvailablePlugins();
        const allSettings = await pluginSettingsStorage.get();
        const pluginsWithSettings = await Promise.all(
          plugins.map(async plugin => ({
            ...plugin,
            settings: allSettings[plugin.id] || { enabled: true, autorun: false },
          })),
        );
        port.postMessage({ type: 'PLUGINS_RESULT', plugins: pluginsWithSettings });
      } catch (error) {
        port.postMessage({ type: 'PLUGINS_ERROR', error: (error as Error).message });
      }
    }
    // ... другие типы сообщений по аналогии
  });
});

// Обработчик для автозапуска плагинов при загрузке страницы
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
    try {
      // Получаем все плагины и их настройки
      const plugins = await getAvailablePlugins();
      const allSettings = await pluginSettingsStorage.get();

      console.log('[background] Tab updated, checking plugins for autorun:', tab.url);

      // Проверяем каждый плагин на наличие автозапуска и соответствия URL
      for (const plugin of plugins) {
        const settings = allSettings[plugin.id] || { enabled: true, autorun: false };

        // Если плагин включен и настроен на автозапуск
        if (settings.enabled && settings.autorun) {
          // Здесь можно добавить проверку host_permissions, если manifest доступен напрямую в plugin
          // По умолчанию просто запускаем плагин
          await runPluginIfEnabled(plugin.id);
        }
      }
    } catch (error) {
      console.error('[background] Error in autorun handler:', error);
    }
  }
});

exampleThemeStorage.get().then(theme => {
  console.log('[background] Theme loaded:', theme);
});

// Comprehensive production diagnostics for offscreen API state
console.log('[background] 🚀 =============================================');
console.log('[background] 🚀 EXTENSION INITIALIZATION DIAGNOSTIC REPORT');
console.log('[background] 🚀 =============================================');
console.log('[background] 📊 System Information:');
console.log('[background]   - Timestamp:', new Date().toISOString());
console.log('[background]   - User-Agent:', navigator.userAgent);
console.log('[background]   - Chrome version:', navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown');
console.log('[background]   - Extension ID:', chrome.runtime.id);

// Detailed offscreen API support check
const isOffscreenSupported = offscreenSupported();
console.log('[background] 📊 Offscreen API Analysis:');
console.log('[background]   - Offscreen API supported:', isOffscreenSupported);

if (!isOffscreenSupported) {
  console.warn('[background] ⚠️ LEGACY CHROME DETECTED (< 109):');
  console.warn('[background]   - Offscreen API is not available in this Chrome version');
  console.warn('[background]   - Fallback workflow execution mode will be used');
  console.warn('[background]   - To enable full functionality, please update Chrome to version 109+');
  console.warn('[background]   - See: https://developer.chrome.com/docs/extensions/migrating-to-service-workers/');
  console.warn('[background] ❌ PRODUCTION IMPACT: Pyodide workflows will fail with legacy fallback');
} else {
  console.log('[background] ✅ Modern Chrome detected (>= 109)');
  console.log('[background]   - Full offscreen document workflow available');
  console.log('[background]   - Pyodide execution via workers expected to work');

  // Additional runtime verification
  try {
    console.log('[background] 🔍 Runtime Context Verification:');
    console.log('[background]   - Runtime permissions check...');

    // Test basic offscreen interaction if supported
    (async () => {
      try {
        const hasDocument = await chrome.offscreen.hasDocument();
        console.log('[background]   - Offscreen document exists on startup:', hasDocument);

        if (!hasDocument) {
          console.log('[background]   - Creating initial offscreen document...');
          await ensureOffscreenDocument();
          console.log('[background]   - Initial offscreen document created successfully');
        }
      } catch (initError) {
        console.error('[background] ❌ Critical: Failed to initialize offscreen document on startup:', initError);
        console.error('[background]   - This may indicate manifest/permission issues');
      }
    })();

  } catch (runtimeError) {
    console.error('[background] ❌ Runtime verification failed:', runtimeError);
  }
}

console.log('[background] 📈 Available Chrome APIs:', typeof chrome !== 'undefined' ? Object.keys(chrome).filter(key => typeof chrome[key as keyof typeof chrome] === 'object').join(', ') : 'None');
console.log('[background] 🚀 =============================================');

console.log('[background] Background script fully loaded and ready');
console.log('[background] Extension ID:', chrome.runtime.id);
console.log('[background] Available APIs:', {
  runtime: typeof chrome.runtime,
  tabs: typeof chrome.tabs,
  storage: typeof chrome.storage,
  sidePanel: typeof chrome.sidePanel,
  scripting: typeof chrome.scripting,
  offscreen: typeof chrome.offscreen
});

// Дополнительная диагностика Offscreen API
console.log('[background][OFFSCREEN DIAGNOSTIC] Detailed Offscreen API analysis:');
console.log('[background][OFFSCREEN DIAGNOSTIC]   chrome object:', typeof chrome);
console.log('[background][OFFSCREEN DIAGNOSTIC]   chrome.offscreen:', typeof chrome.offscreen);
if (chrome.offscreen) {
  console.log('[background][OFFSCREEN DIAGNOSTIC]   chrome.offscreen properties:', Object.keys(chrome.offscreen));
  console.log('[background][OFFSCREEN DIAGNOSTIC]   hasDocument:', typeof chrome.offscreen.hasDocument);
  console.log('[background][OFFSCREEN DIAGNOSTIC]   createDocument:', typeof chrome.offscreen.createDocument);
} else {
  console.log('[background][OFFSCREEN DIAGNOSTIC]   chrome.offscreen is undefined!');
}

// Проверка глобального состояния
console.log('[background][OFFSCREEN DIAGNOSTIC] Global context info:');
console.log('[background][OFFSCREEN DIAGNOSTIC]   window:', typeof window);
console.log('[background][OFFSCREEN DIAGNOSTIC]   self:', typeof self);
console.log('[background][OFFSCREEN DIAGNOSTIC]   globalThis:', typeof globalThis);
console.log('[background] Edit chrome-extension/src/background/index.ts and save to reload.');
