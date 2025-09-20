/**
 * Monitoring System - Экспорт всех компонентов системы мониторинга
 *
 * Этот файл обеспечивает централизованный импорт всех компонентов мониторинга
 * для использования в других частях приложения
 */

// Основное API
export { getMonitoringCore, MonitoringCore } from './monitoring-core.js';

// Основные типы
export type {
  MonitoringEvent,
  LogLevel,
  Metric,
  MetricType,
  Alert,
  AlertSeverity,
  MonitoringConfig
} from './monitoring-core.js';

// Компоненты логирования
export { MonitoringLogger } from './logger.js';
export type { LogFilter, LogExportOptions } from './logger.js';

// Компоненты метрик
export { MetricsCollector } from './metrics-collector.js';
export type { MetricsStats, BucketDefinition } from './metrics-collector.js';

// Компоненты алертов
export { AlertManager } from './alert-manager.js';
export type { AlertRule, AlertState } from './alert-manager.js';

// Компоненты трекинга ошибок
export { ErrorTracker } from './error-tracker.js';
export type { ErrorPattern, ErrorReport } from './error-tracker.js';

// Компоненты мониторинга производительности
export { PerformanceMonitor } from './performance-monitor.js';
export type { PerformanceMeasurement } from './performance-monitor.js';

// Компоненты трекинга сети
export { NetworkTracker } from './network-tracker.js';
export type { NetworkRequest, NetworkStats } from './network-tracker.js';

/**
 * Быстрая функция инициализации системы мониторинга производственного уровня
 *
 * @param options - Настройки мониторинга
 * @returns Singleton экземпляр MonitoringCore
 *
 * Примеры использования:
 *
 * // Простая инициализация с настройками по умолчанию
 * const monitor = initializeMonitoring();
 *
 * // С кастомными настройками
 * const monitor = initializeMonitoring({
 *   sampleRate: 0.5,
 *   enablePerformanceTracking: true
 * });
 *
 * // Измерение производительности
 * const duration = await monitor.measurePerformance(
 *   'data_processing',
 *   async () => { return await processData(); }
 * );
 *
 * // Логирование ошибок
 * monitor.captureError('validation', error, { userId: '123' });
 */
export function initializeMonitoring(options: {
  sampleRate?: number;
  enablePerformanceTracking?: boolean;
  enableErrorCapture?: boolean;
  enableNetworkTracking?: boolean;
  alertThresholds?: Partial<MonitoringConfig['alertThresholds']>;
} = {}) {
  const defaultConfig: Partial<MonitoringConfig> = {
    enableConsoleLogging: true,
    enableErrorCapture: options.enableErrorCapture ?? true,
    enablePerformanceMetrics: options.enablePerformanceTracking ?? true,
    enableMemoryTracking: true,
    enableNetworkRequestTracking: options.enableNetworkTracking ?? true,
    samplingRates: {
      errorEvents: 1.0,
      performanceMetrics: options.sampleRate ?? 0.1,
      networkRequests: options.sampleRate ?? 0.5
    },
    alertThresholds: {
      maxPyodideMemory: 256,
      maxWorkflowDuration: 300,
      maxApiCallDuration: 60,
      maxErrorRate: 10,
      maxConsecutiveFailures: 5,
      ...options.alertThresholds
    }
  };

  const monitor = getMonitoringCore(defaultConfig);

  // Сохраняем ссылку глобально для NetworkTracker
  (globalThis as any).__MONITORING_CORE__ = monitor;

  return monitor;
}

export default initializeMonitoring;