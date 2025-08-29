/**
 * Metrics Collector - Сбор и агрегация метрик производительности
 *
 * Поддерживает разные типы метрик (counter, gauge, histogram, timer),
 * агрегацию, квантили и экспорт метрик для мониторинга
 */

import type { Metric, MetricType, MonitoringConfig } from './monitoring-core.js';
import type { MonitoringLogger } from './logger.js';

export interface MetricsStats {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    percentiles: Record<string, number>;
    buckets: Record<string, number>;
  }>;
  lastUpdate: number;
}

export interface BucketDefinition {
  le: number; // less or equal
  name: string;
}

const DEFAULT_BUCKETS: BucketDefinition[] = [
  { le: 0.1, name: '0.1s' },
  { le: 0.5, name: '0.5s' },
  { le: 1, name: '1s' },
  { le: 2.5, name: '2.5s' },
  { le: 5, name: '5s' },
  { le: 10, name: '10s' },
  { le: 25, name: '25s' },
  { le: 60, name: '60s' },
  { le: 300, name: '300s' }
];

export class MetricsCollector {
  private config: MonitoringConfig;
  private logger: MonitoringLogger;

  // Хранение метрик в памяти
  private counters: Map<string, Map<string, number>> = new Map(); // name -> labels -> value
  private gauges: Map<string, Map<string, number>> = new Map(); // name -> labels -> value
  private histograms: Map<string, Map<string, {
    count: number;
    sum: number;
    min: number;
    max: number;
    values: number[];
    buckets: Record<string, number>;
  }>> = new Map(); // name -> labels -> histogram_data

  private maxHistogramSamples: number = 1000;

  constructor(config: MonitoringConfig, logger: MonitoringLogger) {
    this.config = config;
    this.logger = logger;

    // Инициализация метрик по умолчанию
    this.initializeDefaultMetrics();
  }

  /**
   * Инкремент счетчика
   */
  incrementCounter(metricName: string, labels: Record<string, string> = {}, value: number = 1): void {
    const labelsKey = this.getLabelsKey(labels);

    const counterMap = this.counters.get(metricName) || new Map();
    const currentValue = counterMap.get(labelsKey) || 0;
    counterMap.set(labelsKey, currentValue + value);
    this.counters.set(metricName, counterMap);

    this.logger.debug('MetricsCollector', `Counter incremented: ${metricName}`, {
      labels,
      value,
      newValue: currentValue + value
    });
  }

  /**
   * Установка значения gauge
   */
  recordGauge(metricName: string, value: number, labels: Record<string, string> = {}): void {
    const labelsKey = this.getLabelsKey(labels);

    const gaugeMap = this.gauges.get(metricName) || new Map();
    gaugeMap.set(labelsKey, value);
    this.gauges.set(metricName, gaugeMap);

    // Проверка порогов для gauge метрик
    this.checkGaugeThreshold(metricName, value, labels);
  }

  /**
   * Добавление значения в гистограмму
   */
  recordHistogram(metricName: string, value: number, labels: Record<string, string> = {}): void {
    const labelsKey = this.getLabelsKey(labels);

    const histogramMap = this.histograms.get(metricName) || new Map();
    const histogramData = histogramMap.get(labelsKey) || {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      values: [],
      buckets: {}
    };

    // Обновление гистограммы
    histogramData.count++;
    histogramData.sum += value;
    histogramData.min = Math.min(histogramData.min, value);
    histogramData.max = Math.max(histogramData.max, value);
    histogramData.values.push(value);

    // Ограничение количества значений
    if (histogramData.values.length > this.maxHistogramSamples) {
      histogramData.values = histogramData.values.slice(-this.maxHistogramSamples);
    }

    // Обновление buckets
    this.updateBuckets(histogramData.buckets, value);

    histogramMap.set(labelsKey, histogramData);
    this.histograms.set(metricName, histogramMap);
  }

