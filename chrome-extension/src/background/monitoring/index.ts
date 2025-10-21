/**
 * Monitoring System - Экспорт всех компонентов системы мониторинга
 *
 * Этот файл обеспечивает централизованный импорт всех компонентов мониторинга
 * для использования в других частях приложения
 */

// Основное API
export { getMonitoringCore, MonitoringCore } from './monitoring-core.ts';

// Основные типы
export type {
  MonitoringEvent,
  LogLevel,
  Metric,
  MetricType,
  Alert,
  AlertSeverity,
  MonitoringConfig
} from './monitoring-core.ts';

// Компоненты логирования
export { MonitoringLogger } from './logger.ts';
export type { LogFilter, LogExportOptions } from './logger.ts';

// Компоненты метрик
export { MetricsCollector } from './metrics-collector.ts';
export type { MetricsStats, BucketDefinition } from './metrics-collector.ts';

// Компоненты алертов
export { AlertManager } from './alert-manager.ts';
export type { AlertRule, AlertState } from './alert-manager.ts';

// Компоненты трекинга ошибок
export { ErrorTracker } from './error-tracker.ts';
export type { ErrorPattern, ErrorReport } from './error-tracker.ts';

// Компоненты мониторинга производительности
export { PerformanceMonitor } from './performance-monitor.ts';
export type { PerformanceMeasurement } from './performance-monitor.ts';

// Компоненты трекинга сети
export { NetworkTracker } from './network-tracker.ts';
export type { NetworkRequest, NetworkStats } from './network-tracker.ts';

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