import React, { useState, useEffect } from 'react';
import { usePluginSettings } from '../hooks/usePluginSettings';
import { AIKey } from '../hooks/useAIKeys';

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
  const { settings, updateBasicAnalysisSettings, updateDeepAnalysisSettings, getAPIKey } = usePluginSettings();
  const [selectedLLM, setSelectedLLM] = useState<string>(defaultLLMCurl);
  const [apiKey, setApiKey] = useState<string>('');

  // Загружаем текущие настройки при монтировании
  useEffect(() => {
    const currentSettings = promptType === 'basic_analysis'
      ? settings.basic_analysis[language]
      : settings.deep_analysis[language];

    // Логика: если сохранённое llm есть — использовать его; иначе — если hasDefaultLLM — "Default LLM"; иначе — ""
    const savedLLM = currentSettings.llm;
    let initialLLM = savedLLM;

    if (!savedLLM) {
      if (hasDefaultLLM) {
        initialLLM = 'default';
      } else {
        initialLLM = '';
      }
    }

    setSelectedLLM(initialLLM);
    setApiKey(getAPIKey());
  }, [promptType, language, settings, getAPIKey, hasDefaultLLM]);

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

    onLLMChange(newLLM, newLLM === 'default' ? apiKey : undefined);
  };

  // Сохраняем API ключ
  const handleApiKeyChange = async (newApiKey: string) => {
    setApiKey(newApiKey);
    await settings.saveSettings?.({
      ...settings,
      api_keys: { default: newApiKey },
    });
    onLLMChange(selectedLLM, newApiKey);
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
        placeholder="Выберите нейросеть"
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: 'white',
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
              backgroundColor: 'white',
              fontSize: '14px'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default LLMSelector;