// PluginChatCache — кэш и синхронизация чатов плагинов для background.js
// Хранит чаты в памяти (Map), синхронизирует с IndexedDB (idb-keyval), поддерживает LRU-очистку

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

// Re-export from plugin-chat-api for backward compatibility
export { pluginChatApi as pluginChatCache } from './plugin-chat-api';