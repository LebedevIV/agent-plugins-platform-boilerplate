import React, { useState, useRef, useEffect } from 'react';
import { Plugin } from './PluginCard';
import './PluginControlPanel.css';

export type PanelView = 'details' | 'chat';

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
}

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
  onSendMessage
}) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{id: string, text: string, isUser: boolean, timestamp: Date}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pluginName = plugin.name || plugin.manifest?.name || plugin.id;

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Фокус на поле ввода при открытии чата
  useEffect(() => {
    if (currentView === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentView]);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    const newMessage = {
      id: Date.now().toString(),
      text: message.trim(),
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessage('');
    
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
            onError={(e) => {
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
          className={`tab-btn${currentView === 'details' ? ' active' : ''}`}
          onClick={() => onViewChange('details')}
        >
          Детали
        </button>
        <button 
          className={`tab-btn${currentView === 'chat' ? ' active' : ''}`}
          onClick={() => onViewChange('chat')}
        >
          Чат
        </button>
      </div>

      <div className="panel-content">
        {currentView === 'details' ? (
          <div className="details-view">
            <div className="detail-item">
              <span className="detail-label">Версия:</span>
              <span className="detail-value">{plugin.version || plugin.manifest?.version || '1.0.0'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Описание:</span>
              <span className="detail-value">{plugin.description || plugin.manifest?.description || 'Описание недоступно'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{plugin.id}</span>
            </div>
          </div>
        ) : (
          <div className="chat-view">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <p>Чат с плагином {pluginName}</p>
                  <p className="chat-hint">Напишите сообщение, чтобы начать общение</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`chat-message${msg.isUser ? ' user' : ' bot'}`}>
                    <div className="message-content">
                      <span className="message-text">{msg.text}</span>
                      <span className="message-time">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="chat-input">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Введите сообщение..."
                className="message-input"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="send-btn"
                title="Отправить сообщение"
              >
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
        {!isRunning ? (
          <button className="control-btn start-btn full-width" onClick={onStart} title="Запустить плагин">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5,3 19,12 5,21"></polygon>
            </svg>
            Старт
          </button>
        ) : (
          <div className="control-buttons-group">
            <button className="control-btn pause-btn" onClick={onPause} title={isPaused ? "Возобновить" : "Приостановить"}>
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
            <button className="control-btn stop-btn" onClick={onStop} title="Остановить плагин">
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