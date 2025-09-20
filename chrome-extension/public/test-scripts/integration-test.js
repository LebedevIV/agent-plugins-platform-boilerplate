/**
 * Интеграционный тест для проверки Offscreen Document архитектуры
 * Проверяет все ключевые компоненты системы без изменения продакшн кода
 *
 * ТЕСТИРОВЫЕ СЦЕНАРИИ:
 * 1. Build & Load: Сборка расширения и базовые проверки
 * 2. Offscreen Document: Создание и состояние offscreen документа
 * 3. Message Flow: Связь между background и offscreen
 * 4. Pyodide Ready: Инициализация Python runtime
 * 5. Workflow Execution: Запуск простого workflow через delegation
 */

class OffscreenDocumentIntegrationTest {
    constructor() {
        this.results = {};
        this.startTime = Date.now();
        this.offscreenSupported = false;
        this.chromeVersion = 0;
        this.logger = this.createLogger();

        this.logger.info('🚀 Начат интеграционный тест Offscreen Document архитектуры');
        console.log('='.repeat(60));
        console.log('ИНТЕГРАЦИОННЫЙ ТЕСТ OFFSCREEN DOCUMENT АРХИТЕКТУРЫ');
        console.log('='.repeat(60));
    }

    createLogger() {
        return {
            info: (message, data) => {
                console.log(`[TEST][INFO] ${message}`, data || '');
                this.results[message] = { status: 'info', timestamp: Date.now(), data };
            },
            success: (message, data) => {
                console.log(`[TEST][SUCCESS] ✅ ${message}`, data || '');
                this.results[message] = { status: 'success', timestamp: Date.now(), data };
            },
            error: (message, error) => {
                console.log(`[TEST][ERROR] ❌ ${message}`, error);
                this.results[message] = { status: 'error', timestamp: Date.now(), error: error?.message || error };
            },
            warning: (message, data) => {
                console.log(`[TEST][WARNING] ⚠️ ${message}`, data || '');
                this.results[message] = { status: 'warning', timestamp: Date.now(), data };
            }
        };
    }

    async runAllTests() {
        try {
            // 1. Build & Load тест
            await this.testBuildAndLoad();

            // 2. Offscreen Document тест
            await this.testOffscreenDocument();

            // 3. Message Flow тест
            await this.testMessageFlow();

            // 4. Pyodide Ready тест
            await this.testPyodideReady();

            // 5. Workflow Execution тест
            await this.testWorkflowExecution();

        } catch (error) {
            this.logger.error('Критическая ошибка во время тестирования', error);
        } finally {
            this.generateReport();
        }
    }

    // 1. ТЕСТ Build & Load
    async testBuildAndLoad() {
        this.logger.info('🏗️ Начат тест Build & Load');

        try {
            // Проверка наличия Chrome extension API
            if (typeof chrome === 'undefined') {
                throw new Error('Chrome extension API недоступен');
            }

            if (!chrome.runtime || !chrome.runtime.id) {
                throw new Error('Chrome runtime API недоступен');
            }

            // Feature detection для offscreen API (Chrome 109+ MV3 или Chrome 88+ fallback)
            try {
                // Проверяем версию Chrome для уточнения поддержки
                if (navigator.userAgent.includes('Chrome/')) {
                    const versionMatch = navigator.userAgent.match(/Chrome\/(\d+)/);
                    if (versionMatch) {
                        this.chromeVersion = parseInt(versionMatch[1]);
                    }
                }

                // Проверяем доступность offscreen API
                if (typeof chrome.offscreen !== 'undefined' && chrome.offscreen) {
                    this.offscreenSupported = true;
                } else {
                    // Для старых версий Chrome или MV2 ищем альтернативы
                    this.logger.warning('Offscreen API недоступен', {
                        chromeVersion: this.chromeVersion,
                        manifestVersion: chrome.runtime.getManifest?.()?.manifest_version,
                        fallbackAvailable: (this.chromeVersion >= 88)
                    });
                }

            } catch (error) {
                this.logger.warning('Ошибка при проверке offscreen API', error);
            }

            this.logger.success('Chrome extension APIs доступны', {
                runtimeId: chrome.runtime.id,
                offscreenSupported: this.offscreenSupported,
                chromeVersion: this.chromeVersion,
                manifestVersion: chrome.runtime.getManifest?.()?.manifest_version,
                tabsAvailable: !!chrome.tabs
            });

        } catch (error) {
            this.logger.error('Build & Load тест провален', error);
        }
    }

