/**
 * Offscreen Document Handler for Direct Pyodide Testing
 * Handles direct Python code execution in offscreen context
 */

/**
 * Offscreen Document Handler for Direct Pyodide Testing
 * Handles direct Python code execution in offscreen context
 * Supports chunked HTML data transfer for large documents
 */

// === CHUNKING HTML DATA RECEIVER ===

// Global state for chunked HTML transfers
const htmlTransfers = new Map();

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
        console.log('[offscreen][js bridge] ATTEMPTING to send:', message);
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

// Function to handle chunked HTML messages
function handleChunkedMessage(message, sendResponse) {
  console.log('[offscreen][CHUNKING] Received chunk message:', {
    type: message.type,
    transferId: message.transferId,
    chunkIndex: message.chunkIndex,
    totalChunks: message.totalChunks,
    chunkSize: message.chunkData ? message.chunkData.length : 'N/A'
  });

  switch (message.type) {
    case 'HTML_CHUNK':
      handleHtmlChunk(message);
      break;

    case 'HTML_CHUNK_COMPLETE':
      handleHtmlChunkComplete(message);
      break;

    case 'START_WORKFLOW_AFTER_CHUNKS':
      handleStartWorkflowAfterChunks(message, sendResponse);
      return true; // Keep channel open for async response

    default:
      console.warn('[offscreen][CHUNKING] Unknown chunk message type:', message.type);
  }

  return false;
}

// Function to handle individual HTML chunks
function handleHtmlChunk(chunkMessage) {
  const { transferId, chunkIndex, totalChunks, chunkData, metadata } = chunkMessage;

  if (!htmlTransfers.has(transferId)) {
    // Initialize new transfer
    htmlTransfers.set(transferId, {
      chunks: new Array(totalChunks),
      receivedChunks: 0,
      metadata,
      completed: false
    });
    console.log(`[offscreen][CHUNKING] Initialized new transfer: ${transferId} (${totalChunks} chunks)`);
  }

  const transfer = htmlTransfers.get(transferId);
  if (!transfer) return;

  // Store the chunk
  transfer.chunks[chunkIndex] = chunkData;
  transfer.receivedChunks++;

  // Diagnostic logging for chunk storage
  if (transfer.chunks[chunkIndex] !== undefined) {
    console.log(`[offscreen][DIAG] Successfully stored chunk ${chunkIndex}, size: ${chunkData.length}`);
  } else {
    console.error(`[offscreen][DIAG] FAILED to store chunk ${chunkIndex}!`);
  }

  console.log(`[offscreen][CHUNKING] Stored chunk ${chunkIndex + 1}/${totalChunks} for transfer ${transferId}`);

  // Send acknowledgment
  chrome.runtime.sendMessage({
    type: 'HTML_CHUNK_ACK',
    transferId,
    chunkIndex,
    received: true
  });

  // Check if transfer is complete
  if (transfer.receivedChunks === totalChunks) {
    console.log(`[offscreen][CHUNKING] All chunks received for transfer ${transferId}`);
    // Automatically mark transfer as completed when all chunks are received
    transfer.completed = true;
    console.log(`[offscreen][CHUNKING] Transfer ${transferId} automatically marked as completed (all chunks received)`);

    // Assemble the complete HTML from all chunks
    const assembledHtml = transfer.chunks.join('');
    console.log(`[offscreen][CHUNKING] Successfully assembled HTML for transfer ${transferId}, total length: ${assembledHtml.length}`);

    // Send HTML_ASSEMBLED message to background
    chrome.runtime.sendMessage({
      type: 'HTML_ASSEMBLED',
      transferId,
      html: assembledHtml,
      metadata: transfer.metadata
    });

    console.log(`[offscreen][CHUNKING] Sent HTML_ASSEMBLED message to background for transfer ${transferId}`);

    // Clean up the transfer to free memory
    htmlTransfers.delete(transferId);
    console.log(`[offscreen][CHUNKING] Cleanup: Removed transfer ${transferId} from memory`);
  }
}

