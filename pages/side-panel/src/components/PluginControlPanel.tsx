import { DraftStatus } from './DraftStatus';
import { PluginDetails } from './PluginDetails';
import { useLazyChatSync } from '../hooks/useLazyChatSync';
import { saveAs } from 'file-saver';
import { useState, useRef, useEffect } from 'react';
import './PluginControlPanel.css';
import type React from 'react';

// Новый тип для сообщений чата
interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
}

// Получение нормализованного pageKey из URL активной вкладки
const getPageKey = (currentTabUrl: string | null): string => {
  console.log('[PluginControlPanel] getPageKey вызван с currentTabUrl:', currentTabUrl);

  if (!currentTabUrl) {
    console.log('[PluginControlPanel] currentTabUrl пустой, возвращаем unknown-page');
    return 'unknown-page';
  }

  try {
    const url = new URL(currentTabUrl);
    url.search = '';
    url.hash = '';
    const pageKey = url.toString();
    console.log('[PluginControlPanel] Создан pageKey:', pageKey);
    return pageKey;
  } catch (error) {
    console.error('[PluginControlPanel] Ошибка создания pageKey:', error);
    return currentTabUrl;
  }
};

interface PluginControlPanelProps {
  plugin: Plugin;
  currentView: PanelView;
  isRunning: boolean;
  isPaused: boolean;
  currentTabUrl: string | null; // Добавляем URL активной вкладки
  onViewChange: (view: PanelView) => void;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onClose: () => void;
  onUpdateSetting?: (pluginId: string, setting: string, value: boolean) => Promise<void>;
}

export type PanelView = 'chat' | 'details';

