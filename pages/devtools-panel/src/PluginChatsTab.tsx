import React, { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';

interface ChatMessage {
  role: 'user' | 'plugin';
  content: string;
  timestamp: number;
}

interface PluginChat {
  chatKey: string;
  pluginId: string;
  pageKey: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export const PluginChatsTab: React.FC = () => {
  const [chats, setChats] = useState<PluginChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<PluginChat | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadChats();
    const handleUpdate = (msg: { type: string }) => {
      if (msg.type === 'PLUGIN_CHAT_UPDATED') {
        loadChats();
      }
    };
    chrome.runtime.onMessage.addListener(handleUpdate);
    return () => chrome.runtime.onMessage.removeListener(handleUpdate);
  }, []);

  const loadChats = () => {
    chrome.runtime.sendMessage({ type: 'LIST_PLUGIN_CHATS', pluginId: null })
      .then((result: PluginChat[]) => setChats(result || []));
  };

  const handleDelete = (chat: PluginChat) => {
    if (window.confirm('Удалить этот чат?')) {
      chrome.runtime.sendMessage({ type: 'DELETE_PLUGIN_CHAT', pluginId: chat.pluginId, pageKey: chat.pageKey })
        .then(() => loadChats());
    }
  };

  const handleExportAll = () => {
    const data = JSON.stringify(chats, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    saveAs(blob, 'all-plugin-chats.json');
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Чаты плагинов</h2>
      <button onClick={handleExportAll} disabled={chats.length === 0} style={{ marginBottom: 12 }}>
        Экспортировать все чаты (JSON)
      </button>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Ключ</th>
            <th>Плагин</th>
            <th>Страница</th>
            <th>Сообщений</th>
            <th>Обновлён</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {chats.map(chat => (
            <tr key={chat.chatKey}>
              <td>{chat.chatKey}</td>
              <td>{chat.pluginId}</td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.pageKey}</td>
              <td>{chat.messages.length}</td>
              <td>{new Date(chat.updatedAt).toLocaleString()}</td>
              <td>
                <button onClick={() => { setSelectedChat(chat); setShowModal(true); }}>Просмотр</button>
                <button onClick={() => handleDelete(chat)} style={{ marginLeft: 8 }}>Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showModal && selectedChat && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000 }} 
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onKeyDown={e => e.key === 'Escape' && setShowModal(false)}
        >
          <div 
            style={{ background: '#fff', margin: '5% auto', padding: 24, maxWidth: 600, borderRadius: 8 }} 
            role="document"
            onClick={e => e.stopPropagation()}
          >
            <h3>Чат: {selectedChat.chatKey}</h3>
            <pre style={{ maxHeight: 400, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
              {JSON.stringify(selectedChat, null, 2)}
            </pre>
            <button 
              onClick={() => setShowModal(false)}
              style={{ marginTop: 12 }}
              autoFocus
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setShowModal(false)}
            >Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}; 