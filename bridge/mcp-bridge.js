/**
 * bridge/mcp-bridge.js
 *
 * Отвечает за общение основного потока с Pyodide Web Worker.
 * Реализует двустороннюю связь для вызовов Python -> Host.
 * Интегрирована система мониторинга для отслеживания производительности и здоровья.
 */

// Глобальный контекст будет передаваться через параметры функций

import { getWorker, getWorkerStats } from './worker-manager.js';

// Global monitoring references from context (will be set per call)
let monitoringCore = null;
let pyodideMonitor = null;

let isWorkerInitialized = false;
const promises = new Map();

// Статистика выполнения Python инструментов
const pythonToolStats = new Map(); // callId -> stats

// Системный мониторинг теперь берется из context.monitoringCore

console.log('[MCP-BRIDGE] Module loaded - MCP Bridge ready for integration');

async function initializeCommunication(context = {}) {
    if (isWorkerInitialized) return;

    // Автоматический pre-warm Pyodide в фоне при первой инициализации
    try {
        const { preWarmPyodideWorker } = await import('./worker-manager.js');

        console.log('[MCP Bridge] 🚀 Запуск pre-warm Pyodide worker...');

        // Запуск pre-warm без блокировки - это не критично для первого использования
        preWarmPyodideWorker().then(() => {
            console.log('[MCP Bridge] ✅ Pre-warm завершен!');
        }).catch(error => {
            console.warn('[MCP Bridge] ⚠️ Pre-warm провалился, будет использоваться cold start:', error.message);
        }).finally(() => {
            // Ждем небольшой задержки чтобы pre-warm успел завершиться
            setTimeout(() => {
                console.log('[MCP Bridge] Начинаю обычную инициализацию воркера...');
                const pyodideWorker = getWorker();
                setupWorkerCommunication(pyodideWorker, context);

                if (context.monitoringCore) {
                    context.monitoringCore.addLog('mcp_bridge', 'info', 'MCP Bridge communication initialized');
                }
            }, 1000);
        });
    } catch (error) {
        console.warn('[MCP Bridge] Не удалось импортировать preWarmPyodideWorker:', error.message);
        // Fallback к обычной инициализации
        const pyodideWorker = getWorker();
        setupWorkerCommunication(pyodideWorker, context);

        if (context.monitoringCore) {
            context.monitoringCore.addLog('mcp_bridge', 'info', 'MCP Bridge communication initialized (fallback)');
        }
    }

    isWorkerInitialized = true;
}


function setupWorkerCommunication(pyodideWorker, context = {}) {
    pyodideWorker.onmessage = (event) => {
        const { type, callId, result, error, func, args } = event.data;

        if (type === 'host_call') {
            handleHostCall(event.data, context);

        } else if (type === 'complete' || type === 'error') {
            handleToolCompletion(event.data, context);

        } else if (type === 'python_log') {
            handlePythonLog(event.data, context);

        } else if (type === 'performance_metric') {
            handlePerformanceMetric(event.data, context);
        }

        // Обработка heartbeat для pre-warm
        if (type === 'heartbeat_ack') {
            console.log('[MCP Bridge] Heartbeat received from worker');
        }
    };
}

/**
 * Обработка вызова хост-функции из Python
 */
