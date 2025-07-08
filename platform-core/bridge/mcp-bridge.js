/**
 * bridge/mcp-bridge.js
 * 
 * Отвечает за общение основного потока с Pyodide Web Worker.
 * Реализует двустороннюю связь для вызовов Python -> Host.
 */

import { getWorker } from './worker-manager.js';

let isWorkerInitialized = false; 
const promises = new Map();

function initializeCommunication() {
    if (isWorkerInitialized) return;
    const pyodideWorker = getWorker();

    pyodideWorker.onmessage = (event) => {
        const { type, callId, result, error, func, args } = event.data;

        if (type === 'host_call') {
            if (window.hostApi && typeof window.hostApi[func] === 'function') {
                Promise.resolve(window.hostApi[func](...args))
                    .then(hostResult => {
                        // Отправляем результат обратно в воркер
                        pyodideWorker.postMessage({ type: 'host_result', callId, result: hostResult });
                    })
                    .catch(hostError => {
                        // Отправляем ошибку обратно в воркер
                        pyodideWorker.postMessage({ type: 'host_result', callId, error: hostError.message });
                    });
            }
        } else if (type === 'complete' || type === 'error') {
            const promise = promises.get(callId);
            if (promise) {
                if (type === 'complete') promise.resolve(result);
                else promise.reject(new Error(error));
                promises.delete(callId);
            }
        }
    };
    isWorkerInitialized = true;
}

export async function runPythonTool(pluginId, toolName, toolInput) {
    initializeCommunication();
    const pyodideWorker = getWorker();
    const callId = `py_tool_run_${Date.now()}_${Math.random()}`;
    
    const pyScriptUrl = `plugins/${pluginId}/mcp_server.py`;
    const response = await fetch(pyScriptUrl);
    if (!response.ok) throw new Error(`Python script для плагина ${pluginId} не найден`);
    const pythonCode = await response.text();

    return new Promise((resolve, reject) => {
        promises.set(callId, { resolve, reject });
        pyodideWorker.postMessage({
            type: 'run_python_tool', callId, pythonCode, toolName, toolInput
        });
    });
}