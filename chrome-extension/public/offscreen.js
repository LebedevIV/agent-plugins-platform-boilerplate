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

// Глобальные переменные для хранения текущих pluginId и pageKey
let currentPluginId = 'ozon-analyzer';
let currentPageKey = 'unknown_page';

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
          pluginId: currentPluginId,
          pageKey: currentPageKey,
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
      completed: false,
      assembledNotified: false // Track if background acknowledged HTML_ASSEMBLED
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

    // Log metadata for debugging
    console.log(`[offscreen][CHUNKING] Transfer metadata for ${transferId}:`, {
      pluginId: transfer.metadata?.pluginId,
      pageKey: transfer.metadata?.pageKey,
      requestId: transfer.metadata?.requestId,
      totalSize: transfer.metadata?.totalSize,
      timestamp: transfer.metadata?.timestamp
    });

    // Send HTML_ASSEMBLED message to background with extracted pluginId and pageKey
    chrome.runtime.sendMessage({
      type: 'HTML_ASSEMBLED',
      transferId,
      pluginId: transfer.metadata?.pluginId,
      pageKey: transfer.metadata?.pageKey,
      requestId: transfer.metadata?.requestId,
      html: assembledHtml,
      metadata: transfer.metadata
    });

    // Mark that we have notified background about assembly completion
    transfer.assembledNotified = true;

    console.log(`[offscreen][CHUNKING] Sent HTML_ASSEMBLED message to background for transfer ${transferId} with pluginId: ${transfer.metadata?.pluginId}, pageKey: ${transfer.metadata?.pageKey}`);

    // DO NOT clean up transfer here - wait for confirmation from background to prevent race condition
    console.log(`[offscreen][CHUNKING] Transfer ${transferId} kept alive for background confirmation (assembledNotified: true)`);
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

    // Execute the workflow with detailed logging
    console.log('[offscreen][EXECUTE_WORKFLOW] Calling Python workflow function...');
    console.log('[offscreen][EXECUTE_WORKFLOW] workflowPayload type:', typeof workflowPayload);
    console.log('[offscreen][EXECUTE_WORKFLOW] workflowPayload keys:', Object.keys(workflowPayload));

    // === НОВАЯ СИСТЕМА ПЕРЕДАЧИ ДАННЫХ ЧЕРЕЗ PYODIDE.GLOBALS ===
    console.log('[offscreen][PYODIDE][GLOBALS] ===== НАЧАЛО ПЕРЕДАЧИ ДАННЫХ В PYODIDE GLOBALS =====');

    // Проверить, есть ли page_html в workflowPayload
    if (workflowPayload.page_html && typeof workflowPayload.page_html === 'object' && workflowPayload.page_html.__isChunkedString) {
      console.log('[offscreen][PYODIDE][GLOBALS] Обнаружены chunk данные для передачи');

      // Извлечь метаданные из chunk структуры
      const chunkMetadata = workflowPayload.page_html;
      const chunkCount = chunkMetadata.chunkCount;
      const totalLength = chunkMetadata.totalLength;

      console.log('[offscreen][PYODIDE][GLOBALS] Метаданные chunks:');
      console.log('[offscreen][PYODIDE][GLOBALS] - chunkCount:', chunkCount);
      console.log('[offscreen][PYODIDE][GLOBALS] - totalLength:', totalLength);

      // Установить метаданные в Pyodide globals
      console.log('[offscreen][PYODIDE][GLOBALS] Устанавливаю метаданные в globals...');
      pyodide.globals.set('page_html_chunk_count', chunkCount);
      pyodide.globals.set('page_html_total_length', totalLength);
      console.log('[offscreen][PYODIDE][GLOBALS] ✅ Метаданные установлены: page_html_chunk_count =', chunkCount, ', page_html_total_length =', totalLength);

      // Установить все чанки в Pyodide globals
      console.log('[offscreen][PYODIDE][GLOBALS] Устанавливаю чанки в globals...');
      for (let i = 0; i < chunkCount; i++) {
        const chunkKey = `page_html_chunk_${i}`;
        const chunkValue = workflowPayload[chunkKey] || '';

        console.log(`[offscreen][PYODIDE][GLOBALS] Устанавливаю ${chunkKey}: длина = ${chunkValue.length} символов`);
        pyodide.globals.set(chunkKey, chunkValue);

        // Дополнительная проверка что chunk установлен правильно
        const verifyChunk = pyodide.globals.get(chunkKey);
        if (verifyChunk && verifyChunk.length === chunkValue.length) {
          console.log(`[offscreen][PYODIDE][GLOBALS] ✅ ${chunkKey} успешно установлен`);
        } else {
          console.warn(`[offscreen][PYODIDE][GLOBALS] ⚠️ Возможная проблема с установкой ${chunkKey}`);
        }
      }
      console.log('[offscreen][PYODIDE][GLOBALS] ✅ Все чанки установлены в globals');

      // Логировать общее состояние globals перед вызовом функции
      console.log('[offscreen][PYODIDE][GLOBALS] Состояние globals перед вызовом функции:');
      console.log('[offscreen][PYODIDE][GLOBALS] - page_html_chunk_count:', pyodide.globals.get('page_html_chunk_count'));
      console.log('[offscreen][PYODIDE][GLOBALS] - page_html_total_length:', pyodide.globals.get('page_html_total_length'));

      console.log('[offscreen][PYODIDE][GLOBALS] ===== ПЕРЕДАЧА ДАННЫХ ЗАВЕРШЕНА =====');

    } else {
      console.log('[offscreen][PYODIDE][GLOBALS] Chunk данные не найдены, использую прямую передачу');

      // Fallback: установить page_html напрямую если нет chunks
      if (workflowPayload.page_html && typeof workflowPayload.page_html === 'string') {
        pyodide.globals.set('page_html', workflowPayload.page_html);
        console.log('[offscreen][PYODIDE][GLOBALS] ✅ page_html установлен напрямую, длина:', workflowPayload.page_html.length);
      } else {
        console.warn('[offscreen][PYODIDE][GLOBALS] ⚠️ page_html не найден или имеет неправильный тип');
      }
    }

    // Вызвать Python функцию БЕЗ аргументов - данные уже в globals
    console.log('[offscreen][PYODIDE][GLOBALS] Вызываю Python функцию analyze_ozon_product() без аргументов...');
    const resultProxy = await pyodide.runPythonAsync('analyze_ozon_product()');
    console.log('[offscreen][PYODIDE][GLOBALS] ✅ Python функция вызвана успешно');

    // === PYODIDE toPy() CONVERSION LOGGING ===
    console.log('[offscreen][PYODIDE] ===== PYODIDE RESULT CONVERSION =====');
    console.log('[offscreen][PYODIDE] Result proxy type:', typeof resultProxy);
    console.log('[offscreen][PYODIDE] Result proxy available:', resultProxy !== null && resultProxy !== undefined);

    let result;
    if (resultProxy) {
      // Логируем методы доступные у прокси
      const proxyMethods = Object.getOwnPropertyNames(resultProxy).filter(name =>
        typeof resultProxy[name] === 'function'
      );
      console.log('[offscreen][PYODIDE] Available proxy methods:', proxyMethods);

      // Проверяем, есть ли метод toJs
      const hasToJs = typeof resultProxy.toJs === 'function';
      console.log('[offscreen][PYODIDE] toJs method available:', hasToJs);

      if (hasToJs) {
        try {
          console.log('[offscreen][PYODIDE] Calling toJs() conversion...');
          result = resultProxy.toJs({ dict_converter: Object.fromEntries });
          console.log('[offscreen][PYODIDE] toJs() conversion successful');
          console.log('[offscreen][PYODIDE] Result type:', typeof result);
          console.log('[offscreen][PYODIDE] Result is object:', typeof result === 'object');
          console.log('[offscreen][PYODIDE] Result keys:', result && typeof result === 'object' ? Object.keys(result) : 'N/A');

          // Проверяем результат на наличие ошибок
          if (result && typeof result === 'object') {
            if (result.error || result.status === 'error') {
              console.error('[offscreen][PYODIDE] Python function returned error:', result);
            } else {
              console.log('[offscreen][PYODIDE] Python function completed successfully');
            }
          }

          // Проверяем на утечки памяти
          if (typeof resultProxy.destroy === 'function') {
            console.log('[offscreen][PYODIDE] Destroying result proxy to prevent memory leaks...');
            resultProxy.destroy();
            console.log('[offscreen][PYODIDE] Result proxy destroyed');
          } else {
            console.warn('[offscreen][PYODIDE] No destroy method found on result proxy - potential memory leak!');
          }

          console.log('[offscreen][PYODIDE] ===== CONVERSION COMPLETE =====');

        } catch (conversionError) {
          console.error('[offscreen][PYODIDE] toJs() conversion failed:', conversionError);
          console.error('[offscreen][PYODIDE] Conversion error details:', {
            name: conversionError.name,
            message: conversionError.message,
            stack: conversionError.stack
          });

          // Попытка альтернативной конвертации
          try {
            console.log('[offscreen][PYODIDE] Attempting fallback conversion...');
            result = resultProxy.toJs();
            console.log('[offscreen][PYODIDE] Fallback conversion successful:', typeof result);
            resultProxy.destroy();
          } catch (fallbackError) {
            console.error('[offscreen][PYODIDE] Fallback conversion also failed:', fallbackError);
            throw conversionError; // Пробрасываем оригинальную ошибку
          }
        }
      } else {
        console.error('[offscreen][PYODIDE] toJs method not available on result proxy!');
        throw new Error('Pyodide result proxy does not have toJs method');
      }
    } else {
      console.error('[offscreen][PYODIDE] Result proxy is null or undefined!');
      throw new Error('Pyodide workflow function returned null/undefined result');
    }

    console.log('[offscreen][EXECUTE_WORKFLOW] Workflow-engine executed successfully:', result);

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

  // Handle HTML_ASSEMBLED confirmation from background to cleanup transfer
  if (message.type === 'HTML_ASSEMBLED_CONFIRMED') {
    const { transferId } = message;

    if (htmlTransfers.has(transferId)) {
      htmlTransfers.delete(transferId);
      console.log(`[offscreen][CHUNKING] Transfer ${transferId} cleaned up after background confirmation`);
    } else {
      console.warn(`[offscreen][CHUNKING] Transfer ${transferId} not found for cleanup confirmation`);
    }

    return true;
  }

  // Handle HTML_ASSEMBLED rejection from background
  if (message.type === 'HTML_ASSEMBLED_REJECTED') {
    const { transferId, reason } = message;

    console.error(`[offscreen][CHUNKING] ❌ Transfer ${transferId} REJECTED by background: ${reason}`);

    if (htmlTransfers.has(transferId)) {
      const transfer = htmlTransfers.get(transferId);
      console.log(`[offscreen][CHUNKING] Transfer details:`, {
        completed: transfer.completed,
        receivedChunks: transfer.receivedChunks,
        totalChunks: transfer.chunks.length,
        assembledNotified: transfer.assembledNotified
      });

      // Mark transfer as failed but keep it for diagnostics
      transfer.failed = true;
      transfer.failureReason = reason;
    } else {
      console.warn(`[offscreen][CHUNKING] Transfer ${transferId} not found to mark as failed`);
    }

    return true;
  }

  // Handle transfer status check from background
  if (message.type === 'CHECK_TRANSFER_STATUS') {
    const { transferId } = message;
    const transfer = htmlTransfers.get(transferId);

    return {
      transferExists: !!transfer,
      assembledNotified: transfer?.assembledNotified || false,
      completed: transfer?.completed || false
    };
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

 // === EXECUTE_WORKFLOW HANDLER FOR ENHANCED CHUNKING EXECUTION ===
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
    const requestId = message.requestId || `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transferId = message.transferId;
    const useChunks = message.useChunks || false;

    // ОБНОВИТЬ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ JS BRIDGE - ИСПРАВЛЕНИЕ HARDCODED PAGEKEY
    currentPluginId = pluginId;
    currentPageKey = pageKey;

    // ПОЛУЧАЕМ HTML ДАННЫЕ ИЗ CHUNKS ИЛИ НАПРЯМУЮ
    let workflowPayload;
    if (useChunks && transferId) {
      console.log('[offscreen][EXECUTE_WORKFLOW] Using enhanced chunking - preparing chunk metadata for Python assembly...');

      // ЖДЕМ ДОСТУПНОСТИ CHUNKS И ПОДГОТАВЛИВАЕМ METADATA ДЛЯ PYTHON
      const maxWaitTime = 30000; // 30 секунд максимум
      const startWaitTime = Date.now();

      while (Date.now() - startWaitTime < maxWaitTime) {
        const transfer = htmlTransfers.get(transferId);
        if (transfer && transfer.completed && transfer.chunks.every(chunk => chunk !== undefined)) {
          console.log('[offscreen][EXECUTE_WORKFLOW][CHUNKING] ===== PREPARING CHUNKS FOR PYTHON ASSEMBLY =====');
          console.log('[offscreen][EXECUTE_WORKFLOW][CHUNKING] Total chunks to send:', transfer.chunks.length);

          // Prepare chunk metadata for Python reconstruction instead of assembling here
          const chunkMetadata = {
            __isChunkedString: true,
            originalKey: 'page_html',
            chunkCount: transfer.chunks.length,
            totalLength: transfer.chunks.reduce((sum, chunk) => sum + (chunk ? chunk.length : 0), 0)
          };

          // Create input data with chunk metadata + all chunks
          workflowPayload = { page_html: chunkMetadata };

          // Add all chunks to payload
          for (let i = 0; i < transfer.chunks.length; i++) {
            workflowPayload[`page_html_chunk_${i}`] = transfer.chunks[i] || '';
          }

          // Log chunk details for debugging
          console.log(`[offscreen][EXECUTE_WORKFLOW][CHUNKING] Preparing ${transfer.chunks.length} chunks for Python:`);
          transfer.chunks.forEach((chunk, idx) => {
            console.log(`[offscreen][EXECUTE_WORKFLOW][CHUNKING] Chunk ${idx}: ${chunk ? chunk.length : 0} characters`);
          });
          console.log(`[offscreen][EXECUTE_WORKFLOW][CHUNKING] Total expected length: ${workflowPayload.page_html.totalLength}`);

          console.log('[offscreen][EXECUTE_WORKFLOW][CHUNKING] ===== CHUNK PREPARATION COMPLETE =====');
          break;
        }

        // ЖДЕМ НЕМНОГО ПЕРЕД СЛЕДУЮЩЕЙ ПРОВЕРКОЙ
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!workflowPayload) {
        throw new Error(`Timeout waiting for chunk data preparation (transferId: ${transferId})`);
      }
    } else if (message.pageHtml) {
      // ПРЯМАЯ ПЕРЕДАЧА HTML ДАННЫХ (FALLBACK)
      workflowPayload = { page_html: message.pageHtml };
      console.log('[offscreen][EXECUTE_WORKFLOW] Using direct pageHtml from message:', message.pageHtml.length, 'chars');
    } else {
      throw new Error('No HTML data provided - neither chunks nor direct pageHtml available');
    }

     console.log('[offscreen][EXECUTE_WORKFLOW] Запускаю workflow-engine с pluginId:', pluginId);

     // Send progress message to chat
     chrome.runtime.sendMessage({
       type: 'PYODIDE_MESSAGE',
       pluginId: pluginId,
       pageKey: pageKey,
       message: {
         role: 'plugin',
         content: '🔄 Запуск выполнения workflow с chunk данными...',
         timestamp: Date.now()
       }
     });

     // === МАКСИМАЛЬНОЕ ЛОГИРОВАНИЕ WORKFLOW PAYLOAD ===
     console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] ===== ПОДРОБНЫЙ АНАЛИЗ WORKFLOW PAYLOAD =====');
     console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] Timestamp:', new Date().toISOString());
     console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] PluginId:', pluginId);
     console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] PageKey:', pageKey);
     console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] RequestId:', requestId);

     // Детальный анализ workflowPayload
     console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] WorkflowPayload structure:');
     console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - Keys:', Object.keys(workflowPayload));
     console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - Total keys:', Object.keys(workflowPayload).length);

     // Анализ page_html
     if (workflowPayload.page_html !== undefined) {
       const pageHtmlValue = workflowPayload.page_html;
       console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - page_html type:', typeof pageHtmlValue);

       if (typeof pageHtmlValue === 'string') {
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - page_html length (chars):', pageHtmlValue.length);
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - page_html size (bytes):', new Blob([pageHtmlValue]).size);
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - page_html first 200 chars:', pageHtmlValue.substring(0, 200));
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - page_html last 200 chars:', pageHtmlValue.substring(Math.max(0, pageHtmlValue.length - 200)));

         // Проверка на обрезание (ищем незакрытые теги в конце)
         const openTags = (pageHtmlValue.match(/<[^\/][^>]*>/g) || []).length;
         const closeTags = (pageHtmlValue.match(/<\/[^>]+>/g) || []).length;
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - HTML integrity check:');
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING]   - Open tags:', openTags);
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING]   - Close tags:', closeTags);
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING]   - Tag balance:', openTags - closeTags);

         if (Math.abs(openTags - closeTags) > 5) {
           console.warn('[offscreen][EXECUTE_WORKFLOW][LOGGING] ⚠️ POTENTIAL HTML TRUNCATION DETECTED! Tag imbalance:', openTags - closeTags);
         }

         // Проверка на наличие основных HTML структур
         const hasHtmlTag = pageHtmlValue.includes('<html');
         const hasBodyTag = pageHtmlValue.includes('<body');
         const hasHeadTag = pageHtmlValue.includes('<head');
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - HTML structure check:');
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING]   - Has <html> tag:', hasHtmlTag);
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING]   - Has <body> tag:', hasBodyTag);
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING]   - Has <head> tag:', hasHeadTag);

         if (!hasBodyTag && !hasHtmlTag) {
           console.warn('[offscreen][EXECUTE_WORKFLOW][LOGGING] ⚠️ POTENTIAL HTML FRAGMENT DETECTED! Missing basic HTML structure');
         }

       } else if (pageHtmlValue && typeof pageHtmlValue === 'object') {
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - page_html is object (chunk metadata):', JSON.stringify(pageHtmlValue, null, 2));
         if (pageHtmlValue.__isChunkedString) {
           console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - Detected chunked string metadata');
           console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING]   - Original key:', pageHtmlValue.originalKey);
           console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING]   - Chunk count:', pageHtmlValue.chunkCount);
           console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING]   - Total length:', pageHtmlValue.totalLength);
         }
       } else {
         console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - page_html value:', pageHtmlValue);
       }
     } else {
       console.error('[offscreen][EXECUTE_WORKFLOW][LOGGING] ❌ page_html is undefined!');
     }

     // Проверка на chunk ключи
     const chunkKeys = Object.keys(workflowPayload).filter(key => key.includes('_chunk_'));
     if (chunkKeys.length > 0) {
       console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - Found chunk keys:', chunkKeys.length);
       chunkKeys.forEach(key => {
         const chunkValue = workflowPayload[key];
         console.log(`[offscreen][EXECUTE_WORKFLOW][LOGGING]   - ${key}: ${typeof chunkValue}, length: ${chunkValue ? chunkValue.length : 'N/A'}`);
       });
     }

     // Общий размер payload
     const payloadSize = JSON.stringify(workflowPayload).length;
     console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] - Total payload size (JSON):', payloadSize, 'characters');
     console.log('[offscreen][EXECUTE_WORKFLOW][LOGGING] ===== КОНЕЦ АНАЛИЗА WORKFLOW PAYLOAD =====');

     // Execute workflow with chunks
     const result = await executeWorkflowWithChunks(pluginId, pageKey, workflowPayload, requestId, sendResponse);

     console.log('[offscreen][EXECUTE_WORKFLOW] Workflow execution completed');

   } catch (error) {
     console.error('[offscreen][EXECUTE_WORKFLOW] КРИТИЧЕСКАЯ ОШИБКА:', error);
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