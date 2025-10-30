/**
 * Интеграция с MCP-серверами для безопасного использования API-ключей
 */

import { APIKeyManager } from './encryption';

export interface MCPServiceConfig {
  serviceName: string;
  requiredKeys: string[];
  baseUrl?: string;
  timeout?: number;
}

export interface MCPRequest {
  service: string;
  method: string;
  params?: Record<string, any>;
  keyId?: string; // ID ключа для использования
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  service: string;
  method: string;
}

/**
 * Сервис для работы с MCP-серверами
 */
export class MCPService {
  private static readonly DEFAULT_TIMEOUT = 30000;

  /**
   * Выполняет запрос к MCP-серверу с использованием безопасного API-ключа
   */
  static async executeRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      // Определяем, какой ключ использовать
      const keyId = request.keyId || this.getDefaultKeyForService(request.service);

      if (!keyId) {
        return {
          success: false,
          error: `Не найден API-ключ для сервиса ${request.service}`,
          service: request.service,
          method: request.method,
        };
      }

      // Проверяем, существует ли ключ
      const keyExists = await APIKeyManager.keyExists(keyId);
      if (!keyExists) {
        return {
          success: false,
          error: `API-ключ ${keyId} не настроен`,
          service: request.service,
          method: request.method,
        };
      }

      // Получаем расшифрованный ключ
      const apiKey = await APIKeyManager.getDecryptedKey(keyId);
      if (!apiKey) {
        return {
          success: false,
          error: `Не удалось получить API-ключ ${keyId}`,
          service: request.service,
          method: request.method,
        };
      }

      // Выполняем запрос к MCP-серверу
      const response = await this.makeMCPRequest(request, apiKey);

      return {
        success: true,
        data: response,
        service: request.service,
        method: request.method,
      };

    } catch (error) {
      console.error('MCP request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        service: request.service,
        method: request.method,
      };
    }
  }

  /**
   * Получает стандартный ключ для сервиса
   */
  private static getDefaultKeyForService(service: string): string | null {
    const serviceKeyMap: Record<string, string> = {
      'gemini-flash-lite': 'gemini-flash-lite',
      'gemini-pro': 'gemini-pro',
      'google-gemini': 'gemini-flash-lite',
      'anthropic': 'claude', // Для будущих реализаций
      'openai': 'gpt', // Для будущих реализаций
    };

    return serviceKeyMap[service] || null;
  }

  /**
   * Выполняет HTTP-запрос к MCP-серверу
   */
  private static async makeMCPRequest(request: MCPRequest, apiKey: string): Promise<any> {
    // Здесь должна быть логика для конкретных MCP-серверов
    // Пока возвращаем мок-ответ

    // Имитация задержки сети
    await new Promise(resolve => setTimeout(resolve, 1000));

    // В реальной реализации здесь будет:
    // 1. Определение URL MCP-сервера
    // 2. Формирование запроса с API-ключом
    // 3. Отправка HTTP-запроса
    // 4. Обработка ответа

    return {
      message: `Запрос к ${request.service}.${request.method} выполнен успешно`,
      timestamp: new Date().toISOString(),
      params: request.params,
    };
  }

  /**
   * Проверяет доступность сервиса
   */
  static async checkServiceAvailability(service: string): Promise<boolean> {
    try {
      const keyId = this.getDefaultKeyForService(service);
      if (!keyId) {
        return false;
      }

      return await APIKeyManager.keyExists(keyId);
    } catch (error) {
      console.error('Service availability check failed:', error);
      return false;
    }
  }

  /**
   * Получает список доступных сервисов
   */
  static async getAvailableServices(): Promise<string[]> {
    try {
      const keyIds = await APIKeyManager.getAllKeyIds();
      const services: string[] = [];

      for (const keyId of keyIds) {
        const decryptedKey = await APIKeyManager.getDecryptedKey(keyId);
        if (decryptedKey) {
          // Определяем сервис по ID ключа
          if (keyId.includes('gemini')) {
            services.push('google-gemini');
          } else if (keyId.includes('claude')) {
            services.push('anthropic');
          } else if (keyId.includes('gpt')) {
            services.push('openai');
          }
        }
      }

      return [...new Set(services)]; // Убираем дубликаты
    } catch (error) {
      console.error('Failed to get available services:', error);
      return [];
    }
  }
}

/**
 * Утилиты для работы с различными AI-сервисами через MCP
 */
export class AIServiceManager {
  /**
   * Выполняет запрос к Google Gemini через MCP
   */
  static async queryGemini(prompt: string, useFlash: boolean = true): Promise<MCPResponse> {
    const service = useFlash ? 'gemini-flash-lite' : 'gemini-pro';
    const keyId = useFlash ? 'gemini-flash-lite' : 'gemini-pro';

    return await MCPService.executeRequest({
      service,
      method: 'generateText',
      params: { prompt },
      keyId,
    });
  }

  /**
   * Выполняет запрос к Anthropic Claude через MCP
   */
  static async queryClaude(prompt: string, model: string = 'claude-3-sonnet'): Promise<MCPResponse> {
    return await MCPService.executeRequest({
      service: 'anthropic',
      method: 'generateText',
      params: { prompt, model },
      keyId: 'claude',
    });
  }

  /**
   * Выполняет запрос к OpenAI GPT через MCP
   */
  static async queryGPT(prompt: string, model: string = 'gpt-4'): Promise<MCPResponse> {
    return await MCPService.executeRequest({
      service: 'openai',
      method: 'generateText',
      params: { prompt, model },
      keyId: 'gpt',
    });
  }

  /**
   * Проверяет доступность всех AI-сервисов
   */
  static async getAvailableAIModels(): Promise<string[]> {
    const services = await MCPService.getAvailableServices();
    const models: string[] = [];

    if (services.includes('google-gemini')) {
      models.push('gemini-pro', 'gemini-flash-lite');
    }
    if (services.includes('anthropic')) {
      models.push('claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku');
    }
    if (services.includes('openai')) {
      models.push('gpt-4', 'gpt-3.5-turbo');
    }

    return models;
  }
}