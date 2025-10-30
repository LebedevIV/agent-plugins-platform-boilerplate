/**
 * AI API Client for Agent-Plugins-Platform
 * Handles communication with various AI providers (OpenAI, Google Gemini, etc.)
 * Интегрирована система мониторинга для отслеживания лимитов, сбоев и fallback
 */

import type { getMonitoringCore } from './monitoring/index';
import { LogLevel } from './monitoring/monitoring-core';
import { APIKeyManager } from '../../../pages/options/src/utils/encryption';

export interface AiModelResponse {
  response: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  metadata?: {
    provider: string;
    responseTime?: number;
    retryCount?: number;
    fallbackUsed?: boolean;
    rateLimited?: boolean;
  };
}

// Доступные модели
export type ModelAlias = 'gemini-flash-lite' | 'gemini-pro' | 'gpt-3.5-turbo' | 'gpt-4';

// Конфигурация модели
interface ModelConfig {
  provider: string;
  model_name: string;
  endpoint: string;
  api_key_env: string;
}

// Интерфейсы для мониторинга AI
interface AiRequestStats {
  model: ModelAlias;
  provider: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  responseTime?: number;
  tokensUsed?: number;
  error?: string;
  retryCount: number;
  rateLimited: boolean;
  fallbackAttempted: boolean;
}

// Система мониторинга (инициализируется lazy)
let monitoringCore: ReturnType<typeof getMonitoringCore> | null = null;

// Статистика AI API для мониторинга
const aiStats = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  rateLimitedRequests: 0,
  fallbackRequests: 0,
  providerStats: new Map<string, {
    requests: number;
    failures: number;
    avgResponseTime: number;
    totalTokens: number;
  }>(),
  modelUsage: new Map<ModelAlias, {
    requests: number;
    tokensUsed: number;
    lastUsed: number;
  }>()
};

// Инициализация системы мониторинга
function initializeAiMonitoring(): void {
  if (!monitoringCore) {
    try {
      // Попытка импортировать систему мониторинга
      import('./monitoring/index').then(module => {
        monitoringCore = module.initializeMonitoring({
          sampleRate: 0.9, // высокая сэмплировка для AI API
          enableErrorCapture: true
        });

        if (monitoringCore) {
          console.log('[AI Client] Monitoring system initialized');
        }
      }).catch((err: any) => {
        console.warn('[AI Client] Cannot load monitoring system:', err?.message || String(err));
      });
    } catch (error: any) {
      console.warn('[AI Client] Cannot initialize monitoring:', error?.message || String(error));
    }
  }
}

/**
 * Обновление статистики AI API вызовов
 */
function updateAiStats(stats: AiRequestStats): void {
  aiStats.totalRequests++;

  // Обновление статуса провайдера
  const providerStats = aiStats.providerStats.get(stats.provider) || {
    requests: 0,
    failures: 0,
    avgResponseTime: 0,
    totalTokens: 0
  };

  providerStats.requests++;
  if (!stats.success) providerStats.failures++;
  if (stats.responseTime) {
    providerStats.avgResponseTime = (providerStats.avgResponseTime + stats.responseTime) / 2;
  }
  if (stats.tokensUsed) {
    providerStats.totalTokens += stats.tokensUsed;
  }

  aiStats.providerStats.set(stats.provider, providerStats);

  // Обновление статистики модели
  const modelStats = aiStats.modelUsage.get(stats.model) || {
    requests: 0,
    tokensUsed: 0,
    lastUsed: 0
  };

  modelStats.requests++;
  if (stats.tokensUsed) {
    modelStats.tokensUsed += stats.tokensUsed;
  }
  modelStats.lastUsed = Date.now();

  aiStats.modelUsage.set(stats.model, modelStats);

  // Обновление общих счетчиков
  if (stats.success) {
    aiStats.successRequests++;
  } else {
    aiStats.failedRequests++;
  }

  if (stats.rateLimited) {
    aiStats.rateLimitedRequests++;
  }

  if (stats.fallbackAttempted) {
    aiStats.fallbackRequests++;
  }

  // Регистрация в мониторинговой системе
  if (monitoringCore) {
    monitoringCore.getMetricsCollector().incrementCounter('ai_api_calls_total', {
      model: stats.model,
      provider: stats.provider,
      success: stats.success ? 'true' : 'false',
      rate_limited: stats.rateLimited ? 'true' : 'false',
      fallback_attempted: stats.fallbackAttempted ? 'true' : 'false'
    });

    if (stats.responseTime) {
      monitoringCore.getMetricsCollector().recordHistogram(
        'ai_api_response_time_seconds',
        stats.responseTime / 1000,
        {
          model: stats.model,
          provider: stats.provider
        }
      );
    }

    if (stats.tokensUsed) {
      monitoringCore.getMetricsCollector().incrementCounter('ai_tokens_used_total', {
        model: stats.model,
        provider: stats.provider
      }, stats.tokensUsed);
    }

    // Проверка алертов для AI API
    checkAiAlerts(stats);
  }
}

