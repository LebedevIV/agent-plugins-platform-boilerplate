/**
 * Performance Monitor - Мониторинг производительности операций
 *
 * Отслеживает время выполнения операций, создает метрики производительности
 */

import type { MonitoringConfig } from './monitoring-core.ts';
import type { MonitoringLogger } from './logger.ts';
import type { MetricsCollector } from './metrics-collector.ts';

export interface PerformanceMeasurement {
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  labels: Record<string, string>;
  traceId: string;
  component: string;
  error?: Error;
}

export class PerformanceMonitor {
  private config: MonitoringConfig;
  private logger: MonitoringLogger;
  private metricsCollector: MetricsCollector;
  private measurements: Map<string, PerformanceMeasurement> = new Map();
  private completedMeasurements: PerformanceMeasurement[] = [];

  constructor(config: MonitoringConfig, logger: MonitoringLogger, metricsCollector: MetricsCollector) {
    this.config = config;
    this.logger = logger;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Начало измерения производительности
   */
  startOperation(
    operationName: string,
    labels: Record<string, string> = {},
    component: string = 'unknown'
  ): string {
    const traceId = this.generateTraceId();
    const measurement: PerformanceMeasurement = {
      operationName,
      startTime: performance.now(),
      success: false,
      labels,
      traceId,
      component
    };

    this.measurements.set(traceId, measurement);

    this.logger.debug(component, `Started operation: ${operationName}`, {
      traceId,
      labels,
      ...this.sanitizeLabels(labels)
    });

    return traceId;
  }

  /**
   * Завершение измерения производительности
   */
  endOperation(
    traceId: string,
    success: boolean = true,
    error?: Error,
    additionalLabels?: Record<string, string>
  ): number | null {
    const measurement = this.measurements.get(traceId);
    if (!measurement) {
      this.logger.warn('PerformanceMonitor', `Measurement not found for traceId: ${traceId}`);
      return null;
    }

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;
    measurement.success = success;
    measurement.error = error;

    if (additionalLabels) {
      measurement.labels = { ...measurement.labels, ...additionalLabels };
    }

    // Удаляем из активных измерений
    this.measurements.delete(traceId);

    // Добавляем в завершенные для анализа
    this.completedMeasurements.push(measurement);

    // Ограничение количества завершенных измерений
    if (this.completedMeasurements.length > 1000) {
      this.completedMeasurements = this.completedMeasurements.slice(-1000);
    }

    // Регистрация метрик
    if (success) {
      this.metricsCollector.recordHistogram(
        'operation_duration_seconds',
        measurement.duration / 1000,
        {
          operation: measurement.operationName,
          component: measurement.component,
          success: 'true',
          ...this.sanitizeLabels(measurement.labels)
        }
      );

      this.metricsCollector.incrementCounter('operations_completed_total', {
        operation: measurement.operationName,
        component: measurement.component,
        ...this.sanitizeLabels(measurement.labels)
      });
    } else {
      this.metricsCollector.recordHistogram(
        'failed_operation_duration_seconds',
        measurement.duration / 1000,
        {
          operation: measurement.operationName,
          component: measurement.component,
          success: 'false',
          ...this.sanitizeLabels(measurement.labels)
        }
      );

      this.metricsCollector.incrementCounter('operations_failed_total', {
        operation: measurement.operationName,
        component: measurement.component,
        ...this.sanitizeLabels(measurement.labels)
      });
    }

    this.logger.debug(measurement.component, `Completed operation: ${measurement.operationName}`, {
      traceId,
      duration: measurement.duration,
      success,
      ...this.sanitizeLabels(measurement.labels)
    });

    return measurement.duration;
  }

  /**
   * Удобный метод для измерения операции через колбэк
   */
  recordOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    labels: Record<string, string> = {}
  ): Promise<T> {
    const traceId = this.startOperation(operationName, labels);

    return operation()
      .then(result => {
        this.endOperation(traceId, true);
        return result;
      })
      .catch(error => {
        this.endOperation(traceId, false, error);
        throw error;
      });
  }

