/**
 * Async Message Handler с Retry Logic и Exponential Backoff
 * Для resilient message communication между компонентами
 */

export class AsyncMessageHandler {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 5;
        this.baseDelay = options.baseDelay || 100; // ms
        this.maxDelay = options.maxDelay || 5000; // ms
        this.backoffMultiplier = options.backoffMultiplier || 2;
        this.timeoutMs = options.timeoutMs || 10000; // 10 seconds

        this.pendingMessages = new Map();
        this.messageTimeouts = new Map();
        this.connectionStable = true;
        this.consecutiveFailures = 0;
    }

    /**
     * Отправка сообщения с automatic retry on failure
     * @param {string} target - target для отправки
     * @param {Object} message - сообщение для отправки
     * @param {Object} options - опции retry
     * @returns {Promise} Promise что резолвится с ответом
     */
    async sendMessage(target, message, options = {}) {
        const messageId = this.generateMessageId();
        const maxRetries = options.maxRetries || this.maxRetries;
        const timeoutMs = options.timeout || this.timeoutMs;

        return new Promise((resolve, reject) => {
            let attempts = 0;
            let lastError = null;

            const trySend = async () => {
                attempts++;
                console.log(`[MessageHandler] Attempt ${attempts}/${maxRetries + 1} - Sending message to ${target}`, message);

                try {
                    const result = await this.attemptSendMessage(target, message, timeoutMs);

                    // Success! Reset failure counter and resolve
                    this.consecutiveFailures = 0;
                    this.connectionStable = true;
                    console.log(`[MessageHandler] ✅ Message delivered to ${target} on attempt ${attempts}`);
                    resolve(result);

                } catch (error) {
                    lastError = error;
                    console.log(`[MessageHandler] ⚠️ Attempt ${attempts} failed: ${error.message}`);

                    // Track consecutive failures for connection stability
                    this.consecutiveFailures++;
                    if (this.consecutiveFailures >= 3) {
                        this.connectionStable = false;
                    }

                    if (attempts <= maxRetries) {
                        // Calculate delay with exponential backoff and jitter
                        const delay = this.calculateDelay(attempts - 1);
                        console.log(`[MessageHandler] ⏳ Retrying in ${delay}ms...`);
                        setTimeout(trySend, delay);
                    } else {
                        // All retry attempts exhausted
                        console.error(`[MessageHandler] ❌ All ${maxRetries + 1} attempts failed for message to ${target}`);
                        reject(this.createRetryError(lastError, attempts, maxRetries));
                    }
                }
            };

            // Start first attempt
            trySend();
        });
    }

    /**
     * Попытка отправки сообщения (низкоуровневая реализация)
     * @param {string} target - target для отправки
     * @param {Object} message - сообщение
     * @param {number} timeoutMs - таймаут в ms
     * @returns {Promise} Promise с результатом
     */
    async attemptSendMessage(target, message, timeoutMs) {
        return new Promise((resolve, reject) => {
            const messageId = this.generateMessageId();
            const startTime = Date.now();

            // Создаем timeout promise
            const timeoutPromise = new Promise((_, timeoutReject) => {
                const timeoutId = setTimeout(() => {
                    timeoutReject(new Error(`Timeout: Message to ${target} timed out after ${timeoutMs}ms`));
                    this.messageTimeouts.delete(messageId);
                }, timeoutMs);
                this.messageTimeouts.set(messageId, timeoutId);
            });

            // Создаем actual message sending promise
            const sendPromise = new Promise(async (resolve, reject) => {
                try {
                    let result;

                    // Разные методы отправки в зависимости от target типа
                    if (target === 'offscreen' && chrome?.offscreen) {
                        result = await this.sendToOffscreenDocument(message);
                    } else if (target === 'background' || target.startsWith('chrome-')) {
                        result = await this.sendToBackgroundScript(message);
                    } else if (target === 'worker' || target.includes('worker')) {
                        result = await this.sendToWorker(message);
                    } else if (target === 'fallback' || target.includes('fallback')) {
                        result = await this.sendFallback(message);
                    } else {
                        // Generic chrome extension message
                        result = await this.sendChromeMessage(target, message);
                    }

                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });

            // Race between sending and timeout
            Promise.race([sendPromise, timeoutPromise])
                .then((result) => {
                    // Clear timeout if message was sent successfully
                    if (this.messageTimeouts.has(messageId)) {
                        clearTimeout(this.messageTimeouts.get(messageId));
                        this.messageTimeouts.delete(messageId);
                    }
                    resolve(result);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    /**
     * Отправка сообщения в offscreen document
     */
    async sendToOffscreenDocument(message) {
        if (!chrome?.offscreen) {
            throw new Error('Offscreen API not available');
        }

        try {
            // Check if offscreen document exists
            const existingContexts = await chrome.offscreen.hasDocument();
            if (!existingContexts) {
                // Create offscreen document
                await chrome.offscreen.createDocument({
                    url: 'test-offscreen.html',
                    reasons: ['TESTING'],
                    justification: 'Running integration tests'
                });
            }

            // Send message via runtime messaging
            return await chrome.runtime.sendMessage({
                type: 'offscreen_test_message',
                data: message,
                target: 'offscreen'
            });

        } catch (error) {
            throw new Error(`Offscreen message failed: ${error.message}`);
        }
    }

    /**
     * Отправка сообщения в background script
     */
    async sendToBackgroundScript(message) {
        if (!chrome?.runtime?.sendMessage) {
            throw new Error('Chrome runtime messaging not available');
        }

        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'test_message',
                data: message,
                target: 'background'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Отправка сообщения worker'у
     */
    async sendToWorker(message) {
        // Try to use chrome.runtime.sendMessage for worker communication
        if (chrome?.runtime?.sendMessage) {
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'worker_message',
                    data: message,
                    target: 'worker'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
        } else {
            // Fallback for environments without chrome runtime
            throw new Error('Chrome runtime not available for worker communication');
        }
    }

    /**
     * Отправка в fallback mode (для legacy browser версии)
     */
    async sendFallback(message) {
        console.log('[MessageHandler] Using fallback communication mode');

        // Simulate network delay
        await this.simulateNetworkDelay();

        // Return mock response to simulate successful fallback communication
        return {
            success: true,
            message: 'Fallback communication successful',
            data: message,
            fallback: true,
            mode: 'legacy'
        };
    }

    /**
     * Generic chrome extension message
     */
    async sendChromeMessage(target, message) {
        if (!chrome?.runtime?.sendMessage) {
            throw new Error('Chrome runtime messaging not available');
        }

        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'extension_message',
                target: target,
                data: message
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Расчет задержки с exponential backoff и jitter
     * @param {number} attempt - номер попытки (начиная с 0)
     * @returns {number} задержка в ms
     */
    calculateDelay(attempt) {
        // Exponential backoff: baseDelay * multiplier^attempt
        let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);

        // Cap at maximum delay
        delay = Math.min(delay, this.maxDelay);

        // Add jitter ±25%
        const jitter = delay * 0.25 * (Math.random() * 2 - 1);
        delay += jitter;

        return Math.floor(delay);
    }

    /**
     * Simulating network conditions for testing
     * @returns {Promise} Promise that resolves after simulated delay
     */
    async simulateNetworkDelay() {
        const baseDelay = 100 + Math.random() * 200; // 100-300ms
        return new Promise(resolve => setTimeout(resolve, baseDelay));
    }

    /**
     * Создание ошибки с информацией о retries
     * @param {Error} lastError - последняя ошибка
     * @param {number} attempts - количество попыток
     * @param {number} maxRetries - максимум retries
     * @returns {Error} композитная ошибка
     */
    createRetryError(lastError, attempts, maxRetries) {
        const error = new Error(`Failed after ${attempts} attempts (max ${maxRetries + 1}). Last error: ${lastError.message}`);
        error.lastError = lastError;
        error.attempts = attempts;
        error.code = 'MESSAGE_RETRY_FAILED';
        error.connectionStable = this.connectionStable;
        return error;
    }

    /**
     * Генерация уникального message ID
     * @returns {string} уникальный ID
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Получить статистику стабильности соединения
     * @returns {Object} статистика
     */
    getConnectionStats() {
        return {
            stable: this.connectionStable,
            consecutiveFailures: this.consecutiveFailures,
            pendingMessages: this.pendingMessages.size,
            activeTimeouts: this.messageTimeouts.size
        };
    }

    /**
     * Очистка всех таймаутов и ресурсов
     */
    cleanup() {
        console.log('[MessageHandler] Cleaning up resources...');

        // Clear all timeouts
        for (const timeoutId of this.messageTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        this.messageTimeouts.clear();
        this.pendingMessages.clear();

        console.log('[MessageHandler] ✅ Cleanup completed');
    }
}

/**
 * Convenience function для быстрой отправки сообщения
 * @param {string} target - target для отправки
 * @param {Object} message - сообщение
 * @param {Object} options - опции
 * @returns {Promise} Promise с результатом
 */
export async function sendResilientMessage(target, message, options = {}) {
    const handler = new AsyncMessageHandler(options);
    try {
        return await handler.sendMessage(target, message, options);
    } finally {
        handler.cleanup();
    }
}

// Экспорт для global использования
if (typeof window !== 'undefined') {
    window.AsyncMessageHandler = AsyncMessageHandler;
    window.sendResilientMessage = sendResilientMessage;
}