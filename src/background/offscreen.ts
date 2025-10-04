// Глобальная функция trackSendResponse для использования вне обработчика сообщений
function trackSendResponse(response: any): boolean {
  console.log('[offscreen][RESPONSE] Sending response:', JSON.stringify(response));
  return true;
}

// ==============================================================================
// HEARTBEAT MONITORING - Connection health monitoring for offscreen
// ==============================================================================

interface HeartbeatMessage {
  type: 'HEARTBEAT_CHECK';
  heartbeatId: string;
  timestamp: number;
  backgroundHealth: {
    transfers: number;
    promises: number;
    memoryUsage?: number;
    uptime: number;
  };
}

interface HeartbeatResponseMessage {
  type: 'HEARTBEAT_RESPONSE';
  heartbeatId: string;
  timestamp: number;
  offscreenHealth: {
    transfers: number;
    workflows: number;
    memoryUsage?: number;
    uptime: number;
  };
}

// ==============================================================================
// ENHANCED CHUNK MANAGER - Same as in background.ts for compatibility
// ==============================================================================

class EnhancedChunkManager {
  private transfers = new Map<string, ChunkTransfer>();
  private readonly MAX_CHUNK_SIZE = 32768; // 32KB optimal for Chrome messaging
  private readonly TRANSFER_TIMEOUT = 300000; // 300s timeout (increased from 60s)

  constructor() {
    // Start cleanup interval for both transfers and HTML_DIRECT storage
    setInterval(() => {
      this.cleanup();
      cleanupHtmlDirectStorage(); // Cleanup expired HTML_DIRECT entries
    }, Math.min(this.TRANSFER_TIMEOUT, 60000)); // Run every minute or transfer timeout, whichever is smaller
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public addChunk(transferId: string, chunkData: string, chunkIndex: number, totalChunks: number): void {
    console.log(`[Offscreen::ChunkManager] Processing chunk ${chunkIndex}/${totalChunks-1} for transfer ${transferId}`);

    // Initialize transfer if needed
    if (!this.transfers.has(transferId)) {
      const transfer: ChunkTransfer = {
        chunks: new Array(totalChunks),
        acked: new Array(totalChunks).fill(false),
        totalSize: 0, // Will be calculated as chunks arrive
        startTime: Date.now()
      };
      this.transfers.set(transferId, transfer);
      console.log(`[Offscreen::ChunkManager] ✅ INITIALIZED transfer ${transferId} for ${totalChunks} chunks in OFFSCREEN instance`);
      console.log(`[Offscreen::ChunkManager] Total transfers in OFFSCREEN: [${Array.from(this.transfers.keys()).join(', ')}]`);
    }

    const transfer = this.transfers.get(transferId)!;

    // Validate chunkIndex bounds
    if (chunkIndex < 0 || chunkIndex >= totalChunks) {
      // console.error(`[EnhancedChunkManager] Invalid chunk index ${chunkIndex} for total ${totalChunks}`);
      return;
    }

    // Check for totalChunks mismatch
    if (transfer.chunks.length !== totalChunks) {
      // console.error(`[EnhancedChunkManager] Total chunks mismatch! Existing: ${transfer.chunks.length}, Received: ${totalChunks}`);
      return;
    }

    // Store chunk if not already present or if this is the first time
    if (transfer.chunks[chunkIndex] === undefined) {
      transfer.chunks[chunkIndex] = chunkData;
      transfer.acked[chunkIndex] = true; // Mark as acknowledged since we're receiving it
      transfer.totalSize += chunkData.length;

      console.log(`[Offscreen::ChunkManager] 💾 Successfully stored chunk ${chunkIndex}/${totalChunks - 1} for ${transferId}`);
      console.log(`[Offscreen::ChunkManager] - Chunk size: ${chunkData.length} chars`);
      console.log(`[Offscreen::ChunkManager] - Total size now: ${transfer.totalSize} chars`);
    } else {
      console.log(`[Offscreen::ChunkManager] ⚠️ Chunk ${chunkIndex} already exists for ${transferId}, skipping`);
    }

    // Check completion status
    const completedChunks = transfer.acked.filter(ack => ack === true).length;
    console.log(`[Offscreen::ChunkManager] 📊 Progress for ${transferId}: ${completedChunks}/${totalChunks} chunks`);

    if (completedChunks === totalChunks) {
      console.log(`[Offscreen::ChunkManager] ✅ ALL CHUNKS RECEIVED for transfer ${transferId}`);
      console.log(`[Offscreen::ChunkManager] - Total transfer size: ${transfer.totalSize} characters`);
      console.log(`[Offscreen::ChunkManager] - Transfer duration: ${Date.now() - transfer.startTime}ms`);
    }
  }

  public isComplete(transferId: string): boolean {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return false;

    const completedChunks = transfer.acked.filter(ack => ack === true).length;
    const isComplete = completedChunks === transfer.chunks.length;

    // console.log(`[EnhancedChunkManager] Checking completion for ${transferId}: ${completedChunks}/${transfer.chunks.length} (${isComplete ? 'COMPLETE' : 'INCOMPLETE'})`);

    return isComplete;
  }

  public getStats(transferId: string): { completed: number; total: number; duration: number } | null {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return null;

    return {
      completed: transfer.acked.filter(ack => ack === true).length,
      total: transfer.chunks.length,
      duration: Date.now() - transfer.startTime
    };
  }

  public getAssembledData(transferId: string): string {
    // console.log(`[EnhancedChunkManager] Starting assembly for ${transferId}`);

    const transfer = this.transfers.get(transferId);

    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    const completed_count = transfer.acked.filter(ack => ack === true).length;
    const total = transfer.chunks.length;

    if (completed_count !== total) {
      throw new Error(`Transfer ${transferId} not complete: ${completed_count}/${total} chunks acknowledged`);
    }

    // Assemble chunks in order
    let assembled = '';
    for (let i = 0; i < transfer.chunks.length; i++) {
      const chunk = transfer.chunks[i];
      if (chunk !== undefined && chunk !== null && typeof chunk === 'string') {
        assembled += chunk;
      } else {
        throw new Error(`Invalid chunk at index ${i} in transfer ${transferId}`);
      }
    }

    // console.log(`[EnhancedChunkManager] Successfully assembled ${assembled.length} characters from ${transfer.chunks.length} chunks`);

    return assembled;
  }

  // Cleanup expired transfers
  private cleanup(): void {
    const now = Date.now();
    const expiredTransfers: string[] = [];

    this.transfers.forEach((transfer, transferId) => {
      if (now - transfer.startTime > this.TRANSFER_TIMEOUT) {
        expiredTransfers.push(transferId);
      }
    });

    expiredTransfers.forEach(id => {
      // console.warn(`[EnhancedChunkManager] Cleaning up expired transfer: ${id}`);
      this.transfers.delete(id);
    });
  }
}

interface ChunkTransfer {
  chunks: string[];
  acked: boolean[];
  totalSize: number;
  startTime: number;
}

interface WorkflowState {
  requestId: string;
  startTime: number;
  status: 'running' | 'completed' | 'failed' | 'timed_out';
  pluginId: string;
}

// ==============================================================================
// WORKFLOW ENGINE SIMPLIFIED FOR PYTHON EXECUTION
// ==============================================================================

class SimpleWorkflowEngine {
  private logger: Console;
  private currentWorkflow: WorkflowState | null = null;
  private readonly WORKFLOW_LOCK_TTL = 60000; // 60 seconds lock TTL
  private pyodide: any = null;
  private pyodideLoading = false;