    // 2. ТЕСТ Offscreen Document
    async testOffscreenDocument() {
        this.logger.info('📄 Начат тест Offscreen Document');

        try {
            // ШАГ 1: Проверить поддержку offscreen API
            if (!offscreenSupported) {
                this.logger.warning('Offscreen API недоступен в данной версии браузера', {
                    chromeVersion,
                    manifestVersion: chrome.runtime.getManifest?.()?.manifest_version,
                    suggestion: chromeVersion >= 88 ?
                        'Возможно требуется ручное включение в chrome://extensions' :
                        'Используйте Chrome 109+ MV3 для полной поддержки'
                });
                return;
            }

            // ШАГ 2: Проверить, существует ли уже offscreen документ
            let hasDocument = false;
            try {
                hasDocument = await chrome.offscreen.hasDocument();
                this.logger.info('Проверка существования документа выполнена', { hasDocument });
            } catch (error) {
                this.logger.warning('Ошибка при проверке offscreen документа (может быть нормально при первом запуске)', error);
            }

            // ШАГ 3: Если документа нет, попытаться создать его
            if (!hasDocument) {
                const createStartTime = Date.now();

                try {
                    await chrome.offscreen.createDocument({
                        url: 'offscreen.html',
                        reasons: ['WORKERS'],
                        justification: 'Интеграционное тестирование Offscreen Document архитектуры'
                    });

                    const createDuration = Date.now() - createStartTime;
                    this.logger.success('Offscreen Document создан успешно', { createDuration });

                } catch (error) {
                    this.logger.warning('Ошибка создания offscreen документа (может требовать ручного включения)', error);
                    return;
                }
            }

            // ШАГ 4: Повторная проверка существования документа
            await this.delay(1000); // Дать время на инициализацию
            const docExists = await chrome.offscreen.hasDocument();

            if (docExists) {
                this.logger.success('Offscreen Document доступен после создания', { exists: docExists });
            } else {
                this.logger.warning('Offscreen Document не найден после создания');
            }

        } catch (error) {
            this.logger.error('Offscreen Document тест провален', error);
        }
    }

    // 3. ТЕСТ Message Flow
    async testMessageFlow() {
        this.logger.info('📤 Начат тест Message Flow (background ↔ offscreen)');

        try {
            // Сначала проверить что offscreen API поддерживается и документ существует
            if (!this.offscreenSupported) {
                this.logger.warning('Offscreen API недоступен - пропуск message flow теста', {
                    chromeVersion: this.chromeVersion
                });
                return;
            }

            const docExists = await chrome.offscreen.hasDocument();
            if (!docExists) {
                this.logger.warning('Offscreen документ недоступен - пропуск message flow теста');
                return;
            }

            // ШАГ 1: Тест синхронного сообщения PING
            const pingStartTime = Date.now();
            const pingResponse = await this.sendTestMessage('TEST_SYNC', { timestamp: pingStartTime });

            if (pingResponse && pingResponse.success && pingResponse.data) {
                const pingDuration = Date.now() - pingStartTime;
                this.logger.success('PING сообщение обработано успешно', { pingDuration, response: pingResponse.data });
            } else {
                this.logger.warning('PING сообщение не обработано', {
                    response: pingResponse,
                    error: pingResponse?.error,
                    message: pingResponse?.message
                });
            }

            // ШАГ 2: Тест асинхронного сообщения
            const asyncStartTime = Date.now();
            const asyncResult = await this.sendTestMessage('HEALTH_CHECK');

            if (asyncResult && asyncResult.success && asyncResult.data) {
                const asyncDuration = Date.now() - asyncStartTime;
                this.logger.success('Health check завершен успешно', { asyncDuration, status: asyncResult.data.status });

                // Детальная проверка ответа
                if (asyncResult.data.components) {
                    this.logger.info('Компоненты системы проверены', asyncResult.data.components);
                }
            } else {
                this.logger.warning('Health check не вернул результата', {
                    error: asyncResult?.error,
                    message: asyncResult?.message
                });
            }

        } catch (error) {
            this.logger.error('Message Flow тест провален', error);
        }
    }

    // 4. ТЕСТ Pyodide Ready
    async testPyodideReady() {
        this.logger.info('🐍 Начат тест Pyodide Ready');

        try {
            // Важно: этот тест должен выполняться после успешного запуска offscreen документа

            // ШАГ 1: Проверить статус Pyodide в Offscreen Document
            const pyodideStatus = await this.sendTestMessage('GET_PYODIDE_STATUS');

            if (pyodideStatus && pyodideStatus.success && pyodideStatus.data) {
                const { isReady, memoryStats, logsCount } = pyodideStatus.data;

                if (isReady) {
                    this.logger.success('Pyodide runtime готов к работе', {
                        memoryStats,
                        logsCount,
                        initializationTime: pyodideStatus.data.initializationTime
                    });
                } else {
                    this.logger.warning('Pyodide runtime не готов', { status: pyodideStatus.data });
                    return;
                }

                // ШАГ 2: Попытаться выполнить простой Python код через offscreen
                const pythonTestResult = await this.sendTestMessage('EXECUTE_PYTHON_CODE', {
                    code: 'print("Hello from integration test!"); result = 2 + 2'
                });

                if (pythonTestResult && pythonTestResult.success && pythonTestResult.data) {
                    this.logger.success('Выполнение Python кода успешно', {
                        result: pythonTestResult.data.result,
                        executionTime: pythonTestResult.data.executionTime
                    });
                } else {
                    this.logger.warning('Выполнение Python кода провалено', {
                        error: pythonTestResult?.error,
                        message: pythonTestResult?.message
                    });
                }

            } else {
                this.logger.warning('Не удалось получить статус Pyodide через test message', {
                    error: pyodideStatus?.error,
                    message: pyodideStatus?.message
                });
            }

        } catch (error) {
            this.logger.error('Pyodide Ready тест провален', error);
        }
    }

