import { useState, useEffect, useRef, useCallback } from 'react';

interface UseLazyChatSyncOptions {
  pluginId: string;
  pageKey: string;
  debounceMs?: number; // Задержка перед синхронизацией (по умолчанию 1000ms)
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
}: UseLazyChatSyncOptions): UseLazyChatSyncReturn => {
  const [message, setMessageState] = useState('');
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedText = useRef<string>('');

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
      } else {
        setMessageState(''); // Явно очищаем если драфта нет
        lastSavedText.current = '';
        setIsDraftSaved(false);
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
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (text.length === 0) {
        clearDraft();
      } else {
        // Сохраняем драфт при любом непустом изменении
        debounceRef.current = setTimeout(() => {
          saveDraft(text);
        }, debounceMs);
      }
    },
    [debounceMs, saveDraft, clearDraft],
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

  // Сброс состояния при изменении pageKey (смена страницы)
  useEffect(() => {
    console.log('[useLazyChatSync] pageKey изменился:', pageKey);
    // setMessageState(''); // УБРАТЬ сброс message
    setIsDraftSaved(false);
    setIsDraftLoading(false);
    setDraftError(null);
    lastSavedText.current = '';

    // Очищаем таймер при смене страницы
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [pageKey]);

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