  constructor(logger: Console = console) {
    this.logger = logger;

    // Monitor for timed out workflows
    setInterval(() => {
      this.checkWorkflowTimeouts();
    }, 10000); // Check every 10 seconds
  }

  private checkWorkflowTimeouts() {
    if (!this.currentWorkflow) return;

    const elapsed = Date.now() - this.currentWorkflow.startTime;
    if (this.currentWorkflow.status === 'running' && elapsed > this.WORKFLOW_LOCK_TTL) {
      this.logger.warn(`[WorkflowEngine] Workflow ${this.currentWorkflow.requestId} timed out after ${elapsed}ms`);
      this.currentWorkflow.status = 'timed_out';
      // Clear timed out state immediately
      setTimeout(() => {
        if (this.currentWorkflow?.status === 'timed_out') {
          this.currentWorkflow = null;
        }
      }, 1000);
    }
  }

  private canExecuteWorkflow(requestId: string, pluginId: string): { allowed: boolean; reason?: string } {
    const now = Date.now();

    if (!this.currentWorkflow) {
      return { allowed: true };
    }

    const elapsed = now - this.currentWorkflow.startTime;

    // If current workflow is completed or failed, allow new execution
    if (this.currentWorkflow.status === 'completed' || this.currentWorkflow.status === 'failed') {
      this.logger.log(`[WorkflowEngine] Previous workflow ${this.currentWorkflow.status}, allowing new execution`);
      return { allowed: true };
    }

    // If timed out, clear the state and allow
    if (this.currentWorkflow.status === 'timed_out' || elapsed > this.WORKFLOW_LOCK_TTL) {
      this.logger.log(`[WorkflowEngine] Previous workflow timed out or exceeded TTL (${elapsed}ms), clearing state`);
      this.currentWorkflow = null;
      return { allowed: true };
    }

    // If still running and within TTL, block
    if (this.currentWorkflow.status === 'running' && elapsed <= this.WORKFLOW_LOCK_TTL) {
      return {
        allowed: false,
        reason: `Workflow ${this.currentWorkflow.requestId} still running (${elapsed}ms elapsed, TTL: ${this.WORKFLOW_LOCK_TTL}ms)`
      };
    }

    // Fallback: allow
    return { allowed: true };
  }

  async executeWorkflow(pluginId: string, pageHtml: string, requestId?: string, pluginSettings?: Record<string, any>) {
    const effectiveRequestId = requestId || `workflow-${Date.now()}`;

    // Check if we can execute
    const checkResult = this.canExecuteWorkflow(effectiveRequestId, pluginId);
    if (!checkResult.allowed) {
      throw new Error(`Workflow execution blocked: ${checkResult.reason}`);
    }

    // Set running state
    this.currentWorkflow = {
      requestId: effectiveRequestId,
      startTime: Date.now(),
      status: 'running',
      pluginId
    };

    try {
      this.logger.log(`[WorkflowEngine] Starting workflow for plugin: ${pluginId}, request: ${effectiveRequestId}`);

      // Execute actual Python analysis
      const pythonResult = await this.executePythonAnalysis(pageHtml, pluginSettings);

      // Set completed state
      this.currentWorkflow.status = 'completed';

      // Return result based on Python execution
      const success = pythonResult.status === 'success';
      return {
        success,
        result: {
          status: success ? 'completed' : 'failed',
          message: success ? 'Python analysis completed successfully' : pythonResult.error || 'Python analysis failed',
          pluginId: pluginId,
          htmlSize: pageHtml?.length || 0,
          requestId: effectiveRequestId,
          pythonResult
        },
        totalDuration: Date.now() - this.currentWorkflow.startTime,
        stepResults: { python_execution: pythonResult },
        errors: success ? [] : [{ stepId: 'python_analysis', error: pythonResult.error || 'Unknown error', timestamp: Date.now(), recoverable: false }]
      };
    } catch (error: any) {
      this.logger.error(`[WorkflowEngine] Workflow failed:`, error);

      // Set failed state and clear after delay
      if (this.currentWorkflow) {
        this.currentWorkflow.status = 'failed';
        // Clear failed state after short delay to allow new attempts
        setTimeout(() => {
          if (this.currentWorkflow?.status === 'failed') {
            this.currentWorkflow = null;
          }
        }, 5000);
      }

      return {
        success: false,
        result: {
          status: 'failed',
          message: error.message,
          pluginId: pluginId,
          requestId: effectiveRequestId
        },
        totalDuration: this.currentWorkflow ? Date.now() - this.currentWorkflow.startTime : 0,
        stepResults: {},
        errors: [{
          stepId: 'global',
          error: error.message,
          timestamp: Date.now(),
          recoverable: false
        }]
      };
    }
  }

  private async initializePyodide(): Promise<void> {
    if (this.pyodide) return;
    if (this.pyodideLoading) {
      // Wait for loading to complete
      while (this.pyodideLoading) {
        await this.delay(100);
      }
      return;
    }

    this.pyodideLoading = true;
    try {
      this.logger.log('[WorkflowEngine] Initializing Pyodide...');

      // Load Pyodide
      const pyodideScript = document.createElement('script');
      pyodideScript.src = chrome.runtime.getURL('pyodide/pyodide.js');
      document.head.appendChild(pyodideScript);

      await new Promise((resolve, reject) => {
        pyodideScript.onload = resolve;
        pyodideScript.onerror = reject;
      });

      // @ts-ignore
      this.pyodide = await loadPyodide({
        indexURL: chrome.runtime.getURL('pyodide/')
      });

      // Load packages
      await this.pyodide.loadPackage(['micropip', 'beautifulsoup4', 'requests']);

      // Set up js bridge for Python with enhanced diagnostic logging
      this.pyodide.runPython(`
import js
import sys
from typing import Any, Dict
import json

def sendMessageToChat(message):
    print(f"[BRIDGE DIAGNOSTIC] sendMessageToChat called with: {message}")
    print(f"[BRIDGE DIAGNOSTIC] Message type: {type(message)}")
    try:
        result = js.sendMessageToChat(message)
        print(f"[BRIDGE DIAGNOSTIC] sendMessageToChat result: {result}")
        return result
    except Exception as e:
        print(f"[BRIDGE DIAGNOSTIC] Error in sendMessageToChat: {e}")
        return None

def llm_call(model_alias, params):
    print(f"[BRIDGE DIAGNOSTIC] ===== llm_call BRIDGE CALL =====")
    print(f"[BRIDGE DIAGNOSTIC] Model: {model_alias}")
    print(f"[BRIDGE DIAGNOSTIC] Params: {params}")
    print(f"[BRIDGE DIAGNOSTIC] Params type: {type(params)}")
    try:
        result = js.llm_call(model_alias, params)
        print(f"[BRIDGE DIAGNOSTIC] llm_call raw result: {result}")
        print(f"[BRIDGE DIAGNOSTIC] llm_call result type: {type(result)}")
        return result
    except Exception as e:
        print(f"[BRIDGE DIAGNOSTIC] Error in llm_call: {e}")
        return None

def get_setting(setting_name):
    print(f"[BRIDGE DIAGNOSTIC] get_setting called: {setting_name}")
    try:
        result = js.get_setting(setting_name)
        print(f"[BRIDGE DIAGNOSTIC] get_setting result: {result}")
        return result
    except Exception as e:
        print(f"[BRIDGE DIAGNOSTIC] Error in get_setting: {e}")
        return False

def host_fetch(url):
    print(f"[BRIDGE DIAGNOSTIC] host_fetch called: {url}")
    try:
        result = js.hostFetch(url)
        print(f"[BRIDGE DIAGNOSTIC] host_fetch result type: {type(result)}")
        return result
    except Exception as e:
        print(f"[BRIDGE DIAGNOSTIC] Error in host_fetch: {e}")
        return None

# Register bridge functions
js.sendMessageToChat = sendMessageToChat
js.llm_call = llm_call
js.get_setting = get_setting
js.host_fetch = host_fetch

print("[BRIDGE DIAGNOSTIC] ===== PYODIDE JS BRIDGE INITIALIZED =====")
print(f"[BRIDGE DIAGNOSTIC] Available JS functions: sendMessageToChat, llm_call, get_setting, host_fetch")
`);

      // Load the plugin code
      console.log('[BRIDGE DIAGNOSTIC] ===== LOADING PYTHON PLUGIN CODE =====');
      const response = await fetch(chrome.runtime.getURL('plugins/ozon-analyzer/mcp_server.py'));
      const pythonCode = await response.text();
      console.log(`[BRIDGE DIAGNOSTIC] Python code loaded: ${pythonCode.length} characters`);

      console.log('[BRIDGE DIAGNOSTIC] ===== EXECUTING PYTHON CODE =====');
      this.pyodide.runPython(pythonCode);
      console.log('[BRIDGE DIAGNOSTIC] Python code executed successfully');

      // Verify bridge functions are available
      console.log('[BRIDGE DIAGNOSTIC] ===== VERIFYING BRIDGE FUNCTIONS =====');
      try {
        const bridgeTest = this.pyodide.runPython(`
try:
    import js
    print(f"[BRIDGE DIAGNOSTIC] JS object available: {js is not None}")
    print(f"[BRIDGE DIAGNOSTIC] llm_call available: {hasattr(js, 'llm_call')}")
    print(f"[BRIDGE DIAGNOSTIC] sendMessageToChat available: {hasattr(js, 'sendMessageToChat')}")
    print(f"[BRIDGE DIAGNOSTIC] get_setting available: {hasattr(js, 'get_setting')}")
    print("[BRIDGE DIAGNOSTIC] Bridge verification completed")
    "BRIDGE_OK"
except Exception as e:
    print(f"[BRIDGE DIAGNOSTIC] Bridge verification failed: {e}")
    "BRIDGE_FAILED"
`);
        console.log(`[BRIDGE DIAGNOSTIC] Bridge verification result: ${bridgeTest}`);
      } catch (error) {
        console.error('[BRIDGE DIAGNOSTIC] Error during bridge verification:', error);
      }

      this.logger.log('[WorkflowEngine] Pyodide initialized successfully');
    } catch (error) {
      this.logger.error('[WorkflowEngine] Failed to initialize Pyodide:', error);
      throw error;
    } finally {
      this.pyodideLoading = false;
    }
  }

