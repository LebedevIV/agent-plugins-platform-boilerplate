/**
 * РУЧНОЕ ТЕСТИРОВАНИЕ PYODIDE В OFFSCREEN DOCUMENT CONTEXT
 *
 * Цель: подтвердить возможность работы Python execution architecture
 * для real-world сценариев использования.
 *
 * ТЕСТИРУЕМЫЕ СЦЕНАРИИ:
 * ✅ Базовые вычисления Python: '1 + 2 + 3'
 * ✅ Доступ к системной информации: 'import sys; sys.version'
 * ✅ Доступ к DOM API: 'document.title'
 * ✅ Web API манипуляции: создание и управление DOM элементами
 * ✅ Обработка ошибок: invalid Python code
 * ✅ Safety checks для offscreen document
 * ✅ Comprehensive логирование и сбор результатов
 **/

class PyodideOffscreenManualTester {
    constructor() {
        this.testResults = [];
        this.logger = new TestLogger();
        this.offscreenDocument = null;
        this.pyodideManager = null;

        console.log('🔬 [PyodideOffscreenManualTester] Инициализация тестера...');
    }

    /**
     * ОСНОВНАЯ ФУНКЦИЯ ЗАПУСКА РУЧНОГО ТЕСТИРОВАНИЯ
     */
    async startManualTesting() {
        try {
            this.logger.addEntry('INFO', '=== НАЧАЛО РУЧНОГО ТЕСТИРОВАНИЯ PYODIDE ===');

            // ШАГ 1: Безопасное создание offscreen document
            await this.ensureOffscreenDocument();

            // ШАГ 2: Инициализация Pyodide в offscreen контексте
            await this.initializePyodideInOffscreen();

            // ШАГ 3: Выполнение серии тестов
            await this.runTestSuite();

            // ШАГ 4: Сбор и анализ результатов
            await this.collectAndAnalyzeResults();

            this.logger.addEntry('SUCCESS', '=== РУЧНОЕ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО ===');

            return {
                success: true,
                results: this.testResults,
                logs: this.logger.getAllEntries()
            };

        } catch (error) {
            this.logger.addEntry('CRITICAL', `Тестирование прервано: ${error.message}`);
            console.error('[PyodideOffscreenManualTester] CRITICAL ERROR:', error);

            return {
                success: false,
                error: error.message,
                results: this.testResults,
                logs: this.logger.getAllEntries()
            };
        }
    }

