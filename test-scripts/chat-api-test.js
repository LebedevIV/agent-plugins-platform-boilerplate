// Тест API чата - для тестирования в Node.js среде
// Этот файл симулирует работу с chat API для проверки логики

const testChatApi = {
  // Симуляция chrome.storage.local API
  storage: {
    data: {},

    get(keys, callback) {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          result[key] = this.data[key] || null;
        });
      } else if (typeof keys === 'string') {
        result[keys] = this.data[keys] || null;
      } else {
        Object.assign(result, this.data);
      }
      console.log('[TEST] storage.get:', keys, '=>', result);
      setTimeout(() => callback(result), 10);
    },

    set(items, callback) {
      Object.assign(this.data, items);
      console.log('[TEST] storage.set:', items);
      setTimeout(() => callback(), 10);
    },

    remove(keys, callback) {
      if (Array.isArray(keys)) {
        keys.forEach(key => delete this.data[key]);
      } else {
        delete this.data[keys];
      }
      console.log('[TEST] storage.remove:', keys);
      setTimeout(() => callback(), 10);
    }
  },

  // Симуляция chrome.runtime.sendMessage
  async sendMessage(message) {
    console.log('[TEST] sendMessage:', message);

    return new Promise((resolve) => {
      setTimeout(() => {
        // Симуляция обработки сообщений background скриптом
        this.handleMessage(message, {}, resolve);
      }, Math.random() * 100 + 50); // Случайная задержка
    });
  },

  // Обработчик сообщений (симуляция background скрипта)
  handleMessage(message, sender, sendResponse) {
    console.log('[TEST] handleMessage:', message.type);

    switch (message.type) {
      case 'GET_PLUGIN_CHAT':
        this.storage.get([`${message.pluginId}::${message.pageKey}`], (result) => {
          const chat = result[`${message.pluginId}::${message.pageKey}`];
          if (chat && chat.messages) {
            sendResponse({
              messages: chat.messages,
              pluginId: chat.pluginId,
              pageKey: chat.pageKey
            });
          } else {
            sendResponse({ messages: [] });
          }
        });
        break;

      case 'SAVE_PLUGIN_CHAT_MESSAGE':
        const chatKey = `${message.pluginId}::${message.pageKey}`;
        this.storage.get([chatKey], (result) => {
          let chat = result[chatKey];

          if (!chat) {
            chat = {
              chatKey,
              pluginId: message.pluginId,
              pageKey: message.pageKey,
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
          }

          chat.messages.push(message.message);
          chat.updatedAt = Date.now();

          this.storage.set({ [chatKey]: chat }, () => {
            sendResponse({ success: true });
          });
        });
        break;

      case 'DELETE_PLUGIN_CHAT':
        this.storage.remove([`${message.pluginId}::${message.pageKey}`], () => {
          sendResponse({ success: true });
        });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  }
};

// === ТЕСТОВЫЕ СЦЕНАРИИ ===

async function runTests() {
  console.log('🧪 Начинаем тестирование Chat API...\n');

  const testPluginId = 'test-plugin';
  const testPageKey = 'test-page-key';

  try {
    // Тест 1: Получение пустого чата
    console.log('📥 Тест 1: Получение пустого чата');
    let response = await testChatApi.sendMessage({
      type: 'GET_PLUGIN_CHAT',
      pluginId: testPluginId,
      pageKey: testPageKey
    });
    console.log('Ответ:', response);
    console.log(response.messages && Array.isArray(response.messages) ? '✅' : '❌', '\n');

    // Тест 2: Сохранение сообщения
    console.log('💬 Тест 2: Сохранение сообщения');
    response = await testChatApi.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_MESSAGE',
      pluginId: testPluginId,
      pageKey: testPageKey,
      message: {
        role: 'user',
        content: 'Тестовое сообщение',
        timestamp: Date.now()
      }
    });
    console.log('Ответ:', response);
    console.log(response.success ? '✅' : '❌', '\n');

    // Тест 3: Получение чата с сообщением
    console.log('📥 Тест 3: Получение чата с сообщением');
    response = await testChatApi.sendMessage({
      type: 'GET_PLUGIN_CHAT',
      pluginId: testPluginId,
      pageKey: testPageKey
    });
    console.log('Ответ:', response);
    console.log(response.messages && response.messages.length > 0 ? '✅' : '❌', '\n');

    // Тест 4: Сохранение еще одного сообщения
    console.log('💬 Тест 4: Сохранение второго сообщения');
    response = await testChatApi.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_MESSAGE',
      pluginId: testPluginId,
      pageKey: testPageKey,
      message: {
        role: 'plugin',
        content: 'Ответ на тестовое сообщение',
        timestamp: Date.now()
      }
    });
    console.log('Ответ:', response);
    console.log(response.success ? '✅' : '❌', '\n');

    // Тест 5: Получение полного чата
    console.log('📥 Тест 5: Получение полного чата');
    response = await testChatApi.sendMessage({
      type: 'GET_PLUGIN_CHAT',
      pluginId: testPluginId,
      pageKey: testPageKey
    });
    console.log('Ответ:', response);
    console.log(response.messages && response.messages.length === 2 ? '✅' : '❌', '\n');

    // Тест 6: Удаление чата
    console.log('🗑️ Тест 6: Удаление чата');
    response = await testChatApi.sendMessage({
      type: 'DELETE_PLUGIN_CHAT',
      pluginId: testPluginId,
      pageKey: testPageKey
    });
    console.log('Ответ:', response);
    console.log(response.success ? '✅' : '❌', '\n');

    // Тест 7: Проверка удаления
    console.log('📥 Тест 7: Проверка удаления');
    response = await testChatApi.sendMessage({
      type: 'GET_PLUGIN_CHAT',
      pluginId: testPluginId,
      pageKey: testPageKey
    });
    console.log('Ответ:', response);
    console.log(response.messages && response.messages.length === 0 ? '✅' : '❌', '\n');

    // Тест 8: Обработка неизвестного типа сообщения
    console.log('❓ Тест 8: Неизвестный тип сообщения');
    response = await testChatApi.sendMessage({
      type: 'UNKNOWN_MESSAGE_TYPE',
      pluginId: testPluginId,
      pageKey: testPageKey
    });
    console.log('Ответ:', response);
    console.log(response.error ? '✅' : '❌', '\n');

    console.log('🎉 Все тесты завершены!');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запуск тестов
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testChatApi, runTests };
} else {
  // В браузере
  runTests();
}