  private async executePythonAnalysis(htmlContent: string, pluginSettings?: Record<string, any>): Promise<any> {
    await this.initializePyodide();

    try {
      this.logger.log('[WorkflowEngine] Executing Python analysis...');

      // [BRIDGE DIAGNOSTIC] ===== ПЕРЕД ПЕРЕДАЧЕЙ ДАННЫХ В PYTHON =====
      console.log('[BRIDGE DIAGNOSTIC] ===== ПЕРЕД ПЕРЕДАЧЕЙ ДАННЫХ В PYTHON =====');
      console.log(`[BRIDGE DIAGNOSTIC] HTML content type: ${typeof htmlContent}`);
      console.log(`[BRIDGE DIAGNOSTIC] HTML content length: ${htmlContent?.length || 0}`);
      console.log(`[BRIDGE DIAGNOSTIC] HTML content preview: ${htmlContent?.substring(0, 200)}...`);
      console.log(`[BRIDGE DIAGNOSTIC] Plugin settings:`, pluginSettings);
      console.log(`[BRIDGE DIAGNOSTIC] Pyodide ready: ${!!this.pyodide}`);
      console.log(`[BRIDGE DIAGNOSTIC] Pyodide globals available: ${!!this.pyodide?.globals}`);
      console.log('[BRIDGE DIAGNOSTIC] ===== НАЧАЛО ПЕРЕДАЧИ В PYTHON =====');

      // Set the HTML content in Python
      this.pyodide.globals.set('page_html', htmlContent);

      console.log('[BRIDGE DIAGNOSTIC] HTML content successfully set in Python globals');

      // Prepare tool input with plugin settings
      const toolInput = { pluginSettings: pluginSettings || {} };
      this.pyodide.globals.set('tool_input', toolInput);
      console.log('[BRIDGE DIAGNOSTIC] Tool input prepared and set in Python globals:', toolInput);

      // Execute the analysis function with plugin settings
      const result = this.pyodide.runPython(`
import logging
logging.basicConfig(level=logging.INFO)

# Mock js object for the Python code with enhanced logging
class MockJs:
    def sendMessageToChat(self, message):
        print(f"[BRIDGE DIAGNOSTIC] MockJs.sendMessageToChat called with: {message}")
        print(f"[BRIDGE DIAGNOSTIC] Message type: {type(message)}")
        if isinstance(message, dict):
            print(f"[BRIDGE DIAGNOSTIC] Message keys: {list(message.keys())}")
        return None

    def llm_call(self, model_alias, params):
        print(f"[BRIDGE DIAGNOSTIC] MockJs.llm_call called with model: {model_alias}")
        print(f"[BRIDGE DIAGNOSTIC] Params: {params}")
        print(f"[BRIDGE DIAGNOSTIC] Params type: {type(params)}")
        # This would normally call the real JS llm_call function
        # For diagnostic purposes, we'll simulate a response
        return {"response": "Mock diagnostic response", "status": "success"}

    def get_setting(self, setting_name):
        print(f"[BRIDGE DIAGNOSTIC] MockJs.get_setting called with: {setting_name}")
        return False

js = MockJs()

# Execute the analysis
try:
    print("[BRIDGE DIAGNOSTIC] ===== ЗАПУСК PYTHON АНАЛИЗА =====")
    # Import tool input from globals
    tool_input = globals().get('tool_input', {})
    plugin_settings = tool_input.get('pluginSettings', {})
    print(f"[BRIDGE DIAGNOSTIC] Plugin settings from tool_input: {plugin_settings}")

    result = analyze_ozon_product(tool_input)
    print(f"[BRIDGE DIAGNOSTIC] ===== PYTHON АНАЛИЗ ЗАВЕРШЕН =====")
    print(f"[BRIDGE DIAGNOSTIC] Результат анализа: {result}")
    print(f"[BRIDGE DIAGNOSTIC] Тип результата: {type(result)}")
    if isinstance(result, dict):
        print(f"[BRIDGE DIAGNOSTIC] Ключи результата: {list(result.keys())}")
    result
except Exception as e:
    print(f"[BRIDGE DIAGNOSTIC] ===== ОШИБКА В PYTHON АНАЛИЗЕ: {e} =====")
    {"status": "error", "error": str(e)}
`);

      console.log('[BRIDGE DIAGNOSTIC] ===== РЕЗУЛЬТАТ ИЗ PYTHON ПОЛУЧЕН =====');
      console.log(`[BRIDGE DIAGNOSTIC] Result type: ${typeof result}`);
      console.log(`[BRIDGE DIAGNOSTIC] Result keys: ${result && typeof result === 'object' ? Object.keys(result) : 'N/A'}`);
      console.log(`[BRIDGE DIAGNOSTIC] Result preview:`, result);

      this.logger.log('[WorkflowEngine] Python analysis completed:', result);
      return result;
    } catch (error) {
      this.logger.error('[WorkflowEngine] Python execution failed:', error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==============================================================================
// MESSAGE QUEUE SYSTEM - Prevents race conditions and manages critical operations
// ==============================================================================

class MessageQueue {
  private queue: Array<{ message: any; priority: number; resolve: Function; reject: Function }> = [];
  private processing = false;
  private readonly DELAY_BETWEEN_MESSAGES = 50; // 50ms delay between messages

  enqueue(message: any, priority = 0): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ message, priority, resolve, reject });
      this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const { message, resolve, reject } = this.queue.shift()!;

      try {
        const result = await safeSendMessageOffscreen(message);
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // Delay between messages to prevent race conditions
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_MESSAGES));
      }
    }

    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

// Global message queue instance
const messageQueue = new MessageQueue();

// ==============================================================================
// CONNECTION MONITORING - Continuous connection health monitoring and auto-recovery
// ==============================================================================

class ConnectionMonitor {
  private connectionStatus: 'healthy' | 'degraded' | 'disconnected' = 'healthy';
  private lastHeartbeat = 0;
  private recoveryAttempts = 0;
  private readonly MAX_RECOVERY_ATTEMPTS = 5;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly RECOVERY_DELAY = 5000; // 5 seconds between recovery attempts
  private monitorInterval: NodeJS.Timeout | null = null;

