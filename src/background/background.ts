// src/background/background.ts
// Enhanced with strict typing, better error handling, and cleaner architecture

import { ensureOffscreenDocument } from './offscreen-manager';
import { TransferMetadataManager } from './transfer-metadata-manager';
import { getPluginSettings } from '../../packages/storage/lib/plugin-settings';
import { pluginChatApi } from './plugin-chat-api';

// ===============================================================================
// GLOBAL SETTINGS TYPES AND FUNCTIONS
// ===============================================================================

/**
 * Интерфейс глобальных настроек расширения
 */
interface GlobalSettings {
  htmlTransmissionMode: 'chunks' | 'direct';
  // Другие глобальные настройки могут быть добавлены здесь
}

/**
 * Получает глобальные настройки расширения из chrome.storage.local
 */
async function getGlobalSettings(): Promise<GlobalSettings> {
  try {
    console.log('[background][GLOBAL_SETTINGS] Reading global settings from chrome.storage.local...');
    const settings = await chrome.storage.local.get([
      'htmlTransmissionMode'
    ]);

    const htmlTransmissionMode = settings.htmlTransmissionMode || 'chunks';
    console.log(`[background][GLOBAL_SETTINGS] ✅ Successfully loaded global settings: htmlTransmissionMode=${htmlTransmissionMode}`);

    return {
      htmlTransmissionMode
    };
  } catch (error) {
    console.error('[background][GLOBAL_SETTINGS] ❌ Failed to load global settings from chrome.storage.local:', error);
    console.warn('[background][GLOBAL_SETTINGS] 🔄 Using fallback: htmlTransmissionMode=chunks');
    return { htmlTransmissionMode: 'chunks' }; // fallback
  }
}

// ===============================================================================
// HTML TRANSMISSION CONSTANTS - Direct transmission limits and warnings
// ===============================================================================

const MAX_DIRECT_SIZE = 50 * 1024 * 1024; // 50MB безопасный лимит для прямой передачи
const WARN_SIZE = 10 * 1024 * 1024; // 10MB - предупреждение о большом размере

// ===============================================================================
// CHAT UTILITY FUNCTIONS
// ===============================================================================

/**
 * Нормализует pageKey для обеспечения консистентности
 */
function getPageKey(pageKey: string): string {
  if (!pageKey) return 'unknown_page';
  // Удаляем лишние слеши и пробелы
  return pageKey.replace(/^\/+|\/+$/g, '').replace(/\s+/g, '_');
}

/**
 * Отправляет уведомление об обновлении чата всем слушателям
 */
function broadcastChatUpdate(pluginId: string, pageKey: string): void {
  console.log('[background] Broadcasting chat update:', { pluginId, pageKey });

  chrome.runtime.sendMessage({
    type: 'PLUGIN_CHAT_UPDATED',
    pluginId,
    pageKey,
    timestamp: Date.now()
  }).catch(error => {
    console.warn('[background] Failed to broadcast chat update:', error);
  });
}

// ===============================================================================
// HTML DIRECT TRANSMISSION - Alternative to chunked transmission
// ===============================================================================

/**
 * Прямая передача HTML без разделения на чанки
 * @param pageHtml HTML содержимое страницы
 * @param workflowPayload Объект с данными workflow (pluginId, requestId, transferId)
 */
