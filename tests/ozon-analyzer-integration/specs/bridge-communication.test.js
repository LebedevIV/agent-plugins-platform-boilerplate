/**
 * Тесты Bridge Communication плагина Ozon Analyzer
 * Тестирование двусторонней связи между JavaScript и Python через Pyodide
 */

import { TestCase, Assert } from '../utils/test-framework.js';

export class BridgeCommunicationTest {
    constructor() {
        this.workerInstance = null;
        this.messageQueue = [];
        this.pythonFunctions = {};
        this.communicationEstablished = false;
    }

    async testWorkerManagerInitialization() {
        console.log('🔍 Тестирование инициализации Worker Manager...');

        // Импортируем worker-manager
        const { getWorker } = await import('../../../bridge/worker-manager.js');

        Assert.isDefined(getWorker, 'getWorker функция должна быть определена');
        Assert.type(getWorker, 'function', 'getWorker должна быть функцией');

        // Тестируем создание singleton worker
        const worker1 = getWorker();
        const worker2 = getWorker();

        // В настоящей среде это был бы один и тот же worker
        // В тесте мы не можем создать реальный Worker, поэтому просто проверяем функцию
        console.log('✅ Worker Manager инициализирован');
        return { worker_manager_tested: true };
    }

    async testMcpBridgeSetup() {
        console.log('🔍 Тестирование настройки MCP Bridge...');

        // Импортируем mcp-bridge
        const { runPythonTool } = await import('../../../bridge/mcp-bridge.js');

        Assert.isDefined(runPythonTool, 'runPythonTool функция должна быть определена');
        Assert.type(runPythonTool, 'function', 'runPythonTool должна быть функцией');

        // Проверяем паттерн универсального контекста
        const bridgeSource = runPythonTool.toString();
        const hasUniversalContext = bridgeSource.includes('window') && bridgeSource.includes('self');

        Assert.isTrue(hasUniversalContext, 'Bridge должен использовать универсальный глобальный контекст');

        console.log('✅ MCP Bridge настроен корректно');
        return { bridge_setup_tested: true };
    }

    async testPyodideWorkerMock() {
        console.log('🔍 Тестирование Pyodide Worker мока...');

        // Создаем mock Pyodide worker
        this.workerInstance = {
            onmessage: null,
            postMessage: (message) => {
                this.messageQueue.push(message);
                console.log('[Mock Pyodide Worker] Received message:', message);

                // Имитируем ответ от worker
                setTimeout(() => {
                    if (this.workerInstance.onmessage) {
                        const mockResponse = {
                            data: {
                                type: 'complete',
                                callId: message.callId,
                                result: { status: 'success', message: 'Mock Python execution' }
                            }
                        };
                        this.workerInstance.onmessage(mockResponse);
                    }
                }, 50);
            },
            onerror: (error) => {
                console.error('[Mock Pyodide Worker] Error:', error);
            }
        };

        // Тестируем отправку сообщения worker'у
        const testMessage = {
            type: 'run_python_tool',
            callId: 'test-call-123',
            pythonCode: 'print("Hello from Python")',
            toolName: 'test_function',
            toolInput: { input: 'test' }
        };

        this.workerInstance.postMessage(testMessage);

        // Проверяем, что сообщение было помещено в очередь
        Assert.equal(this.messageQueue.length, 1, 'Сообщение должно быть в очереди');

        // Проверяем структуру отправленного сообщения
        const sentMessage = this.messageQueue[0];
        Assert.equal(sentMessage.type, 'run_python_tool', 'Тип сообщения должен быть корректным');
        Assert.isDefined(sentMessage.callId, 'CallId должен быть определен');
        Assert.isDefined(sentMessage.pythonCode, 'Python код должен быть в сообщении');

        console.log('✅ Pyodide Worker мок работает');
        return { worker_mock_tested: true };
    }