  startMonitoring(): void {
    console.log('[ConnectionMonitor] Starting connection monitoring...');

    this.monitorInterval = setInterval(async () => {
      await this.checkConnection();
    }, this.HEARTBEAT_INTERVAL);

    // Initial check
    this.checkConnection();
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log('[ConnectionMonitor] Stopped connection monitoring');
  }

  private async checkConnection(): Promise<void> {
    try {
      const startTime = Date.now();

      // Test connection with a simple ping
      const response = await safeSendMessageOffscreen({
        type: 'CONNECTION_PING',
        timestamp: startTime
      }, 5000, true); // Wait for response with 5s timeout

      const latency = Date.now() - startTime;
      this.lastHeartbeat = Date.now();

      if ((response as any)?.pong) {
        this.updateConnectionStatus('healthy', latency);
      } else {
        throw new Error('Invalid ping response');
      }

    } catch (error) {
      console.warn('[ConnectionMonitor] Connection check failed:', error);
      this.handleConnectionFailure();
    }
  }

  private updateConnectionStatus(status: 'healthy' | 'degraded' | 'disconnected', latency?: number): void {
    const oldStatus = this.connectionStatus;
    this.connectionStatus = status;

    if (oldStatus !== status) {
      console.log(`[ConnectionMonitor] Connection status changed: ${oldStatus} → ${status}`, {
        latency,
        recoveryAttempts: this.recoveryAttempts
      });

      // Reset recovery attempts on successful connection
      if (status === 'healthy') {
        this.recoveryAttempts = 0;
      }
    }
  }

  private async handleConnectionFailure(): Promise<void> {
    if (this.connectionStatus === 'disconnected') {
      // Already handling disconnection
      return;
    }

    this.updateConnectionStatus('disconnected');

    // Attempt auto-recovery
    if (this.recoveryAttempts < this.MAX_RECOVERY_ATTEMPTS) {
      this.recoveryAttempts++;
      console.log(`[ConnectionMonitor] Attempting auto-recovery (${this.recoveryAttempts}/${this.MAX_RECOVERY_ATTEMPTS})`);

      setTimeout(async () => {
        try {
          // Test recovery
          const recoveryResponse = await safeSendMessageOffscreen({
            type: 'CONNECTION_RECOVERY_PING',
            attempt: this.recoveryAttempts,
            timestamp: Date.now()
          }, 3000, true);

          if ((recoveryResponse as any)?.pong) {
            console.log(`[ConnectionMonitor] ✅ Auto-recovery successful on attempt ${this.recoveryAttempts}`);
            this.updateConnectionStatus('healthy');
            return;
          }
        } catch (recoveryError) {
          console.warn(`[ConnectionMonitor] Recovery attempt ${this.recoveryAttempts} failed:`, recoveryError);
        }

        // If all recovery attempts failed, stay in disconnected state
        if (this.recoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
          console.error(`[ConnectionMonitor] ❌ All auto-recovery attempts failed. Manual intervention required.`);
          this.updateConnectionStatus('disconnected');
        } else {
          // Try again
          this.handleConnectionFailure();
        }
      }, this.RECOVERY_DELAY);
    }
  }

  getStatus(): { status: string; lastHeartbeat: number; recoveryAttempts: number } {
    return {
      status: this.connectionStatus,
      lastHeartbeat: this.lastHeartbeat,
      recoveryAttempts: this.recoveryAttempts
    };
  }
}

// Global connection monitor instance
const connectionMonitor = new ConnectionMonitor();

// ==============================================================================
// SAFE MESSAGE SENDING
// ==============================================================================

/**
  * Safely sends a message from offscreen context with timeout, retry and error handling
  * @param message The message to send
  * @param timeout Timeout in milliseconds (default: 5000)
  * @param waitForResponse Whether to wait for response (default: true). Set to false for fire-and-forget messages
  * @param maxRetries Maximum retry attempts (default: 1 for messages requiring response, 0 for fire-and-forget)
  * @returns Promise that resolves when message is sent (or response received if waitForResponse=true)
  */
async function safeSendMessageOffscreen(message: any, timeout = 5000, waitForResponse = true, maxRetries = 1): Promise<void> {
  // Check if chrome runtime is available
  if (!chrome?.runtime?.sendMessage) {
    throw new Error('Chrome runtime sendMessage not available');
  }

  // Check if extension context is valid
  if (!chrome.runtime.id) {
    throw new Error('Extension context invalidated - background may not be available');
  }

  // Check for last error before sending
  if (chrome.runtime.lastError) {
    console.warn('[offscreen][SAFE_SEND] Previous runtime error detected:', chrome.runtime.lastError.message);
  }

  // Adjust maxRetries for fire-and-forget messages (no retries)
  const effectiveMaxRetries = waitForResponse ? maxRetries : 0;

  // Send message with retry logic
  for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Generate new messageId for retry attempts
        const retryMessage = { ...message };
        if (!retryMessage.messageId) {
          retryMessage.messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        } else {
          retryMessage.messageId = `${retryMessage.messageId}-retry-${attempt}`;
        }

        // Delay before retry (1-2 seconds)
        const delay = 1000 + Math.random() * 1000; // 1-2 seconds
        console.log(`[offscreen][SAFE_SEND] ⏳ Retrying message ${message.type} in ${delay}ms (attempt ${attempt}/${effectiveMaxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Use the retry message
        message = retryMessage;
      }

      if (!waitForResponse) {
        // Fire-and-forget mode
        chrome.runtime.sendMessage(message);
        console.log(`[offscreen][SAFE_SEND] 🔥 Fire-and-forget message sent: ${message.type} (attempt ${attempt + 1}, messageId: ${message.messageId || 'none'})`);
        return Promise.resolve();
      }

      // Wait for response with timeout
      await Promise.race([
        chrome.runtime.sendMessage(message),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Message send timeout after ${timeout}ms`)), timeout);
        })
      ]);

      console.log(`[offscreen][SAFE_SEND] ✅ Message sent successfully: ${message.type} (attempt ${attempt + 1})`);
      return;

    } catch (error) {
      console.warn(`[offscreen][SAFE_SEND] ⚠️ Attempt ${attempt + 1} failed for ${message.type}:`, error);

      // If this was the last attempt, throw the error
      if (attempt === effectiveMaxRetries) {
        console.error(`[offscreen][SAFE_SEND] ❌ All retry attempts failed for ${message.type}`);
        throw error;
      }
    }
  }
}