export const PluginControlPanel: React.FC<PluginControlPanelProps> = ({
  plugin,
  currentView,
  isRunning,
  isPaused,
  currentTabUrl,
  onViewChange,
  onStart,
  onPause,
  onStop,
  onClose,
  onUpdateSetting,
}) => {
  // Используем хук для ленивой синхронизации
  const { message, setMessage, isDraftSaved, isDraftLoading, draftError, clearDraft } = useLazyChatSync({
    pluginId: plugin.id,
    pageKey: getPageKey(currentTabUrl),
    debounceMs: 1000, // 1 секунда задержки
    minLength: 10, // Минимум 10 символов для синхронизации
    maxLength: 1000, // Максимум 1000 символов
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [inputHeight, setInputHeight] = useState(60); // Начальная высота поля ввода
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  // Состояние "остановлен"
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (!isRunning) setStopped(false);
  }, [isRunning]);

  const handleStart = () => {
    setStopped(false);
    onStart();
  };
  const handleStop = () => {
    setStopped(true);
    onStop();
  };

  const pluginName =
    plugin.name || (typeof plugin.manifest?.name === 'string' ? plugin.manifest.name : '') || plugin.id;

  // Получаем ключ чата для текущего плагина и страницы
  const pluginId = plugin.id;
  const pageKey = getPageKey(currentTabUrl);

  // Загрузка истории чата при монтировании или смене плагина/страницы
  useEffect(() => {
    const loadChat = async () => {
      setLoading(true);
      setError(null);
      try {
        const chat = await chrome.runtime.sendMessage({
          type: 'GET_PLUGIN_CHAT',
          pluginId,
          pageKey,
        });
        if (chat && Array.isArray(chat.messages)) {
          setMessages(
            chat.messages.map(
              (msg: {
                id?: string;
                content?: string;
                text?: string;
                role?: string;
                isUser?: boolean;
                timestamp?: number;
              }) => ({
                id: msg.id || String(msg.timestamp || Date.now()),
                text: msg.content || msg.text,
                isUser: msg.role ? msg.role === 'user' : !!msg.isUser,
                timestamp: msg.timestamp || Date.now(),
              }),
            ),
          );
        } else {
          setMessages([]);
        }
      } catch {
        setError('Ошибка загрузки истории чата');
      } finally {
        setLoading(false);
      }
    };
    loadChat();
  }, [pluginId, pageKey]);

  // Событийная синхронизация чата между вкладками
  useEffect(() => {
    const handleChatUpdate = (event: { type: string; pluginId: string; pageKey: string; messages?: ChatMessage[] }) => {
      if (event?.type === 'PLUGIN_CHAT_UPDATED' && event.pluginId === pluginId && event.pageKey === pageKey) {
        // Перезагружаем историю чата
        chrome.runtime
          .sendMessage({
            type: 'GET_PLUGIN_CHAT',
            pluginId,
            pageKey,
          })
          .then(chat => {
            if (chat && Array.isArray(chat.messages)) {
              setMessages(
                chat.messages.map(
                  (msg: {
                    id?: string;
                    content?: string;
                    text?: string;
                    role?: string;
                    isUser?: boolean;
                    timestamp?: number;
                  }) => ({
                    id: msg.id || String(msg.timestamp || Date.now()),
                    text: msg.content || msg.text,
                    isUser: msg.role ? msg.role === 'user' : !!msg.isUser,
                    timestamp: msg.timestamp || Date.now(),
                  }),
                ),
              );
            } else {
              setMessages([]);
            }
          });
      }
    };
    chrome.runtime.onMessage.addListener(handleChatUpdate);
    return () => {
      chrome.runtime.onMessage.removeListener(handleChatUpdate);
    };
  }, [pluginId, pageKey]);

  const handleSendMessage = async (): Promise<void> => {
    if (!message.trim()) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text: message.trim(),
      isUser: true,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, newMessage]);
    setMessage(''); // Очищаем сообщение через хук
    setSyncStatus('saving');
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_PLUGIN_CHAT_MESSAGE',
        pluginId,
        pageKey,
        message: {
          role: 'user',
          content: newMessage.text,
          timestamp: newMessage.timestamp,
        },
      });
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 1000);
    } catch {
      setSyncStatus('error');
      setError('Ошибка сохранения сообщения');
    }
  };

  // Обработка изменения размера разделителя
  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleResizeMove = (event: MouseEvent): void => {
      if (!isResizing) return;

      const container = document.querySelector('.chat-view') as HTMLElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newHeight = containerRect.bottom - event.clientY;
      const minHeight = 100; // Минимальная высота чата
      const maxHeight = containerRect.height - 80; // Максимальная высота чата

      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setInputHeight(containerRect.height - newHeight);
      }
    };

    const handleResizeEnd = (): void => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing]);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Фокус на поле ввода при открытии чата
  useEffect(() => {
    if (currentView === 'chat') {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [currentView]);

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setMessage(event.target.value); // Используем хук вместо setMessage

    // Автоматическое изменение высоты
    const textarea = event.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 200); // Минимум 60px, максимум 200px
    textarea.style.height = `${newHeight}px`;
    setInputHeight(newHeight);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  // Очистка чата (удаление всей истории)
  const handleClearChat = async (): Promise<void> => {
    setSyncStatus('saving');
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_PLUGIN_CHAT',
        pluginId,
        pageKey,
      });
      setMessages([]);
      await clearDraft(); // Очищаем черновик
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 1000);
    } catch {
      setSyncStatus('error');
      setError('Ошибка очистки чата');
    }
  };

  // Экспорт чата в JSON
  const handleExportChat = (): void => {
    const data = JSON.stringify(messages, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    saveAs(blob, `plugin-chat-${pluginId}.json`);
  };

  return (
    <div className="plugin-control-panel">
      <div className="panel-header">
        <div className="plugin-info">
          <img
            className="plugin-icon"
            src={plugin.iconUrl || `plugins/${plugin.id}/${plugin.icon || 'icon.svg'}`}
            alt={`${pluginName} icon`}
            onError={event => {
              const firstChar = typeof pluginName === 'string' && pluginName.length > 0 ? pluginName.charAt(0) : 'P';
              (event.currentTarget as HTMLImageElement).src =
                `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><rect width='24' height='24' fill='%23e0e0e0'/><text x='12' y='12' text-anchor='middle' dy='.3em' font-family='Arial' font-size='8' fill='%23999'>${firstChar.toUpperCase()}</text></svg>`;
            }}
          />
          <span className="plugin-name">{pluginName}</span>
        </div>
        <button className="close-btn" onClick={onClose} title="Закрыть панель">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="panel-tabs">
        <button
          className={`tab-btn${currentView === 'chat' ? 'active' : ''}`}
          style={{ width: currentView === 'chat' ? '33.33%' : '66.66%' }}
          onClick={() => onViewChange('chat')}>
          Чат
        </button>
        <button
          className={`tab-btn${currentView === 'details' ? 'active' : ''}`}
          style={{ width: currentView === 'details' ? '33.33%' : '66.66%' }}
          onClick={() => onViewChange('details')}>
          Детали
        </button>
      </div>

      <div className="panel-content">
        {currentView === 'details' ? (
          <PluginDetails plugin={plugin} onUpdateSetting={onUpdateSetting} />
        ) : (
          <div className="chat-view">
            {loading && <div className="chat-loader">Загрузка чата...</div>}
            {error && <div className="chat-error">{error}</div>}
            <div className="chat-actions" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={handleClearChat} disabled={messages.length === 0 || loading}>
                Очистить чат
              </button>
              <button onClick={handleExportChat} disabled={messages.length === 0}>
                Экспорт чата (JSON)
              </button>
            </div>
            <div className="chat-messages" style={{ height: `calc(100% - ${inputHeight}px - 8px)` }}>
              {messages.length === 0 && !loading ? (
                <div className="chat-placeholder">Нет сообщений. Начните диалог!</div>
              ) : (
                <div className="messages-container">
                  <>
                    {messages.map((msg: ChatMessage) =>
                      msg && typeof msg === 'object' && 'id' in msg ? (
                        <div key={msg.id} className={`chat-message${msg.isUser ? 'user' : 'bot'}`}>
                          <div className="message-content">
                            <span className="message-text">{msg.text}</span>
                            <span className="message-time">
                              {typeof msg.timestamp === 'number'
                                ? String(
                                    new Date(msg.timestamp).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }),
                                  )
                                : ''}
                            </span>
                          </div>
                        </div>
                      ) : null,
                    )}
                    <div ref={messagesEndRef} />
                  </>
                </div>
              )}
            </div>
            <div className="chat-status">
              {syncStatus === 'saving' && <span>Сохраняется...</span>}
              {syncStatus === 'saved' && <span>Сохранено</span>}
              {syncStatus === 'error' && <span style={{ color: 'red' }}>Ошибка синхронизации</span>}
            </div>

            {/* Компонент статуса черновика */}
            <DraftStatus
              isDraftSaved={isDraftSaved}
              isDraftLoading={isDraftLoading}
              draftError={draftError}
              messageLength={message.length}
              minLength={10}
              maxLength={1000}
            />

            {/* Разделитель с возможностью изменения размера */}
            <div
              ref={resizeRef}
              className="chat-resizer"
              onMouseDown={handleResizeStart}
              title="Изменить размер поля ввода"
              role="button"
              tabIndex={0}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  // handleResizeStart ожидает MouseEvent, но для a11y просто вызываем setIsResizing(true)
                  setIsResizing(true);
                  document.body.style.cursor = 'ns-resize';
                  document.body.style.userSelect = 'none';
                }
              }}>
              <div className="resize-handle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              </div>
            </div>

            {/* Многострочное поле ввода */}
            <div className="chat-input" style={{ height: `${inputHeight}px` }}>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleTextareaChange}
                onKeyPress={handleKeyPress}
                placeholder="Введите сообщение... (Shift+Enter для новой строки)"
                className="message-textarea"
                rows={1}
                style={{ height: `${inputHeight}px` }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="send-btn"
                title="Отправить сообщение">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22,2 15,22 11,13 2,9"></polygon>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="panel-controls">
        {!isRunning || stopped ? (
          <button className="control-btn start-btn full-width" onClick={handleStart} title="Запустить плагин">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5,3 19,12 5,21"></polygon>
            </svg>
            Старт
          </button>
        ) : (
          <div className="control-buttons-group">
            <button
              className="control-btn pause-btn"
              onClick={onPause}
              title={isPaused ? 'Возобновить' : 'Приостановить'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isPaused ? (
                  <polygon points="5,3 19,12 5,21"></polygon>
                ) : (
                  <>
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </>
                )}
              </svg>
              {isPaused ? 'Старт' : 'Пауза'}
            </button>
            <button className="control-btn stop-btn" onClick={handleStop} title="Остановить плагин">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
              Стоп
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export type Plugin = {
  id: string;
  icon?: string;
  iconUrl?: string;
  manifest?: Record<string, unknown>;
  name?: string;
  [key: string]: unknown;
};
