import { useState, useEffect, useRef, useCallback } from 'react';

interface UseLazyChatSyncOptions {
  pluginId: string;
  pageKey: string;
  debounceMs?: number; // Задержка перед синхронизацией (по умолчанию 1000ms)
  minLength?: number; // Минимальная длина для синхронизации (по умолчанию 10 символов)
  maxLength?: number; // Максимальная длина для синхронизации (по умолчанию 1000 символов)
}

interface UseLazyChatSyncReturn {
  message: string;
  setMessage: (text: string) => void;
  isDraftSaved: boolean;
  isDraftLoading: boolean;
  draftError: string | null;
  loadDraft: () => Promise<void>;
  clearDraft: () => Promise<void>;
}

export const useLazyChatSync = ({
  pluginId,
  pageKey,
  debounceMs = 1000,
  minLength = 10,
  maxLength = 1000,
}: UseLazyChatSyncOptions): UseLazyChatSyncReturn => {
  const [message, setMessageState] = useState('');
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedText = useRef<string>('');

  // Функция для создания чата при начале ввода
  const createChatIfNeeded = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'CREATE_PLUGIN_CHAT',
        pluginId,
        pageKey,
      });
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  }, [pluginId, pageKey]);

  // Функция для сохранения черновика
  const saveDraft = useCallback(
    async (text: string) => {
      if (text === lastSavedText.current) return; // Не сохраняем, если текст не изменился

      try {
        await chrome.runtime.sendMessage({
          type: 'SAVE_PLUGIN_CHAT_DRAFT',
          pluginId,
          pageKey,
          draftText: text,
        });
        lastSavedText.current = text;
        setIsDraftSaved(true);
        setDraftError(null);
      } catch (error) {
        console.error('Error saving draft:', error);
        setDraftError('Ошибка сохранения черновика');
        setIsDraftSaved(false);
      }
    },
    [pluginId, pageKey],
  );

  // Функция для загрузки черновика
  const loadDraft = useCallback(async () => {
    setIsDraftLoading(true);
    setDraftError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PLUGIN_CHAT_DRAFT',
        pluginId,
        pageKey,
      });

      if (response?.draftText) {
        setMessageState(response.draftText);
        lastSavedText.current = response.draftText;
        setIsDraftSaved(true);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      setDraftError('Ошибка загрузки черновика');
    } finally {
      setIsDraftLoading(false);
    }
  }, [pluginId, pageKey]);

  // Функция для очистки черновика
  const clearDraft = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_PLUGIN_CHAT_DRAFT',
        pluginId,
        pageKey,
        draftText: '',
      });
      lastSavedText.current = '';
      setIsDraftSaved(false);
      setDraftError(null);
    } catch (error) {
      console.error('Error clearing draft:', error);
      setDraftError('Ошибка очистки черновика');
    }
  }, [pluginId, pageKey]);

  // Обновленная функция setMessage с ленивой синхронизацией
  const setMessage = useCallback(
    (text: string) => {
      setMessageState(text);

      // Очищаем предыдущий таймер
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Проверяем условия для синхронизации
      const shouldSync = text.length >= minLength && text.length <= maxLength;

      if (shouldSync) {
        // Создаем чат при первом вводе
        if (text.length === minLength) {
          createChatIfNeeded();
        }

        // Устанавливаем debounce для сохранения черновика
        debounceRef.current = setTimeout(() => {
          saveDraft(text);
        }, debounceMs);
      } else if (text.length === 0) {
        // Если текст пустой, очищаем черновик
        clearDraft();
      }
    },
    [minLength, maxLength, debounceMs, createChatIfNeeded, saveDraft, clearDraft],
  );

  // Очистка таймера при размонтировании
  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  // Автоматическая загрузка черновика при монтировании
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  return {
    message,
    setMessage,
    isDraftSaved,
    isDraftLoading,
    draftError,
    loadDraft,
    clearDraft,
  };
};