// ==============================================================================
// MESSAGE HANDLERS
// ==============================================================================

let chunkManager = new EnhancedChunkManager();
const workflowEngine = new SimpleWorkflowEngine();

// Global uptime tracking for offscreen
let offscreenStartTime = Date.now();

// Global storage for HTML data from HTML_DIRECT messages
const htmlDirectStorage = new Map<string, {
  html: string;
  timestamp: number;
  pluginId: string;
  requestId: string;
}>();

interface ExecuteWorkflowMessage {
  type: 'EXECUTE_WORKFLOW';
  data: {
    pluginId: string;
    requestId: string;
    transferId: string;
    useChunks: boolean;
    pageHtml: string;
    assembledHtml?: string; // New field for pre-assembled HTML from chunks
  };
}

interface HtmlChunkMessage {
  type: 'HTML_CHUNK';
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkData: string;
}

// Handle EXECUTE_WORKFLOW message
async function handleExecuteWorkflow(data: ExecuteWorkflowMessage['data']) {
  console.log(`[offscreen][DIAG] ===== STARTING WORKFLOW EXECUTION =====`);
  console.log(`[offscreen][DIAG] Plugin: ${data.pluginId}`);
  console.log(`[offscreen][DIAG] Request ID: ${data.requestId}`);
  console.log(`[offscreen][DIAG] Transfer ID: ${data.transferId}`);
  console.log(`[offscreen][DIAG] Use Chunks: ${data.useChunks}`);
  console.log(`[offscreen][DIAG] Page HTML Length: ${data.pageHtml?.length || 0} characters`);
  console.log(`[offscreen][DIAG] Current time: ${new Date().toISOString()}`);

  try {
    // VALIDATE MESSAGE FORMAT
    if (!data.pluginId || typeof data.pluginId !== 'string') {
      throw new Error(`Invalid pluginId: expected string, got ${typeof data.pluginId}`);
    }
    if (!data.requestId || typeof data.requestId !== 'string') {
      throw new Error(`Invalid requestId: expected string, got ${typeof data.requestId}`);
    }
    if (!data.transferId || typeof data.transferId !== 'string') {
      throw new Error(`Invalid transferId: expected string, got ${typeof data.transferId}`);
    }
    if (typeof data.useChunks !== 'boolean') {
      throw new Error(`Invalid useChunks: expected boolean, got ${typeof data.useChunks}`);
    }

    console.log(`[offscreen][DIAG] ✅ Message format validation passed`);

    let pageHtml = data.pageHtml;

    // Use pre-assembled HTML if provided
    if (data.assembledHtml) {
      console.log(`[offscreen][DIAG] 🔄 Using pre-assembled HTML (${data.assembledHtml.length} chars) from EXECUTE_WORKFLOW`);
      pageHtml = data.assembledHtml;
    }

    // DIAGNOSTIC: Always check ChunkManager state regardless of useChunks flag
    console.log(`[offscreen][DIAG] CHECKING CHUNK MANAGER STATE:`);
    console.log(`[offscreen][DIAG] Transfer exists: ${chunkManager['transfers'].has(data.transferId)}`);
    const availableTransfers = Array.from(chunkManager['transfers'].keys());
    console.log(`[offscreen][DIAG] Available transfers: [${availableTransfers.join(', ')}]`);

    if (chunkManager['transfers'].has(data.transferId)) {
      const stats = chunkManager.getStats(data.transferId);
      console.log(`[offscreen][DIAG] Transfer stats:`, stats);
      console.log(`[offscreen][DIAG] Is complete: ${chunkManager.isComplete(data.transferId)}`);
      const transfer = chunkManager['transfers'].get(data.transferId);
      if (transfer) {
        const elapsedTime = Date.now() - transfer.startTime;
        console.log(`[offscreen][DIAG] Elapsed time since transfer start: ${elapsedTime}ms`);
        console.log(`[offscreen][DIAG] Transfer timeout: ${chunkManager['TRANSFER_TIMEOUT']}ms`);
        console.log(`[offscreen][DIAG] Transfer expired: ${elapsedTime > chunkManager['TRANSFER_TIMEOUT']}`);
      }
    }

    // If using chunks, assemble the HTML
    if (data.useChunks) {
      console.log(`[offscreen][DIAG] 🔄 Assembling HTML from chunks for transferId: ${data.transferId}`);

      if (!chunkManager['transfers'].has(data.transferId)) {
        console.log(`[offscreen][DIAG] ❌ TRANSFER ${data.transferId} NOT FOUND IN CHUNK MANAGER!`);
        console.log(`[offscreen][DIAG] Available transfers: [${availableTransfers.join(', ')}]`);
        throw new Error(`Transfer ${data.transferId} not found in ChunkManager. Available: ${availableTransfers.join(', ')}`);
      }

      const stats = chunkManager.getStats(data.transferId);
      // console.log(`[offscreen] 📊 Transfer stats:`, stats);

      if (!chunkManager.isComplete(data.transferId)) {
        // console.log(`[offscreen] ⏳ Transfer incomplete, checking for missing chunks...`);
        const transfer = chunkManager['transfers'].get(data.transferId);
        const missingChunks = [];
        if (transfer) {
          for (let i = 0; i < transfer.chunks.length; i++) {
            if (transfer.chunks[i] === undefined) {
              missingChunks.push(i);
            }
          }
        }
        // console.log(`[offscreen] ❌ Missing chunks: ${missingChunks.join(', ')}`);
        throw new Error(`Transfer incomplete. Missing chunks: ${missingChunks.join(', ')}`);
      }

      // console.log(`[offscreen] 🛠️ Starting HTML assembly...`);
      const assemblyStartTime = Date.now();
      pageHtml = chunkManager.getAssembledData(data.transferId);
      const assemblyTime = Date.now() - assemblyStartTime;

      // console.log(`[offscreen] ✅ HTML assembled successfully!`);
      // console.log(`[offscreen] - Length: ${pageHtml.length} characters`);
      // console.log(`[offscreen] - Assembly time: ${assemblyTime}ms`);
      // console.log(`[offscreen] - Sample (first 200 chars): "${pageHtml.substring(0, 200)}"`);

    } else {
       // ENHANCED HTML SOURCE PRIORITY SYSTEM
       console.log(`[offscreen][DIAG] 🔍 No chunks mode - checking HTML sources in priority order`);

       // Priority 1: Check HTML_DIRECT storage first
       if (htmlDirectStorage.has(data.transferId)) {
         const htmlDirectData = htmlDirectStorage.get(data.transferId)!;
         console.log(`[offscreen][DIAG] ✅ Found HTML in HTML_DIRECT storage for transfer ${data.transferId}`);
         console.log(`[offscreen][DIAG] - Plugin ID: ${htmlDirectData.pluginId}`);
         console.log(`[offscreen][DIAG] - Request ID: ${htmlDirectData.requestId}`);
         console.log(`[offscreen][DIAG] - Stored at: ${new Date(htmlDirectData.timestamp).toISOString()}`);
         console.log(`[offscreen][DIAG] - HTML length: ${htmlDirectData.html.length} characters`);

         pageHtml = htmlDirectData.html;

         // Clean up storage after use to prevent memory leaks
         cleanupHtmlDirectStorage(data.transferId);

       } else {
         console.log(`[offscreen][DIAG] 📄 Using direct HTML from EXECUTE_WORKFLOW message (no chunks, no HTML_DIRECT storage)`);
         console.log(`[offscreen][DIAG] - Length: ${pageHtml?.length || 0} characters`);
         console.log(`[offscreen][DIAG] - Available HTML_DIRECT transfers: [${Array.from(htmlDirectStorage.keys()).join(', ')}]`);
       }
     }

    // Validate final HTML with enhanced diagnostics
    if (!pageHtml || pageHtml.length === 0) {
       console.error(`[offscreen][DIAG] ❌ ERROR: Final HTML is empty or undefined!`);
       console.error(`[offscreen][DIAG] 🔍 HTML Source Analysis:`, {
         dataUseChunks: data.useChunks,
         dataHasPageHtml: !!data.pageHtml,
         dataPageHtmlLength: data.pageHtml?.length || 0,
         dataHasAssembledHtml: !!data.assembledHtml,
         dataAssembledHtmlLength: data.assembledHtml?.length || 0,
         chunkManagerHasTransfer: chunkManager['transfers'].has(data.transferId),
         htmlDirectStorageHasTransfer: htmlDirectStorage.has(data.transferId),
         htmlDirectStorageSize: htmlDirectStorage.size,
         availableHtmlDirectTransfers: Array.from(htmlDirectStorage.keys())
       });
       throw new Error('Assembled HTML is empty');
     }

     // Log final HTML source for diagnostics
     console.log(`[offscreen][DIAG] 📄 Final HTML source determined:`, {
       source: data.useChunks ? 'chunks' : (htmlDirectStorage.has(data.transferId) ? 'html_direct' : 'direct_message'),
       length: pageHtml.length,
       transferId: data.transferId,
       pluginId: data.pluginId,
       requestId: data.requestId
     });

    // Execute workflow
    console.log(`[offscreen][DIAG] 🚀 Executing workflow for plugin: ${data.pluginId}, request: ${data.requestId}`);
    const workflowStartTime = Date.now();

    const result = await workflowEngine.executeWorkflow(data.pluginId, pageHtml, data.requestId, data.pluginSettings);

    const workflowTime = Date.now() - workflowStartTime;
    console.log(`[offscreen][DIAG] ✅ Workflow completed in ${workflowTime}ms`);
    console.log(`[offscreen][DIAG] - Success: ${result.success}`);
    console.log(`[offscreen][DIAG] - Result:`, result.result);

    // Send result back to background with error handling (queued for critical results)
    try {
      await messageQueue.enqueue({
        type: 'WORKFLOW_COMPLETED',
        requestId: data.requestId,
        result,
        success: true
      }, 1); // High priority for workflow completion
      console.log(`[offscreen] ✅ Successfully queued WORKFLOW_COMPLETED for ${data.requestId}`);
    } catch (sendError) {
      console.error(`[offscreen] ❌ Failed to queue WORKFLOW_COMPLETED for ${data.requestId}:`, sendError);
      // Don't throw for queued messages, just log
    }

    console.log(`[offscreen][DIAG] === WORKFLOW EXECUTION COMPLETED SUCCESSFULLY ===`);

  } catch (error: any) {
    console.error(`[offscreen][DIAG] 💥 WORKFLOW EXECUTION FAILED:`, error);
    console.error(`[offscreen][DIAG] Error message:`, error.message);
    console.error(`[offscreen][DIAG] Error stack:`, error.stack);
    console.error(`[offscreen][DIAG] Error type:`, error.constructor.name);
    console.error(`[offscreen][DIAG] Transfer state at error:`, {
      transferExists: chunkManager['transfers'].has(data.transferId),
      availableTransfers: Array.from(chunkManager['transfers'].keys()),
      transferId: data.transferId
    });

    // DETERMINE ERROR TYPE AND PROVIDE SPECIFIC ERROR MESSAGES
    let errorMessage = error.message || 'Unknown workflow execution error';
    let errorDetails = '';

    if (errorMessage.includes('Transfer') && errorMessage.includes('not found')) {
      errorMessage = `Transfer data not found: ${data.transferId}. This indicates a race condition or timing issue.`;
      errorDetails = 'Transfer may have been cleaned up or never received properly.';
    } else if (errorMessage.includes('Invalid chunk')) {
      errorMessage = `Data corruption detected in transfer ${data.transferId}`;
      errorDetails = 'HTML chunks may have been corrupted during transmission.';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      errorMessage = `Workflow execution timed out for transfer ${data.transferId}`;
      errorDetails = 'The workflow took too long to complete, possibly due to large HTML size.';
    } else if (errorMessage.includes('Failed to send')) {
      errorMessage = `Communication error: Unable to send workflow results back to background`;
      errorDetails = 'Background script may not be available or message channel is broken.';
    }

    console.error(`[offscreen][DIAG] 🔍 ERROR ANALYSIS:`, {
      originalError: error.message,
      processedError: errorMessage,
      errorDetails: errorDetails,
      transferId: data.transferId,
      pluginId: data.pluginId,
      requestId: data.requestId
    });

    // Send detailed error back to background with enhanced error handling (fire-and-forget)
    try {
      await messageQueue.enqueue({
        type: 'WORKFLOW_COMPLETED',
        requestId: data.requestId,
        error: errorMessage,
        errorDetails: errorDetails,
        success: false
      }, 1); // High priority for error messages
      console.log(`[offscreen][DIAG] ✅ Successfully queued WORKFLOW_COMPLETED error for ${data.requestId}`);
      console.log(`[offscreen][DIAG] Error message queued: ${errorMessage}`);
    } catch (sendError) {
      console.error(`[offscreen][DIAG] ❌ CRITICAL: Failed to queue WORKFLOW_COMPLETED error for ${data.requestId}:`, sendError);
      console.error(`[offscreen][DIAG] Original error:`, errorMessage);

      // FALLBACK: Try to send a simplified error message
      try {
        await safeSendMessageOffscreen({
          type: 'WORKFLOW_COMPLETED',
          requestId: data.requestId,
          error: 'Critical communication failure - workflow execution failed',
          success: false
        }, 0, false); // Fire-and-forget fallback
        console.log(`[offscreen][DIAG] ✅ Fallback error message sent successfully (fire-and-forget)`);
      } catch (fallbackError) {
        console.error(`[offscreen][DIAG] 💥 COMPLETE FAILURE: Cannot send any error message to background`);
        console.error(`[offscreen][DIAG] This indicates a complete breakdown in offscreen-background communication`);
        // At this point, we cannot do anything more - the error is unrecoverable
      }
    }

    console.log(`[offscreen][DIAG] === WORKFLOW EXECUTION FAILED ===`);
  } finally {
    // CHECK OFFSCREEN DOCUMENT STATUS AFTER WORKFLOW EXECUTION
    console.log(`[offscreen][DIAG] 📊 Offscreen document status after workflow execution:`);
    console.log(`[offscreen][DIAG] - Document still active: ${!!document}`);
    console.log(`[offscreen][DIAG] - Runtime available: ${!!chrome?.runtime}`);
    console.log(`[offscreen][DIAG] - Extension context valid: ${!!chrome?.runtime?.id}`);
    console.log(`[offscreen][DIAG] - Transfer manager active: ${!!chunkManager}`);
    console.log(`[offscreen][DIAG] - Workflow engine active: ${!!workflowEngine}`);
    console.log(`[offscreen][DIAG] - Active transfer count: ${chunkManager['transfers'].size}`);
    console.log(`[offscreen][DIAG] - Uptime: ${Date.now() - offscreenStartTime}ms`);

    // RACE CONDITION PROTECTION: Ensure offscreen stays alive
    if (!chrome?.runtime?.id) {
      console.error(`[offscreen][DIAG] 🚨 CRITICAL: Extension context lost during workflow execution!`);
      console.error(`[offscreen][DIAG] This indicates offscreen document was terminated unexpectedly`);
    }
  }
}