  /**
   * Добавление значения таймера (специальный случай гистограммы для измерения времени)
   */
  recordTimer(metricName: string, startTime: number, labels: Record<string, string> = {}): void {
    const duration = performance.now() - startTime;
    this.recordHistogram(metricName, duration / 1000, labels); // конвертируем в секунды
  }

  /**
   * Получение статистики по всем метрикам
   */
  getMetricsStats(): MetricsStats {
    const stats = {
      counters: {} as Record<string, number>,
      gauges: {} as Record<string, number>,
      histograms: {} as Record<string, any>,
      lastUpdate: Date.now()
    };

    // Агрегация счетчиков
    this.counters.forEach((labelMap, metricName) => {
      stats.counters[metricName] = Array.from(labelMap.values()).reduce((sum, val) => sum + val, 0);
    });

    // Агрегация gauges (берем последние значения)
    this.gauges.forEach((labelMap, metricName) => {
      stats.gauges[metricName] = Array.from(labelMap.values()).pop() || 0;
    });

    // Агрегация гистограмм
    this.histograms.forEach((labelMap, metricName) => {
      const allValues: number[] = [];
      const totals = { count: 0, sum: 0, min: Infinity, max: -Infinity };

      labelMap.forEach(histogramData => {
        totals.count += histogramData.count;
        totals.sum += histogramData.sum;
        totals.min = Math.min(totals.min, histogramData.min);
        totals.max = Math.max(totals.max, histogramData.max);
        allValues.push(...histogramData.values);
      });

      if (allValues.length > 0) {
        stats.histograms[metricName] = {
          count: totals.count,
          sum: totals.sum,
          min: totals.min === Infinity ? 0 : totals.min,
          max: totals.max === -Infinity ? 0 : totals.max,
          avg: totals.sum / totals.count,
          percentiles: this.calculatePercentiles(allValues),
          buckets: this.mergeBuckets(labelMap)
        };
      }
    });

    return stats;
  }

  /**
   * Получение конкретной метрики
   */
  getMetric(metricName: string, labels?: Record<string, string>): Metric | null {
    const labelsKey = labels ? this.getLabelsKey(labels) : '';

    // Поиск в счетчиках
    const counterMap = this.counters.get(metricName);
    if (counterMap) {
      const value = labelsKey ? counterMap.get(labelsKey) : Array.from(counterMap.values()).reduce((sum, val) => sum + val, 0);
      if (value !== undefined) {
        return {
          name: metricName,
          type: MetricType.COUNTER,
          value,
          labels,
          timestamp: Date.now()
        };
      }
    }

    // Поиск в gauges
    const gaugeMap = this.gauges.get(metricName);
    if (gaugeMap) {
      const value = labelsKey ? gaugeMap.get(labelsKey) : Array.from(gaugeMap.values()).pop();
      if (value !== undefined) {
        return {
          name: metricName,
          type: MetricType.GAUGE,
          value,
          labels,
          timestamp: Date.now()
        };
      }
    }

    // Поиск в гистограммах
    const histogramMap = this.histograms.get(metricName);
    if (histogramMap) {
      const histogramData = labelsKey ? histogramMap.get(labelsKey) : Array.from(histogramMap.values())[0];
      if (histogramData) {
        return {
          name: metricName,
          type: MetricType.HISTOGRAM,
          value: histogramData.sum / histogramData.count,
          labels,
          timestamp: Date.now()
        };
      }
    }

    return null;
  }

  /**
   * Очистка всех метрик
   */
  clearMetrics(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.initializeDefaultMetrics();
    this.logger.info('MetricsCollector', 'All metrics cleared');
  }

