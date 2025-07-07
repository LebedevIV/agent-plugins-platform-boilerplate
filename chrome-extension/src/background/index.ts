import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';
import { getAvailablePlugins, getPluginManifest } from './plugin-manager';
import { runWorkflow } from './workflow-engine';
import { hostApi } from './host-api';

// Только стандартное поведение: панель открывается/закрывается глобально по клику на иконку
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Обработчики сообщений для работы с плагинами
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'app-host-api') {
    handleHostApiMessage(message, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'GET_PLUGINS') {
    getAvailablePlugins().then(sendResponse);
    return true;
  }
  
  if (message.type === 'RUN_WORKFLOW') {
    runWorkflow(message.pluginId).then(() => sendResponse({ success: true }));
    return true;
  }
  
  return false; // Handle case where no message type matches
});

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

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");
