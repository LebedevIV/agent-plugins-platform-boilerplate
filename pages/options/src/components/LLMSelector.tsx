import React, { useState, useEffect, useRef } from 'react';
import { usePluginSettings } from '../hooks/usePluginSettings';
import { AIKey } from '../hooks/useAIKeys';
import { APIKeyManager } from '../utils/encryption';

interface LLMSelectorProps {
  promptType: 'basic_analysis' | 'deep_analysis';
  language: 'ru' | 'en';
  globalAIKeys: AIKey[];
  defaultLLMCurl: string;
  hasDefaultLLM: boolean;
  onLLMChange: (llm: string, apiKey?: string) => void;
}

const LLMSelector: React.FC<LLMSelectorProps> = ({
  promptType,
  language,
  globalAIKeys,
  defaultLLMCurl,
  hasDefaultLLM,
  onLLMChange,
}) => {
  const { settings, updateBasicAnalysisSettings, updateDeepAnalysisSettings } = usePluginSettings();
  const [selectedLLM, setSelectedLLM] = useState<string>(defaultLLMCurl);
  const [apiKey, setApiKey] = useState<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Загружаем API-ключ при монтировании компонента
  useEffect(() => {
    const loadApiKey = async () => {
      const keyId = `ozon-analyzer-${promptType}-${language}`;
      const key = await APIKeyManager.getDecryptedKey(keyId) || '';
      setApiKey(key);
    };
    loadApiKey();
  }, [promptType, language]);

  // Загружаем LLM при изменении promptType/language
  useEffect(() => {
    const currentSettings = promptType === 'basic_analysis'
      ? settings.basic_analysis[language]
      : settings.deep_analysis[language];

    let initialLLM = '';

    if (currentSettings) {
      const savedLLM = currentSettings.llm;
      initialLLM = savedLLM || (hasDefaultLLM ? 'default' : '');
    } else {
      initialLLM = hasDefaultLLM ? 'default' : '';
    }

    setSelectedLLM(initialLLM);
  }, [promptType, language, settings, hasDefaultLLM]);

  // Сохраняем выбор LLM
  const handleLLMChange = async (newLLM: string) => {
    setSelectedLLM(newLLM);

    const updateFn = promptType === 'basic_analysis' ? updateBasicAnalysisSettings : updateDeepAnalysisSettings;
    await updateFn(language, {
      llm: newLLM,
      custom_prompt: promptType === 'basic_analysis'
        ? settings.basic_analysis[language].custom_prompt
        : settings.deep_analysis[language].custom_prompt,
    });

    // API-ключ передаем для всех LLM, включая кастомные
    onLLMChange(newLLM, apiKey || undefined);
  };

  // Сохраняем API ключ
  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const keyId = `ozon-analyzer-${promptType}-${language}`;
        await APIKeyManager.saveEncryptedKey(keyId, newApiKey);
        onLLMChange(selectedLLM, newApiKey);
      } catch (error) {
        console.error('Failed to save API key:', error);
      }
    }, 500);
  };

  // Получаем список опций для селекта
  const getLLMOptions = () => {
    const options = [
      { value: 'default', label: 'Default LLM' },
      ...globalAIKeys.map(key => ({
        value: key.id,
        label: key.name,
      })),
    ];
    return options;
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
        Выбор нейросети для {promptType === 'basic_analysis' ? 'базового' : 'глубокого'} анализа:
      </label>

      <select
        value={selectedLLM}
        onChange={(e) => handleLLMChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '14px',
          marginBottom: '8px'
        }}
      >
        {getLLMOptions().map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {selectedLLM === 'default' && (
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
            API ключ:
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="Введите API ключ"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default LLMSelector;