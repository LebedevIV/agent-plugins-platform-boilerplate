/**
 * Background Script - Messaging Coordinator
 * This script coordinates communication between:
 * - Service Worker (handles Pyodide execution)
 * - UI components (options, side panel, etc.)
 * - Content scripts
 *
 * No direct Pyodide interactions - delegates to service worker
 */

'use strict';

// Import required modules
importScripts('webextension-polyfill.js', 'background.js');

// Global state
let serviceWorkerReady = false;
let pendingRequests = new Map();

// Service Worker communication
class ServiceWorkerCommunicator {
  constructor() {
    this.init();
  }

  async init() {
    // Wait for service worker to be ready
    this.waitForServiceWorker();
  }

  async waitForServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('background-worker.js');
      console.log('[Coordinator] Service Worker registered:', registration.scope);

      return new Promise((resolve, reject) => {
        navigator.serviceWorker.ready.then(() => {
          console.log('[Coordinator] Service Worker ready');
          serviceWorkerReady = true;
          resolve();
        });

        setTimeout(() => {
          reject(new Error('Service Worker initialization timeout'));
        }, 10000);
      });
    } catch (error) {
      console.error('[Coordinator] Service Worker registration failed:', error);
      throw error;
    }
  }

  // Send message to service worker and wait for response
  async sendToServiceWorker(message, timeout = 30000) {
    if (!serviceWorkerReady) {
      throw new Error('Service Worker not ready');
    }

    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random()}`;
      message.requestId = requestId;

      // Store pending request
      pendingRequests.set(requestId, { resolve, reject, timeoutId: null });

      // Set timeout
      if (timeout > 0) {
        const timeoutId = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.delete(requestId);
            reject(new Error(`Service Worker request timeout after ${timeout}ms`));
          }
        }, timeout);
        pendingRequests.get(requestId).timeoutId = timeoutId;
      }

      // Send message to service worker
      navigator.serviceWorker.controller?.postMessage(message);
      console.log('[Coordinator] Sent to Service Worker:', message.type, requestId);
    });
  }

  // Handle responses from service worker
  handleServiceWorkerMessage(event) {
    const message = event.data;
    console.log('[Coordinator] Received from Service Worker:', message.type);

    if (message.requestId && pendingRequests.has(message.requestId)) {
      const request = pendingRequests.get(message.requestId);

      // Clear timeout
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }

      // Resolve or reject promise
      if (message.error || !message.success) {
        request.reject(new Error(message.error || 'Service Worker operation failed'));
      } else {
        request.resolve(message);
      }

      // Clean up pending request
      pendingRequests.delete(message.requestId);
    }
  }
}

// Pyodide Service Coordinator
class PyodideCoordinator extends ServiceWorkerCommunicator {

  async executePyodideTool(pluginId, toolName, toolInput) {
    console.log('[Coordinator] Executing Pyodide tool:', { pluginId, toolName });
    return await this.sendToServiceWorker({
      type: 'EXECUTE_PYODIDE_TOOL',
      pluginId,
      toolName,
      toolInput
    });
  }

  async getPyodideStatus() {
    console.log('[Coordinator] Requesting Pyodide status');
    return await this.sendToServiceWorker({
      type: 'PYODIDE_STATUS'
    });
  }

  async initializePyodide() {
    console.log('[Coordinator] Initializing Pyodide via Service Worker');
    return await this.sendToServiceWorker({
      type: 'INIT_PYODIDE_SERVICE_WORKER'
    });
  }
}

// Extension Messaging Handler
class ExtensionMessagingHandler {
  constructor(pyodideCoordinator) {
    this.pyodideCoordinator = pyodideCoordinator;
    this.init();
  }

  init() {
    // Listen for messages from extension components
    chrome.runtime.onMessage.addListener(this.handleExtensionMessage.bind(this));
    console.log('[Coordinator] Extension message listener initialized');
  }

  async handleExtensionMessage(request, sender, sendResponse) {
    console.log('[Coordinator] Handling extension message:', request.type);

    try {
      switch (request.type) {
        case 'EXECUTE_PYODIDE_TOOL':
          const result = await this.pyodideCoordinator.executePyodideTool(
            request.payload.pluginId,
            request.payload.toolName,
            request.payload.toolInput
          );
          sendResponse({ success: true, data: result });
          break;

        case 'EXECUTE_PYODIDE_TEST_SCRIPT':
          // Handle test script execution
          const testResult = await this.pyodideCoordinator.sendToServiceWorker({
            type: 'EXECUTE_PYODIDE_TEST_SCRIPT',
            code: request.code
          });
          sendResponse(testResult);
          break;

        case 'INIT_PYODIDE_BACKGROUND':
          const initResult = await this.pyodideCoordinator.initializePyodide();
          sendResponse({ success: true, message: 'Pyodide initialized via Service Worker' });
          break;

        case 'PYODIDE_STATUS_CHECK':
          const status = await this.pyodideCoordinator.getPyodideStatus();
          sendResponse({
            ready: status.ready,
            initTime: status.initTime
          });
          break;

        default:
          console.log('[Coordinator] Unknown message type:', request.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[Coordinator] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }

    return true; // Keep message channel open for async response
  }
}

// LLM API Handler for Service Worker
class LLMRequestHandler {
  constructor() {
    this.init();
  }

  init() {
    // Listen for messages from service worker
    navigator.serviceWorker?.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
  }

  handleServiceWorkerMessage(event) {
    const { data } = event;
    console.log('[Coordinator] Handling message from Service Worker:', data.type);

    if (data.type === 'LLM_CALL_SERVICE_WORKER') {
      this.handleLLMCall(data);
    } else if (data.type === 'HOST_FETCH_SERVICE_WORKER') {
      this.handleHostFetch(data);
    } else if (data.type === 'GET_SETTING_SERVICE_WORKER') {
      this.handleGetSetting(data);
    } else if (data.type === 'PYODIDE_MESSAGE_SERVICE_WORKER') {
      this.handlePyodideMessage(data);
    }
  }

  async handleLLMCall(data) {
    // Handle LLM call from Pyodide via service worker
    // Implementation would integrate with AI API client
    console.log('[Coordinator] LLM call from Service Worker:', data);

    // TODO: Implement actual LLM call and send response back to service worker
  }

  async handleHostFetch(data) {
    // Handle host fetch request from Pyodide via service worker
    console.log('[Coordinator] Host fetch from Service Worker:', data.url);

    // TODO: Implement host fetch and send response back to service worker
  }

  handleGetSetting(data) {
    // Handle get setting request from Pyodide via service worker
    console.log('[Coordinator] Get setting from Service Worker:', data.settingName);

    // Send response back to service worker
    navigator.serviceWorker.controller?.postMessage({
      type: 'SETTING_RESPONSE',
      settingId: data.settingId,
      value: data.defaultValue // Simplified - would get from storage
    });
  }

  handlePyodideMessage(data) {
    // Forward Pyodide messages to appropriate extension components
    console.log('[Coordinator] Pyodide message from Service Worker:', data.message);

    // Send message to UI components
    chrome.runtime.sendMessage({
      type: 'PYODIDE_MESSAGE',
      message: data.message,
      timestamp: data.timestamp
    });
  }
}

// Plugin Manager and other handlers (simplified)
class PluginManagerCoordinator {
  constructor() {
    this.init();
  }

  init() {
    // Initialize plugin management functionality
    console.log('[Coordinator] Plugin manager initialized');
  }

  async getAvailablePlugins() {
    // Implementation would get plugins from storage/cache
    console.log('[Coordinator] Getting available plugins');
    return [];
  }

  async updatePluginSetting(pluginId, setting, value) {
    // Implementation would update plugin settings in storage
    console.log('[Coordinator] Updating plugin setting:', pluginId, setting, value);
    return { success: true };
  }
}

// Initialize all coordinators
async function initializeCoordinator() {
  console.log('[Coordinator] Initializing Background Coordinator...');

  // Initialize Pyodide coordinator
  const pyodideCoordinator = new PyodideCoordinator();
  await pyodideCoordinator.init();

  // Initialize extension messaging handler
  new ExtensionMessagingHandler(pyodideCoordinator);

  // Initialize LLM request handler
  new LLMRequestHandler();

  // Initialize plugin manager
  new PluginManagerCoordinator();

  console.log('[Coordinator] All coordinators initialized successfully');
}

// Service Worker message listener
navigator.serviceWorker?.addEventListener('message', (event) => {
  console.log('[Coordinator] Service Worker message received:', event.data.type);

  // Handle service worker messages (status updates, etc.)
  if (event.data.type === 'PYODIDE_STATUS_UPDATE') {
    console.log('[Coordinator] Pyodide status update:', event.data);
    // Forward to interested components
    chrome.runtime.sendMessage({
      type: 'PYODIDE_STATUS_UPDATE',
      status: event.data.status,
      message: event.data.message,
      timestamp: event.data.timestamp
    });
  }
});

// Start initialization
initializeCoordinator().then(() => {
  console.log('[Coordinator] Background coordinator fully initialized');
}).catch((error) => {
  console.error('[Coordinator] Initialization failed:', error);
});

console.log('[Coordinator] Background script loaded and initializing...');