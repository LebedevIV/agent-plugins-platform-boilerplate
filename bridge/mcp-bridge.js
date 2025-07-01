/**
 * bridge/mcp-bridge.js
 * 
 * Отвечает за общение основного потока с Pyodide Web Worker.
 */

let pyodideWorker;
const promises = new Map();

function initializeWorker() {
    if (pyodideWorker) return;

    // --- ▼▼▼ ИЗМЕНЕНИЕ ЗДЕСЬ ▼▼▼ ---
    // Убираем `{ type: 'module' }`. Загружаем воркер как классический скрипт.
    pyodideWorker = new Worker(new URL('./pyodide-worker.js', import.meta.url));
    // --- ▲▲▲ КОНЕЦ ИЗМЕНЕНИЯ ▲▲▲ ---

    pyodideWorker.onmessage = (event) => {
        const { type, callId, result, error, func, args } = event.data;

        if (type === 'host_call') {
            if (window.hostApi && typeof window.hostApi[func] === 'function') {
                const finalArgs = args.map(arg => (typeof arg?.toJs === 'function') ? arg.toJs({ dict_converter: Object.fromEntries }) : arg);
                
                Promise.resolve(window.hostApi[func](...finalArgs))
                    .then(hostResult => {
                        if (callId && hostResult !== undefined) {
                            pyodideWorker.postMessage({ type: 'host_result', callId, result: hostResult });
                        }
                    });
            }
        } else if (type === 'complete' || type === 'error') {
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
}

/**
 * Вызывает конкретную функцию (инструмент) в Python-скрипте плагина.
 */
export async function runPythonTool(pluginId, toolName, toolInput) {
    initializeWorker();
    
    const callId = `py_tool_run_${Date.now()}_${Math.random()}`;
    
    const pyScriptUrl = `public/plugins/${pluginId}/mcp_server.py`;
    const response = await fetch(pyScriptUrl);
    if (!response.ok) throw new Error(`Python script for plugin ${pluginId} not found at ${pyScriptUrl}`);
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