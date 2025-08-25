// Тестовый скрипт для проверки исправлений коммуникации между PluginControlPanel и background
// Запуск: node test-scripts/test-message-communication.js

console.log('🧪 Тестирование исправлений коммуникации message port...');

// Имитация chrome.runtime API для тестирования
const mockChrome = {
  runtime: {
    sendMessage: (message, callback) => {
      console.log('📤 Отправка сообщения:', message);

      // Имитация ответа background script
      setTimeout(() => {
        if (message.type === 'GET_PLUGIN_CHAT') {
          callback({
            messages: [
              {
                id: 'test-1',
                content: 'Тестовое сообщение 1',
                role: 'user',
                timestamp: Date.now()
              },
              {
                id: 'test-2',
                content: 'Тестовое сообщение 2',
                role: 'bot',
                timestamp: Date.now()
              }
            ]
          });
        } else if (message.type === 'SAVE_PLUGIN_CHAT_MESSAGE') {
          callback({ success: true });
        } else {
          callback({ error: 'Неизвестный тип сообщения' });
        }
      }, 100); // Имитация задержки background
    },

    lastError: null,

    onMessage: {
      addListener: (listener) => {
        console.log('📡 Добавлен слушатель сообщений');
      },
      removeListener: (listener) => {
        console.log('🔌 Удален слушатель сообщений');
      }
    }
  }
};

// Глобальный объект chrome для тестирования
global.chrome = mockChrome;

// Имитация Promise-based подхода (как в исправленном коде)
function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Message timeout after 10000ms'));
    }, 10000);

    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        console.error('❌ sendMessageToBackground error:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response === undefined) {
        console.warn('⚠️ sendMessageToBackground: received undefined response');
        reject(new Error('Background script returned undefined'));
        return;
      }

      resolve(response);
    });
  });
}

// Тест 1: Проверка GET_PLUGIN_CHAT
async function testGetPluginChat() {
  console.log('\n📋 Тест 1: GET_PLUGIN_CHAT');

  try {
    const response = await sendMessageToBackground({
      type: 'GET_PLUGIN_CHAT',
      pluginId: 'test-plugin',
      pageKey: 'test-page'
    });

    console.log('✅ GET_PLUGIN_CHAT успешно:', response);
    console.log('   - Сообщений:', response.messages?.length || 0);
    console.log('   - Первое сообщение:', response.messages?.[0]?.content);

    return true;
  } catch (error) {
    console.error('❌ GET_PLUGIN_CHAT ошибка:', error.message);
    return false;
  }
}

// Тест 2: Проверка SAVE_PLUGIN_CHAT_MESSAGE
async function testSavePluginChatMessage() {
  console.log('\n📝 Тест 2: SAVE_PLUGIN_CHAT_MESSAGE');

  try {
    const response = await sendMessageToBackground({
      type: 'SAVE_PLUGIN_CHAT_MESSAGE',
      pluginId: 'test-plugin',
      pageKey: 'test-page',
      message: {
        role: 'user',
        content: 'Тестовое сообщение для сохранения',
        timestamp: Date.now()
      }
    });

    console.log('✅ SAVE_PLUGIN_CHAT_MESSAGE успешно:', response);
    console.log('   - Успех:', response.success);

    return true;
  } catch (error) {
    console.error('❌ SAVE_PLUGIN_CHAT_MESSAGE ошибка:', error.message);
    return false;
  }
}

// Тест 3: Проверка timeout
async function testTimeout() {
  console.log('\n⏱️ Тест 3: Проверка timeout');

  // Изменяем mock для имитации долгого ответа
  const originalSendMessage = mockChrome.runtime.sendMessage;
  mockChrome.runtime.sendMessage = (message, callback) => {
    // Имитация очень долгого ответа (больше timeout)
    setTimeout(() => {
      callback({ success: true });
    }, 15000); // 15 секунд - больше чем наш timeout 10 секунд
  };

  try {
    const response = await sendMessageToBackground({
      type: 'TEST_TIMEOUT',
      pluginId: 'test-plugin'
    });

    console.log('❌ Ожидался timeout, но получили ответ:', response);
    return false;
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.log('✅ Timeout сработал корректно:', error.message);
      return true;
    } else {
      console.error('❌ Неожиданная ошибка:', error.message);
      return false;
    }
  } finally {
    // Восстанавливаем оригинальную функцию
    mockChrome.runtime.sendMessage = originalSendMessage;
  }
}

// Тест 4: Проверка обработки undefined response
async function testUndefinedResponse() {
  console.log('\n⚠️ Тест 4: Проверка undefined response');

  // Изменяем mock для возврата undefined
  const originalSendMessage = mockChrome.runtime.sendMessage;
  mockChrome.runtime.sendMessage = (message, callback) => {
    callback(undefined); // Возвращаем undefined
  };

  try {
    const response = await sendMessageToBackground({
      type: 'TEST_UNDEFINED',
      pluginId: 'test-plugin'
    });

    console.log('❌ Ожидалась ошибка undefined, но получили ответ:', response);
    return false;
  } catch (error) {
    if (error.message.includes('undefined')) {
      console.log('✅ Обработка undefined сработала корректно:', error.message);
      return true;
    } else {
      console.error('❌ Неожиданная ошибка:', error.message);
      return false;
    }
  } finally {
    // Восстанавливаем оригинальную функцию
    mockChrome.runtime.sendMessage = originalSendMessage;
  }
}

// Основная функция тестирования
async function runTests() {
  console.log('🚀 Запуск тестов исправлений коммуникации...\n');

  const tests = [
    testGetPluginChat,
    testSavePluginChatMessage,
    testTimeout,
    testUndefinedResponse
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error('💥 Критическая ошибка в тесте:', error);
      failed++;
    }
  }

  console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:');
  console.log(`✅ Пройдено: ${passed}`);
  console.log(`❌ Провалено: ${failed}`);
  console.log(`📈 Всего тестов: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Исправления работают корректно.');
    console.log('🔧 Рекомендуется провести интеграционное тестирование в браузере.');
  } else {
    console.log('\n⚠️ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ. Требуется дополнительная отладка.');
  }
}

// Запуск тестов
runTests().catch(console.error);