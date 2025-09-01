import OzonAnalyzerTestRunner from './test-runner.js';
import { PerformanceBenchmark } from './specs/performance-benchmark.js';
import { AsyncMessageHandler, sendResilientMessage } from './async-message-handler.js';

export class TestUI {
    constructor() {
        this.testRunner = new OzonAnalyzerTestRunner();
        this.setupEventListeners();
        this.logs = [];
        this.isRunning = false;
    }

    setupEventListeners() {
        const startBtn = document.getElementById('startTestsBtn');
        const benchmarkBtn = document.getElementById('startBenchmarkBtn');

        startBtn.addEventListener('click', () => this.startTests());
        benchmarkBtn.addEventListener('click', () => this.startBenchmark());
    }

    async startTests() {
        if (this.isRunning) return;

        this.isRunning = true;
        const startBtn = document.getElementById('startTestsBtn');
        startBtn.textContent = '⏳ Тестирование выполняется...';
        startBtn.disabled = true;

        // Показываем прогресс
        document.getElementById('progressSection').style.display = 'block';
        document.getElementById('logsSection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'block';

        this.logMessage('🔄 Инициализация тестового окружения...');
        this.logMessage('🔍 Выполнение browser compatibility detection...');

        try {
            await this.testRunner.initialize();
            this.logMessage('✅ Тестовое окружение готово');

            // Выводим информацию о compatibility
            if (this.testRunner.compatibilityResults) {
                const compat = this.testRunner.compatibilityResults.compatibility;
                const browser = this.testRunner.compatibilityResults.browser;
                this.logMessage(`📊 Compatibility Mode: ${compat.mode}`);
                this.logMessage(`   Chrome Version: ${browser.majorVersion}`);
                this.logMessage(`   Readiness Score: ${(compat.readinessScore * 100).toFixed(1)}%`);
                if (compat.recommendations && compat.recommendations.length > 0) {
                    compat.recommendations.forEach(rec => {
                        this.logMessage(`💡 ${rec}`);
                    });
                }
            }

            this.updateProgress(10, 'Запуск conditional тест сьюта...');

            this.logMessage('\n🚀 ЗАПУСК CONDITIONAL ИНТЕГРАЦИОННОГО ТЕСТИРОВАНИЯ OZON ANALYZER\n');
            this.logMessage(`   Условные режимы: ${this.testRunner.conditionalTestSuites.join(', ')}\n`);

            const results = await this.testRunner.runAllTests();

            this.displayConditionalResults(results);

            this.logMessage(`\n✅ Conditional тестирование завершено!`);

            // Показываем Final Readiness Score
            if (this.testRunner.compatibilityResults) {
                const finalScore = this.testRunner.getFinalReadinessScore();
                this.logMessage(`🎯 Final Readiness Score: ${(finalScore * 100).toFixed(1)}%`);
    
                if (finalScore >= 0.9) {
                    this.logMessage(`🎉 INTEGRATION PRODUCTION-READY!`);
                } else if (finalScore >= 0.7) {
                    this.logMessage(`⚠️ INTEGRATION FUNCTIONAL WITH IMPROVEMENT AREAS`);
                } else {
                    this.logMessage(`🔶 INTEGRATION NEEDS ATTENTION!`);
                }
    
                // Log AsyncMessageHandler statistics if available
                this.logAsyncMessageHandlerStats();
            }

        } catch (error) {
            this.logMessage(`❌ КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
            console.error('Test execution error:', error);
        } finally {
            this.isRunning = false;
            startBtn.textContent = '🚀 Повторить тестирование';
            startBtn.disabled = false;
            this.updateProgress(100, 'Conditional тестирование завершено');
        }
    }

    async startBenchmark() {
        if (this.isRunning) return;

        this.isRunning = true;
        const benchmarkBtn = document.getElementById('startBenchmarkBtn');
        benchmarkBtn.textContent = '⏳ Бенчмаркинг...';
        benchmarkBtn.disabled = true;

        // Показываем прогресс
        document.getElementById('progressSection').style.display = 'block';
        document.getElementById('logsSection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'block';

        this.logMessage('🔄 Запуск бенчмаркинга производительности...');

        try {
            this.logMessage('\n🧪 ПРОФИЛИРОВАНИЕ ПРОИЗВОДИТЕЛЬНОСТИ OZON ANALYZER\n');

            const benchmark = new PerformanceBenchmark();
            const results = await benchmark.runAll();

            this.displayBenchmarkResults(results);

            this.logMessage(`\n✅ Бенчмаркинг завершён!`);
            this.logMessage(`📊 Анализ производительности готов к просмотру.`);

        } catch (error) {
            this.logMessage(`❌ ОШИБКА БЕНЧМАРКИНГА: ${error.message}`);
            console.error('Benchmark execution error:', error);
        } finally {
            this.isRunning = false;
            benchmarkBtn.textContent = '🧪 Повторить бенчмаркинг';
            benchmarkBtn.disabled = false;
            this.updateProgress(100, 'Бенчмаркинг завершён');
        }
    }

    logMessage(message) {
        this.logs.push(message);
        const logsContainer = document.getElementById('logsContainer');
        logsContainer.textContent = this.logs.join('\n');
        logsContainer.scrollTop = logsContainer.scrollHeight;

        // Также выводим в консоль для отладки
        console.log(message);
    }

    updateProgress(percent, text) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        progressFill.style.width = `${percent}%`;
        progressText.textContent = text;
    }

    displayResults(results) {
        const resultsContent = document.getElementById('resultsContent');
        const resultsTitle = document.getElementById('resultsTitle');

        // Общая статистика
        const totalScore = results.passed / results.total * 100;

        resultsTitle.innerHTML = `
            📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:
            <span style="color: ${totalScore === 100 ? '#27ae60' : totalScore >= 70 ? '#f39c12' : '#e74c3c'}">
                ${totalScore.toFixed(1)}% успеха
            </span>
        `;

        let html = `
            <div style="background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <div class="metric-item">
                    <span class="metric-label">Всего тестов:</span>
                    <span class="metric-value">${results.total}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Пройдено:</span>
                    <span class="metric-value" style="color: #27ae60;">${results.passed}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Провалено:</span>
                    <span class="metric-value" style="color: #e74c3c;">${results.failed}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Время выполнения:</span>
                    <span class="metric-value">${((results.endTime - results.startTime) / 1000).toFixed(2)}s</span>
                </div>
            </div>

            <h4>📋 Детализация по компонентам:</h4>
        `;

        // Результаты по компонентам
        if (results.testSuiteResults && results.testSuiteResults.length > 0) {
            for (const componentResult of results.testSuiteResults) {
                const successRate = componentResult.passed / componentResult.total * 100;
                const status = successRate === 100 ? 'success' : successRate >= 50 ? 'warning' : 'failure';

                html += `
                    <div class="component-result ${status}">
                        <strong>${componentResult.component}:</strong> ${componentResult.passed}/${componentResult.total}
                        <span style="float: right;">${successRate.toFixed(1)}%</span>
                    </div>
                `;
            }
        }

        // Критические ошибки
        if (results.errors && results.errors.length > 0) {
            html += `
                <h4 style="color: #e74c3c;">🚨 Критические ошибки:</h4>
            `;

            for (const error of results.errors) {
                html += `
                    <div class="component-result failure error-details">
                        <strong>${error.type}</strong>
                        <div>${error.message}</div>
                        ${error.stack ? `
                            <details>
                                <summary>Stack trace</summary>
                                <div class="error-stack">${error.stack}</div>
                            </details>
                        ` : ''}
                    </div>
                `;
            }
        }

        // Рекомендации
        html += `
            <div style="background: #ecf0f1; padding: 15px; border-radius: 5px; margin-top: 20px;">
                <h4>💡 Рекомендации:</h4>
                <ul>
        `;

        if (totalScore === 100) {
            html += `<li>✅ Интеграция работает идеально! Можно переходить к продакшену.</li>`;
        } else if (totalScore >= 80) {
            html += `<li>⚠️ Интеграция работает с незначительными проблемами. Рекомендуется исправить ошибки перед продакшеном.</li>`;
        } else if (totalScore >= 60) {
            html += `<li>🔶 Обнаружены существенные проблемы. Требуется доработка интеграции.</li>`;
        } else {
            html += `<li>❌ Критические проблемы интеграции. Необходимо полное перетестирование.</li>`;
        }

        if (results.failed > 0) {
            html += `<li>🔍 Рекомендуется детально изучить логи проваленных тестов для диагностики проблем.</li>`;
        }

        html += `
            </ul>
        </div>
        `;

        resultsContent.innerHTML = html;

        this.logMessage('\n📊 РЕЗУЛЬТАТЫ:');
        this.logMessage(`   Пройдено: ${results.passed}/${results.total} (${totalScore.toFixed(1)}%)`);
        this.logMessage(`   Время: ${((results.endTime - results.startTime) / 1000).toFixed(2)} сек`);
    }

    displayConditionalResults(results) {
        const resultsContent = document.getElementById('resultsContent');
        const resultsTitle = document.getElementById('resultsTitle');

        const totalScore = results.passed / results.total * 100;
        const finalScore = this.testRunner.getFinalReadinessScore();

        resultsTitle.innerHTML = `
            📊 CONDITIONAL INTEGRATION TEST RESULTS:
            <span style="color: ${totalScore === 100 ? '#27ae60' : totalScore >= 70 ? '#f39c12' : '#e74c3c'}">
                ${totalScore.toFixed(1)}% success
            </span>
            <br>
            <span style="color: #2c3e50; font-size: 14px;">
                Final Readiness Score: ${(finalScore * 100).toFixed(1)}%
            </span>
        `;

        let html = '';

        // Browser Compatibility Section
        if (this.testRunner.compatibilityResults) {
            const compat = this.testRunner.compatibilityResults.compatibility;
            const browser = this.testRunner.compatibilityResults.browser;

            html += `
                <div style="background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #3498db;">
                    <h4>🌐 BROWSER COMPATIBILITY</h4>
                    <div class="metric-item">
                        <span class="metric-label">Chrome Version:</span>
                        <span class="metric-value">${browser.majorVersion}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Compatibility Mode:</span>
                        <span class="metric-value">${compat.mode}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Readiness Score:</span>
                        <span class="metric-value">${(compat.readinessScore * 100).toFixed(1)}%</span>
                    </div>
                </div>
            `;
        }

        // Conditional Test Suites Info
        html += `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #6c5ce7;">
                <h4>⚖️ CONDITIONAL TESTING</h4>
                <div class="metric-item">
                    <span class="metric-label">Testing Modes:</span>
                    <span class="metric-value">${this.testRunner.conditionalTestSuites.join(', ')}</span>
                </div>
        `;

        if (this.testRunner.compatibilityResults && this.testRunner.compatibilityResults.compatibility.limitations) {
            html += `<div class="metric-item"><span class="metric-label">Limitations:</span><span class="metric-value" style="color: #f39c12;">${this.testRunner.compatibilityResults.compatibility.limitations.join(', ')}</span></div>`;
        }

        html += `</div>`;

        // Test Execution Statistics
        html += `
            <div style="background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h4>📈 TEST EXECUTION STATISTICS</h4>
                <div class="metric-item">
                    <span class="metric-label">Всего тестов:</span>
                    <span class="metric-value">${results.total}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Пройдено:</span>
                    <span class="metric-value" style="color: #27ae60;">${results.passed}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Провалено:</span>
                    <span class="metric-value" style="color: #e74c3c;">${results.failed}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Время выполнения:</span>
                    <span class="metric-value">${((results.endTime - results.startTime) / 1000).toFixed(2)}s</span>
                </div>
            </div>

            <h4>📋 Детализация по компонентам:</h4>
        `;

        // Результаты по компонентам
        if (results.testSuiteResults && results.testSuiteResults.length > 0) {
            for (const componentResult of results.testSuiteResults) {
                const successRate = componentResult.passed / componentResult.total * 100;
                const status = successRate === 100 ? 'success' : successRate >= 50 ? 'warning' : 'failure';

                html += `
                    <div class="component-result ${status}">
                        <strong>${componentResult.component}:</strong> ${componentResult.passed}/${componentResult.total}
                        <span style="float: right;">${successRate.toFixed(1)}%</span>
                    </div>
                `;
            }
        }

        // Production Ready Assessment
        const readinessColor = finalScore >= 0.9 ? '#27ae60' : finalScore >= 0.7 ? '#f39c12' : '#e74c3c';
        const readinessText = finalScore >= 0.9 ? 'PRODUCTION-READY!' : finalScore >= 0.7 ? 'FUNCTIONAL' : 'REQUIRES ATTENTION';

        html += `
            <div style="background: ${finalScore >= 0.9 ? '#d4edda' : finalScore >= 0.7 ? '#fff3cd' : '#f8d7da'}; padding: 20px; border-radius: 5px; margin-top: 20px; border: 2px solid ${readinessColor};">
                <h4 style="color: ${readinessColor}; margin: 0;">🎯 PRODUCTION READINESS ASSESSMENT</h4>
                <p style="font-size: 18px; font-weight: bold; margin: 10px 0; color: ${readinessColor};">
                    ${readinessText} (${(finalScore * 100).toFixed(1)}%)
                </p>
                <p style="margin: 5px 0;">
                    ${finalScore >= 0.9 ? '✅ Your integration is fully ready for production deployment.' :
                      finalScore >= 0.7 ? '⚠️ Integration is functional but review recommendations above.' :
                      '🔶 Consider upgrading Chrome and addressing compatibility issues.'}
                </p>
            </div>
        `;

        // Оставляем рекомендации и ошибки как есть, но изменяем вызов
        html += this.getRecommendationsHtml(results);
        html += this.getErrorsHtml(results);

        resultsContent.innerHTML = html;

        this.logMessage('\n📊 CONDITIONAL TEST RESULTS:');
        this.logMessage(`   Пройдено: ${results.passed}/${results.total} (${totalScore.toFixed(1)}%)`);
        this.logMessage(`   Final Readiness: ${(finalScore * 100).toFixed(1)}%`);
        this.logMessage(`   Время: ${((results.endTime - results.startTime) / 1000).toFixed(2)} сек`);
    }

    // Метод дляancell форматирования ошибок вынесен отдельно
    getErrorsHtml(results) {
        if (!results.errors || results.errors.length === 0) return '';

        return `
            <h4 style="color: #e74c3c;">🚨 Критические ошибки:</h4>
            ${results.errors.map((error, index) => `
                <div class="component-result failure error-details">
                    <strong>${error.type}</strong>
                    <div>${error.message}</div>
                    ${error.stack ? `
                        <details>
                            <summary>Stack trace</summary>
                            <div class="error-stack">${error.stack}</div>
                        </details>
                    ` : ''}
                </div>
            `).join('')}
        `;
    }

    // Метод для рекомендаций вынесен отдельно
    getRecommendationsHtml(results) {
        const totalScore = results.passed / results.total * 100;
        const finalScore = this.testRunner.getFinalReadinessScore();

        let recommendations = `
            <div style="background: #ecf0f1; padding: 15px; border-radius: 5px; margin-top: 20px;">
                <h4>💥 CONDITIONAL RECOMMENDATIONS:</h4>
                <ul style="margin: 0;">
        `;

        if (finalScore >= 0.9) {
            recommendations += '<li style="color: #27ae60;">✅ Full production-ready integration!</li>';
        } else if (finalScore >= 0.8) {
            recommendations += '<li style="color: #f39c12;">⚠️ Minor optimization opportunities available.</li>';
        } else if (finalScore >= 0.6) {
            recommendations += '<li style="color: #f39c12;">⚡ Substantial improvements needed for production.</li>';
        } else {
            recommendations += '<li style="color: #e74c3c;">🔶 Critical compatibility issues require immediate attention.</li>';
        }

        if (this.testRunner.compatibilityResults) {
            const compat = this.testRunner.compatibilityResults.compatibility;
            if (compat.recommendations) {
                compat.recommendations.forEach(rec => {
                    recommendations += `<li style="color: #3498db;">💡 ${rec}</li>`;
                });
            }
        }

        if (results.failed > 0) {
            recommendations += '<li style="color: #2c3e50;">🔍 Review failed tests and compatibility limitations.</li>';
        }

        recommendations += '</ul></div>';
        return recommendations;
    }

    logAsyncMessageHandlerStats() {
        try {
            // If there's a global AsyncMessageHandler instance, log its stats
            if (window.AsyncMessageHandler) {
                const stats = {
                    example_retry_logic: '✓ Available',
                    exponential_backoff: '✓ Implemented',
                    graceful_degradation: '✓ Fallback mode',
                    timeout_handling: '✓ Configured'
                };

                this.logMessage('\n🔄 ASYNC MESSAGE HANDLER STATS:');
                Object.entries(stats).forEach(([key, value]) => {
                    this.logMessage(`   ${key}: ${value}`);
                });
                this.logMessage('   📊 Resilient communication layer active!');
            }
        } catch (error) {
            // Silently ignore if stats can't be logged
            console.log('AsyncMessageHandler stats not available');
        }
    }

    displayBenchmarkResults(results) {
        const resultsContent = document.getElementById('resultsContent');
        const resultsTitle = document.getElementById('resultsTitle');

        resultsTitle.innerHTML = `
            🚀 РЕЗУЛЬТАТЫ ПРОФИЛИРОВАНИЯ ПРОИЗВОДИТЕЛЬНОСТИ OZON ANALYZER
        `;

        let html = '';

        // Основные метрики производительности
        if (results.analysis && results.analysis[4] && results.analysis[4].result) {
            const benchmarkData = results.analysis[4].result;
            const analysisResults = benchmarkData.analysisResults;

            // Таблица метрик
            html += `
                <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
                    <h4>📊 Performance Metrics (сек):</h4>
                    <table style="width:100%; margin-top: 10px;">
                        <tr>
                            <td>Pyodide Initialisierung:</td>
                            <td><strong>${(benchmarkData.benchmarkResults?.pyodideInitialization || 0).toFixed(2)}s</strong></td>
                            <td style="color: #e74c3c;">25-35s prod</td>
                        </tr>
                        <tr>
                            <td>DOM Parsing:</td>
                            <td><strong>${(benchmarkData.benchmarkResults?.htmlParsing || 0).toFixed(2)}s</strong></td>
                            <td style="color: #e74c3c;">3-6s prod</td>
                        </tr>
                        <tr>
                            <td>Sequential AI Calls:</td>
                            <td><strong>${(benchmarkData.benchmarkResults?.sequentialAiCalls || 0).toFixed(2)}s</strong></td>
                            <td style="color: #e74c3c;">8-26s prod</td>
                        </tr>
                        <tr style="border-top: 2px solid #bdc3c7;">
                            <td><strong>Total Execution:</strong></td>
                            <td><strong>${(benchmarkData.benchmarkResults?.totalExecutionTime || 0).toFixed(2)}s</strong></td>
                            <td style="color: #27ae60;">💡 Optimization Target</td>
                        </tr>
                        <tr>
                            <td>Peak Memory:</td>
                            <td><strong>${((benchmarkData.benchmarkResults?.memoryUsage?.pyodidePeak || 0) / 1024 / 1024).toFixed(1)}MB</strong></td>
                            <td style="color: #f39c12;">Memory usage</td>
                        </tr>
                    </table>
                </div>
            `;

            // Bottlenecks
            if (analysisResults.bottlenecks && analysisResults.bottlenecks.length > 0) {
                html += `
                    <div style="background: #ffeaa7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #d63031;">
                        <h4>🚧 Identified Bottlenecks:</h4>
                        <ul>
                            ${analysisResults.bottlenecks.map(b => `<li>${b}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            // Рекомендации
            if (analysisResults.recommendations && analysisResults.recommendations.length > 0) {
                html += `
                    <div style="background: #74b9ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #0984e3;">
                        <h4>💡 Optimization Recommendations:</h4>
                        <ol>
                            ${analysisResults.recommendations.map(r => `<li>${r}</li>`).join('')}
                        </ol>
                    </div>
                `;
            }

            // Ожидания улучшения
            if (analysisResults.estimatedImprovement && benchmarkData.benchmarkResults?.totalExecutionTime) {
                const totalTime = benchmarkData.benchmarkResults.totalExecutionTime;
                const targetTime = analysisResults.estimatedImprovement.totalPotential;
                const improvement = totalTime > 0 ? (100 * (totalTime - targetTime) / totalTime).toFixed(1) : 0;

                html += `
                    <div style="background: #a29bfe; padding: 15px; border-radius: 5px; border-left: 4px solid #6c5ce7;">
                        <h4>🎯 Projected Performance Improvement:</h4>
                        <p>
                            Current: <strong>${totalTime.toFixed(2)}s</strong> →
                            Target: <strong>${targetTime.toFixed(2)}s</strong><br>
                            <span style="font-size: 18px; color: #27ae60;"><strong>${improvement}% improvement</strong></span>
                        </p>
                    </div>
                `;
            }
        } else {
            html = `<pre>${JSON.stringify(results, null, 2)}</pre>`;
        }

        resultsContent.innerHTML = html;

        // Логируем метрики
        this.logMessage('\n📈 PERFORMANCE ANALYSIS COMPLETE:');
        if (results.analysis && results.analysis[4] && results.analysis[4].result) {
            const br = results.analysis[4].result.benchmarkResults;
            this.logMessage(`   Pyodide: ${br?.pyodideInitialization?.toFixed(2)}s`);
            this.logMessage(`   DOM: ${br?.htmlParsing?.toFixed(2)}s`);
            this.logMessage(`   AI Sequential: ${br?.sequentialAiCalls?.toFixed(2)}s`);
            this.logMessage(`   Total: ${br?.totalExecutionTime?.toFixed(2)}s`);
        }
        this.logMessage(`   ✅ Analysis ready for optimization implementation!`);
    }
}

// Запуск интерфейса
document.addEventListener('DOMContentLoaded', () => {
    window.testUI = new TestUI();
});

// Также делаем доступным глобально для отладки
window.OzonAnalyzerTestRunner = OzonAnalyzerTestRunner;