import { PluginDetails } from './PluginDetails';
import { useState, useRef, useEffect } from 'react';
import type { Plugin } from './PluginCard';
import type React from 'react';
import './PluginControlPanel.css';

interface PluginControlPanelProps {
  plugin: Plugin;
  currentView: PanelView;
  isRunning: boolean;
  isPaused: boolean;
  onViewChange: (view: PanelView) => void;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onClose: () => void;
  onSendMessage?: (message: string) => void;
  onUpdateSetting?: (pluginId: string, setting: string, value: boolean) => Promise<void>;
}

export type PanelView = 'chat' | 'details';

export const PluginControlPanel: React.FC<PluginControlPanelProps> = ({
  plugin,
  currentView,
  isRunning,
  isPaused,
  onViewChange,
  onStart,
  onPause,
  onStop,
  onClose,
  onSendMessage,
  onUpdateSetting,
}) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; text: string; isUser: boolean; timestamp: Date }>>([]);
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

  const pluginName = plugin.name || plugin.manifest?.name || plugin.id;

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

  // Автоматическое изменение высоты textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Автоматическое изменение высоты
    const textarea = e.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 200); // Минимум 60px, максимум 200px
    textarea.style.height = `${newHeight}px`;
    setInputHeight(newHeight);
  };

  // Обработка изменения размера разделителя
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const container = document.querySelector('.chat-view') as HTMLElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY;
      const minHeight = 100; // Минимальная высота чата
      const maxHeight = containerRect.height - 80; // Максимальная высота чата

      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setInputHeight(containerRect.height - newHeight);
      }
    };

    const handleResizeEnd = () => {
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

  const handleSendMessage = () => {
    if (!message.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      text: message.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setMessage('');

    // Сброс высоты textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = '60px';
      setInputHeight(60);
    }

    // Вызываем callback для обработки сообщения
    onSendMessage?.(newMessage.text);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="plugin-control-panel">
      <div className="panel-header">
        <div className="plugin-info">
          <img
            className="plugin-icon"
            src={plugin.iconUrl || `plugins/${plugin.id}/${plugin.icon || 'icon.svg'}`}
            alt={`${pluginName} icon`}
            onError={e => {
              const firstChar = pluginName.charAt(0) || 'P';
              e.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><rect width='24' height='24' fill='%23e0e0e0'/><text x='12' y='12' text-anchor='middle' dy='.3em' font-family='Arial' font-size='8' fill='%23999'>${firstChar.toUpperCase()}</text></svg>`;
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
            <div className="chat-messages" style={{ height: `calc(100% - ${inputHeight}px - 8px)` }}>
              {messages.length === 0 ? (
                <div className="chat-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <p>Чат с плагином {pluginName}</p>
                  <p className="chat-hint">Напишите сообщение, чтобы начать общение</p>
                </div>
              ) : (
                <div className="messages-container">
                  {messages.map(msg => (
                    <div key={msg.id} className={`chat-message${msg.isUser ? 'user' : 'bot'}`}>
                      <div className="message-content">
                        <span className="message-text">{msg.text}</span>
                        <span className="message-time">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Разделитель с возможностью изменения размера */}
            <div
              ref={resizeRef}
              className="chat-resizer"
              onMouseDown={handleResizeStart}
              title="Изменить размер поля ввода"
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
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
