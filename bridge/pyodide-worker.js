importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js');

let pyodide;
const callPromises = new Map();

async function initializePyodide() {
    console.log("[Worker] ⏳ Initializing Pyodide...");
    pyodide = await loadPyodide();
    // Создаем прокси-объект, который будет доступен в Python как `js`
    pyodide.globals.set('js', {
        sendMessageToChat_bridge: (message) => {
             return new Promise(resolve => {
                self.postMessage({ type: 'host_call', func: 'sendMessageToChat', args: [message.toJs({ dict_converter: Object.fromEntries })] });
                resolve();
            });
        },
        getActivePageContent_bridge: (selectors) => {
            const callId = `call_${Date.now()}_${Math.random()}`;
            self.postMessage({ type: 'host_call', callId, func: 'getActivePageContent', args: [selectors.toJs({ dict_converter: Object.fromEntries })] });
            return new Promise(resolve => {
                callPromises.set(callId, resolve);
            });
        }
    });
    console.log("[Worker] ✅ Pyodide loaded.");
}
const pyodideReadyPromise = initializePyodide();

self.onmessage = async (event) => {
    await pyodideReadyPromise;
    const { type, callId, result, pythonCode, mcpRequest } = event.data;

    switch (type) {
        case 'host_result':
            const promiseResolver = callPromises.get(callId);
            if (promiseResolver) {
                promiseResolver(result);
                callPromises.delete(callId);
            }
            break;

        case 'run_python':
            try {
                pyodide.setStdin({ stdin: () => JSON.stringify(mcpRequest) + '\n' });
                let capturedResult = '';
                pyodide.setStdout({ batched: (str) => { capturedResult += str + '\n'; } });
                
                // ▼▼▼ ГЛАВНОЕ ИЗМЕНЕНИЕ ▼▼▼
                // Сначала просто выполняем код, чтобы ОПРЕДЕЛИТЬ функции
                await pyodide.runPythonAsync(pythonCode);
                // А теперь "достаем" главную функцию и "ждем" ее
                const mainFunc = pyodide.globals.get('main');
                await mainFunc();
                // ▲▲▲ КОНЕЦ ГЛАВНОГО ИЗМЕНЕНИЯ ▲▲▲

                const resultJson = JSON.parse(capturedResult.trim());
                if (resultJson.error) { throw new Error(resultJson.error); }
                self.postMessage({ type: 'complete', callId, result: resultJson.result });
            } catch (e) {
                self.postMessage({ type: 'error', callId, error: e.message });
            }
            break;
    }
};