    /**
     * ШАГ 1: БЕЗОПАСНОЕ СОЗДАНИЕ OFFSCREEN DOCUMENT С ПРОВЕРКАМИ
     */
    async ensureOffscreenDocument() {
        this.logger.addEntry('INFO', 'ШАГ 1: Проверка/создание offscreen document...');

        try {
            // Проверка поддержки offscreen API
            if (!this.checkOffscreenAPISupport()) {
                throw new Error('Offscreen API не поддерживается в данной версии Chrome');
            }

            // Проверка наличия существующего offscreen document
            const hasOffscreen = await this.checkExistingOffscreenDocument();
            if (hasOffscreen) {
                this.logger.addEntry('INFO', 'Offscreen document уже существует, пропускаем создание');
                return;
            }

            // Создание нового offscreen document с safety checks
            await this.createSafeOffscreenDocument();

            this.logger.addEntry('SUCCESS', 'Offscreen document успешно создан');
            this.testResults.push({
                test: 'offscreen_creation',
                status: 'PASSED',
                result: 'Offscreen document создан с safety checks'
            });

        } catch (error) {
            this.logger.addEntry('ERROR', `Ошибка создания offscreen document: ${error.message}`);
            this.testResults.push({
                test: 'offscreen_creation',
                status: 'FAILED',
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Проверка поддержки Offscreen API
     */
    checkOffscreenAPISupport() {
        try {
            const support = typeof chrome !== 'undefined' &&
                           typeof chrome.offscreen !== 'undefined' &&
                           typeof chrome.offscreen.hasDocument === 'function' &&
                           typeof chrome.offscreen.createDocument === 'function';

            this.logger.addEntry('INFO', `Offscreen API support: ${support ? 'YES' : 'NO'}`);
            return support;
        } catch (error) {
            this.logger.addEntry('ERROR', `Error checking offscreen API: ${error.message}`);
            return false;
        }
    }

    /**
     * Проверка существующего offscreen document
     */
    async checkExistingOffscreenDocument() {
        try {
            const result = await chrome.offscreen.hasDocument();
            this.logger.addEntry('INFO', `Existing offscreen document: ${result}`);
            return result;
        } catch (error) {
            this.logger.addEntry('ERROR', `Error checking existing offscreen: ${error.message}`);
            return false;
        }
    }

    /**
     * Безопасное создание offscreen document
     */
    async createSafeOffscreenDocument() {
        // Проверки безопасности перед созданием
        await this.performSafetyChecks();

        const creationResult = await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL('offscreen.html'),
            reasons: ['WORKERS'],
            justification: 'Manual Pyodide testing and validation of Python execution architecture'
        });

        this.logger.addEntry('SUCCESS', 'Offscreen document created safely');

        // Ждем небольшую паузу для полной инициализации
        await new Promise(resolve => setTimeout(resolve, 1000));

        return creationResult;
    }

    /**
     * Выполнение safety checks перед созданием
     */
    async performSafetyChecks() {
        const checks = [
            {
                name: 'Chrome Version Check',
                check: () => {
                    const userAgent = navigator.userAgent;
                    const chromeVersion = userAgent.match(/Chrome\/(\d+)/)?.[1];
                    const versionNum = parseInt(chromeVersion || '0');
                    return versionNum >= 109;
                }
            },
            {
                name: 'Memory Usage Check',
                check: () => {
                    // Простая проверка памяти браузера
                    return typeof performance.memory !== 'undefined';
                }
            },
            {
                name: 'Permission Check',
                check: () => {
                    // Проверка наличия необходимых разрешений
                    return typeof chrome.runtime !== 'undefined';
                }
            }
        ];

        for (const safetyCheck of checks) {
            try {
                const result = await safetyCheck.check();
                this.logger.addEntry('INFO', `Safety Check "${safetyCheck.name}": ${result ? 'PASSED' : 'FAILED'}`);

                if (!result) {
                    throw new Error(`Safety check failed: ${safetyCheck.name}`);
                }
            } catch (error) {
                this.logger.addEntry('ERROR', `Safety check error: ${error}`);
                throw error;
            }
        }
    }

    /**
     * ШАГ 2: ИНИЦИАЛИЗАЦИЯ PYODIDE В OFFSCREEN КОНТЕКСТЕ
     */
    async initializePyodideInOffscreen() {
        this.logger.addEntry('INFO', 'ШАГ 2: Инициализация Pyodide в offscreen document...');

        try {
            // Отправляем команду инициализации в offscreen document
            const initResult = await this.sendMessageToOffscreen({
                type: 'INITIALIZE_PYODIDE_MANUAL_TEST',
                timestamp: Date.now(),
                requestId: `init_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            });

            if (!initResult || !initResult.success) {
                throw new Error(`Pyodide initialization failed: ${initResult?.error || 'Unknown error'}`);
            }

            this.logger.addEntry('SUCCESS', 'Pyodide успешно инициализирован в offscreen document');
            this.testResults.push({
                test: 'pyodide_initialization',
                status: 'PASSED',
                result: initResult.result
            });

        } catch (error) {
            this.logger.addEntry('ERROR', `Ошибка инициализации Pyodide: ${error.message}`);
            this.testResults.push({
                test: 'pyodide_initialization',
                status: 'FAILED',
                error: error.message
            });
            throw error;
        }
    }

    /**
     * ШАГ 3: ВЫПОЛНЕНИЕ СЕРИИ ТЕСТОВ
     */
    async runTestSuite() {
        this.logger.addEntry('INFO', 'ШАГ 3: Запуск серии тестов...');

        const testCases = [
            {
                name: 'basic_calculation',
                description: 'Basal арифметика Python: 1 + 2 + 3',
                code: '1 + 2 + 3',
                expected: true // Просто проверяем, что выполняется без ошибки
            },
            {
                name: 'system_access',
                description: 'Доступ к системной информации: sys.version',
                code: 'import sys; sys.version',
                expected: true
            },
            {
                name: 'dom_access',
                description: 'Доступ к DOM API: document.title',
                code: 'document.title',
                expected: true
            },
            {
                name: 'web_api_manipulation',
                description: 'Создание и управление DOM элементами',
                code: `
# Создание и манипуляция DOM элементом
import js
element = js.document.createElement('div')
element.innerHTML = 'Pyodide Test Element'
element.style.color = 'blue'
js.document.body.appendChild(element)
result = f"Created element with text: {element.innerHTML}"
result
                `,
                expected: true
            }
        ];

        for (const testCase of testCases) {
            await this.runIndividualTest(testCase);
            // Небольшая пауза между тестами
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Запуск тестов ошибок
        await this.runErrorTests();
    }

    /**
     * Выполнение индивидуального теста
     */
    async runIndividualTest(testCase) {
        this.logger.addEntry('INFO', `Выполнение теста: ${testCase.name}`);

        try {
            const startTime = performance.now();

            // Отправка тестового кода в offscreen document
            const testResult = await this.sendMessageToOffscreen({
                type: 'EXECUTE_PYTHON_TEST_CODE',
                code: testCase.code,
                testName: testCase.name,
                requestId: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now()
            });

            const executionTime = Math.round(performance.now() - startTime);

            if (testResult && testResult.success) {
                this.logger.addEntry('SUCCESS', `✅ Тест "${testCase.name}" пройден (${executionTime}ms): ${testResult.result}`);
                this.testResults.push({
                    test: testCase.name,
                    status: 'PASSED',
                    description: testCase.description,
                    result: testResult.result,
                    executionTime: executionTime
                });
            } else {
                throw new Error(testResult?.error || `Test execution failed for ${testCase.name}`);
            }

        } catch (error) {
            this.logger.addEntry('ERROR', `❌ Тест "${testCase.name}" провален: ${error.message}`);
            this.testResults.push({
                test: testCase.name,
                status: 'FAILED',
                description: testCase.description,
                error: error.message
            });
        }
    }

    /**
     * Выполнение тестов обработки ошибок
     */
    async runErrorTests() {
        this.logger.addEntry('INFO', 'Выполнение тестов обработки ошибок...');

        const errorTestCases = [
            {
                name: 'invalid_syntax',
                code: 'print("Missing parenthesis)',
                expectedError: true
            },
            {
                name: 'undefined_variable',
                code: 'print(unknown_variable)',
                expectedError: true
            },
            {
                name: 'import_error',
                code: 'import nonexistent_module_12345',
                expectedError: true
            }
        ];

        for (const errorTest of errorTestCases) {
            await this.runErrorTest(errorTest);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    /**
     * Выполнение индивидуального теста ошибок
     */
    async runErrorTest(errorTest) {
        this.logger.addEntry('INFO', `Выполнение error теста: ${errorTest.name}`);

        try {
            const testResult = await this.sendMessageToOffscreen({
                type: 'EXECUTE_PYTHON_ERROR_TEST',
                code: errorTest.code,
                testName: errorTest.name,
                requestId: `error_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now()
            });

            // Ожидаем ошибку от Python кода
            if (testResult && !testResult.success && testResult.error) {
                this.logger.addEntry('SUCCESS', `✅ Error тест "${errorTest.name}" прошел корректно: ${testResult.error}`);
                this.testResults.push({
                    test: errorTest.name,
                    status: 'PASSED',
                    description: 'Error handling test',
                    result: 'Correctly caught error: ' + testResult.error
                });
            } else {
                throw new Error(`Error test should have failed but succeeded: ${testResult?.result}`);
            }

        } catch (error) {
            this.logger.addEntry('ERROR', `❌ Error тест "${errorTest.name}" провален: ${error.message}`);
            this.testResults.push({
                test: errorTest.name,
                status: 'FAILED',
                description: 'Error handling test',
                error: error.message
            });
        }
    }

    /**
     * ШАГ 4: СБОР И АНАЛИЗ РЕЗУЛЬТАТОВ
     */
    async collectAndAnalyzeResults() {
        this.logger.addEntry('INFO', 'ШАГ 4: Сбор и анализ результатов тестирования...');

        const summary = {
            totalTests: this.testResults.length,
            passedTests: this.testResults.filter(t => t.status === 'PASSED').length,
            failedTests: this.testResults.filter(t => t.status === 'FAILED').length,
            successRate: 0,
            criticalTests: ['offscreen_creation', 'pyodide_initialization'],
            criticalPassed: true,
            details: this.testResults
        };

        summary.successRate = Math.round((summary.passedTests / summary.totalTests) * 100);

        // Проверка критических тестов
        for (const criticalTest of summary.criticalTests) {
            const criticalResult = summary.details.find(t => t.test === criticalTest);
            if (!criticalResult || criticalResult.status !== 'PASSED') {
                summary.criticalPassed = false;
                break;
            }
        }

        // Логирование сводки
        this.logger.addEntry('SUMMARY', `
=== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===
Всего тестов: ${summary.totalTests}
Пройдено: ${summary.passedTests}
Провалено: ${summary.failedTests}
Успешность: ${summary.successRate}%
Критические тесты: ${summary.criticalPassed ? '✅ ПРОШЛИ' : '❌ НЕ ПРОШЛИ'}
        `);

        // Детальный анализ результатов
        this.logger.addEntry('ANALYSIS', '=== ПОДРОБНЫЙ АНАЛИЗ ===');
        summary.details.forEach(test => {
            const statusIcon = test.status === 'PASSED' ? '✅' : '❌';
            const timeInfo = test.executionTime ? ` (${test.executionTime}ms)` : '';
            this.logger.addEntry('ANALYSIS', `${statusIcon} ${test.test}: ${test.status}${timeInfo}`);
            if (test.error) {
                this.logger.addEntry('ANALYSIS', `   Error: ${test.error}`);
            } else if (test.result) {
                this.logger.addEntry('ANALYSIS', `   Result: ${JSON.stringify(test.result)}`);
            }
        });

        return summary;
    }

    /**
     * ПОМОГАЮЩИЕ МЕТОДЫ
     */

    /**
     * Отправка сообщения в offscreen document
     */
    async sendMessageToOffscreen(message) {
        try {
            const response = await chrome.runtime.sendMessage(message);

            if (response) {
                this.logger.addEntry('DEBUG', `Offscreen response received for ${message.type}`);
                return response;
            } else {
                throw new Error('No response from offscreen document');
            }
        } catch (error) {
            this.logger.addEntry('ERROR', `Communication error with offscreen: ${error.message}`);
            throw error;
        }
    }

    /**
     * Получение результатов тестирования
     */
    getTestResults() {
        return {
            summary: this.analyzeResults(),
            details: this.testResults,
            logs: this.logger.getAllEntries()
        };
    }

    /**
     * Анализ результатов
     */
    analyzeResults() {
        const passed = this.testResults.filter(t => t.status === 'PASSED').length;
        const total = this.testResults.length;
        const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;

        return {
            total,
            passed,
            failed: total - passed,
            successRate,
            architectureReady: successRate >= 80,
            criticalTestsOk: this.testResults
                .filter(t => ['offscreen_creation', 'pyodide_initialization'].includes(t.test))
                .every(t => t.status === 'PASSED')
        };
    }

    /**
     * Вывод результатов в консоль
     */
    logResultsToConsole() {
        console.log('\n🧪 === РУЧНОЕ ТЕСТИРОВАНИЕ PYODIDE ЗАВЕРШЕНО ===');
        console.log(`📊 PASSED: ${this.analyzeResults().passed}/${this.analyzeResults().total}`);
        console.log(`📈 SUCCESS RATE: ${this.analyzeResults().successRate}%`);
        console.log(`🏗️ ARCHITECTURE READY: ${this.analyzeResults().architectureReady ? 'YES' : 'NO'}`);

        console.log('\n📝 DETAILS:');
        this.testResults.forEach(test => {
            const icon = test.status === 'PASSED' ? '✅' : '❌';
            console.log(`${icon} ${test.test}: ${test.error || test.result || 'No details'}`);
        });

        console.log('\n📋 LOGS:');
        this.logger.getAllEntries().forEach(entry => {
            const time = new Date(entry.timestamp).toLocaleTimeString();
            console.log(`[${time}] [${entry.level}] ${entry.message}`);
        });
    }
}

/**
 * ЛОГГЕР ДЛЯ ТЕСТИРОВАНИЯ
 */
class TestLogger {
    constructor() {
        this.entries = [];
    }

    addEntry(level, message) {
        const entry = {
            timestamp: Date.now(),
            level: level.toUpperCase(),
            message: message
        };

        this.entries.push(entry);

        // Логирование в консоль с цветами
        const colors = {
            'INFO': 'color: blue',
            'SUCCESS': 'color: green',
            'ERROR': 'color: red',
            'CRITICAL': 'color: red; font-weight: bold',
            'WARNING': 'color: orange',
            'DEBUG': 'color: gray',
            'SUMMARY': 'color: purple; font-weight: bold',
            'ANALYSIS': 'color: purple'
        };

        const style = colors[level.toUpperCase()] || 'color: black';
        console.log(`%c[${level.toUpperCase()}] ${message}`, style);
    }

    getAllEntries() {
        return [...this.entries];
    }

    getEntriesByLevel(level) {
        return this.entries.filter(entry => entry.level === level.toUpperCase());
    }
}

/**
 * ГЛОБАЛЬНЫЕ ПОМОГАЮЩИЕ ФУНКЦИИ
 */

/**
 * Быстрый запуск тестирования из консоли
 */
function startPyodideManualTest() {
    console.log('🚀 Запуск ручного тестирования Pyodide в offscreen context...');

    const tester = new PyodideOffscreenManualTester();

    return tester.startManualTesting()
        .then(result => {
            tester.logResultsToConsole();
            return result;
        })
        .catch(error => {
            console.error('🛑 Критическая ошибка в тестировании:', error);
            throw error;
        });
}

/**
 * Получение статистики тестирования
 */
function getPyodideTestStats() {
    // Пока нет активного тестирования, возвращаем информацию
    return {
        message: 'Используйте startPyodideManualTest() для запуска тестирования',
        availableTests: [
            'offscreen_creation',
            'pyodide_initialization',
            'basic_calculation',
            'system_access',
            'dom_access',
            'web_api_manipulation',
            'error_handling'
        ]
    };
}

// Экспорт для использования в виде модуля
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PyodideOffscreenManualTester,
        TestLogger,
        startPyodideManualTest,
        getPyodideTestStats
    };
}

// Регистрация глобальных функций
if (typeof window !== 'undefined') {
    window.startPyodideManualTest = startPyodideManualTest;
    window.PyodideOffscreenManualTester = PyodideOffscreenManualTester;
    window.getPyodideTestStats = getPyodideTestStats;
}

console.log('🔬 [PyodideOffscreenManualTester] Модуль ручного тестирования загружен');
console.log('📖 Используйте startPyodideManualTest() для начала тестирования');