/**
 * Проверка алертов для AI API
 */
function checkAiAlerts(stats: AiRequestStats): void {
  if (!monitoringCore) return;

  // Алерт при высоком количестве неудачных запросов
  const failureRate = aiStats.failedRequests / aiStats.totalRequests;
  if (failureRate > 0.3 && aiStats.failedRequests > 5) { // >30% сбоев и минимум 5 неудач
    monitoringCore.captureError('ai_api_high_failure_rate', new Error(`AI API failure rate: ${(failureRate * 100).toFixed(1)}%`), {
      component: 'ai_client',
      totalRequests: aiStats.totalRequests,
      failedRequests: aiStats.failedRequests,
      lastModel: stats.model
    });
  }

  // Алерт при превышении лимита скорости
  if (stats.rateLimited) {
    monitoringCore.getLogger().warn('ai_client', 'AI API rate limit exceeded', {
      model: stats.model,
      provider: stats.provider
    });
  }

  // Алерт при частом использовании fallback
  const fallbackRate = aiStats.fallbackRequests / aiStats.totalRequests;
  if (fallbackRate > 0.5 && aiStats.fallbackRequests > 3) { // >50% fallback и минимум 3 раза
    monitoringCore.getLogger().warn('ai_client', 'High fallback usage detected', {
      fallbackRate: `${(fallbackRate * 100).toFixed(1)}%`,
      totalFallbacks: aiStats.fallbackRequests
    });
  }
}

/**
 * Функция для обработки ошибок AI API с логированием
 */
function handleAiError(error: any, context: any): never {
  const errorStats: AiRequestStats = {
    model: context.model || 'unknown',
    provider: context.provider || 'unknown',
    startTime: context.startTime || Date.now(),
    endTime: Date.now(),
    success: false,
    retryCount: context.retryCount || 0,
    rateLimited: false,
    fallbackAttempted: context.fallbackAttempted || false
  };

  // Определение типа ошибки
  if (error.message?.includes('rate limit') || error.status === 429) {
    errorStats.rateLimited = true;
  }

  updateAiStats(errorStats);

  if (monitoringCore) {
    monitoringCore.captureError('ai_api_request_failed', error, context);
  }

  throw error;
}

// Поддерживаемые модели и их конфигурации с типизированными индексами
const MODEL_CONFIGS: Record<ModelAlias, ModelConfig> = {
  'gemini-flash-lite': {
    provider: 'google',
    //model_name: 'gemini-2.5-flash-lite:generateContent',
    model_name: 'gemini-flash-lite-latest:generateContent',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
    api_key_env: 'GOOGLE_AI_API_KEY'
  },
  'gemini-pro': {
    provider: 'google',
    model_name: 'gemini-2.5-pro:generateContent',
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

    // Получаем API ключ через систему шифрования APIKeyManager
    return await APIKeyManager.getDecryptedKey(modelAlias);
  } catch (error) {
    console.error('[AI Client] Error getting API key:', error);
    return null;
  }
}

/**
 * Универсальный selector: выдаёт правильный API-ключ для генерации — либо custom (по combo типа/promt/lang), либо платформенный.
 */
export async function getApiKeyForPromptOrModel(options: { isDefaultLLM: boolean, promptType: string, language: string, pluginId: string, modelAlias: string }): Promise<string|null> {
  if (options.isDefaultLLM) {
    // Кастомный плагиновый ключ для конкретной комбинации
    const keyId = `${options.pluginId}-${options.promptType}-${options.language}`;
    return await APIKeyManager.getDecryptedKey(keyId);
  } else {
    // Платформенный ключ
    return await APIKeyManager.getDecryptedKey(options.modelAlias);
  }
}

// --- Инструкция для разработчиков:
// Для плагиновых промптов типа OzonAnalyzer всегда используйте getApiKeyForPromptOrModel для правильного выбора ключа.
// Никогда не вызывайте getApiKeyForModel напрямую для cases типа 'default LLM'.

/**
 * Выполняет запрос к AI API в зависимости от провайдера с полным мониторингом
 */
