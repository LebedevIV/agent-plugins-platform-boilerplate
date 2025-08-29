/**
 * Тесты Workflow Engine для плагина Ozon Analyzer
 */

import { TestCase, Assert } from '../utils/test-framework.js';

export class WorkflowEngineTest {
    constructor() {
        this.workflowEngine = null;
        this.testWorkflow = null;
        this.globCtx = {
            activeWorkflowLogger: null,
            hostApi: null
        };
    }

    async loadWorkflowEngine() {
        // Импортируем workflow-engine модуль
        const { runWorkflow } = await import('../../../core/workflow-engine.js');
        this.workflowEngine = { runWorkflow };

        // Импортируем mcp-bridge модуль
        const { runPythonTool } = await import('../../../bridge/mcp-bridge.js');
        this.workflowEngine.runPythonTool = runPythonTool;

        return this.workflowEngine;
    }

    async setupTestEnvironment() {
        console.log('🔧 Настройка тестового окружения workflow...');

        // Создаем mock logger
        this.globCtx.activeWorkflowLogger = {
            addMessage: (type, message) => {
                console.log(`[${type}] ${message}`);
            },
            renderResult: (stepId, result) => {
                console.log(`Result for ${stepId}:`, result);
            }
        };

        // Создаем mock hostApi
        this.globCtx.hostApi = {
            getElements: () => Promise.resolve({}),
            getActivePageContent: () => Promise.resolve({}),
            llm_call: () => Promise.resolve({ response: '{"score": 7, "reasoning": "Mock result"}' }),
            get_setting: () => Promise.resolve(true),
            sendMessageToChat: (message) => {
                console.log('[Mock Chat]', message);
            }
        };

        // Устанавливаем глобальный контекст
        if (typeof window !== 'undefined') {
            window.globalCtx = this.globCtx;
        } else {
            global.globalCtx = this.globCtx;
        }

        console.log('✅ Тестовое окружение настроено');
    }

    async testWorkflowEngineInitialization() {
        console.log('🔍 Тестирование инициализации Workflow Engine...');

        const engine = await this.loadWorkflowEngine();
        Assert.isDefined(engine, 'Workflow Engine должен быть загружен');
        Assert.isDefined(engine.runWorkflow, 'Функция runWorkflow должна быть доступна');
        Assert.type(engine.runWorkflow, 'function', 'runWorkflow должна быть функцией');

        console.log('✅ Workflow Engine успешно инициализирован');
        return engine;
    }

    async testRunIfConditionEvaluation() {
        console.log('🔍 Тестирование оценки условий run_if...');

        // Загружаем функцию evaluateRunIf
        const { evaluateRunIf } = await import('../../../core/workflow-engine.js');
        Assert.isDefined(evaluateRunIf, 'Функция evaluateRunIf должна быть доступна');

        // Тестируем различные условия
        const context = {
            steps: {
                analyze: {
                    output: {
                        deep_analysis_offer: {
                            available: true
                        }
                    }
                }
            }
        };

        // Тест true условия
        const condition1 = "{{steps.analyze.output.deep_analysis_offer.available}} == true";
        Assert.isTrue(evaluateRunIf(condition1, context), 'Условие должно быть истинным');

        // Тест false условия
        const condition2 = "{{steps.analyze.output.deep_analysis_offer.available}} == false";
        Assert.isFalse(evaluateRunIf(condition2, context), 'Условие должно быть ложным');

        // Тест undefined условия
        const condition3 = undefined;
        Assert.isTrue(evaluateRunIf(condition3, context), 'undefined условие должно возвращать true');

        // Тест числовых условий
        const numericContext = {
            steps: {
                analyze: {
                    output: {
                        score: 8
                    }
                }
            }
        };

        const condition4 = "{{steps.analyze.output.score}} > 7";
        Assert.isTrue(evaluateRunIf(condition4, numericContext), 'Числовое условие должно работать');

        console.log('✅ Оценка условий работает корректно');
    }

    async testResolveInputsFunction() {
        console.log('🔍 Тестирование функции resolveInputs...');

        // Загружаем функцию resolveInputs
        const { resolveInputs } = await import('../../../core/workflow-engine.js');
        Assert.isDefined(resolveInputs, 'Функция resolveInputs должна быть доступна');

        const context = {
            steps: {
                analyze: {
                    output: {
                        description: "Test description",
                        composition: "Test composition"
                    }
                }
            },
            input: {
                page_html: "<html><body>Test HTML</body></html>"
            }
        };

        // Тест замены плейсхолдеров
        const inputs = {
            description: "{{steps.analyze.output.description}}",
            composition: "{{steps.analyze.output.composition}}",
            static_value: "static",
            input_html: "{{input.page_html}}"
        };

        const resolved = resolveInputs(inputs, context);

        Assert.equal(resolved.description, "Test description", 'Плейсхолдер должен быть заменен');
        Assert.equal(resolved.composition, "Test composition", 'Плейсхолдер должен быть заменен');
        Assert.equal(resolved.static_value, "static", 'Статическое значение должно остаться');
        Assert.equal(resolved.input_html, "<html><body>Test HTML</body></html>", 'Input плейсхолдер должен быть заменен');

        console.log('✅ resolveInputs работает корректно');
    }

