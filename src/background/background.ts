/**
 * src/background.ts
 * 
 * Фоновый скрипт (Service Worker) нашего расширения.
 * Он является "мозгом" Host-API, обрабатывая запросы от UI,
 * выполняя привилегированные действия (например, доступ к вкладкам)
 * и управляя поведением иконки расширения.
 */

// src/background.ts
// Псевдокод для вашего background.ts

// Где-то вверху файла

import { ensureOffscreenDocument } from './offscreen-manager';

console.log("APP Background Script Loaded (v2.0 - Final Architecture).");

// Хранилище для Promise'ов, которые ждут "обратного звонка" от offscreen.ts
const workflowPromises = new Map<string, { resolve: Function, reject: Function }>();


// --- Главный Слушатель Сообщений ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    // === Сообщение от UI (SidePanel) на запуск воркфлоу ===
    case 'RUN_WORKFLOW':
      handleRunWorkflow(message.pluginId)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'WORKFLOW_COMPLETED':
      const promise = workflowPromises.get(message.requestId); // <-- Используем правильное имя
      if (promise) {
        if (message.success) {
          promise.resolve(message.result);
        } else {
          promise.reject(new Error(message.error));
        }
        workflowPromises.delete(message.requestId); // <-- Используем правильное имя
      }
      break;
    
    // === Промежуточные сообщения от Offscreen ===
    case 'LOG_MESSAGE':
    case 'WORKFLOW_RESULT':
      console.log(`[FROM_OFFSCREEN - ${message.type}]`, message.data);
      // TODO: Переслать эти сообщения в SidePanel
      break;

    // === Запросы от Python (через offscreen) на вызов Host API ===
    case 'HOST_CALL':
      handleHostCall(message.payload, sendResponse);
      return true;
      
    default:
      console.warn(`[Background] Получено неизвестное сообщение:`, message);
  }
  return true;
});


// --- Логика Обработчиков ---

async function handleRunWorkflow(pluginId: string): Promise<any> {
  console.log(`[Background] Получена команда RUN_WORKFLOW для плагина: ${pluginId}`);
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) throw new Error("Не найдена активная вкладка.");

  const [{ result: pageHtml }] = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => document.documentElement.outerHTML,
  });

  if (!pageHtml) throw new Error("Не удалось получить HTML страницы.");
  console.log(`[Background] HTML извлечен (${pageHtml.length} символов)`);

  await ensureOffscreenDocument();
  
  const requestId = `workflow_${Date.now()}`;
  
  // Отправляем задачу в offscreen "выстрелил и забыл"
  chrome.runtime.sendMessage({
    type: 'EXECUTE_WORKFLOW',
    data: { pluginId, pageHtml, requestId, input: {} }
  });

  console.log(`[Background] Задача ${requestId} отправлена в offscreen. Ожидаем ответа...`);

  // Возвращаем Promise, который будет ждать, пока не придет 'WORKFLOW_COMPLETED'
  return new Promise((resolve, reject) => {
    workflowPromises.set(requestId, { resolve, reject });
    setTimeout(() => {
      if (workflowPromises.has(requestId)) {
        workflowPromises.delete(requestId);
        reject(new Error(`Ответ от offscreen-документа не получен за 60 секунд.`));
      }
    }, 60000);
  });
}

async function handleHostCall(payload: any, sendResponse: (response?: any) => void) {
  const { func, args, callId } = payload;
  console.log(`[Background] Получен HOST_CALL для функции '${func}'`);

  try {
    let result;
    if (func === 'llm_call') {
      result = `Моковый ответ от AI для модели ${args[0]}`;
    } else if (func === 'get_setting') {
      const settings = await chrome.storage.sync.get(args[0]);
      result = settings[args[0]];
    } else {
      throw new Error(`Неизвестная функция Host API: ${func}`);
    }
    // Ответ на HOST_CALL отправляется через sendResponse,
    // так как offscreen.ts ждет его через `await chrome.runtime.sendMessage`
    sendResponse({ callId, result });
  } catch (error: any) {
    sendResponse({ callId, error: error.message });
  }
}

async function handleHostCallResponse(message: any) {
  const { callId, result, error } = message;
  console.log(`[Background] Получен HOST_CALL_RESPONSE для callId: ${callId}`);

  try {
    // Это ответ от AI сервиса или другого асинхронного хост-колла
    // Здесь мы можем обработать результат и передать его обратно отправителю
    const promise = workflowPromises.get(callId);
    if (promise) {
      if (error) {
        promise.reject(new Error(error));
      } else {
        promise.resolve(result);
      }
      workflowPromises.delete(callId);
    } else {
      console.warn(`[Background] Не найден promise для callId: ${callId}`);
    }
  } catch (error: any) {
    console.error(`[Background] Ошибка в обработке HOST_CALL_RESPONSE:`, error);
  }
}

async function handleAiCall(data: any, sender: chrome.runtime.MessageSender) {
  const { modelAlias, prompt, context } = data;
  console.log(`[Background] Получен ai_call для модели: ${modelAlias}`);

  try {
    // Интеграция с AI API (здесь можно добавить реальный AI провайдер)
    const result = await callAiProvider(modelAlias, prompt, context);
    return result;
  } catch (error: any) {
    console.error(`[Background] Ошибка в AI вызове:`, error);
    throw new Error(`AI call failed: ${error.message}`);
  }
}

