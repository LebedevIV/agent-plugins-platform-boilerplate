/**
 * Node.js версия тест раннера для интеграционного тестирования Ozon Analyzer
 * Можно запускать из командной строки: node node-test-runner.js
 */

import { OzonAnalyzerTestRunner } from './test-runner.js';

async function runIntegrationTests() {
    console.log('🚀 ЗАПУСК ИНТЕГРАЦИОННОГО ТЕСТИРОВАНИЯ OZON ANALYZER');
    console.log('=' .repeat(80));

    const runner = new OzonAnalyzerTestRunner();

    try {
        console.log('🔄 Инициализация тестового окружения...');
        await runner.initialize();

        console.log('✅ Инициализация завершена');
        console.log('📋 Запуск тест сьюта...\n');

        const results = await runner.runAllTests();

        // Вывод итогового отчета
        console.log('\n' + '=' .repeat(80));
        console.log('📊 РЕЗУЛЬТАТЫ ИНТЕГРАЦИОННОГО ТЕСТИРОВАНИЯ OZON ANALYZER');

        const duration = results.endTime - results.startTime;
        const successRate = ((results.passed / results.total) * 100);

        console.log('='.repeat(80));
        console.log(`⏱️  Время выполнения: ${(duration / 1000).toFixed(2)} секунд`);
        console.log(`📈 Всего тестов: ${results.total}`);
        console.log(`✅ Пройдено: ${results.passed}`);
        console.log(`❌ Провалено: ${results.failed}`);
        console.log(`📊 Процент успеха: ${successRate.toFixed(1)}%`);
        console.log('');

        if (results.errors && results.errors.length > 0) {
            console.log('🚨 КРИТИЧЕСКИЕ ОШИБКИ:');
            results.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error.type}: ${error.message}`);
                if (error.stack) {
                    console.log(`     Stack: ${error.stack.substring(0, 200)}...`);
                }
            });
            console.log('');
        }

        // Детализация по компонентам
        if (results.testSuiteResults) {
            console.log('📋 ДЕТАЛИЗАЦИЯ ПО КОМПОНЕНТАМ:');
            results.testSuiteResults.forEach(component => {
                const compRate = (component.passed / component.total * 100);
                const status = compRate === 100 ? '✅' : compRate >= 70 ? '⚠️' : '❌';
                console.log(`  ${status} ${component.component}: ${component.passed}/${component.total} (${compRate.toFixed(1)}%)`);
            });
            console.log('');
        }

        // Заключение
        if (successRate === 100) {
            console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Интеграция работает корректно.');
            console.log('📦 Плагин готов к использованию в продакшен среде.');
        } else if (successRate >= 80) {
            console.log('⚠️  ИНТЕГРАЦИЯ РАБОТАЕТ С НЕЗНАЧИТЕЛЬНЫМИ ПРОБЛЕМАМИ');
            console.log('📋 Рекомендуется исправить выявленные ошибки перед продакшеном.');
        } else if (successRate >= 60) {
            console.log('🔶 ОБНАРУЖЕНЫ СУЩЕСТВЕННЫЕ ПРОБЛЕМЫ ИНТЕГРАЦИИ');
            console.log('🔧 Требуется доработка компонентов перед развертыванием.');
        } else {
            console.log('❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ ИНТЕГРАЦИИ');
            console.log('🚫 Необходимо полное перетестирование и исправление.');
        }

        console.log('='.repeat(80));

        // Возвращаем код выхода для CI/CD
        process.exit(successRate === 100 ? 0 : 1);

    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ВЫПОЛНЕНИЯ ТЕСТОВ:');
        console.error(error.message);
        console.error(error.stack);

        process.exit(1);
    }
}

// Запуск тестов
runIntegrationTests().catch(error => {
    console.error('💥 НЕПРЕДВИДЕННАЯ ОШИБКА:');
    console.error(error);
    process.exit(1);
});