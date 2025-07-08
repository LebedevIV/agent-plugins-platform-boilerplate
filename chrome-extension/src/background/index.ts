import 'webextension-polyfill';
import { exampleThemeStorage, pluginSettingsStorage, getPluginSettings } from '@extension/storage';
import { getAvailablePlugins } from '@platform-core/core/plugin-manager.js';
import { runWorkflow } from '@platform-core/core/workflow-engine.js';
import { hostApi } from '@platform-core/core/host-api.js';

// Только стандартное поведение: панель открывается/закрывается глобально по клику на иконку
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Обработчики сообщений для работы с плагинами
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[background] Got message:', message, 'from:', sender?.origin || sender?.id || 'unknown');
  
  if (message.source === 'app-host-api') {
    handleHostApiMessage(message, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'GET_PLUGINS') {
    console.log('[background] Processing GET_PLUGINS request');
    getAvailablePlugins().then(async (plugins) => {
      // Получаем настройки для всех плагинов
      const allSettings = await pluginSettingsStorage.get();
      
      // Добавляем настройки к каждому плагину
      const pluginsWithSettings = await Promise.all(plugins.map(async (plugin) => {
        const settings = allSettings[plugin.id] || {
          enabled: true,
          autorun: false
        };
        
        return {
          ...plugin,
          settings
        };
      }));
      
      console.log('[background] getAvailablePlugins result with settings:', pluginsWithSettings);
      console.log('[background] Sending response to client');
      sendResponse(pluginsWithSettings);
    }).catch((error) => {
      console.error('[background] Error in getAvailablePlugins:', error);
      sendResponse({ error: error.message });
    });
    return true;
  }
  
  if (message.type === 'RUN_WORKFLOW') {
    runPluginIfEnabled(message.pluginId).then((result) => sendResponse(result));
    return true;
  }
  
  if (message.type === 'UPDATE_PLUGIN_SETTING') {
    const { pluginId, setting, value } = message;
    updatePluginSetting(pluginId, setting, value)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  
  return false; // Handle case where no message type matches
});

// Функция для проверки и запуска плагина с учетом настроек
async function runPluginIfEnabled(pluginId: string) {
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
}

// Функция для обновления настроек плагина
async function updatePluginSetting(pluginId: string, setting: string, value: boolean) {
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
    [pluginId]: pluginSettings
  });
  
  console.log(`[background] Updated plugin setting for ${pluginId}:`, setting, '=', value);
  return { success: true };
}

async function handleHostApiMessage(message: any, sendResponse: (response: any) => void) {
  try {
    switch (message.command) {
      case 'getElements':
        const targetTab = await findTargetTab();
        const elements = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id! },
          func: (selectors: string[]) => {
            return selectors.map((selector: string) => {
              const elements = document.querySelectorAll(selector);
              return Array.from(elements).map(el => ({
                tagName: el.tagName,
                textContent: el.textContent?.substring(0, 200),
                attributes: Array.from(el.attributes).map((attr: Attr) => ({ name: attr.name, value: attr.value }))
              }));
            });
          },
          args: [message.data.selectors]
        });
        sendResponse({ elements: elements[0].result });
        break;
        
      case 'getActivePageContent':
        const targetTab2 = await findTargetTab();
        const content = await chrome.scripting.executeScript({
          target: { tabId: targetTab2.id! },
          func: (selectors: string[]) => {
            return selectors.map((selector: string) => {
              const element = document.querySelector(selector);
              return element ? element.outerHTML : null;
            }).filter(Boolean).join('\n');
          },
          args: [message.data.selectors]
        });
        sendResponse({ html: content[0].result });
        break;
        
      case 'host_fetch':
        const response = await fetch(message.data.url);
        const data = await response.text();
        sendResponse({ data });
        break;
        
      default:
        sendResponse({ error: `Unknown command: ${message.command}` });
    }
  } catch (error) {
    sendResponse({ error: (error as Error).message });
  }
}

async function findTargetTab(): Promise<chrome.tabs.Tab> {
  const allTabsInWindow = await chrome.tabs.query({ currentWindow: true });
  const selfUrl = chrome.runtime.getURL('index.html');
  
  const targetTab = allTabsInWindow.find(tab => 
    tab.url !== selfUrl && (tab.url?.startsWith('http') || tab.url?.startsWith('https'))
  );
  
  if (!targetTab) {
    throw new Error("Не найдена подходящая вкладка для анализа (откройте любой сайт в этом же окне).");
  }
  
  return targetTab;
}

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
