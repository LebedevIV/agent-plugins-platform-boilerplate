import { saveAs } from 'file-saver';
import { useState, useEffect } from 'react';
import './PluginChatsTab.css';

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

interface ChatDraft {
  draftKey: string;
  pluginId: string;
  pageKey: string;
  text: string;
  updatedAt: number;
}

export const PluginChatsTab: React.FC = () => {
  const [chats, setChats] = useState<PluginChat[]>([]);
  const [drafts, setDrafts] = useState<ChatDraft[]>([]);
  const [selectedChat, setSelectedChat] = useState<PluginChat | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<ChatDraft | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'chats' | 'drafts'>('chats');

  useEffect(() => {
    loadData();
    const handleUpdate = (msg: { type: string }) => {
      if (msg.type === 'PLUGIN_CHAT_UPDATED') {
        loadData();
      }
    };
    chrome.runtime.onMessage.addListener(handleUpdate);
    return () => chrome.runtime.onMessage.removeListener(handleUpdate);
  }, []);

  const loadData = () => {
    console.log('[PluginChatsTab] Loading data...');

    // Загружаем чаты
    chrome.runtime
      .sendMessage({ type: 'LIST_PLUGIN_CHATS', pluginId: null })
      .then((result: PluginChat[]) => {
        console.log('[PluginChatsTab] Chats loaded:', result);
        setChats(result || []);
      })
      .catch(error => {
        console.error('[PluginChatsTab] Error loading chats:', error);
        setChats([]);
      });

    // Загружаем черновики
    chrome.runtime
      .sendMessage({ type: 'LIST_PLUGIN_CHAT_DRAFTS', pluginId: null })
      .then((result: ChatDraft[]) => {
        console.log('[PluginChatsTab] Drafts loaded:', result);
        setDrafts(result || []);
      })
      .catch(error => {
        console.error('[PluginChatsTab] Error loading drafts:', error);
        setDrafts([]);
      });
  };

  const handleDeleteChat = (chat: PluginChat) => {
    if (window.confirm('Удалить этот чат?')) {
      chrome.runtime
        .sendMessage({ type: 'DELETE_PLUGIN_CHAT', pluginId: chat.pluginId, pageKey: chat.pageKey })
        .then(() => loadData());
    }
  };

  const handleDeleteDraft = (draft: ChatDraft) => {
    if (window.confirm('Удалить этот черновик?')) {
      chrome.runtime
        .sendMessage({
          type: 'SAVE_PLUGIN_CHAT_DRAFT',
          pluginId: draft.pluginId,
          pageKey: draft.pageKey,
          draftText: '',
        })
        .then(() => loadData());
    }
  };

  const handleExportAll = () => {
    const data = {
      chats,
      drafts,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, 'all-plugin-chats-and-drafts.json');
  };

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString();

  const truncateText = (text: string, maxLength: number = 50) =>
    text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

  return (
    <div className="plugin-chats-tab">
      <div className="tab-header">
        <h2>Управление чатами плагинов</h2>
        <div className="tab-controls">
          <button className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>
            Чаты ({chats.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'drafts' ? 'active' : ''}`}
            onClick={() => setActiveTab('drafts')}>
            Черновики ({drafts.length})
          </button>
          <button onClick={handleExportAll} className="export-btn">
            Экспорт всех данных
          </button>
        </div>
      </div>

      {activeTab === 'chats' && (
        <div className="chats-section">
          <h3>Чаты плагинов</h3>
          {chats.length === 0 ? (
            <p className="no-data">Нет сохраненных чатов</p>
          ) : (
            <div className="table-container">
              <table className="chats-table">
                <thead>
                  <tr>
                    <th>Плагин</th>
                    <th>Страница</th>
                    <th>Сообщений</th>
                    <th>Создан</th>
                    <th>Обновлен</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {chats.map(chat => (
                    <tr key={chat.chatKey}>
                      <td>{chat.pluginId}</td>
                      <td title={chat.pageKey}>{truncateText(chat.pageKey, 40)}</td>
                      <td>{chat.messages.length}</td>
                      <td>{formatDate(chat.createdAt)}</td>
                      <td>{formatDate(chat.updatedAt)}</td>
                      <td>
                        <button
                          onClick={() => {
                            setSelectedChat(chat);
                            setShowChatModal(true);
                          }}>
                          Просмотр
                        </button>
                        <button onClick={() => handleDeleteChat(chat)} className="delete-btn">
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'drafts' && (
        <div className="drafts-section">
          <h3>Черновики сообщений</h3>
          {drafts.length === 0 ? (
            <p className="no-data">Нет сохраненных черновиков</p>
          ) : (
            <div className="table-container">
              <table className="drafts-table">
                <thead>
                  <tr>
                    <th>Плагин</th>
                    <th>Страница</th>
                    <th>Текст</th>
                    <th>Обновлен</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map(draft => (
                    <tr key={draft.draftKey}>
                      <td>{draft.pluginId}</td>
                      <td title={draft.pageKey}>{truncateText(draft.pageKey, 40)}</td>
                      <td title={draft.text}>{truncateText(draft.text, 60)}</td>
                      <td>{formatDate(draft.updatedAt)}</td>
                      <td>
                        <button
                          onClick={() => {
                            setSelectedDraft(draft);
                            setShowDraftModal(true);
                          }}>
                          Просмотр
                        </button>
                        <button onClick={() => handleDeleteDraft(draft)} className="delete-btn">
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Модальное окно для просмотра чата */}
      {showChatModal && selectedChat && (
        <div className="modal-overlay" role="dialog" aria-modal="true" tabIndex={-1}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Чат: {selectedChat.pluginId}</h3>
              <button onClick={() => setShowChatModal(false)} className="close-btn" aria-label="Закрыть модальное окно">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>Страница:</strong> {selectedChat.pageKey}
              </p>
              <p>
                <strong>Сообщений:</strong> {selectedChat.messages.length}
              </p>
              <p>
                <strong>Создан:</strong> {formatDate(selectedChat.createdAt)}
              </p>
              <p>
                <strong>Обновлен:</strong> {formatDate(selectedChat.updatedAt)}
              </p>
              <div className="messages-preview">
                <h4>Сообщения:</h4>
                {selectedChat.messages.map((msg, index) => (
                  <div key={index} className={`message ${msg.role}`}>
                    <strong>{msg.role === 'user' ? 'Пользователь' : 'Плагин'}:</strong>
                    <span>{msg.content}</span>
                    <small>{formatDate(msg.timestamp)}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button
            className="modal-backdrop"
            onClick={() => setShowChatModal(false)}
            onKeyDown={e => e.key === 'Escape' && setShowChatModal(false)}
            aria-label="Закрыть модальное окно"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          />
        </div>
      )}

      {/* Модальное окно для просмотра черновика */}
      {showDraftModal && selectedDraft && (
        <div className="modal-overlay" role="dialog" aria-modal="true" tabIndex={-1}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Черновик: {selectedDraft.pluginId}</h3>
              <button
                onClick={() => setShowDraftModal(false)}
                className="close-btn"
                aria-label="Закрыть модальное окно">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>Страница:</strong> {selectedDraft.pageKey}
              </p>
              <p>
                <strong>Обновлен:</strong> {formatDate(selectedDraft.updatedAt)}
              </p>
              <div className="draft-preview">
                <h4>Текст черновика:</h4>
                <pre>{selectedDraft.text}</pre>
              </div>
            </div>
          </div>
          <button
            className="modal-backdrop"
            onClick={() => setShowDraftModal(false)}
            onKeyDown={e => e.key === 'Escape' && setShowDraftModal(false)}
            aria-label="Закрыть модальное окно"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          />
        </div>
      )}
    </div>
  );
};
