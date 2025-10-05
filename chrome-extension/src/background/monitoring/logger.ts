/**
 * Monitoring Logger - Централизованная система логирования для всех компонентов
 *
 * Поддерживает разные уровни логирования, структурированное логирование,
 * буфер сообщений и экспорт логов для диагностики
 */

import { MonitoringEvent, LogLevel, MonitoringConfig } from './monitoring-core.ts';

export interface LogFilter {
  component?: string;
  level?: LogLevel;
  fromTime?: number;
  toTime?: number;
  limit?: number;
}

export interface LogExportOptions {
  format: 'json' | 'csv' | 'text';
  includeStackTraces: boolean;
  maxEntries: number;
  timeFormat: 'iso' | 'timestamp';
}

export class MonitoringLogger {
  private config: MonitoringConfig;
  private logBuffer: MonitoringEvent[];
  private bufferSize: number = 1000;
  private isEnabled: boolean = true;
  private consolePrefix: string = '[Monitoring]';

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.logBuffer = [];
    this.setupConsoleOverrides();
  }

  /**
   * Добавление события в лог
   */
  addEvent(event: MonitoringEvent): void {
    // Добавляем стандартные поля к событию
    const enrichedEvent = {
      ...event,
      sessionId: this.getSessionId(),
      userId: this.getUserId(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    };

    // Добавляем в буфер
    this.logBuffer.push(enrichedEvent);

    // Удаляем старые записи если буфер переполнен
    if (this.logBuffer.length > this.bufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.bufferSize);
    }

    // Логирование в console если включено
    if (this.config.enableConsoleLogging && this.isEnabled) {
      this.logToConsole(enrichedEvent);
    }

    // Сохранение в storage для persistence
    this.persistLog(enrichedEvent);
  }

  /**
   * Удобные методы для разных уровней логирования
   */
  debug(component: string, message: string, data?: Record<string, any>): void {
    this.addEvent({
      component,
      level: LogLevel.DEBUG,
      message,
      data,
      timestamp: Date.now()
    });
  }

  info(component: string, message: string, data?: Record<string, any>): void {
    this.addEvent({
      component,
      level: LogLevel.INFO,
      message,
      data,
      timestamp: Date.now()
    });
  }

  warn(component: string, message: string, data?: Record<string, any>): void {
    this.addEvent({
      component,
      level: LogLevel.WARN,
      message,
      data,
      timestamp: Date.now()
    });
  }

  error(component: string, message: string, error?: Error, data?: Record<string, any>): void {
    this.addEvent({
      component,
      level: LogLevel.ERROR,
      message,
      error,
      data,
      timestamp: Date.now()
    });
  }

  critical(component: string, message: string, error?: Error, data?: Record<string, any>): void {
    this.addEvent({
      component,
      level: LogLevel.CRITICAL,
      message,
      error,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Получение логов с фильтрацией
   */
  getLogs(filter?: LogFilter): MonitoringEvent[] {
    let filtered = [...this.logBuffer];

    if (filter) {
      if (filter.component) {
        filtered = filtered.filter(log => log.component === filter.component);
      }

      if (filter.level) {
        filtered = filtered.filter(log => log.level === filter.level);
      }

      if (filter.fromTime) {
        filtered = filtered.filter(log => log.timestamp >= filter.fromTime!);
      }

      if (filter.toTime) {
        filtered = filtered.filter(log => log.timestamp <= filter.toTime!);
      }

      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Получение статистики по логам
   */
  getLogStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byComponent: Record<string, number>;
    timeRange: { from: number; to: number };
  } {
    const byLevel: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.CRITICAL]: 0
    };

    const byComponent: Record<string, number> = {};
    let minTime = Infinity;
    let maxTime = 0;

    this.logBuffer.forEach(log => {
      byLevel[log.level]++;
      byComponent[log.component] = (byComponent[log.component] || 0) + 1;
      minTime = Math.min(minTime, log.timestamp);
      maxTime = Math.max(maxTime, log.timestamp);
    });

    return {
      total: this.logBuffer.length,
      byLevel,
      byComponent,
      timeRange: {
        from: minTime === Infinity ? 0 : minTime,
        to: maxTime === 0 ? Date.now() : maxTime
      }
    };
  }

  /**
   * Экспорт логов в разных форматах
   */
  exportLogs(options: LogExportOptions = {
    format: 'json',
    includeStackTraces: true,
    maxEntries: 500,
    timeFormat: 'iso'
  }): string {
    const filteredLogs = this.getLogs({ limit: options.maxEntries });

    switch (options.format) {
      case 'json':
        return JSON.stringify(filteredLogs, null, 2);

      case 'csv':
        const headers = ['timestamp', 'level', 'component', 'message', 'data', 'error'];
        const rows = filteredLogs.map(log => [
          options.timeFormat === 'iso'
            ? new Date(log.timestamp).toISOString()
            : log.timestamp.toString(),
          log.level,
          log.component,
          log.message,
          JSON.stringify(log.data || {}),
          options.includeStackTraces ? (log.error?.stack || '') : ''
        ]);

        return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

      case 'text':
        return filteredLogs.map(log => this.formatLogForText(log, options)).join('\n');

      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Очистка всех логов
   */
  clearLogs(): void {
    this.logBuffer = [];
    this.clearPersistedLogs();
  }

  /**
   * Временное отключение логирования
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Включение логирования
   */
  enable(): void {
    this.isEnabled = true;
  }

  // ===== PRIVATE METHODS =====

  /**
   * Переопределение console методов для захвата
   */
  private setupConsoleOverrides(): void {
    const originalConsole = { ...console };

    ['log', 'info', 'warn', 'error'].forEach(method => {
      if (console[method as keyof typeof console]) {
        (console as any)[method] = (...args: any[]) => {
          const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' ');

          // Добавляем в monitoring лог
          this.addEvent({
            component: 'console',
            level: method === 'warn' ? LogLevel.WARN :
                  method === 'error' ? LogLevel.ERROR : LogLevel.INFO,
            message: `[${method.toUpperCase()}] ${message}`,
            timestamp: Date.now()
          });

          // Вызываем оригинальный метод
          originalConsole[method as keyof typeof originalConsole](...args);
        };
      }
    });
  }

  /**
   * Логирование в console с цветовым кодированием
   */
  private logToConsole(event: MonitoringEvent): void {
    const timestamp = new Date(event.timestamp).toISOString().split('T')[1].slice(0, 8);
    const prefix = `${this.consolePrefix}[${timestamp}][${event.component}][${event.level.toUpperCase()}]`;

    switch (event.level) {
      case LogLevel.DEBUG:
        console.debug(`%c${prefix} ${event.message}`, 'color: #666; font-size: 10px;');
        break;
      case LogLevel.INFO:
        console.info(`%c${prefix} ${event.message}`, 'color: #0066cc; font-weight: bold;');
        break;
      case LogLevel.WARN:
        console.warn(`%c${prefix} ${event.message}`, 'color: #ff8c00; font-weight: bold;');
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(`%c${prefix} ${event.message}`, 'color: #cc0000; font-weight: bold;');
        if (event.error) {
          console.error(event.error);
        }
        break;
    }

    if (event.data && Object.keys(event.data).length > 0) {
      console.log('Additional data:', event.data);
    }
  }

  /**
   * Форматирование лога для текстового экспорта
   */
  private formatLogForText(log: MonitoringEvent, options: LogExportOptions): string {
    const timestamp = options.timeFormat === 'iso'
      ? new Date(log.timestamp).toISOString()
      : log.timestamp.toString();

    let text = `[${timestamp}] [${log.level.toUpperCase()}] [${log.component}]: ${log.message}`;

    if (log.data && Object.keys(log.data).length > 0) {
      text += `\n  Data: ${JSON.stringify(log.data, null, 2)}`;
    }

    if (options.includeStackTraces && log.error?.stack) {
      text += `\n  Stack: ${log.error.stack}`;
    }

    return text;
  }

  /**
   * Сохранение логов в chrome.storage (для persistence через перезапуски)
   */
  private persistLog(event: MonitoringEvent): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const key = 'monitoring_logs';
        chrome.storage.local.get([key]).then(result => {
          const existingLogs = result[key] || [];
          existingLogs.push(event);

          // Keep only last 1000 entries
          const trimmedLogs = existingLogs.slice(-1000);
          chrome.storage.local.set({ [key]: trimmedLogs });
        });
      }
    } catch (error) {
      // Silently fail if storage is not available
    }
  }

  /**
   * Очистка сохраненных логов
   */
  private clearPersistedLogs(): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.remove(['monitoring_logs']);
      }
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Получение Id сессии
   */
  private getSessionId(): string {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.session) {
        // Use session storage for session ID
        const sessionKey = 'monitoring_session_id';
        chrome.storage.session.get([sessionKey]).then(result => {
          if (!result[sessionKey]) {
            const newSessionId = Math.random().toString(36).substring(2, 15);
            chrome.storage.session.set({ [sessionKey]: newSessionId });
            return newSessionId;
          }
          return result[sessionKey];
        });
      }
    } catch (error) {
      // Fallback
    }

    return `session_${Date.now()}`;
  }

  /**
   * Получение Id пользователя (анонимизированный)
   */
  private getUserId(): string {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const userKey = 'monitoring_user_id';
        chrome.storage.local.get([userKey]).then(result => {
          if (!result[userKey]) {
            // Generate anonymous user ID
            const newUserId = `user_${Math.random().toString(36).substring(2, 15)}`;
            chrome.storage.local.set({ [userKey]: newUserId });
            return newUserId;
          }
          return result[userKey];
        });
      }
    } catch (error) {
      // Fallback
    }

    return 'anonymous_user';
  }
}