/**
 * Озон Analyzer Integration Test Runner
 * Комплексный тестовый раннер для проверки интеграции плагина ozon-analyzer
 */

import { TestSuite } from './utils/test-framework.js';
import { MockEnvironment } from './mocks/environment.js';
import { PluginLoaderTest } from './specs/plugin-loader.test.js';
import { WorkflowEngineTest } from './specs/workflow-engine.test.js';
import { CrossEnvironmentTest } from './specs/cross-environment.test.js';
import { AIApiTest } from './specs/ai-api.test.js';
import { BridgeCommunicationTest } from './specs/bridge-communication.test.js';
import { HtmlExtractionTest } from './specs/html-extraction.test.js';
import { PerformanceBenchmark } from './specs/performance-benchmark.js';

export class OzonAnalyzerTestRunner {
    constructor() {
        this.testSuite = new TestSuite('Ozon Analyzer Integration Tests');
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: [],
            startTime: null,
            endTime: null
        };
        this.mockEnv = new MockEnvironment();
    }

    async initialize() {
        console.log('🔄 Инициализация тестового окружения...');
        await this.mockEnv.setup();
        this.registerTestSuites();
    }

    registerTestSuites() {
        console.log('📋 Регистрация тест сьютов...');

        this.testSuite.addTest('plugin-loader', new PluginLoaderTest());
        this.testSuite.addTest('workflow-engine', new WorkflowEngineTest());
        this.testSuite.addTest('cross-environment', new CrossEnvironmentTest());
        this.testSuite.addTest('ai-api', new AIApiTest());
        this.testSuite.addTest('bridge-communication', new BridgeCommunicationTest());
        this.testSuite.addTest('html-extraction', new HtmlExtractionTest());
        this.testSuite.addTest('performance-benchmark', new PerformanceBenchmark());
    }

    async runAllTests() {
        console.log('\n🚀 Запуск полного интеграционного тестирования...');
        this.results.startTime = Date.now();

        try {
            const suiteResults = await this.testSuite.runAll();
            this.results.endTime = Date.now();
            this.results = { ...this.results, ...suiteResults };
            this.generateReport();
        } catch (error) {
            console.error('❌ Критическая ошибка выполнения тестов:', error);
            this.results.errors.push({
                type: 'test_execution_error',
                message: error.message,
                stack: error.stack
            });
            this.results.endTime = Date.now();
        }
        finally {
            await this.cleanup();
        }

        return this.results;
    }

    generateReport() {
        const duration = this.results.endTime - this.results.startTime;
        console.log('\n' + '='.repeat(80));
        console.log('📊 РЕЗУЛЬТАТЫ ИНТЕГРАЦИОННОГО ТЕСТИРОВАНИЯ OZON ANALYZER');
        console.log('='.repeat(80));
        console.log(`⏱️  Время выполнения: ${(duration / 1000).toFixed(2)} секунд`);
        console.log(`📈 Всего тестов: ${this.results.total}`);
        console.log(`✅ Пройдено: ${this.results.passed}`);
        console.log(`❌ Провалено: ${this.results.failed}`);
        console.log(`📊 Процент успеха: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
        console.log('');

        if (this.results.errors.length > 0) {
            console.log('🚨 КРИТИЧЕСКИЕ ОШИБКИ:');
            this.results.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error.type}: ${error.message}`);
                if (error.stack) {
                    console.log(`     Stack: ${error.stack.substring(0, 200)}...`);
                }
            });
        }

        if (this.results.passed === this.results.total) {
            console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Интеграция работает корректно.');
        } else {
            console.log('\n⚠️  ОБНАРУЖЕНЫ ПРОБЛЕМЫ INTEGRATION!');
            console.log('Рекомендуется провести дополнительную диагностику.');
        }

        console.log('='.repeat(80));
    }

    async cleanup() {
        console.log('🧹 Очистка тестового окружения...');
        await this.mockEnv.teardown();
    }
}

// Экспорт для использования в браузере и Node.js
export default OzonAnalyzerTestRunner;

// Автоматический запуск при загрузке в браузере
if (typeof window !== 'undefined') {
    window.onload = async () => {
        const runner = new OzonAnalyzerTestRunner();
        await runner.initialize();
        await runner.runAllTests();
    };
}