/**
 * Pyodide Service Worker for Agent-Plugins-Platform
 * Handles Pyodide initialization and execution in Manifest V3 compliant way
 * No unsafe-eval required - uses importScripts() for loading Pyodide
 * Provides clean messaging interface for Pyodide tool execution
 */

// Service Worker context with Pyodide bridge
const self = this;

// Global state management
let pyodideInitialized = false;
let pyodideInstance = null;
let initializationPromise = null;

// Pyodide bridge functions for Python-to-JS communication
function setupPyodideBridge() {
  if (!pyodideInstance) {
    console.error('[ServiceWorker] Pyodide not initialized, cannot setup bridge');
    return;
  }

  // Create JavaScript bridge for Python plugins
  pyodideInstance.globals.set('js', {
    // LLM call function for Python plugins
    llm_call: async (modelAlias, options) => {
      return new Promise((resolve, reject) => {
        try {
          const jsOptions = options.toJs ? options.toJs({ dict_converter: Object.fromEntries }) : options;

          const request = {
            type: 'LLM_CALL_SERVICE_WORKER',
            modelAlias: modelAlias,
            options: jsOptions,
            timestamp: Date.now()
          };

          // Send to background script via messaging
          self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            if (clients.length > 0) {
              clients[0].postMessage(request);
            }
          });

          // Store promise for resolution
          const callId = `llm_call_${Date.now()}_${Math.random()}`;
          resolve(self.pyodide.toPy({ callId }));

        } catch (error) {
          console.error('[ServiceWorker] llm_call failed:', error);
          reject(error);
        }
      });
    },

    // Host fetch function for Python plugins
    host_fetch: async (url) => {
      try {
        console.log('[ServiceWorker] host_fetch called for:', url);
        const response = await fetch(url);
        const data = await response.text();
        return data;
      } catch (error) {
        console.error('[ServiceWorker] host_fetch failed:', error);
        throw error;
      }
    },

    // Get setting function for Python plugins
    get_setting: (settingName, defaultValue, category) => {
      console.log('[ServiceWorker] get_setting called for:', settingName);
      return defaultValue;
    },

    // Send message to background chat system
    send_message_to_chat: (message) => {
      try {
        const jsMessage = message.toJs ? message.toJs({ dict_converter: Object.fromEntries }) : message;
        console.log('[ServiceWorker] sendMessageToChat called with:', jsMessage);

        // Send to background script
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          console.log('[ServiceWorker] sendMessageToChat: Found clients:', clients.length);
          if (clients.length > 0) {
            console.log('[ServiceWorker] sendMessageToChat: Sending to client[0]');
            clients[0].postMessage({
              type: 'PYODIDE_MESSAGE_SERVICE_WORKER',
              message: jsMessage,
              timestamp: Date.now()
            });
            console.log('[ServiceWorker] sendMessageToChat: Post message sent successfully');
          } else {
            console.error('[ServiceWorker] sendMessageToChat: No clients found to send message');
          }
        }).catch(error => {
          console.error('[ServiceWorker] sendMessageToChat: Error finding clients:', error);
        });

        return true;
      } catch (error) {
        console.error('[ServiceWorker] sendMessageToChat failed:', error);
        return false;
      }
    }
  });

  console.log('[ServiceWorker] Pyodide JavaScript bridge setup completed');
}

