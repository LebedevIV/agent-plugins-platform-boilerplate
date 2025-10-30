/**
 * bridge/worker-manager.js
 *
 * Отвечает за создание и хранение единственного экземпляра Pyodide Web Worker.
 * Реализует паттерн Singleton, чтобы избежать многократной инициализации
 * тяжелого Pyodide-окружения.
 * Интегрирована система мониторинга для отслеживания здоровья worker
 */

// Приватная переменная модуля, хранящая экземпляр воркера.
let workerInstance = null;
let pyodideMonitor = null;
let monitoringCore = null;
let isPreWarming = false;
let preWarmPromise = null;

// Статистика worker для мониторинга
const workerStats = {
  createdAt: null,
  lastHeartbeat: null,
  messageCount: 0,
  errorCount: 0,
  restartCount: 0,
  currentState: 'idle', // idle, warming, running, crashed, terminated
  preWarmStartTime: null,
  preWarmEndTime: null,
  preWarmDuration: 0
};

/**
 * Pre-warm Pyodide worker для уменьшения cold start времени.
 * Вызывается заранее чтобы инициализировать Pyodide в фоне.
 * @returns {Promise<void>}
 */
export async function preWarmPyodideWorker() {
    if (preWarmPromise) {
        console.log('[WorkerManager] Pre-warm уже в процессе...');
        return preWarmPromise;
    }

    if (workerInstance && workerStats.currentState === 'running') {
        console.log('[WorkerManager] Worker уже инициализирован и готов');
        return Promise.resolve();
    }

    isPreWarming = true;
    workerStats.preWarmStartTime = Date.now();
    workerStats.currentState = 'warming';

    preWarmPromise = (async () => {
        try {
            console.log('[WorkerManager] 🚀 НАЧАЛО PRE-WARM PYODIDE...');

            if (!pyodideMonitor) {
                initializePyodideMonitoring();
            }

            // Создание воркера
            console.log('[WorkerManager] Создание воркера...');
            workerInstance = new Worker(new URL('./pyodide-worker.js', import.meta.url));

            // Обновление статистики
            workerStats.createdAt = Date.now();
            workerStats.currentState = 'running';
            workerStats.restartCount++;

            // Добавление обработчиков
            workerInstance.onerror = handleWorkerError;
            workerInstance.onmessage = handleWorkerMessage;

            // Регистрация события pre-warm
            if (pyodideMonitor) {
                pyodideMonitor.fireWorkerEvent({
                    type: 'pre_warm_started',
                    message: 'Pre-warm Pyodide worker initiated',
                    data: {
                        startTime: workerStats.preWarmStartTime,
                        workerId: workerInstance.toString()
                    }
                });
            }

            // Ждем полной инициализации Pyodide через heartbeat
            await waitForPyodideInitialization();

            workerStats.preWarmEndTime = Date.now();
            workerStats.preWarmDuration = workerStats.preWarmEndTime - workerStats.preWarmStartTime;

            console.log(`[WorkerManager] ✅ PRE-WARM ЗАВЕРШЕН! Время: ${workerStats.preWarmDuration}ms`);

            // Регистрация успешного завершения
            if (pyodideMonitor) {
                pyodideMonitor.fireWorkerEvent({
                    type: 'pre_warm_completed',
                    message: `Pre-warm completed in ${workerStats.preWarmDuration}ms`,
                    data: {
                        duration: workerStats.preWarmDuration,
                        timestamp: workerStats.preWarmEndTime
                    }
                });
            }

            // Запуск heartbeat после pre-warm
            initializeHeartbeat();

        } catch (error) {
            console.error('[WorkerManager] ❌ ОШИБКА PRE-WARM:', error);
            workerStats.currentState = 'crashed';

            if (monitoringCore) {
                monitoringCore.captureError('pre_warm_failed', error, {
                    component: 'worker_manager',
                    preWarmStartTime: workerStats.preWarmStartTime
                });
            }

            throw error;
        } finally {
            isPreWarming = false;
            preWarmPromise = null;
        }
    })();

    return preWarmPromise;
}

/**
 * Ждет полной инициализации Pyodide через механизм heartbeat
 * @returns {Promise<void>}
 */