  /**
   * Получение статистики производительности
   */
  getPerformanceStats(): {
    activeOperations: number;
    slowestOperations: Array<{
      operation: string;
      avgDuration: number;
      maxDuration: number;
      count: number;
      successRate: number;
    }>;
    componentStats: Record<string, {
      avgDuration: number;
      operationCount: number;
      successRate: number;
    }>;
  } {
    const componentStats: Record<string, {
      durations: number[];
      successCount: number;
      totalCount: number;
    }> = {};

    const operationStats: Record<string, {
      durations: number[];
      successCount: number;
      totalCount: number;
    }> = {};

    // Анализ завершенных измерений
    this.completedMeasurements.forEach(measurement => {
      const component = measurement.component;
      const operation = measurement.operationName;

      if (!componentStats[component]) {
        componentStats[component] = { durations: [], successCount: 0, totalCount: 0 };
      }

      if (!operationStats[operation]) {
        operationStats[operation] = { durations: [], successCount: 0, totalCount: 0 };
      }

      if (measurement.duration) {
        componentStats[component].durations.push(measurement.duration);
        operationStats[operation].durations.push(measurement.duration);
      }

      componentStats[component].totalCount++;
      operationStats[operation].totalCount++;

      if (measurement.success) {
        componentStats[component].successCount++;
        operationStats[operation].successCount++;
      }
    });

    // Преобразование в итоговую статистику
    const slowestOperations = Object.entries(operationStats)
      .map(([operation, stats]) => ({
        operation,
        avgDuration: stats.durations.reduce((sum, dur) => sum + dur, 0) / stats.durations.length,
        maxDuration: Math.max(...stats.durations),
        count: stats.totalCount,
        successRate: (stats.successCount / stats.totalCount) * 100
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    const componentResult: Record<string, {
      avgDuration: number;
      operationCount: number;
      successRate: number;
    }> = {};

    Object.entries(componentStats).forEach(([component, stats]) => {
      componentResult[component] = {
        avgDuration: stats.durations.reduce((sum, dur) => sum + dur, 0) / stats.durations.length,
        operationCount: stats.totalCount,
        successRate: (stats.successCount / stats.totalCount) * 100
      };
    });

    return {
      activeOperations: this.measurements.size,
      slowestOperations,
      componentStats: componentResult
    };
  }

  /**
   * Очистка завершенных измерений старше определенного времени
   */
  cleanupCompletedMeasurements(maxAge: number = 60 * 60 * 1000): number { // час по умолчанию
    const cutoffTime = Date.now() - maxAge;
    const beforeCount = this.completedMeasurements.length;

    this.completedMeasurements = this.completedMeasurements.filter(
      measurement => measurement.endTime && measurement.endTime > cutoffTime
    );

    const removedCount = beforeCount - this.completedMeasurements.length;

    if (removedCount > 0) {
      this.logger.debug('PerformanceMonitor', `Cleaned up ${removedCount} old performance measurements`);
    }

    return removedCount;
  }

  /**
   * Получение активных операций (которые не завершились)
   */
  getActiveOperations(): PerformanceMeasurement[] {
    return Array.from(this.measurements.values());
  }

  /**
   * Аварийное завершение операци (например, при таймауте)
   */
  cancelOperation(traceId: string, reason: string = 'cancelled'): boolean {
    const measurement = this.measurements.get(traceId);
    if (!measurement) {
      return false;
    }

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;
    measurement.success = false;
    measurement.error = new Error(reason);
    measurement.labels.cancelled = 'true';

    this.endOperation(traceId, false, measurement.error, { cancelled_reason: reason });
    return true;
  }

  // ===== PRIVATE METHODS =====

  /**
   * Генерация уникального ID трассировки
   */
  private generateTraceId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Очистка меток для безопасного логирования
   */
  private sanitizeLabels(labels: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    Object.entries(labels).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '...';
      } else {
        sanitized[key] = String(value);
      }
    });

    return sanitized;
  }
}