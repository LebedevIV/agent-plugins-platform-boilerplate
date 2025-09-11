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
  private readonly MAX_CHUNK_SIZE = 32768; // 32KB optimal for Chrome messaging
  private readonly TRANSFER_TIMEOUT = 30000; // 30s timeout
  
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
    
    try {
      console.log(`[ChunkManager] Starting transfer ${transferId}: ${chunks.length} chunks, ${data.length} bytes`);
      
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
      
      const duration = Date.now() - startTime;
      console.log(`[ChunkManager] Transfer ${transferId} completed in ${duration}ms`);
      
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

    return assembled;
  }

  // Cleanup expired transfers
  cleanup(): void {
    const now = Date.now();
    const expiredTransfers: string[] = [];
    
    this.transfers.forEach((transfer, transferId) => {
      if (now - transfer.startTime > this.TRANSFER_TIMEOUT) {
        expiredTransfers.push(transferId);
      }
    });
    
    expiredTransfers.forEach(id => {
      console.warn(`[ChunkManager] Cleaning up expired transfer: ${id}`);
      this.transfers.delete(id);
    });
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
      pending.resolve(result);
      this.promises.delete(requestId);
      
      const duration = Date.now() - pending.startTime;
      console.log(`[WorkflowPromises] Resolved ${requestId} in ${duration}ms`);
      return true;
    }
    return false;
  }
  
  reject(requestId: string, error: Error): boolean {
    const pending = this.promises.get(requestId);
    if (pending) {
      pending.reject(error);
      this.promises.delete(requestId);
      
      const duration = Date.now() - pending.startTime;
      console.log(`[WorkflowPromises] Rejected ${requestId} after ${duration}ms:`, error.message);
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

  constructor() {
    this.setupMessageHandling();
    this.setupPeriodicCleanup();
    console.log('Background Controller initialized (Enhanced v3.0)');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      
      const stats = this.promiseManager.getStats();
      if (stats.active > 0) {
        console.log(`[Background] Active workflows: ${stats.active}, oldest: ${stats.oldestAge}ms`);
      }
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
          this.chunkManager.acknowledgeChunk(message.transferId, message.chunkIndex);
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

      console.log(`[Background] Sending HTML (${pageHtml.length} chars) in chunks`);
      await this.chunkManager.sendInChunks(pageHtml, transferId);

      // Wait to ensure chunks are processed and acknowledged
      console.log(`[Background] All chunks sent, waiting 1s for processing and acknowledgments...`);
      await this.delay(1000);

      // Wait for all chunks to be acknowledged with retries
      const MAX_ASSEMBLY_RETRIES = 10;
      let assemblyRetry = 0;
      let assembledHtml: string = '';

      console.log(`[WORKFLOW ASSEMBLY] === STARTING HTML ASSEMBLY PROCESS ===`);
      console.log(`[WORKFLOW ASSEMBLY] Transfer ID: ${transferId}`);
      console.log(`[WORKFLOW ASSEMBLY] Original HTML length: ${pageHtml.length} characters`);
      console.log(`[WORKFLOW ASSEMBLY] Will retry up to ${MAX_ASSEMBLY_RETRIES} times`);

      while (assemblyRetry < MAX_ASSEMBLY_RETRIES) {
        try {
          console.log(`[WORKFLOW ASSEMBLY] Attempt ${assemblyRetry + 1}/${MAX_ASSEMBLY_RETRIES} to gather assembled HTML from chunks`);

          // Check if all chunks are acknowledged
          const stats = this.chunkManager.getTransferStats(transferId);
          if (stats && stats.completed >= stats.total) {
            console.log(`[WORKFLOW ASSEMBLY] SUCCESS: All chunks acknowledged: ${stats.completed}/${stats.total}`);

            // Assemble HTML from chunks
            assembledHtml = this.chunkManager.getAssembledData(transferId);
            console.log(`[WORKFLOW ASSEMBLY] ASSEMBLY COMPLETE: ${assembledHtml?.length || 0} characters assembled`);
            console.log(`[WORKFLOW ASSEMBLY] ASSEMBLY VERIFICATION:`);
            console.log(`[WORKFLOW ASSEMBLY] - Original length: ${pageHtml.length}`);
            console.log(`[WORKFLOW ASSEMBLY] - Assembled length: ${assembledHtml.length}`);
            console.log(`[WORKFLOW ASSEMBLY] - Length difference: ${Math.abs(pageHtml.length - assembledHtml.length)}`);

            // Validate assembly quality
            if (Math.abs(pageHtml.length - assembledHtml.length) > 100) {
              console.warn(`[WORKFLOW ASSEMBLY] WARNING: Significant length difference detected!`);
            } else {
              console.log(`[WORKFLOW ASSEMBLY] ✅ Assembly length validation passed`);
            }

            // Show preview of assembled data
            const previewLength = Math.min(200, assembledHtml.length);
            console.log(`[WORKFLOW ASSEMBLY] Assembled HTML preview (first ${previewLength} chars):`);
            console.log(assembledHtml.substring(0, previewLength));

            break;
          } else {
            console.log(`[WORKFLOW ASSEMBLY] In progress: ${stats?.completed || 0}/${stats?.total || 0} chunks acknowledged`);
            await this.delay(500); // Wait 500ms between retries
            assemblyRetry++;
          }
        } catch (error) {
          console.error(`[Background] Assembly attempt ${assemblyRetry + 1} failed:`, error);
          if (assemblyRetry === MAX_ASSEMBLY_RETRIES - 1) {
            throw new Error(`Failed to assemble HTML after ${MAX_ASSEMBLY_RETRIES} attempts: ${error}`);
          }
          await this.delay(500);
          assemblyRetry++;
        }
      }

      if (!assembledHtml || assembledHtml.length === 0) {
        throw new Error('Assembled HTML is empty');
      }

      // Дополнительная валидация transfer
      const finalStats = this.chunkManager.getTransferStats(transferId);
      console.log(`[WORKFLOW VALIDATION] Transfer ${transferId} final stats:`);
      console.log(`[WORKFLOW VALIDATION] - Completed chunks: ${finalStats?.completed || 0}`);
      console.log(`[WORKFLOW VALIDATION] - Total chunks: ${finalStats?.total || 0}`);
      console.log(`[WORKFLOW VALIDATION] - Transfer duration: ${finalStats?.duration || 0}ms`);

      if (!finalStats || finalStats.completed !== finalStats.total) {
        console.error(`[WORKFLOW VALIDATION] CRITICAL: Transfer validation failed!`);
        console.error(`[WORKFLOW VALIDATION] Expected: ${finalStats?.total || 'unknown'} completed chunks`);
        console.error(`[WORKFLOW VALIDATION] Actual: ${finalStats?.completed || 'unknown'} completed chunks`);
        throw new Error(`Transfer validation failed: ${finalStats?.completed || 0}/${finalStats?.total || 0} chunks acknowledged`);
      }

      console.log(`[WORKFLOW VALIDATION] ✅ Transfer ${transferId} validation passed`);

      // Основная диагностика перед отправкой EXECUTE_WORKFLOW
      console.log(`[WORKFLOW DEBUG] === EXECUTE_WORKFLOW PREPARATION ===`);
      console.log(`[WORKFLOW DEBUG] Plugin: ${message.pluginId}`);
      console.log(`[WORKFLOW DEBUG] Request ID: ${requestId}`);
      console.log(`[WORKFLOW DEBUG] Transfer ID: ${transferId}`);
      console.log(`[WORKFLOW DEBUG] Assembled HTML length: ${assembledHtml.length} characters`);
      console.log(`[WORKFLOW DEBUG] HTML preview (first 200 chars):`, assembledHtml.substring(0, 200));
      console.log(`[WORKFLOW DEBUG] HTML preview (last 200 chars):`, assembledHtml.substring(Math.max(0, assembledHtml.length - 200)));

      // Validate HTML before sending
      if (assembledHtml.length < 1000) {
        console.warn(`[WORKFLOW DEBUG] WARNING: HTML length is suspiciously small: ${assembledHtml.length} chars`);
        console.warn(`[WORKFLOW DEBUG] Full HTML content:`, assembledHtml);
      }

      console.log(`[Background] Sending EXECUTE_WORKFLOW with assembled HTML`);
      await chrome.runtime.sendMessage({
        type: 'EXECUTE_WORKFLOW',
        data: {
          pluginId: message.pluginId,
          requestId,
          transferId,
          useChunks: false,
          pageHtml: assembledHtml
        }
      });
      
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
    console.log('[BACKGROUND DEBUG] error:', message.error);

    // DIAGNOSTIC: Check result before using it
    if (message.success) {
      if (message.result === undefined) {
        console.error('[BACKGROUND DEBUG] CRITICAL: message.result is undefined despite success=true!');
        console.error('[BACKGROUND DEBUG] This will cause ReferenceError when trying to use `result`');
      }
      console.log('[BACKGROUND DEBUG] Resolving promise with result');
      this.promiseManager.resolve(message.requestId, message.result);
    } else {
      console.log('[BACKGROUND DEBUG] Rejecting promise with error');
      this.promiseManager.reject(message.requestId, new Error(message.error || 'Unknown workflow error'));
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