// Handle HEARTBEAT_CHECK message
async function handleHeartbeatCheck(message: HeartbeatMessage) {
  console.debug(`[offscreen][HEARTBEAT] 💓 Received heartbeat check ${message.heartbeatId}`);

  try {
    // Collect offscreen health data
    const offscreenHealth = collectOffscreenHealthData();

    // Send heartbeat response
    const response: HeartbeatResponseMessage = {
      type: 'HEARTBEAT_RESPONSE',
      heartbeatId: message.heartbeatId,
      timestamp: Date.now(),
      offscreenHealth
    };

    const latency = Date.now() - message.timestamp;
    console.debug(`[offscreen][HEARTBEAT] 📤 Sending heartbeat response ${message.heartbeatId} (${latency}ms latency)`);

    try {
      await safeSendMessageOffscreen(response);
      console.debug(`[offscreen][HEARTBEAT] ✅ Heartbeat response sent successfully`);
    } catch (sendError) {
      console.error(`[offscreen][HEARTBEAT] ❌ Failed to send heartbeat response:`, sendError);
      throw new Error(`Failed to send heartbeat response: ${(sendError as Error).message}`);
    }

  } catch (error) {
    console.error(`[offscreen][HEARTBEAT] ❌ Failed to send heartbeat response:`, error);
  }
}