async function performLlmCall(args: any[]) {
  const [modelAlias, params, context] = args;
  console.log(`[Background] Выполнение LLM вызова для модели: ${modelAlias}`);

  try {
    // Реальная интеграция с AI провайдером
    // Можно использовать различные провайдеры: OpenAI, Anthropic, etc.
    return await callAiProvider(modelAlias, params.prompt || params, context);
  } catch (error: any) {
    console.error(`[Background] Ошибка в LLM вызове:`, error);
    throw error;
  }
}

async function getPluginSetting(settingKey: string): Promise<any> {
  console.log(`[Background] Получение настройки плагина: ${settingKey}`);

  try {
    // Пытаемся получить из chrome.storage.sync
    const storageResult = await chrome.storage.sync.get(settingKey);
    if (storageResult[settingKey] !== undefined) {
      console.log(`[Background] Найдена настройка в sync storage:`, storageResult[settingKey]);
      return storageResult[settingKey];
    }

    // Если не найдено, пытаемся получить из chrome.storage.local
    const localResult = await chrome.storage.local.get(settingKey);
    if (localResult[settingKey] !== undefined) {
      console.log(`[Background] Найдена настройка в local storage:`, localResult[settingKey]);
      return localResult[settingKey];
    }

    // Если настройка не найдена, возвращаем undefined или дефолтные значения
    console.warn(`[Background] Настройка ${settingKey} не найдена в хранилище`);
    return undefined;
  } catch (error: any) {
    console.error(`[Background] Ошибка при получении настройки ${settingKey}:`, error);
    throw new Error(`Failed to get setting ${settingKey}: ${error.message}`);
  }
}

async function savePluginSetting(key: string, value: any): Promise<boolean> {
  console.log(`[Background] Сохранение настройки плагина: ${key} =`, value);

  try {
    // Сохраняем в chrome.storage.sync для синхронизации между устройствами
    await chrome.storage.sync.set({ [key]: value });
    console.log(`[Background] Настройка ${key} успешно сохранена`);
    return true;
  } catch (error: any) {
    console.error(`[Background] Ошибка при сохранении настройки ${key}:`, error);
    throw new Error(`Failed to save setting ${key}: ${error.message}`);
  }
}

async function getPluginData(pluginId: string): Promise<any> {
  console.log(`[Background] Получение данных плагина: ${pluginId}`);

  try {
    // Получаем данные плагина из хранилища
    const pluginKey = `plugin_${pluginId}_data`;
    const storageResult = await chrome.storage.local.get(pluginKey);

    if (storageResult[pluginKey] !== undefined) {
      console.log(`[Background] Найдены данные плагина ${pluginId}:`, storageResult[pluginKey]);
      return storageResult[pluginKey];
    }

    // Если данные не найдены, возвращаем дефолтную структуру
    console.warn(`[Background] Данные плагина ${pluginId} не найдены, возвращаем дефолтные`);
    return {
      id: pluginId,
      name: pluginId,
      enabled: true,
      settings: {},
      cachedData: {}
    };
  } catch (error: any) {
    console.error(`[Background] Ошибка при получении данных плагина ${pluginId}:`, error);
    throw new Error(`Failed to get plugin data ${pluginId}: ${error.message}`);
  }
}

async function callAiProvider(modelAlias: string, prompt: string, context?: any): Promise<string> {
  console.log(`[Background] Вызов AI провайдера для модели: ${modelAlias}`);

  // Моковая реализация - здесь можно интегрировать реальные AI провайдеры
  // Например:
  try {
    switch (modelAlias?.toLowerCase()) {
      case 'gpt-4':
      case 'gpt-3.5-turbo':
        // Интеграция с OpenAI API
        return await callOpenAi(modelAlias, prompt, context);

      case 'claude':
      case 'claude-2':
        // Интеграция с Anthropic
        return await callAnthropic(modelAlias, prompt, context);

      case 'gemini':
        // Интеграция с Google Gemini
        return await callGemini(modelAlias, prompt, context);

      default:
        // Моковый ответ для неизвестных моделей
        return `Моковый ответ от AI модели ${modelAlias} для промпта: ${prompt.substring(0, 100)}...`;
    }
  } catch (error: any) {
    console.error(`[Background] Ошибка в AI провайдере для ${modelAlias}:`, error);
    throw error;
  }
}

// Stub функции для AI провайдеров (нужно заменить на реальную интеграцию)
async function callOpenAi(model: string, prompt: string, context?: any): Promise<string> {
  // Реальная реализация с OpenAI API
  throw new Error('OpenAI integration not implemented yet');
}

async function callAnthropic(model: string, prompt: string, context?: any): Promise<string> {
  // Реальная реализация с Anthropic API
  throw new Error('Anthropic integration not implemented yet');
}

async function callGemini(model: string, prompt: string, context?: any): Promise<string> {
  // Реальная реализация с Google Gemini API
  throw new Error('Gemini integration not implemented yet');
}
//================================================================//
//  3. ОБРАБОТЧИК КЛИКА ПО ИКОНКЕ РАСШИРЕНИЯ
//================================================================//

chrome.action.onClicked.addListener(async (tab) => {
  // Открываем Side Panel на текущей вкладке
  // @ts-ignore
  if (chrome.sidePanel) {
    // @ts-ignore
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } else {
    // Fallback для браузеров без Side Panel API
    const platformPageUrl = chrome.runtime.getURL('side-panel/index.html');
    chrome.tabs.create({ url: platformPageUrl });
  }
});