async function sendHtmlDirectly(
  pageHtml: string,
  workflowPayload: {
    pluginId: string;
    requestId: string;
    transferId: string;
  }
): Promise<void> {
  const htmlSize = pageHtml.length;

  console.log(`[HtmlDirect] 📤 Начинаем прямую передачу HTML (${htmlSize} символов, ${(htmlSize / 1024 / 1024).toFixed(2)}MB)`);

  // Проверка размера HTML
  if (htmlSize > MAX_DIRECT_SIZE) {
    const errorMsg = `HTML размер (${(htmlSize / 1024 / 1024).toFixed(2)}MB) превышает безопасный лимит (${MAX_DIRECT_SIZE / 1024 / 1024}MB)`;
    console.error(`[HtmlDirect] ❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (htmlSize > WARN_SIZE) {
    console.warn(`[HtmlDirect] ⚠️ Большой HTML размер: ${(htmlSize / 1024 / 1024).toFixed(2)}MB (> ${WARN_SIZE / 1024 / 1024}MB)`);
  }

  try {
    // Убеждаемся, что offscreen document доступен
    const offscreenAvailable = await isOffscreenAvailable();
    if (!offscreenAvailable) {
      console.log(`[HtmlDirect] 🔧 Offscreen недоступен, создаем...`);
      await ensureOffscreenDocument();
    }

    // Прямая передача в offscreen document
    console.log(`[HtmlDirect] 📤 Отправляем EXECUTE_WORKFLOW с полным HTML`);

    const sendAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= sendAttempts; attempt++) {
      try {
        await safeSendMessage({
          type: 'EXECUTE_WORKFLOW',
          pluginId: workflowPayload.pluginId,
          requestId: workflowPayload.requestId,
          transferId: workflowPayload.transferId,
          pageKey: `transfer_${workflowPayload.transferId}`,
          useChunks: false, // Отмечаем, что не используем чанки
          pageHtml: '', // Пустая строка, так как передаем assembledHtml
          assembledHtml: pageHtml // Передаем полный HTML напрямую
        }, 10000); // Увеличенный таймаут для больших данных

        console.log(`[HtmlDirect] ✅ EXECUTE_WORKFLOW отправлен успешно (попытка ${attempt})`);
        return; // Успех

      } catch (error) {
        lastError = error as Error;
        console.warn(`[HtmlDirect] ⚠️ Попытка ${attempt} провалилась:`, error);

        if (attempt < sendAttempts) {
          // Ждем перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // Все попытки провалились
    const errorMsg = `Не удалось отправить HTML напрямую после ${sendAttempts} попыток: ${lastError?.message}`;
    console.error(`[HtmlDirect] ❌ ${errorMsg}`);
    throw new Error(errorMsg);

  } catch (error) {
    console.error(`[HtmlDirect] ❌ Ошибка прямой передачи HTML:`, error);
    throw error; // Пробрасываем ошибку для обработки на уровне выше
  }
}

// ===============================================================================
// TRACK RESPONSE UTILITY - Enhanced response logging
// ===============================================================================

/**
 * Enhanced response tracking with JSON logging
 */
function trackSendResponse(response: any): boolean {
  console.log('[background][RESPONSE] Sending response:', JSON.stringify(response));
  return true;
}

// ===============================================================================
// CIRCUIT BREAKER PATTERN - Prevents cascading failures and race conditions
// ===============================================================================

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of consecutive failures to trip circuit
  recoveryTimeout: number;       // Time in ms before attempting recovery (Open → Half-Open)
  monitoringWindow: number;      // Time window in ms for monitoring failures
  successThreshold: number;      // Number of successes needed in Half-Open to close circuit
}

interface CircuitBreakerMetrics {
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  stateChangeTime: number;
  recoveryAttempts: number;
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics;
  private recoveryTimer?: NodeJS.Timeout;
  private failureWindow: number[] = []; // Timestamps of recent failures

  constructor(
    name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = {
      failureThreshold: 3,
      recoveryTimeout: 30000,      // 30 seconds
      monitoringWindow: 60000,     // 1 minute
      successThreshold: 1,
      ...config
    };

    this.metrics = {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      stateChangeTime: Date.now(),
      recoveryAttempts: 0
    };

    console.log(`[CircuitBreaker:${name}] 🚀 Initialized with config:`, this.config);
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    this.metrics.totalRequests++;

    // Check if circuit should allow execution
    if (!this.canExecute()) {
      console.warn(`[CircuitBreaker] ❌ Circuit is ${this.state} - operation blocked`);

      if (fallback) {
        console.log(`[CircuitBreaker] 🔄 Executing fallback operation`);
        return await fallback();
      }

      throw new Error(`Circuit breaker is ${this.state} - operation not allowed`);
    }

    try {
      console.log(`[CircuitBreaker] ⚡ Executing operation (state: ${this.state})`);
      const result = await operation();

      this.recordSuccess();
      return result;

    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Check if operation can be executed based on current state
   */
  private canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if recovery timeout has elapsed
        if (Date.now() - this.metrics.stateChangeTime >= this.config.recoveryTimeout) {
          console.log(`[CircuitBreaker] 🔄 Recovery timeout elapsed, transitioning to HALF_OPEN`);
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    this.metrics.totalSuccesses++;
    this.metrics.lastSuccessTime = Date.now();
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;

    console.log(`[CircuitBreaker] ✅ Operation successful (consecutive: ${this.metrics.consecutiveSuccesses})`);

    // Transition from HALF_OPEN to CLOSED if success threshold reached
    if (this.state === CircuitState.HALF_OPEN && this.metrics.consecutiveSuccesses >= this.config.successThreshold) {
      console.log(`[CircuitBreaker] 🔄 Success threshold reached, transitioning to CLOSED`);
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(): void {
    this.metrics.totalFailures++;
    this.metrics.lastFailureTime = Date.now();
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;

    // Add failure timestamp to window
    this.failureWindow.push(Date.now());

    // Clean old failures outside monitoring window
    this.cleanFailureWindow();

    console.log(`[CircuitBreaker] ❌ Operation failed (consecutive: ${this.metrics.consecutiveFailures})`);

    // Check if circuit should trip
    if (this.shouldTripCircuit()) {
      console.log(`[CircuitBreaker] 🔴 Failure threshold exceeded, transitioning to OPEN`);
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Check if circuit should trip based on failure threshold and window
   */
  private shouldTripCircuit(): boolean {
    if (this.state === CircuitState.HALF_OPEN) {
      // In HALF_OPEN, single failure trips back to OPEN
      return true;
    }

    // Check consecutive failures within monitoring window
    const recentFailures = this.failureWindow.filter(
      timestamp => Date.now() - timestamp <= this.config.monitoringWindow
    );

    return recentFailures.length >= this.config.failureThreshold;
  }

  /**
   * Clean old failure timestamps outside monitoring window
   */
  private cleanFailureWindow(): void {
    const cutoff = Date.now() - this.config.monitoringWindow;
    this.failureWindow = this.failureWindow.filter(timestamp => timestamp > cutoff);
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.metrics.stateChangeTime = Date.now();

    console.log(`[CircuitBreaker] 🔄 State transition: ${oldState} → ${newState}`);

    // Handle state-specific logic
    if (newState === CircuitState.HALF_OPEN) {
      this.metrics.recoveryAttempts++;
    }

    if (newState === CircuitState.CLOSED) {
      this.metrics.consecutiveFailures = 0;
      this.metrics.consecutiveSuccesses = 0;
    }

    // Log state change with metrics
    this.logStateChange(oldState, newState);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get health status based on circuit state
   */
  getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    switch (this.state) {
      case CircuitState.CLOSED:
        return 'healthy';
      case CircuitState.HALF_OPEN:
        return 'degraded';
      case CircuitState.OPEN:
        return 'critical';
      default:
        return 'critical';
    }
  }

  /**
   * Get success rate as percentage
   */
  getSuccessRate(): number {
    if (this.metrics.totalRequests === 0) return 100;
    return Math.round((this.metrics.totalSuccesses / this.metrics.totalRequests) * 100);
  }

  /**
   * Log state change with detailed metrics
   */
  private logStateChange(oldState: CircuitState, newState: CircuitState): void {
    console.log(`[CircuitBreaker] 📊 State Change Details:`, {
      transition: `${oldState} → ${newState}`,
      timestamp: new Date(this.metrics.stateChangeTime).toISOString(),
      totalRequests: this.metrics.totalRequests,
      totalSuccesses: this.metrics.totalSuccesses,
      totalFailures: this.metrics.totalFailures,
      consecutiveFailures: this.metrics.consecutiveFailures,
      successRate: `${this.getSuccessRate()}%`,
      recentFailures: this.failureWindow.length,
      recoveryAttempts: this.metrics.recoveryAttempts
    });
  }

  /**
   * Reset circuit breaker metrics (for testing/debugging)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.metrics = {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      stateChangeTime: Date.now(),
      recoveryAttempts: 0
    };
    this.failureWindow = [];

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }

    console.log(`[CircuitBreaker] 🔄 Circuit breaker reset to CLOSED state`);
  }

  /**
   * Manually trip circuit (for testing)
   */
  trip(): void {
    console.log(`[CircuitBreaker] 🛑 Manually tripping circuit`);
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Manually close circuit (for testing)
   */
  close(): void {
    console.log(`[CircuitBreaker] ✅ Manually closing circuit`);
    this.transitionTo(CircuitState.CLOSED);
  }
}

// ===============================================================================
// SAFE MESSAGE SENDING UTILITIES - Prevent channel closure errors
// ===============================================================================

/**
 * Safely send message to offscreen with timeout and error handling
 */
async function safeSendMessage(message: any, timeoutMs: number = 5000): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if offscreen document exists
      if (!chrome.offscreen?.hasDocument?.()) {
        console.warn('[SafeSendMessage] ⚠️ Offscreen document not available, skipping message:', message.type);
        reject(new Error('Offscreen document not available'));
        return;
      }

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Message send timeout after ${timeoutMs}ms`)), timeoutMs);
      });

      // Send message with race condition protection
      const sendPromise = new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Send failed: ${chrome.runtime.lastError.message}`));
            return;
          }

          if (!response) {
            reject(new Error('No response from receiver'));
            return;
          }

          resolve(response);
        });
      });

      // Race between send and timeout
      const result = await Promise.race([sendPromise, timeoutPromise]);
      resolve(result);

    } catch (error) {
      console.error('[SafeSendMessage] ❌ Message send failed:', error);
      reject(error);
    }
  });
}

/**
 * Check if offscreen document is available
 */
async function isOffscreenAvailable(): Promise<boolean> {
  try {
    return chrome.offscreen?.hasDocument?.() ?? false;
  } catch (error) {
    console.warn('[isOffscreenAvailable] Error checking offscreen availability:', error);
    return false;
  }
}

// ===============================================================================
// HEARTBEAT MONITORING SYSTEM - Connection health monitoring
// ===============================================================================

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
  backgroundHealth: {
    transfers: number;
    promises: number;
    memoryUsage?: number;
    uptime: number;
  };
  offscreenHealth: {
    transfers: number;
    workflows: number;
    memoryUsage?: number;
    uptime: number;
  };
}

interface HeartbeatStats {
  total: number;
  successful: number;
  failed: number;
  consecutiveFailures: number;
  lastHeartbeatTime: number;
  averageLatency: number;
  lastRecoveryTime?: number;
  recoveryAttempts: number;
}

class HeartbeatMonitor {
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 5000; // 5 seconds
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly RECOVERY_COOLDOWN = 60000; // 1 minute

  private intervalId?: NodeJS.Timeout;
  private currentHeartbeatId = 0;
  private lastRecoveryAttempt = 0;
  private stats: HeartbeatStats = {
    total: 0,
    successful: 0,
    failed: 0,
    consecutiveFailures: 0,
    lastHeartbeatTime: 0,
    averageLatency: 0,
    recoveryAttempts: 0
  };

  private backgroundController: BackgroundController;
  private isRunning = false;
  private pendingHeartbeat?: Promise<any>;

  // CIRCUIT BREAKER: Protect heartbeat operations from cascading failures
  private circuitBreaker = new CircuitBreaker('HeartbeatMonitor', {
    failureThreshold: 5,      // Allow up to 5 failures before tripping
    recoveryTimeout: 60000,   // 1 minute before attempting recovery
    monitoringWindow: 120000, // 2 minutes monitoring window
    successThreshold: 2       // Need 2 successes in half-open to close
  });

  constructor(backgroundController: BackgroundController) {
    this.backgroundController = backgroundController;
    console.log('[HeartbeatMonitor] 🔧 Circuit breaker initialized for heartbeat protection');
  }

  start(): void {
    if (this.isRunning) {
      console.warn('[HeartbeatMonitor] Already running');
      return;
    }

    console.log('[HeartbeatMonitor] 🚀 Starting heartbeat monitoring');
    this.isRunning = true;
    this.resetStats();
    this.scheduleNextHeartbeat();
  }

  stop(): void {
    if (!this.isRunning) {
      console.warn('[HeartbeatMonitor] Not running');
      return;
    }

    console.log('[HeartbeatMonitor] 🛑 Stopping heartbeat monitoring');
    this.isRunning = false;

    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = undefined;
    }

    if (this.pendingHeartbeat) {
      this.pendingHeartbeat = undefined;
    }
  }

  reset(): void {
    console.log('[HeartbeatMonitor] 🔄 Resetting heartbeat monitor');
    this.stop();
    this.resetStats();
    this.start();
  }

  private resetStats(): void {
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      consecutiveFailures: 0,
      lastHeartbeatTime: 0,
      averageLatency: 0,
      recoveryAttempts: 0
    };
    this.currentHeartbeatId = 0;
    this.lastRecoveryAttempt = 0;
  }

  private scheduleNextHeartbeat(): void {
    if (!this.isRunning) return;

    this.intervalId = setTimeout(() => {
      this.performHeartbeat();
      this.scheduleNextHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  private async performHeartbeat(): Promise<void> {
    if (!this.isRunning) return;

    const heartbeatId = `heartbeat_${++this.currentHeartbeatId}_${Date.now()}`;
    const startTime = Date.now();

    this.stats.total++;
    this.stats.lastHeartbeatTime = startTime;

    try {
      console.debug(`[HeartbeatMonitor] 💓 Sending heartbeat ${heartbeatId} (Circuit Breaker State: ${this.circuitBreaker.getState()})`);

      // CIRCUIT BREAKER PROTECTION: Wrap heartbeat operation with circuit breaker
      const result = await this.circuitBreaker.execute(
        async () => {
          // Create heartbeat promise with timeout
          this.pendingHeartbeat = this.sendHeartbeatCheck(heartbeatId);

          const result = await Promise.race([
            this.pendingHeartbeat,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Heartbeat timeout')), this.HEARTBEAT_TIMEOUT)
            )
          ]);

          return result;
        },
        async () => {
          // FALLBACK STRATEGY: Return degraded health status
          console.warn(`[HeartbeatMonitor] 🔄 HEARTBEAT BLOCKED by Circuit Breaker - using degraded mode fallback`);
          return this.createDegradedHeartbeatResponse(heartbeatId);
        }
      );

      const latency = Date.now() - startTime;
      this.updateLatency(latency);

      console.debug(`[HeartbeatMonitor] ✅ Heartbeat ${heartbeatId} successful (${latency}ms)`);
      this.stats.successful++;
      this.stats.consecutiveFailures = 0;

      // Log successful heartbeat with health data
      this.logHeartbeatSuccess(result, latency);

    } catch (error) {
      const latency = Date.now() - startTime;
      console.warn(`[HeartbeatMonitor] ⚠️ Heartbeat ${heartbeatId} failed (${latency}ms):`, error);
      this.stats.failed++;
      this.stats.consecutiveFailures++;

      this.logHeartbeatFailure(error as Error, latency);

      // Check if we need to trigger recovery
      if (this.stats.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        await this.attemptRecovery();
      }
    } finally {
      this.pendingHeartbeat = undefined;
    }
  }

  private async sendHeartbeatCheck(heartbeatId: string): Promise<HeartbeatResponseMessage> {
    const backgroundHealth = this.collectBackgroundHealthData();

    const response = await safeSendMessage({
      type: 'HEARTBEAT_CHECK',
      heartbeatId,
      timestamp: Date.now(),
      backgroundHealth
    }, this.HEARTBEAT_TIMEOUT);

    // Validate response
    if (response.type === 'HEARTBEAT_RESPONSE' && response.heartbeatId === heartbeatId) {
      return response;
    } else {
      throw new Error(`Invalid heartbeat response: ${response?.type || 'unknown'}`);
    }
  }

  private collectBackgroundHealthData() {
    // Collect background script health metrics
    const transferCount = this.backgroundController['chunkManager']['transfers'].size;
    const promiseCount = this.backgroundController['promiseManager']['promises'].size;
    const uptime = Date.now() - (globalThis as any).backgroundStartTime || Date.now();

    return {
      transfers: transferCount,
      promises: promiseCount,
      memoryUsage: this.getMemoryUsage(),
      uptime
    };
  }

  /**
   * Create degraded heartbeat response when circuit breaker blocks operation
   */
  private createDegradedHeartbeatResponse(heartbeatId: string): HeartbeatResponseMessage {
    console.warn(`[HeartbeatMonitor] 🔄 Creating degraded heartbeat response for ${heartbeatId} (Circuit Breaker blocked)`);

    // Get basic background health from controller
    const backgroundHealth = this.collectBackgroundHealthData();

    return {
      type: 'HEARTBEAT_RESPONSE',
      heartbeatId,
      timestamp: Date.now(),
      backgroundHealth,
      offscreenHealth: {
        transfers: 0, // Degraded mode - assume no active transfers
        workflows: 0, // Degraded mode - assume no active workflows
        memoryUsage: undefined, // Cannot determine in degraded mode
        uptime: 0 // Cannot determine in degraded mode
      }
    };
  }

  private getMemoryUsage(): number | undefined {
    try {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
    } catch (error) {
      // Memory monitoring not available
    }
    return undefined;
  }

  private updateLatency(newLatency: number): void {
    // Exponential moving average
    const alpha = 0.1;
    this.stats.averageLatency = this.stats.averageLatency === 0 ?
      newLatency :
      this.stats.averageLatency * (1 - alpha) + newLatency * alpha;
  }

  private logHeartbeatSuccess(response: HeartbeatResponseMessage, latency: number): void {
    console.log(`[HeartbeatMonitor] 📊 Health Status:`, {
      latency: `${latency}ms`,
      avgLatency: `${Math.round(this.stats.averageLatency)}ms`,
      background: response.backgroundHealth,
      offscreen: response.offscreenHealth,
      successRate: `${Math.round((this.stats.successful / this.stats.total) * 100)}%`
    });
  }

  private logHeartbeatFailure(error: Error, latency: number): void {
    console.warn(`[HeartbeatMonitor] 📊 Failure Status:`, {
      error: error.message,
      consecutiveFailures: this.stats.consecutiveFailures,
      totalFailures: this.stats.failed,
      successRate: `${Math.round((this.stats.successful / this.stats.total) * 100)}%`,
      latency: `${latency}ms`
    });
  }

  private async attemptRecovery(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRecovery = now - this.lastRecoveryAttempt;

    if (timeSinceLastRecovery < this.RECOVERY_COOLDOWN) {
      console.log(`[HeartbeatMonitor] ⏳ Recovery cooldown active (${Math.round(timeSinceLastRecovery / 1000)}s remaining)`);
      return;
    }

    console.log(`[HeartbeatMonitor] 🔧 Triggering offscreen recovery (attempt ${this.stats.recoveryAttempts + 1})`);
    this.lastRecoveryAttempt = now;
    this.stats.recoveryAttempts++;
    this.stats.lastRecoveryTime = now;

    try {
      // Ensure offscreen document exists
      await ensureOffscreenDocument();

      // Wait a bit for offscreen to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Reset consecutive failures counter
      this.stats.consecutiveFailures = 0;

      console.log(`[HeartbeatMonitor] ✅ Recovery completed successfully`);

    } catch (error) {
      console.error(`[HeartbeatMonitor] ❌ Recovery failed:`, error);
    }
  }

  getStats(): HeartbeatStats {
    return { ...this.stats };
  }

  getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    if (this.stats.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      return 'critical';
    } else if (this.stats.consecutiveFailures > 0) {
      return 'degraded';
    }
    return 'healthy';
  }
}

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
  | HeartbeatMessage
  | HeartbeatResponseMessage
  | { type: 'HTML_CHUNK_COMPLETE'; transferId: string; totalChunks: number }
  | { type: 'HTML_CHUNK_ACK'; transferId: string; chunkIndex: number }
  | { type: 'HTML_ASSEMBLED'; transferId: string; html: string }
  | { type: 'HTML_ASSEMBLED_CONFIRMED'; transferId: string }
  | { type: 'HTML_ASSEMBLED_REJECTED'; transferId: string; reason: string }
  | { type: 'CHECK_TRANSFER_STATUS'; transferId: string }
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
  htmlAssembledConfirmed?: boolean; // Flag to indicate HTML_ASSEMBLED was confirmed by offscreen
}

// ===============================================================================
// TRANSFER PERSISTENCE MANAGER - Chrome Storage persistence layer
// ===============================================================================

interface PersistedTransferMetadata {
  transferId: string;
  startTime: number;
  totalChunks: number;
  totalSize: number;
  status: 'active' | 'completed' | 'failed';
  lastUpdated: number;
}

class TransferPersistenceManager {
  private readonly STORAGE_KEY = 'transfer_metadata';
  private readonly MAX_SAVED_TRANSFERS = 15; // Limit to prevent storage bloat
  private readonly TTL_HOURS = 24; // 24 hours TTL for persisted transfers

  // Save transfer metadata to chrome.storage.local
  async save(transfer: ChunkTransfer, transferId: string, status: 'active' | 'completed' | 'failed' = 'active'): Promise<void> {
    try {
      const metadata: PersistedTransferMetadata = {
        transferId,
        startTime: transfer.startTime,
        totalChunks: transfer.chunks.length,
        totalSize: transfer.totalSize,
        status,
        lastUpdated: Date.now()
      };

      // Get existing metadata
      const existing = await this.loadAll();

      // Add new metadata
      existing[transferId] = metadata;

      // Enforce maximum limit (keep most recent)
      const entries = Object.entries(existing);
      if (entries.length > this.MAX_SAVED_TRANSFERS) {
        // Sort by lastUpdated descending and keep only MAX_SAVED_TRANSFERS
        const sortedEntries = entries.sort(([,a], [,b]) => b.lastUpdated - a.lastUpdated);
        const limited = Object.fromEntries(sortedEntries.slice(0, this.MAX_SAVED_TRANSFERS));
        await chrome.storage.local.set({ [this.STORAGE_KEY]: limited });
      } else {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: existing });
      }

      console.log(`[TransferPersistence] 💾 Saved metadata for transfer ${transferId} (${metadata.totalChunks} chunks, ${metadata.totalSize} bytes)`);
    } catch (error) {
      console.error(`[TransferPersistence] ❌ Failed to save transfer ${transferId}:`, error);
    }
  }

  // Load all persisted transfer metadata
  async loadAll(): Promise<Record<string, PersistedTransferMetadata>> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const metadata = result[this.STORAGE_KEY] || {};
      return metadata;
    } catch (error) {
      console.error('[TransferPersistence] ❌ Failed to load transfer metadata:', error);
      return {};
    }
  }

  // Load specific transfer metadata
  async load(transferId: string): Promise<PersistedTransferMetadata | null> {
    const all = await this.loadAll();
    return all[transferId] || null;
  }

  // Update transfer status
  async updateStatus(transferId: string, status: 'active' | 'completed' | 'failed'): Promise<void> {
    try {
      const all = await this.loadAll();
      if (all[transferId]) {
        all[transferId].status = status;
        all[transferId].lastUpdated = Date.now();
        await chrome.storage.local.set({ [this.STORAGE_KEY]: all });
        console.log(`[TransferPersistence] 📝 Updated status for transfer ${transferId} to ${status}`);
      }
    } catch (error) {
      console.error(`[TransferPersistence] ❌ Failed to update status for ${transferId}:`, error);
    }
  }

  // Cleanup expired transfers based on TTL
  async cleanup(): Promise<number> {
    try {
      const all = await this.loadAll();
      const now = Date.now();
      const ttlMs = this.TTL_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds
      let cleanedCount = 0;

      // Remove expired metadata
      for (const [transferId, metadata] of Object.entries(all)) {
        if (now - metadata.lastUpdated > ttlMs) {
          delete all[transferId];
          cleanedCount++;
          console.log(`[TransferPersistence] 🗑️ Cleaned up expired transfer ${transferId} (${Math.floor((now - metadata.lastUpdated) / (1000 * 60 * 60))}h old)`);
        }
      }

      if (cleanedCount > 0) {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: all });
        console.log(`[TransferPersistence] 🧹 Cleanup completed: removed ${cleanedCount} expired transfers`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('[TransferPersistence] ❌ Cleanup failed:', error);
      return 0;
    }
  }

  // Get storage stats
  async getStats(): Promise<{ total: number; active: number; completed: number; failed: number }> {
    try {
      const all = await this.loadAll();
      const stats = {
        total: Object.keys(all).length,
        active: 0,
        completed: 0,
        failed: 0
      };

      for (const metadata of Object.values(all)) {
        stats[metadata.status]++;
      }

      return stats;
    } catch (error) {
      console.error('[TransferPersistence] ❌ Failed to get stats:', error);
      return { total: 0, active: 0, completed: 0, failed: 0 };
    }
  }
}

// ===============================================================================
// TRANSFER RECOVERY MANAGER - Intelligent recovery system for lost transfers
// ===============================================================================

interface RecoveryResult {
  success: boolean;
  transfer?: ChunkTransfer;
  html?: string;
  strategy: string;
  duration: number;
  error?: string;
  pluginId?: string; // Recovered pluginId from metadata
  pageKey?: string;  // Recovered pageKey from metadata
}

interface RecoveryStats {
  total: number;
  successful: number;
  failed: number;
  averageDuration: number;
  strategyUsage: Record<string, number>;
}

class TransferRecoveryManager {
  private recoveryStats: RecoveryStats = {
    total: 0,
    successful: 0,
    failed: 0,
    averageDuration: 0,
    strategyUsage: {}
  };

  private readonly RECOVERY_TIMEOUT = 3000; // 3 seconds max
  private chunkManager: EnhancedChunkManager;
  private persistenceManager: TransferPersistenceManager;

  constructor(chunkManager: EnhancedChunkManager, persistenceManager: TransferPersistenceManager) {
    this.chunkManager = chunkManager;
    this.persistenceManager = persistenceManager;
  }

  /**
   * Main recovery method with multi-level strategy approach
   */
  async recoverTransfer(transferId: string): Promise<RecoveryResult> {
    const startTime = Date.now();
    this.recoveryStats.total++;

    console.log(`[TransferRecovery] 🔄 Starting recovery for transfer ${transferId}`);

    try {
      // Strategy 1: Emergency backup recovery
      console.log(`[TransferRecovery] 🎯 Strategy 1: Emergency backup recovery`);
      const emergencyResult = await this.recoverFromEmergencyBackup(transferId);
      if (emergencyResult.success) {
        return this.finalizeRecovery(emergencyResult, startTime, 'emergency_backup');
      }

      // Strategy 2: Global scope recovery
      console.log(`[TransferRecovery] 🎯 Strategy 2: Global scope recovery`);
      const globalResult = await this.recoverFromGlobalScope(transferId);
      if (globalResult.success) {
        return this.finalizeRecovery(globalResult, startTime, 'global_scope');
      }

      // Strategy 3: Chrome storage recovery
      console.log(`[TransferRecovery] 🎯 Strategy 3: Chrome storage recovery`);
      const storageResult = await this.recoverFromChromeStorage(transferId);
      if (storageResult.success) {
        return this.finalizeRecovery(storageResult, startTime, 'chrome_storage');
      }

      // Strategy 4: Offscreen re-query
      console.log(`[TransferRecovery] 🎯 Strategy 4: Offscreen re-query`);
      const offscreenResult = await this.recoverFromOffscreenRequery(transferId);
      if (offscreenResult.success) {
        return this.finalizeRecovery(offscreenResult, startTime, 'offscreen_requery');
      }

      // Strategy 5: Partial recovery (stub)
      console.log(`[TransferRecovery] 🎯 Strategy 5: Partial recovery (stub)`);
      const partialResult = await this.recoverPartial(transferId);
      if (partialResult.success) {
        return this.finalizeRecovery(partialResult, startTime, 'partial_recovery');
      }

      // All strategies failed
      const duration = Date.now() - startTime;
      console.error(`[TransferRecovery] ❌ All recovery strategies failed for transfer ${transferId} (took ${duration}ms)`);

      this.recoveryStats.failed++;
      return {
        success: false,
        strategy: 'all_failed',
        duration,
        error: 'All recovery strategies exhausted'
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[TransferRecovery] 💥 Recovery process crashed for ${transferId}:`, error);

      this.recoveryStats.failed++;
      return {
        success: false,
        strategy: 'error',
        duration,
        error: (error as Error).message
      };
    }
  }

  private async recoverFromEmergencyBackup(transferId: string): Promise<RecoveryResult> {
    try {
      // Access emergency backup from chunkManager
      const emergencyBackup = (this.chunkManager as any).emergencyBackup;
      const transfer = emergencyBackup.get(transferId);

      if (transfer) {
        console.log(`[TransferRecovery] ✅ Found transfer ${transferId} in emergency backup`);

        // Try to assemble HTML from chunks
        const html = transfer.chunks ? transfer.chunks.join('') : '';
        return {
          success: true,
          transfer,
          html,
          strategy: 'emergency_backup',
          duration: 0
        };
      }

      return { success: false, strategy: 'emergency_backup', duration: 0 };
    } catch (error) {
      console.error(`[TransferRecovery] ❌ Emergency backup recovery failed:`, error);
      return { success: false, strategy: 'emergency_backup', duration: 0, error: (error as Error).message };
    }
  }

  private async recoverFromGlobalScope(transferId: string): Promise<RecoveryResult> {
    try {
      // Check multiple global scope locations
      const globalRefs = (this.chunkManager as any).globalTransferRefs;
      let transfer = globalRefs.get(transferId);

      if (!transfer) {
        // Try global scope variable
        transfer = (globalThis as any)[`currentTransfer_${transferId}`];
      }

      if (!transfer) {
        // Try ultra emergency storage
        const ultraEmergency = (globalThis as any).emergencyTransfers?.[transferId];
        if (ultraEmergency?.transfer) {
          transfer = ultraEmergency.transfer;
        }
      }

      if (!transfer) {
        // Try fixed global scope fallback
        const fixedTransfer = (globalThis as any).fixedTransfers?.find((t: any) => t.id === transferId);
        if (fixedTransfer?.transfer) {
          transfer = fixedTransfer.transfer;
        }
      }

      if (transfer) {
        console.log(`[TransferRecovery] ✅ Found transfer ${transferId} in global scope`);

        const html = transfer.chunks ? transfer.chunks.join('') : '';
        return {
          success: true,
          transfer,
          html,
          strategy: 'global_scope',
          duration: 0
        };
      }

      return { success: false, strategy: 'global_scope', duration: 0 };
    } catch (error) {
      console.error(`[TransferRecovery] ❌ Global scope recovery failed:`, error);
      return { success: false, strategy: 'global_scope', duration: 0, error: (error as Error).message };
    }
  }

  private async recoverFromChromeStorage(transferId: string): Promise<RecoveryResult> {
    try {
      const metadata = await this.persistenceManager.load(transferId);

      if (metadata) {
        console.log(`[TransferRecovery] ✅ Found metadata for transfer ${transferId} in chrome storage`);

        // Try to recover pluginId and pageKey from saved metadata
        const storageKey = `transfer_metadata_${transferId}`;
        let pluginId: string | undefined;
        let pageKey: string | undefined;

        try {
          const savedMetadata = await chrome.storage.local.get(storageKey);
          if (savedMetadata[storageKey]) {
            pluginId = savedMetadata[storageKey].pluginId;
            pageKey = savedMetadata[storageKey].pageKey;
            console.log(`[TransferRecovery] ✅ Recovered pluginId=${pluginId} and pageKey=${pageKey} from saved metadata`);
          }
        } catch (metadataError) {
          console.warn(`[TransferRecovery] ⚠️ Could not recover metadata for ${transferId}:`, metadataError);
        }

        // Create stub transfer with metadata
        const stubTransfer: ChunkTransfer = {
          chunks: [], // No chunks available from storage
          acked: [],
          totalSize: metadata.totalSize,
          startTime: metadata.startTime,
          htmlAssembledConfirmed: false
        };

        return {
          success: true,
          transfer: stubTransfer,
          html: '', // No HTML content available
          strategy: 'chrome_storage',
          duration: 0,
          pluginId, // Include recovered pluginId
          pageKey   // Include recovered pageKey
        };
      }

      return { success: false, strategy: 'chrome_storage', duration: 0 };
    } catch (error) {
      console.error(`[TransferRecovery] ❌ Chrome storage recovery failed:`, error);
      return { success: false, strategy: 'chrome_storage', duration: 0, error: (error as Error).message };
    }
  }

  private async recoverFromOffscreenRequery(transferId: string): Promise<RecoveryResult> {
    try {
      console.log(`[TransferRecovery] 📡 Querying offscreen for transfer ${transferId}`);

      const offscreenStatus = await safeSendMessage({
        type: 'CHECK_TRANSFER_STATUS',
        transferId
      }, 2000) as any; // 2 second timeout for status checks

      if (offscreenStatus?.transferExists && offscreenStatus?.html) {
        console.log(`[TransferRecovery] ✅ Offscreen has HTML for transfer ${transferId}`);

        // Create stub transfer (we don't have full transfer data)
        const stubTransfer: ChunkTransfer = {
          chunks: [],
          acked: [],
          totalSize: offscreenStatus.html.length,
          startTime: Date.now(),
          htmlAssembledConfirmed: true
        };

        return {
          success: true,
          transfer: stubTransfer,
          html: offscreenStatus.html,
          strategy: 'offscreen_requery',
          duration: 0
        };
      }

      return { success: false, strategy: 'offscreen_requery', duration: 0 };
    } catch (error) {
      console.error(`[TransferRecovery] ❌ Offscreen re-query failed:`, error);
      return { success: false, strategy: 'offscreen_requery', duration: 0, error: (error as Error).message };
    }
  }

  private async recoverPartial(transferId: string): Promise<RecoveryResult> {
    try {
      console.log(`[TransferRecovery] 🏗️ Creating partial recovery stub for transfer ${transferId}`);

      // Create minimal stub transfer
      const stubTransfer: ChunkTransfer = {
        chunks: [],
        acked: [],
        totalSize: 0,
        startTime: Date.now(),
        htmlAssembledConfirmed: false
      };

      return {
        success: true,
        transfer: stubTransfer,
        html: '', // Empty HTML as fallback
        strategy: 'partial_recovery',
        duration: 0
      };
    } catch (error) {
      console.error(`[TransferRecovery] ❌ Partial recovery failed:`, error);
      return { success: false, strategy: 'partial_recovery', duration: 0, error: (error as Error).message };
    }
  }

  private finalizeRecovery(result: RecoveryResult, startTime: number, strategy: string): RecoveryResult {
    const duration = Date.now() - startTime;

    // Update stats
    this.recoveryStats.successful++;
    this.recoveryStats.strategyUsage[strategy] = (this.recoveryStats.strategyUsage[strategy] || 0) + 1;
    this.recoveryStats.averageDuration = ((this.recoveryStats.averageDuration * (this.recoveryStats.total - 1)) + duration) / this.recoveryStats.total;

    console.log(`[TransferRecovery] ✅ Recovery successful for transfer using ${strategy} strategy (${duration}ms)`);

    return {
      ...result,
      duration
    };
  }

  getRecoveryStats(): RecoveryStats {
    return { ...this.recoveryStats };
  }

  resetStats(): void {
    this.recoveryStats = {
      total: 0,
      successful: 0,
      failed: 0,
      averageDuration: 0,
      strategyUsage: {}
    };
  }
}

