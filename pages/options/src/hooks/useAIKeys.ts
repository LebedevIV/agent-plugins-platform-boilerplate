import * as React from 'react';

export interface AIKey {
  id: string;
  name: string;
  key: string;
  status: 'configured' | 'not_configured' | 'testing';
  isFixed?: boolean;
  isFree?: boolean;
}

export const useAIKeys = () => {
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
      id: 'gemini-25',
      name: 'Gemini 2.5 Pro - Глубокий анализ',
      key: '',
      status: 'not_configured',
      isFixed: true,
      isFree: true,
    },
  ]);
  const [customKeys, setCustomKeys] = React.useState<AIKey[]>([]);

  // Load AI keys on mount
  React.useEffect(() => {
    loadAIKeys();
  }, []);

  const loadAIKeys = async () => {
    try {
      const result = await chrome.storage.local.get(['aiKeys', 'customKeys']);
      if (result.aiKeys) {
        setAiKeys(prev =>
          prev.map(key => ({
            ...key,
            key: result.aiKeys[key.id] || '',
            status: result.aiKeys[key.id] ? 'configured' : 'not_configured',
          })),
        );
      }
      if (result.customKeys) {
        setCustomKeys(result.customKeys);
      }
    } catch (error) {
      console.error('Failed to load AI keys:', error);
    }
  };

  const saveAIKeys = async () => {
    try {
      const keysToSave: Record<string, string> = {};
      aiKeys.forEach(key => {
        if (key.key) {
          keysToSave[key.id] = key.key;
        }
      });

      await chrome.storage.local.set({
        aiKeys: keysToSave,
        customKeys: customKeys,
      });

      // Update status
      setAiKeys(prev =>
        prev.map(key => ({
          ...key,
          status: key.key ? 'configured' : 'not_configured',
        })),
      );

      alert('Настройки сохранены!');
    } catch (error) {
      console.error('Failed to save AI keys:', error);
      alert('Ошибка при сохранении настроек');
    }
  };

  const testAIKeys = async () => {
    // Simulate testing
    setAiKeys(prev =>
      prev.map(key => ({
        ...key,
        status: 'testing',
      })),
    );

    setTimeout(() => {
      setAiKeys(prev =>
        prev.map(key => ({
          ...key,
          status: key.key ? 'configured' : 'not_configured',
        })),
      );
      alert('Тестирование завершено!');
    }, 2000);
  };

  const addCustomKey = () => {
    const newKey: AIKey = {
      id: `custom-${Date.now()}`,
      name: `Пользовательский ключ ${customKeys.length + 1}`,
      key: '',
      status: 'not_configured',
    };
    setCustomKeys(prev => [...prev, newKey]);
  };

  const removeCustomKey = (id: string) => {
    setCustomKeys(prev => prev.filter(key => key.id !== id));
  };

  const updateKey = (id: string, value: string, isCustom = false) => {
    if (isCustom) {
      setCustomKeys(prev => prev.map(key => (key.id === id ? { ...key, key: value } : key)));
    } else {
      setAiKeys(prev => prev.map(key => (key.id === id ? { ...key, key: value } : key)));
    }
  };

  const updateCustomKeyName = (id: string, name: string) => {
    setCustomKeys(prev => prev.map(key => (key.id === id ? { ...key, name } : key)));
  };

  const getStatusText = (status: string, t?: (key: string) => string) => {
    if (t) {
      switch (status) {
        case 'configured':
          return t('options.settings.aiKeys.status.configured');
        case 'not_configured':
          return t('options.settings.aiKeys.status.notConfigured');
        case 'testing':
          return t('options.settings.aiKeys.status.testing');
        default:
          return 'Unknown';
      }
    }

    // Fallback to hardcoded Russian text
    switch (status) {
      case 'configured':
        return 'Настроен';
      case 'not_configured':
        return 'Не настроен';
      case 'testing':
        return 'Тестирование...';
      default:
        return 'Неизвестно';
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
  };
};
