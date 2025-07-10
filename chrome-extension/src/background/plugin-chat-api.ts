// Plugin Chat API — современный кэш и хранилище чатов плагинов для background.js
// IndexedDB + LRU + Promise API

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'plugin-chats-db';
const STORE_NAME = 'plugin-chats';
const LRU_LIMIT = 50;

let dbPromise: Promise<IDBPDatabase> | null = null;
const lruCache: Map<string, PluginChat> = new Map();

const getDb = function(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'chatKey' });
        }
      },
    });
  }
  return dbPromise;
};

const touchLRU = function(chatKey: string, chat: PluginChat) {
  lruCache.delete(chatKey);
  lruCache.set(chatKey, chat);
  if (lruCache.size > LRU_LIMIT) {
    // Удаляем самый старый (первый) элемент
    const oldestKey = lruCache.keys().next().value;
    lruCache.delete(oldestKey);
  }
};

const pluginChatApi = {
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

  async deleteChat(pluginId: string, pageKey: string): Promise<void> {
    const chatKey = `${pluginId}::${pageKey}`;
    const db = await getDb();
    lruCache.delete(chatKey);
    await db.delete(STORE_NAME, chatKey);
  },

  async listChatsForPlugin(pluginId: string): Promise<PluginChat[]> {
    const db = await getDb();
    const allChats: PluginChat[] = await db.getAll(STORE_NAME);
    return allChats.filter(chat => chat.pluginId === pluginId);
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

export { pluginChatApi }; 