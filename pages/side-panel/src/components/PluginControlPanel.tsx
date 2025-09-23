/**
 * PluginControlPanel.tsx - Панель управления плагином с чатом
 *
 * ИСПРАВЛЕНИЕ ПРОБЛЕМЫ С ПОЛУЧЕНИЕМ ОТВЕТА GET_PLUGIN_CHAT:
 * ========================================================
 *
 * Проблема: Background отправлял ответ через sendResponse() callback, но компонент
 * ожидал ответ через chrome.runtime.sendMessage() с типом 'GET_PLUGIN_CHAT_RESPONSE'.
 *
 * Решение: Изменен механизм коммуникации на использование Promise-based подхода
 * с помощью sendMessageToBackgroundAsync(), который правильно работает с sendResponse().
 *
 * Теперь:
 * 1. Компонент отправляет GET_PLUGIN_CHAT через chrome.runtime.sendMessage()
 * 2. Background получает сообщение и отвечает через sendResponse()
 * 3. Компонент получает ответ через Promise и обрабатывает его
 *
 * Диагностика:
 * - Логи sendMessageToBackgroundAsync покажут отправку и получение ответа
 * - Логи loadChat покажут обработку ответа
 * - Логи processChatResponse покажут разбор данных чата
 */

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
  // Состояние для текущего pageKey с динамическим обновлением
  const [currentPageKey, setCurrentPageKey] = useState(getPageKey(currentTabUrl));

  // useEffect для обновления pageKey при изменении currentTabUrl
  useEffect(() => {
    const newPageKey = getPageKey(currentTabUrl);
    console.log('[PluginControlPanel] currentTabUrl изменился:', {
      oldPageKey: currentPageKey,
      newPageKey,
      currentTabUrl,
      timestamp: new Date().toISOString()
    });
    setCurrentPageKey(newPageKey);
  }, [currentTabUrl]);
  // Используем хук для ленивой синхронизации
  const { message, setMessage, isDraftSaved, isDraftLoading, draftError, loadDraft, clearDraft, draftText } =
    useLazyChatSync({
      pluginId: plugin.id,
      pageKey: currentPageKey, // <-- Теперь динамический pageKey
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

  // Вспомогательная функция для отправки сообщений в background с ожиданием ответа
  const sendMessageToBackgroundAsync = useCallback(async (message: any): Promise<any> => {
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const messageWithId = { ...message, messageId };

    try {
      const response = await chrome.runtime.sendMessage(messageWithId);
      return response;
    } catch (error) {
      console.error('[PluginControlPanel] sendMessageToBackgroundAsync - ошибка:', error);
      throw error;
    }
  }, []);

  // Вспомогательная функция для отправки сообщений в background без ожидания ответа (для обратной совместимости)
  const sendMessageToBackground = useCallback((message: any): void => {
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const messageWithId = { ...message, messageId };

    chrome.runtime.sendMessage(messageWithId);
  }, []);

  // Функция для тестирования обработки сообщений с проблемными данными
  const testMessageProcessing = useCallback(() => {
    console.log('[PluginControlPanel] 🧪 ТЕСТИРОВАНИЕ обработки сообщений с проблемными данными');

    // Тест 1: Сообщение с объектом вместо строки в text
    const testMessageWithObject = {
      messages: [{
        id: 'test_obj_1',
        text: { content: 'Это объект вместо строки', type: 'object' }, // Объект вместо строки
        role: 'user',
        timestamp: Date.now()
      }]
    };

    // Тест 2: Сообщение с null в text
    const testMessageWithNull = {
      messages: [{
        id: 'test_null_1',
        text: null, // null вместо строки
        role: 'user',
        timestamp: Date.now()
      }]
    };

    // Тест 3: Сообщение с undefined в text
    const testMessageWithUndefined = {
      messages: [{
        id: 'test_undef_1',
        text: undefined, // undefined вместо строки
        role: 'user',
        timestamp: Date.now()
      }]
    };

    // Объявляем processChatResponse локально для избежания проблем с temporal dead zone
    const localProcessChatResponse = (response: any) => {
      console.log('[PluginControlPanel] ===== НАЧАЛО processChatResponse =====');
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
        timestamp: new Date().toISOString()
      });

      // Обработка случая пустого чата (background возвращает null)
      if (response === null) {
        console.log('[PluginControlPanel] ✅ Получен null - чат пустой, устанавливаем пустой массив сообщений');
        setMessages([]);
        return;
      }

      // Обработка разных форматов ответа с дополнительной диагностикой
      let messagesArray = null;

      // Список возможных путей к массиву сообщений в приоритете
      const messagePaths = [
        { path: ['messages'], description: 'messages' },
        { path: ['chat'], description: 'chat' },
        { path: ['chat', 'messages'], description: 'chat.messages' },
        { path: ['data', 'messages'], description: 'data.messages' },
        { path: ['result', 'messages'], description: 'result.messages' },
        { path: ['items'], description: 'items' },
        { path: ['history'], description: 'history' },
        { path: ['logs'], description: 'logs' },
      ];

      // Функция для извлечения значения по пути
      const getValueByPath = (obj: any, path: string[]): any => {
        let current = obj;
        for (const key of path) {
          if (current && typeof current === 'object' && key in current) {
            current = current[key];
          } else {
            return undefined;
          }
        }
        return current;
      };

      // Если response является массивом напрямую
      if (Array.isArray(response)) {
        messagesArray = response;
        console.log('[PluginControlPanel] ✅ Ответ является массивом напрямую:', {
          length: messagesArray.length,
          firstMessage: messagesArray[0] ? {
            id: messagesArray[0].id,
            content: messagesArray[0].content || messagesArray[0].text,
            role: messagesArray[0].role,
            timestamp: messagesArray[0].timestamp,
          } : 'no messages'
        });
      } else if (response && typeof response === 'object') {
        // Обработка ошибок от background
        if (response.error) {
          console.error('[PluginControlPanel] ❌ Background вернул ошибку:', response.error);
          setError(`Ошибка от background: ${response.error}`);
          setMessages([]);
          return;
        }

        // Поиск массива сообщений по возможным путям
        for (const { path, description } of messagePaths) {
          const candidate = getValueByPath(response, path);
          if (Array.isArray(candidate)) {
            messagesArray = candidate;
            console.log(`[PluginControlPanel] ✅ Найден массив сообщений по пути '${description}':`, {
              length: messagesArray.length,
              firstMessage: messagesArray[0] ? {
                id: messagesArray[0].id,
                content: messagesArray[0].content || messagesArray[0].text,
                role: messagesArray[0].role,
                timestamp: messagesArray[0].timestamp,
              } : 'no messages'
            });
            break;
          }
        }

        // Если не нашли массив, логируем структуру объекта для диагностики
        if (!messagesArray) {
          console.warn('[PluginControlPanel] ⚠️ Не найден массив сообщений в объекте ответа:', {
            responseType: typeof response,
            responseKeys: Object.keys(response),
            responseSample: JSON.stringify(response).substring(0, 500),
            timestamp: new Date().toISOString()
          });
          messagesArray = [];
        }
      } else {
        // Response не является объектом или массивом
        console.warn('[PluginControlPanel] ⚠️ Ответ имеет неподдерживаемый тип:', {
          response,
          responseType: typeof response,
          responseStringified: JSON.stringify(response).substring(0, 200),
          timestamp: new Date().toISOString()
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
        console.log('[PluginControlPanel] Начинаем конвертацию сообщений:', messagesArray.length);

        // Конвертируем сообщения из формата background в формат компонента
        const convertedMessages: ChatMessage[] = messagesArray
          .filter((msg: any) => {
            if (!msg || typeof msg !== 'object') {
              console.warn('[PluginControlPanel] Фильтруем некорректное сообщение:', msg);
              return false;
            }
            return true;
          })
          .map((msg: any, index: number) => {
            try {
              // Строгая проверка и конвертация поля text
              let textContent = msg.content || msg.text || '';

              // Если text является объектом, конвертируем его в строку
              if (typeof textContent === 'object') {
                console.warn('[PluginControlPanel] text является объектом, конвертируем:', textContent);
                textContent = JSON.stringify(textContent);
              } else if (textContent === null || textContent === undefined) {
                console.warn('[PluginControlPanel] text равен null/undefined, устанавливаем пустую строку');
                textContent = '';
              } else {
                // Убеждаемся, что это строка
                textContent = String(textContent);
              }

              const convertedMsg: ChatMessage = {
                id: msg.id || String(msg.timestamp || Date.now() + index),
                text: textContent,
                isUser: msg.role ? msg.role === 'user' : !!msg.isUser,
                timestamp: msg.timestamp || Date.now(),
              };

              console.log(`[PluginControlPanel] Конвертировано сообщение ${index}:`, {
                id: convertedMsg.id,
                textLength: convertedMsg.text.length,
                textType: typeof convertedMsg.text,
                isUser: convertedMsg.isUser
              });

              return convertedMsg;
            } catch (conversionError) {
              console.error(`[PluginControlPanel] Ошибка конвертации сообщения ${index}:`, conversionError, msg);
              // Возвращаем безопасное сообщение в случае ошибки
              return {
                id: `error_${Date.now()}_${index}`,
                text: '[ОШИБКА КОНВЕРТАЦИИ СООБЩЕНИЯ]',
                isUser: false,
                timestamp: Date.now(),
              };
            }
          });

        console.log('[PluginControlPanel] ✅ Успешная конвертация сообщений:', {
          originalCount: messagesArray.length,
          convertedCount: convertedMessages.length,
          firstConverted: convertedMessages[0],
          // Безопасная обработка текста сообщений с проверкой типов
          allConverted: convertedMessages.map(m => {
            try {
              const textPreview = typeof m.text === 'string' ? m.text.substring(0, 50) : String(m.text || '').substring(0, 50);
              return { id: m.id, text: textPreview, isUser: m.isUser, textType: typeof m.text };
            } catch (textError) {
              console.warn('[PluginControlPanel] Error processing message text:', textError, m);
              return { id: m.id, text: '[ERROR: invalid text]', isUser: m.isUser, textType: typeof m.text };
            }
          })
        });

        setMessages(convertedMessages);
      } else {
        console.log('[PluginControlPanel] ⚠️ messagesArray пустой или не массив, устанавливаем пустой массив');
        setMessages([]);
      }

      console.log('[PluginControlPanel] ===== ЗАВЕРШЕНИЕ processChatResponse =====');
    };

    try {
      console.log('[PluginControlPanel] Тест 1: Обработка сообщения с объектом в text');
      localProcessChatResponse(testMessageWithObject);
    } catch (error) {
      console.error('[PluginControlPanel] ❌ Тест 1 провалился:', error);
    }

    try {
      console.log('[PluginControlPanel] Тест 2: Обработка сообщения с null в text');
      localProcessChatResponse(testMessageWithNull);
    } catch (error) {
      console.error('[PluginControlPanel] ❌ Тест 2 провалился:', error);
    }

    try {
      console.log('[PluginControlPanel] Тест 3: Обработка сообщения с undefined в text');
      localProcessChatResponse(testMessageWithUndefined);
    } catch (error) {
      console.error('[PluginControlPanel] ❌ Тест 3 провалился:', error);
    }

    console.log('[PluginControlPanel] ✅ Тестирование обработки сообщений завершено');
  }, []); // Убрали processChatResponse из зависимостей

  // Вспомогательная функция для обработки ответа чата
  const processChatResponse = useCallback((response: any) => {
    console.log('[PluginControlPanel] ===== НАЧАЛО processChatResponse =====');
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
      timestamp: new Date().toISOString()
    });

    // Обработка случая пустого чата (background возвращает null)
    if (response === null) {
      console.log('[PluginControlPanel] ✅ Получен null - чат пустой, устанавливаем пустой массив сообщений');
      setMessages([]);
      return;
    }

    // Обработка разных форматов ответа с дополнительной диагностикой
    let messagesArray = null;

    // Список возможных путей к массиву сообщений в приоритете
    const messagePaths = [
      { path: ['messages'], description: 'messages' },
      { path: ['chat'], description: 'chat' },
      { path: ['chat', 'messages'], description: 'chat.messages' },
      { path: ['data', 'messages'], description: 'data.messages' },
      { path: ['result', 'messages'], description: 'result.messages' },
      { path: ['items'], description: 'items' },
      { path: ['history'], description: 'history' },
      { path: ['logs'], description: 'logs' },
    ];

    // Функция для извлечения значения по пути
    const getValueByPath = (obj: any, path: string[]): any => {
      let current = obj;
      for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          return undefined;
        }
      }
      return current;
    };

    // Если response является массивом напрямую
    if (Array.isArray(response)) {
      messagesArray = response;
      console.log('[PluginControlPanel] ✅ Ответ является массивом напрямую:', {
        length: messagesArray.length,
        firstMessage: messagesArray[0] ? {
          id: messagesArray[0].id,
          content: messagesArray[0].content || messagesArray[0].text,
          role: messagesArray[0].role,
          timestamp: messagesArray[0].timestamp,
        } : 'no messages'
      });
    } else if (response && typeof response === 'object') {
      // Обработка ошибок от background
      if (response.error) {
        console.error('[PluginControlPanel] ❌ Background вернул ошибку:', response.error);
        setError(`Ошибка от background: ${response.error}`);
        setMessages([]);
        return;
      }

      // Поиск массива сообщений по возможным путям
      for (const { path, description } of messagePaths) {
        const candidate = getValueByPath(response, path);
        if (Array.isArray(candidate)) {
          messagesArray = candidate;
          console.log(`[PluginControlPanel] ✅ Найден массив сообщений по пути '${description}':`, {
            length: messagesArray.length,
            firstMessage: messagesArray[0] ? {
              id: messagesArray[0].id,
              content: messagesArray[0].content || messagesArray[0].text,
              role: messagesArray[0].role,
              timestamp: messagesArray[0].timestamp,
            } : 'no messages'
          });
          break;
        }
      }

      // Если не нашли массив, логируем структуру объекта для диагностики
      if (!messagesArray) {
        console.warn('[PluginControlPanel] ⚠️ Не найден массив сообщений в объекте ответа:', {
          responseType: typeof response,
          responseKeys: Object.keys(response),
          responseSample: JSON.stringify(response).substring(0, 500),
          timestamp: new Date().toISOString()
        });
        messagesArray = [];
      }
    } else {
      // Response не является объектом или массивом
      console.warn('[PluginControlPanel] ⚠️ Ответ имеет неподдерживаемый тип:', {
        response,
        responseType: typeof response,
        responseStringified: JSON.stringify(response).substring(0, 200),
        timestamp: new Date().toISOString()
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
      console.log('[PluginControlPanel] Начинаем конвертацию сообщений:', messagesArray.length);

      // Конвертируем сообщения из формата background в формат компонента
      const convertedMessages: ChatMessage[] = messagesArray
        .filter((msg: any) => {
          if (!msg || typeof msg !== 'object') {
            console.warn('[PluginControlPanel] Фильтруем некорректное сообщение:', msg);
            return false;
          }
          return true;
        })
        .map((msg: any, index: number) => {
           try {
             // Строгая проверка и конвертация поля text
             let textContent = msg.content || msg.text || '';
             let messageTimestamp = msg.timestamp || Date.now();

             // Если text является объектом, конвертируем его в строку
             if (typeof textContent === 'object') {
               console.warn('[PluginControlPanel] text является объектом, конвертируем:', textContent);
               textContent = JSON.stringify(textContent);
             } else if (textContent === null || textContent === undefined) {
               console.warn('[PluginControlPanel] text равен null/undefined, устанавливаем пустую строку');
               textContent = '';
             } else {
               // Убеждаемся, что это строка
               textContent = String(textContent);

               console.log(`[PluginControlPanel] Raw textContent before JSON parse for message ${index}:`, textContent);

               // Проверяем, является ли строка JSON с сообщением плагина
               try {
                 const parsedContent = JSON.parse(textContent);
                 if (typeof parsedContent === 'object' && parsedContent !== null && 'content' in parsedContent) {
                   console.log('[PluginControlPanel] Распарсен JSON из content:', parsedContent);
                   textContent = String(parsedContent.content || '');
                   // Используем timestamp из распарсенного объекта, если он есть
                   if (parsedContent.timestamp && typeof parsedContent.timestamp === 'number') {
                     messageTimestamp = parsedContent.timestamp;
                   }
                 }
               } catch (jsonParseError) {
                 // Не JSON, оставляем как есть
                 console.log('[PluginControlPanel] content не является JSON, оставляем как есть');
               }

               console.log(`[PluginControlPanel] TextContent after JSON parse for message ${index}:`, textContent);
             }

             const convertedMsg: ChatMessage = {
               id: msg.id || String(messageTimestamp + index),
               text: textContent,
               isUser: msg.role ? msg.role === 'user' : !!msg.isUser,
               timestamp: messageTimestamp,
             };

             console.log(`[PluginControlPanel] Конвертировано сообщение ${index}:`, {
               id: convertedMsg.id,
               textLength: convertedMsg.text.length,
               textType: typeof convertedMsg.text,
               isUser: convertedMsg.isUser
             });

             console.log(`[PluginControlPanel] Final converted text for message ${index}:`, convertedMsg.text);

             return convertedMsg;
          } catch (conversionError) {
            console.error(`[PluginControlPanel] Ошибка конвертации сообщения ${index}:`, conversionError, msg);
            // Возвращаем безопасное сообщение в случае ошибки
            return {
              id: `error_${Date.now()}_${index}`,
              text: '[ОШИБКА КОНВЕРТАЦИИ СООБЩЕНИЯ]',
              isUser: false,
              timestamp: Date.now(),
            };
          }
        });

      console.log('[PluginControlPanel] ✅ Успешная конвертация сообщений:', {
        originalCount: messagesArray.length,
        convertedCount: convertedMessages.length,
        firstConverted: convertedMessages[0],
        // Безопасная обработка текста сообщений с проверкой типов
        allConverted: convertedMessages.map(m => {
          try {
            const textPreview = typeof m.text === 'string' ? m.text.substring(0, 50) : String(m.text || '').substring(0, 50);
            return { id: m.id, text: textPreview, isUser: m.isUser, textType: typeof m.text };
          } catch (textError) {
            console.warn('[PluginControlPanel] Error processing message text:', textError, m);
            return { id: m.id, text: '[ERROR: invalid text]', isUser: m.isUser, textType: typeof m.text };
          }
        })
      });

      setMessages(convertedMessages);
    } else {
      console.log('[PluginControlPanel] ⚠️ messagesArray пустой или не массив, устанавливаем пустой массив');
      setMessages([]);
    }

    console.log('[PluginControlPanel] ===== ЗАВЕРШЕНИЕ processChatResponse =====');
  }, []);

  // Загрузка истории чата при монтировании или смене плагина/страницы
  const loadChat = useCallback(async () => {
    setLoading(true);
    setError(null);

    console.log('[PluginControlPanel] ===== НАЧАЛО loadChat =====', {
      pluginId,
      pageKey: currentPageKey,
      currentTabUrl,
      timestamp: new Date().toISOString(),
      isRunning,
      isPaused
    });

    try {
      console.log('[PluginControlPanel] loadChat - отправляем запрос GET_PLUGIN_CHAT');
      const response = await sendMessageToBackgroundAsync({
        type: 'GET_PLUGIN_CHAT',
        pluginId,
        pageKey: currentPageKey,
      });

      console.log('[PluginControlPanel] loadChat - получен ответ от background:', response);
      console.log('[PluginControlPanel] loadChat - ТЕКУЩЕЕ СОСТОЯНИЕ ПЕРЕД СБРОСОМ LOADING В loadChat:', {
        loading,
        messagesCount: messages.length,
        timestamp: new Date().toISOString()
      });

      setLoading(false); // Останавливаем загрузку при получении ответа
      console.log('[PluginControlPanel] loadChat - loading сброшен в false');

      if (response?.error) {
        console.error('[PluginControlPanel] loadChat - ошибка в ответе:', response.error);
        setError(`Ошибка загрузки чата: ${response.error}`);
        setMessages([]);
      } else {
        console.log('[PluginControlPanel] loadChat - обрабатываем успешный ответ');
        // Используем анонимную функцию вместо прямого вызова processChatResponse
        // чтобы избежать проблемы с temporal dead zone
        ((response: any) => {
          console.log('[PluginControlPanel] ===== НАЧАЛО processChatResponse =====');
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
            timestamp: new Date().toISOString()
          });

          // Обработка случая пустого чата (background возвращает null)
          if (response === null) {
            console.log('[PluginControlPanel] ✅ Получен null - чат пустой, устанавливаем пустой массив сообщений');
            setMessages([]);
            return;
          }

          // Обработка разных форматов ответа с дополнительной диагностикой
          let messagesArray = null;

          // Список возможных путей к массиву сообщений в приоритете
          const messagePaths = [
            { path: ['messages'], description: 'messages' },
            { path: ['chat'], description: 'chat' },
            { path: ['chat', 'messages'], description: 'chat.messages' },
            { path: ['data', 'messages'], description: 'data.messages' },
            { path: ['result', 'messages'], description: 'result.messages' },
            { path: ['items'], description: 'items' },
            { path: ['history'], description: 'history' },
            { path: ['logs'], description: 'logs' },
          ];

          // Функция для извлечения значения по пути
          const getValueByPath = (obj: any, path: string[]): any => {
            let current = obj;
            for (const key of path) {
              if (current && typeof current === 'object' && key in current) {
                current = current[key];
              } else {
                return undefined;
              }
            }
            return current;
          };

          // Если response является массивом напрямую
          if (Array.isArray(response)) {
            messagesArray = response;
            console.log('[PluginControlPanel] ✅ Ответ является массивом напрямую:', {
              length: messagesArray.length,
              firstMessage: messagesArray[0] ? {
                id: messagesArray[0].id,
                content: messagesArray[0].content || messagesArray[0].text,
                role: messagesArray[0].role,
                timestamp: messagesArray[0].timestamp,
              } : 'no messages'
            });
          } else if (response && typeof response === 'object') {
            // Обработка ошибок от background
            if (response.error) {
              console.error('[PluginControlPanel] ❌ Background вернул ошибку:', response.error);
              setError(`Ошибка от background: ${response.error}`);
              setMessages([]);
              return;
            }

            // Поиск массива сообщений по возможным путям
            for (const { path, description } of messagePaths) {
              const candidate = getValueByPath(response, path);
              if (Array.isArray(candidate)) {
                messagesArray = candidate;
                console.log(`[PluginControlPanel] ✅ Найден массив сообщений по пути '${description}':`, {
                  length: messagesArray.length,
                  firstMessage: messagesArray[0] ? {
                    id: messagesArray[0].id,
                    content: messagesArray[0].content || messagesArray[0].text,
                    role: messagesArray[0].role,
                    timestamp: messagesArray[0].timestamp,
                  } : 'no messages'
                });
                break;
              }
            }

            // Если не нашли массив, логируем структуру объекта для диагностики
            if (!messagesArray) {
              console.warn('[PluginControlPanel] ⚠️ Не найден массив сообщений в объекте ответа:', {
                responseType: typeof response,
                responseKeys: Object.keys(response),
                responseSample: JSON.stringify(response).substring(0, 500),
                timestamp: new Date().toISOString()
              });
              messagesArray = [];
            }
          } else {
            // Response не является объектом или массивом
            console.warn('[PluginControlPanel] ⚠️ Ответ имеет неподдерживаемый тип:', {
              response,
              responseType: typeof response,
              responseStringified: JSON.stringify(response).substring(0, 200),
              timestamp: new Date().toISOString()
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
            console.log('[PluginControlPanel] Начинаем конвертацию сообщений:', messagesArray.length);

            // Конвертируем сообщения из формата background в формат компонента
            const convertedMessages: ChatMessage[] = messagesArray
              .filter((msg: any) => {
                if (!msg || typeof msg !== 'object') {
                  console.warn('[PluginControlPanel] Фильтруем некорректное сообщение:', msg);
                  return false;
                }
                return true;
              })
              .map((msg: any, index: number) => {
                try {
                  // Строгая проверка и конвертация поля text
                  let textContent = msg.content || msg.text || '';
                  let messageTimestamp = msg.timestamp || Date.now();
   
                  // Если text является объектом, конвертируем его в строку
                  if (typeof textContent === 'object') {
                    console.warn('[PluginControlPanel] text является объектом, конвертируем:', textContent);
                    textContent = JSON.stringify(textContent);
                  } else if (textContent === null || textContent === undefined) {
                    console.warn('[PluginControlPanel] text равен null/undefined, устанавливаем пустую строку');
                    textContent = '';
                  } else {
                    // Убеждаемся, что это строка
                    textContent = String(textContent);
   
                    // Проверяем, является ли строка JSON с сообщением плагина
                    try {
                      const parsedContent = JSON.parse(textContent);
                      if (typeof parsedContent === 'object' && parsedContent !== null && 'content' in parsedContent) {
                        console.log('[PluginControlPanel] Распаршен JSON из content:', parsedContent);
                        textContent = String(parsedContent.content || '');
                        // Используем timestamp из распарсенного объекта, если он есть
                        if (parsedContent.timestamp && typeof parsedContent.timestamp === 'number') {
                          messageTimestamp = parsedContent.timestamp;
                        }
                      }
                    } catch (jsonParseError) {
                      // Не JSON, оставляем как есть
                      console.log('[PluginControlPanel] content не является JSON, оставляем как есть');
                    }
                  }
   
                  const convertedMsg: ChatMessage = {
                    id: msg.id || String(messageTimestamp + index),
                    text: textContent,
                    isUser: msg.role ? msg.role === 'user' : !!msg.isUser,
                    timestamp: messageTimestamp,
                  };

                  console.log(`[PluginControlPanel] Конвертировано сообщение ${index}:`, {
                    id: convertedMsg.id,
                    textLength: convertedMsg.text.length,
                    textType: typeof convertedMsg.text,
                    isUser: convertedMsg.isUser
                  });

                  return convertedMsg;
                } catch (conversionError) {
                  console.error(`[PluginControlPanel] Ошибка конвертации сообщения ${index}:`, conversionError, msg);
                  // Возвращаем безопасное сообщение в случае ошибки
                  return {
                    id: `error_${Date.now()}_${index}`,
                    text: '[ОШИБКА КОНВЕРТАЦИИ СООБЩЕНИЯ]',
                    isUser: false,
                    timestamp: Date.now(),
                  };
                }
              });

            console.log('[PluginControlPanel] ✅ Успешная конвертация сообщений:', {
              originalCount: messagesArray.length,
              convertedCount: convertedMessages.length,
              firstConverted: convertedMessages[0],
              // Безопасная обработка текста сообщений с проверкой типов
              allConverted: convertedMessages.map(m => {
                try {
                  const textPreview = typeof m.text === 'string' ? m.text.substring(0, 50) : String(m.text || '').substring(0, 50);
                  return { id: m.id, text: textPreview, isUser: m.isUser, textType: typeof m.text };
                } catch (textError) {
                  console.warn('[PluginControlPanel] Error processing message text:', textError, m);
                  return { id: m.id, text: '[ERROR: invalid text]', isUser: m.isUser, textType: typeof m.text };
                }
              })
            });

            setMessages(convertedMessages);
          } else {
            console.log('[PluginControlPanel] ⚠️ messagesArray пустой или не массив, устанавливаем пустой массив');
            setMessages([]);
          }

          console.log('[PluginControlPanel] ===== ЗАВЕРШЕНИЕ processChatResponse =====');
        })(response);
        console.log('[PluginControlPanel] loadChat: чат успешно загружен');
      }

    } catch (error) {
      console.error('[PluginControlPanel] loadChat - ошибка при получении ответа:', error);
      console.error('[PluginControlPanel] loadChat - ТЕКУЩЕЕ СОСТОЯНИЕ В CATCH:', {
        loading,
        messagesCount: messages.length,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });

      // Детальное логирование ошибки с трассировкой стека
      console.error('[PluginControlPanel] loadChat - ERROR DETAILS:', {
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
        errorName: error instanceof Error ? error.name : 'Unknown error type',
        timestamp: new Date().toISOString(),
        pluginId,
        pageKey: currentPageKey
      });

      setLoading(false);
      console.log('[PluginControlPanel] loadChat - loading сброшен в false в catch блоке');

      // Улучшенная обработка ошибок с проверкой типа
      let errorMessage = 'Ошибка связи с background';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;

        // Специальная обработка для TypeError с substring
        if (error.name === 'TypeError' && error.message.includes('substring')) {
          errorMessage += ' (ошибка обработки текста - проверьте тип данных)';
          console.error('[PluginControlPanel] CRITICAL: substring error detected:', {
            originalError: error,
            stack: error.stack,
            context: { pluginId, pageKey: currentPageKey }
          });
        }
      } else {
        errorMessage += `: ${String(error)}`;
      }

      setError(errorMessage);
      setMessages([]);
    }

    console.log('[PluginControlPanel] ===== loadChat ЗАВЕРШЕН =====');
  }, [pluginId, currentPageKey, sendMessageToBackgroundAsync, currentTabUrl, isRunning, isPaused]);

  // Добавить useEffect для вызова loadChat при монтировании и смене pluginId/pageKey
  useEffect(() => {
    console.log('[PluginControlPanel] useEffect[loadChat] - триггер вызова loadChat', {
      pluginId,
      pageKey: currentPageKey,
      currentTabUrl,
      timestamp: new Date().toISOString()
    });

    // Вызываем асинхронную функцию без await, так как useEffect не может быть async
    loadChat().catch((error) => {
      console.error('[PluginControlPanel] useEffect[loadChat] - ошибка при вызове loadChat:', error);
    });
  }, [loadChat]);

  // useEffect для перезагрузки чата при смене pageKey
  useEffect(() => {
    console.log('[PluginControlPanel] pageKey изменился, перезагружаем чат и черновик');
    // Перезагружаем чат для новой страницы
    loadChat().catch((error) => {
      console.error('[PluginControlPanel] Ошибка при перезагрузке чата:', error);
    });
    // Перезагружаем черновик для новой страницы
    loadDraft();
  }, [currentPageKey, loadChat, loadDraft]);

  // Событийная синхронизация чата между вкладками и обработка результатов сохранения сообщений
  useEffect(() => {
    console.log('[PluginControlPanel] useEffect[handleChatUpdate] - регистрация слушателя сообщений', {
      pluginId,
      pageKey: currentPageKey,
      timestamp: new Date().toISOString()
    });

    const handleChatUpdate = (event: { type: string; pluginId: string; pageKey: string; messages?: ChatMessage[]; messageId?: string; response?: any; success?: boolean; error?: string; message?: any; timestamp?: number }) => {
      console.log('[PluginControlPanel] ===== handleChatUpdate - получено сообщение =====', {
        type: event?.type,
        pluginId: event?.pluginId,
        pageKey: event?.pageKey,
        messageId: event?.messageId,
        hasResponse: !!event?.response,
        responseType: event?.response ? typeof event.response : 'none',
        timestamp: new Date().toISOString()
      });

      // Обработка обновлений чата от других компонентов/вкладок
      if (event?.type === 'PLUGIN_CHAT_UPDATED' && event.pluginId === pluginId && event.pageKey === currentPageKey) {
        console.log('[PluginControlPanel] handleChatUpdate - обновление чата получено, запрашиваем актуальные данные');
        console.log('[PluginControlPanel] handleChatUpdate - ТЕКУЩЕЕ СОСТОЯНИЕ ПЕРЕД СБРОСОМ:', {
          loading,
          messagesCount: messages.length,
          currentPageKey,
          pluginId,
          timestamp: new Date().toISOString()
        });
        setLoading(false); // Гарантированный сброс loading перед загрузкой чата
        console.log('[PluginControlPanel] handleChatUpdate - loading сброшен, вызываем loadChat');
        // Запрашиваем актуальные данные чата асинхронно
        loadChat().catch((error) => {
          console.error('[PluginControlPanel] handleChatUpdate - ошибка при загрузке чата:', error);
        });
      }

      // NOTE: GET_PLUGIN_CHAT_RESPONSE больше не обрабатывается здесь,
      // поскольку ответы на GET_PLUGIN_CHAT теперь обрабатываются через Promise в loadChat()

      // Логируем все сообщения, которые приходят, но не обрабатываются
      if (event?.type !== 'PLUGIN_CHAT_UPDATED' && event?.type !== 'GET_PLUGIN_CHAT_RESPONSE') {
        console.log('[PluginControlPanel] handleChatUpdate - получено необработанное сообщение:', {
          type: event?.type,
          fullEvent: event,
          timestamp: new Date().toISOString()
        });
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
        console.log('[PluginControlPanel] handleChatUpdate - ТЕКУЩЕЕ СОСТОЯНИЕ ПЕРЕД ОБРАБОТКОЙ DELETE_RESPONSE:', {
          loading,
          messagesCount: messages.length,
          eventSuccess: event.success,
          timestamp: new Date().toISOString()
        });

        setLoading(false); // Останавливаем загрузку
        console.log('[PluginControlPanel] handleChatUpdate - loading сброшен в false для DELETE_PLUGIN_CHAT_RESPONSE');

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
          try {
            // Строгая проверка типа content для Pyodide сообщений
            let content = event.message.content;
            let messageTimestamp = event.timestamp || Date.now();

            // Если content является объектом, конвертируем в строку
            if (typeof content === 'object') {
              console.warn('[PluginControlPanel] PYODIDE content является объектом, конвертируем:', content);
              content = JSON.stringify(content);
            } else if (content === null || content === undefined) {
              console.warn('[PluginControlPanel] PYODIDE content равен null/undefined');
              content = 'Пустое сообщение от Pyodide';
            } else {
              content = String(content);

              // Проверяем, является ли строка JSON с сообщением плагина
              try {
                const parsedContent = JSON.parse(content);
                if (typeof parsedContent === 'object' && parsedContent !== null && 'content' in parsedContent) {
                  console.log('[PluginControlPanel] Распарсен JSON из PYODIDE content:', parsedContent);
                  content = String(parsedContent.content || '');
                  // Используем timestamp из распарсенного объекта, если он есть
                  if (parsedContent.timestamp && typeof parsedContent.timestamp === 'number') {
                    messageTimestamp = parsedContent.timestamp;
                  }
                }
              } catch (jsonParseError) {
                // Не JSON, оставляем как есть
                console.log('[PluginControlPanel] PYODIDE content не является JSON, оставляем как есть');
              }
            }

            const pyodideMessage: ChatMessage = {
              id: event.message.id || `pyodide_${messageTimestamp}_${Math.random()}`,
              text: content,
              isUser: false, // Python сообщения отображаем как от бота
              timestamp: messageTimestamp,
            };

            console.log('[PluginControlPanel] Adding Pyodide message to chat:', pyodideMessage);

            setMessages(prev => [...prev, pyodideMessage]);
            console.log('[PluginControlPanel] Pyodide message added to chat');
          } catch (pyodideError) {
            console.error('[PluginControlPanel] Ошибка обработки PYODIDE_MESSAGE_UPDATE:', pyodideError, event);
            // Добавляем сообщение об ошибке вместо падения
            const errorMessage: ChatMessage = {
              id: `pyodide_error_${Date.now()}`,
              text: `[ОШИБКА PYODIDE: ${pyodideError instanceof Error ? pyodideError.message : String(pyodideError)}]`,
              isUser: false,
              timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        } else {
          console.warn('[PluginControlPanel] PYODIDE_MESSAGE_UPDATE без content:', event.message);
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
    chrome.runtime.onMessage.removeListener(handleChatOperationResult);

    console.log('[PluginControlPanel] useEffect[handleChatUpdate] - слушатели сообщений зарегистрированы');

    return () => {
      console.log('[PluginControlPanel] useEffect[handleChatUpdate] - удаление слушателей сообщений');
      chrome.runtime.onMessage.removeListener(handleChatUpdate);
      chrome.runtime.onMessage.removeListener(handleChatOperationResult);
    };
  }, [pluginId, currentPageKey, sendMessageToBackground, loadChat]);

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
      pageKey: currentPageKey,
      draftText,
      message,
      currentView,
      isRunning,
      isPaused,
    });
  });

  // Глобальный обработчик ошибок для ловли проблем с substring
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Перехватываем ошибки substring
      const errorMessage = args.join(' ');
      if (errorMessage.includes('substring') && errorMessage.includes('is not a function')) {
        console.error('[PluginControlPanel] 🔴 CRITICAL: substring error detected!');
        console.error('[PluginControlPanel] Error details:', args);
        console.error('[PluginControlPanel] Stack trace:', new Error().stack);
        // Не блокируем оригинальную обработку ошибки
      }
      originalConsoleError.apply(console, args);
    };

    console.log('[PluginControlPanel] Глобальный перехватчик ошибок substring активирован');

    return () => {
      console.error = originalConsoleError;
      console.log('[PluginControlPanel] Глобальный перехватчик ошибок substring деактивирован');
    };
  }, []);

  // Слушатель для Pyodide сообщений через custom events
  useEffect(() => {
    console.log('[PluginControlPanel] Настройка слушателя для pyodide messages');

    const handlePyodideCustomEvent = (event: any) => {
      const data = event.detail;
      console.log('[PluginControlPanel] Получен Pyodide custom event:', data);

      if (data?.type === 'PYODIDE_MESSAGE_UPDATE') {
        console.log('[PluginControlPanel] PYODIDE_MESSAGE_UPDATE received:', data.message);

        if (data.message?.content) {
          try {
            // Строгая проверка типа content
            let content = data.message.content;
            let messageTimestamp = data.timestamp || Date.now();

            // Если content является объектом, конвертируем в строку
            if (typeof content === 'object') {
              console.warn('[PluginControlPanel] Pyodide content является объектом, конвертируем:', content);
              content = JSON.stringify(content);
            } else if (content === null || content === undefined) {
              console.warn('[PluginControlPanel] Pyodide content равен null/undefined');
              content = 'Пустое сообщение от Pyodide';
            } else {
              content = String(content);

              // Проверяем, является ли строка JSON с сообщением плагина
              try {
                const parsedContent = JSON.parse(content);
                if (typeof parsedContent === 'object' && parsedContent !== null && 'content' in parsedContent) {
                  console.log('[PluginControlPanel] Распарсен JSON из Pyodide content:', parsedContent);
                  content = String(parsedContent.content || '');
                  // Используем timestamp из распарсенного объекта, если он есть
                  if (parsedContent.timestamp && typeof parsedContent.timestamp === 'number') {
                    messageTimestamp = parsedContent.timestamp;
                  }
                }
              } catch (jsonParseError) {
                // Не JSON, оставляем как есть
                console.log('[PluginControlPanel] Pyodide content не является JSON, оставляем как есть');
              }
            }

            const pyodideMessage: ChatMessage = {
              id: data.message.id || `pyodide_${messageTimestamp}_${Math.random()}`,
              text: content,
              isUser: false, // Python сообщения отображаем как от бота
              timestamp: messageTimestamp,
            };

            console.log('[PluginControlPanel] Adding Pyodide message to chat:', pyodideMessage);

            setMessages(prev => [...prev, pyodideMessage]);
            console.log('[PluginControlPanel] Pyodide message added to chat');
          } catch (pyodideError) {
            console.error('[PluginControlPanel] Ошибка обработки Pyodide сообщения:', pyodideError, data);
            // Добавляем сообщение об ошибке вместо падения
            const errorMessage: ChatMessage = {
              id: `pyodide_error_${Date.now()}`,
              text: `[ОШИБКА PYODIDE: ${pyodideError instanceof Error ? pyodideError.message : String(pyodideError)}]`,
              isUser: false,
              timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        } else {
          console.warn('[PluginControlPanel] Pyodide сообщение без content:', data.message);
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
    if (typeof draftText === 'string') {
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
      pageKey: currentPageKey,
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
    console.log('[PluginControlPanel] useEffect[messages] - состояние messages обновлено:', {
      messagesCount: messages.length,
      firstMessage: messages[0] ? {
        id: messages[0].id,
        text: typeof messages[0].text === 'string' ? messages[0].text.substring(0, 50) : String(messages[0].text || '').substring(0, 50),
        isUser: messages[0].isUser,
        timestamp: messages[0].timestamp,
        textType: typeof messages[0].text
      } : null,
      // Безопасная обработка всех сообщений с проверкой типов
      allMessages: messages.map(m => {
        try {
          const textPreview = typeof m.text === 'string' ? m.text.substring(0, 30) : String(m.text || '').substring(0, 30);
          return { id: m.id, text: textPreview, isUser: m.isUser, textType: typeof m.text };
        } catch (msgError) {
          console.warn('[PluginControlPanel] Error in message logging:', msgError, m);
          return { id: m.id, text: '[LOGGING ERROR]', isUser: m.isUser, textType: typeof m.text };
        }
      }),
      timestamp: new Date().toISOString()
    });
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
  const handleClearChat = (): void => {
    setLoading(true);
    setError(null);

    sendMessageToBackground({
      type: 'DELETE_PLUGIN_CHAT',
      pluginId,
      pageKey: currentPageKey,
    });

    // Очищаем локальное состояние сразу
    setMessages([]);
    clearDraft(); // Очищаем черновик
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
              <button
                onClick={testMessageProcessing}
                disabled={loading}
                style={{ backgroundColor: '#ff6b35', marginLeft: '5px', display: 'none' }}
                title="Протестировать обработку сообщений с проблемными данными"
              >
                🧪 Тест
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

                // Парсинг JSON в тексте сообщения перед рендерингом
                let displayText = msg.text;
                let displayTimestamp = msg.timestamp;

                console.log('[PluginControlPanel] Raw message text before parsing for message', idx, ':', msg.text);

                try {
                  const parsed = JSON.parse(displayText);
                  if (typeof parsed === 'object' && parsed !== null && 'content' in parsed) {
                    console.log('[PluginControlPanel] Парсинг JSON в рендере:', parsed);
                    let content = parsed.content;
                    if (typeof content === 'object') {
                      displayText = JSON.stringify(content);
                    } else {
                      displayText = String(content || '');
                    }
                    if (parsed.timestamp && typeof parsed.timestamp === 'number') {
                      displayTimestamp = parsed.timestamp;
                    }
                  } else if (typeof parsed === 'string') {
                    // Если JSON содержит просто строку
                    displayText = parsed;
                  } else if (typeof parsed === 'object' && parsed !== null) {
                    // Если JSON содержит объект без поля content, берем первое строковое поле
                    const stringFields = Object.values(parsed).filter(val => typeof val === 'string');
                    if (stringFields.length > 0) {
                      displayText = String(stringFields[0]);
                    } else {
                      displayText = JSON.stringify(parsed);
                    }
                  }
                } catch (parseError) {
                  // Не JSON, оставляем как есть
                  console.log('[PluginControlPanel] Текст не является JSON, рендерим как есть');
                }

                console.log('[PluginControlPanel] Display text after parsing for message', idx, ':', displayText);

                return (
                  <div
                    key={msg.id || idx}
                    className={`chat-message ${msg.isUser ? 'user' : 'bot'}`}
                  >
                    <div className="message-content">
                      <span className="message-text">{displayText}</span>
                      <span className="message-time">
                        {new Date(displayTimestamp).toLocaleTimeString()}
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