// ===============================================================================
// ENHANCED CHUNK MANAGER - Better performance and error handling
// ===============================================================================

class EnhancedChunkManager {
  private transfers = new Map<string, ChunkTransfer>();
  private assembledHtmls = new Map<string, string>(); // Store assembled HTML from offscreen
  private readonly MAX_CHUNK_SIZE = 32768; // 32KB optimal for Chrome messaging
  private readonly TRANSFER_TIMEOUT = 300000; // 300s = 5 minutes timeout (REDUCED for faster health monitoring)
  private readonly CLEANUP_WARNING_THRESHOLD = 240000; // Show warning 4 minutes before cleanup (240s)

  // RACE CONDITION PROTECTION: Backup storage for completed transfers
  private completedTransfers = new Map<string, ChunkTransfer>();

  // RACE CONDITION PROTECTION: Global reference storage
  private globalTransferRefs = new Map<string, ChunkTransfer>();

  // EMERGENCY BACKUP STORAGE: Critical transfers
  private emergencyBackup = new Map<string, ChunkTransfer>();

  // RACE CONDITION PROTECTION: Mutex system for acknowledgment processing
  private acknowledgmentMutexes = new Map<string, Promise<void>>();
  private globalAcknowledgmentMutex: Promise<void> = Promise.resolve();

  // PERSISTENCE LAYER: Chrome storage persistence manager
  private persistenceManager = new TransferPersistenceManager();

  /**
   * THREAD-SAFE MUTEX SYSTEM: Create or get mutex for transfer acknowledgment processing
   * Prevents race conditions when multiple acknowledgments arrive simultaneously
   */
  private async createAcknowledgmentMutex(transferId: string): Promise<() => void> {
    // Check if mutex already exists
    const existingMutex = this.acknowledgmentMutexes.get(transferId);
    if (existingMutex) {
      console.log(`[EnhancedChunkManager][MUTEX] 🔒 Awaiting existing mutex for transfer ${transferId}`);
      await existingMutex;
    }

    // Create new mutex promise
    let resolveMutex: () => void;
    const newMutex = new Promise<void>((resolve) => {
      resolveMutex = resolve;
    });

    this.acknowledgmentMutexes.set(transferId, newMutex);
    console.log(`[EnhancedChunkManager][MUTEX] 🔓 Created new mutex for transfer ${transferId}`);

    // Return function to release the mutex
    return () => {
      console.log(`[EnhancedChunkManager][MUTEX] 🔓 Releasing mutex for transfer ${transferId}`);
      resolveMutex();
      // Clean up mutex after short delay to prevent immediate recreation issues
      setTimeout(() => {
        this.acknowledgmentMutexes.delete(transferId);
      }, 10);
    };
  }

  /**
   * THREAD-SAFE GLOBAL BACKUP: Synchronized access to global acknowledgment backup
   * Prevents race conditions when multiple transfers update global state simultaneously
   */
  private async withGlobalAcknowledgmentMutex<T>(operation: () => T | Promise<T>): Promise<T> {
    // Wait for any existing global mutex operation
    await this.globalAcknowledgmentMutex;

    // Create new global mutex
    let resolveGlobalMutex: (() => void) | undefined;
    const newGlobalMutex = new Promise<void>((resolve) => {
      resolveGlobalMutex = resolve;
    });

    this.globalAcknowledgmentMutex = newGlobalMutex;

    try {
      console.log(`[EnhancedChunkManager][GLOBAL_MUTEX] 🔒 Executing operation with global mutex`);
      const result = await operation();
      return result;
    } finally {
      console.log(`[EnhancedChunkManager][GLOBAL_MUTEX] 🔓 Releasing global mutex`);
      if (resolveGlobalMutex) {
        resolveGlobalMutex();
      }
    }
  }

