/**
 * AI API Client for Agent-Plugins-Platform
 * Handles communication with various AI providers (OpenAI, Google Gemini, etc.)
 */

export interface AiModelResponse {
  response: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

// Доступные модели
export type ModelAlias = 'gemini-flash' | 'gemini-pro' | 'gemini-25' | 'gpt-3.5-turbo' | 'gpt-4';

// Конфигурация модели
interface ModelConfig {
  provider: string;
  model_name: string;
  endpoint: string;
  api_key_env: string;
}

// Поддерживаемые модели и их конфигурации с типизированными индексами
const MODEL_CONFIGS: Record<ModelAlias, ModelConfig> = {
  'gemini-flash': {
    provider: 'google',
    model_name: 'gemini-1.5-flash-latest',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
    api_key_env: 'GOOGLE_AI_API_KEY'
  },
  'gemini-pro': {
    provider: 'google',
    model_name: 'gemini-1.5-pro-latest',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
    api_key_env: 'GOOGLE_AI_API_KEY'
  },
  'gemini-25': {
    provider: 'google',
    model_name: 'gemini-1.5-flash-8b-latest',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
    api_key_env: 'GOOGLE_AI_API_KEY'
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    model_name: 'gpt-3.5-turbo',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    api_key_env: 'OPENAI_API_KEY'
  },
  'gpt-4': {
    provider: 'openai',
    model_name: 'gpt-4',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    api_key_env: 'OPENAI_API_KEY'
  }
};

/**
 * Получает API ключ для указанной модели из хранилища расширения
 */
export async function getApiKeyForModel(modelAlias: string): Promise<string | null> {
  try {
    // Проверяем, является ли modelAlias допустимым ключом MODEL_CONFIGS
    if (!Object.keys(MODEL_CONFIGS).includes(modelAlias)) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }
    const config = MODEL_CONFIGS[modelAlias as ModelAlias];
    if (!config) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }

    // В будущем здесь можно добавить логику получения API ключей из безопасного хранилища
    // Пока используем переменные окружения или настройки расширения
    const apiKeyName = config.api_key_env;

    // Пробуем получить из chrome.storage (local)
    const storageResult = await chrome.storage.local.get([apiKeyName]);
    if (storageResult[apiKeyName]) {
      return storageResult[apiKeyName];
    }

    // Запасной вариант - проверяем переменные окружения (хотя в расширениях они ограничены)
    // Это больше для разработки и тестирования
    const envApiKey = process.env[apiKeyName];
    if (envApiKey) {
      return envApiKey;
    }

    console.warn(`[AI Client] API key not found for model ${modelAlias} (${apiKeyName})`);
    return null;
  } catch (error) {
    console.error('[AI Client] Error getting API key:', error);
    return null;
  }
}

/**
 * Выполняет запрос к AI API в зависимости от провайдера
 */
export async function callAiModel(modelAlias: string, apiKey: string, prompt: string): Promise<string> {
  try {
    // Проверяем, является ли modelAlias допустимым ключом MODEL_CONFIGS
    if (!Object.keys(MODEL_CONFIGS).includes(modelAlias)) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }
    const config = MODEL_CONFIGS[modelAlias as ModelAlias];
    if (!config) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }

    switch (config.provider) {
      case 'google':
        return await callGoogleGemini(config, apiKey, prompt);
      case 'openai':
        return await callOpenAI(config, apiKey, prompt);
      default:
        throw new Error(`Неподдерживаемый провайдер: ${config.provider}`);
    }
  } catch (error) {
    console.error('[AI Client] Error calling AI model:', error);
    throw new Error(`Ошибка при вызове модели ${modelAlias}: ${(error as Error).message}`);
  }
}

/**
 * Выполняет запрос к Google Gemini API
 */
async function callGoogleGemini(config: any, apiKey: string, prompt: string): Promise<string> {
  const url = `${config.endpoint}${config.model_name}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Неверный формат ответа от Google Gemini API');
  }

  const generatedText = data.candidates[0].content.parts[0].text;
  return generatedText || 'Нет ответа от модели';
}

/**
 * Выполняет запрос к OpenAI API
 */
async function callOpenAI(config: any, apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model_name,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Неверный формат ответа от OpenAI API');
  }

  return data.choices[0].message.content || 'Нет ответа от модели';
}

/**
 * Устанавливает API ключ для модели
 */
export async function setApiKeyForModel(modelAlias: string, apiKey: string): Promise<void> {
  try {
    // Проверяем, является ли modelAlias допустимым ключом MODEL_CONFIGS
    if (!Object.keys(MODEL_CONFIGS).includes(modelAlias)) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }
    const config = MODEL_CONFIGS[modelAlias as ModelAlias];
    if (!config) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }

    const apiKeyName = config.api_key_env;
    await chrome.storage.local.set({ [apiKeyName]: apiKey });

    console.log(`[AI Client] API key set for model ${modelAlias}`);
  } catch (error) {
    console.error('[AI Client] Error setting API key:', error);
    throw error;
  }
}

/**
 * Проверяет доступность API ключа для модели
 */
export async function checkApiKeyAvailability(modelAlias: string): Promise<boolean> {
  const apiKey = await getApiKeyForModel(modelAlias);
  return apiKey !== null && apiKey.length > 0;
}