import * as React from 'react';
import { useTranslations } from './useTranslations';
import { APIKeyManager } from '../utils/encryption';

export interface AIKey {
  id: string;
  name: string;
  key: string;
  status: 'configured' | 'not_configured' | 'testing';
  isFixed?: boolean;
  isFree?: boolean;
}

export const useAIKeys = () => {
  const { t } = useTranslations('ru');
  const [aiKeys, setAiKeys] = React.useState<AIKey[]>([
    {
      id: 'gemini-flash',
      name: 'Google Gemini (Flash) - Базовый анализ',
      key: '',
      status: 'not_configured',
      isFixed: true,
      isFree: true,
    },
    {
      id: 'gemini-pro',
      name: 'Gemini 2.5 Pro - Глубокий анализ',
      key: '',
      status: 'not_configured',
      isFixed: true,
      isFree: true,
    },
  ]);
  const [customKeys, setCustomKeys] = React.useState<AIKey[]>([]);

  // Рефы для отложенного сохранения ключей
  const saveTimeoutsRef = React.useRef<Record<string, NodeJS.Timeout>>({});

  // Load AI keys on mount and cleanup timeouts on unmount
  React.useEffect(() => {
    loadAIKeys();

    // Cleanup function
    return () => {
      // Очищаем все активные таймауты
      Object.values(saveTimeoutsRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      saveTimeoutsRef.current = {};
    };
  }, []);

  const loadAIKeys = async () => {
    try {
      console.log('[useAIKeys] Starting to load AI keys...');

      // Загружаем зашифрованные ключи
      const fixedKeyIds = ['gemini-flash', 'gemini-pro'];
      const fixedKeysPromises = fixedKeyIds.map(async (keyId) => {
        const decryptedKey = await APIKeyManager.getDecryptedKey(keyId);
        console.log(`[useAIKeys] Loaded key ${keyId}:`, decryptedKey ? 'present' : 'empty');
        return { keyId, decryptedKey };
      });

      const fixedKeysResults = await Promise.all(fixedKeysPromises);
      console.log('[useAIKeys] Fixed keys results:', fixedKeysResults);

      setAiKeys(prev =>
        prev.map(key => {
          const result = fixedKeysResults.find(r => r.keyId === key.id);
          console.log(`[useAIKeys] Setting key ${key.id}:`, result?.decryptedKey ? 'configured' : 'not_configured');
          return {
            ...key,
            key: result?.decryptedKey || '',
            status: (result?.decryptedKey ? 'configured' : 'not_configured') as AIKey['status'],
          };
        }),
      );

      // Загружаем пользовательские ключи (метаданные)
      const result = await chrome.storage.local.get(['customKeys']);
      console.log('[useAIKeys] Custom keys metadata:', result.customKeys);
      if (result.customKeys) {
        // Для пользовательских ключей также используем шифрование
        const customKeysWithDecryption = await Promise.all(
          (result.customKeys as AIKey[]).map(async (key: AIKey) => {
            const decryptedKey = await APIKeyManager.getDecryptedKey(key.id);
            console.log(`[useAIKeys] Custom key ${key.id}:`, decryptedKey ? 'present' : 'empty');
            return {
              ...key,
              key: decryptedKey || '',
              status: (decryptedKey ? 'configured' : 'not_configured') as AIKey['status']
            };
          })
        );
        console.log('[useAIKeys] Setting custom keys:', customKeysWithDecryption);
        setCustomKeys(customKeysWithDecryption);
      } else {
        console.log('[useAIKeys] No custom keys found');
        setCustomKeys([]);
      }

      console.log('[useAIKeys] AI keys loaded successfully');
    } catch (error) {
      console.error('Failed to load AI keys:', error);
      // В случае ошибки шифрования показываем пустые ключи
      setAiKeys(prev =>
        prev.map(key => ({
          ...key,
          key: '',
          status: 'not_configured' as AIKey['status'],
        })),
      );
      setCustomKeys([]);
    }
  };

  const saveAIKeys = async () => {
    try {
      console.log('[useAIKeys] Starting to save AI keys...');
      console.log('[useAIKeys] Current aiKeys:', aiKeys);
      console.log('[useAIKeys] Current customKeys:', customKeys);

      // Сохраняем фиксированные ключи с шифрованием
      const saveFixedKeysPromises = aiKeys.map(async (key) => {
        if (key.key) {
          console.log(`[useAIKeys] Saving fixed key ${key.id}`);
          await APIKeyManager.saveEncryptedKey(key.id, key.key);
        } else {
          console.log(`[useAIKeys] Removing fixed key ${key.id}`);
          await APIKeyManager.removeKey(key.id);
        }
      });

      await Promise.all(saveFixedKeysPromises);

      // Сохраняем пользовательские ключи с шифрованием
      const saveCustomKeysPromises = customKeys.map(async (key) => {
        if (key.key) {
          console.log(`[useAIKeys] Saving custom key ${key.id}`);
          await APIKeyManager.saveEncryptedKey(key.id, key.key);
        } else {
          console.log(`[useAIKeys] Removing custom key ${key.id}`);
          await APIKeyManager.removeKey(key.id);
        }
      });

      await Promise.all(saveCustomKeysPromises);

      // Сохраняем метаданные пользовательских ключей (без самих ключей)
      const customKeysMetadata = customKeys.map(key => ({
        id: key.id,
        name: key.name,
        isFixed: false,
        isFree: false,
        // key и status не сохраняем в метаданных для безопасности
      }));

      console.log('[useAIKeys] Saving custom keys metadata:', customKeysMetadata);
      await chrome.storage.local.set({
        customKeys: customKeysMetadata,
      });

      // Обновляем статусы в состоянии
      setAiKeys(prev =>
        prev.map(key => ({
          ...key,
          status: (key.key ? 'configured' : 'not_configured') as AIKey['status'],
        })),
      );

      setCustomKeys(prev =>
        prev.map(key => ({
          ...key,
          status: (key.key ? 'configured' : 'not_configured') as AIKey['status']
        }))
      );

      console.log('[useAIKeys] AI keys saved successfully');
      alert(t('options.settings.aiKeys.messages.saved'));
    } catch (error) {
      console.error('Failed to save AI keys:', error);
      alert(t('options.settings.aiKeys.messages.saveError'));
    }
  };

  const testAIKeys = async () => {
    // Set testing status
    setAiKeys(prev =>
      prev.map(key => ({
        ...key,
        status: 'testing' as const,
      })),
    );

    setCustomKeys(prev =>
      prev.map(key => ({
        ...key,
        status: 'testing' as const,
      })),
    );

    // Simulate API testing with timeout
    setTimeout(() => {
      setAiKeys(prev =>
        prev.map(key => ({
          ...key,
          status: key.key ? 'configured' : 'not_configured',
        })),
      );

      setCustomKeys(prev =>
        prev.map(key => ({
          ...key,
          status: key.key ? 'configured' : 'not_configured',
        })),
      );

      alert(t('options.settings.aiKeys.messages.testComplete'));
    }, 2000);
  };

  const addCustomKey = () => {
    const newKey: AIKey = {
      id: `custom-${Date.now()}`,
      name: `Пользовательский ключ ${customKeys.length + 1}`,
      key: '',
      status: 'not_configured' as const,
    };
    setCustomKeys(prev => [...prev, newKey]);
  };

  const removeCustomKey = async (id: string) => {
    try {
      // Удаляем зашифрованный ключ
      await APIKeyManager.removeKey(id);

      // Удаляем из состояния
      setCustomKeys(prev => prev.filter(key => key.id !== id));
    } catch (error) {
      console.error('Failed to remove custom key:', error);
      // Даже если удаление зашифрованного ключа не удалось, удаляем из состояния
      setCustomKeys(prev => prev.filter(key => key.id !== id));
    }
  };

  const updateKey = (id: string, value: string, isCustom = false) => {
    console.log(`[useAIKeys] Updating key ${id} with value:`, value ? 'present' : 'empty');

    // Обновляем состояние немедленно для лучшего UX
    if (isCustom) {
      setCustomKeys(prev => prev.map(key => (key.id === id ? {
        ...key,
        key: value,
        status: value ? 'configured' : 'not_configured'
      } : key)));
    } else {
      setAiKeys(prev => prev.map(key => (key.id === id ? {
        ...key,
        key: value,
        status: value ? 'configured' : 'not_configured'
      } : key)));
    }

    // Отменяем предыдущий таймаут для этого ключа
    if (saveTimeoutsRef.current[id]) {
      clearTimeout(saveTimeoutsRef.current[id]);
    }

    // Устанавливаем новый таймаут для отложенного сохранения
    saveTimeoutsRef.current[id] = setTimeout(async () => {
      try {
        console.log(`[useAIKeys] Auto-saving key ${id} after delay`);
        if (value) {
          await APIKeyManager.saveEncryptedKey(id, value);
        } else {
          await APIKeyManager.removeKey(id);
        }

        // Для пользовательских ключей также обновляем метаданные
        if (isCustom) {
          const result = await chrome.storage.local.get(['customKeys']);
          const customKeysMetadata = result.customKeys || [];
          const updatedMetadata = customKeysMetadata.map((key: any) =>
            key.id === id ? { ...key, name: key.name } : key
          );

          // Если ключ не существует в метаданных, добавляем его
          const existingKeyIndex = updatedMetadata.findIndex((key: any) => key.id === id);
          if (existingKeyIndex === -1 && value) {
            updatedMetadata.push({
              id,
              name: `Пользовательский ключ ${customKeysMetadata.length + 1}`,
              isFixed: false,
              isFree: false,
            });
          }

          await chrome.storage.local.set({
            customKeys: updatedMetadata.filter((key: any) => {
              // Убираем из метаданных ключи, которые были удалены
              return value || key.id !== id;
            }),
          });
        }

        console.log(`[useAIKeys] Key ${id} auto-saved successfully`);
      } catch (error) {
        console.error(`[useAIKeys] Failed to auto-save key ${id}:`, error);
      } finally {
        // Убираем таймаут из рефа
        delete saveTimeoutsRef.current[id];
      }
    }, 1000); // 1 секунда задержки перед сохранением
  };

  const updateCustomKeyName = (id: string, name: string) => {
    setCustomKeys(prev => prev.map(key => (key.id === id ? {
      ...key,
      name,
      status: key.key ? 'configured' : 'not_configured'
    } : key)));
  };

  // Функция для получения текста статуса с поддержкой локализации
  const getStatusText = (status: string) => {
    switch (status) {
      case 'configured':
        return t('options.settings.aiKeys.status.configured');
      case 'not_configured':
        return t('options.settings.aiKeys.status.notConfigured');
      case 'testing':
        return t('options.settings.aiKeys.status.testing');
      default:
        return t('options.settings.aiKeys.status.notConfigured');
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'configured':
        return 'status-configured';
      case 'not_configured':
        return 'status-not-configured';
      case 'testing':
        return 'status-testing';
      default:
        return '';
    }
  };

  // Функция для получения API ключа для использования в MCP-серверах
  const getAPIKeyForMCP = async (keyId: string): Promise<string | null> => {
    try {
      return await APIKeyManager.getDecryptedKey(keyId);
    } catch (error) {
      console.error('Failed to get API key for MCP:', error);
      return null;
    }
  };

  // Функция для проверки, настроен ли определенный ключ
  const isKeyConfigured = async (keyId: string): Promise<boolean> => {
    try {
      return await APIKeyManager.keyExists(keyId);
    } catch (error) {
      console.error('Failed to check if key is configured:', error);
      return false;
    }
  };

  return {
    aiKeys,
    customKeys,
    saveAIKeys,
    testAIKeys,
    addCustomKey,
    removeCustomKey,
    updateKey,
    updateCustomKeyName,
    getStatusText,
    getStatusClass,
    getAPIKeyForMCP,
    isKeyConfigured,
  };
};
