/**
 * bridge/pyodide-worker.js
 * 
 * Web Worker, в котором живет Pyodide.
 */

importScripts('../pyodide/pyodide.js');

let pyodide;

async function initializePyodide() {
    if (pyodide) return;
    console.log("[Worker] ⏳ Initializing Pyodide...");
    pyodide = await loadPyodide();

    pyodide.globals.set('js', {
        sendMessageToChat: (message) => {
            const jsMessage = message.toJs({ dict_converter: Object.fromEntries });
            self.postMessage({ type: 'host_call', func: 'sendMessageToChat', args: [jsMessage] });
        }
    });
    console.log("[Worker] ✅ Pyodide loaded.");
}

const pyodideReadyPromise = initializePyodide();

self.onmessage = async (event) => {
    await pyodideReadyPromise;
    const { type, callId } = event.data;

    if (type === 'run_python_tool') {
        const { pythonCode, toolName, toolInput } = event.data;
        try {
            await pyodide.runPythonAsync(pythonCode);

            const toolFunc = pyodide.globals.get(toolName);
            if (!toolFunc) {
                throw new Error(`Python function "${toolName}" not found in script.`);
            }

            // --- ▼▼▼ РЕШАЮЩЕЕ ИЗМЕНЕНИЕ ▼▼▼ ---
            
            // Вместо всех сложных манипуляций, просто вызываем Python-функцию напрямую,
            // передавая ей JS-объект. Pyodide сам преобразует его в kwargs.
            const resultProxy = await toolFunc(toolInput);
            
            // --- ▲▲▲ КОНЕЦ ИЗМЕНЕНИЯ ▲▲▲ ---

            const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
            resultProxy.destroy();

            self.postMessage({ type: 'complete', callId, result });

        } catch (e) {
            console.error(`[Worker] Error executing Python tool "${toolName}":`, e);
            self.postMessage({ type: 'error', callId, error: e.message });
        }
    }
};