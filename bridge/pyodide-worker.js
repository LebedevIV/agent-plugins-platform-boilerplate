/**
 * bridge/pyodide-worker.js
 * Финальная версия: обрабатывает async Python-функции.
 */
importScripts('../pyodide/pyodide.js');

let pyodide;
const hostCallPromises = new Map();

async function initializePyodide() {
    if (pyodide) return;

    console.log('[Pyodide Worker] Начинаю инициализацию Pyodide...');
    const startTime = performance.now();

    pyodide = await loadPyodide({ indexURL: '../pyodide/' });

    const loadTime = performance.now() - startTime;
    console.log(`[Pyodide Worker] Pyodide загружен за ${loadTime.toFixed(2)}ms`);

    // Настройка js bridge для взаимодействия с хостом
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

    // Добавление llm_call функции для AI взаимодействия
    pyodide.globals.get('js').llm_call = async (modelAlias, options) => {
        const callId = `llm_call_${Date.now()}_${Math.random()}`;
        return new Promise((resolve, reject) => {
            hostCallPromises.set(callId, { resolve, reject });
            self.postMessage({
                type: 'host_call',
                func: 'llm_call',
                callId,
                args: [modelAlias, options.toJs({ dict_converter: Object.fromEntries })]
            });
        });
    };

    // Добавление get_setting функции для настройки
    pyodide.globals.get('js').get_setting = (settingName, defaultValue, category) => {
        const callId = `get_setting_${Date.now()}_${Math.random()}`;
        return new Promise((resolve, reject) => {
            hostCallPromises.set(callId, { resolve, reject });
            self.postMessage({
                type: 'host_call',
                func: 'get_setting',
                callId,
                args: [settingName, defaultValue, category]
            });
        });
    };

    const totalInitTime = performance.now() - startTime;
    console.log(`[Pyodide Worker] Инициализация завершена за ${totalInitTime.toFixed(2)}ms`);

    // Отправляем сигнал о завершении инициализации
    self.postMessage({
        type: 'initialization_complete',
        timestamp: Date.now(),
        loadTime: totalInitTime,
        pyodideVersion: pyodide.version
    });
}

const pyodideReadyPromise = initializePyodide();

self.onmessage = async (event) => {
    // Не ждем полной инициализации для системных сообщений
    if (event.data.type === 'heartbeat') {
        self.postMessage({
            type: 'heartbeat_ack',
            timestamp: Date.now(),
            workerState: pyodide ? 'ready' : 'initializing'
        });
        return;
    }

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