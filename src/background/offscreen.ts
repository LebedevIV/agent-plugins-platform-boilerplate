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
  private readonly TRANSFER_TIMEOUT = 60000; // 60s timeout (increased from 30s)

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanup(), this.TRANSFER_TIMEOUT);
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

  async executeWorkflow(pluginId: string, pageHtml: string, requestId?: string) {
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
      const pythonResult = await this.executePythonAnalysis(pageHtml);

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

      // Set up js bridge for Python
      this.pyodide.runPython(`
import js
import sys
from typing import Any, Dict
import json

def sendMessageToChat(message):
    js.sendMessageToChat(message)

def host_fetch(url):
    return js.hostFetch(url)

js.sendMessageToChat = sendMessageToChat
js.host_fetch = host_fetch
`);

      // Load the plugin code
      const response = await fetch(chrome.runtime.getURL('plugins/ozon-analyzer/mcp_server.py'));
      const pythonCode = await response.text();
      this.pyodide.runPython(pythonCode);

      this.logger.log('[WorkflowEngine] Pyodide initialized successfully');
    } catch (error) {
      this.logger.error('[WorkflowEngine] Failed to initialize Pyodide:', error);
      throw error;
    } finally {
      this.pyodideLoading = false;
    }
  }

  private async executePythonAnalysis(htmlContent: string): Promise<any> {
    await this.initializePyodide();

    try {
      this.logger.log('[WorkflowEngine] Executing Python analysis...');

      // Set the HTML content in Python
      this.pyodide.globals.set('page_html', htmlContent);

      // Execute the analysis function
      const result = this.pyodide.runPython(`
import logging
logging.basicConfig(level=logging.INFO)

# Mock js object for the Python code
class MockJs:
    def sendMessageToChat(self, message):
        print(f"Chat message: {message}")

js = MockJs()

# Execute the analysis
try:
    result = analyze_ozon_product()
    result
except Exception as e:
    {"status": "error", "error": str(e)}
`);

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

  try {
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
      // console.log(`[offscreen] 📄 Using direct HTML (no chunks)`);
      // console.log(`[offscreen] - Length: ${pageHtml?.length || 0} characters`);
    }

    // Validate final HTML
    if (!pageHtml || pageHtml.length === 0) {
      // console.log(`[offscreen] ❌ ERROR: Final HTML is empty or undefined!`);
      throw new Error('Assembled HTML is empty');
    }

    // Execute workflow
    console.log(`[offscreen][DIAG] 🚀 Executing workflow for plugin: ${data.pluginId}, request: ${data.requestId}`);
    const workflowStartTime = Date.now();

    const result = await workflowEngine.executeWorkflow(data.pluginId, pageHtml, data.requestId);

    const workflowTime = Date.now() - workflowStartTime;
    console.log(`[offscreen][DIAG] ✅ Workflow completed in ${workflowTime}ms`);
    console.log(`[offscreen][DIAG] - Success: ${result.success}`);
    console.log(`[offscreen][DIAG] - Result:`, result.result);

    // Send result back to background with error handling (fire-and-forget for results)
    try {
      await safeSendMessageOffscreen({
        type: 'WORKFLOW_COMPLETED',
        requestId: data.requestId,
        result,
        success: true
      }, 0, false); // No timeout, fire-and-forget
      console.log(`[offscreen] ✅ Successfully sent WORKFLOW_COMPLETED for ${data.requestId} (fire-and-forget)`);
    } catch (sendError) {
      console.error(`[offscreen] ❌ Failed to send WORKFLOW_COMPLETED for ${data.requestId}:`, sendError);
      // Don't throw for fire-and-forget messages, just log
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
      await safeSendMessageOffscreen({
        type: 'WORKFLOW_COMPLETED',
        requestId: data.requestId,
        error: errorMessage,
        errorDetails: errorDetails,
        success: false
      }, 0, false); // No timeout, fire-and-forget
      console.log(`[offscreen][DIAG] ✅ Successfully sent WORKFLOW_COMPLETED error for ${data.requestId} (fire-and-forget)`);
      console.log(`[offscreen][DIAG] Error message sent: ${errorMessage}`);
    } catch (sendError) {
      console.error(`[offscreen][DIAG] ❌ CRITICAL: Failed to send WORKFLOW_COMPLETED error for ${data.requestId}:`, sendError);
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
  console.log(`[offscreen][HEARTBEAT] 💓 Received heartbeat check ${message.heartbeatId}`);

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
    console.log(`[offscreen][HEARTBEAT] 📤 Sending heartbeat response ${message.heartbeatId} (${latency}ms latency)`);

    try {
      await safeSendMessageOffscreen(response);
      console.log(`[offscreen][HEARTBEAT] ✅ Heartbeat response sent successfully`);
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

  // Count active workflows (simplified - we could track this better)
  const workflowCount = 0; // SimpleWorkflowEngine doesn't track active workflows

  return {
    transfers: transferCount,
    workflows: workflowCount,
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
        await safeSendMessageOffscreen({
          type: 'HTML_ASSEMBLED',
          transferId: message.transferId,
          html: assembledHtml
        }, 0, false); // Fire-and-forget
        console.log(`[offscreen][CHUNKING] 📤 SENT HTML_ASSEMBLED message for transfer ${message.transferId} (fire-and-forget)`);
      } catch (sendError) {
        console.error(`[offscreen][CHUNKING] ❌ Failed to send HTML_ASSEMBLED for ${message.transferId}:`, sendError);
        // Don't throw for fire-and-forget messages
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
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error(`[offscreen][DIAG] ❌ EXECUTE_WORKFLOW handler failed:`, error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async responses

    case 'HTML_CHUNK':
      console.log(`[offscreen][DIAG] 📨 ROUTING TO HTML_CHUNK HANDLER`);
      handleHtmlChunk(message);
      sendResponse({ received: true });
      break;

    case 'HEARTBEAT_CHECK':
      console.log(`[offscreen][DIAG] 📨 ROUTING TO HEARTBEAT_CHECK HANDLER`);
      handleHeartbeatCheck(message as HeartbeatMessage)
        .then(() => {
          console.log(`[offscreen][DIAG] ✅ HEARTBEAT_CHECK handler completed successfully`);
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error(`[offscreen][DIAG] ❌ HEARTBEAT_CHECK handler failed:`, error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async responses

    default:
      console.warn(`[offscreen][DIAG] ⚠️ UNKNOWN MESSAGE TYPE:`, message.type);
      console.warn(`[offscreen][DIAG] Available handlers: EXECUTE_WORKFLOW, HTML_CHUNK, HEARTBEAT_CHECK`);
      console.warn(`[offscreen][DIAG] Message keys:`, Object.keys(message));
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      break;
  }

  console.log(`[offscreen][DIAG] ===== MESSAGE ROUTING COMPLETED =====`);
  return true; // Keep channel open for async responses
});

// ==============================================================================
// INITIALIZATION
// ==============================================================================

// console.log('[offscreen] Offscreen document loaded successfully');
// console.log('[offscreen] Ready to handle EXECUTE_WORKFLOW messages');

export {};