let pyodideWorker;
const promises = new Map();

function initializeWorker() {
    if (pyodideWorker) return;
    pyodideWorker = new Worker(new URL('./pyodide-worker.js', import.meta.url));

    pyodideWorker.onmessage = async (event) => {
        const { type, callId, result, error, func, args } = event.data;

        switch (type) {
            case 'host_call':
                if (window.hostApi && typeof window.hostApi[func] === 'function') {
                    const finalArgs = args.map(arg => (typeof arg?.toJs === 'function') ? arg.toJs() : arg);
                    const hostResult = await window.hostApi[func](...finalArgs);
                    if (callId && hostResult !== undefined) {
                        pyodideWorker.postMessage({ type: 'host_result', callId, result: hostResult });
                    }
                }
                break;
            
            case 'complete':
            case 'error':
                const promise = promises.get(callId);
                if (promise) {
                    type === 'complete' ? promise.resolve(result) : promise.reject(new Error(error));
                    promises.delete(callId);
                }
                break;
        }
    };
}

// ▼▼▼ ВОТ ОНО, НЕДОСТАЮЩЕЕ СЛОВО! ▼▼▼
export async function runTool(pluginId, toolName, toolInput) {
    initializeWorker();
    const callId = `tool_run_${Date.now()}_${Math.random()}`;
    const pyScriptUrl = `/plugins/${pluginId}/mcp_server.py`;
    const response = await fetch(pyScriptUrl);
    if (!response.ok) throw new Error(`Script not found: ${response.status}`);
    const pythonCode = await response.text();
    const mcpRequest = { id: `req_${Date.now()}`, tool: toolName, input: toolInput };

    return new Promise((resolve, reject) => {
        promises.set(callId, { resolve, reject });
        pyodideWorker.postMessage({ type: 'run_python', callId, pythonCode, mcpRequest });
    });
}