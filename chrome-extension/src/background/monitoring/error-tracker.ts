/**
 * Error Tracker - Отслеживание и классификация ошибок
 *
 * Анализирует паттерны ошибок, отслеживает частоту и помогает в диагностике
 */

import { MonitoringConfig, AlertSeverity } from './monitoring-core.js';
import type { MonitoringLogger } from './logger.js';
import type { AlertManager } from './alert-manager.js';

export interface ErrorPattern {
  id: string;
  signature: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  examples: string[];
  tags: string[];
}

export interface ErrorReport {
  timestamp: number;
  component: string;
  message: string;
  error: Error;
  data: Record<string, any>;
  frequency: number;
  traceId: string;
}

export class ErrorTracker {
  private config: MonitoringConfig;
  private logger: MonitoringLogger;
  private alertManager: AlertManager;
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private errorCounts: Map<string, { count: number; lastSeen: number }> = new Map();
  private errorRateSlidingWindow: number[] = []; // ошибки за последние N минут
  private windowSize: number = 10; // 10 минут
  private maxErrorSamplesPerPattern: number = 5;

  constructor(config: MonitoringConfig, logger: MonitoringLogger, alertManager: AlertManager) {
    this.config = config;
    this.logger = logger;
    this.alertManager = alertManager;
  }

  /**
   * Отслеживание отдельной ошибки
   */
  trackError(error: Error, additionalData: Record<string, any> = {}): ErrorReport {
    const component = additionalData.component || 'unknown';
    const now = Date.now();
    const traceId = additionalData.traceId || this.generateTraceId();

    // Создание отчета об ошибке
    const errorReport: ErrorReport = {
      timestamp: now,
      component,
      message: error.message,
      error,
      data: additionalData,
      frequency: 1,
      traceId
    };

    // Обновление счетчика ошибок
    const componentKey = component;
    const existingCount = this.errorCounts.get(componentKey);
    if (existingCount) {
      existingCount.count++;
      existingCount.lastSeen = now;
      errorReport.frequency = existingCount.count;
    } else {
      this.errorCounts.set(componentKey, { count: 1, lastSeen: now });
    }

    // Обновление паттернов ошибок
    const pattern = this.analyzeErrorPattern(error, component);
    if (pattern) {
      this.updateErrorPattern(pattern, error.message, additionalData);
    }

    // Обновление окна ошибки для расчетов частоты
    this.updateErrorRateWindow(now);

    // Проверка необходимости алертов
    this.checkErrorAlertTriggers(component, errorReport);

    // Логирование ошибки
    this.logger.error(component, error.message, error, additionalData);

    return errorReport;
  }

  /**
   * Получение оценки уровня ошибок (процент ошибок)
   */
  getErrorRate(): number {
    const totalErrors = this.errorRateSlidingWindow.length;
    if (totalErrors === 0) return 0;

    // Предполагаем 1000 успешных операций за окно времени
    const estimatedRequests = 1000;
    return (totalErrors / (totalErrors + estimatedRequests)) * 100;
  }

  /**
   * Получение самых частых паттернов ошибок
   */
  getTopErrorPatterns(limit: number = 10): ErrorPattern[] {
    return Array.from(this.errorPatterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Получение статистики ошибок
   */
  getErrorStats(): {
    totalErrors: number;
    errorRate: number;
    topPatterns: ErrorPattern[];
    byComponent: Record<string, number>;
    recentErrors: ErrorReport[];
    timeRange: { from: number; to: number };
  } {
    const byComponent: Record<string, number> = {};
    this.errorCounts.forEach((data, component) => {
      byComponent[component] = data.count;
    });

    const allTimestamps = Array.from(this.errorCounts.values())
      .map(data => data.lastSeen);

    const minTime = allTimestamps.length > 0 ? Math.min(...allTimestamps) : 0;
    const maxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now();

    return {
      totalErrors: Array.from(this.errorCounts.values())
        .reduce((sum, data) => sum + data.count, 0),
      errorRate: this.getErrorRate(),
      topPatterns: this.getTopErrorPatterns(5),
      byComponent,
      recentErrors: [], // Можно реализовать если нужно
      timeRange: { from: minTime, to: maxTime }
    };
  }

  /**
   * Очистка старых счетчиков ошибок
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number { // сутки по умолчанию
    const cutoffTime = Date.now() - maxAge;
    let removed = 0;

    // Очистка счетчиков компонентов
    for (const [component, data] of this.errorCounts.entries()) {
      if (data.lastSeen < cutoffTime) {
        this.errorCounts.delete(component);
        removed++;
      }
    }

    // Очистка паттернов
    for (const [patternId, pattern] of this.errorPatterns.entries()) {
      if (pattern.lastSeen < cutoffTime) {
        this.errorPatterns.delete(patternId);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug('ErrorTracker', `Cleaned up ${removed} old error records`);
    }

    return removed;
  }

  // ===== PRIVATE METHODS =====

  /**
   * Гнерация уникального ID трассировки
   */
  private generateTraceId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Анализ паттерна ошибки
   */
  private analyzeErrorPattern(error: Error, component: string): string | null {
    let signature = '';

    // Создание сигнатуры на основе сообщения и стека
    if (error.message) {
      signature += error.message.slice(0, 100);
    }

    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 3);
      signature += ' | ' + stackLines.join(' | ');
    }

    // Добавление компонента для большей специфичности
    return `${component}:${signature}`.slice(0, 200);
  }