  /**
   * Экспорт метрик в Prometheus-формате
   */
  exportPrometheusFormat(): string {
    const lines: string[] = [];
    const stats = this.getMetricsStats();

    // Экспорт счетчиков
    Object.entries(stats.counters).forEach(([name, value]) => {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}_total ${value}`);
    });

    // Экспорт gauges
    Object.entries(stats.gauges).forEach(([name, value]) => {
      lines.push(`# HELP ${name} Gauge metric`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    });

    // Экспорт гистограмм
    Object.entries(stats.histograms).forEach(([name, histogram]) => {
      lines.push(`# HELP ${name} Histogram metric`);
      lines.push(`# TYPE ${name} histogram`);

      // Экспорт buckets
      Object.entries(histogram.buckets).forEach(([bucket, count]) => {
        lines.push(`${name}_bucket{le="${bucket}"} ${count}`);
      });

      lines.push(`${name}_count ${histogram.count}`);
      lines.push(`${name}_sum ${histogram.sum}`);
    });

    return lines.join('\n');
  }

  // ===== PRIVATE METHODS =====

  /**
   * Инициализация метрик по умолчанию
   */
  private initializeDefaultMetrics(): void {
    // Создание базовых метрик для отслеживания здоровья системы
    this.incrementCounter('monitoring_system_startups', {}, 0); // для отметки запуска
    this.recordGauge('monitoring_buffer_size', this.counters.size);
  }

  /**
   * Получение ключа для labels (сортированный)
   */
  private getLabelsKey(labels: Record<string, string>): string {
    return Object.keys(labels)
      .sort()
      .map(key => `${key}="${labels[key]}"`)
      .join(',');
  }

  /**
   * Обновление buckets для гистограммы
   */
  private updateBuckets(buckets: Record<string, number>, value: number): void {
    DEFAULT_BUCKETS.forEach(bucket => {
      if (value <= bucket.le) {
        const currentCount = buckets[bucket.le.toString()] || 0;
        buckets[bucket.le.toString()] = currentCount + 1;
      }
    });

    // Бесконечный bucket
    const infiniteCount = buckets['+Inf'] || 0;
    buckets['+Inf'] = infiniteCount + 1;
  }

  /**
   * Расчет перцентилей
   */
  private calculatePercentiles(values: number[]): Record<string, number> {
    if (values.length === 0) return {};

    const sorted = [...values].sort((a, b) => a - b);
    const percentiles = [50, 75, 90, 95, 99];

    return percentiles.reduce((result, percentile) => {
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      result[`p${percentile}`] = sorted[index] || 0;
      return result;
    }, {} as Record<string, number>);
  }

  /**
   * Слияние buckets из разных label комбинаций
   */
  private mergeBuckets(labelMap: Map<string, any>): Record<string, number> {
    const mergedBuckets: Record<string, number> = {};

    labelMap.forEach((histogramData) => {
      Object.entries(histogramData.buckets).forEach(([le, count]) => {
        mergedBuckets[le] = (mergedBuckets[le] || 0) + count;
      });
    });

    return mergedBuckets;
  }

  /**
   * Проверка порогов для gauge метрик
   */
  private checkGaugeThreshold(metricName: string, value: number, labels: Record<string, string>): void {
    // Специфические проверки для критических метрик
    switch (metricName) {
      case 'pyodide_memory_used_mb':
        if (value > this.config.alertThresholds.maxPyodideMemory) {
          this.logger.warn('MetricsCollector', `Pyodide memory usage exceeded threshold`, {
            current: value,
            threshold: this.config.alertThresholds.maxPyodideMemory,
            labels
          });
        }
        break;

      case 'workflow_duration_seconds':
        if (value > this.config.alertThresholds.maxWorkflowDuration) {
          this.logger.error('MetricsCollector', `Workflow duration exceeded threshold`, {
            current: value,
            threshold: this.config.alertThresholds.maxWorkflowDuration,
            labels
          });
        }
        break;

      case 'ai_api_call_duration_seconds':
        if (value > this.config.alertThresholds.maxApiCallDuration) {
          this.logger.warn('MetricsCollector', `AI API call duration exceeded threshold`, {
            current: value,
            threshold: this.config.alertThresholds.maxApiCallDuration,
            labels
          });
        }
        break;
    }
  }
}