function waitForPyodideInitialization(timeoutMs = 35000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        let initialized = false;

        const checkInitialization = (event) => {
            const { type } = event.data || {};

            if (type === 'initialization_complete' || type === 'heartbeat') {
                initialized = true;
                workerInstance.removeEventListener('message', checkInitialization);
                resolve();
            }
        };

        // Слушаем сообщения от воркера
        workerInstance.addEventListener('message', checkInitialization);

        // Таймаут
        setTimeout(() => {
            if (!initialized) {
                workerInstance.removeEventListener('message', checkInitialization);
                const error = new Error(`Pyodide initialization timeout after ${Date.now() - startTime}ms`);
                reject(error);
            }
        }, timeoutMs);
    });
}

/**
 * Получить статус pre-warm
 * @returns {Object}
 */
export function getPreWarmStatus() {
    return {
        isPreWarming,
        isPreWarmed: workerStats.preWarmEndTime !== null,
        preWarmDuration: workerStats.preWarmDuration,
        workerState: workerStats.currentState,
        preWarmStartTime: workerStats.preWarmStartTime,
        preWarmEndTime: workerStats.preWarmEndTime
    };
}

/**
 * Возвращает единственный экземпляр Pyodide воркера.
 * Если воркер еще не создан, создает его. Если выполняется pre-warm, ждет его завершения.
 * @returns {Worker}
 */
export function getWorker() {
    if (!workerInstance) {
        console.log('[WorkerManager] Экземпляр воркера не найден. Создание нового...');

        // Если pre-warm в процессе, подождем его
        if (isPreWarming && preWarmPromise) {
            console.log('[WorkerManager] Pre-warm в процессе, ожидаем завершения...');
            // В этом случае мы не можем ждать асинхронно, поэтому бросим воркер обычным способом
            // Pre-warmed воркер должен быть уже готов к этому времени
        }

        try {
            // Инициализация системы мониторинга (если еще не инициализирована)
            if (!pyodideMonitor) {
                initializePyodideMonitoring();
            }

            // Создаем воркер (синхронно, без pre-warm)
            workerInstance = new Worker(new URL('./pyodide-worker.js', import.meta.url));

            // Обновление статистики
            workerStats.createdAt = Date.now();
            workerStats.currentState = 'running';
            workerStats.restartCount++;

            // Регистрация успешного создания в мониторинге
            if (pyodideMonitor) {
                pyodideMonitor.fireWorkerEvent({
                    type: 'initialized',
                    message: 'Pyodide worker created successfully (cold start)',
                    data: {
                        workerId: workerInstance.toString(),
                        timestamp: workerStats.createdAt,
                        isPreWarmed: false
                    }
                });
            }

            // Добавление обработчиков
            workerInstance.onerror = handleWorkerError;
            workerInstance.onmessage = handleWorkerMessage;

            // Инициализация heartbeat механизма
            initializeHeartbeat();

            if (pyodideMonitor) {
                pyodideMonitor.updatePyodideHealth({
                    isInitialized: false, // будет установлен в true после полноценной инициализации
                    workerState: 'running'
                });
            }

        } catch (error) {
            console.error('[WorkerManager] Failed to create worker:', error);

            if (monitoringCore) {
                monitoringCore.captureError('worker_creation_failed', error, {
                    component: 'worker_manager',
                    isPreWarmedWorker: false
                });
            }

            workerStats.currentState = 'crashed';
            throw error;
        }

    } else {
        const isFromPreWarm = workerStats.preWarmEndTime !== null;
        console.log(`[WorkerManager] Возвращение существующего экземпляра воркера ${isFromPreWarm ? '(pre-warmed)' : '(cold start)'}.`);
    }

    return workerInstance;
}

/**
 * Инициализация мониторинга Pyodide
 */
function initializePyodideMonitoring() {
    try {
        // Асинхронная загрузка системы мониторинга
        import('./../chrome-extension/src/background/monitoring/index.js').then(module => {
            monitoringCore = module.initializeMonitoring({
                sampleRate: 0.8, // высокая частота для worker мониторинга
                enableMemoryTracking: true
            });

            // Инициализация Pyodide Monitor
            const { PyodideMonitor } = module;
            pyodideMonitor = new PyodideMonitor(monitoringCore);

            monitoringCore.addLog('worker_manager', 'info', 'Pyodide monitoring initialized', {
                timestamp: Date.now()
            });
        }).catch(err => {
            console.warn('[WorkerManager] Cannot load monitoring system:', err.message);
        });
    } catch (error) {
        console.warn('[WorkerManager] Cannot initialize Pyodide monitoring:', error.message);
    }
}

