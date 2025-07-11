/* eslint-disable no-undef */
// Скрипт для тестирования системы чатов плагинов
// Запускать в консоли DevTools

console.log('🧪 Тестирование системы чатов плагинов...');

// Функция для создания тестового чата
async function createTestChat() {
  try {
    console.log('📝 Создание тестового чата...');

    // Создаем чат
    const chat = await chrome.runtime.sendMessage({
      type: 'CREATE_PLUGIN_CHAT',
      pluginId: 'test-chat-plugin',
      pageKey: 'https://example.com/test',
    });

    console.log('✅ Чат создан:', chat);

    // Сохраняем тестовое сообщение
    const message = {
      role: 'user',
      content: 'Привет! Это тестовое сообщение для отладки.',
      timestamp: Date.now(),
    };

    await chrome.runtime.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_MESSAGE',
      pluginId: 'test-chat-plugin',
      pageKey: 'https://example.com/test',
      message: message,
    });

    console.log('✅ Сообщение сохранено:', message);

    // Сохраняем черновик
    await chrome.runtime.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_DRAFT',
      pluginId: 'test-chat-plugin',
      pageKey: 'https://example.com/test',
      draftText: 'Это тестовый черновик сообщения...',
    });

    console.log('✅ Черновик сохранен');

    return true;
  } catch (error) {
    console.error('❌ Ошибка создания чата:', error);
    return false;
  }
}

// Функция для получения списка чатов
async function listChats() {
  try {
    console.log('📋 Получение списка чатов...');

    const chats = await chrome.runtime.sendMessage({
      type: 'LIST_PLUGIN_CHATS',
      pluginId: null,
    });

    console.log('✅ Чаты найдены:', chats);
    return chats;
  } catch (error) {
    console.error('❌ Ошибка получения чатов:', error);
    return [];
  }
}

// Функция для получения списка черновиков
async function listDrafts() {
  try {
    console.log('📋 Получение списка черновиков...');

    const drafts = await chrome.runtime.sendMessage({
      type: 'LIST_PLUGIN_CHAT_DRAFTS',
      pluginId: null,
    });

    console.log('✅ Черновики найдены:', drafts);
    return drafts;
  } catch (error) {
    console.error('❌ Ошибка получения черновиков:', error);
    return [];
  }
}

// Функция для отправки тестового лога
async function sendTestLog() {
  try {
    console.log('📝 Отправка тестового лога...');

    await chrome.runtime.sendMessage({
      type: 'LOG_EVENT',
      pluginId: 'test-chat-plugin',
      pageKey: 'https://example.com/test',
      level: 'info',
      stepId: 'test-step',
      message: 'Тестовое сообщение лога для отладки',
      logData: { test: true, timestamp: Date.now() },
    });

    console.log('✅ Лог отправлен');
  } catch (error) {
    console.error('❌ Ошибка отправки лога:', error);
  }
}

// Запуск всех тестов
async function runAllTests() {
  console.log('🚀 Запуск всех тестов системы чатов...');

  await createTestChat();
  await sendTestLog();
  await listChats();
  await listDrafts();

  console.log('✅ Все тесты завершены!');
  console.log('💡 Теперь откройте DevTools и перейдите на вкладку "Чаты плагинов" для просмотра результатов');
}

// Экспортируем функции для использования в консоли
window.testChatSystem = {
  createTestChat,
  listChats,
  listDrafts,
  sendTestLog,
  runAllTests,
};

console.log('🎯 Функции тестирования доступны:');
console.log('- testChatSystem.createTestChat() - создать тестовый чат');
console.log('- testChatSystem.listChats() - получить список чатов');
console.log('- testChatSystem.listDrafts() - получить список черновиков');
console.log('- testChatSystem.sendTestLog() - отправить тестовый лог');
console.log('- testChatSystem.runAllTests() - запустить все тесты');

// Автоматически запускаем тесты
runAllTests();
