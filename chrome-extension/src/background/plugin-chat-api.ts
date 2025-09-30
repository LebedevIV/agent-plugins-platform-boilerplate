// Plugin Chat API — современный кэш и хранилище чатов плагинов для background.js
// IndexedDB + LRU + Promise API + Ленивая синхронизация

// --- МИГРАЦИЯ НА chrome.storage.local ---
// Вся логика работы с чатами и черновиками теперь через chrome.storage.local
// Все методы возвращают Promise для совместимости

import { getPageKey } from '../../../packages/shared/lib/utils/helpers';

const pluginChatApi = {
  // Очередь для последовательной обработки сообщений (предотвращает race condition)
  _messageSaveQueue: new Map<string, Promise<any>>(),

  // Создание чата при начале ввода (ленивая инициализация)
  async createChatIfNotExists(pluginId: string, pageKey: string): Promise<PluginChat> {
    const chatKey = `${pluginId}::${getPageKey(pageKey)}`;
    console.log('[pluginChatApi] createChatIfNotExists: начало', {
      pluginId,
      pageKey,
      chatKey,
      normalizedPageKey: getPageKey(pageKey)
    });

    const chat = await this.getOrLoadChat(chatKey);
    if (chat) {
      console.log('[pluginChatApi] createChatIfNotExists: чат уже существует', {
        chat,
        messagesLength: chat.messages?.length
      });
      return chat;
    }

    const now = Date.now();
    const newChat: PluginChat = {
      chatKey,
      pluginId,
      pageKey,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    console.log('[pluginChatApi] createChatIfNotExists: создаём новый чат', {
      newChat,
      chatKey,
      serializedSize: JSON.stringify(newChat).length
    });

    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({ [chatKey]: newChat }, () => {
        if (chrome.runtime.lastError) {
          console.error('[pluginChatApi] createChatIfNotExists: ошибка создания чата', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        console.log('[pluginChatApi] createChatIfNotExists: создан новый чат', newChat);

        // Проверяем, что чат действительно сохранён
        chrome.storage.local.get([chatKey], result => {
          const savedChat = result[chatKey];
          console.log('[pluginChatApi] createChatIfNotExists: проверка после создания', {
            savedChat,
            savedChatType: typeof savedChat,
            savedMessagesLength: savedChat?.messages?.length
          });
          resolve();
        });
      });
    });
    return newChat;
  },

  // Получить чат по ключу или null
  async getOrLoadChat(chatKey: string): Promise<PluginChat | null> {
    return new Promise(resolve => {
      chrome.storage.local.get([chatKey], result => {
        const chat = result[chatKey] || null;
        console.log('[pluginChatApi] getOrLoadChat:', {
          chatKey,
          chat,
          chatType: typeof chat,
          hasChat: !!chat,
          messages: chat?.messages,
          messagesType: typeof chat?.messages,
          messagesLength: chat?.messages?.length,
          storageKeys: Object.keys(result)
        });

        // Дополнительная диагностика: проверим все ключи в storage
        chrome.storage.local.get(null, allData => {
          const relatedKeys = Object.keys(allData).filter(key => key.includes(chatKey.split('::')[0]));
          console.log('[pluginChatApi] getOrLoadChat - all storage keys:', Object.keys(allData));
          console.log('[pluginChatApi] getOrLoadChat - related keys:', relatedKeys);
          console.log('[pluginChatApi] getOrLoadChat - all data:', allData);
        });

        resolve(chat);
      });
    });
  },

  // Получить чат по pluginId и pageKey (публичная функция для совместимости)
  async getChat(pluginId: string, pageKey: string): Promise<PluginChat | null> {
    const chatKey = `${pluginId}::${getPageKey(pageKey)}`;
    console.log('[pluginChatApi] getChat: формирование chatKey', {
      pluginId,
      pageKey,
      chatKey,
      normalizedPageKey: getPageKey(pageKey)
    });

    return this.getOrLoadChat(chatKey);
  },

  // Сохранить сообщение в чат
  async saveMessage(pluginId: string, pageKey: string, message: ChatMessage): Promise<{ success: boolean, verified: boolean, messageId: string, verificationReason?: string }> {
    const chatKey = `${pluginId}::${getPageKey(pageKey)}`;

    // Ожидаем завершения предыдущей операции сохранения для этого чата
    const queueKey = chatKey;
    if (this._messageSaveQueue.has(queueKey)) {
      console.log('[pluginChatApi][saveMessage] Ожидание предыдущей операции сохранения', { queueKey });
      await this._messageSaveQueue.get(queueKey);
    }

    console.log('[pluginChatApi][saveMessage] BEFORE', {
      chatKey,
      pluginId,
      pageKey,
      message,
      messageType: typeof message,
      messageKeys: Object.keys(message),
      pageKeyNormalized: getPageKey(pageKey)
    });

    let chat = await this.getOrLoadChat(chatKey);
    if (!chat) {
      console.warn('[pluginChatApi][saveMessage] чат не найден, создаём новый');
      await this.createChatIfNotExists(pluginId, pageKey);
      // После создания чата — получить его снова
      chat = await this.getOrLoadChat(chatKey);
      if (!chat) {
        // Если всё равно не найден — ошибка
        console.error('[pluginChatApi][saveMessage] не удалось создать чат!');
        return { success: false };
      }
    }

    console.log('[pluginChatApi][saveMessage] перед push:', {
      chatMessagesLength: chat.messages?.length,
      messageToAdd: message
    });

    chat.messages.push(message);
    console.log('[pluginChatApi][saveMessage] chat.messages после push:', {
      messages: chat.messages,
      messagesLength: chat.messages.length,
      lastMessage: chat.messages[chat.messages.length - 1]
    });

    chat.updatedAt = Date.now();

    // Проверяем сериализуемость данных перед сохранением
    try {
      const serialized = JSON.stringify(chat);
      console.log('[pluginChatApi][saveMessage] сериализация успешна:', {
        originalSize: JSON.stringify(chat).length,
        messagesCount: chat.messages.length
      });
    } catch (serializationError) {
      console.error('[pluginChatApi][saveMessage] ошибка сериализации:', serializationError);
      return { success: false };
    }

    // Создаём Promise для сохранения и верификации
    const savePromise = new Promise<{ success: boolean, verified: boolean, messageId: string, verificationReason?: string }>((resolve) => {
      chrome.storage.local.set({ [chatKey]: chat }, async () => {
        if (chrome.runtime.lastError) {
          console.error('[pluginChatApi][saveMessage] chrome.storage error:', chrome.runtime.lastError);
          resolve({ success: false, verified: false, messageId: message.id || '', verificationReason: 'storage_error' });
          return;
        }

        console.log('[pluginChatApi][saveMessage] AFTER set:', {
          chatKey,
          chat,
          success: true
        });

        // ВЕРИФИКАЦИЯ с retry logic: проверяем, что сообщение действительно сохранено
        // Механизм повторных попыток с увеличивающимися задержками для обработки быстрого потока от Pyodide
        const result = await this.verifyMessageWithRetry(chatKey, message);
        resolve(result);
      });
    });

    // Добавляем Promise в очередь для последовательной обработки
    this._messageSaveQueue.set(queueKey, savePromise);

    // После завершения операции удаляем её из очереди
    savePromise.finally(() => {
      this._messageSaveQueue.delete(queueKey);
      console.log('[pluginChatApi][saveMessage] Операция завершена, удалена из очереди', { queueKey });
    });

    return savePromise;
  },

  // Удалить чат
  async deleteChat(pluginId: string, pageKey: string): Promise<{ success: boolean }> {
    const chatKey = `${pluginId}::${getPageKey(pageKey)}`;
    await new Promise<void>(resolve => {
      chrome.storage.local.remove([chatKey], () => {
        console.log('[pluginChatApi] deleteChat:', chatKey);
        resolve();
      });
    });
    return { success: true };
  },

  // Сохранить черновик
  async saveDraft(pluginId: string, pageKey: string, text: string): Promise<{ success: boolean }> {
    const draftKey = `${pluginId}::${getPageKey(pageKey)}::draft`;
    const draft = {
      draftKey,
      pluginId,
      pageKey,
      text,
      updatedAt: Date.now(),
    };
    console.log('[pluginChatApi][saveDraft] BEFORE', { draftKey, pluginId, pageKey, text });
    await new Promise<void>(resolve => {
      chrome.storage.local.set({ [draftKey]: draft }, () => {
        console.log('[pluginChatApi][saveDraft] AFTER', { draftKey, pluginId, pageKey, text, draft });
        resolve();
      });
    });
    return { success: true };
  },

  // Получить черновик
  async getDraft(pluginId: string, pageKey: string): Promise<{ draftText: string }> {
    const draftKey = `${pluginId}::${getPageKey(pageKey)}::draft`;
    console.log('[pluginChatApi][getDraft] BEFORE', { draftKey, pluginId, pageKey });
    return new Promise(resolve => {
      chrome.storage.local.get([draftKey], result => {
        const draft = result[draftKey];
        const draftText = draft && typeof draft.text === 'string' ? draft.text : '';
        console.log('[pluginChatApi][getDraft] AFTER', { draftKey, pluginId, pageKey, draft, draftText });
        resolve({ draftText });
      });
    });
  },

  // Удалить черновик
  async deleteDraft(pluginId: string, pageKey: string): Promise<{ success: boolean }> {
    const draftKey = `${pluginId}::${getPageKey(pageKey)}::draft`;
    console.log('[pluginChatApi][deleteDraft] BEFORE', { draftKey, pluginId, pageKey });
    await new Promise<void>(resolve => {
      chrome.storage.local.remove([draftKey], () => {
        console.log('[pluginChatApi][deleteDraft] AFTER', { draftKey, pluginId, pageKey });
        resolve();
      });
    });
    return { success: true };
  },

  // Вспомогательный метод для верификации сообщения с retry logic
  async verifyMessageWithRetry(chatKey: string, message: ChatMessage): Promise<{ success: boolean, verified: boolean, messageId: string, verificationReason?: string }> {
    const retryDelays = [200, 400, 600, 800, 1000];
    let isVerified = false;
    let verificationReason = 'unknown';
    let lastSavedChat = null;

    for (let attempt = 1; attempt <= 5; attempt++) {
      const delay = retryDelays[attempt - 1];
      console.log(`[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ попытка ${attempt}/5, задержка ${delay}ms`, {
        chatKey,
        messageId: message.id
      });

      await new Promise(resolve => setTimeout(resolve, delay));

      const result = await new Promise<any>(resolve => {
        chrome.storage.local.get([chatKey], resolve);
      });

      const savedChat = result[chatKey];
      lastSavedChat = savedChat;

      if (!savedChat) {
        verificationReason = 'chat_not_found';
        console.warn(`[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ попытка ${attempt}: чат не найден в storage`, {
          chatKey,
          attempt,
          delay,
          allStorageKeys: Object.keys(result)
        });

        // Дополнительная диагностика: проверим все ключи в storage
        chrome.storage.local.get(null, allData => {
          const relatedKeys = Object.keys(allData).filter(key => key.includes(chatKey.split('::')[0]));
          console.log(`[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ попытка ${attempt} - диагностика storage:`, {
            allKeys: Object.keys(allData),
            relatedKeys,
            chatKey,
            pluginId: chatKey.split('::')[0]
          });
        });
      } else if (!savedChat.messages || !Array.isArray(savedChat.messages)) {
        verificationReason = 'messages_array_missing';
        console.warn(`[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ попытка ${attempt}: массив сообщений отсутствует`, {
          savedChat,
          messagesType: typeof savedChat.messages,
          attempt
        });
      } else {
        // Ищем сообщение по ID
        let savedMessage = savedChat.messages.find((m: ChatMessage) => m.id === message.id);

        // Если не нашли по ID, пробуем найти по содержимому (fallback для быстрого потока сообщений)
        if (!savedMessage && attempt >= 3) {
          console.log(`[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ попытка ${attempt}: не найдено по ID, пробуем fallback по содержимому`);
          savedMessage = savedChat.messages.find((m: ChatMessage) =>
            m.content === message.content &&
            m.role === message.role &&
            Math.abs(m.timestamp - message.timestamp) < 2000 // 2 сек допуск для быстрого потока
          );

          if (savedMessage) {
            console.log(`[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ попытка ${attempt}: сообщение найдено по содержимому (fallback)`, {
              originalId: message.id,
              foundId: savedMessage.id,
              contentMatch: true,
              roleMatch: savedMessage.role === message.role,
              timestampDiff: Math.abs(savedMessage.timestamp - message.timestamp)
            });
          }
        }

        if (savedMessage) {
          // Дополнительная проверка: сравниваем содержимое сообщения
          const contentMatches = savedMessage.content === message.content;
          const roleMatches = savedMessage.role === message.role;
          const timestampMatches = Math.abs(savedMessage.timestamp - message.timestamp) < 1000; // 1 сек допуск

          if (contentMatches && roleMatches && timestampMatches) {
            isVerified = true;
            verificationReason = savedMessage.id === message.id ? 'full_match' : 'content_fallback_match';
            console.log(`[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ попытка ${attempt}: сообщение успешно верифицировано`, {
              attempt,
              messageId: message.id,
              foundById: savedMessage.id === message.id,
              verificationReason
            });
            break; // Выходим из цикла retry
          } else {
            verificationReason = 'content_mismatch';
            console.warn(`[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ попытка ${attempt}: содержимое сообщения не совпадает`, {
              attempt,
              contentMatches,
              roleMatches,
              timestampMatches,
              saved: savedMessage,
              expected: message
            });
          }
        } else {
          verificationReason = 'message_not_found_by_id';
          console.warn(`[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ попытка ${attempt}: сообщение не найдено ни по ID, ни по содержимому`, {
            attempt,
            messageId: message.id,
            availableIds: savedChat.messages.map(m => m.id),
            messagesCount: savedChat.messages.length,
            lastMessage: savedChat.messages[savedChat.messages.length - 1],
            expectedContentLength: message.content.length,
            expectedRole: message.role,
            expectedTimestamp: message.timestamp
          });

          // Дополнительная диагностика при message_not_found_by_id
          console.log(`[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ попытка ${attempt} - детальная диагностика:`, {
            savedChatMessages: savedChat.messages.slice(-3), // последние 3 сообщения
            expectedMessage: message,
            messageId: message.id,
            idComparison: savedChat.messages.map(m => ({ id: m.id, equals: m.id === message.id })).slice(-3)
          });
        }
      }

      // Если это последняя попытка и не верифицировано - fallback механизм
      if (attempt === 5 && !isVerified) {
        console.warn('[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ: все 5 попыток исчерпаны, сообщение не верифицировано - применяем fallback механизм', {
          chatKey,
          messageId: message.id,
          finalVerificationReason: verificationReason,
          lastSavedChat
        });
        // Fallback: все равно обновляем UI с предупреждением о неверифицированном сообщении
        // Сообщение уже добавлено в chat.messages выше, так что UI обновится
      }
    }

    console.log('[pluginChatApi][saveMessage] ВЕРИФИКАЦИЯ завершена:', {
      chatKey,
      messageId: message.id,
      savedChatExists: !!lastSavedChat,
      savedMessagesLength: lastSavedChat?.messages?.length,
      lastSavedMessage: lastSavedChat?.messages?.[lastSavedChat.messages?.length - 1],
      verified: isVerified,
      verificationReason,
      messageExists: !!lastSavedChat?.messages?.find((m: ChatMessage) => m.id === message.id),
      totalAttempts: 5
    });

    return {
      success: true,
      verified: isVerified,
      messageId: message.id || '',
      verificationReason
    };
  },

  // Удалить чат
  // Получить список всех черновиков для плагина
  async listDraftsForPlugin(pluginId: string): Promise<ChatDraft[]> {
    return new Promise(resolve => {
      chrome.storage.local.get(null, result => {
        const drafts = Object.values(result).filter(
          (item: unknown): item is ChatDraft =>
            !!(
              item &&
              typeof item === 'object' &&
              'draftKey' in item &&
              'pluginId' in item &&
              (item as ChatDraft).pluginId === pluginId
            ),
        );
        console.log('[pluginChatApi] listDraftsForPlugin:', pluginId, drafts);
        resolve(drafts);
      });
    });
  },

  // Получить список всех чатов для плагина
  async listChatsForPlugin(pluginId: string): Promise<PluginChat[]> {
    return new Promise(resolve => {
      chrome.storage.local.get(null, result => {
        const chats = Object.values(result).filter(
          (item: unknown): item is PluginChat =>
            !!(
              item &&
              typeof item === 'object' &&
              'chatKey' in item &&
              'pluginId' in item &&
              (item as PluginChat).pluginId === pluginId
            ),
        );
        console.log('[pluginChatApi] listChatsForPlugin:', pluginId, chats);
        resolve(chats as PluginChat[]);
      });
    });
  },
};

export interface ChatMessage {
  id?: string;
  role: 'user' | 'plugin';
  content: string;
  timestamp: number;
}

export interface PluginChat {
  chatKey: string;
  pluginId: string;
  pageKey: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatDraft {
  draftKey: string;
  pluginId: string;
  pageKey: string;
  text: string;
  updatedAt: number;
}

export { pluginChatApi };