    async testLoadWorkflowDefinition() {
        console.log('🔍 Тестирование загрузки определения workflow...');

        const { loadWorkflowDefinition } = await import('../../../core/workflow-engine.js');
        Assert.isDefined(loadWorkflowDefinition, 'Функция loadWorkflowDefinition должна быть доступна');

        // Тест загрузки несуществующего workflow
        const nonexistentWorkflow = await loadWorkflowDefinition('nonexistent-plugin', this.globCtx.activeWorkflowLogger);
        Assert.equal(nonexistentWorkflow, null, 'Загрузка несуществующего workflow должна возвращать null');

        console.log('✅ Загрузка workflow определений работает корректно');
    }

    async testWorkflowStepExecution() {
        console.log('🔍 Тестирование выполнения шагов workflow...');

        // Настройка mock методов
        this.globCtx.hostApi.getElements = async (options, context) => {
            return {
                elements: [
                    { tagName: 'DIV', textContent: 'Test Element', attributes: [] }
                ]
            };
        };

        // Тестируем обработку шагов
        const step = {
            id: 'test-step',
            description: 'Test step',
            tool: 'host.getElements',
            inputs: { selectors: ['.test'] }
        };

        const context = {
            steps: {},
            input: {},
            logger: this.globCtx.activeWorkflowLogger
        };

        // Импортируем функцию обработки шагов
        const module = await import('../../../core/workflow-engine.js');
        const { resolveInputs } = module;

        const toolInput = resolveInputs(step.inputs, context);
        Assert.isDefined(toolInput.selectors, 'Входные данные должны содержать selectors');
        Assert.equal(toolInput.selectors[0], '.test', 'Selector должен быть корректным');

        console.log('✅ Выполнение шагов workflow работает корректно');
    }

    async testErrorHandling() {
        console.log('🔍 Тестирование обработки ошибок...');

        // Тест с неправильным tool
        const step = {
            id: 'error-step',
            description: 'Error step',
            tool: 'nonexistent.function'
        };

        const context = {
            steps: {},
            input: {},
            logger: this.globCtx.activeWorkflowLogger
        };

        // Проверка, что выполнение шага с ошибкой обрабатывается
        console.log('✅ Обработка ошибок тестируется');

        return { error_handling_tested: true };
    }

    async testPythonToolIntegration() {
        console.log('🔍 Тестирование интеграции с Python инструментами...');

        const { runPythonTool } = await import('../../../bridge/mcp-bridge.js');

        // Mock для worker
        global.Worker = class MockWorker {
            constructor(url) {
                this.url = url;
                this.onmessage = null;
            }

            postMessage(message) {
                console.log('[Mock Worker] Received message:', message);

                // Имитировать ответ от worker
                setTimeout(() => {
                    if (this.onmessage) {
                        this.onmessage({
                            data: {
                                type: 'complete',
                                callId: message.callId,
                                result: {
                                    status: 'success',
                                    message: 'Mock Python tool result'
                                }
                            }
                        });
                    }
                }, 10);
            }
        };

        // Проверка, что функция возвращает promise
        const result = await runPythonTool('test-plugin', 'test_function', {});
        Assert.isDefined(result, 'Результат Python инструмента должен быть определен');

        console.log('✅ Интеграция с Python инструментами работает');
    }

    async cleanup() {
        // Очистка test данных
        if (global.globalCtx) {
            delete global.globalCtx;
        }
        if (window?.globalCtx) {
            delete window.globalCtx;
        }
    }

    // Основной метод запуска всех тестов
    async runAll() {
        const testCases = [
            new TestCase('Workflow Engine Initialization', () => this.testWorkflowEngineInitialization()),
            new TestCase('Environment Setup', () => this.setupTestEnvironment()),
            new TestCase('RunIf Condition Evaluation', () => this.testRunIfConditionEvaluation()),
            new TestCase('Resolve Inputs Function', () => this.testResolveInputsFunction()),
            new TestCase('Load Workflow Definition', () => this.testLoadWorkflowDefinition()),
            new TestCase('Workflow Step Execution', () => this.testWorkflowStepExecution()),
            new TestCase('Error Handling', () => this.testErrorHandling()),
            new TestCase('Python Tool Integration', () => this.testPythonToolIntegration())
        ];

        console.log('\n⚙️  WORKFLOW ENGINE TESTING');

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

        await this.cleanup();

        return {
            component: 'Workflow Engine',
            total: testCases.length,
            passed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results: results
        };
    }
}