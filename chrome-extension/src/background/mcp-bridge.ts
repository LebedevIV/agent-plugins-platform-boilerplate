/**
 * MCP Bridge for Agent-Plugins-Platform
 * Handles communication between main thread and Pyodide Web Worker
 * Implements bidirectional communication for Python -> Host calls
 */

import { getWorker } from './worker-manager';

interface WorkerMessage {
  type: string;
  callId?: string;
  result?: any;
  error?: string;
  func?: string;
  args?: any[];
  status?: string;
  message?: string;
}

interface PromiseResolver {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

let isWorkerInitialized = false;
const promises = new Map<string, PromiseResolver>();

function initializeCommunication() {
  if (isWorkerInitialized) return;
  const pyodideWorker = getWorker();

  pyodideWorker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const { type, callId, result, error, func, args, status, message } = event.data;

    if (type === 'pyodide_status') {
      // Handle status messages from Pyodide
      if ((window as any).activeWorkflowLogger) {
        const statusType = status === 'loading' ? 'info' : status === 'ready' ? 'success' : 'error';
        (window as any).activeWorkflowLogger.addMessage('PYODIDE', message, statusType);
      }
      return;
    }

    if (type === 'host_call') {
      if ((window as any).hostApi && typeof (window as any).hostApi[func!] === 'function') {
        Promise.resolve((window as any).hostApi[func!](...args!))
          .then((hostResult: any) => {
            // Send result back to worker
            pyodideWorker.postMessage({ type: 'host_result', callId, result: hostResult });
          })
          .catch((hostError: Error) => {
            // Send error back to worker
            pyodideWorker.postMessage({ type: 'host_result', callId, error: hostError.message });
          });
      }
    } else if (type === 'complete' || type === 'error') {
      const promise = promises.get(callId!);
      if (promise) {
        if (type === 'complete') promise.resolve(result);
        else promise.reject(new Error(error));
        promises.delete(callId!);
      }
    }
  };
  isWorkerInitialized = true;
}

export async function runPythonTool(pluginId: string, toolName: string, toolInput: any): Promise<any> {
  initializeCommunication();
  const pyodideWorker = getWorker();
  const callId = `py_tool_run_${Date.now()}_${Math.random()}`;
  
  const pyScriptUrl = chrome.runtime.getURL(`plugins/${pluginId}/mcp_server.py`);
  const response = await fetch(pyScriptUrl);
  if (!response.ok) throw new Error(`Python script для плагина ${pluginId} не найден`);
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