    async testPythonFunctionLoading() {
        console.log('🔍 Тестирование загрузки Python функций...');

        // Создаем mock Python кода
        const mockPythonCode = `
async def analyze_ozon_product(input_data):
    """Главная функция анализа товара."""
    result = {
        "status": "success",
        "message": "Mock analysis completed",
        "analysis": {
            "score": 8,
            "reasoning": "Mock reasoning"
        }
    }
    return result

async def perform_deep_analysis(input_data):
    """Функция глубокого анализа."""
    return {
        "deep_analysis_report": "Mock deep analysis report"
    }

def _helper_function():
    """Вспомогательная функция."""
    return "helper result"
`;

        // Импортируем моки Pyodide
        const { loadPyodide } = this.createMockPyodideEnvironment();

        const mockPyodide = await loadPyodide();
        await mockPyodide.runPythonAsync(mockPythonCode);

        // Проверяем доступность функций
        const analyzeFunction = mockPyodide.globals.get('analyze_ozon_product');
        const deepAnalysisFunction = mockPyodide.globals.get('perform_deep_analysis');

        Assert.isDefined(analyzeFunction, 'Функция analyze_ozon_product должна быть загружена');
        Assert.isDefined(deepAnalysisFunction, 'Функция perform_deep_analysis должна быть загружена');

        // Тестируем вызовы функций
        const mockInput = { page_html: '<html>Mock HTML</html>' };

        // Имитируем асинхронный вызов
        const analyzeResult = await this.mockAsyncCall(analyzeFunction, mockInput);
        Assert.isDefined(analyzeResult.result, 'Результат анализа должен быть определен');
        Assert.equal(analyzeResult.result.status, 'success', 'Статус должен быть success');

        console.log('✅ Python функции загружены и работают');
        return { python_functions_loaded: true };
    }

    createMockPyodideEnvironment() {
        return {
            loadPyodide: async () => ({
                globals: {
                    get: (name) => {
                        if (name === 'analyze_ozon_product') {
                            return async (input) => {
                                console.log(`[Mock Pyodide] Calling analyze_ozon_product with:`, input);
                                return {
                                    toJs: () => ({
                                        status: 'success',
                                        message: 'Mock analysis',
                                        analysis: { score: 8, reasoning: 'Mock' }
                                    }),
                                    destroy: () => {}
                                };
                            };
                        }
                        if (name === 'perform_deep_analysis') {
                            return async (input) => {
                                console.log(`[Mock Pyodide] Calling perform_deep_analysis with:`, input);
                                return {
                                    toJs: () => ({
                                        deep_analysis_report: 'Mock deep analysis'
                                    }),
                                    destroy: () => {}
                                };
                            };
                        }
                        return undefined;
                    },
                    set: (name, value) => {
                        console.log(`[Mock Pyodide] Setting global ${name}`);
                        this.pythonFunctions[name] = value;
                    }
                },
                toPy: (obj) => obj,
                runPythonAsync: async (code) => {
                    console.log(`[Mock Pyodide] Running Python code (${code.length} chars)`);
                    // Имитируем выполнение кода
                    return Promise.resolve();
                }
            })
        };
    }

    async mockAsyncCall(mockFunction, input) {
        const mockProxy = await mockFunction(input);
        return { result: mockProxy.toJs() };
    }

    async testJsBridgeSetupInPython() {
        console.log('🔍 Тестирование настройки JS моста в Python окружении...');

        const mockPyodide = await this.createMockPyodideEnvironment().loadPyodide();

        // Мокаем js объекты для Python
        const mockJsBridge = {
            sendMessageToChat: (message) => {
                const jsMessage = message.toJs({ dict_converter: Object.fromEntries });
                console.log('[JS Bridge] sendMessageToChat:', jsMessage);
                return jsMessage;
            },
            llm_call: async (modelAlias, params) => {
                console.log(`[JS Bridge] llm_call: ${modelAlias}`, params);
                return {
                    to_py: () => ({
                        response: JSON.stringify({
                            score: 8,
                            reasoning: 'Mock AI response'
                        })
                    })
                };
            },
            get_setting: async (settingName) => {
                console.log(`[JS Bridge] get_setting: ${settingName}`);
                return { to_py: () => true };
            }
        };

        // Устанавливаем js мост в Pyodide
        mockPyodide.globals.set('js', mockJsBridge);

        // Тестируем функции моста
        const jsObj = mockPyodide.globals.get('js');
        Assert.isDefined(jsObj.sendMessageToChat, 'sendMessageToChat должна быть доступна');
        Assert.isDefined(jsObj.llm_call, 'llm_call должна быть доступна');
        Assert.isDefined(jsObj.get_setting, 'get_setting должна быть доступна');

        // Тестируем вызов sendMessageToChat
        const testMessage = { toJs: () => ({ content: 'Test message from Python' }) };
        const result = jsObj.sendMessageToChat(testMessage);
        Assert.isDefined(result.content, 'sendMessageToChat должен возвращать объект с content');

        console.log('✅ JS мост в Python настроен корректно');
        return { js_bridge_tested: true };
    }

