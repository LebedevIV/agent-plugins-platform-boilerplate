/**
 * Helper файл для поддержки интеграционного тестирования
 * Добавляет тестовые обработчики сообщений для Offscreen Document теста
 * НЕ ИЗМЕНЯЕТ ПРОДАКШН КОД - только расширяет для тестирования
 */

/// <reference types="chrome"/>

// Тестовые обработчики для интеграционного тестирования
class TestMessageHandlers {
    constructor() {
        this.testMode = false;
    }

    enableTestMode() {
        if (this.testMode) return;

        this.testMode = true;
        this.setupTestMessageHandlers();

        console.log('[TEST-HELPERS] Режим тестирования активирован');
    }

    disableTestMode() {
        this.testMode = false;
        console.log('[TEST-HELPERS] Режим тестирования деактивирован');
    }

    setupTestMessageHandlers() {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            console.warn('[TEST-HELPERS] Chrome runtime недоступен, нельзя установить тестовые обработчики');
            return;
        }

        // Обработчик для тестовых сообщений
        const testHandler = (message, sender, sendResponse) => {
            if (!this.testMode) return false;

            if (typeof message === 'object' && message !== null && 'type' in message) {
                return this.handleTestMessage(message, sender, sendResponse);
            }

            return false;
        };

        // Добавляем обработчик в начало цепочки
        const originalOnMessage = chrome.runtime.onMessage;

        // Заменяем обработчик для добавления тестового режима
        chrome.runtime.onMessage = {
            addListener: (listener) => {
                // Запоминаем оригинальный обработчик
                const originalListener = originalOnMessage.addListener.bind(originalOnMessage);

                // Создаем композитный обработчик
                const compositeHandler = (message, sender, sendResponse) => {
                    // Сначала пытаемся обработать через тестовый обработчик
                    const testResult = testHandler(message, sender, sendResponse);
                    if (testResult !== false) {
                        return testResult;
                    }

                    // Если тестовый обработчик не сработал, передаем оригинальному
                    return listener(message, sender, sendResponse);
                };

                // Добавляем композитный обработчик
                originalListener(compositeHandler);
            },

            removeListener: originalOnMessage.removeListener.bind(originalOnMessage),
            hasListeners: originalOnMessage.hasListeners.bind(originalOnMessage),
            hasListener: originalOnMessage.hasListener.bind(originalOnMessage)
        };

