/**
 * Offscreen Document for Agent Plugins Platform
 * 
 * This is the "workhorse" of the extension where all heavy operations
 * are executed in a stable DOM context.
 */

/// <reference types="chrome"/>

// ==============================================================================
// GLOBAL INTERFACES AND TYPES
// ==============================================================================

declare global {
  const loadPyodide: LoadPyodide;
  function importScripts(...urls: string[]): void;
}

// Export to make it an external module
declare const importScripts: typeof globalThis.importScripts;

interface PyodideInterface {
  runPythonAsync(code: string): Promise<any>;
  globals: Map<string, any>;
  toPy(obj: any): any;
}

interface LoadPyodideOptions {
  indexURL?: string;
}

interface LoadPyodide {
  (options?: LoadPyodideOptions): Promise<PyodideInterface>;
}

interface WorkflowStep {
  id: string;
  description?: string;
  tool: string;
  inputs?: Record<string, any>;
  run_if?: string;
  retry_count?: number;
  timeout_ms?: number;
  on_error?: 'fail' | 'skip' | 'retry';
  dependencies?: string[];
  metadata?: Record<string, any>;
}

interface WorkflowDefinition {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  initialInput?: Record<string, any>;
  metadata?: Record<string, any>;
  version?: string;
}

interface WorkflowExecutionResult {
  success: boolean;
  result: any;
  totalDuration: number;
  stepResults: Record<string, StepExecutionResult>;
  errors: WorkflowError[];
}

interface StepExecutionResult {
  success: boolean;
  result: any;
  duration: number;
  startTime: number;
  endTime: number;
  retryCount: number;
  error?: WorkflowError;
}

interface WorkflowError {
  stepId: string;
  error: string;
  timestamp: number;
  retryAttempt?: number;
  recoverable: boolean;
}

interface WorkflowContext {
  steps: Record<string, any>;
  input: Record<string, any>;
  pluginId: string;
  startTime: number;
  logger: Logger;
  hostApi: Record<string, any>;
  [key: string]: any;
}

interface Logger {
  addMessage(level: string, message: string, data?: any): void;
  renderResult?(stepId: string, result: any): void;
}

interface OfflineLogger extends Logger {
  isEnabled: boolean;
  enable(): void;
  disable(): void;
}

// ==============================================================================
// LOGGING AND MONITORING SYSTEM
// ==============================================================================

class OffscreenLogger implements Logger {
  private logs: Array<{ timestamp: number; level: string; message: string; data?: any }> = [];

  addMessage(level: string, message: string, data?: any): void {
    const logEntry = { timestamp: Date.now(), level: level.toUpperCase(), message, data };
    this.logs.push(logEntry);

    // Limit log size (max 1000 entries)
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    
    // Safe message sending with error handling
    this.sendMessageSafely({ type: 'LOG_MESSAGE', data: logEntry });
  }

  renderResult(stepId: string, result: any): void {
    this.addMessage('RESULT', `Step ${stepId} result`, result);
    this.sendMessageSafely({ 
      type: 'WORKFLOW_RESULT', 
      data: { stepId, result: JSON.stringify(result), timestamp: Date.now() }
    });
  }

  private sendMessageSafely(message: any): void {
    try {
      chrome.runtime.sendMessage(message).catch(() => {
        // Silently handle disconnection errors
      });
    } catch (error) {
      // Extension context may not be available
    }
  }

  getLogs(): any[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  getLogsByLevel(level: string): any[] {
    return this.logs.filter(log => log.level === level.toUpperCase());
  }
}

// ==============================================================================
// MEMORY MANAGEMENT AND CACHING
// ==============================================================================

class MemoryManager {
  private objectPool: Map<string, any[]> = new Map();
  private lruCache: Map<string, any> = new Map();
  private activeObjects: Map<string, number> = new Map();
  private maxPoolSize = 100;
  private cleanupInterval = 30000;

  constructor() {
    setInterval(() => this._cleanup(), this.cleanupInterval);
  }

  getObject<T>(type: string, factory: (...args: any[]) => T, ...args: any[]): T {
    const pool = this.objectPool.get(type) || [];

    if (pool.length > 0) {
      const obj = pool.pop();
      this.activeObjects.set(type, (this.activeObjects.get(type) || 0) + 1);
      return obj;
    }

    const obj = factory(...args);
    this.activeObjects.set(type, (this.activeObjects.get(type) || 0) + 1);
    return obj;
  }

  returnObject(type: string, obj: any): void {
    const pool = this.objectPool.get(type) || [];
    if (pool.length < this.maxPoolSize) {
      pool.push(obj);
      this.objectPool.set(type, pool);
      this.activeObjects.set(type, Math.max(0, (this.activeObjects.get(type) || 0) - 1));
    }
  }

