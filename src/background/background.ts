// src/background/background.ts
// Enhanced with strict typing, better error handling, and cleaner architecture

import { ensureOffscreenDocument } from './offscreen-manager';

// ===============================================================================
// STRICT TYPE DEFINITIONS - Foundation for type safety
// ===============================================================================

interface WorkflowMessage {
  type: 'RUN_WORKFLOW';
  pluginId: string;
  requestId?: string;
}

interface WorkflowCompletedMessage {
  type: 'WORKFLOW_COMPLETED';
  requestId: string;
  success: boolean;
  result?: any;
  error?: string;
}

interface HostCallMessage {
  type: 'HOST_CALL';
  payload: {
    func: string;
    args: any[];
    callId: string;
  };
}

interface ChunkMessage {
  type: 'HTML_CHUNK';
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkData: string;
}

type BackgroundMessage =
  | WorkflowMessage
  | WorkflowCompletedMessage
  | HostCallMessage
  | ChunkMessage
  | { type: 'HTML_CHUNK_COMPLETE'; transferId: string; totalChunks: number }
  | { type: 'HTML_CHUNK_ACK'; transferId: string; chunkIndex: number }
  | { type: 'HTML_ASSEMBLED'; transferId: string; html: string }
  | { type: 'LOG_MESSAGE' | 'WORKFLOW_RESULT'; [key: string]: any };

interface PendingWorkflow {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  startTime: number;
  pluginId: string;
}

interface ChunkTransfer {
  chunks: string[];
  acked: boolean[];
  totalSize: number;
  startTime: number;
}

// ===============================================================================
// ENHANCED CHUNK MANAGER - Better performance and error handling
// ===============================================================================

class EnhancedChunkManager {
  private transfers = new Map<string, ChunkTransfer>();
  private assembledHtmls = new Map<string, string>(); // Store assembled HTML from offscreen
  private readonly MAX_CHUNK_SIZE = 32768; // 32KB optimal for Chrome messaging
  private readonly TRANSFER_TIMEOUT = 30000; // 30s timeout
  private readonly CLEANUP_WARNING_THRESHOLD = 5000; // Show warning 5s before cleanup
  
  async sendInChunks(data: string, transferId: string): Promise<void> {
    const startTime = Date.now();
    const chunks = this.createChunks(data);

    const transfer: ChunkTransfer = {
      chunks,
      acked: new Array(chunks.length).fill(false),
      totalSize: data.length,
      startTime
    };

    this.transfers.set(transferId, transfer);
    console.log(`[Background::ChunkManager] ✅ CREATED transfer ${transferId} with ${chunks.length} chunks in BACKGROUND instance`);
    
    try {
      // console.log(`[ChunkManager] Starting transfer ${transferId}: ${chunks.length} chunks, ${data.length} bytes`);

      // Send all chunks in parallel for maximum speed
      const chunkPromises = chunks.map((chunk, i) => 
        this.sendChunkWithRetry(transferId, i, chunks.length, chunk)
      );
      
      await Promise.all(chunkPromises);
      
      // Signal completion
      await chrome.runtime.sendMessage({
        type: 'HTML_CHUNK_COMPLETE',
        transferId,
        totalChunks: chunks.length
      });

      // Transfer completed successfully (log only if needed for debugging)
      // const duration = Date.now() - startTime;
      // console.log(`[ChunkManager] Transfer ${transferId} completed in ${duration}ms`);

    } catch (error) {
      console.error(`[ChunkManager] Transfer ${transferId} failed:`, error);
      this.transfers.delete(transferId);
      throw error;
    }
  }
  