function collectOffscreenHealthData() {
   // Collect offscreen script health metrics
   const transferCount = chunkManager['transfers'].size;
   const uptime = Date.now() - offscreenStartTime;
   const htmlDirectCount = htmlDirectStorage.size;

   // Count active workflows (simplified - we could track this better)
   const workflowCount = 0; // SimpleWorkflowEngine doesn't track active workflows

   // Log detailed HTML_DIRECT storage state for diagnostics
   console.log(`[offscreen][HEALTH] 📊 HTML_DIRECT Storage Diagnostics:`, {
     totalEntries: htmlDirectCount,
     entries: Array.from(htmlDirectStorage.entries()).map(([transferId, data]) => ({
       transferId,
       pluginId: data.pluginId,
       requestId: data.requestId,
       age: Date.now() - data.timestamp,
       htmlSize: data.html.length
     }))
   });

   return {
     transfers: transferCount,
     workflows: workflowCount,
     htmlDirectStorage: htmlDirectCount,
     memoryUsage: getMemoryUsage(),
     uptime
   };
 }

function getMemoryUsage(): number | undefined {
  try {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
  } catch (error) {
    // Memory monitoring not available
  }
  return undefined;
}

// Handle HTML_DIRECT message
async function handleHtmlDirect(message: any) {
  console.log(`[offscreen][HTML_DIRECT] ===== RECEIVED HTML_DIRECT MESSAGE =====`);
  console.log(`[offscreen][HTML_DIRECT] Transfer ID: ${message.transferId}`);
  console.log(`[offscreen][HTML_DIRECT] Plugin ID: ${message.pluginId}`);
  console.log(`[offscreen][HTML_DIRECT] Request ID: ${message.requestId}`);
  console.log(`[offscreen][HTML_DIRECT] HTML Length: ${message.html?.length || 0} characters`);
  console.log(`[offscreen][HTML_DIRECT] Timestamp: ${new Date().toISOString()}`);

  // Validate required fields
  if (!message.transferId || typeof message.transferId !== 'string') {
    throw new Error(`Invalid transferId: expected string, got ${typeof message.transferId}`);
  }
  if (!message.pluginId || typeof message.pluginId !== 'string') {
    throw new Error(`Invalid pluginId: expected string, got ${typeof message.pluginId}`);
  }
  if (!message.requestId || typeof message.requestId !== 'string') {
    throw new Error(`Invalid requestId: expected string, got ${typeof message.requestId}`);
  }
  if (!message.html || typeof message.html !== 'string') {
    throw new Error(`Invalid html: expected string, got ${typeof message.html}`);
  }

  // Store HTML data in global storage
  htmlDirectStorage.set(message.transferId, {
    html: message.html,
    timestamp: Date.now(),
    pluginId: message.pluginId,
    requestId: message.requestId
  });

  console.log(`[offscreen][HTML_DIRECT] ✅ HTML stored for transfer ${message.transferId}`);
  console.log(`[offscreen][HTML_DIRECT] Storage size: ${htmlDirectStorage.size} items`);

  // Send acknowledgment
  trackSendResponse({
    success: true,
    transferId: message.transferId,
    stored: true,
    timestamp: Date.now()
  });
}

/**
 * Cleanup HTML_DIRECT storage by removing specific transfer or expired entries
 * @param transferId Optional specific transfer ID to remove. If not provided, removes expired entries
 */
function cleanupHtmlDirectStorage(transferId?: string): void {
  const now = Date.now();
  const expiredThreshold = 300000; // 5 minutes timeout for HTML_DIRECT storage
  const removedTransfers: string[] = [];

  if (transferId) {
    // Remove specific transfer
    if (htmlDirectStorage.has(transferId)) {
      htmlDirectStorage.delete(transferId);
      removedTransfers.push(transferId);
      console.log(`[offscreen][HTML_DIRECT] 🧹 Cleaned up specific transfer ${transferId} from HTML_DIRECT storage`);
    }
  } else {
    // Remove expired entries
    const entries = Array.from(htmlDirectStorage.entries());
    for (const [id, data] of entries) {
      if (now - data.timestamp > expiredThreshold) {
        htmlDirectStorage.delete(id);
        removedTransfers.push(id);
      }
    }

    if (removedTransfers.length > 0) {
      console.log(`[offscreen][HTML_DIRECT] 🧹 Cleaned up ${removedTransfers.length} expired transfers from HTML_DIRECT storage: [${removedTransfers.join(', ')}]`);
    }
  }

  // Log current storage state
  if (removedTransfers.length > 0) {
    console.log(`[offscreen][HTML_DIRECT] 📊 HTML_DIRECT storage state after cleanup: ${htmlDirectStorage.size} items remaining`);
    if (htmlDirectStorage.size > 0) {
      const remainingTransfers = Array.from(htmlDirectStorage.keys());
      console.log(`[offscreen][HTML_DIRECT] 📊 Remaining transfers: [${remainingTransfers.join(', ')}]`);
    }
  }
}

