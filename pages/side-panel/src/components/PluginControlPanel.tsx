import { DraftStatus } from './DraftStatus';
import { PluginDetails } from './PluginDetails';
import { getPageKey } from '../../../../packages/shared/lib/utils/helpers';
import { useLazyChatSync } from '../hooks/useLazyChatSync';
import { saveAs } from 'file-saver';
import { useState, useRef, useEffect, useCallback } from 'react';
import './PluginControlPanel.css';
import type React from 'react';

// Новый тип для сообщений чата
interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
}

interface PluginControlPanelProps {
  plugin: Plugin;
  currentView: PanelView;
  isRunning: boolean;
  isPaused: boolean;
  currentTabUrl: string | null;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onClose: () => void;
}

export type PanelView = 'chat' | 'details';

export const PluginControlPanel: React.FC<PluginControlPanelProps> = ({
  plugin,
  currentView,
  isRunning,
  isPaused,
  currentTabUrl,
  onStart,
  onPause,
  onStop,
  onClose,
}) => {
  // Используем хук для ленивой синхронизации
  const { message, setMessage, isDraftSaved, isDraftLoading, draftError, loadDraft, clearDraft, draftText } =
    useLazyChatSync({
      pluginId: plugin.id,
      pageKey: getPageKey(currentTabUrl),
      debounceMs: 1000, // 1 секунда задержки
      minLength: 10, // Минимум 10 символов для синхронизации
      maxLength: 1000, // Максимум 1000 символов
    });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputHeight, setInputHeight] = useState(60); // Начальная высота поля ввода
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isRunning) {
      // Удалить все вызовы setStopped(...)
    }
  }, [isRunning]);

  const handleStart = () => {
    // Удалить все вызовы setStopped(...)
    onStart();
  };

  const pluginName =
    plugin.name || (typeof plugin.manifest?.name === 'string' ? plugin.manifest.name : '') || plugin.id;

  // Получаем ключ чата для текущего плагина и страницы
  const pluginId = plugin.id;
  const pageKey = getPageKey(currentTabUrl);

  // Загрузка истории чата при монтировании или смене плагина/страницы
  const loadChat = useCallback(async () => {
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

  // Восстановление черновика при возврате на вкладку 'Чат'
  useEffect(() => {
    if (currentView === 'chat') {
      loadDraft(); // Явно загружаем черновик при возврате на вкладку чата
    }
  }, [currentView, loadDraft]);

  // --- Синхронизация message с draftText после загрузки черновика ---
  useEffect(() => {
    // Логируем для отладки
    console.log('[PluginControlPanel] useEffect draftText -> message:', message);
    // Если message не совпадает с черновиком, обновляем
    if (typeof message === 'string' && message !== draftText) {
      setMessage(draftText || '');
    }
  }, [draftText, message, setMessage]);

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
    // Удалить все вызовы setSyncStatus(...)
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
      // Удалить все вызовы setSyncStatus(...)
      await loadChat(); // Перезагружаем историю чата после отправки
      await clearDraft(); // Сбрасываем черновик после отправки
    } catch {
      // Удалить все вызовы setSyncStatus(...)
      setError('Ошибка сохранения сообщения');
    }
  };

  // Обработка изменения размера разделителя
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
    // Удалить все вызовы setSyncStatus(...)
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_PLUGIN_CHAT',
        pluginId,
        pageKey,
      });
      setMessages([]);
      await clearDraft(); // Очищаем черновик
      // Удалить все вызовы setSyncStatus(...)
    } catch {
      // Удалить все вызовы setSyncStatus(...)
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
                `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='100%' height='100%' fill='%23ccc'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='%23666'>${firstChar}</text></svg>`;
            }}
          />
          <h3>{pluginName}</h3>
        </div>
        <div className="control-buttons">
          <button onClick={handleStart} disabled={isRunning || isPaused}>
            {isRunning ? 'Остановить' : 'Запустить'}
          </button>
          <button onClick={onPause} disabled={!isRunning || isPaused}>
            Пауза
          </button>
          <button onClick={onStop} disabled={!isRunning}>
            Остановить
          </button>
          <button onClick={onClose}>Закрыть</button>
        </div>
      </div>
      <div className="panel-content">
        <div className="chat-view">
          <div className="chat-header">
            <h4>Чат</h4>
            <div className="chat-actions">
              <button onClick={handleClearChat} disabled={loading || error}>
                {loading ? 'Очистка...' : error ? 'Ошибка' : 'Очистить чат'}
              </button>
              <button onClick={handleExportChat} disabled={loading || error}>
                {loading ? 'Экспорт...' : error ? 'Ошибка' : 'Экспортировать'}
              </button>
            </div>
          </div>
          <div className="chat-messages">
            {loading && <p>Загрузка сообщений...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.isUser ? 'user-message' : 'bot-message'}`}>
                <p>{msg.text}</p>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
            {messagesEndRef.current && <div ref={messagesEndRef} />}
          </div>
          <div className="chat-input-container">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder="Напишите сообщение..."
              style={{ height: `${inputHeight}px` }}
            />
            <DraftStatus isDraftSaved={isDraftSaved} isDraftLoading={isDraftLoading} draftError={draftError} />
          </div>
        </div>
        <PluginDetails plugin={plugin} />
      </div>
    </div>
  );
};