  /**
   * Обновление паттерна ошибки
   */
  private updateErrorPattern(signature: string, errorMessage: string, data: Record<string, any>): void {
    const existingPattern = this.errorPatterns.get(signature);

    if (existingPattern) {
      existingPattern.count++;
      existingPattern.lastSeen = Date.now();

      // Добавление нового примера если нужно
      if (!existingPattern.examples.includes(errorMessage) &&
          existingPattern.examples.length < this.maxErrorSamplesPerPattern) {
        existingPattern.examples.push(errorMessage);
      }

      // Обновление severity на основе частоты
      existingPattern.severity = this.calculateSeverity(existingPattern.count);

    } else {
      // Создание нового паттерна
      const newPattern: ErrorPattern = {
        id: `pattern_${signature.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}`,
        signature,
        count: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        component: data.component || 'unknown',
        severity: 'low',
        examples: errorMessage.length > 0 ? [errorMessage] : [],
        tags: this.extractErrorTags(errorMessage)
      };

      this.errorPatterns.set(signature, newPattern);
    }
  }

  /**
   * Обновление окна для расчета частоты ошибок
   */
  private updateErrorRateWindow(timestamp: number): void {
    // Добавляем текущую ошибку
    this.errorRateSlidingWindow.push(timestamp);

    // Удаляем старые записи (старше 10 минут)
    const cutoffTime = timestamp - (this.windowSize * 60 * 1000);
    this.errorRateSlidingWindow = this.errorRateSlidingWindow
      .filter(time => time >= cutoffTime);

    // Ограничиваем размер окна
    if (this.errorRateSlidingWindow.length > 1000) {
      this.errorRateSlidingWindow = this.errorRateSlidingWindow.slice(-1000);
    }
  }

  /**
   * Проверка необходимости создания алертов на основе ошибок
   */
  private checkErrorAlertTriggers(component: string, errorReport: ErrorReport): void {
    const componentErrors = this.errorCounts.get(component);
    if (!componentErrors) return;

    // Проверка количества последовательных ошибок
    if (componentErrors.count >= this.config.alertThresholds.maxConsecutiveFailures) {
      this.alertManager.createAlert({
        severity: AlertSeverity.HIGH,
        component: 'error_tracker',
        message: `High consecutive error rate in ${component}: ${componentErrors.count} errors`,
        threshold: {
          metric: 'consecutive_failures',
          operator: '>=',
          value: this.config.alertThresholds.maxConsecutiveFailures,
          duration: 3600
        }
      });
    }

    // Проверка общей частоты ошибок
    if (this.getErrorRate() > this.config.alertThresholds.maxErrorRate) {
      this.alertManager.createAlert({
        severity: AlertSeverity.MEDIUM,
        component,
        message: `Error rate exceeded threshold: ${this.getErrorRate().toFixed(2)}%`,
        threshold: {
          metric: 'error_rate',
          operator: '>',
          value: this.config.alertThresholds.maxErrorRate,
          duration: 600
        }
      });
    }

    // Специфические алерты для криитчных компонентов
    if (component === 'pyodide' && componentErrors.count > 3) {
      this.alertManager.createAlert({
        severity: AlertSeverity.CRITICAL,
        component: 'pyodide',
        message: `Multiple Pyodide errors detected: ${componentErrors.count} errors in recent timeframe`
      });
    }
  }

  /**
   * Расчет уровня серьезности на основе количества
   */
  private calculateSeverity(count: number): 'low' | 'medium' | 'high' | 'critical' {
    if (count >= 50) return 'critical';
    if (count >= 20) return 'high';
    if (count >= 10) return 'medium';
    return 'low';
  }

  /**
   * Извлечение тегов из сообщения об ошибке
   */
  private extractErrorTags(errorMessage: string): string[] {
    const tags: string[] = [];
    const message = errorMessage.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      tags.push('network');
    }

    if (message.includes('timeout')) {
      tags.push('timeout');
    }

    if (message.includes('memory') || message.includes('out of memory')) {
      tags.push('memory');
    }

    if (message.includes('api') || message.includes('http')) {
      tags.push('api');
    }

    if (message.includes('auth') || message.includes('authentication')) {
      tags.push('authentication');
    }

    if (message.includes('pyodide')) {
      tags.push('pyodide');
    }

    if (message.includes('workflow')) {
      tags.push('workflow');
    }

    return tags.length > 0 ? tags : ['general'];
  }
}