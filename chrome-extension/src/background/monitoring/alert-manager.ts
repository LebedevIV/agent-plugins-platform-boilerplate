/**
 * Alert Manager - Управление оповещениями и алармами системы мониторинга
 *
 * Обрабатывает пороги, создает и управляет алертами,
 * уведомляет о критических проблемах
 */

import { Alert, AlertSeverity, MonitoringConfig } from './monitoring-core.ts';
import { MonitoringLogger } from './logger.ts';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    duration?: number; // в секундах
  };
  severity: AlertSeverity;
  enabled: boolean;
  tags: string[];
}

export interface AlertState {
  alerts: Alert[];
  activeAlerts: Alert[];
  resolvedAlerts: Alert[];
  lastUpdate: number;
}

export class AlertManager {
  private config: MonitoringConfig;
  private logger: MonitoringLogger;
  private alerts: Alert[] = [];
  private alertRules: AlertRule[] = [];
  private nextAlertId: number = 1;
  private alertCooldown: Map<string, number> = new Map(); // alertType -> lastFired

  constructor(config: MonitoringConfig, logger: MonitoringLogger) {
    this.config = config;
    this.logger = logger;
    this.initializeDefaultRules();
  }

  /**
   * Создание нового алерта
   */
  createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): string {
    // Проверка cooldown для предотвращения спама
    if (this.isAlertOnCooldown(alert.component, alert.severity)) {
      this.logger.debug('AlertManager', `Alert suppressed due to cooldown`, {
        component: alert.component,
        severity: alert.severity
      });
      return '';
    }

    const newAlert: Alert = {
      ...alert,
      id: `alert_${this.nextAlertId++}`,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false
    };

    // Проверка наличия похожего активного алерта
    const existingAlert = this.findSimilarActiveAlert(alert);
    if (existingAlert) {
      this.logger.debug('AlertManager', 'Similar alert already exists, updating instead', {
        existingId: existingAlert.id,
        newId: newAlert.id
      });
      // Обновление существующего алерта
      existingAlert.message = alert.message;
      existingAlert.timestamp = newAlert.timestamp;
      return existingAlert.id;
    }

    this.alerts.push(newAlert);
    this.updateAlertCooldown(newAlert.component, newAlert.severity);

    this.logger.warn('AlertManager', `Alert created: ${alert.severity}`, {
      id: newAlert.id,
      component: alert.component,
      message: alert.message,
      severity: alert.severity
    });

    // уведомление о критических алертах
    if (alert.severity === AlertSeverity.CRITICAL || alert.severity === AlertSeverity.HIGH) {
      this.notifyCriticalAlert(newAlert);
    }

    return newAlert.id;
  }

  /**
   * Разрешение алерта
   */
  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.acknowledged = true;

    this.logger.info('AlertManager', 'Alert resolved', {
      id: alertId,
      component: alert.component,
      resolvedBy: resolvedBy || 'system'
    });

    // Уведомление о разрешении критического алерта
    if (alert.severity === AlertSeverity.CRITICAL || alert.severity === AlertSeverity.HIGH) {
      this.notifyAlertResolved(alert);
    }

    return true;
  }

  /**
   * Подтверждение алерта (без разрешения)
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.acknowledged) {
      return false;
    }

    alert.acknowledged = true;

    this.logger.info('AlertManager', 'Alert acknowledged', {
      id: alertId,
      acknowledgedBy: acknowledgedBy || 'system'
    });

    return true;
  }

  /**
   * Получение всех алертов
   */
  getAlerts(filter?: {
    component?: string;
    severity?: AlertSeverity;
    acknowledged?: boolean;
    resolved?: boolean;
    fromTime?: number;
  }): Alert[] {
    let filteredAlerts = [...this.alerts];

    if (filter) {
      if (filter.component) {
        filteredAlerts = filteredAlerts.filter(alert => alert.component === filter.component);
      }

      if (filter.severity) {
        filteredAlerts = filteredAlerts.filter(alert => alert.severity === filter.severity);
      }

      if (filter.fromTime) {
        filteredAlerts = filteredAlerts.filter(alert => alert.timestamp >= filter.fromTime!);
      }

      if (filter.acknowledged !== undefined) {
        filteredAlerts = filteredAlerts.filter(alert => alert.acknowledged === filter.acknowledged);
      }

      if (filter.resolved !== undefined) {
        filteredAlerts = filteredAlerts.filter(alert => alert.resolved === filter.resolved);
      }
    }

    // Сортировка по времени (новые первыми)
    return filteredAlerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Получение активных алертов (не разрешенных, критичных)
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved &&
      (alert.severity === AlertSeverity.CRITICAL || alert.severity === AlertSeverity.HIGH));
  }

  /**
   * Получение статистики по алертам
   */
  getAlertStats(): {
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    byComponent: Record<string, number>;
    active: number;
    acknowledged: number;
    resolved: number;
  } {
    const bySeverity: Record<AlertSeverity, number> = {
      [AlertSeverity.LOW]: 0,
      [AlertSeverity.MEDIUM]: 0,
      [AlertSeverity.HIGH]: 0,
      [AlertSeverity.CRITICAL]: 0
    };

    const byComponent: Record<string, number> = {};

    this.alerts.forEach(alert => {
      bySeverity[alert.severity]++;
      byComponent[alert.component] = (byComponent[alert.component] || 0) + 1;
    });

    const active = this.getActiveAlerts().length;
    const acknowledged = this.alerts.filter(a => a.acknowledged).length;
    const resolved = this.alerts.filter(a => a.resolved).length;

    return {
      total: this.alerts.length,
      bySeverity,
      byComponent,
      active,
      acknowledged,
      resolved
    };
  }

  /**
   * Создание алерта на основе правила
   */
  triggerAlertForRule(metricName: string, value: number, labels: Record<string, string> = {}): void {
    const matchingRules = this.findMatchingRules(metricName, value);

    matchingRules.forEach(rule => {
      // Проверка порогов по умолчанию для известных метрик
      if (this.shouldTriggerDefaultAlert(metricName, value)) {
        this.createAlert({
          severity: rule.severity,
          component: labels.component || 'unknown',
          message: this.generateAlertMessage(metricName, value, rule),
          threshold: {
            metric: rule.condition.metric,
            operator: rule.condition.operator,
            value: rule.condition.threshold,
            duration: rule.condition.duration || 300
          }
        });
      }
    });
  }

  /**
   * Добавление пользовательского правила алертов
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const ruleId = `rule_${this.alertRules.length + 1}`;
    const newRule: AlertRule = {
      ...rule,
      id: ruleId
    };

    this.alertRules.push(newRule);

    this.logger.info('AlertManager', 'Alert rule added', {
      ruleId,
      name: rule.name,
      metric: rule.condition.metric
    });

    return ruleId;
  }

  /**
   * Очистка старых разрешенных алертов
   */
  cleanupResolvedAlerts(maxAge: number = 7 * 24 * 60 * 60 * 1000): number { // неделя по умолчанию
    const cutoffTime = Date.now() - maxAge;
    const beforeCount = this.alerts.length;

    this.alerts = this.alerts.filter(alert =>
      !alert.resolved ||
      alert.timestamp > cutoffTime
    );

    const removedCount = beforeCount - this.alerts.length;

    if (removedCount > 0) {
      this.logger.debug('AlertManager', `Cleaned up ${removedCount} resolved alerts`);
    }

    return removedCount;
  }

  // ===== PRIVATE METHODS =====

  /**
   * Инициализация правил алертов по умолчанию
   */
  private initializeDefaultRules(): void {
    this.addAlertRule({
      name: 'Pyodide Memory Usage',
      description: 'High Pyodide memory usage detected',
      condition: {
        metric: 'pyodide_memory_used_mb',
        operator: '>',
        threshold: this.config.alertThresholds.maxPyodideMemory,
        duration: 300 // 5 минут
      },
      severity: AlertSeverity.MEDIUM,
      enabled: true,
      tags: ['memory', 'pyodide']
    });

    this.addAlertRule({
      name: 'Workflow Duration Timeout',
      description: 'Workflow taking too long to complete',
      condition: {
        metric: 'workflow_duration_seconds',
        operator: '>',
        threshold: this.config.alertThresholds.maxWorkflowDuration,
        duration: 60 // 1 минута
      },
      severity: AlertSeverity.HIGH,
      enabled: true,
      tags: ['workflow', 'timeout']
    });

    this.addAlertRule({
      name: 'AI API Failure Rate',
      description: 'High failure rate in AI API calls',
      condition: {
        metric: 'ai_api_errors_rate',
        operator: '>',
        threshold: this.config.alertThresholds.maxErrorRate / 100,
        duration: 600 // 10 минут
      },
      severity: AlertSeverity.HIGH,
      enabled: true,
      tags: ['ai', 'api', 'errors']
    });

    this.addAlertRule({
      name: 'Consecutive Failures',
      description: 'Too many consecutive failures detected',
      condition: {
        metric: 'consecutive_failures',
        operator: '>=',
        threshold: this.config.alertThresholds.maxConsecutiveFailures,
        duration: 3600 // 1 час
      },
      severity: AlertSeverity.CRITICAL,
      enabled: true,
      tags: ['failures', 'critical']
    });
  }

  /**
   * Поиск похожих активных алертов
   */
  private findSimilarActiveAlert(newAlert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): Alert | null {
    const similarityThreshold = 5 * 60 * 1000; // 5 минут
    const currentTime = Date.now();

    return this.alerts.find(existingAlert =>
      !existingAlert.resolved &&
      existingAlert.component === newAlert.component &&
      existingAlert.severity === newAlert.severity &&
      Math.abs(existingAlert.timestamp - currentTime) < similarityThreshold
    ) || null;
  }

  /**
   * Проверка cooldown для алертов
   */
  private isAlertOnCooldown(component: string, severity: AlertSeverity): boolean {
    const cooldownKey = `${component}_${severity}`;
    const lastFired = this.alertCooldown.get(cooldownKey);
    const cooldownTime = this.getCooldownTime(severity);

    if (!lastFired) {
      return false;
    }

    return (Date.now() - lastFired) < cooldownTime;
  }

  /**
   * Обновление cooldown для алерта
   */
  private updateAlertCooldown(component: string, severity: AlertSeverity): void {
    const cooldownKey = `${component}_${severity}`;
    this.alertCooldown.set(cooldownKey, Date.now());
  }

  /**
   * Получение времени cooldown в зависимости от severity
   */
  private getCooldownTime(severity: AlertSeverity): number {
    switch (severity) {
      case AlertSeverity.LOW: return 2 * 60 * 1000; // 2 минуты
      case AlertSeverity.MEDIUM: return 5 * 60 * 1000; // 5 минут
      case AlertSeverity.HIGH: return 10 * 60 * 1000; // 10 минут
      case AlertSeverity.CRITICAL: return 30 * 60 * 1000; // 30 минут
      default: return 5 * 60 * 1000;
    }
  }

  /**
   * Генерация сообщения для алерта
   */
  private generateAlertMessage(metricName: string, value: number, rule: AlertRule): string {
    const threshold = rule.condition.threshold;
    const direction = threshold > value ? 'below' : 'above';

    return `${rule.name}: Value ${direction} threshold (${value.toFixed(2)} vs ${threshold}) for metric ${metricName}`;
  }

  /**
   * Поиск подходящих правил для метрики
   */
  private findMatchingRules(metricName: string, value: number): AlertRule[] {
    return this.alertRules.filter(rule =>
      rule.enabled &&
      rule.condition.metric === metricName &&
      this.evaluateCondition(value, rule.condition.operator, rule.condition.threshold)
    );
  }

  /**
   * Оценка условия алерта
   */
  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }

  /**
   * Проверка, следует ли создавать алерт по умолчанию для известной метрики
   */
  private shouldTriggerDefaultAlert(metricName: string, value: number): boolean {
    switch (metricName) {
      case 'pyodide_memory_used_mb':
        return value > this.config.alertThresholds.maxPyodideMemory;
      case 'workflow_duration_seconds':
        return value > this.config.alertThresholds.maxWorkflowDuration;
      case 'ai_api_errors_rate':
        return value > (this.config.alertThresholds.maxErrorRate / 100);
      case 'consecutive_failures':
        return value >= this.config.alertThresholds.maxConsecutiveFailures;
      default:
        return true; // Создаем алерт для неизвестных метрик
    }
  }

  /**
   * Уведомление о критическом алерте
   */
  private notifyCriticalAlert(alert: Alert): void {
    // В будущем можно добавить уведомления в UI, email, webhook и т.д.
    this.logger.error('AlertManager', 'CRITICAL ALERT TRIGGERED', {
      alertId: alert.id,
      component: alert.component,
      message: alert.message,
      severity: alert.severity
    });
  }

  /**
   * Уведомление о разрешении алерта
   */
  private notifyAlertResolved(alert: Alert): void {
    this.logger.info('AlertManager', 'Alert resolved notification', {
      id: alert.id,
      component: alert.component,
      message: alert.message,
      resolvedAt: Date.now(),
      duration: Date.now() - alert.timestamp
    });
  }
}