/**
 * Обработчик ошибок worker с интеграцией мониторинга
 */
function handleWorkerError(error) {
    console.error('[WorkerManager] КРИТИЧЕСКАЯ ОШИБКА ВОРКЕРА:', error);

    workerStats.errorCount++;
    workerStats.currentState = 'crashed';

    // Логирование в систему мониторинга
    if (monitoringCore) {
        monitoringCore.captureError('pyodide_worker_critical_error', new Error(error.message), {
            component: 'worker_manager',
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno,
            errorCount: workerStats.errorCount
        });
    }

    if (pyodideMonitor) {
        pyodideMonitor.fireWorkerEvent({
            type: 'error',
            message: `Worker critical error: ${error.message}`,
            data: {
                filename: error.filename,
                lineno: error.lineno,
                colno: error.colno,
                errorCount: workerStats.errorCount
            }
        });

        pyodideMonitor.updatePyodideHealth({
            workerState: 'crashed',
            packagesInstalled: []
        });
    }

    // Сброс инстанса для повторного создания при следующем запросе
    workerInstance = null;

    // Попытка автоматического перезапуска через short delay
    setTimeout(() => {
        if (monitoringCore) {
            monitoringCore.addLog('worker_manager', 'info', 'Attempting worker restart after error');
        }
        // Следующий вызов getWorker() автоматически пересоздаст worker
    }, 1000);
}

/**
 * Обработчик сообщений worker для статистики
 */
function handleWorkerMessage(event) {
    workerStats.messageCount++;
    workerStats.lastHeartbeat = Date.now();

    // Обработка специальных сообщений от worker
    const { type, callId } = event.data || {};

    if (type === 'heartbeat') {
        // Обновление heartbeat в мониторинге
        if (pyodideMonitor) {
            pyodideMonitor.fireWorkerEvent({
                type: 'initialized', // heartbeat как признак работы
                message: 'Worker heartbeat received',
                data: { lastHeartbeat: workerStats.lastHeartbeat }
            });
        }
    }

    if (type === 'initialization_complete') {
        // Worker полностью инициализирован
        if (pyodideMonitor) {
            pyodideMonitor.updatePyodideHealth({
                isInitialized: true,
                workerState: 'running'
            });

            pyodideMonitor.fireWorkerEvent({
                type: 'initialized',
                message: 'Worker initialization completed',
                data: { initializationTime: Date.now() - workerStats.createdAt }
            });
        }
    }
}

/**
 * Инициализация heartbeat механизма
 */
function initializeHeartbeat() {
    if (pyodideMonitor) {
        // Отправка heartbeat сообщений в worker
        setInterval(() => {
            if (workerInstance && workerStats.currentState === 'running') {
                try {
                    workerInstance.postMessage({
                        type: 'heartbeat',
                        timestamp: Date.now()
                    });
                } catch (error) {
                    console.warn('[WorkerManager] Cannot send heartbeat:', error);
                }
            }
        }, 30000); // каждые 30 секунд
    }
}

/**
 * Получение статистики worker
 */
export function getWorkerStats() {
    return {
        ...workerStats,
        isHealthy: workerStats.currentState === 'running',
        uptime: workerStats.createdAt ? Date.now() - workerStats.createdAt : 0,
        errorsPerHour: workerStats.errorCount / Math.max(workerStats.uptime / 3600000, 1)
    };
}

/**
 * Принудительный рестарт worker с мониторингом
 */
export function restartWorker() {
    if (preWarmPromise) {
        preWarmPromise = null; // Сброс pre-warm состояния при рестарте
    }
    isPreWarming = false;
    workerStats.preWarmStartTime = null;
    workerStats.preWarmEndTime = null;
    workerStats.preWarmDuration = 0;
    if (monitoringCore) {
        monitoringCore.addLog('worker_manager', 'warn', 'Manual worker restart initiated');
    }

    if (workerInstance) {
        workerInstance.terminate();
        workerInstance = null;
    }

    workerStats.currentState = 'terminated';

    // Небольшая задержка перед созданием нового worker
    setTimeout(() => {
        try {
            getWorker(); // автоматически создаст новый worker
        } catch (error) {
            if (monitoringCore) {
                monitoringCore.captureError('worker_restart_failed', error, { component: 'worker_manager' });
            }
        }
    }, 500);
}