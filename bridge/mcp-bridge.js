/**
 * bridge/mcp-bridge.js
 * 
 * Отвечает за общение основного потока с Pyodide Web Worker.
 * Использует worker-manager для получения единственного экземпляра воркера.
 */

import { getWorker } from './worker-manager.js';

// Флаг, чтобы избежать многократного назначения обработчика onmessage
let isWorkerInitialized = false; 

// Хранилище для Promise'ов, ожидающих ответа от Worker'а
const promises = new Map();

function initializeCommunication() {
    // Выполняем инициализацию только один раз
    if (isWorkerInitialized) return;

    console.log('[MCP-Bridge] Инициализация канала связи с воркером...');
    
    // Получаем (или создаем) наш единственный экземпляр воркера
    const pyodideWorker = getWorker();

    // Назначаем обработчик сообщений
    pyodideWorker.onmessage = (event) => {
        const { type, callId, result, error, func, args } = event.data;

        if (type === 'host_call') {
            // Worker просит нас вызвать функцию из hostApi.
            // На данный момент это только sendMessageToChat.
            if (window.hostApi && typeof window.hostApi[func] === 'function') {
                // Аргументы уже должны быть нативными JS-объектами,
                // так как pyodide-worker сам их конвертирует перед отправкой.
                Promise.resolve(window.hostApi[func](...args));
            } else {
                 console.error(`[MCP-Bridge] Host-функция "${func}" не найдена в window.hostApi.`);
            }
        } else if (type === 'complete' || type === 'error') {
            // Worker вернул финальный результат или ошибку для вызова инструмента.
            const promise = promises.get(callId);
            if (promise) {
                if (type === 'complete') {
                    promise.resolve(result);
                } else {
                    promise.reject(new Error(error));
                }
                promises.delete(callId);
            }
        }
    };

    isWorkerInitialized = true;
    console.log('[MCP-Bridge] Канал связи с воркером готов.');
}

/**
 * Вызывает конкретную функцию (инструмент) в Python-скрипте плагина.
 * @param {string} pluginId - ID плагина.
 * @param {string} toolName - Имя функции для вызова в Python.
 * @param {object} toolInput - Объект с именованными аргументами для функции.
 */
export async function runPythonTool(pluginId, toolName, toolInput) {
    // Убеждаемся, что канал связи настроен
    initializeCommunication();
    
    // Получаем воркер. WorkerManager вернет либо новый, либо существующий.
    const pyodideWorker = getWorker();

    const callId = `py_tool_run_${Date.now()}_${Math.random()}`;
    
    const pyScriptUrl = `public/plugins/${pluginId}/mcp_server.py`;
    const response = await fetch(pyScriptUrl);
    if (!response.ok) throw new Error(`Python script for plugin ${pluginId} not found`);
    const pythonCode = await response.text();

    return new Promise((resolve, reject) => {
        promises.set(callId, { resolve, reject });
        
        pyodideWorker.postMessage({
            type: 'run_python_tool',
            callId,
            pythonCode,
            toolName,
            toolInput
        });
    });
}