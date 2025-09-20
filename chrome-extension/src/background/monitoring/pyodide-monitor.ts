/**
 * Pyodide Worker Monitor - Специфический компонент для мониторинга Pyodide worker
 *
 * Отслеживает здоровье Python среды, управление памятью, сборку мусора
 * и жизненный цикл Pyodide worker процессов
 */

import type { MonitoringCore } from './monitoring-core.js';

export interface PyodideHealthStatus {
  isInitialized: boolean;
  memoryUsage: {
    used: number; // MB
    total: number; // MB
    free: number; // MB
    heapSize: number; // bytes
  };
  workerState: 'running' | 'idle' | 'crashed' | 'terminated';
  packagesInstalled: string[];
  lastHeartbeat: number;
  errorCount: number;
  operationCount: number;
}

export interface PyodideMemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  allocatedGarbageCollector: number;
  peak: number;
  error: string | null;
}

export interface PyodideWorkerEvent {
  type: 'initialized' | 'error' | 'memory_warning' | 'package_loaded' | 'shutdown';
  message: string;
  data?: any;
  timestamp: number;
  workerId: string;
}

export class PyodideMonitor {
  private healthStatus: PyodideHealthStatus;
  private memoryHistory: PyodideMemoryMetrics[] = [];
  private eventHistory: PyodideWorkerEvent[] = [];
  private monitoringCore: MonitoringCore;
  private workerEventListeners: Map<string, (event: PyodideWorkerEvent) => void> = new Map();
  private memorySnapshotInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private maxHistorySize: number = 100;

  constructor(monitoringCore: MonitoringCore) {
    this.monitoringCore = monitoringCore;
    this.healthStatus = this.createInitialHealthStatus();
    this.initializeMonitoring();
  }

  /**
   * Инициализация мониторинга Pyodide
   */
  private initializeMonitoring(): void {
    // Интервал для снятия снимков памяти
    this.memorySnapshotInterval = setInterval(() => {
      this.captureMemorySnapshot();
    }, 30000); // каждые 30 секунд

    // Heartbeat для проверки живости worker
    this.heartbeatInterval = setInterval(() => {
      this.checkWorkerHeartbeat();
    }, 60000); // каждая минута

    // Надежная установка global объектов для Pyodide
    this.setupGlobalPyodideHooks();

    this.monitoringCore.getLogger().info('PyodideMonitor', 'Pyodide monitoring initialized');
  }

  /**
   * Создание начального статуса здоровья
   */
  private createInitialHealthStatus(): PyodideHealthStatus {
    return {
      isInitialized: false,
      memoryUsage: {
        used: 0,
        total: 0,
        free: 0,
        heapSize: 0
      },
      workerState: 'idle',
      packagesInstalled: [],
      lastHeartbeat: Date.now(),
      errorCount: 0,
      operationCount: 0
    };
  }

  /**
   * Обновление статуса Pyodide
   */
  updatePyodideHealth(status: Partial<PyodideHealthStatus>): void {
    const previousState = this.healthStatus.workerState;
    this.healthStatus = { ...this.healthStatus, ...status };

    // Логирование изменений состояния
    if (previousState !== this.healthStatus.workerState) {
      this.monitoringCore.getLogger().info('PyodideMonitor', `Worker state changed: ${previousState} -> ${this.healthStatus.workerState}`);

      // Если состояние изменилось на crashed, создать алерт
      if (this.healthStatus.workerState === 'crashed') {
        this.notifyWorkerCrash();
      }
    }
  }

  /**
   * Захват снимка памяти
   */
  captureMemorySnapshot(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.isPyodideAvailable()) {
          resolve();
          return;
        }

        // Проверка доступности pyodide-api для получения метрик памяти
        const memoryMetrics = this.getPyodideMemoryMetrics();

        if (memoryMetrics) {
          this.memoryHistory.push(memoryMetrics);

          // Ограничение истории памяти
          if (this.memoryHistory.length > this.maxHistorySize) {
            this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize);
          }

