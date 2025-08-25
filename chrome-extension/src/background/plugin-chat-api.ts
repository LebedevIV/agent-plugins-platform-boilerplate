// Plugin Chat API — современный кэш и хранилище чатов плагинов для background.js
// IndexedDB + LRU + Promise API + Ленивая синхронизация

// --- МИГРАЦИЯ НА chrome.storage.local ---
// Вся логика работы с чатами и черновиками теперь через chrome.storage.local
// Все методы возвращают Promise для совместимости

import { getPageKey } from '../../../packages/shared/lib/utils/helpers';

const pluginChatApi = {
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

  // Сохранить сообщение в чат
  async saveMessage(pluginId: string, pageKey: string, message: ChatMessage): Promise<{ success: boolean }> {
    const chatKey = `${pluginId}::${getPageKey(pageKey)}`;
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

    await new Promise<void>(resolve => {
      chrome.storage.local.set({ [chatKey]: chat }, () => {
        if (chrome.runtime.lastError) {
          console.error('[pluginChatApi][saveMessage] chrome.storage error:', chrome.runtime.lastError);
          resolve();
          return;
        }

        console.log('[pluginChatApi][saveMessage] AFTER set:', {
          chatKey,
          chat,
          success: true
        });

        // Проверка: что реально лежит в storage после set
        chrome.storage.local.get([chatKey], result => {
          const savedChat = result[chatKey];
          console.log('[pluginChatApi][saveMessage] ПРОВЕРКА storage после set:', {
            savedChat,
            savedChatType: typeof savedChat,
            savedMessagesLength: savedChat?.messages?.length,
            savedMessages: savedChat?.messages,
            lastSavedMessage: savedChat?.messages?.[savedChat.messages.length - 1]
          });
        });
        resolve();
      });
    });
    return { success: true };
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
