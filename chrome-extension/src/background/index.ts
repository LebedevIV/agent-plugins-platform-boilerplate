import 'webextension-polyfill';
import { exampleThemeStorage, pluginSettingsStorage, getPluginSettings } from '@extension/storage';
import { getAvailablePlugins } from '@platform-core/core/plugin-manager.js';
import { runWorkflow } from '@platform-core/core/workflow-engine.js';
import { pluginChatApi, ChatMessage } from './plugin-chat-api';

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
    await runWorkflow(pluginId);
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

const broadcastChatUpdate = function(pluginId: string, pageKey: string) {
  chrome.runtime.sendMessage({
    type: 'PLUGIN_CHAT_UPDATED',
    pluginId,
    pageKey,
  });
};

// Обработчики сообщений для работы с плагинами
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[background] Got message:', message, 'from:', sender?.origin || sender?.id || 'unknown');

  if (message.source === 'app-host-api') {
    handleHostApiMessage(message, sendResponse);
    return true; // Keep message channel open for async response
  }

  if (message.type === 'GET_PLUGINS') {
    console.log('[background] Processing GET_PLUGINS request');
    getAvailablePlugins()
      .then(async plugins => {
        // Получаем настройки для всех плагинов
        const allSettings = await pluginSettingsStorage.get();

        // Добавляем настройки к каждому плагину
        const pluginsWithSettings = await Promise.all(
          plugins.map(async plugin => {
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

        console.log('[background] getAvailablePlugins result with settings:', pluginsWithSettings);
        console.log('[background] Sending response to client');
        sendResponse(pluginsWithSettings);
      })
      .catch(error => {
        console.error('[background] Error in getAvailablePlugins:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }

  if (message.type === 'RUN_WORKFLOW') {
    runPluginIfEnabled(message.pluginId).then(result => sendResponse(result));
    return true;
  }

  if (message.type === 'UPDATE_PLUGIN_SETTING') {
    const { pluginId, setting, value } = message;
    updatePluginSetting(pluginId, setting, value)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === 'GET_PLUGIN_SETTINGS') {
    console.log('[background] Processing GET_PLUGIN_SETTINGS request');
    pluginSettingsStorage
      .get()
      .then(settings => {
        console.log('[background] Plugin settings:', settings);
        sendResponse(settings);
      })
      .catch(error => {
        console.error('[background] Error getting plugin settings:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }

  // === Работа с чатами плагинов ===
  if (message.type === 'GET_PLUGIN_CHAT') {
    const { pluginId, pageKey } = message;
    const chatKey = `${pluginId}::${pageKey}`;
    pluginChatApi.getOrLoadChat(chatKey).then(chat => {
      sendResponse(chat || null);
    });
    return true;
  }

  if (message.type === 'SAVE_PLUGIN_CHAT_MESSAGE') {
    const { pluginId, pageKey, message: msg } = message;
    pluginChatApi.saveMessage(pluginId, pageKey, msg as ChatMessage).then(() => {
      sendResponse({ success: true });
      broadcastChatUpdate(pluginId, pageKey);
    });
    return true;
  }

  if (message.type === 'DELETE_PLUGIN_CHAT') {
    const { pluginId, pageKey } = message;
    pluginChatApi.deleteChat(pluginId, pageKey).then(() => {
      sendResponse({ success: true });
      broadcastChatUpdate(pluginId, pageKey);
    });
    return true;
  }

  if (message.type === 'LIST_PLUGIN_CHATS') {
    const { pluginId } = message;
    pluginChatApi.listChatsForPlugin(pluginId).then(chats => {
      sendResponse(chats);
    });
    return true;
  }

  return false; // Handle case where no message type matches
});

const handleHostApiMessage = async (
  message: { command: string; data: unknown },
  sendResponse: (response: unknown) => void,
) => {
  try {
    switch (message.command) {
      case 'getElements': {
        const targetTab = await findTargetTab();
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
          args: [message.data as { selectors: string[] }],
        });
        sendResponse({ elements: elements[0].result });
        break;
      }

      case 'getActivePageContent': {
        const targetTab2 = await findTargetTab();
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
          args: [message.data as { selectors: string[] }],
        });
        sendResponse({ html: content[0].result });
        break;
      }

      case 'host_fetch': {
        const response = await fetch(message.data as { url: string });
        const data = await response.text();
        sendResponse({ data });
        break;
      }

      default:
        sendResponse({ error: `Unknown command: ${message.command}` });
    }
  } catch (error) {
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
