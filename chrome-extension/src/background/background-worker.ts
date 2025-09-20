/**
 * Pyodide Service Worker for Agent-Plugins-Platform
 * Handles Pyodide initialization and execution in Manifest V3 compliant way
 * No unsafe-eval required - uses importScripts() for loading Pyodide
 * Provides clean messaging interface for Pyodide tool execution
 */

// Type definitions for service worker context
declare const self: ServiceWorkerGlobalScope & {
  importScripts: (...urls: string[]) => void;
  pyodide: any;
  loadPyodide: any;
};

interface PyodideExecutionRequest {
  type: 'EXECUTE_PYODIDE_TOOL';
  toolName: string;
  toolInput: any;
  pluginId: string;
  requestId: string;
}

interface PyodideStatusRequest {
  type: 'PYODIDE_STATUS';
  requestId: string;
}

interface MessagingEvent extends ExtendableMessageEvent {
  data: PyodideExecutionRequest | PyodideStatusRequest;
}

// Global state management
let pyodideInitialized = false;
let pyodideInstance: any = null;
let initializationPromise: Promise<void> | null = null;

// Pyodide bridge functions for Python-to-JS communication
function setupPyodideBridge(): void {
  if (!pyodideInstance) {
    console.error('[ServiceWorker] Pyodide not initialized, cannot setup bridge');
    return;
  }

  // Create JavaScript bridge for Python plugins
  pyodideInstance.globals.set('js', {
    // LLM call function for Python plugins
    llm_call: async (modelAlias: string, options: any) => {
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
          resolve((window as any).pyodide.toPy({ callId }));

        } catch (error) {
          console.error('[ServiceWorker] llm_call failed:', error);
          reject(error);
        }
      });
    },

    // Host fetch function for Python plugins
    host_fetch: async (url: string) => {
      try {
        console.log('[ServiceWorker] host_fetch called for:', url);

        // Generate unique ID for this fetch operation
        const fetchId = `fetch_${Date.now()}_${Math.random()}`;

        return new Promise((resolve, reject) => {
          // Send fetch request to background script
          self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            if (clients.length > 0) {
              clients[0].postMessage({
                type: 'HOST_FETCH_SERVICE_WORKER',
                url: url,
                fetchId: fetchId,
                timestamp: Date.now()
              });

              // TODO: Set up response listener and resolve promise when response received
              // For now, return a placeholder
              resolve('TODO: implement fetch response handling');
            } else {
              reject(new Error('No available clients for fetch operation'));
            }
          });
        });

      } catch (error) {
        console.error('[ServiceWorker] host_fetch failed:', error);
        throw error;
      }
    },

    // Get setting function for Python plugins
    get_setting: (settingName: string, defaultValue?: any, category?: string) => {
      console.log('[ServiceWorker] get_setting called for:', settingName);

      const settingId = `setting_${Date.now()}_${Math.random()}`;

      // Send setting request to background script
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        if (clients.length > 0) {
          clients[0].postMessage({
            type: 'GET_SETTING_SERVICE_WORKER',
            settingName: settingName,
            defaultValue: defaultValue,
            category: category,
            settingId: settingId,
            timestamp: Date.now()
          });
        }
      });

      // Return default value immediately
      return defaultValue;
    },

    // Send message to background chat system
    send_message_to_chat: (message: any) => {
      try {
        const jsMessage = message.toJs ? message.toJs({ dict_converter: Object.fromEntries }) : message;
        console.log('[ServiceWorker] sendMessageToChat called with:', jsMessage);

        // Send to background script
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          if (clients.length > 0) {
            clients[0].postMessage({
              type: 'PYODIDE_MESSAGE_SERVICE_WORKER',
              message: jsMessage,
              timestamp: Date.now()
            });
          }
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
async function initializePyodide(): Promise<void> {
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

      // DIAGNOSTIC LOGGING: Check if we're in service worker context
      console.log('[DIAGNOSIS] Self object type:', typeof self);
      console.log('[DIAGNOSIS] Available on self:', {
        importScripts: typeof self.importScripts,
        clients: typeof self.clients,
        registration: typeof self.registration,
        prototype: Object.getPrototypeOf(self)?.constructor?.name
      });
      console.log('[DIAGNOSIS] Service worker context confirmation:', 'ServiceWorkerGlobalScope' in globalThis);

      // Send status update
      await notifyStatus('loading', 'Загрузка Python среды...');

      // Load Pyodide script using importScripts (Manifest V3 compliant)
      const pyodideScriptUrl = '/pyodide/pyodide.js';
      console.log('[ServiceWorker] Loading Pyodide script from:', pyodideScriptUrl);
      console.log('[DIAGNOSIS] Attempting to load Pyodide in service worker context');

      try {
        console.log('[DIAGNOSIS] Calling importScripts for Pyodide...');
        self.importScripts(pyodideScriptUrl);
        console.log('[ServiceWorker] Pyodide script loaded successfully');
      } catch (scriptError) {
        console.error('[ServiceWorker] Failed to load Pyodide script:', scriptError);
        console.log('[DIAGNOSIS] Script error details:', {
          name: scriptError.name,
          message: scriptError.message,
          stack: scriptError.stack
        });
        await notifyStatus('error', `Ошибка загрузки Pyodide скрипта: ${scriptError.message}`);
        throw scriptError;
      }

      // Verify loadPyodide function is available
      if (typeof loadPyodide !== 'function') {
        const errorMsg = 'loadPyodide function not found after script load';
        console.error('[ServiceWorker] ' + errorMsg);
        console.log('[DIAGNOSIS] Available global functions:', Object.getOwnPropertyNames(globalThis).filter(name => typeof globalThis[name] === 'function').slice(0, 10));
        await notifyStatus('error', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('[ServiceWorker] loadPyodide function verified');

      // Initialize Pyodide instance
      console.log('[ServiceWorker] Initializing Pyodide runtime...');

      try {
        console.log('[DIAGNOSIS] Calling loadPyodide function...');
        pyodideInstance = await self.loadPyodide({
          indexURL: '/pyodide/',
          jsglobals: self
        });
        console.log('[ServiceWorker] Pyodide runtime initialized successfully');
      } catch (pyodideError) {
        console.error('[DIAGNOSIS] Pyodide initialization failed:', pyodideError);
        console.log('[DIAGNOSIS] Pyodide error details:', {
          name: pyodideError.name,
          message: pyodideError.message,
          stack: pyodideError.stack
        });
        throw pyodideError;
      }

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
async function notifyStatus(status: 'loading' | 'ready' | 'error', message: string): Promise<void> {
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
async function executePythonTool(pluginId: string, toolName: string, toolInput: any): Promise<any> {
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

    // In service worker context, we need to request the script content via messaging
    return new Promise((resolve, reject) => {
      // Send request to background script to fetch the Python script
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        if (clients.length > 0) {
          const executionId = `py_${Date.now()}_${Math.random()}`;

          clients[0].postMessage({
            type: 'FETCH_PY_SCRIPT_SERVICE_WORKER',
            scriptUrl: pyScriptUrl,
            pluginId: pluginId,
            toolName: toolName,
            toolInput: toolInput,
            executionId: executionId,
            timestamp: Date.now()
          });

          // Set up rejection timeout
          setTimeout(() => {
            reject(new Error('Python script fetch timeout'));
          }, 10000);
        } else {
          reject(new Error('No available clients for script fetch'));
        }
      });
    });

  } catch (error) {
    console.error('[ServiceWorker] Error executing Python tool:', error);
    throw error;
  }
}

// Handle messages from background script
async function handleMessage(event: MessagingEvent): Promise<void> {
  const { data } = event;
  console.log('[ServiceWorker] Received message:', data.type);

  switch (data.type) {
    case 'EXECUTE_PYODIDE_TOOL':
      await handleExecutePyodideTool(data as PyodideExecutionRequest, event);
      break;

    case 'PYODIDE_STATUS':
      await handlePyodideStatus(data as PyodideStatusRequest, event);
      break;

    default:
      console.log('[ServiceWorker] Unknown message type:', data.type);
  }
}

async function handleExecutePyodideTool(request: PyodideExecutionRequest, event: MessagingEvent): Promise<void> {
  try {
    // Ensure Pyodide is initialized
    if (!pyodideInitialized) {
      await initializePyodide();
    }

    console.log('[ServiceWorker] Processing EXECUTE_PYODIDE_TOOL request');
    const result = await executePythonTool(request.pluginId, request.toolName, request.toolInput);

    // Send result back
    event.ports[0]?.postMessage({
      type: 'EXECUTE_PYODIDE_TOOL_RESPONSE',
      requestId: request.requestId,
      result: result,
      success: true
    });

  } catch (error: any) {
    console.error('[ServiceWorker] Error in EXECUTE_PYODIDE_TOOL:', error);

    // Send error back
    event.ports[0]?.postMessage({
      type: 'EXECUTE_PYODIDE_TOOL_RESPONSE',
      requestId: request.requestId,
      error: error.message,
      success: false
    });
  }
}

async function handlePyodideStatus(request: PyodideStatusRequest, event: MessagingEvent): Promise<void> {
  console.log('[ServiceWorker] Processing PYODIDE_STATUS request');

  event.ports[0]?.postMessage({
    type: 'PYODIDE_STATUS_RESPONSE',
    requestId: request.requestId,
    ready: pyodideInitialized,
    initTime: performance.now()
  });
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
  handleMessage(event as MessagingEvent);
});

self.addEventListener('fetch', (event) => {
  console.log('[ServiceWorker] Fetch event for:', event.request.url);
  // Let browser handle fetches normally for now
});

console.log('[ServiceWorker] Pyodide Service Worker loaded successfully');