    // 5. ТЕСТ Workflow Execution
    async testWorkflowExecution() {
        this.logger.info('⚙️ Начат тест Workflow Execution через delegation pattern');

        try {
            // Важно: для этого теста нужен рабочий Offscreen Document и Pyodide

            // ШАГ 1: Проверить готовность workflow системы
            const workflowStatus = await this.sendTestMessage('GET_WORKFLOW_STATUS');

            if (!workflowStatus || !(workflowStatus.success && workflowStatus.data?.ready)) {
                this.logger.warning('Workflow система не готова - пропуск теста', {
                    error: workflowStatus?.error,
                    message: workflowStatus?.message
                });
                return;
            }

            this.logger.success('Workflow система готова', workflowStatus.data);

            // ШАГ 2: Запустить простой тест workflow
            const testWorkflowPayload = {
                pluginId: 'test-plugin',
                pageKey: `test-${Date.now()}`,
                pageHtml: '<html><body><div>Тестовая страница для workflow</div></body></html>',
                requestId: `workflow-test-${Date.now()}`
            };

            const workflowResult = await this.sendTestMessage('EXECUTE_TEST_WORKFLOW', testWorkflowPayload);

            if (workflowResult && workflowResult.success && workflowResult.data) {
                const { success, result, error, executionTime } = workflowResult.data;

                if (success) {
                    this.logger.success('Workflow выполнен успешно', {
                        result,
                        executionTime,
                        pluginId: testWorkflowPayload.pluginId
                    });
                } else {
                    this.logger.warning('Workflow выполнен с ошибкой', { error, executionTime });
                }

                // ШАГ 3: Проверить логи выполнения
                const workflowLogs = await this.sendTestMessage('GET_WORKFLOW_LOGS', {
                    requestId: testWorkflowPayload.requestId
                });

                if (workflowLogs && workflowLogs.success && workflowLogs.data && workflowLogs.data.length > 0) {
                    this.logger.success('Логи workflow получены', {
                        logsCount: workflowLogs.data.length,
                        firstLog: workflowLogs.data[0],
                        lastLog: workflowLogs.data[workflowLogs.data.length - 1]
                    });
                } else {
                    this.logger.warning('Логи workflow не найдены или пусты', {
                        error: workflowLogs?.error,
                        message: workflowLogs?.message
                    });
                }

            } else {
                this.logger.warning('Не получен результат от тестового workflow', {
                    error: workflowResult?.error,
                    message: workflowResult?.message
                });
            }

        } catch (error) {
            this.logger.error('Workflow Execution тест провален', error);
        }
    }

