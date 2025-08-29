/**
 * Monitoring Core - Централизованная система мониторинга для Ozon Analyzer плагина
 *
 * Координирует сбор метрик, логирование, оповещения и управление производительностью
 * для всех компонентов плагина: Workflow Engine, Pyodide Worker, AI Client, Network
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface MonitoringEvent {
  timestamp: number;
  component: string;
  level: LogLevel;
  message: string;
  data?: Record<string, any>;
  error?: Error;
  traceId?: string;
  userId?: string;
  sessionId?: string;
}

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  component: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
  threshold?: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number;
    duration: number; // в секундах
  };
}

export interface MonitoringConfig {
  enableConsoleLogging: boolean;
  enableErrorCapture: boolean;
  enablePerformanceMetrics: boolean;
  enableMemoryTracking: boolean;
  enableNetworkRequestTracking: boolean;
  alertThresholds: {
    maxPyodideMemory: number; // в MB
    maxWorkflowDuration: number; // в секундах
    maxApiCallDuration: number; // в секундах
    maxErrorRate: number; // процент ошибок
    maxConsecutiveFailures: number;
  };
  samplingRates: {
    errorEvents: number; // 0-1, доля событий для сэмплинга
    performanceMetrics: number;
    networkRequests: number;
  };
}

/**
 * Основной хендлер для сбора и маршрутизации мониторинговых событий
 */
