import 'webextension-polyfill';
import { pluginChatApi } from './plugin-chat-api';
import { getAvailablePlugins } from './plugin-manager';
import { getPageKey } from '../../../packages/shared/lib/utils/helpers';
import { exampleThemeStorage, pluginSettingsStorage, getPluginSettings } from '@extension/storage';
import type { ChatMessage } from './plugin-chat-api';
import type { Plugin } from './plugin-manager';

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

      if (msg.type === 'GET_PLUGINS') {
        console.log('[background] Processing GET_PLUGINS request');
        (async () => {
          try {
            const plugins: Plugin[] = await getAvailablePlugins();
            console.log('[background] getAvailablePlugins raw result:', plugins);
            const allSettings = await pluginSettingsStorage.get();
            console.log('[background] allSettings:', allSettings);
            const pluginsWithSettings = await Promise.all(
              plugins.map(async (plugin: Plugin) => {
                const settings = allSettings[plugin.id] || {
                  enabled: true,
                  autorun: false,
                };
                return {
                  ...plugin,
                  settings,
                };
              }),
            );
            try {
              const json = JSON.stringify(pluginsWithSettings);
              console.log('[background] pluginsWithSettings JSON:', json);
            } catch (e) {
              console.error('[background] pluginsWithSettings JSON.stringify error:', e);
            }
            try {
              sendResponse({ plugins: pluginsWithSettings });
            } catch (e) {
              console.error('[background] sendResponse error:', e);
            }
          } catch (error) {
            console.error('[background] Error in getAvailablePlugins:', error);
            try {
              sendResponse({ error: (error as Error).message });
            } catch (e) {
              console.error('[background] sendResponse error (catch):', e);
            }
          }
        })();
        return true;
      }

      if (msg.type === 'RUN_WORKFLOW' && msg.pluginId) {
        runPluginIfEnabled(msg.pluginId).then(result => sendResponse(result));
        return true;
      }

      if (
        msg.type === 'UPDATE_PLUGIN_SETTING' &&
        msg.pluginId &&
        msg.setting !== undefined &&
        msg.value !== undefined
      ) {
        const { pluginId, setting, value } = msg;
        updatePluginSetting(pluginId, setting, value)
          .then(() => sendResponse({ success: true }))
          .catch((error: unknown) => sendResponse({ error: (error as Error).message }));
        return true;
      }

      if (msg.type === 'GET_PLUGIN_SETTINGS') {
        console.log('[background] Processing GET_PLUGIN_SETTINGS request');
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
        const { pluginId, pageKey } = msg;
        const chatKey = `${pluginId}::${getPageKey(pageKey)}`;
        pluginChatApi
          .getOrLoadChat(chatKey)
          .then(chat => {
            let safeChat = chat;
            if (chat && Array.isArray(chat.messages) && chat.messages.length > 50) {
              safeChat = { ...chat, messages: chat.messages.slice(-50) };
            }
            try {
              const serializable = JSON.parse(JSON.stringify(safeChat));
              console.log(
                '[background] sendResponse(GET_PLUGIN_CHAT):',
                serializable,
                'chatKey:',
                chatKey,
                'pageKey:',
                pageKey,
              );
              sendResponse(serializable || { messages: [] });
            } catch (err) {
              console.error('[background] Ошибка сериализации чата:', err, safeChat);
              sendResponse({ error: 'serialization failed', details: String(err) });
            }
            console.log('[background] return true после sendResponse(GET_PLUGIN_CHAT)');
          })
          .catch(err => {
            console.error('[background] Ошибка в getOrLoadChat:', err);
            sendResponse({ error: String(err) });
            console.log('[background] return true после sendResponse(GET_PLUGIN_CHAT) [catch]');
          });
        return true;
      }

      // Создание чата при начале ввода (ленивая инициализация)
      if (msg.type === 'CREATE_PLUGIN_CHAT' && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log('[background] CREATE_PLUGIN_CHAT pageKey:', pageKey, 'norm:', normPageKey);
        pluginChatApi.createChatIfNotExists(pluginId, normPageKey).then(chat => {
          console.log('[background] sendResponse(CREATE_PLUGIN_CHAT):', chat);
          sendResponse(chat);
          broadcastChatUpdate(pluginId, normPageKey);
        });
        return true;
      }

      // Сохранение черновика сообщения (ленивая синхронизация)
      if (msg.type === 'SAVE_PLUGIN_CHAT_DRAFT' && msg.pluginId && msg.pageKey && msg.draftText !== undefined) {
        const { pluginId, pageKey, draftText } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log('[background] SAVE_PLUGIN_CHAT_DRAFT pageKey:', pageKey, 'norm:', normPageKey);
        pluginChatApi.saveDraft(pluginId, normPageKey, draftText).then(() => {
          console.log('[background] sendResponse(SAVE_PLUGIN_CHAT_DRAFT):', { success: true });
          sendResponse({ success: true });
        });
        return true;
      }

      // Получение черновика сообщения
      if (msg.type === 'GET_PLUGIN_CHAT_DRAFT' && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log('[background] GET_PLUGIN_CHAT_DRAFT pageKey:', pageKey, 'norm:', normPageKey);
        pluginChatApi.getDraft(pluginId, normPageKey).then(draftText => {
          console.log('[background] sendResponse(GET_PLUGIN_CHAT_DRAFT):', { draftText });
          sendResponse({ draftText });
        });
        return true;
      }

      if (msg.type === 'SAVE_PLUGIN_CHAT_MESSAGE' && msg.pluginId && msg.pageKey && msg.message) {
        const { pluginId, pageKey, message: chatMsg } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log('[background] SAVE_PLUGIN_CHAT_MESSAGE pageKey:', pageKey, 'norm:', normPageKey);
        pluginChatApi
          .saveMessage(pluginId, normPageKey, chatMsg as ChatMessage)
          .then(() =>
            // Удаляем черновик после отправки сообщения
            pluginChatApi.deleteDraft(pluginId, normPageKey),
          )
          .then(() => {
            console.log('[background] sendResponse(SAVE_PLUGIN_CHAT_MESSAGE):', { success: true });
            sendResponse({ success: true });
            broadcastChatUpdate(pluginId, normPageKey);
          });
        return true;
      }

      if (msg.type === 'DELETE_PLUGIN_CHAT' && msg.pluginId && msg.pageKey) {
        const { pluginId, pageKey } = msg;
        const normPageKey = getPageKey(pageKey);
        console.log('[background] DELETE_PLUGIN_CHAT pageKey:', pageKey, 'norm:', normPageKey);
        pluginChatApi.deleteChat(pluginId, normPageKey).then(() => {
          console.log('[background] sendResponse(DELETE_PLUGIN_CHAT):', { success: true });
          sendResponse({ success: true });
          broadcastChatUpdate(pluginId, normPageKey);
        });
        return true;
      }

      if (msg.type === 'LIST_PLUGIN_CHATS' && msg.pluginId) {
        const { pluginId } = msg;
        console.log('[background] Listing chats for plugin:', pluginId);
        pluginChatApi
          .listChatsForPlugin(pluginId)
          .then(chats => {
            console.log('[background] Chats found:', chats);
            sendResponse(chats);
          })
          .catch(error => {
            console.error('[background] Error listing chats:', error);
            sendResponse([]);
          });
        return true;
      }

      // Получение всех черновиков для плагина
      if (msg.type === 'LIST_PLUGIN_CHAT_DRAFTS' && msg.pluginId) {
        const { pluginId } = msg;
        console.log('[background] Listing drafts for plugin:', pluginId);
        pluginChatApi
          .listDraftsForPlugin(pluginId)
          .then(drafts => {
            console.log('[background] Drafts found:', drafts);
            sendResponse(drafts);
          })
          .catch(error => {
            console.error('[background] Error listing drafts:', error);
            sendResponse([]);
          });
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
    return true;
  },
);

const handleHostApiMessage = async (
  message: { command: string; data: unknown },
  sendResponse: (response: unknown) => void,
) => {
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
      default:
        sendResponse({ error: `Unknown command: ${message.command}` });
    }
  } catch (error: unknown) {
    sendResponse({ error: (error as Error).message });
  }
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
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");
