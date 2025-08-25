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
  const loadChat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[PluginControlPanel] loadChat запрос:', { pluginId, pageKey });

      // ИСПРАВЛЕНИЕ: Простой и надежный подход без Promise.race
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, 5000);

        chrome.runtime.sendMessage({
          type: 'GET_PLUGIN_CHAT',
          pluginId,
          pageKey,
        }).then((result) => {
          clearTimeout(timeout);
          console.log('[PluginControlPanel] Response received:', result);
          resolve(result);
        }).catch((error) => {
          clearTimeout(timeout);
          console.error('[PluginControlPanel] Send message error:', error);
          reject(error);
        });
      });

      console.log('[PluginControlPanel] Response received successfully:', {
        response,
        typeofResponse: typeof response,
        responseKeys: response ? Object.keys(response) : 'response is null/undefined',
        responseStringified: JSON.stringify(response),
      });

      // Проверка на undefined с дополнительной диагностикой
      if (response === undefined || response === null) {
        console.error('[PluginControlPanel] Response is undefined/null, attempting fallback...');

        // Fallback: Повторный запрос
        try {
          console.log('[PluginControlPanel] Attempting fallback request...');
          await new Promise(resolve => setTimeout(resolve, 1000));

          const fallbackResponse = await new Promise<any>((resolve, reject) => {
            const fallbackTimeout = setTimeout(() => reject(new Error('FALLBACK_TIMEOUT')), 3000);

            chrome.runtime.sendMessage({
              type: 'GET_PLUGIN_CHAT',
              pluginId,
              pageKey,
            }).then((result) => {
              clearTimeout(fallbackTimeout);
              resolve(result);
            }).catch((error) => {
              clearTimeout(fallbackTimeout);
              reject(error);
            });
          });

          console.log('[PluginControlPanel] Fallback response:', fallbackResponse);

          if (fallbackResponse !== undefined && fallbackResponse !== null) {
            // Используем fallback ответ
            processChatResponse(fallbackResponse);
            console.log('[PluginControlPanel] Fallback successful');
            return;
          } else {
            throw new Error('Fallback response is also undefined');
          }
        } catch (fallbackError) {
          console.error('[PluginControlPanel] Fallback failed:', fallbackError);
          setError('Не удалось загрузить историю чата');
          setMessages([]);
          return;
        }
      } else {
        // Обрабатываем успешный ответ
        processChatResponse(response);
      }

    } catch (e) {
      console.error('[PluginControlPanel] loadChat error:', e);
      console.error('[PluginControlPanel] loadChat error details:', {
        error: e,
        message: (e as Error).message,
        stack: (e as Error).stack,
      });

      // Fallback логика - пытаемся загрузить через альтернативный метод
      if ((e as Error).message.includes('TIMEOUT')) {
        console.log('[PluginControlPanel] loadChat - пытаемся fallback через повторный запрос');

        try {
          // Повторная попытка с задержкой
          await new Promise(resolve => setTimeout(resolve, 1000));

          const fallbackResponse = await new Promise<any>((resolve, reject) => {
            const fallbackTimeout = setTimeout(() => reject(new Error('FALLBACK_TIMEOUT')), 3000);

            chrome.runtime.sendMessage({
              type: 'GET_PLUGIN_CHAT',
              pluginId,
              pageKey,
            }).then((result) => {
              clearTimeout(fallbackTimeout);
              resolve(result);
            }).catch((error) => {
              clearTimeout(fallbackTimeout);
              reject(error);
            });
          });

          console.log('[PluginControlPanel] loadChat - fallback ответ:', fallbackResponse);

          if (fallbackResponse !== undefined && fallbackResponse !== null) {
            // Используем fallback ответ
            processChatResponse(fallbackResponse);
            console.log('[PluginControlPanel] loadChat - успешно использован fallback');
            return;
          } else {
            throw new Error('Fallback тоже не сработал');
          }
        } catch (fallbackError) {
          console.error('[PluginControlPanel] loadChat - fallback тоже не удался:', fallbackError);
          setError('Ошибка загрузки истории чата (включая fallback)');
          setMessages([]);
          return;
        }
      } else {
        setError('Ошибка загрузки истории чата');
        setMessages([]);
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [pluginId, pageKey, processChatResponse]);

  // Добавить useEffect для вызова loadChat при монтировании и смене pluginId/pageKey
  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // Событийная синхронизация чата между вкладками
  useEffect(() => {
    const handleChatUpdate = async (event: { type: string; pluginId: string; pageKey: string; messages?: ChatMessage[] }) => {
      if (event?.type === 'PLUGIN_CHAT_UPDATED' && event.pluginId === pluginId && event.pageKey === pageKey) {
        // Перезагружаем историю чата с улучшенной обработкой ответа
        console.log('[PluginControlPanel] handleChatUpdate - начинаем запрос к background');

        // ИСПРАВЛЕНИЕ: Упрощенная логика без сложного Promise.race
        const sendMessagePromise = chrome.runtime.sendMessage({
          type: 'GET_PLUGIN_CHAT',
          pluginId,
          pageKey,
        });

        console.log('[PluginControlPanel] handleChatUpdate - ДО ОЖИДАНИЯ sendMessagePromise:', {
          promise: sendMessagePromise,
          typeofPromise: typeof sendMessagePromise,
        });

        // Используем новую простую логику с таймаутом
        const response = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('TIMEOUT'));
          }, 5000);

          sendMessagePromise.then((result) => {
            clearTimeout(timeout);
            console.log('[PluginControlPanel] handleChatUpdate response received:', result);
            resolve(result);
          }).catch((error) => {
            clearTimeout(timeout);
            console.error('[PluginControlPanel] handleChatUpdate send message error:', error);
            reject(error);
          });
        });

        console.log('[PluginControlPanel] handleChatUpdate response received successfully:', {
          response,
          typeofResponse: typeof response,
        });

        // Обработка успешного ответа
        if (response !== undefined && response !== null) {
          processChatResponse(response);
        } else {
          console.error('[PluginControlPanel] handleChatUpdate response is undefined/null');
          setMessages([]);
        }
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

  const handleSendMessage = async (): Promise<void> => {
    console.log('[PluginControlPanel] handleSendMessage: попытка отправки', { message });
    if (!message.trim()) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text: message.trim(),
      isUser: true,
      timestamp: Date.now(),
    };
    setMessage(''); // Очищаем сообщение через хук
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
      console.log('[PluginControlPanel] handleSendMessage: сообщение отправлено', newMessage);
      await loadChat(); // Перезагружаем историю чата после отправки
      await clearDraft(); // Сбрасываем черновик после отправки
    } catch (e) {
      setError('Ошибка сохранения сообщения');
      console.error('[PluginControlPanel] handleSendMessage: ошибка отправки', e);
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
            {loading && <p>Загрузка сообщений...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {/* Диагностический вывод сообщений */}
            {messages.map((msg, idx) => {
              console.log('[PluginControlPanel] render message:', idx, msg);
              return (
                <div
                  key={msg.id || idx}
                  style={{ border: '1px solid #ccc', margin: 4, padding: 4, background: '#f9f9f9' }}>
                  {JSON.stringify(msg)}
                </div>
              );
            })}
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
            <button onClick={handleSendMessage} disabled={!message.trim()} style={{ marginLeft: 8 }}>
              Отправить
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