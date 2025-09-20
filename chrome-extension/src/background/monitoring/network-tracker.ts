/**
 * Network Request Tracker - Отслеживание сетевых запросов и их метрик
 *
 * Мониторит HTTP запросы, их время выполнения, статусы ответов и ошибки
 */

import type { MonitoringConfig } from './monitoring-core.js';
import type { MonitoringLogger } from './logger.js';
import type { MetricsCollector } from './metrics-collector.js';

export interface NetworkRequest {
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  success: boolean;
  requestSize?: number;
  responseSize?: number;
  contentType?: string;
  component: string;
  error?: Error;
  requestId: string;
  labels: Record<string, string>;
}

export interface NetworkStats {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  requestsByStatus: Record<number, number>;
  slowestRequests: Array<{
    url: string;
    method: string;
    duration: number;
    statusCode: number;
  }>;
  requestsByDomain: Record<string, number>;
  errorPatterns: Record<string, number>;
}

export class NetworkTracker {
  private config: MonitoringConfig;
  private logger: MonitoringLogger;
  private metricsCollector: MetricsCollector;
  private activeRequests: Map<string, NetworkRequest> = new Map();
  private completedRequests: NetworkRequest[] = [];
  private requestMacros: Map<string, string[]> = new Map(); // domain -> urls for pattern matching

  private readonly logPrefix = '[NetworkTracker]';
  private maxCompletedRequests = 500;

  constructor(config: MonitoringConfig, logger: MonitoringLogger, metricsCollector: MetricsCollector) {
    this.config = config;
    this.logger = logger;
    this.metricsCollector = metricsCollector;

    this.initializeInterceptors();
  }

  /**
   * Отслеживание сетевого запроса
   */
  trackRequest(requestData: Omit<NetworkRequest, 'requestId' | 'startTime'>, customRequestId?: string): string {
    const requestId = customRequestId || this.generateRequestId();
    const request: NetworkRequest = {
      ...requestData,
      requestId,
      startTime: performance.now(),
      component: requestData.component || 'unknown'
    };

    this.activeRequests.set(requestId, request);

    // Логирование начала запроса с семплингом
    if (this.shouldSample('networkRequests')) {
      this.logger.debug(request.component, `Network request started: ${request.method} ${this.sanitizeUrl(request.url)}`, {
        requestId,
        method: request.method,
        url: request.url,
        labels: request.labels
      });
    }

    this.metricsCollector.incrementCounter('network_requests_total', {
      method: request.method,
      component: request.component,
      domain: this.extractDomain(request.url)
    });

    return requestId;
  }

  /**
   * Завершение отслеживания запроса
   */
  completeRequest(
    requestId: string,
    success: boolean,
    statusCode?: number,
    responseSize?: number,
    error?: Error
  ): void {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      this.logger.warn('NetworkTracker', `Request not found: ${requestId}`);
      return;
    }

    request.endTime = performance.now();
    request.duration = request.endTime - request.startTime;
    request.success = success;
    request.statusCode = statusCode;
    request.responseSize = responseSize;
    request.error = error;

    // Удаление из активных
    this.activeRequests.delete(requestId);

    // Добавление в завершенные
    this.completedRequests.push(request);

    // Ограничение количества завершенных запросов
    if (this.completedRequests.length > this.maxCompletedRequests) {
      this.completedRequests = this.completedRequests.slice(-this.maxCompletedRequests);
    }

    // Регистрация метрик
    this.recordMetrics(request);

    // Логирование результата с семплингом
    if (this.shouldSample('networkRequests')) {
      this.logger.debug(request.component, `Network request completed: ${request.method} ${this.sanitizeUrl(request.url)}`, {
        requestId,
        success,
        statusCode,
        duration: request.duration,
        error: error?.message
      });
    }

