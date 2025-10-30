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
  draftText: string;
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
  const [draftText, setDraftText] = useState('');

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedText = useRef<string>('');

  // Функция для сохранения черновика
  const saveDraft = useCallback(
    async (text: string) => {
      if (text === lastSavedText.current) return; // Не сохраняем, если текст не изменился
      console.log('[useLazyChatSync] saveDraft: попытка сохранить draft', { pluginId, pageKey, text });
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
        setDraftText(text);
        console.log('[useLazyChatSync] saveDraft: успешно сохранено', { pluginId, pageKey, text });
      } catch (error) {
        console.error('[useLazyChatSync] Error saving draft:', error);
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
    console.log('[useLazyChatSync] loadDraft: загружаем draft', { pluginId, pageKey });
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
        setDraftText(response.draftText);
        console.log('[useLazyChatSync] loadDraft: найден draft', { pluginId, pageKey, draft: response.draftText });
      } else {
        setMessageState('');
        lastSavedText.current = '';
        setIsDraftSaved(false);
        setDraftText('');
        console.log('[useLazyChatSync] loadDraft: draft не найден', { pluginId, pageKey });
      }
    } catch (error) {
      console.error('[useLazyChatSync] Error loading draft:', error);
      setDraftError('Ошибка загрузки черновика');
    } finally {
      setIsDraftLoading(false);
    }
  }, [pluginId, pageKey]);

  // Функция для очистки черновика
  const clearDraft = useCallback(async () => {
    console.log('[useLazyChatSync] clearDraft: очищаем draft', { pluginId, pageKey });
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
      setDraftText('');
      setMessageState('');
      console.log('[useLazyChatSync] clearDraft: успешно очищено', { pluginId, pageKey });
    } catch (error) {
      console.error('[useLazyChatSync] Error clearing draft:', error);
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
        debounceRef.current = setTimeout(() => {
          saveDraft(text);
        }, debounceMs);
      }
      console.log('[useLazyChatSync] setMessage: новое значение', { pluginId, pageKey, text });
    },
    [debounceMs, saveDraft, clearDraft, pluginId, pageKey],
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

  // При смене pageKey всегда загружаем draft, не сбрасываем message вручную
  useEffect(() => {
    console.log('[useLazyChatSync] pageKey изменился:', pageKey);
    setIsDraftSaved(false);
    setIsDraftLoading(false);
    setDraftError(null);
    lastSavedText.current = '';
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    loadDraft();
  }, [pageKey, loadDraft]);

  return {
    message,
    setMessage,
    isDraftSaved,
    isDraftLoading,
    draftError,
    loadDraft,
    clearDraft,
    draftText,
  };
};