// Handle HTML_CHUNK message
async function handleHtmlChunk(message: HtmlChunkMessage) {
  console.log(`[offscreen][CHUNKING] ===== RECEIVED HTML CHUNK =====`);
  console.log(`[offscreen][CHUNKING] Transfer ID: ${message.transferId}`);
  console.log(`[offscreen][CHUNKING] Chunk Index: ${message.chunkIndex}/${message.totalChunks - 1}`);
  console.log(`[offscreen][CHUNKING] Chunk Length: ${message.chunkData.length} characters`);
  console.log(`[offscreen][CHUNKING] Timestamp: ${new Date().toISOString()}`);

  chunkManager.addChunk(
    message.transferId,
    message.chunkData,
    message.chunkIndex,
    message.totalChunks
  );

  // Check if all chunks received
  if (chunkManager.isComplete(message.transferId)) {
    console.log(`[offscreen][CHUNKING] ✅ ALL CHUNKS RECEIVED for transfer ${message.transferId}`);
    const finalStats = chunkManager.getStats(message.transferId);
    console.log(`[offscreen][CHUNKING] Final stats:`, finalStats);

    // Assembly HTML and send it back to background
    try {
      const assembledHtml = chunkManager.getAssembledData(message.transferId);
      console.log(`[offscreen][CHUNKING] 🔄 ASSEMBLED HTML ready for transfer ${message.transferId} (${assembledHtml.length} chars)`);

      try {
        await messageQueue.enqueue({
          type: 'HTML_ASSEMBLED',
          transferId: message.transferId,
          html: assembledHtml
        }, 2); // Very high priority for HTML assembly completion
        console.log(`[offscreen][CHUNKING] 📤 QUEUED HTML_ASSEMBLED message for transfer ${message.transferId}`);
      } catch (sendError) {
        console.error(`[offscreen][CHUNKING] ❌ Failed to queue HTML_ASSEMBLED for ${message.transferId}:`, sendError);
        // Don't throw for queued messages
      }
    } catch (assemblyError) {
      console.error(`[offscreen][CHUNKING] ❌ FAILED to assemble HTML for transfer ${message.transferId}:`, assemblyError);
    }
  }

  // Send acknowledgment back with enhanced error handling (fire-and-forget)
  console.log(`[offscreen][CHUNKING] 📤 Sending ACK for chunk ${message.chunkIndex} of ${message.transferId}`);
  try {
    await safeSendMessageOffscreen({
      type: 'HTML_CHUNK_ACK',
      transferId: message.transferId,
      chunkIndex: message.chunkIndex
    }, 0, false); // Fire-and-forget
    console.log(`[offscreen][CHUNKING] ✅ ACK sent successfully for chunk ${message.chunkIndex} (fire-and-forget)`);
  } catch (sendError) {
    console.error(`[offscreen][CHUNKING] ❌ Failed to send chunk acknowledgment for ${message.chunkIndex}:`, sendError);
    // Don't throw here as it would break the chunk processing flow
  }
}

// ==============================================================================
// MESSAGE LISTENER
// ==============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`[offscreen][DIAG] ===== OFFSCREEN MESSAGE RECEIVED =====`);
  console.log(`[offscreen][DIAG] Type: ${message.type}`);
  console.log(`[offscreen][DIAG] Sender:`, sender);
  console.log(`[offscreen][DIAG] Timestamp: ${new Date().toISOString()}`);
  console.log(`[offscreen][DIAG] Message keys: [${Object.keys(message).join(', ')}]`);
  console.log(`[offscreen][DIAG] Offscreen uptime: ${Date.now() - offscreenStartTime}ms`);
  console.log(`[offscreen][DIAG] Current transfers: [${Array.from(chunkManager['transfers'].keys()).join(', ')}]`);
  console.log(`[offscreen][DIAG] Transfer count: ${chunkManager['transfers'].size}`);

  // Check if this is the EXECUTE_WORKFLOW message we're waiting for
  if (message.type === 'EXECUTE_WORKFLOW') {
    console.log(`[offscreen][DIAG] 🚨 EXECUTE_WORKFLOW MESSAGE RECEIVED!`);
    console.log(`[offscreen][DIAG] Transfer ID: ${message.transferId || 'undefined'}`);
    console.log(`[offscreen][DIAG] Plugin ID: ${message.pluginId || 'undefined'}`);
    console.log(`[offscreen][DIAG] Request ID: ${message.requestId || 'undefined'}`);
    console.log(`[offscreen][DIAG] Use Chunks: ${message.useChunks}`);
    console.log(`[offscreen][DIAG] Has pageHtml: ${!!message.pageHtml}`);
    console.log(`[offscreen][DIAG] Has assembledHtml: ${!!message.assembledHtml}`);
    if (message.pageHtml) {
      console.log(`[offscreen][DIAG] Page HTML length: ${message.pageHtml.length} characters`);
    }
    if (message.assembledHtml) {
      console.log(`[offscreen][DIAG] Assembled HTML length: ${message.assembledHtml.length} characters`);
    }
  }

  switch (message.type) {
    case 'EXECUTE_WORKFLOW':
      console.log(`[offscreen][DIAG] 📨 ROUTING TO EXECUTE_WORKFLOW HANDLER`);
      handleExecuteWorkflow(message.data)
        .then(() => {
          console.log(`[offscreen][DIAG] ✅ EXECUTE_WORKFLOW handler completed successfully`);
          trackSendResponse({ success: true });
        })
        .catch(error => {
          console.error(`[offscreen][DIAG] ❌ EXECUTE_WORKFLOW handler failed:`, error);
          trackSendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async responses

    case 'HTML_CHUNK':
      console.log(`[offscreen][DIAG] 📨 ROUTING TO HTML_CHUNK HANDLER`);
      handleHtmlChunk(message);
      trackSendResponse({ received: true });
      break;

    case 'HTML_DIRECT':
      console.log(`[offscreen][DIAG] 📨 ROUTING TO HTML_DIRECT HANDLER`);
      handleHtmlDirect(message)
        .then(() => {
          console.log(`[offscreen][DIAG] ✅ HTML_DIRECT handler completed successfully`);
          trackSendResponse({ success: true });
        })
        .catch(error => {
          console.error(`[offscreen][DIAG] ❌ HTML_DIRECT handler failed:`, error);
          trackSendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async responses

    case 'HEARTBEAT_CHECK':
      console.log(`[offscreen][DIAG] 📨 ROUTING TO HEARTBEAT_CHECK HANDLER`);
      handleHeartbeatCheck(message as HeartbeatMessage)
        .then(() => {
          console.log(`[offscreen][DIAG] ✅ HEARTBEAT_CHECK handler completed successfully`);
          trackSendResponse({ success: true });
        })
        .catch(error => {
          console.error(`[offscreen][DIAG] ❌ HEARTBEAT_CHECK handler failed:`, error);
          trackSendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async responses

    case 'CONNECTION_PING':
      console.log(`[offscreen][DIAG] 📨 Received CONNECTION_PING`);
      trackSendResponse({ pong: true, timestamp: message.timestamp });
      break;

    case 'CONNECTION_RECOVERY_PING':
      console.log(`[offscreen][DIAG] 📨 Received CONNECTION_RECOVERY_PING (attempt ${message.attempt})`);
      trackSendResponse({ pong: true, attempt: message.attempt, timestamp: message.timestamp });
      break;

    default:
      console.warn(`[offscreen][DIAG] ⚠️ UNKNOWN MESSAGE TYPE:`, message.type);
      console.warn(`[offscreen][DIAG] Available handlers: EXECUTE_WORKFLOW, HTML_CHUNK, HTML_DIRECT, HEARTBEAT_CHECK, CONNECTION_PING, CONNECTION_RECOVERY_PING`);
      console.warn(`[offscreen][DIAG] Message keys:`, Object.keys(message));
      trackSendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      break;
  }

  console.log(`[offscreen][DIAG] ===== MESSAGE ROUTING COMPLETED =====`);
  return true; // Keep channel open for async responses
});

// ==============================================================================
// INITIALIZATION
// ==============================================================================

// Start connection monitoring when offscreen loads
connectionMonitor.startMonitoring();

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  connectionMonitor.stopMonitoring();
  console.log('[offscreen] Connection monitoring stopped on unload');
});

// console.log('[offscreen] Offscreen document loaded successfully');
// console.log('[offscreen] Ready to handle EXECUTE_WORKFLOW messages');

export {};