/**
 * Pyodide Worker - Replacement for Offscreen Document functionality
 * Executes Python code using Pyodide in a Web Worker context
 * Compatible with legacy Chrome versions (< 109)
 */

importScripts('./pyodide/pyodide.js');

// Global Pyodide instance
let pyodide = null;
let isInitialized = false;

// Initialize Pyodide
async function initializePyodide() {
  if (isInitialized && pyodide) {
    console.log('[worker] Pyodide already initialized');
    return pyodide;
  }

  try {
    console.log('[worker] Starting Pyodide initialization...');

    // Import pyodide.mjs through CDN instead of local file to avoid path issues
    pyodide = await self.loadPyodide({
      indexURL: new URL('./pyodide/', self.location.href).href,
      jsglobals: self
    });

    // Load basic packages
    await pyodide.loadPackage('numpy');
    await pyodide.loadPackage('pandas');

    // Run basic Python setup
    await pyodide.runPythonAsync(`
import sys
print("Pyodide Worker initialized successfully")
print(f"Python version: {sys.version}")
import numpy as np
import pandas as pd
print("NumPy and Pandas loaded")
    `);

    isInitialized = true;
    console.log('[worker] Pyodide initialization completed successfully');
    return pyodide;

  } catch (error) {
    console.error('[worker] Failed to initialize Pyodide:', error);
    throw error;
  }
}

// Execute Python code
async function executePythonCode(code) {
  if (!isInitialized || !pyodide) {
    throw new Error('Pyodide not initialized');
  }

  try {
    console.log('[worker] Executing Python code:', code);

    const result = await pyodide.runPythonAsync(code);
    let jsResult = result;

    // Convert Pyodide objects to JS if necessary
    if (result && typeof result.toJs === 'function') {
      jsResult = result.toJs();
    }

    console.log('[worker] Execution completed successfully:', jsResult);
    return jsResult;

  } catch (error) {
    console.error('[worker] Python execution failed:', error);
    throw error;
  }
}

// Handle messages from main thread
self.onmessage = async function(e) {
  console.log('[worker] Received message:', e.data);

  const { type, code, requestId, timestamp } = e.data;

  try {
    switch (type) {
      case 'INIT_PYODIDE':
        await initializePyodide();
        self.postMessage({
          type: 'INIT_COMPLETED',
          success: true,
          requestId,
          timestamp: Date.now(),
          legacyMode: true
        });
        break;

      case 'EXECUTE_PYTHON':
        if (!isInitialized) {
          await initializePyodide();
        }

        const result = await executePythonCode(code);

        self.postMessage({
          type: 'EXECUTION_RESULT',
          success: true,
          result,
          requestId,
          timestamp: Date.now()
        });
        break;

      case 'EXECUTE_PYTHON_ERROR_TEST':
        if (!isInitialized) {
          await initializePyodide();
        }

        try {
          await executePythonCode(code);
          // If we get here, the test should have failed
          self.postMessage({
            type: 'EXECUTION_RESULT',
            success: true,
            result: 'Error test should have failed - this is unexpected',
            requestId,
            timestamp: Date.now()
          });
        } catch (expectedError) {
          self.postMessage({
            type: 'EXECUTION_RESULT',
            success: false,
            error: expectedError.message,
            requestId,
            timestamp: Date.now()
          });
        }
        break;

      case 'HEALTH_CHECK':
        self.postMessage({
          type: 'HEALTH_RESULT',
          status: 'healthy',
          isReady: isInitialized,
          legacyMode: true,
          timestamp: Date.now(),
          requestId
        });
        break;

      default:
        console.warn('[worker] Unknown message type:', type);
        self.postMessage({
          type: 'ERROR',
          success: false,
          error: `Unknown message type: ${type}`,
          requestId,
          timestamp: Date.now()
        });
    }

  } catch (error) {
    console.error('[worker] Message handling failed:', error);

    self.postMessage({
      type: 'EXECUTION_RESULT',
      success: false,
      error: error.message,
      requestId,
      timestamp: Date.now()
    });
  }
};

// Initialize on startup
console.log('[worker] Pyodide Worker starting...');

// Auto-initialize Pyodide on worker startup
(async function() {
  try {
    await initializePyodide();
    console.log('[worker] Auto-initialization completed');
  } catch (error) {
    console.error('[worker] Auto-initialization failed:', error);
  }
})();