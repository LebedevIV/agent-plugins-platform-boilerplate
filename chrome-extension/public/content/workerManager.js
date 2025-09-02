/**
 * Content Script Worker Manager for Agent-Plugins-Platform
 * Runs Pyodide Worker in content script context for V3 compatibility
 */

// Private module variables
let pyodideWorker = null;
let isInitialized = false;
let pendingRequests = new Map();
let hostCallPromises = new Map();

const WORKER_PATH = chrome.runtime.getURL('pyodide-worker.js');

/**
 * Initialize Pyodide Worker
 */
function initializeWorker() {
  if (isInitialized) {
    console.log('[ContentWorkerManager] Worker already initialized');
    return Promise.resolve();
  }

  console.log('[ContentWorkerManager] Starting worker initialization...');

  return new Promise((resolve, reject) => {
    try {
      console.log('[ContentWorkerManager] Creating Pyodide Worker from path:', WORKER_PATH);

      // Create Worker - this works in content script context
      pyodideWorker = new Worker(WORKER_PATH);
      console.log('[ContentWorkerManager] Worker created successfully');

      // Setup message handler
      pyodideWorker.onmessage = handleWorkerMessage;
      pyodideWorker.onerror = (error) => {
        console.error('[ContentWorkerManager] Worker error:', error);
        reject(error);
      };

      // Send health check to wait for initialization
      pyodideWorker.postMessage({
        type: 'HEALTH_CHECK',
        requestId: `init_check_${Date.now()}`,
        timestamp: Date.now()
      });

      // Wait for initialization completion
      const initTimeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 30000);

      const checkInitComplete = (event) => {
        console.log('[ContentWorkerManager] Received message during init:', event.data.type);
        if (event.data.type === 'INIT_COMPLETED') {
          clearTimeout(initTimeout);
          isInitialized = true;
          console.log('[ContentWorkerManager] Worker initialized successfully');
          pyodideWorker.removeEventListener('message', checkInitComplete);
          resolve();
        }
      };

      pyodideWorker.addEventListener('message', checkInitComplete);

    } catch (error) {
      console.error('[ContentWorkerManager] Failed to initialize worker:', error);
      reject(error);
    }
  });
}

/**
 * Handle messages from Pyodide Worker
 */
function handleWorkerMessage(event) {
  const { type, requestId, success, result, error } = event.data;

  console.log('[ContentWorkerManager] Worker message received:', type, requestId ?
    '(id: ' + requestId.substring(0, 16) + '...)' : '');

  // Handle host calls - forward to background
  if (type === 'host_call') {
    console.log('[ContentWorkerManager] Handling host call from worker');
    handleHostCall(event.data);
    return;
  }

  // Handle worker status updates
  if (type === 'pyodide_status') {
    console.log('[ContentWorkerManager] Pyodide status:', event.data);
    return;
  }

  // Handle regular responses
  if (pendingRequests.has(requestId)) {
    const request = pendingRequests.get(requestId);
    pendingRequests.delete(requestId);

    if (request) {
      if (success) {
        request.resolve(result);
      } else {
        request.reject(new Error(error || 'Worker execution failed'));
      }
    }
  }
}

/**
 * Handle host calls from worker and forward to background
 */
function handleHostCall(data) {
  const { func, args, callId } = data;

  console.log('[ContentWorkerManager] Handling host call:', func, 'callId:', callId);

  chrome.runtime.sendMessage({
    type: 'HOST_CALL_FROM_WORKER',
    func,
    args,
    callId,
    source: 'content_script_worker'
  }, (response) => {
    console.log('[ContentWorkerManager] Host call response received:', { callId, hasResponse: !!response, response });
    // Forward response back to worker
    if (pyodideWorker) {
      console.log('[ContentWorkerManager] Forwarding response to worker:', callId);
      pyodideWorker.postMessage({
        type: 'host_result',
        callId,
        result: response,
        success: !response?.error
      });
    } else {
      console.error('[ContentWorkerManager] Cannot forward response - pyodideWorker is null');
    }
  });
}

/**
 * Execute Python code in worker
 */
