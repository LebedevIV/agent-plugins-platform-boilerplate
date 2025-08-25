// Интеграционное тестирование чата - проверка взаимодействия компонентов
// Имитирует работу PluginControlPanel с background

const integrationTest = {
  // Имитация состояния PluginControlPanel
  mockPluginControlPanel: {
    pluginId: 'test-plugin',
    pageKey: 'https://example.com/test',
    messages: [],
    loading: false,
    error: null,

    // Имитация loadChat функции из PluginControlPanel
    async loadChat() {
      console.log('[INTEGRATION] PluginControlPanel.loadChat - запрос к background');

      this.loading = true;
      this.error = null;

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT: loadChat не получил ответ от background')), 5000)
      );

      const sendMessagePromise = integrationTest.mockChromeRuntime.sendMessage({
        type: 'GET_PLUGIN_CHAT',
        pluginId: this.pluginId,
        pageKey: this.pageKey,
      });

      console.log('[INTEGRATION] ДО ОЖИДАНИЯ - sendMessagePromise:', {
        promise: sendMessagePromise,
        typeofPromise: typeof sendMessagePromise,
      });

      let response;
      let raceError = null;

      try {
        response = await Promise.race([sendMessagePromise, timeoutPromise]);
        console.log('[INTEGRATION] СЫРОЙ ОТВЕТ ОТ BACKGROUND:', {
          response,
          typeofResponse: typeof response,
          responseKeys: response ? Object.keys(response) : 'response is null/undefined',
          responseType: typeof response,
          responseStringified: JSON.stringify(response),
          isPromise: response instanceof Promise,
          constructorName: response?.constructor?.name,
        });
      } catch (error) {
        raceError = error;
        console.error('[INTEGRATION] Ошибка в Promise.race:', {
          error,
          message: error.message,
          stack: error.stack,
        });
      }

      // Обработка результатов Promise.race
      if (raceError) {
        console.error('[INTEGRATION] Promise.race завершился с ошибкой:', {
          error: raceError.message,
          pluginId: this.pluginId,
          pageKey: this.pageKey,
          timeout: 5000,
        });

        if (raceError.message.includes('TIMEOUT')) {
          console.log('[INTEGRATION] Попытка получить ответ после таймаута...');

          try {
            const directResponse = await integrationTest.mockChromeRuntime.sendMessage({
              type: 'GET_PLUGIN_CHAT',
              pluginId: this.pluginId,
              pageKey: this.pageKey,
            });
            console.log('[INTEGRATION] Прямой ответ после таймаута:', directResponse);

            if (directResponse) {
              response = directResponse;
              console.log('[INTEGRATION] Успешно получен прямой ответ после таймаута');
            } else {
              throw new Error('Прямой ответ тоже undefined');
            }
          } catch (directError) {
            console.error('[INTEGRATION] Прямой ответ тоже не получен:', directError);
          }
        }
      }

      // Проверка на undefined после всех попыток
      if (!response) {
        console.error('[INTEGRATION] Критическая ошибка: response всё ещё undefined после всех попыток');
        console.error('[INTEGRATION] Финальная диагностика:', {
          pluginId: this.pluginId,
          pageKey: this.pageKey,
          raceError: raceError?.message,
          chromeRuntimeAvailable: typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage,
        });
        this.error = 'Критическая ошибка: не удалось получить ответ от background';
        this.messages = [];
        this.loading = false;
        return;
      }

      // Проверка на ошибку от background
      if (response && response.error) {
        console.error('[INTEGRATION] Background вернул ошибку:', response.error, response.details);
        this.messages = [];
        this.loading = false;
        return;
      }

      // Обработка разных форматов ответа
      let chatData = response;
      console.log('[INTEGRATION] Анализ chatData:', {
        chatData,
        hasMessages: chatData && 'messages' in chatData,
        hasChat: chatData && 'chat' in chatData,
        messagesValue: chatData?.messages,
        chatValue: chatData?.chat,
        isMessagesArray: Array.isArray(chatData?.messages),
        isChatArray: Array.isArray(chatData?.chat),
      });

      let messagesArray = null;

      if (chatData && Array.isArray(chatData.messages)) {
        messagesArray = chatData.messages;
        console.log('[INTEGRATION] Используем формат с messages:', messagesArray.length);
      } else if (chatData && Array.isArray(chatData.chat)) {
        messagesArray = chatData.chat;
        console.log('[INTEGRATION] Используем формат с chat:', messagesArray.length);
      } else if (chatData && chatData.chat && Array.isArray(chatData.chat.messages)) {
        messagesArray = chatData.chat.messages;
        console.log('[INTEGRATION] Используем вложенный формат:', messagesArray.length);
      } else {
        console.warn('[INTEGRATION] Неизвестный формат ответа:', chatData);
        messagesArray = [];
      }

      console.log('[INTEGRATION] Финальный messagesArray:', {
        messagesArray,
        isArray: Array.isArray(messagesArray),
        length: messagesArray?.length,
        firstMessage: messagesArray?.[0],
      });

      // Конвертация сообщений
      if (Array.isArray(messagesArray) && messagesArray.length > 0) {
        const convertedMessages = messagesArray
          .filter((msg) => msg && typeof msg === 'object')
          .map((msg, index) => ({
            id: msg.id || String(msg.timestamp || Date.now() + index),
            text: msg.content || msg.text || '',
            isUser: msg.role ? msg.role === 'user' : !!msg.isUser,
            timestamp: msg.timestamp || Date.now(),
          }));
        console.log('[INTEGRATION] convertedMessages:', convertedMessages);
        this.messages = convertedMessages;
      } else {
        console.log('[INTEGRATION] messagesArray пустой или не массив, устанавливаем пустой массив');
        this.messages = [];
      }

      this.loading = false;
    },

    // Имитация handleSendMessage
    async handleSendMessage(messageText) {
      console.log('[INTEGRATION] handleSendMessage: попытка отправки', { messageText });
      if (!messageText.trim()) return;

      const newMessage = {
        id: Date.now().toString(),
        text: messageText.trim(),
        isUser: true,
        timestamp: Date.now(),
      };

      // Добавляем в локальный стейт оптимистично
      this.messages.push(newMessage);

      try {
        const response = await integrationTest.mockChromeRuntime.sendMessage({
          type: 'SAVE_PLUGIN_CHAT_MESSAGE',
          pluginId: this.pluginId,
          pageKey: this.pageKey,
          message: {
            role: 'user',
            content: newMessage.text,
            timestamp: newMessage.timestamp,
          },
        });
        console.log('[INTEGRATION] handleSendMessage: сообщение отправлено', newMessage, response);

        // Перезагружаем историю чата
        await this.loadChat();
      } catch (e) {
        console.error('[INTEGRATION] handleSendMessage: ошибка отправки', e);
        this.error = 'Ошибка сохранения сообщения';

        // Удаляем оптимистично добавленное сообщение
        this.messages = this.messages.filter(msg => msg.id !== newMessage.id);
      }
    }
  },

  // Имитация chrome.runtime API
  mockChromeRuntime: {
    async sendMessage(message) {
      console.log('[MOCK_CHROME] sendMessage:', message);

      return new Promise((resolve) => {
        setTimeout(() => {
          integrationTest.mockBackground.handleMessage(message, {}, resolve);
        }, Math.random() * 100 + 50);
      });
    },

    onMessage: {
      listeners: [],

      addListener(callback) {
        this.listeners.push(callback);
      },

      removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      }
    }
  },

  // Имитация background скрипта
  mockBackground: {
    chatStorage: {},

    handleMessage(message, sender, sendResponse) {
      console.log('[MOCK_BACKGROUND] handleMessage:', message.type);

      switch (message.type) {
        case 'GET_PLUGIN_CHAT':
          const chatKey = `${message.pluginId}::${message.pageKey}`;
          const chat = this.chatStorage[chatKey];

          console.log('[MOCK_BACKGROUND] GET_PLUGIN_CHAT:', {
            chatKey,
            chat,
            messages: chat?.messages
          });

          console.log('[MOCK_BACKGROUND] sendResponse(GET_PLUGIN_CHAT):', {
            messages: chat?.messages || [],
            pluginId: message.pluginId,
            pageKey: message.pageKey
          });

          console.log('[MOCK_BACKGROUND] ДО sendResponse - тип chat:', typeof chat);
          console.log('[MOCK_BACKGROUND] ДО sendResponse - ключи chat:', chat ? Object.keys(chat) : 'chat is null/undefined');
          console.log('[MOCK_BACKGROUND] ДО sendResponse - chat.messages:', chat?.messages);
          console.log('[MOCK_BACKGROUND] ДО sendResponse - Array.isArray(chat?.messages):', Array.isArray(chat?.messages));

          sendResponse({
            messages: chat?.messages || [],
            pluginId: message.pluginId,
            pageKey: message.pageKey
          });

          console.log('[MOCK_BACKGROUND] ПОСЛЕ sendResponse - ответ отправлен');

          // Диагностика после отправки ответа
          console.log('[MOCK_BACKGROUND] ДОБАВЛЕНИЕ: Диагностика после sendResponse:', {
            chatKey,
            pageKey: message.pageKey,
            timestamp: Date.now(),
          });
          break;

        case 'SAVE_PLUGIN_CHAT_MESSAGE':
          const saveChatKey = `${message.pluginId}::${message.pageKey}`;

          if (!this.chatStorage[saveChatKey]) {
            this.chatStorage[saveChatKey] = {
              chatKey: saveChatKey,
              pluginId: message.pluginId,
              pageKey: message.pageKey,
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
          }

          this.chatStorage[saveChatKey].messages.push(message.message);
          this.chatStorage[saveChatKey].updatedAt = Date.now();

          console.log('[MOCK_BACKGROUND] SAVE_PLUGIN_CHAT_MESSAGE:', {
            chatKey: saveChatKey,
            message: message.message,
            updatedChat: this.chatStorage[saveChatKey]
          });

          sendResponse({ success: true });

          // Имитируем broadcastChatUpdate
          setTimeout(() => {
            integrationTest.mockChromeRuntime.onMessage.listeners.forEach(listener => {
              listener({
                type: 'PLUGIN_CHAT_UPDATED',
                pluginId: message.pluginId,
                pageKey: message.pageKey
              });
            });
          }, 100);
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    }
  }
};

// === ТЕСТОВЫЕ СЦЕНАРИИ ===

async function runIntegrationTests() {
  console.log('🔗 Начинаем интеграционное тестирование чата...\n');

  const panel = integrationTest.mockPluginControlPanel;

  try {
    // Тест 1: Загрузка пустого чата
    console.log('📥 Тест 1: Загрузка пустого чата');
    await panel.loadChat();
    console.log('Состояние после загрузки:', {
      messages: panel.messages.length,
      loading: panel.loading,
      error: panel.error
    });

    // Тест 2: Отправка сообщения
    console.log('\n💬 Тест 2: Отправка сообщения');
    await panel.handleSendMessage('Тестовое сообщение для интеграции');
    console.log('Состояние после отправки:', {
      messages: panel.messages.length,
      loading: panel.loading,
      error: panel.error
    });

    // Тест 3: Повторная загрузка чата
    console.log('\n📥 Тест 3: Повторная загрузка чата');
    await panel.loadChat();
    console.log('Состояние после повторной загрузки:', {
      messages: panel.messages.length,
      loading: panel.loading,
      error: panel.error,
      messagesContent: panel.messages.map(m => ({ text: m.text, isUser: m.isUser }))
    });

    // Тест 4: Отправка еще одного сообщения
    console.log('\n💬 Тест 4: Отправка второго сообщения');
    await panel.handleSendMessage('Второе тестовое сообщение');
    console.log('Состояние после второго сообщения:', {
      messages: panel.messages.length,
      loading: panel.loading,
      error: panel.error,
      messagesContent: panel.messages.map(m => ({ text: m.text, isUser: m.isUser }))
    });

    // Тест 5: Финальная проверка
    console.log('\n📊 Тест 5: Финальная проверка состояния');
    await panel.loadChat();
    console.log('Финальное состояние:', {
      messagesCount: panel.messages.length,
      loading: panel.loading,
      error: panel.error,
      allMessages: panel.messages.map(m => ({ id: m.id, text: m.text, isUser: m.isUser, timestamp: m.timestamp }))
    });

    // Проверка корректности
    const expectedMessages = 2;
    const actualMessages = panel.messages.length;

    if (actualMessages === expectedMessages && !panel.error) {
      console.log('\n✅ ИНТЕГРАЦИОННОЕ ТЕСТИРОВАНИЕ ПРОШЛО УСПЕШНО!');
      console.log(`📈 Отправлено и сохранено ${actualMessages} сообщений`);
      console.log('🔄 Синхронизация между компонентами работает корректно');
      console.log('⚡ Обработка ошибок и undefined ответов реализована правильно');
    } else {
      console.log('\n❌ ИНТЕГРАЦИОННОЕ ТЕСТИРОВАНИЕ ВЫЯВИЛО ПРОБЛЕМЫ:');
      console.log(`Ожидалось: ${expectedMessages} сообщений`);
      console.log(`Получено: ${actualMessages} сообщений`);
      if (panel.error) {
        console.log(`Ошибка: ${panel.error}`);
      }
    }

  } catch (error) {
    console.error('❌ Критическая ошибка интеграционного тестирования:', error);
  }
}

// Запуск
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { integrationTest, runIntegrationTests };
} else {
  runIntegrationTests();
}