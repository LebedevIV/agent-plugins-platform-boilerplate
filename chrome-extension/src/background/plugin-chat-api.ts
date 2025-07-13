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
    const chat = await this.getOrLoadChat(chatKey);
    if (chat) {
      console.log('[pluginChatApi] createChatIfNotExists: чат уже существует', chat);
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
    await new Promise<void>(resolve => {
      chrome.storage.local.set({ [chatKey]: newChat }, () => {
        console.log('[pluginChatApi] createChatIfNotExists: создан новый чат', newChat);
        resolve();
      });
    });
    return newChat;
  },

  // Получить чат по ключу или null
  async getOrLoadChat(chatKey: string): Promise<PluginChat | null> {
    return new Promise(resolve => {
      chrome.storage.local.get([chatKey], result => {
        const chat = result[chatKey] || null;
        console.log('[pluginChatApi] getOrLoadChat:', chatKey, chat);
        resolve(chat);
      });
    });
  },

  // Сохранить сообщение в чат
  async saveMessage(pluginId: string, pageKey: string, message: ChatMessage): Promise<{ success: boolean }> {
    const chatKey = `${pluginId}::${getPageKey(pageKey)}`;
    const chat = await this.getOrLoadChat(chatKey);
    if (!chat) {
      console.warn('[pluginChatApi] saveMessage: чат не найден, создаём новый');
      await this.createChatIfNotExists(pluginId, pageKey);
      return this.saveMessage(pluginId, pageKey, message);
    }
    chat.messages.push(message);
    chat.updatedAt = Date.now();
    await new Promise<void>(resolve => {
      chrome.storage.local.set({ [chatKey]: chat }, () => {
        console.log('[pluginChatApi] saveMessage: добавляем сообщение в чат', chat);
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
    await new Promise<void>(resolve => {
      chrome.storage.local.set({ [draftKey]: draft }, () => {
        console.log('[pluginChatApi] saveDraft:', draft);
        resolve();
      });
    });
    return { success: true };
  },

  // Получить черновик
  async getDraft(pluginId: string, pageKey: string): Promise<{ draftText: string }> {
    const draftKey = `${pluginId}::${getPageKey(pageKey)}::draft`;
    return new Promise(resolve => {
      chrome.storage.local.get([draftKey], result => {
        const draft = result[draftKey];
        const draftText = draft && typeof draft.text === 'string' ? draft.text : '';
        console.log('[pluginChatApi] getDraft:', draftKey, draft, 'draftText:', draftText);
        resolve({ draftText });
      });
    });
  },

  // Удалить черновик
  async deleteDraft(pluginId: string, pageKey: string): Promise<{ success: boolean }> {
    const draftKey = `${pluginId}::${getPageKey(pageKey)}::draft`;
    await new Promise<void>(resolve => {
      chrome.storage.local.remove([draftKey], () => {
        console.log('[pluginChatApi] deleteDraft:', draftKey);
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
            item &&
            typeof item === 'object' &&
            'draftKey' in item &&
            'pluginId' in item &&
            (item as ChatDraft).pluginId === pluginId,
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
            item &&
            typeof item === 'object' &&
            'chatKey' in item &&
            'pluginId' in item &&
            (item as PluginChat).pluginId === pluginId,
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