        console.log('[TEST-HELPERS] Тестовые обработчики установлены');
    }

    handleTestMessage(message, sender, sendResponse) {
        console.log('[TEST-HELPERS] Обработка тестового сообщения:', message.type);

        switch (message.type) {
            case 'GET_PYODIDE_STATUS':
                return this.handleGetPyodideStatus(sendResponse);

            case 'EXECUTE_PYTHON_CODE':
                return this.handleExecutePythonCode(message.data, sendResponse);

            case 'GET_WORKFLOW_STATUS':
                return this.handleGetWorkflowStatus(sendResponse);

            case 'EXECUTE_TEST_WORKFLOW':
                return this.handleExecuteTestWorkflow(message.data, sendResponse);

            case 'GET_WORKFLOW_LOGS':
                return this.handleGetWorkflowLogs(message.data, sendResponse);

            default:
                return false;
        }
    }

    handleGetPyodideStatus(sendResponse) {
        console.log('[TEST-HELPERS] Проверка статуса Pyodide');

        // Проверяем offscreen документ
        chrome.offscreen.hasDocument().then(hasDoc => {
            if (!hasDoc) {
                sendResponse({
                    isReady: false,
                    error: 'Offscreen document not available',
                    timestamp: Date.now()
                });
                return;
            }

            // Отправляем запрос в offscreen документ через message
            chrome.runtime.sendMessage({
                type: 'get_status'
            }, response => {
                if (chrome.runtime.lastError) {
                    sendResponse({
                        isReady: false,
                        error: chrome.runtime.lastError.message,
                        timestamp: Date.now()
                    });
                    return;
                }

                // Обогащаем ответ дополнительными тестами
                const enhancedResponse = {
                    ...response,
                    initializationTime: response.timestamp ? (Date.now() - response.timestamp) : null,
                    timestamp: Date.now()
                };

                sendResponse(enhancedResponse);
            });

        }).catch(error => {
            sendResponse({
                isReady: false,
                error: error.message,
                timestamp: Date.now()
            });
        });

        return true;
    }

    handleExecutePythonCode(data, sendResponse) {
        console.log('[TEST-HELPERS] Исполнение Python кода для теста');

        try {
            // Проверяем тело запроса
            if (!data || !data.code) {
                sendResponse({
                    success: false,
                    error: 'Python code not provided',
                    timestamp: Date.now()
                });
                return true;
            }

            // Проверяем offscreen документ
            chrome.offscreen.hasDocument().then(hasDoc => {
                if (!hasDoc) {
                    sendResponse({
                        success: false,
                        error: 'Offscreen document not available',
                        timestamp: Date.now()
                    });
                    return;
                }

                // Отправляем код в offscreen
                chrome.runtime.sendMessage({
                    type: 'call_python_tool',
                    data: {
                        pluginId: 'test-python-runner',
                        toolName: 'execute_code',
                        input: { code: data.code, context: {} }
                    }
                }, response => {
                    if (chrome.runtime.lastError) {
                        sendResponse({
                            success: false,
                            error: chrome.runtime.lastError.message,
                            timestamp: Date.now()
                        });
                        return;
                    }

                    const executionTime = Date.now() - data.timestamp || 0;
                    sendResponse({
                        ...response,
                        executionTime,
                        timestamp: Date.now()
                    });
                });

            }).catch(error => {
                sendResponse({
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                });
            });

        } catch (error) {
            sendResponse({
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }

        return true;
    }

    handleGetWorkflowStatus(sendResponse) {
        console.log('[TEST-HELPERS] Проверка статуса workflow системы');

        chrome.offscreen.hasDocument().then(hasDoc => {
            if (!hasDoc) {
                sendResponse({
                    ready: false,
                    error: 'Offscreen document not available',
                    timestamp: Date.now()
                });
                return;
            }

            chrome.runtime.sendMessage({
                type: 'health_check'
            }, response => {
                if (chrome.runtime.lastError) {
                    sendResponse({
                        ready: false,
                        error: chrome.runtime.lastError.message,
                        timestamp: Date.now()
                    });
                    return;
                }

                // Анализируем готовность системы
                const ready = response && response.status === 'healthy' &&
                               response.components &&
                               ['workflowEngine', 'pyodide', 'memoryManager'].every(comp => response.components[comp]);

                sendResponse({
                    ready,
                    components: response.components,
                    timestamp: Date.now()
                });
            });

        }).catch(error => {
            sendResponse({
                ready: false,
                error: error.message,
                timestamp: Date.now()
            });
        });

        return true;
    }

    handleExecuteTestWorkflow(data, sendResponse) {
        console.log('[TEST-HELPERS] Запуск тестового workflow');

        try {
            // Проверяем данные
            if (!data || !data.pluginId) {
                sendResponse({
                    success: false,
                    error: 'Plugin ID not provided',
                    timestamp: Date.now()
                });
                return true;
            }

            // Подготавливаем простой тестовый workflow
            const testWorkflowPayload = {
                type: 'execute_workflow',
                data: {
                    pluginId: data.pluginId,
                    pageKey: data.pageKey || 'test-key',
                    pageHtml: data.pageHtml || '<html><body>Test page</body></html>',
                    input: { test_mode: true },
                    hostApi: {
                        // Заглушка для тестового API
                        log: (message) => console.log('[TEST-WORKFLOW]', message),
                        fetch: () => ({ success: true })
                    }
                }
            };

            const executionStartTime = Date.now();

            // Отправляем в offscreen
            chrome.runtime.sendMessage(testWorkflowPayload, response => {
                const executionTime = Date.now() - executionStartTime;

                if (chrome.runtime.lastError) {
                    sendResponse({
                        success: false,
                        error: chrome.runtime.lastError.message,
                        executionTime,
                        timestamp: Date.now()
                    });
                    return;
                }

                sendResponse({
                    ...response,
                    executionTime,
                    timestamp: Date.now()
                });
            });

        } catch (error) {
            sendResponse({
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }

        return true;
    }

    handleGetWorkflowLogs(data, sendResponse) {
        console.log('[TEST-HELPERS] Получение логов workflow');

        try {
            // В реальности логи должны храниться и возвращаться workflow системой
            // Для теста возвращаем одну запись
            const logs = [{
                timestamp: Date.now(),
                level: 'info',
                message: 'Test log entry',
                stepId: 'test-step'
            }];

            sendResponse(logs);

        } catch (error) {
            sendResponse({
                error: error.message,
                timestamp: Date.now()
            });
        }

        return true;
    }
}

// Глобальный экземпляр тестовых обработчиков
let testHandlersInstance = null;

function enableIntegrationTesting() {
    if (!testHandlersInstance) {
        testHandlersInstance = new TestMessageHandlers();
    }
    testHandlersInstance.enableTestMode();
    return testHandlersInstance;
}

function disableIntegrationTesting() {
    if (testHandlersInstance) {
        testHandlersInstance.disableTestMode();
        testHandlersInstance = null;
    }
}

// Автоматическая инициализация если файл загружен в браузерной среде
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[TEST-HELPERS] Тестовые helpers загружены и готовы к работе');
    });
}

// Экспорт для модульной системы
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestMessageHandlers, enableIntegrationTesting, disableIntegrationTesting };
}

// Экспорт в глобальную область
if (typeof window !== 'undefined') {
    window.TestMessageHandlers = TestMessageHandlers;
    window.enableIntegrationTesting = enableIntegrationTesting;
    window.disableIntegrationTesting = disableIntegrationTesting;
}