// Function to handle chunk completion
function handleHtmlChunkComplete(message) {
  const { transferId } = message;
  const transfer = htmlTransfers.get(transferId);

  if (!transfer) {
    console.error(`[offscreen][CHUNKING] Completion message for unknown transfer: ${transferId}`);
    return;
  }

  // Mark transfer as completed
  transfer.completed = true;
  console.log(`[offscreen][CHUNKING] Transfer ${transferId} marked as completed`);
}

// Function to start workflow after chunks are received
async function handleStartWorkflowAfterChunks(message, sendResponse) {
  const { pluginId, pageKey, requestId } = message;

  // Find the most recent completed transfer
  let selectedTransfer = null;
  let lastReceivedTimestamp = 0;

  console.log(`[offscreen][CHUNKING] Searching for completed transfers among ${htmlTransfers.size} total transfers:`);
  for (const [transferId, transfer] of htmlTransfers.entries()) {
    console.log(`[offscreen][CHUNKING] Transfer ${transferId}: completed=${transfer.completed}, received=${transfer.receivedChunks}/${transfer.chunks.length}, timestamp=${transfer.metadata?.timestamp || 'N/A'}`);
  }

  for (const [transferId, transfer] of htmlTransfers.entries()) {
    if (transfer.completed && transfer.receivedChunks === transfer.chunks.length) {
      // Check if this transfer is newer than the previous candidate
      const transferTimestamp = transfer.metadata?.timestamp || 0;
      if (transferTimestamp > lastReceivedTimestamp) {
        selectedTransfer = transfer;
        lastReceivedTimestamp = transferTimestamp;
        console.log(`[offscreen][CHUNKING] Found completed transfer: ${transferId} with timestamp: ${transferTimestamp}`);
      }
    }
  }

  if (!selectedTransfer) {
    console.error('[offscreen][CHUNKING] No completed HTML transfers found for workflow');
    sendResponse({ error: 'No completed HTML transfers found' });
    return;
  }

  console.log('[offscreen][CHUNKING] Starting workflow with chunk metadata for Python assembly');

  try {
    // Prepare chunk metadata for Python reconstruction instead of assembling here
    const chunkMetadata = {
      __isChunkedString: true,
      originalKey: 'page_html',
      chunkCount: selectedTransfer.chunks.length,
      totalLength: selectedTransfer.chunks.reduce((sum, chunk) => sum + (chunk ? chunk.length : 0), 0)
    };

    // Create input data with chunk metadata + all chunks
    const workflowPayload = { page_html: chunkMetadata };

    // Add all chunks to payload
    for (let i = 0; i < selectedTransfer.chunks.length; i++) {
      workflowPayload[`page_html_chunk_${i}`] = selectedTransfer.chunks[i] || '';
    }

    // Log chunk details for debugging
    console.log(`[offscreen][CHUNKING] Preparing ${selectedTransfer.chunks.length} chunks for Python:`);
    selectedTransfer.chunks.forEach((chunk, idx) => {
      console.log(`[offscreen][CHUNKING] Chunk ${idx}: ${chunk ? chunk.length : 0} characters`);
    });
    console.log(`[offscreen][CHUNKING] Total expected length: ${workflowPayload.page_html.totalLength}`);

    // Execute workflow and let Python handle chunk reconstruction
    const result = await executeWorkflowWithChunks(pluginId, pageKey, workflowPayload, requestId, sendResponse);

    console.log('[offscreen][CHUNKING] Workflow execution completed');

  } catch (error) {
    console.error('[offscreen][CHUNKING] Workflow execution failed:', error);
    sendResponse({
      error: error.message,
      pluginId,
      requestId
    });
  }
}