  private createChunks(data: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < data.length; i += this.MAX_CHUNK_SIZE) {
      chunks.push(data.slice(i, i + this.MAX_CHUNK_SIZE));
    }
    return chunks;
  }
  
  private async sendChunkWithRetry(
    transferId: string, 
    chunkIndex: number, 
    totalChunks: number, 
    chunkData: string, 
    maxRetries = 3
  ): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await chrome.runtime.sendMessage({
          type: 'HTML_CHUNK',
          transferId,
          chunkIndex,
          totalChunks,
          chunkData,
        });
        return; // Success
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const delay = Math.min(100 * Math.pow(2, attempt), 1000); // Exponential backoff
          await this.delay(delay);
        }
      }
    }
    
    throw lastError || new Error(`Failed to send chunk ${chunkIndex} after ${maxRetries + 1} attempts`);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  acknowledgeChunk(transferId: string, chunkIndex: number): void {
    const transfer = this.transfers.get(transferId);
    if (transfer && chunkIndex < transfer.acked.length) {
      transfer.acked[chunkIndex] = true;
    }
  }
  
  wasChunked(transferId: string): boolean {
    return this.transfers.has(transferId);
  }
  
  getTransferStats(transferId: string): { completed: number; total: number; duration: number } | null {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return null;

    return {
      completed: transfer.acked.filter(ack => ack === true).length,
      total: transfer.chunks.length,
      duration: Date.now() - transfer.startTime
    };
  }

  getAssembledData(transferId: string): string {
    console.log(`[Background::ChunkManager] 🔍 SEARCHING for transfer ${transferId} in BACKGROUND instance`);
    console.log(`[Background::ChunkManager] Current transfers in BACKGROUND: [${Array.from(this.transfers.keys()).join(', ')}]`);

    const transfer = this.transfers.get(transferId);

    if (!transfer) {
      console.error(`[Background::ChunkManager] ❌ TRANSFER ${transferId} NOT FOUND in BACKGROUND instance!`);
      console.error(`[Background::ChunkManager] Available transfers: [${Array.from(this.transfers.keys()).join(', ')}]`);
      throw new Error(`Transfer ${transferId} not found`);
    }
    console.log(`[Background::ChunkManager] ✅ Found transfer ${transferId} in BACKGROUND instance`);

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

    return assembled;
  }

  // Methods for assembled HTML storage
  setAssembledHtml(transferId: string, html: string): void {
    this.assembledHtmls.set(transferId, html);
    console.log(`[Background::ChunkManager] 💾 Stored assembled HTML for transfer ${transferId} (${html.length} chars)`);
  }

  getAssembledHtml(transferId: string): string | null {
    return this.assembledHtmls.get(transferId) || null;
  }

  // Cleanup expired transfers
  cleanup(): void {
    const now = Date.now();
    const expiredTransfers: string[] = [];

    this.transfers.forEach((transfer, transferId) => {
      const elapsed = now - transfer.startTime;
      if (elapsed > this.TRANSFER_TIMEOUT) {
        console.warn(`[Background::ChunkManager][CLEANUP] 🗑️ CLEANING UP expired transfer: ${transferId}`);
        console.warn(`[Background::ChunkManager][CLEANUP] Transfer age: ${elapsed}ms, timeout: ${this.TRANSFER_TIMEOUT}ms`);
        expiredTransfers.push(transferId);
        // Also cleanup assembled HTML
        this.assembledHtmls.delete(transferId);
      } else if (elapsed > this.TRANSFER_TIMEOUT - this.CLEANUP_WARNING_THRESHOLD) {
        console.warn(`[Background::ChunkManager][CLEANUP] ⚠️ WARNING: Transfer ${transferId} close to expiration (${elapsed}/${this.TRANSFER_TIMEOUT}ms)`);
      }
    });

    if (expiredTransfers.length > 0) {
      console.warn(`[Background::ChunkManager][CLEANUP] Removed ${expiredTransfers.length} expired transfers`);
      expiredTransfers.forEach(id => {
        this.transfers.delete(id);
      });
    }
  }
}

// ===============================================================================
// WORKFLOW PROMISE MANAGER - Better lifecycle management
// ===============================================================================

class WorkflowPromiseManager {
  private promises = new Map<string, PendingWorkflow>();
  private readonly DEFAULT_TIMEOUT = 60000; // 60s
  
