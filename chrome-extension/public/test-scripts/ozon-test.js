/* eslint-disable no-undef */
// Тестовый скрипт для создания чатов на странице Ozon
// Запускать в консоли DevTools расширения (не в консоли браузера!)

console.log('🎯 Тестирование чатов на странице Ozon...');

// Получаем текущий URL из активной вкладки
async function getCurrentUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.url;
  } catch (error) {
    console.error('❌ Ошибка получения URL:', error);
    return window.location.href; // fallback
  }
}

// Функция для создания чата для ozon-analyzer
async function createOzonChat() {
  try {
    console.log('📝 Создание чата для ozon-analyzer...');

    const currentUrl = await getCurrentUrl();
    console.log('📍 Текущий URL:', currentUrl);

    // Создаем чат
    const chat = await chrome.runtime.sendMessage({
      type: 'CREATE_PLUGIN_CHAT',
      pluginId: 'ozon-analyzer',
      pageKey: currentUrl,
    });

    console.log('✅ Чат создан:', chat);

    // Сохраняем тестовое сообщение пользователя
    const userMessage = {
      role: 'user',
      content: 'Проанализируй этот товар и расскажи о его характеристиках',
      timestamp: Date.now(),
    };

    await chrome.runtime.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_MESSAGE',
      pluginId: 'ozon-analyzer',
      pageKey: currentUrl,
      message: userMessage,
    });

    console.log('✅ Сообщение пользователя сохранено:', userMessage);

    // Сохраняем ответ плагина
    const pluginMessage = {
      role: 'plugin',
      content:
        'Анализирую товар "Костюм спортивный North Dot"... Найдена информация о цене, характеристиках и отзывах.',
      timestamp: Date.now(),
    };

    await chrome.runtime.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_MESSAGE',
      pluginId: 'ozon-analyzer',
      pageKey: currentUrl,
      message: pluginMessage,
    });

    console.log('✅ Ответ плагина сохранен:', pluginMessage);

    // Сохраняем черновик
    await chrome.runtime.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_DRAFT',
      pluginId: 'ozon-analyzer',
      pageKey: currentUrl,
      draftText: 'Хотите узнать больше о доставке или отзывах?',
    });

    console.log('✅ Черновик сохранен');

    return true;
  } catch (error) {
    console.error('❌ Ошибка создания чата:', error);
    return false;
  }
}

// Функция для создания чата для test-chat-plugin
async function createTestPluginChat() {
  try {
    console.log('📝 Создание чата для test-chat-plugin...');

    const currentUrl = await getCurrentUrl();

    // Создаем чат
    const chat = await chrome.runtime.sendMessage({
      type: 'CREATE_PLUGIN_CHAT',
      pluginId: 'test-chat-plugin',
      pageKey: currentUrl,
    });

    console.log('✅ Чат создан:', chat);

    // Сохраняем тестовое сообщение
    const message = {
      role: 'user',
      content: 'Это тестовое сообщение с Ozon',
      timestamp: Date.now(),
    };

    await chrome.runtime.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_MESSAGE',
      pluginId: 'test-chat-plugin',
      pageKey: currentUrl,
      message: message,
    });

    console.log('✅ Тестовое сообщение сохранено:', message);

    return true;
  } catch (error) {
    console.error('❌ Ошибка создания тестового чата:', error);
    return false;
  }
}

// Функция для отправки тестовых логов
async function sendTestLogs() {
  try {
    console.log('📝 Отправка тестовых логов...');

    const currentUrl = await getCurrentUrl();

    const logs = [
      {
        pluginId: 'ozon-analyzer',
        level: 'info',
        stepId: 'page-load',
        message: 'Страница товара загружена',
        logData: { url: currentUrl, title: document.title },
      },
      {
        pluginId: 'ozon-analyzer',
        level: 'success',
        stepId: 'product-found',
        message: 'Товар найден: Костюм спортивный North Dot',
        logData: { productId: '1438414833' },
      },
      {
        pluginId: 'test-chat-plugin',
        level: 'debug',
        stepId: 'test-debug',
        message: 'Тестовый отладочный лог',
        logData: { test: true, timestamp: Date.now() },
      },
    ];

    for (const log of logs) {
      await chrome.runtime.sendMessage({
        type: 'LOG_EVENT',
        pluginId: log.pluginId,
        pageKey: currentUrl,
        level: log.level,
        stepId: log.stepId,
        message: log.message,
        logData: log.logData,
      });

      console.log(`✅ Лог отправлен: ${log.pluginId} - ${log.message}`);
    }
  } catch (error) {
    console.error('❌ Ошибка отправки логов:', error);
  }
}

// Функция для получения всех данных
async function getAllData() {
  try {
    console.log('📋 Получение всех данных...');

    // Получаем чаты
    const chats = await chrome.runtime.sendMessage({
      type: 'LIST_PLUGIN_CHATS',
      pluginId: null,
    });

    console.log('✅ Чаты найдены:', chats);

    // Получаем черновики
    const drafts = await chrome.runtime.sendMessage({
      type: 'LIST_PLUGIN_CHAT_DRAFTS',
      pluginId: null,
    });

    console.log('✅ Черновики найдены:', drafts);

    // Получаем логи
    const logs = await chrome.runtime.sendMessage({
      type: 'LIST_ALL_PLUGIN_LOGS',
    });

    console.log('✅ Логи найдены:', logs);

    return { chats, drafts, logs };
  } catch (error) {
    console.error('❌ Ошибка получения данных:', error);
    return { chats: [], drafts: [], logs: {} };
  }
}

// Запуск всех тестов
async function runOzonTests() {
  console.log('🚀 Запуск тестов для Ozon...');

  await createOzonChat();
  await createTestPluginChat();
  await sendTestLogs();
  await getAllData();

  console.log('✅ Все тесты завершены!');
  console.log('💡 Теперь откройте DevTools и перейдите на вкладки:');
  console.log('   - "Чаты плагинов" - для просмотра чатов и черновиков');
  console.log('   - "Логи" - для просмотра логов плагинов');
}

// Экспортируем функции для использования в консоли
window.ozonTestSystem = {
  createOzonChat,
  createTestPluginChat,
  sendTestLogs,
  getAllData,
  runOzonTests,
  getCurrentUrl,
};

console.log('🎯 Функции тестирования Ozon доступны:');
console.log('- ozonTestSystem.createOzonChat() - создать чат для ozon-analyzer');
console.log('- ozonTestSystem.createTestPluginChat() - создать чат для test-chat-plugin');
console.log('- ozonTestSystem.sendTestLogs() - отправить тестовые логи');
console.log('- ozonTestSystem.getAllData() - получить все данные');
console.log('- ozonTestSystem.runOzonTests() - запустить все тесты');
console.log('- ozonTestSystem.getCurrentUrl() - получить текущий URL');

// Автоматически запускаем тесты
runOzonTests();
