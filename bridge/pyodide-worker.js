/**
 * bridge/pyodide-worker.js
 * Финальная версия: обрабатывает async Python-функции.
 */
importScripts('../pyodide/pyodide.js');

let pyodide;
const hostCallPromises = new Map();

async function initializePyodide() {
    if (pyodide) return;
    pyodide = await loadPyodide({ indexURL: '../pyodide/' });
    
    pyodide.globals.set('js', {
        sendMessageToChat: (message) => {
            const jsMessage = message.toJs({ dict_converter: Object.fromEntries });
            self.postMessage({ type: 'host_call', func: 'sendMessageToChat', args: [jsMessage] });
        },
        host_fetch: (url) => {
            const callId = `host_call_${Date.now()}_${Math.random()}`;
            return new Promise((resolve, reject) => {
                hostCallPromises.set(callId, { resolve, reject });
                self.postMessage({ type: 'host_call', func: 'host_fetch', callId, args: [url] });
            });
        }
    });
}

const pyodideReadyPromise = initializePyodide();

self.onmessage = async (event) => {
    await pyodideReadyPromise;
    const { type, callId } = event.data;

    if (type === 'host_result') {
        console.log('[Worker] Получен ответ от хоста:', event.data);
        const promise = hostCallPromises.get(callId);
        if (promise) {
            if (event.data.error) {
                promise.reject(new Error(event.data.error));
            } else {
                // --- ▼▼▼ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ▼▼▼ ---
                // Мы должны передать в Python ВЕСЬ объект event.data.result,
                // чтобы он мог быть преобразован в JsProxy.
                promise.resolve(pyodide.toPy(event.data.result));
                // --- ▲▲▲ КОНЕЦ ИСПРАВЛЕНИЯ ▲▲▲ ---
            }
            hostCallPromises.delete(callId);
        }
    } else if (type === 'run_python_tool') {
        const { pythonCode, toolName, toolInput } = event.data;
        try {
            await pyodide.runPythonAsync(pythonCode);
            const toolFunc = pyodide.globals.get(toolName);
            if (!toolFunc) throw new Error(`Python-функция "${toolName}" не найдена.`);
            
            const resultProxy = await toolFunc(toolInput);
            const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
            resultProxy.destroy();

            self.postMessage({ type: 'complete', callId, result });
        } catch (e) {
            self.postMessage({ type: 'error', callId: callId, error: e.message });
        }
    }
};