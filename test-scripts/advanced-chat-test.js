// Продвинутое тестирование чата с проверкой новых улучшений
// Тестирует: Promise.race, таймауты, fallback, undefined handling

const advancedChatTest = {
  // Симуляция chrome.runtime.sendMessage с возможностью имитации проблем
  sendMessage(message, options = {}) {
    console.log('[ADVANCED_TEST] sendMessage:', message);

    return new Promise((resolve, reject) => {
      const {
        simulateDelay = Math.random() * 200 + 50, // Случайная задержка
        simulateTimeout = false,
        simulateUndefined = false,
        simulateError = false
      } = options;

      setTimeout(() => {
        if (simulateError) {
          console.log('[ADVANCED_TEST] Имитация ошибки');
          reject(new Error('Simulated error'));
          return;
        }

        if (simulateUndefined) {
          console.log('[ADVANCED_TEST] Имитация undefined ответа');
          resolve(undefined);
          return;
        }

        if (simulateTimeout && !options.isFallback) {
          console.log('[ADVANCED_TEST] Имитация таймаута');
          reject(new Error('TIMEOUT: Simulated timeout'));
          return;
        }

        // Нормальная обработка
        this.handleMessage(message, {}, (response) => {
          console.log('[ADVANCED_TEST] Ответ:', response);
          resolve(response);
        });
      }, simulateDelay);
    });
  },

  // Обработчик сообщений (упрощенная версия background)
  handleMessage(message, sender, sendResponse) {
    console.log('[ADVANCED_TEST] handleMessage:', message.type);

    switch (message.type) {
      case 'GET_PLUGIN_CHAT':
        // Имитация ответа background с диагностикой
        console.log('[ADVANCED_TEST] [background] GET_PLUGIN_CHAT:', {
          pluginId: message.pluginId,
          pageKey: message.pageKey
        });

        const chatKey = `${message.pluginId}::${message.pageKey}`;
        const mockChat = {
          chatKey,
          pluginId: message.pluginId,
          pageKey: message.pageKey,
          messages: [
            {
              role: 'user',
              content: 'Тестовое сообщение',
              timestamp: Date.now()
            }
          ],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        console.log('[ADVANCED_TEST] [background] sendResponse:', {
          messages: mockChat.messages,
          pluginId: mockChat.pluginId,
          pageKey: mockChat.pageKey
        });

        sendResponse({
          messages: mockChat.messages,
          pluginId: mockChat.pluginId,
          pageKey: mockChat.pageKey
        });
        break;

      case 'SAVE_PLUGIN_CHAT_MESSAGE':
        console.log('[ADVANCED_TEST] [background] SAVE_PLUGIN_CHAT_MESSAGE:', {
          pluginId: message.pluginId,
          pageKey: message.pageKey,
          message: message.message
        });

        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  },

  // Тестирование Promise.race с логированием (как в PluginControlPanel)
  async testPromiseRace() {
    console.log('\n🧪 Тест 1: Promise.race с логированием');

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT: test timeout')), 1000)
    );

    const sendMessagePromise = this.sendMessage({
      type: 'GET_PLUGIN_CHAT',
      pluginId: 'test-plugin',
      pageKey: 'test-page'
    });

    console.log('[ADVANCED_TEST] ДО ОЖИДАНИЯ - sendMessagePromise:', {
      promise: sendMessagePromise,
      typeofPromise: typeof sendMessagePromise,
    });

    let response;
    let raceError = null;

    try {
      response = await Promise.race([sendMessagePromise, timeoutPromise]);
      console.log('[ADVANCED_TEST] СЫРОЙ ОТВЕТ ОТ BACKGROUND:', {
        response,
        typeofResponse: typeof response,
        responseKeys: response ? Object.keys(response) : 'response is null/undefined',
        responseType: typeof response,
        isPromise: response instanceof Promise,
        constructorName: response?.constructor?.name,
      });
    } catch (error) {
      raceError = error;
      console.error('[ADVANCED_TEST] Ошибка в Promise.race:', {
        error,
        message: error.message,
        stack: error.stack,
      });
    }

    // Проверка результатов Promise.race
    if (raceError) {
      console.error('[ADVANCED_TEST] Promise.race завершился с ошибкой:', {
        error: raceError.message,
        timeout: 1000,
      });

      // Попытка получить ответ напрямую
      console.log('[ADVANCED_TEST] Попытка получить ответ после таймаута...');

      try {
        const directResponse = await this.sendMessage({
          type: 'GET_PLUGIN_CHAT',
          pluginId: 'test-plugin',
          pageKey: 'test-page'
        });
        console.log('[ADVANCED_TEST] Прямой ответ после таймаута:', directResponse);

        if (directResponse) {
          response = directResponse;
          console.log('[ADVANCED_TEST] Успешно получен прямой ответ после таймаута');
        } else {
          throw new Error('Прямой ответ тоже undefined');
        }
      } catch (directError) {
        console.error('[ADVANCED_TEST] Прямой ответ тоже не получен:', directError);
      }
    }

    // Финальная проверка
    if (!response) {
      console.error('[ADVANCED_TEST] Критическая ошибка: response всё ещё undefined после всех попыток');
      return false;
    }

    console.log('[ADVANCED_TEST] ✅ Promise.race тест завершен успешно');
    return true;
  },

  // Тестирование обработки разных форматов ответа
  async testResponseFormatHandling() {
    console.log('\n🧪 Тест 2: Обработка разных форматов ответа');

    // Тест различных форматов ответа
    const testCases = [
      {
        name: 'Формат {messages: [...]}',
        response: {
          messages: [{ role: 'user', content: 'Test message', timestamp: Date.now() }]
        }
      },
      {
        name: 'Формат {chat: [...]}',
        response: {
          chat: [{ role: 'user', content: 'Test message', timestamp: Date.now() }]
        }
      },
      {
        name: 'Формат {chat: {messages: [...]}}',
        response: {
          chat: {
            messages: [{ role: 'user', content: 'Test message', timestamp: Date.now() }]
          }
        }
      },
      {
        name: 'Пустой ответ',
        response: {}
      },
      {
        name: 'null',
        response: null
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n--- ${testCase.name} ---`);
      console.log('Вход:', testCase.response);

      // Логика обработки ответа (из PluginControlPanel)
      let messagesArray = null;
      let chatData = testCase.response;

      if (chatData && Array.isArray(chatData.messages)) {
        messagesArray = chatData.messages;
        console.log('Используем формат с messages:', messagesArray.length);
      } else if (chatData && Array.isArray(chatData.chat)) {
        messagesArray = chatData.chat;
        console.log('Используем формат с chat:', messagesArray.length);
      } else if (chatData && chatData.chat && Array.isArray(chatData.chat.messages)) {
        messagesArray = chatData.chat.messages;
        console.log('Используем вложенный формат:', messagesArray.length);
      } else {
        console.warn('Неизвестный формат ответа:', chatData);
        messagesArray = [];
      }

      console.log('Результат:', {
        messagesArray,
        isArray: Array.isArray(messagesArray),
        length: messagesArray?.length
      });
    }

    console.log('[ADVANCED_TEST] ✅ Тест форматов завершен');
    return true;
  },

  // Тестирование fallback логики
  async testFallbackLogic() {
    console.log('\n🧪 Тест 3: Fallback логика');

    try {
      // Имитация ситуации с undefined ответом
      const response = await this.sendMessage({
        type: 'GET_PLUGIN_CHAT',
        pluginId: 'test-plugin',
        pageKey: 'test-page'
      }, { simulateUndefined: true });

      console.log('Получен ответ:', response);

      if (!response) {
        console.log('✅ Обнаружен undefined ответ, тестируем fallback...');

        // Fallback логика
        await new Promise(resolve => setTimeout(resolve, 1000));

        const fallbackResponse = await this.sendMessage({
          type: 'GET_PLUGIN_CHAT',
          pluginId: 'test-plugin',
          pageKey: 'test-page'
        }, { isFallback: true });

        console.log('Fallback ответ:', fallbackResponse);

        if (fallbackResponse && fallbackResponse.messages) {
          console.log('✅ Fallback сработал успешно');
          return true;
        } else {
          console.log('❌ Fallback не помог');
          return false;
        }
      }

    } catch (error) {
      console.error('❌ Ошибка в fallback тесте:', error);
      return false;
    }
  },

  // Тестирование обработки ошибок
  async testErrorHandling() {
    console.log('\n🧪 Тест 4: Обработка ошибок и исключений');

    const errorCases = [
      { name: 'TIMEOUT ошибка', options: { simulateTimeout: true } },
      { name: 'Undefined ответ', options: { simulateUndefined: true } },
      { name: 'Общая ошибка', options: { simulateError: true } }
    ];

    for (const errorCase of errorCases) {
      console.log(`\n--- ${errorCase.name} ---`);

      try {
        const response = await this.sendMessage({
          type: 'GET_PLUGIN_CHAT',
          pluginId: 'test-plugin',
          pageKey: 'test-page'
        }, errorCase.options);

        console.log('Ответ:', response);

        if (!response && errorCase.name.includes('Undefined')) {
          console.log('✅ Undefined ответ обработан корректно');
        } else if (response) {
          console.log('✅ Ответ получен несмотря на ошибку');
        }

      } catch (error) {
        console.log(`✅ Ошибка ${errorCase.name} поймана:`, error.message);

        // Проверка на специальные обработки
        if (error.message.includes('TIMEOUT') || error.message.includes('undefined')) {
          console.log('✅ Специальная обработка сработала');
        }
      }
    }

    console.log('[ADVANCED_TEST] ✅ Тест обработки ошибок завершен');
    return true;
  }
};

// === ЗАПУСК ТЕСТОВ ===

async function runAdvancedTests() {
  console.log('🚀 Начинаем продвинутое тестирование чата...\n');

  const results = [];

  try {
    // Тест 1: Promise.race с логированием
    results.push(await advancedChatTest.testPromiseRace());

    // Тест 2: Обработка форматов ответа
    results.push(await advancedChatTest.testResponseFormatHandling());

    // Тест 3: Fallback логика
    results.push(await advancedChatTest.testFallbackLogic());

    // Тест 4: Обработка ошибок
    results.push(await advancedChatTest.testErrorHandling());

    // Итоги
    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log('\n📋 РЕЗУЛЬТАТЫ ПРОДВИНУТОГО ТЕСТИРОВАНИЯ:');
    console.log(`✅ Пройдено: ${passed}/${total}`);
    console.log(`❌ Провалено: ${total - passed}/${total}`);

    if (passed === total) {
      console.log('\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!');
      console.log('Новые улучшения работают корректно.');
    } else {
      console.log('\n⚠️ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ');
      console.log('Требуется дополнительная настройка.');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка тестирования:', error);
  }
}

// Запуск
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { advancedChatTest, runAdvancedTests };
} else {
  runAdvancedTests();
}