  cache(key: string, value: any, ttlMs: number = 300000): void {
    const expiry = Date.now() + ttlMs;
    this.lruCache.set(key, { value, expiry });

    if (this.lruCache.size > this.maxPoolSize) {
      const firstKey = this.lruCache.keys().next().value;
      if (firstKey !== undefined) {
        this.lruCache.delete(firstKey);
      }
    }
  }

  getCached<T>(key: string): T | null {
    const entry = this.lruCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.lruCache.delete(key);
      return null;
    }

    return entry.value;
  }

  private _cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.lruCache.forEach((entry, key) => {
      if (now > entry.expiry) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.lruCache.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`[MemoryManager] Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  getStats(): Record<string, any> {
    return {
      poolSize: Array.from(this.objectPool.entries()).reduce((acc: Record<string, number>, [key, arr]) => {
        acc[key] = arr.length;
        return acc;
      }, {} as Record<string, number>),
      cacheSize: this.lruCache.size,
      activeObjects: Object.fromEntries(this.activeObjects)
    };
  }
}

// ==============================================================================
// BATCH PROCESSOR FOR AI REQUESTS
// ==============================================================================

class BatchProcessor {
  private pendingRequests: Array<{
    modelAlias: string;
    prompt: string;
    context?: string;
    resolve: (value: string) => void;
    reject: (error: any) => void;
    timestamp: number;
  }> = [];

  private isProcessing = false;
  private batchSize = 3;
  private timeoutMs = 2000;
  private aiClient: AiClient;

  constructor(aiClient: AiClient) {
    this.aiClient = aiClient;
  }

  addRequest(modelAlias: string, prompt: string, context?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        modelAlias,
        prompt,
        context,
        resolve,
        reject,
        timestamp: Date.now()
      });

      if (this.pendingRequests.length >= this.batchSize) {
        setTimeout(() => this._processBatch(), 100);
      } else {
        setTimeout(() => {
          if (this.pendingRequests.length > 0 && !this.isProcessing) {
            this._processBatch();
          }
        }, this.timeoutMs);
      }
    });
  }

  private async _processBatch(): Promise<void> {
    if (this.isProcessing || this.pendingRequests.length === 0) return;

    this.isProcessing = true;
    const batch = [...this.pendingRequests];
    this.pendingRequests = [];

    try {
      const byModel = new Map<string, typeof batch>();

      batch.forEach(request => {
        const modelRequests = byModel.get(request.modelAlias) || [];
        modelRequests.push(request);
        byModel.set(request.modelAlias, modelRequests);
      });

      const tasks = Array.from(byModel.entries()).map(([model, requests]) =>
        this._processModelBatch(model, requests)
      );

      await Promise.all(tasks);
    } finally {
      this.isProcessing = false;
    }
  }

  private async _processModelBatch(model: string, requests: typeof this.pendingRequests): Promise<void> {
    try {
      if (requests.length === 1) {
        await this._processSingleRequest(requests[0]);
        return;
      }

      if (requests.every(r => !r.context)) {
        let combinedPrompt = requests.map(r => `REQUEST_${requests.indexOf(r) + 1}: ${r.prompt}`).join('\n\n---SEPARATOR---\n\n');
        combinedPrompt += '\n\nPlease respond to each request separately, dividing with ---SEPARATOR---.';

        const combinedResponse = await this._callAiModel(model, combinedPrompt);
        const parts = combinedResponse.split('---SEPARATOR---');

        requests.forEach((request, index) => {
          const response = index < parts.length ? parts[index].trim() : 'Batch processing error';
          request.resolve(response);
        });
      } else {
        await Promise.all(requests.map(r => this._processSingleRequest(r)));
      }
    } catch (error) {
      requests.forEach(r => r.reject(error));
    }
  }

  private async _processSingleRequest(request: typeof this.pendingRequests[0]): Promise<void> {
    try {
      const response = await this._callAiModel(request.modelAlias, request.prompt, request.context);
      request.resolve(response);
    } catch (error) {
      request.reject(error);
    }
  }

  private async _callAiModel(model: string, prompt: string, context?: string): Promise<string> {
    return await this.aiClient.call(model, prompt, context);
  }
}

// ==============================================================================
// AI API CLIENT
// ==============================================================================

class AiClient {
  private cache: Map<string, {value: string, expiry: number}> = new Map();

  async call(modelAlias: string, prompt: string, context?: string): Promise<string> {
    const cacheKey = `${modelAlias}:${prompt.slice(0, 100)}:${context ? context.slice(0, 50) : ''}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiry) {
      console.log(`[AI Client] Cache hit for ${modelAlias}`);
      return cached.value;
    }

    console.log(`[AI Client] Calling AI model ${modelAlias} via background...`);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ai_call',
        data: {
          modelAlias,
          prompt,
          context
        }
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.result) {
        throw new Error('No result received from AI provider');
      }

      this.cache.set(cacheKey, {
        value: response.result,
        expiry: Date.now() + 7200000 // 2 hours
      });

