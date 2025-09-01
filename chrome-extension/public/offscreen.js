/**
 * Offscreen Document Handler for Direct Pyodide Testing
 * Handles direct Python code execution in offscreen context
 */

let pyodide = null;

// Initialize Pyodide when the offscreen document loads
async function initializePyodide() {
  if (pyodide) {
    console.log('[offscreen] Pyodide already initialized');
    return pyodide;
  }

  try {
    console.log('[offscreen] Starting Pyodide initialization...');

    // Load Pyodide
    const script = document.createElement('script');
    script.src = './pyodide/pyodide.js';
    document.head.appendChild(script);

    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
    });

    // Initialize Pyodide instance
    pyodide = await window.loadPyodide({
      indexURL: './pyodide/',
      jsglobals: window
    });

    console.log('[offscreen] Pyodide initialized successfully');
    return pyodide;

  } catch (error) {
    console.error('[offscreen] Failed to initialize Pyodide:', error);
    throw error;
  }
}

// Execute Python code and return result
async function executePythonCode(pythonCode) {
  if (!pyodide) {
    throw new Error('Pyodide not initialized');
  }

  try {
    console.log('[offscreen] Executing Python code:', pythonCode);

    // Execute the code using Pyodide
    const result = await pyodide.runPythonAsync(pythonCode);

    // Convert result to JavaScript if it's a Pyodide object
    let jsResult = result;
    if (result && typeof result.toJs === 'function') {
      jsResult = result.toJs();
    }

    console.log('[offscreen] Execution completed successfully:', jsResult);
    return jsResult;

  } catch (error) {
    console.error('[offscreen] Python execution failed:', error);
    throw error;
  }
}

// Handle messages from background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('[offscreen] Received message:', message);

  if (message.type === 'TEST_PYODIDE_DIRECT_EXEC') {
    try {
      // Initialize Pyodide if needed
      if (!pyodide) {
        await initializePyodide();
      }

      // Execute the Python code
      const result = await executePythonCode(message.pythonCode);

      // Send response back
      const response = {
        success: true,
        result: result,
        requestId: message.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - message.timestamp
      };

      sendResponse(response);

    } catch (error) {
      console.error('[offscreen] Test execution failed:', error);

      sendResponse({
        success: false,
        error: error.message,
        requestId: message.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - message.timestamp
      });
    }

    return true; // Keep channel open for async response
  }

  // === РУЧНОЕ ТЕСТИРОВАНИЕ PYODIDE ===

  if (message.type === 'INITIALIZE_PYODIDE') {
    console.log('[offscreen][INITIALIZE_PYODIDE] Initializing Pyodide for manual testing');

    try {
      // Initialize Pyodide if not already done
      if (!pyodide) {
        await initializePyodide();
      }

      console.log('[offscreen][INITIALIZE_PYODIDE] Pyodide ready for manual testing');

      sendResponse({
        success: true,
        result: 'Pyodide initialized successfully',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('[offscreen][INITIALIZE_PYODIDE] Initialization failed:', error);

      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      });
    }

    return true;
  }

  if (message.type === 'EXECUTE_PYTHON_CODE') {
    console.log('[offscreen][EXECUTE_PYTHON_CODE] Executing Python code for manual testing');
    console.log('[offscreen][EXECUTE_PYTHON_CODE] Test name:', message.testName);
    console.log('[offscreen][EXECUTE_PYTHON_CODE] Code:', message.code);
    console.log('[offscreen][EXECUTE_PYTHON_CODE] Is error test:', message.isErrorTest);

    try {
      // Ensure Pyodide is initialized
      if (!pyodide) {
        await initializePyodide();
      }

      let result;
      let success = true;

      try {
        // Execute the Python code
        result = await executePythonCode(message.code);
      } catch (pythonError) {
        // If this is an error test, we expect the error
        if (message.isErrorTest) {
          console.log('[offscreen][EXECUTE_PYTHON_CODE] Expected error in error test:', pythonError.message);
          result = 'Error correctly caught: ' + pythonError.message;
          success = false;
        } else {
          // Unexpected error
          throw pythonError;
        }
      }

      console.log('[offscreen][EXECUTE_PYTHON_CODE] Execution completed:', { success, result });

      const response = {
        success: success,
        result: result,
        error: success ? null : result,
        testName: message.testName,
        requestId: message.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - (message.timestamp || 0)
      };

      sendResponse(response);

    } catch (error) {
      console.error('[offscreen][EXECUTE_PYTHON_CODE] Execution failed:', error);

      sendResponse({
        success: false,
        error: error.message,
        testName: message.testName,
        requestId: message.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - (message.timestamp || 0)
      });
    }

    return true;
  }

  return false;
});

console.log('[offscreen] Offscreen document ready, waiting for messages...');