export async function callAiModel(modelAlias: string, apiKey: string, prompt: string): Promise<string> {
  // Инициализация мониторинга при первом вызове
  if (!monitoringCore) {
    initializeAiMonitoring();
  }

  const startTime = performance.now();
  const stats: AiRequestStats = {
    model: modelAlias as ModelAlias,
    provider: '',
    startTime,
    retryCount: 0,
    rateLimited: false,
    fallbackAttempted: false,
    success: false
  };

  try {
    // Проверяем, является ли modelAlias допустимым ключом MODEL_CONFIGS
    if (!Object.keys(MODEL_CONFIGS).includes(modelAlias)) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }
    const config = MODEL_CONFIGS[modelAlias as ModelAlias];
    if (!config) {
      throw new Error(`Неизвестная модель: ${modelAlias}`);
    }

    stats.provider = config.provider;

    // Логирование начала запроса
    if (monitoringCore) {
      monitoringCore.addLog('ai_client', LogLevel.INFO, `Starting AI API call`, {
        model: modelAlias,
        provider: config.provider,
        promptLength: prompt.length
      });
    }

    let result: string;

    switch (config.provider) {
      case 'google':
        result = await callGoogleGemini(config, apiKey, prompt);
        break;
      case 'openai':
        result = await callOpenAI(config, apiKey, prompt);
        break;
      default:
        throw new Error(`Неподдерживаемый провайдер: ${config.provider}`);
    }

    // Успешное завершение
    stats.endTime = performance.now();
    stats.responseTime = stats.endTime - stats.startTime;
    stats.success = true;

    // Извлечение информации о токенах (если доступно)
    try {
      // Google Gemini возвращает usage информацию в ответе
      if (config.provider === 'google' && stats.tokensUsed === undefined) {
        // Простая эстимация токенов (1 токен ≈ 4 символа)
        stats.tokensUsed = Math.ceil((prompt.length + result.length) / 4);
      }
    } catch (e) {
      // Игнорируем ошибки при подсчете токенов
      stats.tokensUsed = 0;
    }

    // Обновление статистики
    updateAiStats(stats);

    return result;

  } catch (error: any) {
    // Обработка ошибки
    stats.endTime = performance.now();
    stats.responseTime = stats.endTime - stats.startTime;
    stats.success = false;
    stats.error = error.message;

    // Проверка на rate limit
    if (error.message?.includes('rate limit') ||
        error.message?.includes('quota') ||
        error.status === 429) {
      stats.rateLimited = true;
    }

    // Обновление статистики
    updateAiStats(stats);

    console.error('[AI Client] Error calling AI model:', error);
    throw new Error(`Ошибка при вызове модели ${modelAlias}: ${error.message}`);
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

    // Сохраняем API ключ через систему шифрования APIKeyManager
    await APIKeyManager.saveEncryptedKey(modelAlias, apiKey);

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

/**
 * Получает выбранную LLM для промпта с учетом типа промпта и языка
 * @param prompt_type - тип промпта (basic_analysis, deep_analysis, etc.)
 * @param language - язык промпта (ru, en)
 * @param pluginId - ID плагина для получения специфичных настроек
 * @returns объект с моделью и API-ключом
 */
export async function getLLMForPrompt(
  prompt_type: string,
  language: string,
  pluginId?: string
): Promise<{ model: ModelAlias; apiKey: string; prompt: string }> {
  try {
    // Формируем ключ для localStorage: pluginId:prompt_type:language или просто prompt_type:language
    const storageKey = pluginId ? `${pluginId}:${prompt_type}:${language}` : `${prompt_type}:${language}`;

    // Пытаемся получить выбранную модель из localStorage
    let selectedModel = localStorage.getItem(storageKey) as ModelAlias | null;

    // Если модель не найдена в localStorage, используем дефолт из manifest
    if (!selectedModel) {
      // Для получения дефолтной модели нужно загрузить manifest плагина
      const manifestData = await loadPluginManifest(pluginId);
      selectedModel = manifestData?.ai_models?.[prompt_type] as ModelAlias;

      if (!selectedModel) {
        throw new Error(`Не найдена модель по умолчанию для промпта ${prompt_type}`);
      }
    }

    // Проверяем, что модель поддерживается
    if (!Object.keys(MODEL_CONFIGS).includes(selectedModel)) {
      throw new Error(`Неподдерживаемая модель: ${selectedModel}`);
    }

    // Получаем API-ключ (глобальный или плагин-специфичный)
    const apiKey = await getApiKeyForModel(selectedModel);
    if (!apiKey) {
      throw new Error(`API-ключ для модели ${selectedModel} не найден`);
    }

    // Получаем промпт из manifest с подстановкой $prompt_{type}_{language}
    const manifestData = await loadPluginManifest(pluginId);
    const promptKey = `$prompt_${prompt_type}_${language}`;
    let prompt = manifestData?.options?.prompts?.[prompt_type]?.[language]?.default;

    if (!prompt) {
      throw new Error(`Промпт ${promptKey} не найден в manifest`);
    }

    return {
      model: selectedModel,
      apiKey,
      prompt
    };

  } catch (error) {
    console.error('[AI Client] Error getting LLM for prompt:', error);
    throw error;
  }
}

/**
 * Загружает manifest плагина
 */
async function loadPluginManifest(pluginId?: string): Promise<any> {
  if (!pluginId) {
    // Если pluginId не указан, пытаемся найти manifest в chrome-extension/public/plugins/
    // Для упрощения возвращаем дефолтные значения или null
    return null;
  }

  try {
    // Путь к manifest плагина
    const manifestPath = `plugins/${pluginId}/manifest.json`;

    // В контексте расширения manifest может быть загружен через chrome.runtime.getURL
    const manifestUrl = chrome.runtime.getURL(manifestPath);
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      throw new Error(`Не удалось загрузить manifest: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[AI Client] Error loading plugin manifest:', error);
    return null;
  }
}