      console.log(`[AI Client] Successfully received response from ${modelAlias}:`, response.result.substring(0, 100) + '...');
      return response.result;
    } catch (error: any) {
      console.error(`[AI Client] Error calling ${modelAlias}:`, error);
      throw new Error(`AI call failed: ${error.message || error}`);
    }
  }

  async getCached(cacheKey: string): Promise<string | null> {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.value;
    }
    this.cache.delete(cacheKey);
    return null;
  }
}

// ==============================================================================
// PYODIDE RUNTIME MANAGEMENT
// ==============================================================================

class PyodideManager {
  public pyodide: PyodideInterface | null = null;
  private isReady: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private logger: OffscreenLogger;
  public hostCallPromises = new Map<string, { resolve: Function, reject: Function }>();

  constructor(logger: OffscreenLogger) {
    this.logger = logger;
    this.initializationPromise = this._doInitialize();
  }

  private async _doInitialize(): Promise<void> {
    try {
      this.logger.addMessage('DEBUG', 'Loading Pyodide loader script...');
      
      if (!(self as any).loadPyodide) { 
        importScripts('/pyodide/pyodide.js'); 
      }
      const loadPyodideFn = (self as any).loadPyodide as LoadPyodide;

      this.logger.addMessage('INFO', 'Initializing Pyodide runtime...');
      this.pyodide = await loadPyodideFn({ indexURL: '/pyodide/' });

      this.pyodide.globals.set('js', {
        sendMessageToChat: (message: any) => {
          const jsMessage = message.toJs({ dict_converter: Object.fromEntries });
          chrome.runtime.sendMessage({
            type: 'LOG_MESSAGE',
            data: { level: 'PYTHON', message: jsMessage.content, timestamp: Date.now() }
          }).catch(() => {});
        },
        llm_call: (modelAlias: any, params: any) => this._createHostCallPromise('llm_call', [modelAlias.toJs(), params.toJs({ dict_converter: Object.fromEntries })]),
        get_setting: (settingName: any) => this._createHostCallPromise('get_setting', [settingName.toJs()])
      });

      this.logger.addMessage('DEBUG', 'JS bridge for Pyodide established.');
      this.isReady = true;
      this.logger.addMessage('INFO', 'Pyodide runtime successfully initialized.');
    } catch (error: any) {
      this.logger.addMessage('CRITICAL', `Critical error initializing Pyodide: ${error.message}`);
      throw error;
    }
  }

  private _createHostCallPromise(func: string, args: any[]): Promise<any> {
    const callId = `host_call_${Date.now()}_${Math.random()}`;
    const promise = new Promise((resolve, reject) => {
      this.hostCallPromises.set(callId, { resolve, reject });
    });
    
    chrome.runtime.sendMessage({ type: 'HOST_CALL', payload: { func, callId, args } })
      .catch(() => {}); // Handle disconnection silently
    
    return promise;
  }

  async awaitReady(): Promise<void> {
    await this.initializationPromise;
  }

  private _processLargeStrings(params: any): any {
    const MAX_STRING_SIZE = 100000;
    const CHUNK_SIZE = 25000;

    console.log('[PYODIDE_MANAGER] Processing large strings check...');
    console.log(`[PYODIDE_MANAGER] Input parameters: keys=${Object.keys(params)}, sizes=${Object.entries(params).map(([k,v]) => `${k}:${typeof v === 'string' ? v.length : typeof v}`).join(', ')}`);

    let processedParams = { ...params };
    let hasLargeString = false;

    function processObject(obj: any, path: string[] = []): any {
      if (typeof obj === 'string' && obj.length > MAX_STRING_SIZE) {
        console.log(`[PYODIDE_MANAGER] Found large string: path=${path.join('.')}, size=${obj.length}, limit=${MAX_STRING_SIZE}`);

        hasLargeString = true;
        const stringKey = path.join('.');

        const chunks: string[] = [];
        for (let i = 0; i < obj.length; i += CHUNK_SIZE) {
          chunks.push(obj.slice(i, i + CHUNK_SIZE));
        }

        console.log(`[PYODIDE_MANAGER] String split into ${chunks.length} chunks of ~${CHUNK_SIZE} characters`);

        processedParams[stringKey] = {
          __isChunkedString: true,
          totalLength: obj.length,
          chunkCount: chunks.length,
          originalKey: stringKey
        };

        for (let i = 0; i < chunks.length; i++) {
          processedParams[`${stringKey}_chunk_${i}`] = chunks[i];
          if (i < 3 || i > chunks.length - 3) {
            console.log(`[PYODIDE_MANAGER] Added chunk ${i}: ${chunks[i].length} characters`);
          }
        }

        return processedParams[stringKey];
      } else if (typeof obj === 'string') {
        console.log(`[PYODIDE_MANAGER] Small string: path=${path.join('.')}, size=${obj.length}`);
        return obj;
      } else if (typeof obj === 'object' && obj !== null) {
        const processed: any = Array.isArray(obj) ? [] : {};
        const keys = Object.keys(obj);

        for (const key of keys) {
          const currentPath = [...path, key];
          processed[key] = processObject(obj[key], currentPath);
        }

        return processed;
      }

      return obj;
    }

    processObject(processedParams);

    if (hasLargeString) {
      console.log(`[PYODIDE_MANAGER] Processing complete. Chunks passed to Python: ${Object.keys(processedParams).filter(k => k.includes('_chunk_')).length}`);
      this.logger.addMessage('DEBUG', `Large strings detected, chunking performed`);
    } else {
      console.log('[PYODIDE_MANAGER] No large strings found!');
    }

    console.log(`[PYODIDE_MANAGER] Final parameters for Python: keys=${Object.keys(processedParams)}`);
    return processedParams;
  }