async function executePython(code) {
  if (!pyodideWorker) {
    await initializeWorker();
  }

  return new Promise((resolve, reject) => {
    const requestId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Worker execution timeout'));
    }, 60000);

    pendingRequests.set(requestId, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    });

    pyodideWorker.postMessage({
      type: 'EXECUTE_PYTHON',
      code,
      requestId,
      timestamp: Date.now()
    });
  });
}

/**
 * Execute Python error test in worker
 */
async function executePythonErrorTest(code) {
  if (!pyodideWorker) {
    await initializeWorker();
  }

  return new Promise((resolve, reject) => {
    const requestId = `error_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Worker error test timeout'));
    }, 30000);

    pendingRequests.set(requestId, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        resolve({ success: false, error: error.message }); // Resolve on error for tests
      }
    });

    pyodideWorker.postMessage({
      type: 'EXECUTE_PYTHON_ERROR_TEST',
      code,
      requestId,
      timestamp: Date.now()
    });
  });
}

/**
 * Run Python tool in worker
 */
async function runPythonTool(pythonCode, toolName, toolInput) {
  if (!pyodideWorker) {
    await initializeWorker();
  }

  return new Promise((resolve, reject) => {
    const requestId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Tool execution timeout'));
    }, 60000);

    pendingRequests.set(requestId, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    });

    pyodideWorker.postMessage({
      type: 'run_python_tool',
      pythonCode,
      toolName,
      toolInput,
      callId: requestId,
      timestamp: Date.now()
    });
  });
}

// Public API for message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ContentWorkerManager] Received message:', message.type, 'from:', sender?.id || 'unknown');

  if (message.type === 'WORKER_EXECUTE_PYTHON') {
    console.log('[ContentWorkerManager] Processing WORKER_EXECUTE_PYTHON:', message.code?.substring(0, 100) + '...');
    (async () => {
      try {
        console.log('[ContentWorkerManager] Starting Python execution...');
        const result = await executePython(message.code);
        console.log('[ContentWorkerManager] Python execution successful, result:', result);
        sendResponse({ success: true, result });
      } catch (error) {
        console.error('[ContentWorkerManager] Python execution failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'WORKER_EXECUTE_PYTHON_ERROR_TEST') {
    console.log('[ContentWorkerManager] Processing WORKER_EXECUTE_PYTHON_ERROR_TEST');
    (async () => {
      try {
        const result = await executePythonErrorTest(message.code);
        console.log('[ContentWorkerManager] Error test execution completed');
        sendResponse({ success: true, result });
      } catch (error) {
        console.error('[ContentWorkerManager] Error test execution failed:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'WORKER_RUN_PYTHON_TOOL') {
    console.log('[ContentWorkerManager] Processing WORKER_RUN_PYTHON_TOOL:', message.toolName);
    (async () => {
      try {
        const result = await runPythonTool(message.pythonCode, message.toolName, message.toolInput);
        console.log('[ContentWorkerManager] Python tool execution completed');
        sendResponse({ success: true, result });
      } catch (error) {
        console.error('[ContentWorkerManager] Python tool execution failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'WORKER_HEALTH_CHECK') {
    console.log('[ContentWorkerManager] Processing WORKER_HEALTH_CHECK');
    (async () => {
      try {
        await initializeWorker();
        console.log('[ContentWorkerManager] Health check completed, worker ready:', isInitialized);
        sendResponse({ success: true, isReady: isInitialized });
      } catch (error) {
        console.error('[ContentWorkerManager] Health check failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  return false;
});

// Initialize on page load
console.log('[ContentWorkerManager] Content script loaded and ready');
console.log('[ContentWorkerManager] Available message types: WORKER_EXECUTE_PYTHON, WORKER_EXECUTE_PYTHON_ERROR_TEST, WORKER_RUN_PYTHON_TOOL, WORKER_HEALTH_CHECK');
console.log('[ContentWorkerManager] WorkerManager API exported to window.ContentWorkerManager');

// Export for potential programmatic access
window.ContentWorkerManager = {
  initializeWorker,
  executePython,
  executePythonErrorTest,
  runPythonTool,
  isInitialized: () => isInitialized
};