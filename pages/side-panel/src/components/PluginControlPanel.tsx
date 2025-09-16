import { DraftStatus } from './DraftStatus';
import { PluginDetails } from './PluginDetails';
import { getPageKey } from '../../../../packages/shared/lib/utils/helpers';
import { useLazyChatSync } from '../hooks/useLazyChatSync';
import { saveAs } from 'file-saver';
import { useState, useRef, useEffect, useCallback } from 'react';
import './PluginControlPanel.css';
import type React from 'react';

// Определение типа Plugin для PluginControlPanel
type Plugin = {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  iconUrl?: string;
  manifest?: Record<string, unknown>;
  host_permissions?: string[];
  settings?: {
    enabled?: boolean;
    autorun?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

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
  // Состояние для активной вкладки в панели управления
  const [activeTab, setActiveTab] = useState<PanelView>('chat');
  // Используем хук для ленивой синхронизации
  const { message, setMessage, isDraftSaved, isDraftLoading, draftError, loadDraft, clearDraft, draftText } =
    useLazyChatSync({
      pluginId: plugin.id,
      pageKey: getPageKey(currentTabUrl),
      debounceMs: 1000, // 1 секунда задержки
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

  // Вспомогательная функция для отправки сообщений в background без ожидания ответа
  const sendMessageToBackground = useCallback((message: any): void => {
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const messageWithId = { ...message, messageId };

    console.log('[PluginControlPanel] sendMessageToBackground:', messageWithId);
    chrome.runtime.sendMessage(messageWithId);
  }, []);

  // Вспомогательная функция для обработки ответа чата
  const processChatResponse = useCallback((response: any) => {
    console.log('[PluginControlPanel] Анализ chatData:', {
      response,
      hasMessages: response && 'messages' in response,
      hasChat: response && 'chat' in response,
      messagesValue: response?.messages,
      chatValue: response?.chat,
      isMessagesArray: Array.isArray(response?.messages),
      isChatArray: Array.isArray(response?.chat),
      responseType: typeof response,
      responseKeys: response ? Object.keys(response) : 'response is null/undefined',
    });

    // Обработка разных форматов ответа с дополнительной диагностикой
    let messagesArray = null;

    if (response && Array.isArray(response.messages)) {
      // Формат: { messages: [...] }
      messagesArray = response.messages;
      console.log('[PluginControlPanel] ✅ Используем формат с messages:', {
        length: messagesArray.length,
        firstMessage: messagesArray[0],
        sampleMessage: messagesArray[0] ? {
          id: messagesArray[0].id,
          content: messagesArray[0].content,
          role: messagesArray[0].role,
          timestamp: messagesArray[0].timestamp,
        } : 'no messages'
      });
    } else if (response && Array.isArray(response.chat)) {
      // Формат: { chat: [...] }
      messagesArray = response.chat;
      console.log('[PluginControlPanel] ✅ Используем формат с chat:', {
        length: messagesArray.length,
        firstMessage: messagesArray[0]
      });
    } else if (response && response.chat && Array.isArray(response.chat.messages)) {
      // Формат: { chat: { messages: [...] } }
      messagesArray = response.chat.messages;
      console.log('[PluginControlPanel] ✅ Используем вложенный формат:', {
        length: messagesArray.length,
        firstMessage: messagesArray[0]
      });
    } else if (response && response.error) {
      // Обработка ошибок от background
      console.error('[PluginControlPanel] ❌ Background вернул ошибку:', response.error);
      setError(`Ошибка от background: ${response.error}`);
      setMessages([]);
      return;
    } else {
      console.warn('[PluginControlPanel] ⚠️ Неизвестный формат ответа:', {
        response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : 'no keys',
        responseStringified: JSON.stringify(response)
      });
      messagesArray = [];
    }

    console.log('[PluginControlPanel] Финальный messagesArray:', {
      messagesArray,
      isArray: Array.isArray(messagesArray),
      length: messagesArray?.length,
      firstMessage: messagesArray?.[0],
      firstMessageType: messagesArray?.[0] ? typeof messagesArray[0] : 'none',
    });

    // Конвертация сообщений из формата background в формат компонента
    if (Array.isArray(messagesArray) && messagesArray.length > 0) {
      // Конвертируем сообщения из формата background в формат компонента
      const convertedMessages: ChatMessage[] = messagesArray
        .filter((msg: any) => msg && typeof msg === 'object') // Фильтруем null и не-объекты
        .map((msg: any, index: number) => ({
          id: msg.id || String(msg.timestamp || Date.now() + index),
          text: msg.content || msg.text || '',
          isUser: msg.role ? msg.role === 'user' : !!msg.isUser,
          timestamp: msg.timestamp || Date.now(),
        }));

      console.log('[PluginControlPanel] ✅ Успешная конвертация сообщений:', {
        originalCount: messagesArray.length,
        convertedCount: convertedMessages.length,
        firstConverted: convertedMessages[0],
        allConverted: convertedMessages.map(m => ({ id: m.id, text: m.text.substring(0, 50), isUser: m.isUser }))
      });

      setMessages(convertedMessages);
    } else {
      console.log('[PluginControlPanel] ⚠️ messagesArray пустой или не массив, устанавливаем пустой массив');
      setMessages([]);
    }
  }, []);

  // Загрузка истории чата при монтировании или смене плагина/страницы
  const loadChat = useCallback(() => {
    setLoading(true);
    setError(null);

    console.log('[PluginControlPanel] loadChat запрос:', { pluginId, pageKey });

    sendMessageToBackground({
      type: 'GET_PLUGIN_CHAT',
      pluginId,
      pageKey,
    });
  }, [pluginId, pageKey, sendMessageToBackground]);

  // Добавить useEffect для вызова loadChat при монтировании и смене pluginId/pageKey
  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // Событийная синхронизация чата между вкладками и обработка результатов сохранения сообщений
  useEffect(() => {
    const handleChatUpdate = (event: { type: string; pluginId: string; pageKey: string; messages?: ChatMessage[]; messageId?: string; response?: any }) => {
      if (event?.type === 'PLUGIN_CHAT_UPDATED' && event.pluginId === pluginId && event.pageKey === pageKey) {
        console.log('[PluginControlPanel] handleChatUpdate - обновление чата получено');
        // Запрашиваем актуальные данные чата
        sendMessageToBackground({
          type: 'GET_PLUGIN_CHAT',
          pluginId,
          pageKey,
        });
      }

      // Обработка ответов на GET_PLUGIN_CHAT с messageId
      if (event?.type === 'GET_PLUGIN_CHAT_RESPONSE' && event.messageId && event.response) {
        console.log('[PluginControlPanel] handleChatUpdate - получен ответ на GET_PLUGIN_CHAT:', event.response);

        setLoading(false); // Останавливаем загрузку при получении ответа

        if (event.response.error) {
          console.error('[PluginControlPanel] handleChatUpdate error:', event.response.error);
          setError(`Ошибка загрузки чата: ${event.response.error}`);
          setMessages([]);
        } else {
          processChatResponse(event.response);
          console.log('[PluginControlPanel] handleChatUpdate: чат успешно обновлен');
        }
      }

      // Обработка результатов сохранения сообщений
      if (event?.type === 'SAVE_PLUGIN_CHAT_MESSAGE_RESPONSE') {
        console.log('[PluginControlPanel] handleChatUpdate - результат сохранения сообщения:', event);

        if (event.success) {
          console.log('[PluginControlPanel] handleChatUpdate: сообщение успешно сохранено');
        } else {
          console.error('[PluginControlPanel] handleChatUpdate: ошибка сохранения сообщения', event.error);
          setError(`Ошибка сохранения сообщения: ${event.error}`);
        }
      }

      // Обработка результатов удаления чата
      if (event?.type === 'DELETE_PLUGIN_CHAT_RESPONSE') {
        console.log('[PluginControlPanel] handleChatUpdate - результат удаления чата:', event);
    
        setLoading(false); // Останавливаем загрузку
    
        if (event.success) {
          console.log('[PluginControlPanel] handleChatUpdate: чат успешно удален');
        } else {
          console.error('[PluginControlPanel] handleChatUpdate: ошибка удаления чата', event.error);
          setError(`Ошибка удаления чата: ${event.error}`);
        }
      }
    
      // === PYODIDE MESSAGE HANDLER ===
      if (event?.type === 'PYODIDE_MESSAGE_UPDATE') {
        console.log('[PluginControlPanel] PYODIDE_MESSAGE_UPDATE received:', event.message);
    
        if (event.message?.content) {
          const pyodideMessage: ChatMessage = {
            id: event.message.id || `pyodide_${event.timestamp || Date.now()}_${Math.random()}`,
            text: event.message.content,
            isUser: false, // Python сообщения отображаем как от бота
            timestamp: event.timestamp || Date.now(),
          };
    
          console.log('[PluginControlPanel] Adding Pyodide message to chat:', pyodideMessage);
    
          setMessages(prev => [...prev, pyodideMessage]);
          console.log('[PluginControlPanel] Pyodide message added to chat');
        }
      }
    };

    // Слушатель для обработки результатов операций с чатом
    const handleChatOperationResult = (message: any) => {
      if (message.type === 'SAVE_PLUGIN_CHAT_MESSAGE_RESPONSE') {
        console.log('[PluginControlPanel] handleChatOperationResult: получен результат сохранения сообщения', message);

        if (message.success) {
          console.log('[PluginControlPanel] handleChatOperationResult: сообщение успешно сохранено');
          // Не нужно ничего делать дополнительно - обновление придет через PLUGIN_CHAT_UPDATED
        } else {
          console.error('[PluginControlPanel] handleChatOperationResult: ошибка сохранения сообщения', message.error);
          setError(`Ошибка сохранения сообщения: ${message.error}`);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleChatUpdate);
    chrome.runtime.onMessage.addListener(handleChatOperationResult);

    return () => {
      chrome.runtime.onMessage.removeListener(handleChatUpdate);
      chrome.runtime.onMessage.removeListener(handleChatOperationResult);
    };
  }, [pluginId, pageKey, processChatResponse, sendMessageToBackground]);

  // Восстановление черновика при возврате на вкладку 'Чат'
  useEffect(() => {
    if (currentView === 'chat') {
      loadDraft(); // Явно загружаем черновик при возврате на вкладку чата
    }
  }, [currentView, loadDraft]);

  // Логирование каждого рендера и ключевых параметров
  useEffect(() => {
    console.log('[PluginControlPanel] === РЕНДЕР ===', {
      pluginId,
      pageKey,
      draftText,
      message,
      currentView,
      isRunning,
      isPaused,
    });
  });

  // Слушатель для Pyodide сообщений через custom events
  useEffect(() => {
    console.log('[PluginControlPanel] Настройка слушателя для pyodide messages');

    const handlePyodideCustomEvent = (event: any) => {
      const data = event.detail;
      console.log('[PluginControlPanel] Получен Pyodide custom event:', data);

      if (data?.type === 'PYODIDE_MESSAGE_UPDATE') {
        console.log('[PluginControlPanel] PYODIDE_MESSAGE_UPDATE received:', data.message);

        if (data.message?.content) {
          const pyodideMessage: ChatMessage = {
            id: data.message.id || `pyodide_${data.timestamp || Date.now()}_${Math.random()}`,
            text: data.message.content,
            isUser: false, // Python сообщения отображаем как от бота
            timestamp: data.timestamp || Date.now(),
          };

          console.log('[PluginControlPanel] Adding Pyodide message to chat:', pyodideMessage);

          setMessages(prev => [...prev, pyodideMessage]);
          console.log('[PluginControlPanel] Pyodide message added to chat');
        }
      }
    };

    window.addEventListener('PYODIDE_MESSAGE_UPDATE', handlePyodideCustomEvent);
    console.log('[PluginControlPanel] Слушатель для Pyodide custom events зарегистрирован');

    return () => {
      window.removeEventListener('PYODIDE_MESSAGE_UPDATE', handlePyodideCustomEvent);
      console.log('[PluginControlPanel] Слушатель для Pyodide custom events удален');
    };
  }, []);

  // --- Синхронизация message с draftText после загрузки черновика ---
  useEffect(() => {
    // Если draftText пустой, подставляем автотестовый текст
    if (typeof draftText === 'string' && draftText === '') {
      setMessage('Тестовое сообщение для диагностики');
      console.log('[PluginControlPanel] draftText пустой, подставлен автотестовый текст');
    } else if (typeof draftText === 'string') {
      setMessage(draftText);
      console.log('[PluginControlPanel] draftText подставлен в поле ввода:', draftText);
    }
  }, [draftText, setMessage]);

  const handleSendMessage = (): void => {
    console.log('[PluginControlPanel] handleSendMessage: попытка отправки', { message });
    if (!message.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text: message.trim(),
      isUser: true,
      timestamp: Date.now(),
    };

    // Очищаем сообщение через хук
    setMessage('');
    setError(null); // Сбрасываем предыдущие ошибки

    console.log('[PluginControlPanel] handleSendMessage: отправка сообщения в background');

    sendMessageToBackground({
      type: 'SAVE_PLUGIN_CHAT_MESSAGE',
      pluginId,
      pageKey,
      message: {
        role: 'user',
        content: newMessage.text,
        timestamp: newMessage.timestamp,
      },
    });

    // Очищаем черновик сразу после отправки
    clearDraft();
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

  useEffect(() => {
    console.log('[PluginControlPanel] messages после setMessages:', messages);
  }, [messages]);

  // Фокус на поле ввода при открытии чата
  useEffect(() => {
    if (currentView === 'chat') {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [currentView]);

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setMessage(event.target.value); // Используем хук вместо setMessage
    console.log('[PluginControlPanel] handleTextareaChange: новое значение', event.target.value);
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
  const handleClearChat = (): void => {
    setLoading(true);
    setError(null);

    sendMessageToBackground({
      type: 'DELETE_PLUGIN_CHAT',
      pluginId,
      pageKey,
    });

    // Очищаем локальное состояние сразу
    setMessages([]);
    clearDraft(); // Очищаем черновик
    console.log('[PluginControlPanel] handleClearChat: запрос на очистку чата отправлен');
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
      <div className="panel-tabs">
        <button
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Чат
        </button>
        <button
          className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Детали
        </button>
      </div>
      <div className="panel-content">
        {activeTab === 'chat' && (
          <div className="chat-view">
          <div className="chat-header">
            <h4>Чат</h4>
            <div className="chat-actions">
              <button onClick={handleClearChat} disabled={loading || !!error}>
                {loading ? 'Очистка...' : error ? 'Ошибка' : 'Очистить чат'}
              </button>
              <button onClick={handleExportChat} disabled={loading || !!error}>
                {loading ? 'Экспорт...' : error ? 'Ошибка' : 'Экспортировать'}
              </button>
            </div>
          </div>
          <div className="chat-messages">
            {loading && <div className="chat-loader">Загрузка сообщений...</div>}
            {error && <div className="chat-error">{error}</div>}
            {!loading && !error && messages.length === 0 && (
              <div className="chat-placeholder">
                <p>Нет сообщений</p>
                <p className="chat-hint">Напишите первое сообщение!</p>
              </div>
            )}
            {/* Отображение сообщений чата */}
            <div className="messages-container">
              {messages.map((msg, idx) => {
                console.log('[PluginControlPanel] render message:', idx, msg);
                return (
                  <div
                    key={msg.id || idx}
                    className={`chat-message ${msg.isUser ? 'user' : 'bot'}`}
                  >
                    <div className="message-content">
                      <span className="message-text">{msg.text}</span>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input">
            <textarea
              id="plugin-message-input"
              ref={textareaRef}
              className="message-textarea"
              value={message}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder="Напишите сообщение..."
              style={{ height: `${inputHeight}px` }}
            />
            <button
              className="send-btn"
              onClick={handleSendMessage}
              disabled={!message.trim()}
            >
              📤
            </button>
            <DraftStatus
              isDraftSaved={isDraftSaved}
              isDraftLoading={isDraftLoading}
              draftError={draftError}
              messageLength={message.length}
              minLength={10}
              maxLength={1000}
            />
          </div>
        </div>
        )}
        {activeTab === 'details' && (
          <PluginDetails plugin={plugin} />
        )}
      </div>
    </div>
  );
};