  async loadAndRunFunction(pluginId: string, functionName: string, params: any): Promise<any> {
    await this.awaitReady();
    if (!this.pyodide) throw new Error('Pyodide is not initialized');

    try {
      const scriptUrl = `plugins/${pluginId}/mcp_server.py`;
      this.logger.addMessage('DEBUG', `Loading Python script: ${scriptUrl}`);
      
      const response = await fetch(scriptUrl);
      if (!response.ok) {
        throw new Error(`Failed to load Python script for plugin ${pluginId}`);
      }
      const pythonCode = await response.text();

      await this.pyodide.runPythonAsync(pythonCode);
      this.logger.addMessage('DEBUG', `Plugin script ${pluginId} executed, functions defined.`);

      const toolFunc = this.pyodide.globals.get(functionName);
      if (typeof toolFunc !== 'function') {
        throw new Error(`Function "${functionName}" not found in Python script for plugin ${pluginId}.`);
      }
      this.logger.addMessage('DEBUG', `Got reference to Python function: ${functionName}`);

      const processedParams = this._processLargeStrings(params);
      this.logger.addMessage('DEBUG', `Parameter processing completed`);

      const paramsSize = JSON.stringify(processedParams).length;
      console.log(`[PYODIDE_MANAGER] PRE-PYTHON CHECK ===================`);
      console.log(`[PYODIDE_MANAGER] Function: ${functionName}`);
      console.log(`[PYODIDE_MANAGER] Plugin: ${pluginId}`);
      console.log(`[PYODIDE_MANAGER] Total parameters size: ${paramsSize} chars`);
      console.log(`[PYODIDE_MANAGER] Parameter keys:`, Object.keys(processedParams || {}));

      if (processedParams && processedParams.page_html) {
        const htmlSize = processedParams.page_html.length;
        console.log(`[PYODIDE_MANAGER] HTML CONTENT SIZE: ${htmlSize} characters`);
        console.log(`[PYODIDE_MANAGER] HTML CONTENT SAMPLE:`, processedParams.page_html.substring(0, 200) + (htmlSize > 200 ? '...' : ''));

        if (htmlSize < 10000) {
          console.warn(`[PYODIDE_MANAGER] HTML size (${htmlSize}) is suspiciously small! Expected ~1,049,229 symbols`);
        } else if (htmlSize > 100000) {
          console.log(`[PYODIDE_MANAGER] HTML size (${htmlSize}) looks reasonable`);
        }
      } else {
        console.warn(`[PYODIDE_MANAGER] No page_html property found in parameters!`);
      }

      console.log(`[PYODIDE_MANAGER] PRE-PYTHON CHECK END =================`);

      this.logger.addMessage('DEBUG', `Calling ${functionName} with processed parameters...`);
      const resultProxy = await toolFunc(processedParams);

      this.logger.addMessage('DEBUG', `Python function ${functionName} returned result (PyProxy).`);

      const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
      resultProxy.destroy();

      return result;

    } catch (error: any) {
      this.logger.addMessage('ERROR', `Error calling Python tool ${pluginId}/${functionName}: ${error.message}`);
      throw error;
    }
  }
}

// ==============================================================================
// CHUNK MANAGER FOR LARGE DATA ASSEMBLY
// ==============================================================================

class ChunkManager {
  private transfers = new Map<string, { chunks: string[], total: number }>();
  private readonly logger = console; // Use console for detailed logging