// Function to execute workflow with chunk metadata or assembled HTML
async function executeWorkflowWithChunks(pluginId, pageKey, workflowPayload, requestId, sendResponse) {
  console.log('[offscreen] Executing workflow with assembled HTML');

  try {
    // Initialize Pyodide if needed
    if (!pyodide) {
      console.log('[offscreen] Initializing Pyodide...');
      await initializePyodide();
    }

    // Send progress message to chat
    chrome.runtime.sendMessage({
      type: 'PYODIDE_MESSAGE',
      pluginId: pluginId,
      pageKey: pageKey,
      message: {
        role: 'plugin',
        content: '🔄 Запуск выполнения workflow с собранными данными...',
        timestamp: Date.now()
      }
    });

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

    // Python will handle chunk reconstruction if needed, or use ready HTML
    const resultProxy = await workflowFunction(workflowPayload);
    const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
    resultProxy.destroy();

    console.log('[offscreen] Workflow-engine executed successfully:', result);

    // Send success message to chat
    chrome.runtime.sendMessage({
      type: 'PYODIDE_MESSAGE',
      pluginId: pluginId,
      pageKey: pageKey,
      message: {
        role: 'plugin',
        content: `✅ Workflow выполнена успешно с собранными данными. Результат: ${JSON.stringify(result, null, 2)}`,
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
    console.error('[offscreen] Workflow execution failed:', error);

    // Send error message to chat
    chrome.runtime.sendMessage({
      type: 'PYODIDE_MESSAGE',
      pluginId: pluginId,
      pageKey: pageKey,
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
      pluginId: pluginId,
      requestId: requestId,
      timestamp: Date.now()
    });
  }
}

// Handle messages from background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  // console.log('[offscreen] ===== OFFSCREEN MESSAGE RECEIVED =====');
  // console.log('[offscreen] Received message:', message);
  // console.log('[offscreen] Sender info:', sender);
  // console.log('[offscreen] Message type:', message.type);
  // console.log('[offscreen] Message timestamp:', new Date().toISOString());

  // Handle chunked messages first
  if (message.type === 'HTML_CHUNK' || message.type === 'HTML_CHUNK_COMPLETE' || message.type === 'START_WORKFLOW_AFTER_CHUNKS') {
    return handleChunkedMessage(message, sendResponse);
  }

  // Handle chunked messages first
  if (message.type === 'HTML_CHUNK' || message.type === 'HTML_CHUNK_COMPLETE' || message.type === 'START_WORKFLOW_AFTER_CHUNKS') {
    return handleChunkedMessage(message, sendResponse);
  }

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
   console.log('[offscreen][EXECUTE_WORKFLOW] ===== EXECUTE_WORKFLOW MESSAGE RECEIVED =====');
   console.log('[offscreen][EXECUTE_WORKFLOW] Получено сообщение от background:', message);
   console.log('[offscreen][EXECUTE_WORKFLOW] Sender info:', sender);
   console.log('[offscreen][EXECUTE_WORKFLOW] Message timestamp:', new Date().toISOString());
   console.log('[offscreen][EXECUTE_WORKFLOW] Message type:', message.type);
   console.log('[offscreen][EXECUTE_WORKFLOW] Message pluginId:', message.pluginId);
   console.log('[offscreen][EXECUTE_WORKFLOW] Message pageKey:', message.pageKey);

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

     // DEBUG: Проверяем размер полученных данных
     console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] Полученные данные:');
     console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] - pageHtml length:', pageHtml.length);
     console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] - pageHtml preview:', pageHtml.substring(0, 100) + '...');
     console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] - message keys:', Object.keys(message));
     console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] - message.pageHtml type:', typeof message.pageHtml);
     console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] - message.pageHtml length:', message.pageHtml ? message.pageHtml.length : 'undefined');

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
     
     // DEBUG: Проверяем workflowPayload
     console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] WorkflowPayload:');
     console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] - workflowPayload keys:', Object.keys(workflowPayload));
     console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] - workflowPayload.page_html type:', typeof workflowPayload.page_html);
     if (typeof workflowPayload.page_html === 'string') {
       console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] - workflowPayload.page_html length:', workflowPayload.page_html.length);
       console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] - workflowPayload.page_html preview:', workflowPayload.page_html.substring(0, 100) + '...');
     } else if (workflowPayload.page_html && typeof workflowPayload.page_html === 'object') {
       console.log('[offscreen][EXECUTE_WORKFLOW][DEBUG] - chunk metadata:', workflowPayload.page_html);
     }

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