class MonitoringCore {
  private config: MonitoringConfig;
  private logger: MonitoringLogger;
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private errorTracker: ErrorTracker;
  private performanceMonitor: PerformanceMonitor;
  private networkTracker: NetworkTracker;
  private isProduction: boolean;
  private traceIdGenerator: () => string;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enableConsoleLogging: true,
      enableErrorCapture: true,
      enablePerformanceMetrics: true,
      enableMemoryTracking: true,
      enableNetworkRequestTracking: true,
      alertThresholds: {
        maxPyodideMemory: 256,
        maxWorkflowDuration: 300,
        maxApiCallDuration: 60,
        maxErrorRate: 10,
        maxConsecutiveFailures: 5
      },
      samplingRates: {
        errorEvents: 1.0, // все ошибки в production
        performanceMetrics: 0.1, // 10% метрик для производительности
        networkRequests: 0.5 // 50% сетевых запросов
      },
      ...config
    };

    this.isProduction = process.env.NODE_ENV === 'production';

    // Генератор traceId для трейсинга запросов
    this.traceIdGenerator = () => `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Инициализация компонентов мониторинга
    this.logger = new MonitoringLogger(this.config);
    this.metricsCollector = new MetricsCollector(this.config, this.logger);
    this.alertManager = new AlertManager(this.config, this.logger);
    this.errorTracker = new ErrorTracker(this.config, this.logger, this.alertManager);
    this.performanceMonitor = new PerformanceMonitor(this.config, this.logger, this.metricsCollector);
    this.networkTracker = new NetworkTracker(this.config, this.logger, this.metricsCollector);

    this.initializeGlobalErrorHandlers();
    this.logger.addEvent({
      component: 'MonitoringCore',
      level: LogLevel.INFO,
      message: 'Monitoring system initialized',
      data: { config: this.config, isProduction: this.isProduction }
    });
  }

  /**
   * Инициализация глобальных хендлеров ошибок
   */
  private initializeGlobalErrorHandlers(): void {
    if (this.config.enableErrorCapture) {
      // Захват необработанных ошибок
      window.addEventListener('error', (event) => {
        this.captureError('UncaughtError', event.error || new Error(event.message), {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          component: 'global'
        });
      });

      // Захват необработанных promise rejection
      window.addEventListener('unhandledrejection', (event) => {
        this.captureError('UnhandledRejection', new Error(event.reason), {
          component: 'promise',
          originalReason: event.reason
        });
      });
    }
  }

  /**
   * Захват и обработка ошибки
   */
  captureError(context: string, error: Error, additionalData?: Record<string, any>): void {
    const traceId = this.traceIdGenerator();
    const errorData = {
      context,
      timestamp: Date.now(),
      traceId,
      stack: error.stack,
      component: additionalData?.component || 'unknown',
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...additionalData
    };

    this.errorTracker.trackError(error, errorData);
    this.metricsCollector.incrementCounter('errors_total', {
      component: errorData.component,
      context: context,
      level: 'error'
    });

    // Оповещение о критических ошибках
    if (errorData.component === 'pyodide' || errorData.component === 'workflow') {
      this.alertManager.createAlert({
        id: `error_${Date.now()}`,
        severity: AlertSeverity.HIGH,
        component: errorData.component,
        message: `Критическая ошибка в ${context}: ${error.message}`,
        timestamp: Date.now(),
        acknowledged: false,
        resolved: false
      });
    }
  }

  /**
   * Измерение производительности операции
   */
  async measurePerformance<T>(
    operationName: string,
    operation: () => Promise<T>,
    labels?: Record<string, string>
  ): Promise<T> {
    const startTime = performance.now();
    const traceId = this.traceIdGenerator();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      if (this.shouldSample('performanceMetrics')) {
        this.performanceMonitor.recordOperation(operationName, duration, {
          ...labels,
          traceId,
          success: true
        });
        this.metricsCollector.recordHistogram('operation_duration_seconds', duration / 1000, {
          operation: operationName,
          ...labels
        });
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.performanceMonitor.recordOperation(operationName, duration, {
        ...labels,
        traceId,
        success: false,
        error: (error as Error).message
      });
      this.metricsCollector.recordHistogram('operation_duration_seconds', duration / 1000, {
        operation: operationName,
        success: 'false',
        ...labels
      });

      throw error;
    }
  }

  /**
   * Отслеживание сетевых запросов
   */
  trackNetworkRequest(
    url: string,
    method: string,
    responseTime?: number,
    statusCode?: number,
    success?: boolean
  ): void {
    if (!this.config.enableNetworkRequestTracking || !this.shouldSample('networkRequests')) {
      return;
    }

    this.networkTracker.trackRequest({
      url,
      method,
      responseTime,
      statusCode,
      success,
      timestamp: Date.now()
    });

    if (statusCode && statusCode >= 400) {
      this.metricsCollector.incrementCounter('http_errors_total', {
        status_code: statusCode.toString(),
        method,
        component: 'network'
      });
    }
  }

  /**
   * Отслеживание использования памяти Pyodide
   */
  trackPyodideMemory(usedMB: number, totalMB?: number): void {
    if (!this.config.enableMemoryTracking) return;

    this.metricsCollector.recordGauge('pyodide_memory_used_mb', usedMB, {
      component: 'pyodide'
    });

    if (totalMB) {
      this.metricsCollector.recordGauge('pyodide_memory_total_mb', totalMB, {
        component: 'pyodide'
      });
    }

    // Проверка порога памяти
    if (usedMB > this.config.alertThresholds.maxPyodideMemory) {
      this.alertManager.createAlert({
        id: `memory_${Date.now()}`,
        severity: AlertSeverity.MEDIUM,
        component: 'pyodide',
        message: `Высокое использование памяти Pyodide: ${usedMB.toFixed(2)}MB`,
        timestamp: Date.now(),
        acknowledged: false,
        resolved: false,
        threshold: {
          metric: 'pyodide_memory_used_mb',
          operator: '>',
          value: this.config.alertThresholds.maxPyodideMemory,
          duration: 60
        }
      });
    }
  }

  /**
   * Регистрация пользовательского события
   */
  addLog(component: string, level: LogLevel, message: string, data?: Record<string, any>): void {
    const traceId = data?.traceId || this.traceIdGenerator();
    this.logger.addEvent({
      timestamp: Date.now(),
      component,
      level,
      message,
      data,
      traceId
    });
  }

  /**
   * Проверка сэмплинга для разных типов событий
   */
  private shouldSample(type: keyof MonitoringConfig['samplingRates']): boolean {
    if (this.isProduction) {
      return Math.random() < this.config.samplingRates[type];
    }
    return true; // в development собираем все данные
  }

  /**
   * Получение общего здоровья системы
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    lastUpdate: number;
  } {
    const alerts = this.alertManager.getActiveAlerts();
    const criticalAlerts = alerts.filter(alert => alert.severity === AlertSeverity.CRITICAL);
    const highAlerts = alerts.filter(alert => alert.severity === AlertSeverity.HIGH);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let issues: string[] = [];

    // Логика определения статуса здоровья
    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
      issues = criticalAlerts.map(alert => alert.message);
    } else if (highAlerts.length > 3) {
      status = 'degraded';
      issues = highAlerts.slice(0, 3).map(alert => alert.message);
    }

    // Дополнительные проверки здоровья
    if (this.errorTracker.getErrorRate() > this.config.alertThresholds.maxErrorRate) {
      status = 'degraded';
      issues.push(`Высокий уровень ошибок: ${this.errorTracker.getErrorRate().toFixed(2)}%`);
    }

    return {
      status,
      issues,
      lastUpdate: Date.now()
    };
  }

  // Геттеры для доступа к компонентам
  getLogger(): MonitoringLogger { return this.logger; }
  getMetricsCollector(): MetricsCollector { return this.metricsCollector; }
  getAlertManager(): AlertManager { return this.alertManager; }
  getErrorTracker(): ErrorTracker { return this.errorTracker; }
  getPerformanceMonitor(): PerformanceMonitor { return this.performanceMonitor; }
  getNetworkTracker(): NetworkTracker { return this.networkTracker; }

  // Метод для корректного завершения работы
  dispose(): void {
    this.logger.addEvent({
      component: 'MonitoringCore',
      level: LogLevel.INFO,
      message: 'Monitoring system disposed',
      data: {}
    });

    // Очистка ресурсов
    if (window) {
      window.removeEventListener('error', this.captureError.bind(this));
      window.removeEventListener('unhandledrejection', this.captureError.bind(this));
    }
  }
}

// Фабрика для создания единственного экземпляра
let monitoringInstance: MonitoringCore | null = null;

export function getMonitoringCore(config?: Partial<MonitoringConfig>): MonitoringCore {
  if (!monitoringInstance) {
    monitoringInstance = new MonitoringCore(config);
  }
  return monitoringInstance;
}

export { MonitoringCore };