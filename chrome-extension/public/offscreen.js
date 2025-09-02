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

    // Setup js bridge for Python scripts compatibility
    console.log('[offscreen] Setting up js bridge for Python scripts...');
    pyodide.globals.set('js', {
      sendMessageToChat: (message) => {
        console.log('[offscreen][js bridge] sendMessageToChat called:', message);
        const jsMessage = message.toJs ? message.toJs({ dict_converter: Object.fromEntries }) : message;
        chrome.runtime.sendMessage({
          type: 'PYODIDE_MESSAGE',
          pluginId: 'ozon-analyzer',
          pageKey: 'direct_offscreen_execution',
          message: {
            role: 'plugin',
            content: `📨 Execute result: ${typeof jsMessage === 'string' ? jsMessage : JSON.stringify(jsMessage)}`,
            timestamp: Date.now()
          }
        });
        return Promise.resolve({ success: true });
      },
      host_fetch: (url) => {
        console.log('[offscreen][js bridge] host_fetch called:', url);
        const jsUrl = url.toJs ? url.toJs() : url;
        return fetch(jsUrl)
          .then(response => response.text())
          .then(data => pyodide.toPy(data));
      },
      llm_call: (modelAlias, options) => {
        console.log('[offscreen][js bridge] llm_call called:', { modelAlias, options: options?.toJs ? options.toJs() : options });
        // For offscreen context, we'll simulate a simple response
        const response = `Mock LLM response for ${modelAlias}: ${JSON.stringify(options?.toJs ? options.toJs() : options)}`;
        return Promise.resolve(pyodide.toPy({ result: response }));
      },
      get_setting: (settingName, defaultValue, category) => {
        console.log('[offscreen][js bridge] get_setting called:', { settingName, defaultValue, category });
        const jsSettingName = settingName?.toJs ? settingName.toJs() : settingName;
        const jsDefaultValue = defaultValue?.toJs ? defaultValue.toJs() : defaultValue;
        const jsCategory = category?.toJs ? category.toJs() : category;

        // For offscreen context, return default value
        console.log('[offscreen][js bridge] Returning default value for setting:', jsSettingName, jsDefaultValue);
        return Promise.resolve(pyodide.toPy(jsDefaultValue));
      }
    });

    console.log('[offscreen] js bridge setup completed');

    // DEBUG: Verify js bridge is properly set
    console.log('[offscreen][DEBUG] Verifying js bridge setup...');
    try {
      const jsObj = pyodide.globals.get('js');
      console.log('[offscreen][DEBUG] js object available:', jsObj ? 'YES' : 'NO');
      if (jsObj) {
        const jsKeys = Object.keys(jsObj);
        console.log('[offscreen][DEBUG] Available js functions:', jsKeys);
        console.log('[offscreen][DEBUG] js.sendMessageToChat function:', typeof jsObj.sendMessageToChat);
        console.log('[offscreen][DEBUG] js.host_fetch function:', typeof jsObj.host_fetch);
      }
    } catch (debugError) {
      console.error('[offscreen][DEBUG] Failed to verify js bridge:', debugError);
    }

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

 // === EXECUTE_WORKFLOW HANDLER FOR DIRECT WORKFLOW EXECUTION ===
 if (message.type === 'EXECUTE_WORKFLOW') {
   console.log('[offscreen][EXECUTE_WORKFLOW] Получено сообщение от background:', message);

   try {
     // Initialize Pyodide if needed
     if (!pyodide) {
       console.log('[offscreen][EXECUTE_WORKFLOW] Initializing Pyodide...');
       await initializePyodide();
     }

     // Extract workflow parameters
     const pluginId = message.pluginId || 'ozon-analyzer';
     const pageKey = message.pageKey || 'unknown_page';
     const pageHtml = message.pageHtml || '';
     const requestId = message.requestId || `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

     console.log('[offscreen][EXECUTE_WORKFLOW] Запускаю workflow-engine с pluginId:', pluginId);

     // Send progress message to chat
     chrome.runtime.sendMessage({
       type: 'PYODIDE_MESSAGE',
       pluginId: pluginId,
       pageKey: pageKey,
       message: {
         role: 'plugin',
         content: '🔄 Запуск выполнения workflow...',
         timestamp: Date.now()
       }
     });

     // Load and execute workflow
     const workflowPayload = { page_html: pageHtml };

     // Load the Python script URL
     const pyScriptUrl = chrome.runtime.getURL(`/plugins/${pluginId}/mcp_server.py`);

     const response = await fetch(pyScriptUrl);
     if (!response.ok) {
       throw new Error(`Failed to load Python script: ${response.status}`);
     }

     const pythonCode = await response.text();

     // Execute the Python code
     await pyodide.runPythonAsync(pythonCode);

     // Get the main workflow function
     const workflowFunction = pyodide.globals.get('analyze_ozon_product');
     if (!workflowFunction) {
       throw new Error('Main workflow function analyze_ozon_product not found in Python script');
     }

     // Execute the workflow
     const resultProxy = await workflowFunction(workflowPayload);
     const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
     resultProxy.destroy();

     console.log('[offscreen][EXECUTE_WORKFLOW] Workflow-engine завершился с результатом:', result);
     console.log('[offscreen][EXECUTE_WORKFLOW] Отправляю результат обратно в background:', {
       success: true,
       result: result
     });

     // Send success message to chat
     chrome.runtime.sendMessage({
       type: 'PYODIDE_MESSAGE',
       pluginId: pluginId,
       pageKey: pageKey,
       message: {
         role: 'plugin',
         content: `✅ Workflow выполнена успешно. Результат: ${JSON.stringify(result, null, 2)}`,
         timestamp: Date.now()
       }
     });

     // Send response back
     sendResponse({
       success: true,
       result: result,
       pluginId: pluginId,
       requestId: requestId,
       timestamp: Date.now()
     });

   } catch (error) {
     console.error('[offscreen][EXECUTE_WORKFLOW] КРИТИЧЕСКАЯ ОШИБКА:', error);
     console.error('[offscreen][EXECUTE_WORKFLOW] Отправляю error message обратно в background:', {
       success: false,
       error: error.message
     });

     // Send error message to chat
     chrome.runtime.sendMessage({
       type: 'PYODIDE_MESSAGE',
       pluginId: message.pluginId,
       pageKey: message.pageKey,
       message: {
         role: 'plugin',
         content: `❌ Ошибка выполнения workflow: ${error.message}`,
         timestamp: Date.now()
       }
     });

     // Send error response back
     sendResponse({
       success: false,
       error: error.message,
       pluginId: message.pluginId,
       requestId: message.requestId,
       timestamp: Date.now()
     });
   }

   return true; // Keep channel open for async response
 }

  return false;
});

console.log('[offscreen] Offscreen document ready, waiting for messages...');