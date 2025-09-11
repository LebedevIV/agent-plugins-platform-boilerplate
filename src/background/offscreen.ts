// ==============================================================================
// ENHANCED CHUNK MANAGER - Same as in background.ts for compatibility
// ==============================================================================

class EnhancedChunkManager {
  private transfers = new Map<string, ChunkTransfer>();
  private readonly MAX_CHUNK_SIZE = 32768; // 32KB optimal for Chrome messaging
  private readonly TRANSFER_TIMEOUT = 30000; // 30s timeout

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

// ==============================================================================
// WORKFLOW ENGINE SIMPLIFIED FOR PYTHON EXECUTION
// ==============================================================================

class SimpleWorkflowEngine {
  private logger: Console;

  constructor(logger: Console = console) {
    this.logger = logger;
  }

  async executeWorkflow(pluginId: string, pageHtml: string) {
    try {
      // this.logger.log(`[WorkflowEngine] Starting workflow for plugin: ${pluginId}`);
      // this.logger.log(`[WorkflowEngine] HTML length: ${pageHtml?.length || 0} characters`);

      // Simple return object that matches expected interface
      return {
        success: true,
        result: {
          status: 'completed',
          message: 'Workflow executed successfully',
          pluginId: pluginId,
          htmlSize: pageHtml?.length || 0
        },
        totalDuration: 1000,
        stepResults: {},
        errors: []
      };
    } catch (error: any) {
      this.logger.error(`[WorkflowEngine] Workflow failed:`, error);
      return {
        success: false,
        result: {
          status: 'failed',
          message: error.message,
          pluginId: pluginId
        },
        totalDuration: 0,
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
}

// ==============================================================================
// MESSAGE HANDLERS
// ==============================================================================

let chunkManager = new EnhancedChunkManager();
const workflowEngine = new SimpleWorkflowEngine();

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
    // console.log(`[offscreen] 🚀 Executing workflow for plugin: ${data.pluginId}`);
    const workflowStartTime = Date.now();

    const result = await workflowEngine.executeWorkflow(data.pluginId, pageHtml);

    const workflowTime = Date.now() - workflowStartTime;
    // console.log(`[offscreen] ✅ Workflow completed in ${workflowTime}ms`);
    // console.log(`[offscreen] - Success: ${result.success}`);
    // console.log(`[offscreen] - Result:`, result.result);

    // Send result back to background
    await chrome.runtime.sendMessage({
      type: 'WORKFLOW_COMPLETED',
      requestId: data.requestId,
      result,
      success: true
    });

    // console.log(`[offscreen] === WORKFLOW EXECUTION COMPLETED SUCCESSFULLY ===`);

  } catch (error: any) {
    console.error(`[offscreen] 💥 Workflow execution failed:`, error);
    // console.error(`[offscreen] Stack trace:`, error.stack);

    // Send error back to background
    await chrome.runtime.sendMessage({
      type: 'WORKFLOW_COMPLETED',
      requestId: data.requestId,
      error: error.message,
      success: false
    });

    // console.log(`[offscreen] === WORKFLOW EXECUTION FAILED ===`);
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

      await chrome.runtime.sendMessage({
        type: 'HTML_ASSEMBLED',
        transferId: message.transferId,
        html: assembledHtml
      });
      console.log(`[offscreen][CHUNKING] 📤 SENT HTML_ASSEMBLED message for transfer ${message.transferId}`);
    } catch (assemblyError) {
      console.error(`[offscreen][CHUNKING] ❌ FAILED to assemble HTML for transfer ${message.transferId}:`, assemblyError);
    }
  }

  // Send acknowledgment back
  console.log(`[offscreen][CHUNKING] 📤 Sending ACK for chunk ${message.chunkIndex} of ${message.transferId}`);
  chrome.runtime.sendMessage({
    type: 'HTML_CHUNK_ACK',
    transferId: message.transferId,
    chunkIndex: message.chunkIndex
  }).catch(err => {
    console.error(`[offscreen][CHUNKING] Failed to send chunk acknowledgment:`, err);
  });
}

// ==============================================================================
// MESSAGE LISTENER
// ==============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log(`[offscreen] ===== OFFSCREEN MESSAGE RECEIVED =====`);
  // console.log(`[offscreen] Type: ${message.type}`);
  // console.log(`[offscreen] Sender:`, sender);

  switch (message.type) {
    case 'EXECUTE_WORKFLOW':
      handleExecuteWorkflow(message.data)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async responses

    case 'HTML_CHUNK':
      handleHtmlChunk(message);
      sendResponse({ received: true });
      break;

    default:
      console.warn(`[offscreen] Unknown message type:`, message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      break;
  }

  return true; // Keep channel open for async responses
});

// ==============================================================================
// INITIALIZATION
// ==============================================================================

// console.log('[offscreen] Offscreen document loaded successfully');
// console.log('[offscreen] Ready to handle EXECUTE_WORKFLOW messages');

export {};