    // Алерты для медленных или неудачных запросов
    this.checkRequestAlerts(request);
  }

  /**
   * Удобный метод через Promise
   */
  async trackFetch<T extends Response>(
    url: string,
    options: RequestInit,
    component: string = 'unknown'
  ): Promise<T> {
    const method = options.method || 'GET';
    const requestId = this.trackRequest({
      url,
      method,
      component,
      success: false,
      labels: { ...options.headers, ...options }
    });

    try {
      const startTime = performance.now();
      const response = await fetch(url, options);
      const responseTime = performance.now() - startTime;

      const responseSize = Number(response.headers.get('content-length')) || 0;
      const success = response.ok;

      this.completeRequest(
        requestId,
        success,
        response.status,
        responseSize
      );

      return response as T;
    } catch (error) {
      this.completeRequest(requestId, false, undefined, undefined, error as Error);
      throw error;
    }
  }

  /**
   * Получение статистики сетевых запросов
   */
  getNetworkStats(timeRange?: { from: number; to: number }): NetworkStats {
    let requests = this.completedRequests;

    if (timeRange) {
      requests = requests.filter(req =>
        req.startTime >= timeRange.from && req.startTime <= timeRange.to
      );
    }

    if (requests.length === 0) {
      return {
        totalRequests: 0,
        successRate: 100,
        averageResponseTime: 0,
        requestsByStatus: {},
        slowestRequests: [],
        requestsByDomain: {},
        errorPatterns: {}
      };
    }

    const totalRequests = requests.length;
    const successfulRequests = requests.filter(req => req.success).length;
    const successRate = (successfulRequests / totalRequests) * 100;

    const avgResponseTime = requests
      .filter(req => req.duration)
      .reduce((sum, req) => sum + (req.duration || 0), 0) / requests.length;

    const requestsByStatus: Record<number, number> = {};
    const requestsByDomain: Record<string, number> = {};
    const errorPatterns: Record<string, number> = {};

    requests.forEach(request => {
      if (request.statusCode) {
        requestsByStatus[request.statusCode] = (requestsByStatus[request.statusCode] || 0) + 1;
      }

      const domain = this.extractDomain(request.url);
      requestsByDomain[domain] = (requestsByDomain[domain] || 0) + 1;

      if (!request.success && request.error) {
        const pattern = this.extractErrorPattern(request.error);
        errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
      }
    });

    const slowestRequests = requests
      .filter(req => req.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10)
      .map(req => ({
        url: this.sanitizeUrl(req.url),
        method: req.method,
        duration: req.duration || 0,
        statusCode: req.statusCode || 0
      }));

    return {
      totalRequests,
      successRate,
      averageResponseTime: avgResponseTime,
      requestsByStatus,
      slowestRequests,
      requestsByDomain,
      errorPatterns
    };
  }

  /**
   * Получение активных сетевых запросов
   */
  getActiveRequests(): NetworkRequest[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Очистка завершенных запросов старше определенного времени
   */
  cleanupCompletedRequests(maxAge: number = 30 * 60 * 1000): number { // 30 минут по умолчанию
    const cutoffTime = Date.now() - maxAge;
    const beforeCount = this.completedRequests.length;

    this.completedRequests = this.completedRequests.filter(
      request => request.startTime > cutoffTime
    );

    const removedCount = beforeCount - this.completedRequests.length;

    if (removedCount > 0) {
      this.logger.debug('NetworkTracker', `Cleaned up ${removedCount} old network requests`);
    }

    return removedCount;
  }

  // ===== PRIVATE METHODS =====

  /**
   * Инициализация перехватчиков для автоматического отслеживания
   */
  private initializeInterceptors(): void {
    // Перехватчик для fetch API
    if (typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = this.createMonitoredFetch(originalFetch);
    }

    // Перехватчик для XMLHttpRequest
    if (typeof XMLHttpRequest !== 'undefined') {
      const originalXhrOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = this.createMonitoredXmlHttpRequest(originalXhrOpen);
    }
  }

  /**
   * Создание monitored версии fetch
   */
  private createMonitoredFetch(originalFetch: typeof fetch): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = init?.method || 'GET';

      const requestId = this.trackRequest({
        url,
        method,
        component: 'fetch_api',
        success: false,
        labels: { component: 'fetch_api' }
      });

      try {
        const startTime = performance.now();
        const response = await originalFetch(input, init);
        const responseTime = performance.now() - startTime;

        const success = response.ok;
        const statusCode = response.status;
        const responseSize = Number(response.headers.get('content-length')) || 0;

        this.completeRequest(requestId, success, statusCode, responseSize);

        return response;
      } catch (error) {
        this.completeRequest(requestId, false, undefined, undefined, error as Error);
        throw error;
      }
    };
  }

  /**
   * Создание monitored версии XMLHttpRequest
   */
  private createMonitoredXmlHttpRequest(originalOpen: typeof XMLHttpRequest.prototype.open): typeof XMLHttpRequest.prototype.open {
    return function(this: XMLHttpRequest, method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null): void {
      const networkTracker = getMonitoringCore().getNetworkTracker();
      const requestId = networkTracker.trackRequest({
        url: typeof url === 'string' ? url : url.toString(),
        method: method.toUpperCase(),
        component: 'xhr_api',
        success: false,
        labels: { component: 'xhr_api' }
      });

      // Переопределение onreadystatechange для отслеживания ответов
      const originalReadyStateChange = this.onreadystatechange;
      this.onreadystatechange = (ev) => {
        if (this.readyState === XMLHttpRequest.DONE) {
          networkTracker.completeRequest(
            requestId,
            this.status >= 200 && this.status < 300,
            this.status,
            this.response?.length || this.responseText?.length || 0
          );
        }

        if (originalReadyStateChange) {
          originalReadyStateChange.call(this, ev);
        }
      };

      return originalOpen.call(this, method, url, async, user, password);
    };
  }

  /**
   * Регистрация метрик для запроса
   */
  private recordMetrics(request: NetworkRequest): void {
    // Метрика общего количества запросов
    this.metricsCollector.incrementCounter('network_requests_total', {
      method: request.method,
      component: request.component,
      status: request.statusCode?.toString() || 'unknown'
    });

    // Гистограмма времени ответов
    if (request.duration) {
      this.metricsCollector.recordHistogram('network_request_duration_seconds', request.duration / 1000, {
        method: request.method,
        component: request.component,
        success: request.success.toString()
      });
    }

    // Метрики по статусам
    if (request.statusCode) {
      this.metricsCollector.incrementCounter('network_status_codes_total', {
        status_code: request.statusCode.toString(),
        method: request.method,
        component: request.component
      });

      // Отдельные счетчики для ошибок
      if (request.statusCode >= 400) {
        this.metricsCollector.incrementCounter('network_errors_total', {
          status_code: request.statusCode.toString(),
          method: request.method,
          component: request.component,
          url: this.sanitizeUrl(request.url)
        });
      }
    }

    // Метрики по размеру ответов
    if (request.responseSize) {
      this.metricsCollector.recordHistogram('network_response_size_bytes', request.responseSize, {
        method: request.method,
        component: request.component
      });
    }
  }

  /**
   * Проверка алертов для медленных или неудачных запросов
   */
  private checkRequestAlerts(request: NetworkRequest): void {
    if (!request.duration) return;

    // Алерт для очень медленных запросов (> 30 секунд)
    if (request.duration > 30000) {
      this.logger.warn('NetworkTracker', 'Very slow network request', {
        url: this.sanitizeUrl(request.url),
        method: request.method,
        duration: request.duration,
        component: request.component
      });
    }

    // Алерт для неудачных запросов
    if (!request.success && request.statusCode && request.statusCode >= 500) {
      this.logger.error('NetworkTracker', 'Server error in network request', {
        url: this.sanitizeUrl(request.url),
        method: request.method,
        statusCode: request.statusCode,
        component: request.component
      });
    }
  }

  /**
   * Генерация уникального ID запроса
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Извлечение домена из URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Очистка чувствительной информации из URL
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Удаление потенциально чувствительных параметров
      urlObj.searchParams.delete('key');
      urlObj.searchParams.delete('token');
      urlObj.searchParams.delete('api_key');
      urlObj.searchParams.delete('password');
      return urlObj.href;
    } catch {
      return 'invalid-url';
    }
  }

  /**
   * Извлечение паттерна ошибки
   */
  private extractErrorPattern(error: Error): string {
    const message = error.message.toLowerCase();
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network')) return 'network_error';
    if (message.includes('cors')) return 'cors_error';
    if (message.includes('aborted')) return 'aborted';
    return 'other_error';
  }

  /**
   * Проверка, следует ли сэмплировать запрос
   */
  private shouldSample(type: keyof MonitoringConfig['samplingRates']): boolean {
    if (this.config.samplingRates[type] >= 1) return true;
    return Math.random() < this.config.samplingRates[type];
  }
}

// Функция для доступа к мониторинговому ядру (чтобы избежать циклических зависимостей)
function getMonitoringCore() {
  return (globalThis as any).__MONITORING_CORE__;
}