  public addChunk(transferId: string, chunkData: string, chunkIndex: number, totalChunks: number): void {
    // Initialize transfer if needed
    if (!this.transfers.has(transferId)) {
      this.transfers.set(transferId, { chunks: new Array(totalChunks), total: totalChunks });
      this.logger.log(`[CHUNKING] Initialized transfer ${transferId} for ${totalChunks} chunks`);
    }

    const transfer = this.transfers.get(transferId)!;

    // Adjust for 1-based indexing (assuming sender uses 1-n instead of 0-(n-1))
    const adjustedIndex = chunkIndex - 1;

    // Check bounds
    if (adjustedIndex < 0 || adjustedIndex >= transfer.total) {
      this.logger.error(`[CHUNKING] ERROR: Invalid chunk index ${chunkIndex} (adjusted to ${adjustedIndex}) for total ${totalChunks}. Ignoring chunk.`);
      return;
    }

    // Check for duplicate chunks
    if (transfer.chunks[adjustedIndex] !== undefined) {
      this.logger.warn(`[CHUNKING] WARNING: Chunk ${chunkIndex} (adjusted ${adjustedIndex}) for transfer ${transferId} already exists! Overwriting...`);
    }

    // Store chunk
    transfer.chunks[adjustedIndex] = chunkData;

    // Calculate received chunks count
    const receivedChunks = transfer.chunks.filter(chunk => chunk !== undefined).length;

    this.logger.log(`[CHUNKING] Stored chunk ${chunkIndex} (adjusted to ${adjustedIndex}) (${chunkData.length} chars) for ${transferId}: ${receivedChunks}/${totalChunks}`);
    this.logger.log(`[CHUNKING] Chunk ${chunkIndex} first 50 chars: "${chunkData.substring(0, 50)}"`);

    // Check completion
    if (receivedChunks === totalChunks) {
      this.logger.log(`[CHUNKING] All chunks received for transfer ${transferId}. Ready for assembly.`);
    }
  }

  public isComplete(transferId: string): boolean {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      this.logger.warn(`[CHUNKING] Transfer ${transferId} not found in isComplete check`);
      return false;
    }

    const receivedChunks = transfer.chunks.filter(chunk => chunk !== undefined).length;
    const isComplete = receivedChunks === transfer.total;

    this.logger.log(`[CHUNKING] Checking completion for ${transferId}: ${receivedChunks}/${transfer.total} (${isComplete ? 'COMPLETE' : 'INCOMPLETE'})`);

    return isComplete;
  }

  public getAssembled(transferId: string): string {
    this.logger.log(`[CHUNKING] Starting assembly for ${transferId}`);

    if (!this.isComplete(transferId)) {
      this.logger.error(`[CHUNKING] ERROR: Transfer ${transferId} is not complete. Cannot assemble.`);
      throw new Error(`Transfer ${transferId} is not complete.`);
    }

    const transfer = this.transfers.get(transferId)!;

    // Debug: Check each chunk before assembly
    this.logger.log(`[CHUNKING] Pre-assembly chunk validation:`);
    for (let i = 0; i < transfer.chunks.length; i++) {
      const chunk = transfer.chunks[i];
      if (chunk === undefined) {
        this.logger.error(`[CHUNKING] ERROR: Chunk ${i} is undefined! This will cause 'undefined' in assembled string.`);
      } else if (chunk === null) {
        this.logger.error(`[CHUNKING] ERROR: Chunk ${i} is null! This will cause 'null' in assembled string.`);
      } else if (chunk.length === 0) {
        this.logger.warn(`[CHUNKING] WARNING: Chunk ${i} is empty string`);
      }
      this.logger.log(`[CHUNKING] Chunk ${i}: length=${chunk?.length || 0}, first20="${chunk?.substring(0, 20) || 'null/undefined'}", last20="${chunk?.substring(chunk.length - 20) || 'null/undefined'}"`);
    }

    const assembled = transfer.chunks.join('');

    // Detailed logging of assembly process
    this.logger.log(`[CHUNKING] Assembling ${transfer.chunks.length} chunks for ${transferId}`);
    this.logger.log(`[CHUNKING] Chunk sizes: ${transfer.chunks.map((chunk, i) => `${i}:${chunk?.length || 0}`).join(', ')}`);

    const totalExpectedLength = transfer.chunks.reduce((sum, chunk) => sum + (chunk?.length || 0), 0);
    this.logger.log(`[CHUNKING] Expected total length: ${totalExpectedLength}`);
    this.logger.log(`[CHUNKING] Actual assembled length: ${assembled.length}`);

    if (assembled.length !== totalExpectedLength) {
      this.logger.error(`[CHUNKING] ERROR: Length mismatch! Expected ${totalExpectedLength}, got ${assembled.length}`);
    }

    this.logger.log(`[CHUNKING] Assembly sample: "${assembled.substring(0, 100)}"...`);

    // Final validation - ensure assembled data is not empty
    if (assembled.length === 0) {
      this.logger.error(`[CHUNKING] ERROR: Assembled string is empty! No data was collected.`);
      this.logger.error(`[CHUNKING] Chunk details summary:`);
      for (let i = 0; i < transfer.chunks.length; i++) {
        this.logger.error(`[CHUNKING] Chunk ${i}: ${transfer.chunks[i] === undefined ? 'UNDEFINED' : `length=${transfer.chunks[i].length}`}`);
      }
    } else {
      this.logger.log(`[CHUNKING] SUCCESS: Assembled ${assembled.length} characters`);
    }

    // Clean up
    this.transfers.delete(transferId);
    this.logger.log(`[CHUNKING] Transfer ${transferId} cleaned up from memory`);

    return assembled;
  }

  public getStats(transferId: string): any {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return null;

    const chunkStats = transfer.chunks.map((chunk, i) => ({
      index: i,
      size: chunk?.length || 0,
      present: chunk !== undefined
    }));

    return {
      transferId,
      totalChunks: transfer.total,
      receivedChunks: transfer.chunks.filter(c => c !== undefined).length,
      isComplete: this.isComplete(transferId),
      chunkStats
    };
  }
}