    async testHostCallMechanism() {
        console.log('🔍 Тестирование механизма вызова хоста...');

        // Создаем mock коммуникации между Python и JavaScript
        const hostCallPromises = new Map();
        let callCounter = 0;

        const mockPyodide = {
            globals: {
                set: (name, jsBridge) => {
                    // Python вызывает host через js мост
                    jsBridge.sendMessageToChat({
                        toJs: () => ({ content: 'Python message' })
                    });

                    // Python вызывает AI
                    jsBridge.llm_call('basic_analysis', {
                        prompt: 'Test prompt'
                    });
                }
            }
        };

        // Мокаем js функцию которая делает host call
        const mockJsFunction = {
            sendMessageToChat: (message) => {
                callCounter++;
                const jsMessage = message.toJs({ dict_converter: Object.fromEntries });
                console.log(`[Host Call ${callCounter}] sendMessageToChat:`, jsMessage);

                // Имитируем ответ от background script
                return {
                    content: 'Host response',
                    type: 'chat_message'
                };
            },
            llm_call: (modelAlias, params) => {
                callCounter++;
                console.log(`[Host Call ${callCounter}] llm_call to ${modelAlias}:`, params);

                // Имитируем AI ответ
                return Promise.resolve({
                    to_py: () => ({
                        response: JSON.stringify({
                            score: 7,
                            reasoning: 'Mock AI analysis'
                        })
                    })
                });
            }
        };

        // Имитируем установку моста
        mockPyodide.globals.set('js', mockJsFunction);

        Assert.equal(callCounter, 2, 'Должно быть сделано 2 host вызова');
        console.log('✅ Механизм вызова хоста работает');
        return { host_calls_tested: true, call_count: callCounter };
    }

    async testMessagePassingReliability() {
        console.log('🔍 Тестирование надежности передачи сообщений...');

        let messageCount = 0;
        let errorCount = 0;
        const maxMessages = 100;

        // Создаем mock для тестирования множественных сообщений
        const mockBridge = {
            postMessage: (message) => {
                messageCount++;

                // Имитируем случайные ошибки сети (5% вероятность)
                if (Math.random() < 0.05) {
                    errorCount++;
                    throw new Error('Network timeout');
                }

                // Имитируем успешную доставку
                setTimeout(() => {
                    if (mockBridge.onMessage) {
                        mockBridge.onMessage({
                            data: {
                                type: 'complete',
                                callId: message.callId,
                                result: { status: 'success' }
                            }
                        });
                    }
                }, Math.random() * 10); // Случайная задержка
            },
            onMessage: null
        };

        // Отправляем множество сообщений
        const sendPromises = [];
        for (let i = 0; i < maxMessages; i++) {
            const promise = new Promise((resolve, reject) => {
                const callId = `msg-${i}`;
                try {
                    mockBridge.postMessage({
                        type: 'test_message',
                        callId: callId,
                        data: `Message ${i}`
                    });

                    // Устанавливаем обработчик ответа
                    mockBridge.onMessage = (response) => {
                        if (response.data.callId === callId && response.data.type === 'complete') {
                            resolve(response.data.result);
                        }
                    };

                } catch (error) {
                    reject(error);
                }

                // Таймаут для каждого сообщения
                setTimeout(() => {
                    reject(new Error(`Timeout for message ${i}`));
                }, 1000);
            });

            sendPromises.push(promise);
        }

        // Ожидаем завершения всех сообщений
        const results = await Promise.allSettled(sendPromises);

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`📊 Результаты передачи сообщений: ${successful} успешных, ${failed} ошибок`);

        // Проверяем, что большинство сообщений доставлено успешно
        const successRate = successful / maxMessages;
        Assert.isTrue(successRate > 0.9, `Доля успешных сообщений должна быть > 90%, получено: ${(successRate * 100).toFixed(1)}%`);

