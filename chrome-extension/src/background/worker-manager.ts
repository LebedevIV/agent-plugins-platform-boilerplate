/**
 * Worker Manager for Agent-Plugins-Platform
 * Manages creation and storage of a single Pyodide Web Worker instance
 * Implements Singleton pattern to avoid multiple initialization of heavy Pyodide environment
 */

// Private module variable storing worker instance
let workerInstance: Worker | null = null;

/**
 * Returns the single Pyodide worker instance
 * If worker is not created yet, creates it
 */
export function getWorker(): Worker {
  if (!workerInstance) {
    console.log('[WorkerManager] Worker instance not found. Creating new one...');
    
    // Create worker. Path is calculated relative to current file
    workerInstance = new Worker(new URL('./pyodide-worker.js', import.meta.url));
    
    // Add error handler in case worker crashes
    workerInstance.onerror = (error) => {
      console.error('[WorkerManager] CRITICAL WORKER ERROR:', error);
      // In case of critical error, reset instance
      // so next time we try to create it again
      workerInstance = null; 
    };

  } else {
    console.log('[WorkerManager] Returning existing worker instance.');
  }

  return workerInstance;
} 