  create(requestId: string, pluginId: string, timeoutMs = this.DEFAULT_TIMEOUT): Promise<any> {
    return new Promise((resolve, reject) => {
      const pending: PendingWorkflow = {
        resolve,
        reject,
        startTime: Date.now(),
        pluginId
      };
      
      this.promises.set(requestId, pending);
      
      // Auto-cleanup on timeout
      setTimeout(() => {
        if (this.promises.has(requestId)) {
          this.promises.delete(requestId);
          reject(new Error(`Workflow ${requestId} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });
  }
  
  resolve(requestId: string, result: any): boolean {
    const pending = this.promises.get(requestId);
    if (pending) {
      // SAFE RESULT HANDLING: Ensure result is never undefined
      const safeResult = result !== undefined ? result : null;

      if (result === undefined) {
        console.warn(`[WorkflowPromises] ⚠️ WARNING: Resolving with undefined result for ${requestId}, using null fallback`);
      }

      pending.resolve(safeResult);
      this.promises.delete(requestId);

      // const duration = Date.now() - pending.startTime;
      // console.log(`[WorkflowPromises] Resolved ${requestId} in ${duration}ms`);
      return true;
    }
    return false;
  }
  
  reject(requestId: string, error: Error): boolean {
    const pending = this.promises.get(requestId);
    if (pending) {
      pending.reject(error);
      this.promises.delete(requestId);
      
      // const duration = Date.now() - pending.startTime;
      // console.log(`[WorkflowPromises] Rejected ${requestId} after ${duration}ms:`, error.message);
      return true;
    }
    return false;
  }
  
  getStats(): { active: number; oldestAge: number } {
    const now = Date.now();
    let oldestAge = 0;
    
    this.promises.forEach(pending => {
      const age = now - pending.startTime;
      oldestAge = Math.max(oldestAge, age);
    });
    
    return {
      active: this.promises.size,
      oldestAge
    };
  }
}

// ===============================================================================
// HOST API PROVIDER - Centralized API management
// ===============================================================================

class HostApiProvider {
  private aiProviders = new Map<string, (prompt: string, context?: any) => Promise<string>>();
  
  constructor() {
    this.initializeProviders();
  }
  
  private initializeProviders(): void {
    // Mock providers - replace with real implementations
    this.aiProviders.set('gpt-4', this.createMockProvider('GPT-4'));
    this.aiProviders.set('claude', this.createMockProvider('Claude'));
    this.aiProviders.set('gemini', this.createMockProvider('Gemini'));
  }
  
  private createMockProvider(name: string) {
    return async (prompt: string, context?: any): Promise<string> => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));
      return `Mock response from ${name} for: "${prompt.substring(0, 50)}..."`;
    };
  }
  
  async handleHostCall(func: string, args: any[]): Promise<any> {
    switch (func) {
      case 'llm_call':
        return await this.handleLlmCall(args);
      case 'get_setting':
        return await this.handleGetSetting(args);
      case 'save_setting':
        return await this.handleSaveSetting(args);
      case 'get_plugin_data':
        return await this.handleGetPluginData(args);
      default:
        throw new Error(`Unknown Host API function: ${func}`);
    }
  }
  
  private async handleLlmCall(args: any[]): Promise<string> {
    const [modelAlias, prompt, context] = args;
    
    if (typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('Invalid prompt provided to LLM call');
    }
    
    const provider = this.aiProviders.get(modelAlias?.toLowerCase());
    if (!provider) {
      throw new Error(`Unknown AI model: ${modelAlias}`);
    }
    
    return await provider(prompt, context);
  }
  
  private async handleGetSetting(args: any[]): Promise<any> {
    const [settingKey] = args;
    if (typeof settingKey !== 'string') {
      throw new Error('Setting key must be a string');
    }
    
    try {
      const syncResult = await chrome.storage.sync.get(settingKey);
      if (syncResult[settingKey] !== undefined) {
        return syncResult[settingKey];
      }
      
      const localResult = await chrome.storage.local.get(settingKey);
      return localResult[settingKey];
    } catch (error) {
      console.error(`Failed to get setting ${settingKey}:`, error);
      return undefined;
    }
  }
  
  private async handleSaveSetting(args: any[]): Promise<boolean> {
    const [key, value] = args;
    if (typeof key !== 'string') {
      throw new Error('Setting key must be a string');
    }
    
    try {
      await chrome.storage.sync.set({ [key]: value });
      return true;
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      throw error;
    }
  }
  
  private async handleGetPluginData(args: any[]): Promise<any> {
    const [pluginId] = args;
    if (typeof pluginId !== 'string') {
      throw new Error('Plugin ID must be a string');
    }
    
    const pluginKey = `plugin_${pluginId}_data`;
    const result = await chrome.storage.local.get(pluginKey);
    
    return result[pluginKey] || {
      id: pluginId,
      name: pluginId,
      enabled: true,
      settings: {},
      cachedData: {}
    };
  }
}

// ===============================================================================
// MAIN BACKGROUND CONTROLLER - Clean orchestration
// ===============================================================================

class BackgroundController {
  private chunkManager = new EnhancedChunkManager();
  private promiseManager = new WorkflowPromiseManager();
  private hostApi = new HostApiProvider();
  private pendingWorkflows = new Map<string, { requestId: string; pluginId: string; pageHtml: string }>(); // transferId -> workflow data

  constructor() {
    this.setupMessageHandling();
    this.setupPeriodicCleanup();
    console.log('Background Controller initialized (Enhanced v3.0)');

    // DIAGNOSTIC: Setup transfer scope monitoring
    setInterval(() => this.logTransferScopeState(), 10000); // Every 10 seconds
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // DIAGNOSTIC: Make transfer timeout more visible
  private getTransferTimeout(): number {
    console.log(`[Background][DIAG] Using transfer timeout: ${this.chunkManager['TRANSFER_TIMEOUT']}ms`);
    return this.chunkManager['TRANSFER_TIMEOUT'];
  }

  // DIAGNOSTIC: Log current transfer scope state
  private logTransferScopeState(): void {
    const stats = this.promiseManager.getStats();
    const transferKeys = Array.from(this.chunkManager['transfers'].keys());
    const assembledKeys = Array.from(this.chunkManager['assembledHtmls'].keys());
    const pendingKeys = Array.from(this.pendingWorkflows.keys());

    if (stats.active > 0 || transferKeys.length > 0 || pendingKeys.length > 0) {
      console.log(`[Background][SCOPE_DEBUG] ===== CURRENT TRANSFER SCOPE STATE =====`);
      console.log(`[Background][SCOPE_DEBUG] Active promises: ${stats.active} (oldest: ${stats.oldestAge}ms ago)`);
      console.log(`[Background][SCOPE_DEBUG] Active chunk transfers: [${transferKeys.join(', ')}]`);
      console.log(`[Background][SCOPE_DEBUG] Assembled HTMLs: [${assembledKeys.join(', ')}]`);
      console.log(`[Background][SCOPE_DEBUG] Pending workflows: [${pendingKeys.join(', ')}]`);
      console.log(`[Background][SCOPE_DEBUG] ================================================`);
    }
  }
  
  private setupMessageHandling(): void {
    chrome.runtime.onMessage.addListener(
      (message: BackgroundMessage, sender, sendResponse) => {
        this.routeMessage(message, sender, sendResponse);
        return true; // Keep channel open for async responses
      }
    );
  }
  
  private setupPeriodicCleanup(): void {
    setInterval(() => {
      this.chunkManager.cleanup();

      // Periodic logging removed to reduce noise
      // const stats = this.promiseManager.getStats();
      // if (stats.active > 0) {
      //   console.log(`[Background] Active workflows: ${stats.active}, oldest: ${stats.oldestAge}ms`);
      // }
    }, 30000); // Every 30 seconds
  }
  
  private async routeMessage(
    message: BackgroundMessage, 
    sender: chrome.runtime.MessageSender, 
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'RUN_WORKFLOW':
          await this.handleRunWorkflow(message, sendResponse);
          break;
          
        case 'WORKFLOW_COMPLETED':
          this.handleWorkflowCompleted(message);
          break;
          
        case 'HTML_CHUNK_ACK':
          console.log(`[Background][CHUNKING] ✅ Received ACK for ${message.transferId} chunk ${message.chunkIndex}`);
          this.chunkManager.acknowledgeChunk(message.transferId, message.chunkIndex);

          // DIAGNOSTIC: Log transfer stats after each ack
          const ackStats = this.chunkManager.getTransferStats(message.transferId);
          if (ackStats) {
            console.log(`[Background][CHUNKING] Transfer ${message.transferId} progress: ${ackStats.completed}/${ackStats.total}, duration: ${ackStats.duration}ms`);
          }
          break;

        case 'HTML_ASSEMBLED':
          console.log(`[Background][ASSEMBLY] ✅ Received HTML_ASSEMBLED for ${message.transferId} (${(message as any).html.length} chars)`);
          this.chunkManager.setAssembledHtml(message.transferId, (message as any).html);

          // DIAGNOSTIC: Log assembled HTML details
          console.log(`[Background][ASSEMBLY][DIAG] Checking transfer scope for ${message.transferId}:`);
          console.log(`[Background][ASSEMBLY][DIAG] - Transfer exists in chunkManager: ${this.chunkManager.wasChunked(message.transferId)}`);
          console.log(`[Background][ASSEMBLY][DIAG] - Pending workflows count: ${this.pendingWorkflows.size}`);
          console.log(`[Background][ASSEMBLY][DIAG] - Pending workflows keys: [${Array.from(this.pendingWorkflows.keys()).join(', ')}]`);

          // Check if we have a pending workflow for this transfer
          const pendingWorkflow = this.pendingWorkflows.get(message.transferId);
          if (pendingWorkflow) {
            console.log(`[Background][ASSEMBLY] 🚀 Sending EXECUTE_WORKFLOW for pending workflow ${pendingWorkflow.requestId}`);

            // DIAGNOSTIC: Validate HTML data before sending
            const assembledHtml = (message as any).html;
            if (!assembledHtml || assembledHtml.length === 0) {
              console.error(`[Background][ASSEMBLY] ❌ CRITICAL: Assembled HTML is empty or undefined!`);
              console.error(`[Background][ASSEMBLY] Transfer ID: ${message.transferId}`);

              // Try to get from chunkManager as fallback
              const fallbackHtml = this.chunkManager.getAssembledHtml(message.transferId);
              if (fallbackHtml) {
                console.log(`[Background][ASSEMBLY] ✅ Using fallback HTML from chunkManager (${fallbackHtml.length} chars)`);
                (message as any).html = fallbackHtml;
              } else {
                console.error(`[Background][ASSEMBLY] ❌ NO FALLBACK HTML available!`);
                throw new Error(`Assembled HTML is empty for transfer ${message.transferId}`);
              }
            }

            await chrome.runtime.sendMessage({
              type: 'EXECUTE_WORKFLOW',
              pluginId: pendingWorkflow.pluginId,
              requestId: pendingWorkflow.requestId,
              transferId: message.transferId,
              pageKey: `transfer_${message.transferId}`, // Add pageKey for offscreen
              useChunks: false, // HTML is already assembled, no need to use chunks
              pageHtml: pendingWorkflow.pageHtml, // Original HTML (fallback if needed)
              assembledHtml: (message as any).html // Pre-assembled HTML from chunks
            });

            // Remove from pending workflows
            this.pendingWorkflows.delete(message.transferId);
            console.log(`[Background][ASSEMBLY] ✅ Removed transfer ${message.transferId} from pending workflows`);

          } else {
            console.warn(`[Background][ASSEMBLY] ⚠️ No pending workflow found for transfer ${message.transferId}`);
            console.warn(`[Background][ASSEMBLY] Available pending workflows: [${Array.from(this.pendingWorkflows.keys()).join(', ')}]`);
          }
          break;
          
        case 'HOST_CALL':
          await this.handleHostCall(message, sendResponse);
          break;
          
        case 'LOG_MESSAGE':
        case 'WORKFLOW_RESULT':
          // Forward to UI
          chrome.runtime.sendMessage(message);
          break;
          
        default:
          console.warn('[Background] Unknown message type:', (message as any).type);
      }
    } catch (error) {
      console.error('[Background] Error handling message:', error);
      sendResponse({ success: false, error: (error as Error).message });
    }
  }
  
  private async handleRunWorkflow(
    message: WorkflowMessage, 
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }
      
      const pageHtml = await this.extractPageHtml(tabs[0].id);
      await ensureOffscreenDocument();
      
      const requestId = message.requestId || `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const transferId = `${requestId}_html`;
      
      // Create workflow promise before sending data
      const resultPromise = this.promiseManager.create(requestId, message.pluginId);

      console.log(`[Background][DIAG] 📤 SENDING HTML (${pageHtml.length} chars) as chunks for transfer ${transferId}`);
      await this.chunkManager.sendInChunks(pageHtml, transferId);

      // Store workflow data for later when HTML is assembled
      this.pendingWorkflows.set(transferId, {
        requestId,
        pluginId: message.pluginId,
        pageHtml
      });

      // Wait to ensure chunks are processed and acknowledged
      console.log(`[Background][DIAG] ⏳ WAITING for chunks processing and acknowledgments (1s delay)`);
      await this.delay(1000);

      // DIAGNOSTIC: Check transfer state before sending EXECUTE_WORKFLOW
      const postSendStats = this.chunkManager.getTransferStats(transferId);
      console.log(`[Background][DIAG] Transfer stats BEFORE workflow execution:`, postSendStats);
      console.log(`[Background][DIAG] Transfer still exists: ${this.chunkManager.wasChunked(transferId)}`);
      console.log(`[Background][DIAG] useChunks flag will be set to: false`);

      // EXECUTE_WORKFLOW will be sent when HTML_ASSEMBLED is received from offscreen
      
      // Wait for result
      const result = await resultPromise;
      sendResponse({ success: true, result, requestId });
      
    } catch (error) {
      console.error('[Background] Workflow execution failed:', error);
      sendResponse({ success: false, error: (error as Error).message });
    }
  }
  
  private async extractPageHtml(tabId: number): Promise<string> {
    const [{ result: html }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML,
    });
    
    if (!html) {
      throw new Error('Failed to extract page HTML');
    }
    
    return html;
  }
  
  private handleWorkflowCompleted(message: WorkflowCompletedMessage): void {
    console.log('[BACKGROUND DEBUG] Handling workflow completed:');
    console.log('[BACKGROUND DEBUG] requestId:', message.requestId);
    console.log('[BACKGROUND DEBUG] success:', message.success);
    console.log('[BACKGROUND DEBUG] has result:', message.result !== undefined);
    console.log('[BACKGROUND DEBUG] result type:', typeof message.result);
    console.log('[BACKGROUND DEBUG] has error:', !!message.error);

    // CRITICAL FIX: Safe result handling to prevent "result is not defined" error
    if (message.success) {
      // Ensure result is NEVER undefined, even if message.result is undefined
      const safeResult = message.result !== undefined ? message.result : null;

      if (message.result === undefined) {
        console.warn('[BACKGROUND DEBUG] ⚠️ WARNING: message.result was undefined despite success=true!');
        console.warn('[BACKGROUND DEBUG] Using null fallback to prevent ReferenceError');
        console.warn('[BACKGROUND DEBUG] Original error field:', message.error);
      }

      console.log('[BACKGROUND DEBUG] Resolving promise with safe result:', safeResult);
      this.promiseManager.resolve(message.requestId, safeResult);
    } else {
      console.log('[BACKGROUND DEBUG] Rejecting promise with error');
      const errorMessage = message.error || 'Unknown workflow error';
      this.promiseManager.reject(message.requestId, new Error(errorMessage));
    }
  }
  
  private async handleHostCall(
    message: HostCallMessage,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      const result = await this.hostApi.handleHostCall(
        message.payload.func,
        message.payload.args
      );
      
      sendResponse({
        type: 'HOST_CALL_RESPONSE',
        callId: message.payload.callId,
        result
      });
    } catch (error) {
      sendResponse({
        type: 'HOST_CALL_RESPONSE',
        callId: message.payload.callId,
        error: (error as Error).message
      });
    }
  }
}

// ===============================================================================
// INITIALIZATION & ACTION HANDLER
// ===============================================================================

// Global controller instance
const controller = new BackgroundController();

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // @ts-ignore - Chrome Side Panel API
    if (chrome.sidePanel && tab.windowId) {
      // @ts-ignore
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } else {
      // Fallback to tab-based UI
      const sidePanelUrl = chrome.runtime.getURL('side-panel/index.html');
      const existingTabs = await chrome.tabs.query({ url: sidePanelUrl });
      
      if (existingTabs.length === 0) {
        await chrome.tabs.create({ url: sidePanelUrl });
      } else {
        await chrome.tabs.update(existingTabs[0].id!, { active: true });
      }
    }
  } catch (error) {
    console.error('[Background] Failed to open side panel:', error);
  }
});

console.log('Enhanced Background Script loaded successfully');