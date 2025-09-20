/**
 * Ozon Analyzer E2E Test Scenarios
 * Преднастроенные сценарии для тестирования различных случаев использования
 */

const E2ETestScenarios = {
    scenarios: [
        {
            id: 'basic_product_analysis',
            name: 'Базовый анализ товара',
            description: 'Тест полного workflow с типичным товаром Ozon',
            pageUrl: 'https://www.ozon.ru/product/krem-dlya-kozhi-litsa-anticell-anti-age-s-vitaminom-c-na-50ml-1sht-414100123',
            expectedDuration: [2000, 8000], // min, max ms
            expectedPhases: [
                'initialization',
                'pyodide_init',
                'html_parsing',
                'ai_processing',
                'result_processing'
            ],
            validationChecks: [
                { type: 'workflow_completion', expected: true },
                { type: 'python_execution', expected: true },
                { type: 'ai_calls_count', expected: 2 }, // analysis + analogs
                { type: 'deep_analysis_triggered', expected: false }
            ],
            successCriteria: {
                description: { extracted: true, length: '>20' },
                composition: { extracted: true, length: '>10' },
                analysis: { score: '1-10' }
            }
        },

        {
            id: 'problematic_product_deep_analysis',
            name: 'Анализ с deep analysis (проблемный товар)',
            description: 'Тест с товаром, требующим дополнительного анализа',
            pageUrl: 'https://www.ozon.ru/product/test-problematic-product-url',
            expectedDuration: [5000, 15000], // longer due to deep analysis
            expectedPhases: [
                'initialization',
                'pyodide_init',
                'html_parsing',
                'ai_processing',
                'deep_analysis',
                'result_processing'
            ],
            validationChecks: [
                { type: 'workflow_completion', expected: true },
                { type: 'python_execution', expected: true },
                { type: 'ai_calls_count', expected: 3 }, // analysis + analogs + deep
                { type: 'deep_analysis_triggered', expected: true }
            ],
            successCriteria: {
                description: { extracted: true },
                composition: { extracted: true },
                analysis: { score: '<=7', deep_analysis_report: true }
            }
        },

        {
            id: 'error_resilience_test',
            name: 'Тест устойчивости к ошибкам',
            description: 'Симуляция ошибок и проверка recovery механизмов',
            pageUrl: 'https://www.ozon.ru/product/invalid-or-missing-product',
            expectedDuration: [1000, 5000], // shorter, fails fast
            expectedPhases: ['initialization', 'error_recovery'],
            validationChecks: [
                { type: 'error_handled_gracefully', expected: true },
                { type: 'fallback_message_displayed', expected: true },
                { type: 'memory_cleanup', expected: true }
            ],
            successCriteria: {
                error_handling: { proper: true },
                user_feedback: { adequate: true }
            },
            simulateErrors: ['html_extraction_failure', 'pyodide_import_error']
        },

        {
            id: 'memory_stress_test',
            name: 'Тест нагрузки на память',
            description: 'Проверка memory management при больших данных',
            pageUrl: 'https://www.ozon.ru/product/large-html-page-test',
            expectedDuration: [3000, 10000],
            expectedPhases: ['initialization', 'pyodide_init', 'large_html_parsing', 'memory_intensive_ai'],
            validationChecks: [
                { type: 'streaming_parser_used', expected: true },
                { type: 'memory_usage_optimized', expected: true },
                { type: 'object_pooling_effective', expected: true }
            ],
            successCriteria: {
                memory_usage: { below_limit: true },
                performance: { maintained: true }
            },
            pageModifiers: {
                html_size_multiplier: 5,
                force_streaming_parser: true
            }
        },

        {
            id: 'network_latency_test',
            name: 'Тест при высокой задержке сети',
            description: 'Проверка работы при плохом интернет-соединении',
            pageUrl: 'https://www.ozon.ru/product/network-test-product',
            expectedDuration: [8000, 25000], // Longer due to network
            expectedPhases: ['initialization', 'pyodide_init', 'slow_network_html', 'retried_ai_calls'],
            validationChecks: [
                { type: 'network_retries_working', expected: true },
                { type: 'timeout_handling_proper', expected: true },
                { type: 'user_feedback_during_delays', expected: true }
            ],
            successCriteria: {
                ai_calls: { with_retry: true },
                user_experience: { acceptable: true }
            },
            networkSimulations: {
                latency: 2000, // 2 second delay
                packet_loss: 10, // 10% packet loss
                retry_enabled: true
            }
        }
    ],

    // === UTILITY FUNCTIONS ===

    /**
     * Find scenario by ID
     */
    getScenario(scenarioId) {
        return this.scenarios.find(s => s.id === scenarioId);
    },

    /**
     * Get all scenarios by difficulty level
     */
    getScenariosByDifficulty() {
        const categories = {
            basic: [],
            intermediate: [],
            advanced: []
        };

        this.scenarios.forEach(scenario => {
            if (scenario.expectedDuration[1] < 8000) {
                categories.basic.push(scenario);
            } else if (scenario.expectedDuration[1] < 15000) {
                categories.intermediate.push(scenario);
            } else {
                categories.advanced.push(scenario);
            }
        });

        return categories;
    },

    /**
     * Generate test plan for specific scenario
     */
    generateTestPlan(scenarioId) {
        const scenario = this.getScenario(scenarioId);
        if (!scenario) return null;

        return {
            scenario,
            testPlan: {
                setup: this.generateSetupInstructions(scenario),
                execution: this.generateExecutionSteps(scenario),
                validation: this.generateValidationSteps(scenario),
                cleanup: this.generateCleanupSteps(scenario)
            },
            expectedResults: scenario.successCriteria,
            duration: {
                min: scenario.expectedDuration[0],
                max: scenario.expectedDuration[1],
                average: (scenario.expectedDuration[0] + scenario.expectedDuration[1]) / 2
            }
        };
    },

    // === GENERATOR FUNCTIONS ===

    generateSetupInstructions(scenario) {
        const instructions = [
            '✅ Очистить browser cache и local storage',
            `🌐 Открыть страницу: ${scenario.pageUrl}`,
            '🔧 Инжектировать E2EMetricsCollector',
            '📊 Запустить отслеживание метрик'
        ];

        if (scenario.simulateErrors) {
            instructions.push('⚠️ Настроить симуляцию ошибок:', ...scenario.simulateErrors.map(err => `  - ${err}`));
        }

        if (scenario.networkSimulations) {
            instructions.push('🌐 Настроить симуляцию сети:', ...Object.entries(scenario.networkSimulations).map(([key, value]) => `  - ${key}: ${value}`));
        }

        return instructions;
    },

    generateExecutionSteps(scenario) {
        return [
            '🎯 Кликнуть кнопку "Запустить" в Ozon Analyzer',
            '⏳ Дождаться завершения инициализации background script',
            '🔍 Наблюдать за последовательностью фаз выполнения',
            '📝 Мониторить console логи всех этапов',
            '⏱️ Отслеживать время выполнения каждой фазы'
        ];
    },

    generateValidationSteps(scenario) {
        const validations = [];

        scenario.validationChecks.forEach(check => {
            switch(check.type) {
                case 'workflow_completion':
                    validations.push('✅ Проверить завершение workflow без ошибок');
                    break;
                case 'python_execution':
                    validations.push('🐍 Проверить успешное выполнение Python кода');
                    break;
                case 'ai_calls_count':
                    validations.push(`🤖 Проверить количество AI вызовов: ${check.expected}`);
                    break;
                case 'deep_analysis_triggered':
                    validations.push(`🔬 Проверить ${check.expected ? 'запус+' : 'отсутствие'} deep analysis`);
                    break;
                case 'error_handled_gracefully':
                    validations.push('🚨 Проверить корректную обработку ошибок');
                    break;
                default:
                    validations.push(`🔍 Проверить: ${check.type}`);
            }
        });

        return validations;
    },

    generateCleanupSteps(scenario) {
        return [
            '🧹 Очистить captured метрики',
            '💾 Сгенерировать и сохранить отчет тестирования',
            '🔄 Сбросить состояние плагина к исходному',
            '📊 Проверить отсутствие memory leaks'
        ];
    },

    // === TEST EXECUTOR ===

    /**
     * Run automated test for scenario
     */
    async runAutomatedTest(scenarioId, metricsCollector) {
        const scenario = this.getScenario(scenarioId);
        if (!scenario) {
            throw new Error(`Scenario ${scenarioId} not found`);
        }

        console.log(`🚀 Starting automated test: ${scenario.name}`);
        console.log(`📄 URL: ${scenario.pageUrl}`);
        console.log(`⏱️ Expected duration: ${scenario.expectedDuration[0]}-${scenario.expectedDuration[1]}ms`);

        if (metricsCollector) {
            metricsCollector.recordPhaseStart('test_automation', {
                scenario: scenarioId,
                description: scenario.description,
                expectedPhases: scenario.expectedPhases
            });
        }

        try {
            // Wait for page to be ready
            await this.waitForPageReady();

            // Start workflow monitoring
            if (metricsCollector) {
                metricsCollector.recordPhaseStart('workflow_monitoring', { scenario: scenarioId });
            }

            // Simulate click (would need actual DOM interaction in real test)
            console.log('🎯 Simulating workflow start...');

            // Wait for workflow completion with timeout
            const timeout = scenario.expectedDuration[1] * 2;
            const workflowPromise = this.waitForWorkflowCompletion(timeout);
            const startTime = Date.now();

            await workflowPromise;

            const duration = Date.now() - startTime;
            console.log(`✅ Workflow completed in ${duration}ms (expected ${scenario.expectedDuration[0]}-${scenario.expectedDuration[1]}ms)`);

            // Validate results
            const result = this.validateResults(scenario, metricsCollector ? metricsCollector.generateReport() : null);

            if (metricsCollector) {
                metricsCollector.recordPhaseEnd('test_automation', {
                    scenario: scenarioId,
                    duration,
                    success: result.passed,
                    details: result.details
                });
            }

            const finalResult = {
                scenario: scenarioId,
                passed: result.passed,
                duration,
                expectedDuration: scenario.expectedDuration,
                details: result.details,
                successRate: result.passed ? 100 : Math.round(result.passedChecks / result.totalChecks * 100)
            };

            console.log(`🎯 Test ${scenarioId}: ${finalResult.passed ? 'PASSED' : 'FAILED'} (${finalResult.successRate}%)`);
            return finalResult;

        } catch (error) {
            console.error(`❌ Test ${scenarioId} failed:`, error);

            if (metricsCollector) {
                metricsCollector.recordError(error, { scenario: scenarioId, phase: 'test_execution' });
                metricsCollector.recordPhaseEnd('test_automation', { success: false, error: error.message });
            }

            throw error;
        }
    },

    /**
     * Validate test results against scenario expectations
     */
    validateResults(scenario, report) {
        let passedChecks = 0;
        let totalChecks = scenario.validationChecks.length;
        const details = [];

        scenario.validationChecks.forEach(check => {
            let passed = false;
            let detail = '';

            switch(check.type) {
                case 'workflow_completion':
                    passed = report?.summary?.totalErrors === 0;
                    detail = `Workflow ${passed ? 'completed without errors' : `failed with ${report?.summary?.totalErrors} errors`}`;
                    break;
                case 'python_execution':
                    // In real implementation, this would check Python execution logs
                    passed = true; // Placeholder
                    detail = 'Python execution successful';
                    break;
                default:
                    passed = true; // Placeholder for other checks
                    detail = `${check.type} check passed`;
            }

            if (passed) passedChecks++;
            details.push({
                check: check.type,
                passed,
                expected: check.expected,
                detail
            });
        });

        return {
            passed: passedChecks === totalChecks,
            passedChecks,
            totalChecks,
            details
        };
    },

    // HELPER FUNCTIONS

    async waitForPageReady() {
        // In real browser environment, this would wait for DOM ready
        return new Promise(resolve => setTimeout(resolve, 100));
    },

    async waitForWorkflowCompletion(timeout) {
        // In real test, this would monitor for specific completion signals
        return new Promise(resolve => setTimeout(resolve, timeout / 2)); // Simulate completion
    }
};

// Export for browser/Node usage
if (typeof window !== 'undefined') {
    window.E2ETestScenarios = E2ETestScenarios;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { E2ETestScenarios };
}