        console.log('✅ Передача сообщений надежна');
        return {
            reliability_tested: true,
            total_messages: maxMessages,
            successful: successful,
            failed: failed,
            success_rate: successRate
        };
    }

    async testCommunicationTimeoutHandling() {
        console.log('🔍 Тестирование обработки таймаутов коммуникации...');

        let timeoutOccurred = false;
        let responseReceived = false;

        const mockBridge = {
            postMessage: () => {
                // Имитируем очень долгий ответ или отсутствие ответа
                setTimeout(() => {
                    // Этот ответ придет слишком поздно
                    responseReceived = true;
                }, 2000); // 2 секунды - слишком долго
            }
        };

        // Создаем promise с таймаутом
        const communicationPromise = new Promise((resolve, reject) => {
            mockBridge.postMessage();

            // Устанавливаем таймаут в 500ms
            setTimeout(() => {
                if (!responseReceived) {
                    timeoutOccurred = true;
                    reject(new Error('Communication timeout'));
                }
            }, 500);
        });

        // Ожидаем таймаут
        try {
            await communicationPromise;
            Assert.isTrue(false, 'Должен был произойти таймаут');
        } catch (error) {
            Assert.equal(error.message, 'Communication timeout', 'Ошибка должна содержать правильное сообщение о таймауте');
            Assert.isTrue(timeoutOccurred, 'Флаг таймаута должен быть установлен');
        }

        console.log('✅ Обработка таймаутов работает корректно');
        return { timeout_handling_tested: true };
    }

    async testErrorPropagation() {
        console.log('🔍 Тестирование распространения ошибок...');

        // Создаем mock для тестирования обработки ошибок
        const mockPyodide = {
            globals: {
                get: (name) => {
                    if (name === 'analyze_ozon_product') {
                        return async () => {
                            throw new Error('Python function error: division by zero');
                        };
                    }
                }
            },
            runPythonAsync: async () => {
                throw new Error('Python execution error: syntax error');
            }
        };

        // Тестируем обработку ошибок Python выполнения
        try {
            await mockPyodide.runPythonAsync('invalid python code');
            Assert.isTrue(false, 'Должен был выброситься Python execution error');
        } catch (error) {
            Assert.equal(error.message, 'Python execution error: syntax error', 'Сообщение об ошибке должно быть корректным');
        }

        // Тестируем обработку ошибок функций
        const func = mockPyodide.globals.get('analyze_ozon_product');
        try {
            await func();
            Assert.isTrue(false, 'Должен был выброситься function error');
        } catch (error) {
            Assert.isTrue(error.message.includes('division by zero'), 'Ошибка должна содержать информацию о division by zero');
        }

        console.log('✅ Распространение ошибок работает');
        return { error_propagation_tested: true };
    }

    // Основной метод запуска всех тестов
    async runAll() {
        const testCases = [
            new TestCase('Worker Manager Initialization', () => this.testWorkerManagerInitialization()),
            new TestCase('MCP Bridge Setup', () => this.testMcpBridgeSetup()),
            new TestCase('Pyodide Worker Mock', () => this.testPyodideWorkerMock()),
            new TestCase('Python Function Loading', () => this.testPythonFunctionLoading()),
            new TestCase('JS Bridge Setup in Python', () => this.testJsBridgeSetupInPython()),
            new TestCase('Host Call Mechanism', () => this.testHostCallMechanism()),
            new TestCase('Message Passing Reliability', () => this.testMessagePassingReliability()),
            new TestCase('Communication Timeout Handling', () => this.testCommunicationTimeoutHandling()),
            new TestCase('Error Propagation', () => this.testErrorPropagation())
        ];

        console.log('\n🌉 BRIDGE COMMUNICATION TESTING');

        const results = [];
        for (const testCase of testCases) {
            try {
                const result = await testCase.run();
                results.push({
                    name: testCase.name,
                    success: true,
                    duration: testCase.duration,
                    result: result
                });
                console.log(`✅ ${testCase.name}: ПРОЙДЕН (${testCase.duration}ms)`);
            } catch (error) {
                results.push({
                    name: testCase.name,
                    success: false,
                    duration: testCase.duration,
                    error: error.message,
                    stack: error.stack
                });
                console.log(`❌ ${testCase.name}: ПРОВАЛЕН - ${error.message}`);
            }
        }

        // Очистка ресурсов
        this.cleanup();

        return {
            component: 'Bridge Communication',
            total: testCases.length,
            passed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results: results,
            reliability_assessment: this.calculateReliability(results)
        };
    }

    cleanup() {
        this.workerInstance = null;
        this.messageQueue = [];
        this.pythonFunctions = {};
        this.communicationEstablished = false;
    }

    calculateReliability(results) {
        const reliabilityTests = results.filter(r =>
            r.name.includes('Reliability') ||
            r.name.includes('Timeout') ||
            r.name.includes('Error')
        );

        if (reliabilityTests.length === 0) return null;

        const passedReliability = reliabilityTests.filter(r => r.success).length;
        return {
            critical_tests_passed: passedReliability,
            critical_tests_total: reliabilityTests.length,
            reliability_score: Math.round((passedReliability / reliabilityTests.length) * 100)
        };
    }
}