function handleHostCall(data, context) {
    const { callId, func, args } = data;
    const pyodideWorker = getWorker();

    const startTime = performance.now();

    console.log('[MCP-BRIDGE][HOST CALL] ===== HOST FUNCTION CALL FROM PYTHON =====');
    console.log('[MCP-BRIDGE][HOST CALL] Call ID:', callId);
    console.log('[MCP-BRIDGE][HOST CALL] Function:', func);
    console.log('[MCP-BRIDGE][HOST CALL] Args count:', args?.length || 0);
    console.log('[MCP-BRIDGE][HOST CALL] Context available:', {
        hostApi: !!context.hostApi,
        monitoringCore: !!context.monitoringCore
    });

    // Set monitoringCore from context for this call
    monitoringCore = context.monitoringCore;
    pyodideMonitor = context.pyodideMonitor;

    if (monitoringCore) {
        monitoringCore.addLog('mcp_bridge', 'debug', `Host call: ${func}`, {
            callId,
            argsCount: args?.length || 0
        });
    }

    const hostApi = context.hostApi;
    if (hostApi && typeof hostApi[func] === 'function') {
        console.log('[MCP-BRIDGE][HOST CALL][SUCCESS] Host API function found:', func);
        Promise.resolve(hostApi[func](...args))
            .then(hostResult => {
                const duration = performance.now() - startTime;

                // Отправляем результат обратно в воркер
                pyodideWorker.postMessage({
                    type: 'host_result',
                    callId,
                    result: hostResult
                });

                // Регистрация метрик
                if (monitoringCore) {
                    monitoringCore.getMetricsCollector().recordHistogram(
                        'host_api_call_duration_seconds',
                        duration / 1000,
                        { function: func, success: 'true' }
                    );

                    monitoringCore.getMetricsCollector().incrementCounter('host_api_calls_total', {
                        function: func,
                        success: 'true'
                    });
                }

                if (pyodideMonitor) {
                    pyodideMonitor.recordOperation(`host_${func}`);
                }
            })
            .catch(hostError => {
                const duration = performance.now() - startTime;

                // Отправляем ошибку обратно в воркер
                pyodideWorker.postMessage({
                    type: 'host_result',
                    callId,
                    error: hostError.message
                });

                // Регистрация метрик ошибок
                if (monitoringCore) {
                    monitoringCore.captureError(`host_api_${func}_failed`, hostError, {
                        callId,
                        args,
                        duration
                    });

                    monitoringCore.getMetricsCollector().recordHistogram(
                        'host_api_call_duration_seconds',
                        duration / 1000,
                        { function: func, success: 'false' }
                    );

                    monitoringCore.getMetricsCollector().incrementCounter('host_api_calls_total', {
                        function: func,
                        success: 'false'
                    });
                }
            });
    } else {
        const errorMsg = `Host API function "${func}" not found`;

        pyodideWorker.postMessage({
            type: 'host_result',
            callId,
            error: errorMsg
        });

        if (monitoringCore) {
            monitoringCore.captureError('host_api_function_not_found', new Error(errorMsg), {
                callId,
                function: func
            });
        }
    }
}

/**
 * Обработка завершения инструмента Python
 */
function handleToolCompletion(data, context) {
    const { callId, result, error, type } = data;

    // Получение статистики выполнения
    const toolStats = pythonToolStats.get(callId);
    if (toolStats && monitoringCore) {
        const totalDuration = performance.now() - toolStats.startTime;

        if (type === 'complete') {
            monitoringCore.addLog('mcp_bridge', 'info', `Python tool completed successfully`, {
                callId,
                pluginId: toolStats.pluginId,
                toolName: toolStats.toolName,
                duration: totalDuration,
                resultSize: JSON.stringify(result).length
            });

            // Регистрация метрик успеха
            monitoringCore.getMetricsCollector().incrementCounter('python_tools_completed_total', {
                tool: toolStats.toolName,
                plugin: toolStats.pluginId
            });

            monitoringCore.getMetricsCollector().recordHistogram(
                'python_tool_duration_seconds',
                totalDuration / 1000,
                {
                    tool: toolStats.toolName,
                    plugin: toolStats.pluginId,
                    success: 'true'
                }
            );

        } else {
            monitoringCore.captureError(`python_tool_${toolStats.toolName}_failed`,
                new Error(error || 'Unknown tool error'), {
                callId,
                pluginId: toolStats.pluginId,
                toolName: toolStats.toolName,
                duration: totalDuration
            });

            monitoringCore.getMetricsCollector().incrementCounter('python_tools_failed_total', {
                tool: toolStats.toolName,
                plugin: toolStats.pluginId
            });

            monitoringCore.getMetricsCollector().recordHistogram(
                'python_tool_duration_seconds',
                totalDuration / 1000,
                {
                    tool: toolStats.toolName,
                    plugin: toolStats.pluginId,
                    success: 'false'
                }
            );
        }

        pythonToolStats.delete(callId);
    }

    // Разрешение/отклонение Promise
    const promise = promises.get(callId);
    if (promise) {
        if (type === 'complete') promise.resolve(result);
        else promise.reject(new Error(error));
        promises.delete(callId);
    }
}

/**
 * Обработка логов из Python
 */
function handlePythonLog(data, context) {
    const { callId, level, message, data: logData } = data;

    if (monitoringCore) {
        monitoringCore.addLog('python_runtime', level || 'info', message, {
            ...logData,
            callId
        });
    }
}

/**
 * Обработка метрик производительности из Python
 */
function handlePerformanceMetric(data, context) {
    const { callId, metricName, value, labels } = data;

    if (monitoringCore) {
        if (metricName.includes('memory')) {
            // Специальная обработка метрик памяти
            monitoringCore.trackPyodideMemory(value, labels?.heapTotal);

        } else if (metricName.includes('duration')) {
            // Метрики продолжительности
            monitoringCore.getMetricsCollector().recordHistogram(metricName, value / 1000, {
                ...labels,
                source: 'python_worker'
            });

        } else {
            // Универсальные метрики
            if (metricName.includes('counter')) {
                monitoringCore.getMetricsCollector().incrementCounter(metricName.replace('_counter', ''), labels);
            } else if (metricName.includes('gauge')) {
                monitoringCore.getMetricsCollector().recordGauge(metricName.replace('_gauge', ''), value, labels);
            }
        }
    }
}

