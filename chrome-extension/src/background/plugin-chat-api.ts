// Plugin Chat API — современный кэш и хранилище чатов плагинов для background.js
// IndexedDB + LRU + Promise API + Ленивая синхронизация

import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

const DB_NAME = 'plugin-chats-db';
const STORE_NAME = 'plugin-chats';
const DRAFTS_STORE_NAME = 'chat-drafts';
const LRU_LIMIT = 50;

let dbPromise: Promise<IDBPDatabase> | null = null;
const lruCache: Map<string, PluginChat> = new Map();

const getDb = function (): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(db, oldVersion) {
        // Создаем основное хранилище чатов
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'chatKey' });
        }

        // Создаем хранилище черновиков (версия 2)
        if (oldVersion < 2 && !db.objectStoreNames.contains(DRAFTS_STORE_NAME)) {
          db.createObjectStore(DRAFTS_STORE_NAME, { keyPath: 'draftKey' });
        }
      },
    });
  }
  return dbPromise;
};

const touchLRU = function (chatKey: string, chat: PluginChat) {
  lruCache.delete(chatKey);
  lruCache.set(chatKey, chat);
  if (lruCache.size > LRU_LIMIT) {
    // Удаляем самый старый (первый) элемент
    const oldestKey = lruCache.keys().next().value;
    lruCache.delete(oldestKey);
  }
};

const pluginChatApi = {
  // Создание чата при начале ввода (ленивая инициализация)
  async createChatIfNotExists(pluginId: string, pageKey: string): Promise<PluginChat> {
    const chatKey = `${pluginId}::${pageKey}`;
    const db = await getDb();

    // Проверяем, существует ли чат
    let chat = lruCache.get(chatKey) || (await db.get(STORE_NAME, chatKey));

    if (!chat) {
      // Создаем новый чат
      const now = Date.now();
      chat = {
        chatKey,
        pluginId,
        pageKey,
        messages: [],
        createdAt: now,
        updatedAt: now,
      };

      // Сохраняем в базу данных
      await db.put(STORE_NAME, chat);
      touchLRU(chatKey, chat);
    }

    return chat;
  },

  async getOrLoadChat(chatKey: string): Promise<PluginChat | null> {
    if (lruCache.has(chatKey)) {
      const chat = lruCache.get(chatKey)!;
      touchLRU(chatKey, chat);
      return chat;
    }
    const db = await getDb();
    const chat = await db.get(STORE_NAME, chatKey);
    if (chat) {
      touchLRU(chatKey, chat);
      return chat;
    }
    return null;
  },

  async saveMessage(pluginId: string, pageKey: string, message: ChatMessage): Promise<void> {
    const chatKey = `${pluginId}::${pageKey}`;
    const db = await getDb();
    let chat = lruCache.get(chatKey) || (await db.get(STORE_NAME, chatKey));
    const now = Date.now();
    if (!chat) {
      chat = {
        chatKey,
        pluginId,
        pageKey,
        messages: [message],
        createdAt: now,
        updatedAt: now,
      };
    } else {
      chat.messages.push(message);
      chat.updatedAt = now;
    }
    touchLRU(chatKey, chat);
    await db.put(STORE_NAME, chat);
  },

  // Сохранение черновика сообщения (ленивая синхронизация)
  async saveDraft(pluginId: string, pageKey: string, draftText: string): Promise<void> {
    const draftKey = `${pluginId}::${pageKey}`;
    const db = await getDb();
    const draft = {
      draftKey,
      pluginId,
      pageKey,
      text: draftText,
      updatedAt: Date.now(),
    };
    await db.put(DRAFTS_STORE_NAME, draft);
  },

  // Получение черновика сообщения
  async getDraft(pluginId: string, pageKey: string): Promise<string> {
    const draftKey = `${pluginId}::${pageKey}`;
    const db = await getDb();
    const draft = await db.get(DRAFTS_STORE_NAME, draftKey);
    return draft?.text || '';
  },

  // Удаление черновика после отправки сообщения
  async deleteDraft(pluginId: string, pageKey: string): Promise<void> {
    const draftKey = `${pluginId}::${pageKey}`;
    const db = await getDb();
    await db.delete(DRAFTS_STORE_NAME, draftKey);
  },

  async deleteChat(pluginId: string, pageKey: string): Promise<void> {
    const chatKey = `${pluginId}::${pageKey}`;
    const db = await getDb();
    lruCache.delete(chatKey);
    await db.delete(STORE_NAME, chatKey);
    // Также удаляем черновик
    await this.deleteDraft(pluginId, pageKey);
  },

  async listChatsForPlugin(pluginId: string): Promise<PluginChat[]> {
    const db = await getDb();
    const allChats: PluginChat[] = await db.getAll(STORE_NAME);
    return allChats.filter(chat => chat.pluginId === pluginId);
  },

  // Получение всех черновиков для плагина
  async listDraftsForPlugin(pluginId: string): Promise<ChatDraft[]> {
    const db = await getDb();
    const allDrafts: ChatDraft[] = await db.getAll(DRAFTS_STORE_NAME);
    return allDrafts.filter(draft => draft.pluginId === pluginId);
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
