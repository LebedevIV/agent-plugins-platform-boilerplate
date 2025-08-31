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

import { runWorkflow } from './workflow-engine';
console.log('[background] Workflow engine imported successfully - KEY INTEGRATION POINT');

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
}

// Logger for background environment - headless version without DOM access
function createBackgroundLogger(name: string) {
  return {
    addMessage: (stepId: string, message: string, type = 'info') => {
      const timestamp = new Date().toISOString().slice(11, 19); // HH:MM:SS format
      console.log(`[Background Logger][${timestamp}][${name}][${stepId}] ${message}`);
      if (type === 'error' || type === 'critical') {
        console.error(`[Background Logger][ERROR][${name}][${stepId}] ${message}`);
      } else if (type === 'warning' || type === 'warn') {
        console.warn(`[Background Logger][WARN][${name}][${stepId}] ${message}`);
      }
    },
    renderResult: (stepId: string, result: any) => {
      const truncatedResult = JSON.stringify(result, null, 2).length > 500
        ? JSON.stringify(result, null, 2).substring(0, 500) + '...\n[result truncated]'
        : JSON.stringify(result, null, 2);
      console.log(`[Background Logger][Result][${name}][${stepId}]`, truncatedResult);
    }
  };
}

// Только стандартное поведение: панель открывается/закрывается глобально по клику на иконку
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

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
        console.log('[background][WORKFLOW INTEGRATION] ===== RUN_WORKFLOW REQUEST RECEIVED =====');
        console.log('[background][WORKFLOW INTEGRATION] Plugin ID:', msg.pluginId);
        console.log('[background][WORKFLOW INTEGRATION] Request timestamp:', new Date().toISOString());

        (async () => {
          try {
            // Найти активную вкладку пользователя
            console.log('[background][WORKFLOW INTEGRATION] Querying active tab...');
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (!activeTab || !activeTab.id) {
              console.log('[background][WORKFLOW INTEGRATION][ERROR] No active tab found for RUN_WORKFLOW');
              console.log('[background][WORKFLOW INTEGRATION][ERROR] Available tabs:', tabs.length);
              sendResponse({ error: 'Не найдена активная вкладка' });
              return;
            }

            console.log('[background][WORKFLOW INTEGRATION] Found active tab for workflow:');
            console.log('[background][WORKFLOW INTEGRATION] - URL:', activeTab.url);
            console.log('[background][WORKFLOW INTEGRATION] - Tab ID:', activeTab.id);
            console.log('[background][WORKFLOW INTEGRATION] - Tab title:', activeTab.title);

            // Получить HTML страницы через chrome.scripting
            console.log('[background][WORKFLOW INTEGRATION] Attempting to extract page HTML...');
            console.log('[background][WORKFLOW INTEGRATION] Executing script in tab:', activeTab.id);

            let pageHtml = '';
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                func: () => document.documentElement.outerHTML
              });

              console.log('[background][WORKFLOW INTEGRATION] Script execution results:', results ? 'received' : 'null');
              console.log('[background][WORKFLOW INTEGRATION] Results array length:', results?.length);

              if (results && results[0] && results[0].result) {
                pageHtml = results[0].result as string;
                console.log('[background][WORKFLOW INTEGRATION] ✓ HTML extraction SUCCESSFUL');
                console.log('[background][WORKFLOW INTEGRATION] ✓ HTML length:', pageHtml.length, 'characters');
                console.log('[background][WORKFLOW INTEGRATION] ✓ First 200 chars:', pageHtml.substring(0, 200));
              } else {
                console.log('[background][WORKFLOW INTEGRATION][WARNING] HTML extraction returned empty result');
                console.log('[background][WORKFLOW INTEGRATION] Results detail:', JSON.stringify(results, null, 2));
              }
            } catch (error) {
              console.error('[background][WORKFLOW INTEGRATION][ERROR] HTML extraction FAILED');
              console.error('[background][WORKFLOW INTEGRATION][ERROR] Chrome scripting error:', error);
              console.error('[background][WORKFLOW INTEGRATION][ERROR] Error details:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
              });
              sendResponse({ error: `Не удалось получить HTML страницы: ${(error as Error).message}` });
              return;
            }

            // Проверить настройки плагина
            console.log('[background][WORKFLOW INTEGRATION] Checking plugin settings for:', msg.pluginId);
            const settings = await getPluginSettings(msg.pluginId as string);

            console.log('[background][WORKFLOW INTEGRATION] Plugin settings retrieved:', JSON.stringify(settings, null, 2));

            if (!settings.enabled) {
              console.log('[background][WORKFLOW INTEGRATION][INFO] Plugin is DISABLED, aborting workflow');
              console.log('[background][WORKFLOW INTEGRATION][INFO] Plugin enabled status:', settings.enabled);
              sendResponse({ error: 'Плагин отключен' });
              return;
            }

            console.log('[background][WORKFLOW INTEGRATION][SUCCESS] Plugin is ENABLED, proceeding with workflow');

            // Создать контекст для зависимого от среды выполнения воркфлоу
            console.log('[background][WORKFLOW INTEGRATION] Creating workflow execution context...');
            const context = {
              logger: createBackgroundLogger(`Воркфлоу плагина: ${msg.pluginId}`),
              hostApi: hostApi
            };

            console.log('[background][WORKFLOW INTEGRATION] Context created with:');
            console.log('[background][WORKFLOW INTEGRATION] - Logger:', typeof context.logger);
            console.log('[background][WORKFLOW INTEGRATION] - Host API:', typeof context.hostApi);
            console.log('[background][WORKFLOW INTEGRATION] - Page HTML length:', pageHtml.length);

            // Запустить воркфлоу с переданным контекстом
            console.log('[background][WORKFLOW INTEGRATION] ===== EXECUTING WORKFLOW-ENGINE =====');
            console.log('[background][WORKFLOW INTEGRATION] Plugin ID for workflow:', msg.pluginId);
            console.log('[background][WORKFLOW INTEGRATION] Run timestamp:', new Date().toISOString());

            try {
              await runWorkflow(msg.pluginId as string, context);
              console.log('[background][WORKFLOW INTEGRATION] ===== WORKFLOW COMPLETED SUCCESSFULLY =====');
            } catch (workflowError) {
              console.error('[background][WORKFLOW INTEGRATION][CRITICAL ERROR] Workflow execution failed:');
              console.error('[background][WORKFLOW INTEGRATION][CRITICAL ERROR] Error details:', {
                name: (workflowError as Error).name,
                message: (workflowError as Error).message,
                stack: (workflowError as Error).stack
              });
              throw workflowError; // Re-throw to trigger outer catch
            }

            // Очистка переопределения после выполнения
            delete (self as any).backgroundLoggerOverride;

            console.log('[background][WORKFLOW INTEGRATION] Context cleanup completed');
            console.log('[background][WORKFLOW INTEGRATION] ===== WORKFLOW INTEGRATION COMPLETE =====');
            sendResponse({ success: true });

          } catch (error) {
            console.error('[background] Error in RUN_WORKFLOW:', error);
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

console.log('[background] Background script fully loaded and ready');
console.log('[background] Extension ID:', chrome.runtime.id);
console.log('[background] Available APIs:', {
  runtime: typeof chrome.runtime,
  tabs: typeof chrome.tabs,
  storage: typeof chrome.storage,
  sidePanel: typeof chrome.sidePanel,
  scripting: typeof chrome.scripting
});
console.log('[background] Edit chrome-extension/src/background/index.ts and save to reload.');