export async function runPythonTool(pluginId, toolName, toolInput, context = {}) {
    const toolStartTime = performance.now();
    const callId = `py_tool_run_${Date.now()}_${Math.random()}`;

    console.log('[MCP-BRIDGE] ===== PYTHON TOOL EXECUTION STARTED =====');
    console.log('[MCP-BRIDGE][PYTHON INTEGRATION] Plugin ID:', pluginId);
    console.log('[MCP-BRIDGE][PYTHON INTEGRATION] Tool name:', toolName);
    console.log('[MCP-BRIDGE][PYTHON INTEGRATION] Call ID:', callId);
    console.log('[MCP-BRIDGE][PYTHON INTEGRATION] Context available:', {
        logger: !!context.logger,
        hostApi: !!context.hostApi,
        monitoringCore: !!context.monitoringCore
    });
    console.log('[MCP-BRIDGE][PYTHON INTEGRATION] Tool input:', toolInput);

    try {
        initializeCommunication(context);
        const pyodideWorker = getWorker();

        console.log('[MCP-BRIDGE][SUCCESS] Worker obtained, communication initialized');

        // Запись статистики выполнения
        pythonToolStats.set(callId, {
            pluginId,
            toolName,
            toolInput,
            startTime: toolStartTime,
            context
        });

        const pyScriptUrl = `plugins/${pluginId}/mcp_server.py`;
        console.log('[MCP-BRIDGE][PYTHON INTEGRATION] Python script URL:', pyScriptUrl);

        if (monitoringCore) {
            monitoringCore.addLog('mcp_bridge', 'info', `Loading Python script for plugin: ${pluginId}`, {
                callId,
                toolName,
                scriptUrl: pyScriptUrl
            });
        }

        const response = await fetch(pyScriptUrl);
        if (!response.ok) {
            throw new Error(`Python script для плагина ${pluginId} не найден: ${response.status}`);
        }

        const pythonCode = await response.text();
        const scriptLoadTime = performance.now() - toolStartTime;

        if (monitoringCore) {
            monitoringCore.getMetricsCollector().recordHistogram(
                'python_script_load_duration_seconds',
                scriptLoadTime / 1000,
                {
                    plugin: pluginId,
                    script_size: pythonCode.length
                }
            );
        }

        // Добавление monitoring hooks в контекст
        const enhancedContext = {
            ...context,
            monitoring_hooks: {
                onStart: (operation) => monitoringCore?.addLog('python_tool', 'debug', `Starting: ${operation}`, { callId }),
                onComplete: (operation) => monitoringCore?.addLog('python_tool', 'debug', `Completed: ${operation}`, { callId }),
                onError: (operation, error) => monitoringCore?.captureError(operation, error, { callId })
            },
            call_id: callId
        };

        // Запись операций в Pyodide Monitor
        if (pyodideMonitor) {
            pyodideMonitor.recordOperation(`tool_${toolName}`);
        }

        return new Promise((resolve, reject) => {
            promises.set(callId, { resolve, reject });

            // Установка таймаута на выполнение
            const timeoutMs = 30000; // 30 секунд
            const timeoutId = setTimeout(() => {
                promises.delete(callId);

                if (monitoringCore) {
                    monitoringCore.captureError('python_tool_timeout', new Error(`Tool '${toolName}' timed out`), {
                        callId,
                        pluginId,
                        timeout: timeoutMs
                    });
                }

                reject(new Error(`Timeout: Python tool '${toolName}' did not complete within ${timeoutMs}ms`));
            }, timeoutMs);

            // Очистка таймаута в resolve/reject
            const originalResolve = resolve;
            const originalReject = reject;

            resolve = (value) => {
                clearTimeout(timeoutId);
                originalResolve(value);
            };

            reject = (error) => {
                clearTimeout(timeoutId);
                originalReject(error);
            };

            pyodideWorker.postMessage({
                type: 'run_python_tool',
                callId,
                pythonCode,
                toolName,
                toolInput: enhancedContext
            });
        });

    } catch (error) {
        const duration = performance.now() - toolStartTime;

        if (monitoringCore) {
            monitoringCore.captureError('python_tool_execution_failed', error, {
                callId,
                pluginId,
                toolName,
                duration
            });
        }

        // Очистка незавершенной статистики
        pythonToolStats.delete(callId);

        throw error;
    }
}

/**
 * Получение статистики bridge
 */
export function getBridgeStats() {
    const workerStats = getWorkerStats();

    return {
        worker: workerStats,
        activePromises: promises.size,
        activeTools: pythonToolStats.size,
        monitoringEnabled: !!monitoringCore,
        pyodideMonitorEnabled: !!pyodideMonitor
    };
}