          // Отправка метрик в общую систему мониторинга
          if (memoryMetrics.heapUsed) {
            const usedMB = memoryMetrics.heapUsed / (1024 * 1024);
            this.monitoringCore.trackPyodideMemory(usedMB);
          }
        }

        resolve();
      } catch (error) {
        this.monitoringCore.getLogger().error('PyodideMonitor', 'Failed to capture memory snapshot', error as Error);
        reject(error);
      }
    });
  }

  /**
   * Получение метрик памяти от Pyodide
   */
  private getPyodideMemoryMetrics(): PyodideMemoryMetrics | null {
    try {
      // Проверяем глобальные объекты Pyodide
      const pyodide = (globalThis as any).pyodide;
      const pyodide_api = (globalThis as any).pyodide_api;

      if (pyodide_api && pyodide_api.getPyodideMemoryMetrics) {
        return pyodide_api.getPyodideMemoryMetrics();
      }

      if (pyodide && pyodide._api && pyodide._api.getAllocatedMemoryBytes) {
        const heapUsed = pyodide._api.getAllocatedMemoryBytes();
        return {
          heapUsed,
          heapTotal: 0,
          external: 0,
          allocatedGarbageCollector: 0,
          peak: 0,
          error: null
        };
      }

      // Fallback: оценка на основе performance.memory API
      if (performance.memory) {
        return {
          heapUsed: performance.memory.usedJSHeapSize,
          heapTotal: performance.memory.totalJSHeapSize,
          external: 0,
          allocatedGarbageCollector: 0,
          peak: performance.memory.totalJSHeapSize,
          error: null
        };
      }

      return null;
    } catch (error) {
      return {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        allocatedGarbageCollector: 0,
        peak: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Проверка heartbeat worker
   */
  checkWorkerHeartbeat(): void {
    const timeSinceLastHeartbeat = Date.now() - this.healthStatus.lastHeartbeat;
    const maxHeartbeatInterval = 2 * 60 * 1000; // 2 минуты

    if (timeSinceLastHeartbeat > maxHeartbeatInterval) {
      // Предполагаем, что worker не отвечает
      this.updatePyodideHealth({ workerState: 'crashed' });
      this.monitoringCore.getLogger().error('PyodideMonitor', 'Worker heartbeat timeout detected');

      this.fireWorkerEvent({
        type: 'error',
        message: 'Worker heartbeat timeout',
        timestamp: Date.now(),
        workerId: 'main'
      });
    }
  }

  /**
   * Создание события worker
   */
  fireWorkerEvent(event: Omit<PyodideWorkerEvent, 'workerId'>): void {
    const workerEvent: PyodideWorkerEvent = {
      ...event,
      workerId: 'main'
    };

    this.eventHistory.push(workerEvent);

    // Ограничение истории событий
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    // Логирование важных событий
    if (event.type === 'error') {
      this.healthStatus.errorCount++;
      this.monitoringCore.getLogger().error('PyodideMonitor', `Worker event: ${event.message}`, event.data);
    } else if (event.type === 'memory_warning') {
      this.monitoringCore.getLogger().warn('PyodideMonitor', `Memory warning: ${event.message}`, event.data);
    } else {
      this.monitoringCore.getLogger().debug('PyodideMonitor', `Worker event: ${event.type}`, event.data);
    }

    // Уведомление подписчиков
    this.workerEventListeners.forEach(listener => {
      try {
        listener(workerEvent);
      } catch (error) {
        this.monitoringCore.getLogger().error('PyodideMonitor', 'Event listener error', error as Error);
      }
    });
  }

  /**
   * Инкремент счетчика операций
   */
  recordOperation(operationType: string): void {
    this.healthStatus.operationCount++;

    this.monitoringCore.getMetricsCollector().incrementCounter('pyodide_operations_total', {
      operation_type: operationType,
      worker_state: this.healthStatus.workerState
    });
  }

  /**
   * Запись пакета Python как установленного
   */
  recordPackageInstalled(packageName: string): void {
    if (!this.healthStatus.packagesInstalled.includes(packageName)) {
      this.healthStatus.packagesInstalled.push(packageName);
    }

    this.fireWorkerEvent({
      type: 'package_loaded',
      message: `Package installed: ${packageName}`,
      data: { package: packageName }
    });
  }

  /**
   * Получение полного статуса здоровья
   */
  getHealthStatus(): PyodideHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Получение истории памяти
   */
  getMemoryHistory(limit: number = 50): PyodideMemoryMetrics[] {
    return this.memoryHistory.slice(-limit);
  }

  /**
   * Получение истории событий
   */
  getEventHistory(limit: number = 50): PyodideWorkerEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Проверка доступности Pyodide
   */
  isPyodideAvailable(): boolean {
    return (
      typeof globalThis !== 'undefined' &&
      ((globalThis as any).pyodide || (globalThis as any).pyodide_api)
    );
  }

  /**
   * Установка глобальных хуков для Pyodide интеграции
   */
  private setupGlobalPyodideHooks(): void {
    // Создание глобального объекта для взаимодействия с мониторингом
    (globalThis as any).__PYODIDE_MONITOR = {
      // Метод для Pyodide worker для отправки heartbeat
      sendHeartbeat: () => {
        this.healthStatus.lastHeartbeat = Date.now();
        this.updatePyodideHealth({ workerState: 'running' });
      },

      // Метод для уведомления об ошибках
      reportError: (error: Error, context?: any) => {
        this.fireWorkerEvent({
          type: 'error',
          message: error.message,
          data: { error, context }
        });
      },

      // Метод для уведомления об установленных пакетах
      packageLoaded: (packageName: string) => {
        this.recordPackageInstalled(packageName);
      },

      // Метод для обновления состояния worker
      setWorkerState: (state: PyodideHealthStatus['workerState']) => {
        this.updatePyodideHealth({ workerState: state });
      },

      // Метод для уведомления о завершении инициализации
      initializationComplete: () => {
        this.updatePyodideHealth({
          isInitialized: true,
          workerState: 'running'
        });
      }
    };
  }

  /**
   * Уведомление о падении worker
   */
  private notifyWorkerCrash(): void {
    this.healthStatus.errorCount++;

    // Создание алерта через общую систему мониторинга
    this.monitoringCore.captureError(
      'pyodide_worker_crash',
      new Error('Pyodide worker has crashed or become unresponsive'),
      {
        component: 'pyodide',
        state: this.healthStatus,
        lastHeartbeat: this.healthStatus.lastHeartbeat
      }
    );
  }

  /**
   * Добавление обработчика событий worker
   */
  addEventListener(listener: (event: PyodideWorkerEvent) => void): string {
    const id = Math.random().toString(36).substring(2, 9);
    this.workerEventListeners.set(id, listener);
    return id;
  }

  /**
   * Удаление обработчика событий worker
   */
  removeEventListener(id: string): boolean {
    return this.workerEventListeners.delete(id);
  }

  /**
   * Очистка ресурсов при завершении работы
   */
  dispose(): void {
    if (this.memorySnapshotInterval) {
      clearInterval(this.memorySnapshotInterval);
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.workerEventListeners.clear();

    // Очистка глобальных объектов
    delete (globalThis as any).__PYODIDE_MONITOR;

    this.monitoringCore.getLogger().info('PyodideMonitor', 'Pyodide monitor disposed');
  }
}

export { PyodideHealthStatus, PyodideMemoryMetrics, PyodideWorkerEvent };