// Initialize Pyodide in service worker context
async function initializePyodide() {
  if (pyodideInitialized) {
    console.log('[ServiceWorker] Pyodide already initialized');
    return;
  }

  if (initializationPromise) {
    console.log('[ServiceWorker] Pyodide initialization already in progress');
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('[ServiceWorker] Starting Pyodide initialization...');

      // Send status update
      await notifyStatus('loading', 'Загрузка Python среды...');

      // Load Pyodide script using importScripts (Manifest V3 compliant)
      const pyodideScriptUrl = '/pyodide/pyodide.js';
      console.log('[ServiceWorker] Loading Pyodide script from:', pyodideScriptUrl);

      try {
        self.importScripts(pyodideScriptUrl);
        console.log('[ServiceWorker] Pyodide script loaded successfully');
      } catch (scriptError) {
        console.error('[ServiceWorker] Failed to load Pyodide script:', scriptError);
        await notifyStatus('error', `Ошибка загрузки Pyodide скрипта: ${scriptError.message}`);
        throw scriptError;
      }

      // Verify loadPyodide function is available
      if (typeof self.loadPyodide !== 'function') {
        const errorMsg = 'loadPyodide function not found after script load';
        console.error('[ServiceWorker] ' + errorMsg);
        await notifyStatus('error', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('[ServiceWorker] loadPyodide function verified');

      // Initialize Pyodide instance
      console.log('[ServiceWorker] Initializing Pyodide runtime...');

      pyodideInstance = await self.loadPyodide({
        indexURL: '/pyodide/',
        jsglobals: self
      });

      console.log('[ServiceWorker] Pyodide runtime initialized successfully');

      // Setup JavaScript bridge
      setupPyodideBridge();

      pyodideInitialized = true;

      await notifyStatus('ready', 'Python среда готова');

      console.log('[ServiceWorker] Pyodide initialization completed');

    } catch (error) {
      console.error('[ServiceWorker] Pyodide initialization failed:', error);
      await notifyStatus('error', `Ошибка инициализации: ${error.message}`);
      pyodideInitialized = false;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

// Send status updates to background script
async function notifyStatus(status, message) {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => {
      client.postMessage({
        type: 'PYODIDE_STATUS_UPDATE',
        status: status,
        message: message,
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('[ServiceWorker] Failed to send status update:', error);
  }
}

// Execute Python tool
async function executePythonTool(pluginId, toolName, toolInput) {
  if (!pyodideInitialized || !pyodideInstance) {
    throw new Error('Pyodide not initialized');
  }

  try {
    console.log('[ServiceWorker] Executing Python tool:', { pluginId, toolName });

    // Set tool context in Pyodide globals
    pyodideInstance.globals.set('TOOL_NAME', toolName);
    pyodideInstance.globals.set('TOOL_INPUT', pyodideInstance.toPy(toolInput));
    pyodideInstance.globals.set('PLUGIN_ID', pluginId);

    // Load Python script content
    const pyScriptUrl = `/plugins/${pluginId}/mcp_server.py`;
    console.log('[ServiceWorker] Loading Python script from:', pyScriptUrl);

    // Fetch Python script
    const response = await fetch(pyScriptUrl);
    if (!response.ok) {
      throw new Error(`Python script for plugin ${pluginId} not found: ${response.status}`);
    }

    const pythonCode = await response.text();
    console.log('[ServiceWorker] Python code loaded, length:', pythonCode.length);

    // Execute Python code
    console.log('[ServiceWorker] Executing Python code...');
    const result = await pyodideInstance.runPythonAsync(pythonCode);
    console.log('[ServiceWorker] Python execution completed successfully');

    return result;

  } catch (error) {
    console.error('[ServiceWorker] Error executing Python tool:', error);
    throw error;
  }
}

// Handle messages from background script
async function handleMessage(event) {
  const { data } = event;
  console.log('[ServiceWorker] Received message:', data.type);

  switch (data.type) {
    case 'EXECUTE_PYODIDE_TOOL':
      await handleExecutePyodideTool(data, event);
      break;

    case 'PYODIDE_STATUS':
      await handlePyodideStatus(data, event);
      break;

    case 'INIT_PYODIDE_SERVICE_WORKER':
      await handleInitPyodide(data, event);
      break;

    default:
      console.log('[ServiceWorker] Unknown message type:', data.type);
  }
}

async function handleExecutePyodideTool(request, event) {
  try {
    // Ensure Pyodide is initialized
    if (!pyodideInitialized) {
      await initializePyodide();
    }

    console.log('[ServiceWorker] Processing EXECUTE_PYODIDE_TOOL request');
    const result = await executePythonTool(request.pluginId, request.toolName, request.toolInput);

    // Send result back
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        type: 'EXECUTE_PYODIDE_TOOL_RESPONSE',
        requestId: request.requestId,
        result: result,
        success: true
      });
    } else {
      // Fallback if no ports available
      event.source.postMessage({
        type: 'EXECUTE_PYODIDE_TOOL_RESPONSE',
        requestId: request.requestId,
        result: result,
        success: true
      });
    }

  } catch (error) {
    console.error('[ServiceWorker] Error in EXECUTE_PYODIDE_TOOL:', error);

    // Send error back
    const responseData = {
      type: 'EXECUTE_PYODIDE_TOOL_RESPONSE',
      requestId: request.requestId,
      error: error.message,
      success: false
    };

    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(responseData);
    } else {
      event.source.postMessage(responseData);
    }
  }
}

async function handlePyodideStatus(request, event) {
  console.log('[ServiceWorker] Processing PYODIDE_STATUS request');

  const response = {
    type: 'PYODIDE_STATUS_RESPONSE',
    requestId: request.requestId,
    ready: pyodideInitialized,
    initTime: performance.now()
  };

  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage(response);
  } else {
    event.source.postMessage(response);
  }
}

async function handleInitPyodide(request, event) {
  try {
    console.log('[ServiceWorker] Processing INIT_PYODIDE_SERVICE_WORKER request');

    if (!pyodideInitialized) {
      console.log('[ServiceWorker] Starting Pyodide initialization upon request...');
      await initializePyodide();
      const response = { success: true, message: 'Pyodide initialized successfully' };
    } else {
      console.log('[ServiceWorker] Pyodide already initialized');
      const response = { success: true, message: 'Pyodide already ready' };
    }

    // Send response back
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(response);
    } else {
      event.source.postMessage(response);
    }

  } catch (error) {
    console.error('[ServiceWorker] Error initializing Pyodide upon request:', error);
    const errorResponse = { success: false, error: error.message };

    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(errorResponse);
    } else {
      event.source.postMessage(errorResponse);
    }
  }
}

// Service Worker event handlers
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install event');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate event');
  // Claim all clients to start receiving messages immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message event received');
  handleMessage(event);
});

self.addEventListener('fetch', (event) => {
  console.log('[ServiceWorker] Fetch event for:', event.request.url);
  // Let browser handle fetches normally for now
});

console.log('[ServiceWorker] Pyodide Service Worker loaded successfully');