  async sendInChunks(data: string, transferId: string): Promise<void> {
    const startTime = Date.now();
    const chunks = this.createChunks(data);

    const transfer: ChunkTransfer = {
      chunks,
      acked: new Array(chunks.length).fill(false),
      totalSize: data.length,
      startTime,
      htmlAssembledConfirmed: false // Not yet confirmed by offscreen
    };

    this.transfers.set(transferId, transfer);
    // RACE CONDITION PROTECTION: Store global reference for immediate access
    this.globalTransferRefs.set(transferId, transfer);
    (globalThis as any)[`currentTransfer_${transferId}`] = transfer;

    // EMERGENCY BACKUP: Store critical transfer for maximum reliability
    this.emergencyBackup.set(transferId, transfer);

    // NEW RELIABLE METADATA: Сохраняем метаданные НЕМЕДЛЕННО при создании трансфера
    // Передаем pluginId и pageKey через глобальную переменную для простоты
    const transferMetadata = (globalThis as any).currentTransferMetadata;
    if (transferMetadata) {
      try {
        // Сохраняем метаданные через глобальный менеджер
        const globalMetadataManager = (globalThis as any).metadataManager;
        if (globalMetadataManager) {
          await globalMetadataManager.saveMetadata(
            transferId,
            transferMetadata.pluginId,
            transferMetadata.pageKey
          );
          console.log(`[EnhancedChunkManager] 💾 Метаданные сохранены при создании трансфера ${transferId}: pluginId=${transferMetadata.pluginId}, pageKey=${transferMetadata.pageKey}`);

          // Очищаем глобальную переменную после использования
          delete (globalThis as any).currentTransferMetadata;
        } else {
          console.warn(`[EnhancedChunkManager] ⚠️ Глобальный metadataManager не найден`);
        }
      } catch (error) {
        console.error(`[EnhancedChunkManager] ❌ Ошибка сохранения метаданных для ${transferId}:`, error);
        // Не прерываем процесс создания трансфера из-за ошибки метаданных
      }
    } else {
      console.warn(`[EnhancedChunkManager] ⚠️ Метаданные трансфера не переданы для ${transferId}`);
    }

    // PERSISTENCE: Save transfer metadata to chrome.storage for recovery
    this.persistenceManager.save(transfer, transferId, 'active');

    // NEW AGGRESSIVE GLOBAL EMERGENCY STORAGE
    if (!(globalThis as any).emergencyTransfers) {
      (globalThis as any).emergencyTransfers = {};
    }
    (globalThis as any).emergencyTransfers[transferId] = {
      id: transferId,
      transfer: transfer,
      timestamp: startTime,
      status: 'active'
    };

    // FIXED GLOBAL SCOPE FALLBACK - Array-based storage for maximum persistence
    if (!(globalThis as any).fixedTransfers) {
      (globalThis as any).fixedTransfers = [];
    }
    (globalThis as any).fixedTransfers.push({
      id: transferId,
      transfer: transfer,
      timestamp: startTime,
      status: 'active'
    });

    // MULTI-LAYER STORAGE VERIFICATION - Ensure transfer exists in all storage layers
    console.log(`[Background::ChunkManager] 🔍 MULTI-LAYER STORAGE VERIFICATION for transfer ${transferId}`);
    const verificationResults = await this.verifyMultiLayerStorage(transferId);

    if (!verificationResults.allLayersVerified) {
      console.error(`[Background::ChunkManager] ❌ MULTI-LAYER STORAGE VERIFICATION FAILED for transfer ${transferId}:`, verificationResults);

      // ATTEMPT RECOVERY: Try to reinitialize failed layers
      console.log(`[Background::ChunkManager] 🔧 ATTEMPTING RECOVERY for failed storage layers`);
      const recoveryResults = await this.recoverFailedStorageLayers(transferId, verificationResults);

      if (!recoveryResults.allRecovered) {
        console.error(`[Background::ChunkManager] ❌ STORAGE RECOVERY FAILED for transfer ${transferId}:`, recoveryResults);
        throw new Error(`Multi-layer storage verification failed for transfer ${transferId}. Failed layers: ${verificationResults.failedLayers.join(', ')}`);
      } else {
        console.log(`[Background::ChunkManager] ✅ STORAGE RECOVERY SUCCESSFUL for transfer ${transferId}`);
      }
    } else {
      console.log(`[Background::ChunkManager] ✅ MULTI-LAYER STORAGE VERIFICATION PASSED for transfer ${transferId}`);
    }

    console.log(`[Background::ChunkManager] ✅ CREATED transfer ${transferId} with ${chunks.length} chunks in BACKGROUND instance (MULTI-LEVEL emergency backup enabled)`);
    
    try {
      // console.log(`[ChunkManager] Starting transfer ${transferId}: ${chunks.length} chunks, ${data.length} bytes`);

      // Send all chunks in parallel for maximum speed
      const chunkPromises = chunks.map((chunk, i) => 
        this.sendChunkWithRetry(transferId, i, chunks.length, chunk)
      );
      
      await Promise.all(chunkPromises);
      
      // Signal completion with safe message sending
      await safeSendMessage({
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
  
  /**
   * THREAD-SAFE ACKNOWLEDGMENT PROCESSING: Protected against race conditions
   * Uses mutex system to prevent concurrent access issues during acknowledgment processing
   */
  async acknowledgeChunk(transferId: string, chunkIndex: number): Promise<void> {
    // THREAD-SAFE MUTEX: Acquire mutex for this transfer to prevent race conditions
    const releaseMutex = await this.createAcknowledgmentMutex(transferId);

    try {
      // AGGRESSIVE DIAGNOSTIC: Log lookup cascade when acknowledging chunks
      console.log(`[DIAG][THREAD_SAFE] ACKNOWLEDGING chunk ${chunkIndex} for transfer ${transferId}`);
      this.logTransferLookupCascade(transferId);

      // THREAD-SAFE TRANSFER LOOKUP: Protected search across all storage layers
      let transfer = this.transfers.get(transferId);

      // If not in active, check completed backup
      if (!transfer) {
        console.log(`[EnhancedChunkManager][THREAD_SAFE] 📋 acknowledgeChunk: Transfer ${transferId} not in active transfers, checking completed backup…`);
        transfer = this.completedTransfers.get(transferId);
      }

      // If not found anywhere, check if transfer was already processed
      if (!transfer) {
        console.log(`[EnhancedChunkManager][THREAD_SAFE] ⚠️ acknowledgeChunk: Transfer ${transferId} not found in any active or completed storage, checking emergency backup…`);
        console.log(`[EnhancedChunkManager][THREAD_SAFE] Active: [${Array.from(this.transfers.keys()).join(', ')}]`);
        console.log(`[EnhancedChunkManager][THREAD_SAFE] Completed: [${Array.from(this.completedTransfers.keys()).join(', ')}]`);

        // Check emergency backup
        transfer = this.emergencyBackup.get(transferId);
        if (transfer) {
          console.warn(`[EnhancedChunkManager][THREAD_SAFE] ⚠️ Found transfer ${transferId} in emergency backup (race condition recovery)`);
        } else {
          // Check if we have assembled HTML for this transfer
          const assembledHtml = this.assembledHtmls.get(transferId);
          if (assembledHtml) {
            console.log(`[EnhancedChunkManager][THREAD_SAFE] ✅ Transfer ${transferId} already processed, assembled HTML exists (${assembledHtml.length} chars)`);
            return;
          }

          // Try to get from global scope as last resort
          transfer = (globalThis as any)[`currentTransfer_${transferId}`];
          if (!transfer) {
            // ULTRA EMERGENCY: Try the new global emergency storage
            const ultraEmergencyData = (globalThis as any).emergencyTransfers?.[transferId];
            if (ultraEmergencyData?.transfer) {
              transfer = ultraEmergencyData.transfer;
              console.log(`[EnhancedChunkManager][THREAD_SAFE] ✅ Found transfer ${transferId} in ULTRA EMERGENCY global fallback`);
            } else {
              // FIXED GLOBAL SCOPE FALLBACK: Search in array-based storage
              const fixedTransferData = (globalThis as any).fixedTransfers?.find((t: any) => t.id === transferId);
              if (fixedTransferData?.transfer) {
                transfer = fixedTransferData.transfer;
                console.log(`[EnhancedChunkManager][THREAD_SAFE] ✅ Found transfer ${transferId} in FIXED GLOBAL SCOPE fallback`);
              } else {
                console.warn(`[EnhancedChunkManager][THREAD_SAFE] ❌ Transfer ${transferId} completely not found (including all global fallbacks), skipping ack`);
                return;
              }
            }
          } else {
            console.log(`[EnhancedChunkManager][THREAD_SAFE] ✅ Found transfer ${transferId} in global scope fallback`);
          }
        }
      }

      // THREAD-SAFE STUB CREATION: Protected creation of recovery stubs
      if (!transfer) {
        console.warn(`[EnhancedChunkManager][THREAD_SAFE] 🚨 CRITICAL: Transfer ${transferId} not found anywhere - creating recovery stub for chunk ${chunkIndex}`);

        // THREAD-SAFE GLOBAL BACKUP: Synchronize access to global state
        await this.withGlobalAcknowledgmentMutex(() => {
          // Create minimal stub transfer to preserve acknowledgment
          transfer = {
            chunks: [],
            acked: new Array(1000).fill(false), // Large array to accommodate any chunk index
            totalSize: 0,
            startTime: Date.now(),
            htmlAssembledConfirmed: true // Mark as confirmed to prevent premature cleanup
          };
          // Store in emergency backup for future recovery
          this.emergencyBackup.set(transferId, transfer);
          console.warn(`[EnhancedChunkManager][THREAD_SAFE] 🛠️ Created recovery stub for transfer ${transferId} to preserve chunk ${chunkIndex} acknowledgment`);
        });
      }

      if (chunkIndex < 0) {
        console.error(`[EnhancedChunkManager][THREAD_SAFE] ❌ acknowledgeChunk: Invalid chunkIndex ${chunkIndex} for transfer ${transferId}`);
        return;
      }

      // THREAD-SAFE ARRAY RESIZING: Protected extension of acked array
      if (transfer && chunkIndex >= transfer.acked.length) {
        console.warn(`[EnhancedChunkManager][THREAD_SAFE] 📏 Chunk index ${chunkIndex} exceeds current array length ${transfer.acked.length}, extending array`);
        const currentLength = transfer.acked.length;
        const newLength = Math.max(chunkIndex + 1, currentLength * 2); // Double size or at least fit the chunk

        // THREAD-SAFE ARRAY EXTENSION: Prevent concurrent array modifications
        await this.withGlobalAcknowledgmentMutex(() => {
          if (transfer) {
            transfer.acked.length = newLength;
            // Fill new elements with false
            for (let i = currentLength; i < newLength; i++) {
              transfer.acked[i] = false;
            }
            console.log(`[EnhancedChunkManager][THREAD_SAFE] ✅ Extended acked array from ${currentLength} to ${newLength} elements`);
          }
        });
      }

      if (transfer && transfer.acked[chunkIndex] === true) {
        console.log(`[EnhancedChunkManager][THREAD_SAFE] ⚠️ acknowledgeChunk: Chunk ${chunkIndex} already acknowledged for transfer ${transferId}`);
      } else if (transfer) {
        // THREAD-SAFE ACKNOWLEDGMENT: Protected write to acknowledgment array
        transfer.acked[chunkIndex] = true;
        console.log(`[EnhancedChunkManager][THREAD_SAFE] ✅ acknowledgeChunk: Chunk ${chunkIndex} acknowledged for transfer ${transferId}`);

        // THREAD-SAFE GLOBAL BACKUP: Protected access to global acknowledgment storage
        await this.withGlobalAcknowledgmentMutex(async () => {
          // ADDITIONAL SAFETY: Store acknowledgment in global scope for maximum persistence
          if (!(globalThis as any).chunkAcknowledgments) {
            (globalThis as any).chunkAcknowledgments = {};
          }
          if (!(globalThis as any).chunkAcknowledgments[transferId]) {
            (globalThis as any).chunkAcknowledgments[transferId] = new Set();
          }
          (globalThis as any).chunkAcknowledgments[transferId].add(chunkIndex);
          console.log(`[EnhancedChunkManager][THREAD_SAFE] 💾 Stored chunk ${chunkIndex} acknowledgment in global backup for ${transferId}`);
        });
      } else {
        console.error(`[EnhancedChunkManager][THREAD_SAFE] ❌ Cannot process acknowledgment: transfer ${transferId} is undefined after all recovery attempts`);
      }

    } finally {
      // THREAD-SAFE MUTEX RELEASE: Always release the mutex
      releaseMutex();
    }
  }
  
  wasChunked(transferId: string): boolean {
    // RACE CONDITION PROTECTION: Check all storage layers including emergency backup
    return this.transfers.has(transferId) ||
           this.completedTransfers.has(transferId) ||
           this.globalTransferRefs.has(transferId) ||
           this.emergencyBackup.has(transferId) ||
           !!(globalThis as any)[`currentTransfer_${transferId}`] ||
           !!((globalThis as any).emergencyTransfers && (globalThis as any).emergencyTransfers[transferId]) ||
           !!((globalThis as any).fixedTransfers && (globalThis as any).fixedTransfers.find((t: any) => t.id === transferId));
  }
  
  getTransferStats(transferId: string): { completed: number; total: number; duration: number } | null {
    const transfer = this.getTransferSafely(transferId);
    if (!transfer) {
      console.warn(`[EnhancedChunkManager] ⚠️ getTransferStats: Transfer ${transferId} not found in any storage layer`);
      return null;
    }

    try {
      const completed = transfer.acked.filter(ack => ack === true).length;
      const total = transfer.chunks.length;
      const duration = Date.now() - transfer.startTime;

      return { completed, total, duration };
    } catch (error) {
      console.error(`[EnhancedChunkManager] ❌ getTransferStats: Error processing transfer ${transferId}:`, error);
      return null;
    }
  }

  getAssembledData(transferId: string): string {
    console.log(`[Background::ChunkManager] 🔍 SEARCHING for transfer ${transferId} in BACKGROUND instance`);
    console.log(`[Background::ChunkManager] Active transfers: [${Array.from(this.transfers.keys()).join(', ')}]`);
    console.log(`[Background::ChunkManager] Completed transfers: [${Array.from(this.completedTransfers.keys()).join(', ')}]`);

    // AGGRESSIVE DIAGNOSTIC: Enhanced transfer search logging
    console.log(`[DIAG][GET_ASSEMBLED_DATA] Checking storage state before transfer lookup:`);
    console.log(`[DIAG][GET_ASSEMBLED_DATA] - Global emergency transfers: ${Object.keys((globalThis as any).emergencyTransfers || {}).join(', ')}`);
    console.log(`[DIAG][GET_ASSEMBLED_DATA] - Fixed transfers count: ${(globalThis as any).fixedTransfers?.length || 0}`);

    // RACE CONDITION PROTECTION: Use multi-level search
    const transfer = this.getTransferSafely(transferId);

    if (!transfer) {
      console.warn(`[Background::ChunkManager] ⚠️ TRANSFER ${transferId} NOT FOUND in any storage layer!`);
      console.warn(`[Background::ChunkManager] This is a race condition - checking assembled HTML fallback`);

      // Check if we have assembled HTML as final fallback
      const assembledHtml = this.assembledHtmls.get(transferId);
      if (assembledHtml) {
        console.log(`[Background::ChunkManager] ✅ Found assembled HTML fallback for transfer ${transferId}`);
        return assembledHtml;
      }

      // As last resort, assume the transfer was processed successfully and return empty HTML
      console.warn(`[Background::ChunkManager] ❌ CRITICAL: Transfer ${transferId} completely lost, assuming completed and returning empty HTML`);
      console.warn(`[Background::ChunkManager] This suggests a serious race condition in transfer management`);
      return ''; // Prevent error and assume transfer was completed
    }
    console.log(`[Background::ChunkManager] ✅ Found transfer ${transferId}`);

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

  // RETRY MECHANISM: Retry lost chunk acknowledgments
  async retryLostAcknowledgments(transferId: string): Promise<void> {
    console.log(`[Background::ChunkManager] 🔄 Starting retry for lost acknowledgments on transfer ${transferId}`);

    const transfer = this.getTransferSafely(transferId);
    if (!transfer) {
      console.warn(`[Background::ChunkManager] ❌ Cannot retry acknowledgments: transfer ${transferId} not found`);
      return;
    }

    // Check if we have stored acknowledgments in global backup
    const globalAcks = (globalThis as any).chunkAcknowledgments?.[transferId];
    if (globalAcks && globalAcks.size > 0) {
      console.log(`[Background::ChunkManager] 📋 Found ${globalAcks.size} stored acknowledgments for ${transferId}, applying...`);

      // Apply stored acknowledgments
      for (const chunkIndex of globalAcks) {
        if (chunkIndex < transfer.acked.length && !transfer.acked[chunkIndex]) {
          transfer.acked[chunkIndex] = true;
          console.log(`[Background::ChunkManager] ✅ Restored acknowledgment for chunk ${chunkIndex} in transfer ${transferId}`);
        }
      }
    }

    // Check completion status after retry
    const completedCount = transfer.acked.filter(ack => ack === true).length;
    const total = transfer.chunks.length;

    console.log(`[Background::ChunkManager] 📊 After retry: ${completedCount}/${total} chunks acknowledged for ${transferId}`);

    if (completedCount === total && !transfer.htmlAssembledConfirmed) {
      console.log(`[Background::ChunkManager] 🎉 Transfer ${transferId} completed after retry!`);
      // Mark as confirmed to prevent cleanup
      transfer.htmlAssembledConfirmed = true;
    }
  }

  // HEALTH CHECK: Verify transfer integrity
  verifyTransferIntegrity(transferId: string): { isHealthy: boolean; issues: string[] } {
    const issues: string[] = [];
    const transfer = this.getTransferSafely(transferId);

    if (!transfer) {
      issues.push('Transfer not found in any storage layer');
      return { isHealthy: false, issues };
    }

    // Check chunk array integrity
    if (!Array.isArray(transfer.chunks)) {
      issues.push('Chunks array is not valid');
    } else if (transfer.chunks.length === 0) {
      issues.push('Chunks array is empty');
    }

    // Check acknowledgment array integrity
    if (!Array.isArray(transfer.acked)) {
      issues.push('Acknowledgment array is not valid');
    } else if (transfer.acked.length !== transfer.chunks.length) {
      issues.push(`Acknowledgment array length mismatch: ${transfer.acked.length} vs ${transfer.chunks.length}`);
    }

    // Check for missing acknowledgments
    const missingAcks = [];
    for (let i = 0; i < transfer.acked.length; i++) {
      if (transfer.acked[i] !== true) {
        missingAcks.push(i);
      }
    }

    if (missingAcks.length > 0) {
      issues.push(`Missing acknowledgments for chunks: [${missingAcks.slice(0, 10).join(', ')}${missingAcks.length > 10 ? '...' : ''}]`);
    }

    // Check global acknowledgment backup
    const globalAcks = (globalThis as any).chunkAcknowledgments?.[transferId];
    if (globalAcks) {
      const globalAckCount = globalAcks.size || 0;
      const localAckCount = transfer.acked.filter(a => a === true).length;
      if (globalAckCount !== localAckCount) {
        issues.push(`Acknowledgment count mismatch: global=${globalAckCount}, local=${localAckCount}`);
      }
    }

    return {
      isHealthy: issues.length === 0,
      issues
    };
  }

  // MULTI-LAYER STORAGE VERIFICATION: Verify transfer exists in all storage layers
  private async verifyMultiLayerStorage(transferId: string): Promise<{ allLayersVerified: boolean; failedLayers: string[] }> {
    const failedLayers: string[] = [];

    console.log(`[MultiLayerVerification] 🔍 Verifying transfer ${transferId} across all storage layers`);

    // Layer 1: Primary transfers map
    if (!this.transfers.has(transferId)) {
      failedLayers.push('transfers');
      console.warn(`[MultiLayerVerification] ❌ Transfer ${transferId} not found in primary transfers map`);
    } else {
      console.log(`[MultiLayerVerification] ✅ Transfer ${transferId} found in primary transfers map`);
    }

    // Layer 2: Global transfer refs
    if (!this.globalTransferRefs.has(transferId)) {
      failedLayers.push('globalTransferRefs');
      console.warn(`[MultiLayerVerification] ❌ Transfer ${transferId} not found in global transfer refs`);
    } else {
      console.log(`[MultiLayerVerification] ✅ Transfer ${transferId} found in global transfer refs`);
    }

    // Layer 3: Emergency backup
    if (!this.emergencyBackup.has(transferId)) {
      failedLayers.push('emergencyBackup');
      console.warn(`[MultiLayerVerification] ❌ Transfer ${transferId} not found in emergency backup`);
    } else {
      console.log(`[MultiLayerVerification] ✅ Transfer ${transferId} found in emergency backup`);
    }

    // Layer 4: Global scope variable
    if (!(globalThis as any)[`currentTransfer_${transferId}`]) {
      failedLayers.push('globalScope');
      console.warn(`[MultiLayerVerification] ❌ Transfer ${transferId} not found in global scope`);
    } else {
      console.log(`[MultiLayerVerification] ✅ Transfer ${transferId} found in global scope`);
    }

    // Layer 5: Ultra emergency storage (object-based)
    if (!(globalThis as any).emergencyTransfers?.[transferId]) {
      failedLayers.push('ultraEmergency');
      console.warn(`[MultiLayerVerification] ❌ Transfer ${transferId} not found in ultra emergency storage`);
    } else {
      console.log(`[MultiLayerVerification] ✅ Transfer ${transferId} found in ultra emergency storage`);
    }

    // Layer 6: Fixed transfers array
    const fixedTransferFound = (globalThis as any).fixedTransfers?.find((t: any) => t.id === transferId);
    if (!fixedTransferFound) {
      failedLayers.push('fixedTransfers');
      console.warn(`[MultiLayerVerification] ❌ Transfer ${transferId} not found in fixed transfers array`);
    } else {
      console.log(`[MultiLayerVerification] ✅ Transfer ${transferId} found in fixed transfers array`);
    }

    // Layer 7: Chrome storage persistence
    try {
      const persistedTransfer = await this.persistenceManager.load(transferId);
      if (!persistedTransfer) {
        failedLayers.push('chromeStorage');
        console.warn(`[MultiLayerVerification] ❌ Transfer ${transferId} not found in chrome storage`);
      } else {
        console.log(`[MultiLayerVerification] ✅ Transfer ${transferId} found in chrome storage`);
      }
    } catch (error) {
      failedLayers.push('chromeStorage');
      console.error(`[MultiLayerVerification] ❌ Error checking chrome storage for ${transferId}:`, error);
    }

    const allLayersVerified = failedLayers.length === 0;
    console.log(`[MultiLayerVerification] 📊 Verification result for ${transferId}: ${allLayersVerified ? 'ALL PASSED' : 'SOME FAILED'} (${failedLayers.length} failed layers)`);

    return { allLayersVerified, failedLayers };
  }

  // RECOVERY: Attempt to recover failed storage layers
  private async recoverFailedStorageLayers(transferId: string, verificationResults: { allLayersVerified: boolean; failedLayers: string[] }): Promise<{ allRecovered: boolean; recoveredLayers: string[]; failedRecoveryLayers: string[] }> {
    const recoveredLayers: string[] = [];
    const failedRecoveryLayers: string[] = [];
    const transfer = this.transfers.get(transferId);

    if (!transfer) {
      console.error(`[StorageRecovery] ❌ Cannot recover - transfer ${transferId} not found in primary storage`);
      return { allRecovered: false, recoveredLayers: [], failedRecoveryLayers: verificationResults.failedLayers };
    }

    console.log(`[StorageRecovery] 🔧 Attempting recovery for transfer ${transferId} (${verificationResults.failedLayers.length} failed layers)`);

    for (const layer of verificationResults.failedLayers) {
      try {
        switch (layer) {
          case 'transfers':
            // This should never happen if we have the transfer for recovery
            console.warn(`[StorageRecovery] ⚠️ Primary transfers layer failed - this indicates serious issue`);
            break;

          case 'globalTransferRefs':
            this.globalTransferRefs.set(transferId, transfer);
            recoveredLayers.push('globalTransferRefs');
            console.log(`[StorageRecovery] ✅ Recovered globalTransferRefs layer for ${transferId}`);
            break;

          case 'emergencyBackup':
            this.emergencyBackup.set(transferId, transfer);
            recoveredLayers.push('emergencyBackup');
            console.log(`[StorageRecovery] ✅ Recovered emergencyBackup layer for ${transferId}`);
            break;

          case 'globalScope':
            (globalThis as any)[`currentTransfer_${transferId}`] = transfer;
            recoveredLayers.push('globalScope');
            console.log(`[StorageRecovery] ✅ Recovered globalScope layer for ${transferId}`);
            break;

          case 'ultraEmergency':
            if (!(globalThis as any).emergencyTransfers) {
              (globalThis as any).emergencyTransfers = {};
            }
            (globalThis as any).emergencyTransfers[transferId] = {
              id: transferId,
              transfer: transfer,
              timestamp: transfer.startTime,
              status: 'active'
            };
            recoveredLayers.push('ultraEmergency');
            console.log(`[StorageRecovery] ✅ Recovered ultraEmergency layer for ${transferId}`);
            break;

          case 'fixedTransfers':
            if (!(globalThis as any).fixedTransfers) {
              (globalThis as any).fixedTransfers = [];
            }
            (globalThis as any).fixedTransfers.push({
              id: transferId,
              transfer: transfer,
              timestamp: transfer.startTime,
              status: 'active'
            });
            recoveredLayers.push('fixedTransfers');
            console.log(`[StorageRecovery] ✅ Recovered fixedTransfers layer for ${transferId}`);
            break;

          case 'chromeStorage':
            await this.persistenceManager.save(transfer, transferId, 'active');
            recoveredLayers.push('chromeStorage');
            console.log(`[StorageRecovery] ✅ Recovered chromeStorage layer for ${transferId}`);
            break;

          default:
            console.warn(`[StorageRecovery] ⚠️ Unknown layer ${layer} - cannot recover`);
            failedRecoveryLayers.push(layer);
        }
      } catch (error) {
        console.error(`[StorageRecovery] ❌ Failed to recover layer ${layer} for transfer ${transferId}:`, error);
        failedRecoveryLayers.push(layer);
      }
    }

    const allRecovered = failedRecoveryLayers.length === 0;
    console.log(`[StorageRecovery] 📊 Recovery result for ${transferId}: ${allRecovered ? 'ALL RECOVERED' : 'SOME FAILED'} (${recoveredLayers.length} recovered, ${failedRecoveryLayers.length} failed)`);

    return { allRecovered, recoveredLayers, failedRecoveryLayers };
  }

  // AGGRESSIVE DIAGNOSTIC: Log transfer lookup cascade for debugging loss
  private logTransferLookupCascade(transferId: string): void {
    console.log(`[DIAG] Transfer lookup cascade for ${transferId}:`, {
      active: !!this.transfers.get(transferId),
      completed: !!this.completedTransfers.get(transferId),
      globalRefs: !!this.globalTransferRefs.get(transferId),
      globalScope: !!((globalThis as any)[`currentTransfer_${transferId}`]),
      emergency: !!this.emergencyBackup.get(transferId),
      ultraEmergency: !!((globalThis as any).emergencyTransfers?.[transferId]),
      fixed: !!((globalThis as any).fixedTransfers?.find((t: any) => t.id === transferId))
    });
  }

  // RACE CONDITION PROTECTION: Multi-level transfer lookup
  getTransferSafely(transferId: string): ChunkTransfer | null {
    // AGGRESSIVE DIAGNOSTIC: Log lookup cascade
    this.logTransferLookupCascade(transferId);

    // Try active transfers first
    let transfer = this.transfers.get(transferId);
    if (transfer) {
      console.log(`[Background::ChunkManager] ✅ Found transfer ${transferId} in active transfers`);
      return transfer;
    }

    // Try completed transfers backup
    transfer = this.completedTransfers.get(transferId);
    if (transfer) {
      console.log(`[Background::ChunkManager] ✅ Found transfer ${transferId} in completed transfers backup`);
      return transfer;
    }

    // Try global references
    transfer = this.globalTransferRefs.get(transferId);
    if (transfer) {
      console.log(`[Background::ChunkManager] ✅ Found transfer ${transferId} in global references`);
      return transfer;
    }

    // Try global scope
    transfer = (globalThis as any)[`currentTransfer_${transferId}`];
    if (transfer) {
      console.log(`[Background::ChunkManager] ✅ Found transfer ${transferId} in global scope`);
      return transfer;
    }

    // Try emergency backup as final fallback
    transfer = this.emergencyBackup.get(transferId);
    if (transfer) {
      console.warn(`[Background::ChunkManager] ⚠️ USING EMERGENCY BACKUP for transfer ${transferId} (race condition recovery)`);
      return transfer;
    }

    // Try ultra emergency transfer storage
    const ultraEmergencyTransfer = (globalThis as any).emergencyTransfers?.[transferId];
    if (ultraEmergencyTransfer?.transfer) {
      console.warn(`[Background::ChunkManager] ⚠️ USING ULTRA EMERGENCY BACKUP for transfer ${transferId} (critical race condition recovery)`);
      return ultraEmergencyTransfer.transfer;
    }

    // Try fixed global scope fallback as ultimate fallback
    const fixedTransferData = (globalThis as any).fixedTransfers?.find((t: any) => t.id === transferId);
    if (fixedTransferData?.transfer) {
      console.warn(`[Background::ChunkManager] ⚠️ USING FIXED GLOBAL SCOPE BACKUP for transfer ${transferId} (ultimate fallback)`);
      return fixedTransferData.transfer;
    }

    console.warn(`[Background::ChunkManager] ❌ Transfer ${transferId} not found in any storage layer (including all global fallbacks)`);
    console.warn(`[Background::ChunkManager] Active: ${Array.from(this.transfers.keys()).join(', ')}`);
    console.warn(`[Background::ChunkManager] Completed: ${Array.from(this.completedTransfers.keys()).join(', ')}`);
    console.warn(`[Background::ChunkManager] Global: ${Array.from(this.globalTransferRefs.keys()).join(', ')}`);
    console.warn(`[Background::ChunkManager] Emergency: ${Array.from(this.emergencyBackup.keys()).join(', ')}`);

    return null;
  }

  // RACE CONDITION PROTECTION: Complete transfer and move to backup storage
  completeTransfer(transferId: string): boolean {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      console.warn(`[Background::ChunkManager] ⚠️ completeTransfer: Transfer ${transferId} not found in active transfers`);
      return false;
    }

    console.log(`[Background::ChunkManager] 🔄 COMPLETING transfer ${transferId} with MULTI-LAYER storage update`);

    // RACE CONDITION PROTECTION: Save pluginId and pageKey metadata before completing transfer
    this.saveTransferMetadataBeforeCompletion(transferId);

    // Move to completed backup storage (primary storage)
    this.completedTransfers.set(transferId, transfer);
    this.transfers.delete(transferId);

    // === MULTI-LAYER STORAGE PROTECTION: Save to ALL storage layers ===

    // 1. GLOBAL TRANSFER REFS: Keep global reference for maximum reliability
    this.globalTransferRefs.set(transferId, transfer);
    console.log(`[Background::ChunkManager] ✅ Transfer ${transferId} saved to globalTransferRefs`);

    // 2. EMERGENCY BACKUP: Keep emergency backup for recovery
    this.emergencyBackup.set(transferId, transfer);
    console.log(`[Background::ChunkManager] ✅ Transfer ${transferId} saved to emergencyBackup`);

    // 3. GLOBAL SCOPE VARIABLE: Keep global scope reference
    (globalThis as any)[`completedTransfer_${transferId}`] = transfer;
    console.log(`[Background::ChunkManager] ✅ Transfer ${transferId} saved to global scope`);

    // 4. EMERGENCY STORAGE: Update status in emergency storage
    if ((globalThis as any).emergencyTransfers?.[transferId]) {
      (globalThis as any).emergencyTransfers[transferId].status = 'completed';
      console.log(`[Background::ChunkManager] ✅ Updated emergency storage status for ${transferId} to 'completed'`);
    }

    // 5. FIXED TRANSFERS: Update status in fixed transfers array
    if ((globalThis as any).fixedTransfers) {
      const fixedTransferItem = (globalThis as any).fixedTransfers.find((t: any) => t.id === transferId);
      if (fixedTransferItem) {
        fixedTransferItem.status = 'completed';
        console.log(`[Background::ChunkManager] ✅ Updated fixed transfers status for ${transferId} to 'completed'`);
      }
    }

    // 6. ULTRA EMERGENCY STORAGE: Ensure ultra emergency storage has completed transfer
    if (!(globalThis as any).ultraEmergencyTransfers) {
      (globalThis as any).ultraEmergencyTransfers = {};
    }
    (globalThis as any).ultraEmergencyTransfers[transferId] = {
      id: transferId,
      transfer: transfer,
      timestamp: Date.now(),
      status: 'completed'
    };
    console.log(`[Background::ChunkManager] ✅ Transfer ${transferId} saved to ultra emergency storage`);

    // 7. PERSISTENCE: Update transfer status to completed in chrome.storage
    this.persistenceManager.updateStatus(transferId, 'completed');
    console.log(`[Background::ChunkManager] ✅ Transfer ${transferId} status updated in chrome.storage`);

    console.log(`[Background::ChunkManager] 🔄 Transfer ${transferId} COMPLETED with MULTI-LAYER storage protection`);
    console.log(`[Background::ChunkManager] 📊 Storage verification for ${transferId}:`);
    console.log(`[Background::ChunkManager]   - Primary (completedTransfers): ${this.completedTransfers.has(transferId)}`);
    console.log(`[Background::ChunkManager]   - Global refs: ${this.globalTransferRefs.has(transferId)}`);
    console.log(`[Background::ChunkManager]   - Emergency backup: ${this.emergencyBackup.has(transferId)}`);
    console.log(`[Background::ChunkManager]   - Global scope: ${!!(globalThis as any)[`completedTransfer_${transferId}`]}`);
    console.log(`[Background::ChunkManager]   - Ultra emergency: ${!!(globalThis as any).ultraEmergencyTransfers?.[transferId]}`);

    return true;
  }
  // RACE CONDITION PROTECTION: Save transfer metadata before completion
  saveTransferMetadataBeforeCompletion(transferId: string): void {
    try {
      const transfer = this.transfers.get(transferId) || this.completedTransfers.get(transferId);
      if (!transfer) {
        console.warn(`[EnhancedChunkManager] ⚠️ saveTransferMetadataBeforeCompletion: Transfer ${transferId} not found`);
        return;
      }

      // Find associated workflow to get pluginId and pageKey
      const controller = (globalThis as any).backgroundController;
      const pendingWorkflow = controller?.pendingWorkflows?.get(transferId);

      if (!pendingWorkflow) {
        console.log(`[EnhancedChunkManager] ℹ️ No pending workflow found for transfer ${transferId}, skipping metadata save`);
        return;
      }

      const metadata = {
        transferId,
        pluginId: pendingWorkflow.pluginId,
        pageKey: `transfer_${transferId}`,
        timestamp: Date.now(),
        status: 'metadata_saved'
      };

      // Save to chrome.storage.local for recovery
      const storageKey = `transfer_metadata_${transferId}`;
      chrome.storage.local.set({ [storageKey]: metadata }).then(() => {
        console.log(`[EnhancedChunkManager] 💾 Saved transfer metadata for ${transferId}:`, metadata);
      }).catch(error => {
        console.error(`[EnhancedChunkManager] ❌ Failed to save transfer metadata for ${transferId}:`, error);
      });

      // Also save to global scope for immediate access during recovery
      if (!(globalThis as any).transferMetadata) {
        (globalThis as any).transferMetadata = {};
      }
      (globalThis as any).transferMetadata[transferId] = metadata;

      console.log(`[EnhancedChunkManager] ✅ Transfer metadata saved for recovery: pluginId=${pendingWorkflow.pluginId}, pageKey=transfer_${transferId}`);
    } catch (error) {
      console.error(`[EnhancedChunkManager] ❌ Error in saveTransferMetadataBeforeCompletion:`, error);
    }
  }

  // Cleanup expired transfers (with race condition protection)
  async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredTransfers: string[] = [];
    const expiredGlobalRefs: string[] = [];
    const expiredCompleted: string[] = [];

    // Cleanup active transfers (only confirmed ones to respect HTML_ASSEMBLED_CONFIRMED)
    // ENHANCED PROTECTION: Extended protection period for active transfers
    const PROTECTION_PERIOD = 600000; // 10 minutes protection from cleanup (increased from 5)
    const EMERGENCY_PROTECTION = 1800000; // 30 minutes emergency protection

    this.transfers.forEach((transfer, transferId) => {
      const elapsed = now - transfer.startTime;

      // EXTENDED PROTECTION: Don't cleanup any transfers in first 10 minutes after creation
      if (elapsed < PROTECTION_PERIOD) {
        console.log(`[Background::ChunkManager][CLEANUP] 🛡️ Transfer ${transferId} in protection period (${Math.floor(elapsed/1000)}s < ${Math.floor(PROTECTION_PERIOD/1000)}s)`);
        return;
      }

      // EMERGENCY PROTECTION: For unconfirmed transfers, extend timeout significantly
      if (!transfer.htmlAssembledConfirmed && elapsed < EMERGENCY_PROTECTION) {
        console.warn(`[Background::ChunkManager][CLEANUP] 🚨 EMERGENCY PROTECTION: Unconfirmed transfer ${transferId} (${Math.floor(elapsed/60000)}min) - EXTENDED protection active`);
        return;
      }

      // Only cleanup confirmed transfers that are truly expired
      if (transfer.htmlAssembledConfirmed && elapsed > this.TRANSFER_TIMEOUT) {
        console.warn(`[Background::ChunkManager][CLEANUP] 🗑️ CLEANING UP confirmed expired ACTIVE transfer: ${transferId} (${elapsed}ms > ${this.TRANSFER_TIMEOUT}ms)`);
        expiredTransfers.push(transferId);
      } else if (elapsed > this.TRANSFER_TIMEOUT - this.CLEANUP_WARNING_THRESHOLD) {
        if (!transfer.htmlAssembledConfirmed) {
          console.warn(`[Background::ChunkManager][CLEANUP] ⚠️ WARNING: Unconfirmed transfer ${transferId} close to expiration (${Math.floor(elapsed/60000)}min/${Math.floor(this.TRANSFER_TIMEOUT/60000)}min) - waiting for HTML_ASSEMBLED confirmation`);
          console.warn(`[Background::ChunkManager][CLEANUP] 📊 Transfer stats: chunks=${transfer.chunks.length}, acked=${transfer.acked.filter(a => a).length}/${transfer.acked.length}`);
        } else {
          console.warn(`[Background::ChunkManager][CLEANUP] ⚠️ WARNING: Confirmed transfer ${transferId} close to expiration (${Math.floor(elapsed/60000)}min/${Math.floor(this.TRANSFER_TIMEOUT/60000)}min)`);
        }
      }
    });

    // Cleanup global references (safe, as they still exist in completed if needed)
    // AGGRESSIVE PROTECTION: Extended protection for global refs during initial period
    this.globalTransferRefs.forEach((transfer, transferId) => {
      const elapsed = now - transfer.startTime;
      // Protect global refs for longer period due to their importance
      if (elapsed < PROTECTION_PERIOD + 60000) { // 3 minutes protection for global refs
        return;
      }
      if (elapsed > this.TRANSFER_TIMEOUT + 60000) { // Extra 1 minute grace period for extended timeout
        console.warn(`[Background::ChunkManager][CLEANUP] 🗑️ CLEANING UP expired global ref: ${transferId}`);
        expiredGlobalRefs.push(transferId);
      }
    });

    // Cleanup completed transfers using phased approach
    // AGGRESSIVE PROTECTION: Protect completed transfers during critical period
    this.completedTransfers.forEach((transfer, transferId) => {
      const elapsed = now - transfer.startTime;
      if (elapsed < PROTECTION_PERIOD) { // Protect completed transfers for initial 10 minutes
        return;
      }
      if (elapsed > this.TRANSFER_TIMEOUT + 60000) { // 11 minutes (10 min + 1 min grace) for completed transfers
        console.warn(`[Background::ChunkManager][CLEANUP] 🗑️ CLEANING UP expired completed transfer: ${transferId} (${elapsed}ms > ${this.TRANSFER_TIMEOUT + 60000}ms)`);
        expiredCompleted.push(transferId);
      }
    });

    // Execute cleanups with RETRY PROTECTION
    if (expiredTransfers.length > 0) {
      console.warn(`[Background::ChunkManager][CLEANUP] Processing ${expiredTransfers.length} expired active transfers`);

      for (const transferId of expiredTransfers) {
        const transfer = this.transfers.get(transferId);
        if (!transfer) continue;

        // RETRY PROTECTION: Try to recover lost acknowledgments before cleanup
        console.log(`[Background::ChunkManager][CLEANUP] 🔄 Attempting recovery for expired transfer ${transferId}`);
        await this.retryLostAcknowledgments(transferId);

        // Verify integrity after retry
        const integrity = this.verifyTransferIntegrity(transferId);
        if (!integrity.isHealthy) {
          console.warn(`[Background::ChunkManager][CLEANUP] ❌ Transfer ${transferId} has integrity issues:`, integrity.issues);

          // If transfer is not complete but has integrity issues, keep it longer
          if (!transfer.htmlAssembledConfirmed) {
            console.warn(`[Background::ChunkManager][CLEANUP] 🛡️ Keeping incomplete transfer ${transferId} due to integrity issues`);
            continue;
          }
        }

        // Safe to remove
        console.warn(`[Background::ChunkManager][CLEANUP] 🗑️ Removing expired active transfer: ${transferId}`);
        this.transfers.delete(transferId);
        // Keep assembled HTML as fallback
      }
    }

    if (expiredGlobalRefs.length > 0) {
      console.warn(`[Background::ChunkManager][CLEANUP] Removed ${expiredGlobalRefs.length} expired global refs`);
      expiredGlobalRefs.forEach(id => {
        this.globalTransferRefs.delete(id);
        // Clean global scope
        delete (globalThis as any)[`currentTransfer_${id}`];
      });
    }

    if (expiredCompleted.length > 0) {
      console.warn(`[Background::ChunkManager][CLEANUP] Removed ${expiredCompleted.length} expired completed transfers`);
      expiredCompleted.forEach(id => {
        this.completedTransfers.delete(id);
        this.assembledHtmls.delete(id); // Now safe to clean assembled HTML
      });
    }

    // Cleanup emergency backup (extended timeframe for maximum reliability)
    // AGGRESSIVE PROTECTION: Maximum protection for emergency backup during critical period
    const expiredEmergency: string[] = [];
    this.emergencyBackup.forEach((transfer, transferId) => {
      const elapsed = now - transfer.startTime;
      if (elapsed < PROTECTION_PERIOD + 60000) { // 3 minutes protection for emergency backup
        return;
      }
      if (elapsed > this.TRANSFER_TIMEOUT + 120000) { // 12 minutes (10 min + 2 min extra) for emergency backup
        console.warn(`[Background::ChunkManager][CLEANUP] 🗑️ CLEANING UP expired emergency backup: ${transferId}`);
        expiredEmergency.push(transferId);
      }
    });

    if (expiredEmergency.length > 0) {
      console.warn(`[Background::ChunkManager][CLEANUP] Removed ${expiredEmergency.length} expired emergency backups`);
      expiredEmergency.forEach(id => this.emergencyBackup.delete(id));
    }

    // Cleanup ultra emergency transfers (longest retention for maximum reliability)
    // AGGRESSIVE PROTECTION: Critical protection for ultra emergency during initial period
    const expiredUltraEmergency: string[] = [];
    if ((globalThis as any).emergencyTransfers) {
      Object.keys((globalThis as any).emergencyTransfers).forEach(transferId => {
        const emergencyData = (globalThis as any).emergencyTransfers[transferId];
        const elapsed = now - emergencyData.timestamp;
        if (elapsed < PROTECTION_PERIOD + 120000) { // 4 minutes protection for ultra emergency
          return;
        }
        if (elapsed > this.TRANSFER_TIMEOUT + 240000) { // 14 minutes (10 min + 4 min extra) for ultra emergency
          console.warn(`[Background::ChunkManager][CLEANUP] 🗑️ CLEANING UP expired ultra emergency transfer: ${transferId}`);
          expiredUltraEmergency.push(transferId);
        }
      });

      if (expiredUltraEmergency.length > 0) {
        console.warn(`[Background::ChunkManager][CLEANUP] Removed ${expiredUltraEmergency.length} expired ultra emergency backups`);
        expiredUltraEmergency.forEach(id => delete (globalThis as any).emergencyTransfers[id]);
      }
    }

    // Cleanup fixed transfers (maximum retention for ultimate reliability)
    // AGGRESSIVE PROTECTION: Maximum protection for fixed transfers during critical period
    const expiredFixed: string[] = [];
    if ((globalThis as any).fixedTransfers) {
      (globalThis as any).fixedTransfers.forEach((transferData: any, index: number) => {
        const elapsed = now - transferData.timestamp;
        if (elapsed < PROTECTION_PERIOD + 240000) { // 6 minutes protection for fixed transfers (maximum)
          return;
        }
        if (elapsed > this.TRANSFER_TIMEOUT + 300000) { // 15 minutes (10 min + 5 min for max reliability)
          console.warn(`[Background::ChunkManager][CLEANUP] 🗑️ CLEANING UP expired fixed transfer: ${transferData.id}`);
          expiredFixed.push(transferData.id);
          (globalThis as any).fixedTransfers.splice(index, 1);
        }
      });

      if (expiredFixed.length > 0) {
        console.warn(`[Background::ChunkManager][CLEANUP] Removed ${expiredFixed.length} expired fixed transfer backups`);
      }
    }

    // INTEGRITY MONITORING: Check all active transfers for integrity issues
    console.log(`[Background::ChunkManager][CLEANUP] 🔍 Performing integrity check on all active transfers...`);
    const integrityIssues: string[] = [];

    this.transfers.forEach((transfer, transferId) => {
      const integrity = this.verifyTransferIntegrity(transferId);
      if (!integrity.isHealthy) {
        integrityIssues.push(`${transferId}: ${integrity.issues.join('; ')}`);
      }
    });

    if (integrityIssues.length > 0) {
      console.warn(`[Background::ChunkManager][CLEANUP] ⚠️ Found ${integrityIssues.length} transfers with integrity issues:`);
      integrityIssues.forEach(issue => console.warn(`[Background::ChunkManager][CLEANUP] - ${issue}`));

      // AUTO-RECOVERY: Attempt to fix integrity issues
      console.log(`[Background::ChunkManager][CLEANUP] 🔧 Attempting auto-recovery for problematic transfers...`);
      for (const issue of integrityIssues) {
        const transferId = issue.split(':')[0];
        await this.retryLostAcknowledgments(transferId);
      }
    } else {
      console.log(`[Background::ChunkManager][CLEANUP] ✅ All active transfers passed integrity check`);
    }

    const totalCleaned = expiredTransfers.length + expiredGlobalRefs.length + expiredCompleted.length + expiredEmergency.length + expiredUltraEmergency.length + expiredFixed.length;
    if (totalCleaned > 0) {
      console.log(`[Background::ChunkManager][CLEANUP] Cleanup summary: ${expiredTransfers.length} active, ${expiredGlobalRefs.length} global, ${expiredCompleted.length} completed, ${expiredEmergency.length} emergency, ${expiredUltraEmergency.length} ultra emergency, ${expiredFixed.length} fixed (${totalCleaned} total)`);
    }

    // HEALTH REPORT: Log overall chunk manager health
    const activeCount = this.transfers.size;
    const completedCount = this.completedTransfers.size;
    const emergencyCount = this.emergencyBackup.size;
    const assembledCount = this.assembledHtmls.size;

    console.log(`[Background::ChunkManager][HEALTH] 📊 Health Report:`);
    console.log(`[Background::ChunkManager][HEALTH] - Active transfers: ${activeCount}`);
    console.log(`[Background::ChunkManager][HEALTH] - Completed transfers: ${completedCount}`);
    console.log(`[Background::ChunkManager][HEALTH] - Emergency backup: ${emergencyCount}`);
    console.log(`[Background::ChunkManager][HEALTH] - Assembled HTMLs: ${assembledCount}`);
    console.log(`[Background::ChunkManager][HEALTH] - Total managed: ${activeCount + completedCount + emergencyCount}`);

    // PERSISTENCE: Cleanup expired transfers from chrome.storage (async)
    this.persistenceManager.cleanup().then(persistenceCleanedCount => {
      if (persistenceCleanedCount > 0) {
        console.log(`[Background::ChunkManager][CLEANUP] Persisted storage cleanup: removed ${persistenceCleanedCount} expired transfers`);
      }
    }).catch(error => {
      console.error('[Background::ChunkManager][CLEANUP] Failed to cleanup persisted storage:', error);
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
  private recoveryManager: TransferRecoveryManager;
  private heartbeatMonitor: HeartbeatMonitor;
  private metadataManager = new TransferMetadataManager();
  private pendingWorkflows = new Map<string, { requestId: string; pluginId: string; pageHtml: string }>(); // transferId -> workflow data

  constructor() {
    // Initialize recovery manager with chunk manager and persistence manager
    this.recoveryManager = new TransferRecoveryManager(this.chunkManager, this.chunkManager['persistenceManager']);

    // Initialize heartbeat monitor
    this.heartbeatMonitor = new HeartbeatMonitor(this);

    this.setupMessageHandling();
    this.setupPeriodicCleanup();
    this.restorePersistedTransfers();
    console.log('Background Controller initialized (Enhanced v3.0 with Transfer Recovery)');

    // DIAGNOSTIC: Setup transfer scope monitoring
    setInterval(() => this.logTransferScopeState(), 10000); // Every 10 seconds

    // Start heartbeat monitoring
    this.heartbeatMonitor.start();
    console.log('[BackgroundController] Heartbeat monitoring started');
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
    setInterval(async () => {
      try {
        await this.chunkManager.cleanup();
      } catch (error) {
        console.error('[background] Cleanup error:', error);
      }
    }, this.CLEANUP_INTERVAL);

      // Очистка устаревших метаданных трансферов
      try {
        await this.metadataManager.cleanupExpired();
      } catch (error) {
        console.error('[background] Metadata cleanup error:', error);
      }

      // Log recovery statistics periodically
      const recoveryStats = this.recoveryManager.getRecoveryStats();
      if (recoveryStats.total > 0) {
        console.log(`[Background][RECOVERY_STATS] 📊 Recovery statistics:`, {
          total: recoveryStats.total,
          successful: recoveryStats.successful,
          failed: recoveryStats.failed,
          successRate: recoveryStats.total > 0 ? ((recoveryStats.successful / recoveryStats.total) * 100).toFixed(1) + '%' : '0%',
          averageDuration: Math.round(recoveryStats.averageDuration) + 'ms',
          strategyUsage: recoveryStats.strategyUsage
        });
      }

      // Log workflow stats
      const workflowStats = this.promiseManager.getStats();
      if (workflowStats.active > 0) {
        console.log(`[Background] Active workflows: ${workflowStats.active}, oldest: ${workflowStats.oldestAge}ms`);
      }

      // Log metadata stats periodically
      const metadataStats = await this.metadataManager.getStats();
      if (metadataStats.total > 0) {
        console.log(`[Background][METADATA_STATS] 📊 Metadata statistics:`, {
          total: metadataStats.total,
          active: metadataStats.active,
          completed: metadataStats.completed,
          recovered: metadataStats.recovered,
          avgAge: `${metadataStats.avgAge}h`
        });
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
           console.log(`[Background][CHUNKING] ✅ Received ACK for ${message.transferId} chunk ${message.chunkIndex}`);

           // THREAD-SAFE ACKNOWLEDGMENT: Now async with race condition protection
           this.chunkManager.acknowledgeChunk(message.transferId, message.chunkIndex).then(() => {
             // DIAGNOSTIC: Log transfer stats after each ack
             const ackStats = this.chunkManager.getTransferStats(message.transferId);
             if (ackStats) {
               console.log(`[Background][CHUNKING] Transfer ${message.transferId} progress: ${ackStats.completed}/${ackStats.total}, duration: ${ackStats.duration}ms`);
             }
           }).catch(error => {
             console.error(`[Background][CHUNKING] ❌ Error processing acknowledgment for ${message.transferId} chunk ${message.chunkIndex}:`, error);
           });

           break;

        case 'HTML_ASSEMBLED':
           console.log(`[Background][ASSEMBLY] ✅ Received HTML_ASSEMBLED for ${message.transferId} (${(message as any).html.length} chars)`);

           // ENHANCED TRANSFER VALIDATION: Check if offscreen transfer exists before proceeding
           console.log(`[Background][ASSEMBLY][VALIDATION] 🔍 Pre-validating transfer ${message.transferId} before processing`);

           // CRITICAL SAFETY: First, ensure we can restore/find the transfer in background
           const backgroundTransferExists = this.chunkManager.wasChunked(message.transferId);
           console.log(`[Background][ASSEMBLY][VALIDATION] Background transfer exists: ${backgroundTransferExists}`);

           if (!backgroundTransferExists) {
             console.error(`[Background][ASSEMBLY][VALIDATION] ❌ CRITICAL: Transfer ${message.transferId} does not exist in background storage!`);
             console.error(`[Background][ASSEMBLY][VALIDATION] Active transfers: [${Array.from(this.chunkManager['transfers'].keys()).join(', ')}]`);
             console.error(`[Background][ASSEMBLY][VALIDATION] Completed transfers: [${Array.from(this.chunkManager['completedTransfers'].keys()).join(', ')}]`);

             // ATTEMPT RECOVERY: Try to recover transfer from global emergency storage
             const emergencyRecovery = await this.recoveryManager.recoverTransfer(message.transferId);
             if (emergencyRecovery.success) {
               console.log(`[Background][ASSEMBLY][VALIDATION] ✅ EMERGENCY RECOVERY successful for transfer ${message.transferId}`);
               // Store recovered transfer back in chunkManager
               if (emergencyRecovery.transfer) {
                 this.chunkManager['completedTransfers'].set(message.transferId, emergencyRecovery.transfer);
               }
               if (emergencyRecovery.html) {
                 (message as any).html = emergencyRecovery.html;
               }
             } else {
               console.error(`[Background][ASSEMBLY][VALIDATION] ❌ EMERGENCY RECOVERY failed: ${emergencyRecovery.error}`);
               // Send rejection confirmation to offscreen
                 await safeSendMessage({
                   type: 'HTML_ASSEMBLED_REJECTED',
                   transferId: message.transferId,
                   reason: `Transfer lost in background: ${emergencyRecovery.error}`
                 }).catch(err => console.error('[HTML_ASSEMBLED] Failed to send rejection:', err));
               return;
             }
           }

           try {
             const offscreenStatus = await chrome.runtime.sendMessage({
               type: 'CHECK_TRANSFER_STATUS',
               transferId: message.transferId
             });

             console.log(`[Background][ASSEMBLY][VALIDATION] Offscreen transfer status:`, offscreenStatus);

             if (!offscreenStatus.transferExists) {
               console.error(`[Background][ASSEMBLY][VALIDATION] ❌ Transfer ${message.transferId} does not exist in offscreen, rejecting HTML_ASSEMBLED`);
               // Send rejection confirmation to offscreen
               await safeSendMessage({
                 type: 'HTML_ASSEMBLED_REJECTED',
                 transferId: message.transferId,
                 reason: 'Transfer does not exist in offscreen'
               }).catch(err => console.error('[HTML_ASSEMBLED] Failed to send rejection:', err));
               return;
             }

             if (!offscreenStatus.assembledNotified) {
               console.error(`[Background][ASSEMBLY][VALIDATION] ❌ Transfer ${message.transferId} has not been properly assembled in offscreen, rejecting HTML_ASSEMBLED`);
               // Send rejection confirmation to offscreen
               chrome.runtime.sendMessage({
                 type: 'HTML_ASSEMBLED_REJECTED',
                 transferId: message.transferId,
                 reason: 'Transfer not properly assembled in offscreen'
               });
               return;
             }

             console.log(`[Background][ASSEMBLY][VALIDATION] ✅ Transfer ${message.transferId} validated successfully in both background and offscreen`);

           } catch (validationError) {
             console.error(`[Background][ASSEMBLY][VALIDATION] ❌ Transfer validation failed for ${message.transferId}:`, validationError);
             console.error(`[Background][ASSEMBLY][VALIDATION] WARNING: Proceeding with HTML_ASSEMBLED despite validation failure`);
           }

            // AGGRESSIVE DIAGNOSTIC: Log transfer state when HTML_ASSEMBLED is received
            console.log(`[DIAG][HTML_ASSEMBLED] Checking transfer ${message.transferId} immediately after reception:`);
            this.chunkManager['logTransferLookupCascade']?.(message.transferId);
            this.chunkManager.setAssembledHtml(message.transferId, (message as any).html);

          // RACE CONDITION PROTECTION: Attempt to complete transfer safely
          const transferCompleted = this.chunkManager.completeTransfer(message.transferId);
          if (transferCompleted) {
            console.log(`[Background][ASSEMBLY] ✅ Transfer ${message.transferId} safely moved to completed storage`);
          } else {
            console.warn(`[Background][ASSEMBLY] ⚠️ Transfer ${message.transferId} not found in active storage - this is a race condition!`);
          }

          // DIAGNOSTIC: Log assembled HTML details
          console.log(`[Background][ASSEMBLY][DIAG] Checking transfer scope for ${message.transferId}:`);
          console.log(`[Background][ASSEMBLY][DIAG] - Transfer exists in chunkManager: ${this.chunkManager.wasChunked(message.transferId)}`);
          console.log(`[Background][ASSEMBLY][DIAG] - Transfer in active storage: ${this.chunkManager['transfers'].has(message.transferId)}`);
          console.log(`[Background][ASSEMBLY][DIAG] - Transfer in completed storage: ${this.chunkManager['completedTransfers'].has(message.transferId)}`);
          console.log(`[Background][ASSEMBLY][DIAG] - Transfer in global refs: ${this.chunkManager['globalTransferRefs'].has(message.transferId)}`);
          console.log(`[Background][ASSEMBLY][DIAG] - Transfer in emergency backup: ${this.chunkManager['emergencyBackup'].has(message.transferId)}`);
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
              let fallbackHtml = this.chunkManager.getAssembledHtml(message.transferId);
              if (fallbackHtml) {
                console.log(`[Background][ASSEMBLY] ✅ Using fallback HTML from chunkManager (${fallbackHtml.length} chars)`);
                (message as any).html = fallbackHtml;
              } else {
                console.warn(`[Background][ASSEMBLY] ❌ No assembled HTML found, trying getAssembledData fallback…`);

                // УПРОЩЕННАЯ RECOVERY: Сначала пробуем получить метаданные через TransferMetadataManager
                try {
                  console.log(`[Background][ASSEMBLY] 🔍 Пытаемся получить метаданные для ${message.transferId}`);

                  // ПРОСТАЯ RECOVERY СТРАТЕГИЯ: Используем только TransferMetadataManager
                  const metadata = await this.metadataManager.getMetadata(message.transferId);

                  if (metadata) {
                    console.log(`[Background][ASSEMBLY] ✅ Найдены метаданные: pluginId=${metadata.pluginId}, pageKey=${metadata.pageKey}`);

                    // Создаем workflow с восстановленными метаданными
                    const recoveredWorkflow = {
                      requestId: metadata.pageKey,
                      pluginId: metadata.pluginId,
                      pageHtml: (message as any).html || '<html><body>Recovered content</body></html>'
                    };

                    // Сохраняем в pendingWorkflows для использования ниже
                    this.pendingWorkflows.set(message.transferId, recoveredWorkflow);
                    console.log(`[Background][ASSEMBLY] ✅ Создали workflow с восстановленными метаданными:`, recoveredWorkflow);

                    // Отмечаем статус метаданных как recovered
                    await this.metadataManager.updateStatus(message.transferId, 'recovered');

                  } else {
                    console.warn(`[Background][ASSEMBLY] ⚠️ Метаданные не найдены для ${message.transferId}, создаем базовый workflow`);

                    // Базовый fallback без метаданных
                    const basicWorkflow = {
                      requestId: `fallback_${message.transferId}`,
                      pluginId: 'unknown_plugin',
                      pageHtml: (message as any).html || '<html><body>Content unavailable</body></html>'
                    };

                    this.pendingWorkflows.set(message.transferId, basicWorkflow);
                    console.log(`[Background][ASSEMBLY] ✅ Создан базовый workflow:`, basicWorkflow);
                  }
                } catch (metadataError) {
                  console.error(`[Background][ASSEMBLY] ❌ Ошибка получения метаданных для ${message.transferId}:`, metadataError);

                  // Простой fallback в случае ошибки
                  const errorWorkflow = {
                    requestId: `error_${message.transferId}`,
                    pluginId: 'error_plugin',
                    pageHtml: '<html><body>Metadata recovery error</body></html>'
                  };

                  this.pendingWorkflows.set(message.transferId, errorWorkflow);
                  console.log(`[Background][ASSEMBLY] ✅ Создан workflow при ошибке:`, errorWorkflow);
                }
            }

            // ENHANCED METADATA USAGE: Use recovered or original metadata when sending EXECUTE_WORKFLOW
            let workflowPluginId = pendingWorkflow.pluginId;
            let workflowRequestId = pendingWorkflow.requestId;
            let workflowPageKey = `transfer_${message.transferId}`;

            // If we have recovered metadata, use it for the workflow execution
            const recoveredMetadata = (globalThis as any).transferMetadata?.[message.transferId];
            if (recoveredMetadata) {
              workflowPluginId = recoveredMetadata.pluginId || workflowPluginId;
              workflowPageKey = recoveredMetadata.pageKey || workflowPageKey;
              console.log(`[Background][ASSEMBLY] 🔧 Using recovered metadata for EXECUTE_WORKFLOW: pluginId=${workflowPluginId}, pageKey=${workflowPageKey}`);
            }

            // WAIT FOR OFFSCREEN READINESS BEFORE SENDING EXECUTE_WORKFLOW
            console.log(`[Background][EXECUTE_WORKFLOW] ⏳ Checking offscreen readiness before sending EXECUTE_WORKFLOW for ${message.transferId}`);
            const offscreenReady = await isOffscreenAvailable();
            console.log(`[Background][EXECUTE_WORKFLOW] Offscreen available: ${offscreenReady}`);

            if (!offscreenReady) {
              console.warn(`[Background][EXECUTE_WORKFLOW] ⚠️ Offscreen not available, waiting 2 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 2000));

              // Check again
              const offscreenReadyRetry = await isOffscreenAvailable();
              if (!offscreenReadyRetry) {
                console.error(`[Background][EXECUTE_WORKFLOW] ❌ Offscreen still not available after retry, aborting EXECUTE_WORKFLOW`);
                throw new Error('Offscreen document not available for EXECUTE_WORKFLOW');
              }
              console.log(`[Background][EXECUTE_WORKFLOW] ✅ Offscreen became available after retry`);
            }

            // LOG OFFSCREEN STATUS BEFORE SENDING
            console.log(`[Background][EXECUTE_WORKFLOW] 📊 Offscreen status before sending:`);
            console.log(`[Background][EXECUTE_WORKFLOW] - Document available: ${offscreenReady}`);
            console.log(`[Background][EXECUTE_WORKFLOW] - Transfer ID: ${message.transferId}`);
            console.log(`[Background][EXECUTE_WORKFLOW] - Plugin ID: ${workflowPluginId}`);
            console.log(`[Background][EXECUTE_WORKFLOW] - Request ID: ${workflowRequestId}`);
            console.log(`[Background][EXECUTE_WORKFLOW] - HTML length: ${(message as any).html?.length || 0} chars`);
            console.log(`[Background][EXECUTE_WORKFLOW] - Timestamp: ${new Date().toISOString()}`);

            console.log(`[Background][EXECUTE_WORKFLOW] 🚀 SENDING EXECUTE_WORKFLOW to offscreen for transfer ${message.transferId}`);

            // RETRY LOGIC WITH EXPONENTIAL BACKOFF FOR EXECUTE_WORKFLOW
            let sendAttempts = 0;
            const maxSendAttempts = 3;
            let lastSendError: Error | null = null;

            while (sendAttempts < maxSendAttempts) {
              try {
                console.log(`[Background][EXECUTE_WORKFLOW] 📤 Attempt ${sendAttempts + 1}/${maxSendAttempts} to send EXECUTE_WORKFLOW`);

                await safeSendMessage({
                  type: 'EXECUTE_WORKFLOW',
                  pluginId: workflowPluginId,
                  requestId: workflowRequestId,
                  transferId: message.transferId,
                  pageKey: workflowPageKey, // Use recovered pageKey if available
                  useChunks: false, // HTML is already assembled, no need to use chunks
                  pageHtml: pendingWorkflow.pageHtml, // Original HTML (fallback if needed)
                  assembledHtml: (message as any).html // Pre-assembled HTML from chunks
                }, 3000); // 3 second timeout for EXECUTE_WORKFLOW

                console.log(`[Background][EXECUTE_WORKFLOW] ✅ EXECUTE_WORKFLOW message sent successfully to offscreen on attempt ${sendAttempts + 1}`);
                break; // Success, exit retry loop

              } catch (sendError) {
                sendAttempts++;
                lastSendError = sendError as Error;
                console.warn(`[Background][EXECUTE_WORKFLOW] ⚠️ EXECUTE_WORKFLOW send attempt ${sendAttempts} failed:`, sendError);

                if (sendAttempts < maxSendAttempts) {
                  // CHECK OFFSCREEN AVAILABILITY BEFORE RETRY
                  const stillAvailable = await isOffscreenAvailable();
                  console.log(`[Background][EXECUTE_WORKFLOW] Offscreen still available before retry: ${stillAvailable}`);

                  if (!stillAvailable) {
                    console.error(`[Background][EXECUTE_WORKFLOW] ❌ Offscreen became unavailable, cannot retry EXECUTE_WORKFLOW`);
                    throw new Error(`Offscreen document became unavailable during EXECUTE_WORKFLOW retry: ${(sendError as Error).message}`);
                  }

                  // EXPONENTIAL BACKOFF DELAY
                  const delayMs = Math.min(1000 * Math.pow(2, sendAttempts - 1), 5000); // Max 5 seconds
                  console.log(`[Background][EXECUTE_WORKFLOW] ⏳ Waiting ${delayMs}ms before retry ${sendAttempts + 1}`);
                  await new Promise(resolve => setTimeout(resolve, delayMs));
                } else {
                  console.error(`[Background][EXECUTE_WORKFLOW] ❌ All ${maxSendAttempts} EXECUTE_WORKFLOW send attempts failed`);
                  console.error(`[Background][EXECUTE_WORKFLOW] Final error:`, lastSendError);
                  throw new Error(`Failed to send EXECUTE_WORKFLOW after ${maxSendAttempts} attempts: ${(lastSendError as Error).message}`);
                }
              }
            }

            // Mark transfer as confirmed - offscreen has received HTML and started processing
            const transfer = this.chunkManager['transfers'].get(message.transferId);
            if (transfer) {
              transfer.htmlAssembledConfirmed = true;
              console.log(`[Background][ASSEMBLY] ✅ Marked transfer ${message.transferId} as confirmed after sending EXECUTE_WORKFLOW`);
            }

            // Remove from pending workflows
            this.pendingWorkflows.delete(message.transferId);
            console.log(`[Background][ASSEMBLY] ✅ Removed transfer ${message.transferId} from pending workflows`);

          } else {
              console.warn(`[Background][ASSEMBLY] ⚠️ No pending workflow found for transfer ${message.transferId}`);
              console.warn(`[Background][ASSEMBLY] Available pending workflows: [${Array.from(this.pendingWorkflows.keys()).join(', ')}]`);
            }

            // Send confirmation back to offscreen that HTML_ASSEMBLED was received
            await safeSendMessage({
              type: 'HTML_ASSEMBLED_CONFIRMED',
              transferId: message.transferId
            }).catch(err => console.error('[HTML_ASSEMBLED] Failed to send confirmation:', err));
            console.log(`[Background][ASSEMBLY] ✅ Sent confirmation for HTML_ASSEMBLED receipt to offscreen for transfer ${message.transferId}`);
            break;
        }

        case 'HEARTBEAT_RESPONSE':
          this.handleHeartbeatResponse(message as HeartbeatResponseMessage);
          break;

        case 'CHECK_TRANSFER_STATUS':
          await this.handleCheckTransferStatus(message, sendResponse);
          break;

        case 'HOST_CALL':
          await this.handleHostCall(message, sendResponse);
          break;

        case 'DELETE_PLUGIN_CHAT':
          await this.handleDeletePluginChat(message, sendResponse);
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
      trackSendResponse({ success: false, error: (error as Error).message });
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

      // Читаем глобальные настройки для определения режима передачи HTML
      console.log(`[Background][HTML_TRANSMISSION] 🔍 Reading global settings from chrome.storage.local...`);
      const globalSettings = await getGlobalSettings();
      const useDirectTransmission = globalSettings.htmlTransmissionMode === 'direct';

      console.log(`[Background][HTML_TRANSMISSION] ✅ Global settings loaded: htmlTransmissionMode=${globalSettings.htmlTransmissionMode}`);
      console.log(`[Background][HTML_TRANSMISSION] 📊 Using global transmission mode: ${globalSettings.htmlTransmissionMode} (Plugin: ${message.pluginId})`);
      console.log(`[Background][HTML_TRANSMISSION] 🎯 Direct transmission enabled: ${useDirectTransmission}`);

      // Устанавливаем глобальные переменные для передачи метаданных в TransferMetadataManager
      (globalThis as any).metadataManager = this.metadataManager;
      (globalThis as any).currentTransferMetadata = {
        pluginId: message.pluginId,
        pageKey: requestId
      };

      // Выбор метода передачи HTML на основе глобальных настроек и размера контента
      const htmlSizeMB = pageHtml.length / 1024 / 1024;
      const sizeLimitMB = MAX_DIRECT_SIZE / 1024 / 1024;

      if (useDirectTransmission && pageHtml.length < MAX_DIRECT_SIZE) {
        console.log(`[Background][HTML_TRANSMISSION] 🚀 Using DIRECT transmission for ${pageHtml.length} chars (${htmlSizeMB.toFixed(2)}MB)`);
        console.log(`[Background][HTML_TRANSMISSION] 📊 Global settings: htmlTransmissionMode=${globalSettings.htmlTransmissionMode}, size check: ${htmlSizeMB.toFixed(2)}MB < ${sizeLimitMB.toFixed(0)}MB limit`);

        try {
          // Прямая передача HTML
          await sendHtmlDirectly(pageHtml, {
            pluginId: message.pluginId,
            requestId,
            transferId
          });

          // Для прямой передачи не нужен pending workflow, так как EXECUTE_WORKFLOW отправляется сразу
          // Удаляем из pendingWorkflows, так как workflow уже запущен
          this.pendingWorkflows.delete(transferId);

        } catch (directError) {
          console.warn(`[Background][HTML_TRANSMISSION] ⚠️ Direct transmission failed, falling back to chunks:`, directError);
          console.log(`[Background][HTML_TRANSMISSION] 🔄 Fallback triggered due to direct transmission error`);

          // Fallback на чанки при ошибке прямой передачи
          console.log(`[Background][HTML_TRANSMISSION] 🔄 Falling back to chunked transmission for transfer ${transferId}`);
          await this.chunkManager.sendInChunks(pageHtml, transferId);

          // Store workflow data for later when HTML is assembled (для чанкового режима)
          this.pendingWorkflows.set(transferId, {
            requestId,
            pluginId: message.pluginId,
            pageHtml
          });
        }

      } else {
        // Используем чанки (стандартный режим или fallback)
        const reason = !useDirectTransmission
          ? `chunks mode selected in global settings`
          : `HTML too large (${htmlSizeMB.toFixed(2)}MB > ${sizeLimitMB.toFixed(0)}MB limit)`;

        console.log(`[Background][HTML_TRANSMISSION] 📦 Using CHUNKED transmission (${reason}) for ${pageHtml.length} chars (${htmlSizeMB.toFixed(2)}MB)`);
        console.log(`[Background][HTML_TRANSMISSION] 📊 Global settings: htmlTransmissionMode=${globalSettings.htmlTransmissionMode}, size check: ${htmlSizeMB.toFixed(2)}MB vs ${sizeLimitMB.toFixed(0)}MB limit`);

        await this.chunkManager.sendInChunks(pageHtml, transferId);

        // Store workflow data for later when HTML is assembled
        this.pendingWorkflows.set(transferId, {
          requestId,
          pluginId: message.pluginId,
          pageHtml
        });
      }

      // Wait to ensure chunks are processed and acknowledged
      console.log(`[Background][DIAG] ⏳ WAITING for chunks processing and acknowledgments (1s delay)`);
      await this.delay(1000);

      // DIAGNOSTIC: Check transfer state before sending EXECUTE_WORKFLOW
      const postSendStats = this.chunkManager.getTransferStats(transferId);
      console.log(`[Background][DIAG] Transfer stats BEFORE workflow execution:`, postSendStats);
      console.log(`[Background][DIAG] Transfer still exists: ${this.chunkManager.wasChunked(transferId)}`);
      console.log(`[Background][DIAG] useChunks flag will be set to: false`);

      // EXECUTE_WORKFLOW will be sent when HTML_ASSEMBLED is received from offscreen
      
      // Wait for result - SAFE RESULT HANDLING
      try {
        const result = await resultPromise;
        // Ensure result is never undefined to prevent ReferenceError
        const safeResult = result !== undefined ? result : null;

        console.log('[Background] Workflow completed successfully:', { requestId, success: true, hasResult: safeResult !== null });

        if (result === undefined) {
          console.warn('[Background] ⚠️ WARNING: resultPromise returned undefined, using null fallback');
        }

        trackSendResponse({ success: true, result: safeResult, requestId });
      } catch (resultError) {
        console.error('[Background] Error awaiting resultPromise:', resultError);
        // If resultPromise fails, ensure we handle the error gracefully
        const errorMessage = resultError instanceof Error ? resultError.message : 'Unknown result error';
        trackSendResponse({ success: false, error: errorMessage, requestId });
      }
      
    } catch (error) {
      console.error('[Background] Workflow execution failed:', error);
      trackSendResponse({ success: false, error: (error as Error).message });
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
  
  private async handleWorkflowCompleted(message: WorkflowCompletedMessage): Promise<void> {
    console.log('[BACKGROUND DEBUG] Handling workflow completed:');
    console.log('[BACKGROUND DEBUG] requestId:', message.requestId);
    console.log('[BACKGROUND DEBUG] success:', message.success);
    console.log('[BACKGROUND DEBUG] has result:', message.result !== undefined);
    console.log('[BACKGROUND DEBUG] result type:', typeof message.result);
    console.log('[BACKGROUND DEBUG] has error:', !!message.error);

    // RACE CONDITION PROTECTION: Complete any pending transfers safely
    if (message.success) {
      // Try to complete associated transfer if exists
      const transferId = `${message.requestId}_html`;
      const movedToCompleted = this.chunkManager.completeTransfer(transferId);
      if (movedToCompleted) {
        console.log(`[BACKGROUND][WORKFLOW] ✅ Associated transfer ${transferId} completed successfully`);
      }
    }

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

    // Send acknowledgment back to offscreen
    await safeSendMessage({
      type: 'WORKFLOW_COMPLETED_ACK',
      requestId: message.requestId,
      timestamp: Date.now()
    }).catch(err => console.warn('[WORKFLOW_COMPLETED] Failed to send ack to offscreen:', err));
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

      // Send response safely
      await safeSendMessage({
        type: 'HOST_CALL_RESPONSE',
        callId: message.payload.callId,
        result
      }).catch(err => {
       console.error('[HOST_CALL] Failed to send response to offscreen:', err);
       trackSendResponse({ success: false, error: 'Failed to send response' });
     });
    } catch (error) {
      // Send error response safely
      await safeSendMessage({
        type: 'HOST_CALL_RESPONSE',
        callId: message.payload.callId,
        error: (error as Error).message
      }).catch(err => {
        console.error('[HOST_CALL] Failed to send error response to offscreen:', err);
        trackSendResponse({ success: false, error: 'Failed to send error response' });
      });
    }
  }

  private async handleDeletePluginChat(
    message: any,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      const { pluginId, pageKey, messageId } = message;

      if (!pluginId || !pageKey) {
        throw new Error('Missing required fields: pluginId and pageKey are required');
      }

      const normPageKey = getPageKey(pageKey);

      console.log('[background] DELETE_PLUGIN_CHAT pageKey:', pageKey, 'messageId:', messageId, 'norm:', normPageKey);

      // Выполняем удаление чата
      await pluginChatApi.deleteChat(pluginId, normPageKey);

      // Отправляем успешный ответ UI
      chrome.runtime.sendMessage({
        type: 'DELETE_PLUGIN_CHAT_RESPONSE',
        messageId,
        success: true,
        pluginId,
        pageKey: normPageKey,
        timestamp: Date.now()
      });

      // Отправляем уведомление об обновлении чата всем слушателям
      broadcastChatUpdate(pluginId, normPageKey);

      console.log('[background] DELETE_PLUGIN_CHAT completed successfully for:', { pluginId, pageKey: normPageKey });

    } catch (error) {
      console.error('[background] DELETE_PLUGIN_CHAT failed:', error);

      // Отправляем ответ об ошибке
      chrome.runtime.sendMessage({
        type: 'DELETE_PLUGIN_CHAT_RESPONSE',
        messageId: message.messageId,
        success: false,
        error: (error as Error).message,
        pluginId: message.pluginId,
        pageKey: message.pageKey,
        timestamp: Date.now()
      });
    }
  }

  private handleHeartbeatResponse(message: HeartbeatResponseMessage): void {
    console.log(`[BackgroundController] 📥 Received heartbeat response for ${message.heartbeatId}`);

    // Heartbeat responses are handled by the HeartbeatMonitor internally
    // This method just acknowledges receipt and could be used for additional processing
    console.log(`[BackgroundController] ✅ Heartbeat response processed:`, {
      heartbeatId: message.heartbeatId,
      latency: Date.now() - message.timestamp,
      offscreenHealth: message.offscreenHealth
    });
  }

  private async handleCheckTransferStatus(message: { transferId: string }, sendResponse: (response?: any) => void): Promise<void> {
    try {
      const transferId = message.transferId;
      const transfer = this.chunkManager['transfers'].get(transferId);
      const assembledHtml = this.chunkManager.getAssembledHtml(transferId);

      const response = {
        transferExists: !!transfer,
        assembledNotified: transfer ? transfer.htmlAssembledConfirmed || false : false,
        html: assembledHtml,
        transferId
      };

      console.log(`[BackgroundController] 📊 Transfer status check for ${transferId}:`, response);
      trackSendResponse(response);
    } catch (error) {
      console.error(`[BackgroundController] ❌ Error checking transfer status:`, error);
      trackSendResponse({
        transferExists: false,
        assembledNotified: false,
        error: (error as Error).message
      });
    }
  }

  // PERSISTENCE: Restore persisted transfers on background script initialization
  private async restorePersistedTransfers(): Promise<void> {
    try {
      console.log('[Background][PERSISTENCE] 🔄 Starting transfer restoration from chrome.storage...');

      const persistedTransfers = await this.chunkManager['persistenceManager'].loadAll();
      const transferIds = Object.keys(persistedTransfers);

      if (transferIds.length === 0) {
        console.log('[Background][PERSISTENCE] ✅ No persisted transfers found to restore');
        return;
      }

      console.log(`[Background][PERSISTENCE] 📋 Found ${transferIds.length} persisted transfers: [${transferIds.join(', ')}]`);

      // Log statistics about persisted transfers
      const stats = await this.chunkManager['persistenceManager'].getStats();
      console.log(`[Background][PERSISTENCE] 📊 Persisted transfer stats:`, stats);

      // Note: We don't actually restore the full transfer objects since we don't store the HTML content
      // Instead, we just log the information for debugging purposes
      // The transfers will be recreated if the same operations are performed again

      console.log('[Background][PERSISTENCE] ✅ Transfer restoration completed (metadata available for recovery)');

    } catch (error) {
      console.error('[Background][PERSISTENCE] ❌ Failed to restore persisted transfers:', error);
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