// ==============================================================================
// WORKFLOW ENGINE
// ==============================================================================

class WorkflowEngine {
  private logger: OffscreenLogger;
  private pyodideManager: PyodideManager;
  private aiClient: AiClient;
  private memoryManager: MemoryManager;
  private batchProcessor: BatchProcessor;

  constructor(
    logger: OffscreenLogger,
    pyodideManager: PyodideManager,
    aiClient: AiClient,
    memoryManager: MemoryManager,
    batchProcessor: BatchProcessor
  ) {
      this.logger = logger;
      this.pyodideManager = pyodideManager;
      this.aiClient = aiClient;
      this.memoryManager = memoryManager;
      this.batchProcessor = batchProcessor;
  }

  async runWorkflow(pluginId: string, context: Partial<WorkflowContext>): Promise<WorkflowExecutionResult> {
    const workflowStartTime = performance.now();

    const fullContext: WorkflowContext = {
      steps: {},
      input: context.input || {},
      pluginId,
      startTime: Date.now(),
      logger: this.logger,
      hostApi: context.hostApi || {},
      ...context
    };

    const executionResult: WorkflowExecutionResult = {
      success: false,
      result: null,
      totalDuration: 0,
      stepResults: {},
      errors: []
    };

    this.logger.addMessage('ENGINE', `Starting workflow for plugin: ${pluginId}`);

    try {
      const workflow = await this._loadAndValidateWorkflowDefinition(pluginId);
      if (!workflow) {
        const errorMsg = `Failed to load or validate workflow definition for plugin ${pluginId}`;
        throw new Error(errorMsg);
      }
      this.logger.addMessage('ENGINE', `Workflow loaded: ${workflow.steps.length} steps`);

      if (workflow.initialInput) {
        fullContext.input = { ...fullContext.input, ...workflow.initialInput };
        this.logger.addMessage('ENGINE', `Applied initial data: ${Object.keys(workflow.initialInput).join(', ')}`);
      }

      const executionPlan = this._buildExecutionPlan(workflow);
      this.logger.addMessage('ENGINE', `Execution plan formed: ${executionPlan.length} steps`);

      for (const step of executionPlan) {
        const stepStartTime = performance.now();

        try {
          const shouldRun = this._evaluateRunIf(step.run_if, fullContext);
          if (!shouldRun) {
            this.logger.addMessage('ENGINE', `Skipped step: ${step.id} (run_if condition not met)`);
            continue;
          }

          this.logger.addMessage('ENGINE', `Executing step: ${step.id} (${step.tool}) - ${step.description || 'no description'}`);

          const stepResult = await this._executeStepWithRetry(step, fullContext);

          fullContext.steps[step.id] = { output: stepResult.result };
          executionResult.stepResults[step.id] = stepResult;

          const stepDuration = performance.now() - stepStartTime;
          this.logger.addMessage('ENGINE', `Step ${step.id} completed in ${stepDuration.toFixed(0)}ms${stepResult.retryCount > 0 ? ` (retries: ${stepResult.retryCount})` : ''}`);

        } catch (stepError: any) {
          const stepDuration = performance.now() - stepStartTime;
          const workflowError: WorkflowError = {
            stepId: step.id,
            error: stepError.message,
            timestamp: Date.now(),
            recoverable: this._isRecoverableError(stepError)
          };

          executionResult.errors.push(workflowError);
          executionResult.stepResults[step.id] = {
            success: false,
            result: null,
            duration: stepDuration,
            startTime: stepStartTime,
            endTime: performance.now(),
            retryCount: step.retry_count || 0,
            error: workflowError
          };

          if (step.on_error === 'fail' || step.on_error === undefined) {
            throw stepError;
          } else if (step.on_error === 'skip') {
            this.logger.addMessage('WARN', `Step ${step.id} skipped due to error: ${stepError.message}`);
            continue;
          }
        }
      }

      const workflowDuration = performance.now() - workflowStartTime;
      executionResult.totalDuration = workflowDuration;
      executionResult.success = executionResult.errors.filter(e => !e.recoverable).length === 0;

      this.logger.addMessage('ENGINE', `Workflow completed in ${workflowDuration.toFixed(0)}ms, status: ${executionResult.success ? 'SUCCESS' : 'PARTIAL_SUCCESS'}`);

      const lastStepId = Object.keys(fullContext.steps).slice(-1)[0];
      if (lastStepId && executionResult.stepResults[lastStepId]?.success) {
        executionResult.result = executionResult.stepResults[lastStepId].result;
        this.logger.renderResult(lastStepId, executionResult.result);
      } else {
        executionResult.result = {
          status: executionResult.success ? 'completed' : 'partial_completion',
          message: `Workflow completed with ${executionResult.errors.length} errors`,
          executedSteps: Object.keys(executionResult.stepResults).length,
          totalSteps: workflow.steps.length
        };
      }

      return executionResult;

    } catch (criticalError: any) {
      const workflowDuration = performance.now() - workflowStartTime;
      executionResult.totalDuration = workflowDuration;
      executionResult.errors.push({
        stepId: 'global',
        error: criticalError.message,
        timestamp: Date.now(),
        recoverable: false
      });

      this.logger.addMessage('CRITICAL', `Workflow execution failed: ${criticalError.message}`);
      executionResult.success = false;
      executionResult.result = {
        status: 'failed',
        message: criticalError.message,
        executedSteps: Object.keys(executionResult.stepResults).length,
        totalSteps: 0
      };

      return executionResult;
    }
  }