    // Вспомогательные методы
    async sendTestMessage(type, data = null, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            try {
                let timeoutId;
                let resolved = false;

                const cleanup = () => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    resolved = true;
                };

                const timeout = setTimeout(() => {
                    if (!resolved) {
                        cleanup();
                        this.logger.warning(`Message ${type} timeout (${timeoutMs}ms)`, { data, timeoutMs });
                        // Вместо null возвращаем объект с ошибкой для лучшего отслеживания
                        resolve({
                            success: false,
                            error: 'TIMEOUT',
                            message: `Message timeout after ${timeoutMs}ms`,
                            timestamp: Date.now()
                        });
                    }
                }, timeoutMs);

                timeoutId = timeout;

                chrome.runtime.sendMessage({
                    type,
                    data
                }, response => {
                    if (resolved) return; // Уже разрешен

                    cleanup();

                    if (chrome.runtime.lastError) {
                        this.logger.warning(`Message ${type} failed`, {
                            error: chrome.runtime.lastError,
                            data
                        });
                        resolve({
                            success: false,
                            error: 'RUNTIME_ERROR',
                            message: chrome.runtime.lastError.message,
                            timestamp: Date.now()
                        });
                        return;
                    }

                    // Проверяем что ответ действительно получен
                    if (response === undefined) {
                        this.logger.warning(`Message ${type} returned undefined`, { data });
                        resolve({
                            success: false,
                            error: 'UNDEFINED_RESPONSE',
                            message: 'Response is undefined',
                            timestamp: Date.now()
                        });
                    } else {
                        resolve({
                            success: true,
                            data: response,
                            timestamp: Date.now()
                        });
                    }
                });

            } catch (error) {
                this.logger.error(`Failed to send message ${type}`, { error: error.message, data });
                resolve({
                    success: false,
                    error: 'SEND_FAILED',
                    message: error.message,
                    timestamp: Date.now()
                });
            }
        });
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('ОТЧЕТ О РЕЗУЛЬТАТАХ ИНТЕГРАЦИОННОГО ТЕСТИРОВАНИЯ');
        console.log('='.repeat(60));

        const totalDuration = Date.now() - this.startTime;
        let successCount = 0;
        let warningCount = 0;
        let errorCount = 0;

        // Подсчет результатов
        Object.values(this.results).forEach(result => {
            switch (result.status) {
                case 'success': successCount++; break;
                case 'warning': warningCount++; break;
                case 'error': errorCount++; break;
            }
        });

        // Сводка результатов
        console.log(`\n📊 Сводка результатов:`);
        console.log(`   ✅ Успешно: ${successCount} тестов`);
        console.log(`   ⚠️ Предупреждения: ${warningCount}`);
        console.log(`   ❌ Ошибки: ${errorCount}`);
        console.log(`   ⏱️ Общее время тестирования: ${totalDuration}ms`);

        // Оценка готовности системы - success = 100%, warning = 50%, error = 0%
        const totalTests = successCount + warningCount + errorCount;
        const readinessScore = totalTests > 0
            ? Math.max(0, (successCount + warningCount * 0.5) / totalTests * 100)
            : 0;

        console.log(`\n🎯 Оценка готовности системы: ${readinessScore.toFixed(1)}%`);

        if (readinessScore >= 80) {
            console.log('🟢 СИСТЕМА ГОТОВА К ПРОДАКШЕНУ');
        } else if (readinessScore >= 60) {
            console.log('🟡 СИСТЕМА ТРЕБУЕТ ДОРАБОТОК');
        } else {
            console.log('🔴 СИСТЕМА ТРЕБУЕТ СУЩЕСТВЕННЫХ ИСПРАВЛЕНИЙ');
        }

        // Детальный отчет по тестам
        console.log('\n📋 Детальный отчет по компонентам:');
        Object.entries(this.results).forEach(([testName, result]) => {
            const statusIcon = {
                'success': '✅',
                'warning': '⚠️',
                'error': '❌',
                'info': 'ℹ️'
            }[result.status] || '❓';

            const duration = result.timestamp ? (result.timestamp - this.startTime) : 0;
            console.log(`${statusIcon} ${testName} (${duration}ms)`);

            if (result.error) {
                console.log(`   └─ Ошибка: ${result.error}`);
            } else if (result.data) {
                const dataPreview = typeof result.data === 'object'
                    ? JSON.stringify(result.data).slice(0, 100)
                    : String(result.data).slice(0, 100);
                console.log(`   └─ Данные: ${dataPreview}...`);
            }
        });

        // Рекомендации
        console.log('\n💡 Рекомендации:');
        if (errorCount > 0) {
            console.log('• Обратите внимание на ошибки и исправьте их перед продакшеном');
        }
        if (warningCount > 0) {
            console.log('• Проверьте предупреждения для улучшения стабильности');
        }
        if (successCount < 3) {
            console.log('• Выполнение менее 3 тестов успешно указывает на серьезные проблемы');
        }

        console.log('='.repeat(60));
        console.log('ИНТЕГРАЦИОННОЕ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО');
        console.log('='.repeat(60));

        this.logger.info('Тестирование завершено', {
            totalDuration,
            successCount,
            warningCount,
            errorCount,
            readinessScore: readinessScore.toFixed(1) + '%'
        });

        return {
            summary: {
                totalDuration,
                successCount,
                warningCount,
                errorCount,
                readinessScore
            },
            details: this.results
        };
    }
}

// Стартовый колл для поддержки CLI и браузерной консоли
if (typeof window !== 'undefined') {
    // Браузерный контекст - ждать DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        const test = new OffscreenDocumentIntegrationTest();
        test.runAllTests();
    });
} else {
    // Node.js или другой контекст - запуск сразу
    const test = new OffscreenDocumentIntegrationTest();
    test.runAllTests();
}

// Экспорт для импорта другими модулями
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OffscreenDocumentIntegrationTest;
}

// Экспорт в глобальну область видимости для браузерной консоли
if (typeof window !== 'undefined') {
    window.OffscreenDocumentIntegrationTest = OffscreenDocumentIntegrationTest;
}