  private async _loadAndValidateWorkflowDefinition(pluginId: string): Promise<WorkflowDefinition | null> {
    try {
      const response = await fetch(`plugins/${pluginId}/workflow.json`);
      if (!response.ok) {
        throw new Error(`Failed to load workflow.json for plugin ${pluginId}`);
      }
      const workflow: WorkflowDefinition = await response.json();
      return workflow;
    } catch (error) {
      this.logger.addMessage('ERROR', `Failed to load workflow definition for ${pluginId}: ${(error as Error).message}`);
      return null;
    }
  }

  private _buildExecutionPlan(workflow: WorkflowDefinition): WorkflowStep[] {
    return workflow.steps;
  }

  private _evaluateRunIf(runIf: string | undefined, context: WorkflowContext): boolean {
    if (!runIf) return true;

    try {
      const result = this._evaluateExpression(runIf, context);
      return result === true;
    } catch (error) {
      this.logger.addMessage('WARN', `Failed to evaluate run_if condition "${runIf}": ${(error as Error).message}`);
      return false;
    }
  }

  private _evaluateExpression(expr: string, context: WorkflowContext): any {
    return true; // Placeholder - implement expression evaluation
  }

  private async _executeStepWithRetry(step: WorkflowStep, context: WorkflowContext): Promise<StepExecutionResult> {
    let lastError: any;
    const maxRetries = step.retry_count || 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this._executeSingleStep(step, context);
        return {
          success: true,
          result: result,
          duration: 0, // placeholder
          startTime: Date.now(),
          endTime: Date.now(),
          retryCount: attempt,
        };
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          this.logger.addMessage('WARN', `Step ${step.id} retry ${attempt + 1}/${maxRetries} after error: ${(error as Error).message}`);
          await this._delay(1000 * (attempt + 1)); // exponential backoff
        }
      }
    }

    throw lastError;
  }

  private async _executeSingleStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    if (step.tool === 'python_call') {
      return await this.pyodideManager.loadAndRunFunction(context.pluginId, 'execute', step.inputs || {});
    }
    throw new Error(`Unknown tool: ${step.tool}`);
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private _isRecoverableError(error: any): boolean {
    // Implement error type analysis
    return false; // placeholder
  }
}
// ==============================================================================
// MAIN OFFSCREEN DOCUMENT CONTROLLER
// ==============================================================================

// Global instances
const logger = new OffscreenLogger();
const memoryManager = new MemoryManager();
const aiClient = new AiClient();
const batchProcessor = new BatchProcessor(aiClient);
const pyodideManager = new PyodideManager(logger);
const chunkManager = new ChunkManager();
const workflowEngine = new WorkflowEngine(logger, pyodideManager, aiClient, memoryManager, batchProcessor);

// Message handling interfaces
interface ExecuteWorkflowMessage {
  type: 'EXECUTE_WORKFLOW';
  data: {
    pluginId: string;
    requestId: string;
    transferId: string;
    useChunks: boolean;
    pageHtml: string;
  };
}

interface HostCallResponseMessage {
  type: 'HOST_CALL_RESPONSE';
  callId: string;
  result?: any;
  error?: string;
}

interface HtmlChunkMessage {
  type: 'HTML_CHUNK';
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkData: string;
}

type OffscreenMessage =
  | ExecuteWorkflowMessage
  | HostCallResponseMessage
  | HtmlChunkMessage;

// ==============================================================================
// MESSAGE HANDLER
// ==============================================================================

chrome.runtime.onMessage.addListener(
  async (message: OffscreenMessage, sender, sendResponse) => {
    try {
      switch (message.type) {
        case 'EXECUTE_WORKFLOW':
          await handleExecuteWorkflow(message.data);
          break;

        case 'HOST_CALL_RESPONSE':
          handleHostCallResponse(message);
          break;

        case 'HTML_CHUNK':
          handleHtmlChunk(message);
          break;

        default:
          logger.addMessage('WARN', `Unknown message type: ${(message as any).type}`);
      }
    } catch (error: any) {
      logger.addMessage('ERROR', `Error handling message ${message.type}: ${error.message}`);
      sendResponse({ success: false, error: error.message });
    }

    return true; // Keep channel open for async responses
  }
);

// ==============================================================================
// MESSAGE HANDLERS
// ==============================================================================

async function handleExecuteWorkflow(data: ExecuteWorkflowMessage['data']): Promise<void> {
  try {
    logger.addMessage('INFO', `Starting workflow execution for plugin: ${data.pluginId}`);

    // Assemble HTML data if chunked
    let pageHtml = data.pageHtml;
    if (data.useChunks) {
      logger.addMessage('DEBUG', `Waiting for chunked HTML data: ${data.transferId}`);
      // Wait for chunks - chunks arrive via separate messages
      // Timeout after 30 seconds
      const timeoutMs = 30000;
      const startTime = Date.now();

      while (!chunkManager.isComplete(data.transferId)) {
        if (Date.now() - startTime > timeoutMs) {
          // Log transfer stats before timeout
          const stats = chunkManager.getStats(data.transferId);
          logger.addMessage('ERROR', `Chunk assembly timeout. Transfer stats:`, stats);
          throw new Error(`Timeout waiting for HTML chunks (${timeoutMs}ms)`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Log transfer stats before assembly
      const statsBefore = chunkManager.getStats(data.transferId);
      logger.addMessage('DEBUG', `Pre-assembly stats:`, statsBefore);

      // Assemble HTML
      pageHtml = chunkManager.getAssembled(data.transferId);

      // Validate assembled data
      logger.addMessage('DEBUG', `HTML data assembled: ${pageHtml.length} characters`);

      // Check if assembled data makes sense
      if (pageHtml.length < 1000) {
        logger.addMessage('ERROR', `WARNING: Assembled HTML suspiciously short: ${pageHtml.length} chars`);
        logger.addMessage('ERROR', `HTML content: "${pageHtml.substring(0, 200)}"`);
      } else if (pageHtml.length > 10000000) {
        // This should be around 1M chars normally
        logger.addMessage('DEBUG', `HTML length looks reasonable: ${pageHtml.length} chars`);
      }

      // Quick validation that it looks like HTML
      if (!pageHtml.includes('<html') && !pageHtml.includes('<HTML') && !pageHtml.includes('<!DOCTYPE')) {
        logger.addMessage('WARN', `Assembled data doesn't look like HTML. First 500 chars: "${pageHtml.substring(0, 500)}"`);
      }

      logger.addMessage('INFO', `✅ HTML data successfully assembled from chunks: ${pageHtml.length} characters`);
    }

    // Create workflow context
    const context: Partial<WorkflowContext> = {
      input: { pageHtml },
      pluginId: data.pluginId
    };

    // Run workflow
    const result = await workflowEngine.runWorkflow(data.pluginId, context);

    // Send result back to background
    await chrome.runtime.sendMessage({
      type: 'WORKFLOW_COMPLETED',
      requestId: data.requestId,
      success: result.success,
      result: result.result,
      error: !result.success ? result.errors.map(e => e.error).join('; ') : undefined
    });

    logger.addMessage('INFO', `Workflow completed: success=${result.success}`);

  } catch (error: any) {
    logger.addMessage('ERROR', `Workflow execution failed: ${error.message}`);

    await chrome.runtime.sendMessage({
      type: 'WORKFLOW_COMPLETED',
      requestId: data.requestId,
      success: false,
      result: null,
      error: error.message
    });
  }
}

function handleHostCallResponse(message: HostCallResponseMessage): void {
  const promise = pyodideManager.hostCallPromises.get(message.callId);
  if (promise) {
    pyodideManager.hostCallPromises.delete(message.callId);
    if (message.error) {
      promise.reject(new Error(message.error));
    } else {
      promise.resolve(message.result);
    }
  } else {
    logger.addMessage('WARN', `Received host call response for unknown callId: ${message.callId}`);
  }
}

function handleHtmlChunk(message: HtmlChunkMessage): void {
  chunkManager.addChunk(message.transferId, message.chunkData, message.chunkIndex, message.totalChunks);
  logger.addMessage('DEBUG', `Received chunk ${message.chunkIndex + 1}/${message.totalChunks} for ${message.transferId}`);
}

// ==============================================================================
// INITIALIZATION
// ==============================================================================

async function initializeOffscreen(): Promise<void> {
  try {
    logger.addMessage('INFO', 'Offscreen document initialized');

    // Wait for Pyodide to be ready
    await pyodideManager.awaitReady();
    logger.addMessage('INFO', 'Offscreen document fully operational');

  } catch (error: any) {
    logger.addMessage('CRITICAL', `Failed to initialize offscreen document: ${error.message}`);
  }
}

// Start initialization
initializeOffscreen();

logger.addMessage('INFO', 'Offscreen document loaded successfully');

export {};