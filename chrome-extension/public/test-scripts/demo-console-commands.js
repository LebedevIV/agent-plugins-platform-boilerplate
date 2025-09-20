/**
 * ДЕМОНСТРАЦИЯ РУЧНОГО ТЕСТИРОВАНИЯ PYODIDE
 *
 * Этот файл содержит примеры команд для использования
 * из Developer Console браузера.
 *
 * Как использовать:
 * 1. Открыть тестовую страницу
 * 2. Нажать F12 для открытия Developer Console
 * 3. Выполнить команды из этого файла одна за другой
 */

// === 1. ПРОВЕРКА РУЧНОЙ ДОСТУПНОСТИ ===

console.log('🔍 Проверка доступности функций тестирования...');

// Проверить что функции зарегистрированы глобально
console.log('startPyodideManualTest:', typeof window.startPyodideManualTest);
console.log('getPyodideTestStats:', typeof window.getPyodideTestStats);
console.log('PyodideOffscreenManualTester:', typeof window.PyodideOffscreenManualTester);

// === 2. СТАТИСТИКА ТЕСТИРОВАНИЯ ===

console.log('\n📊 Статистика тестирования (без активной сессии):');
console.log(window.getPyodideTestStats());

// === 3. ЗАПУСК ПОЛНОГО ТЕСТИРОВАНИЯ ===

console.log('\n🚀 Запуск полного ручного тестирования...');

// Самый простой способ - использовать глобальную функцию
startPyodideManualTest()
  .then(result => {
    console.log('\n✅ Тестирование завершено! Результаты:');

    // Красивый вывод результатов в консоль
    console.table(result.results.map(test => ({
      'Тест': test.test,
      'Статус': test.status,
      'Время (ms)': test.executionTime || 'N/A',
      'Результат': JSON.stringify(test.result).slice(0, 50) + (test.result && JSON.stringify(test.result).length > 50 ? '...' : ''),
      'Ошибка': test.error ? test.error.slice(0, 50) + '...' : ''
    })));

    // Сводная статистика
    const summary = result.results.reduce((acc, test) => {
      acc.total++;
      if (test.status === 'PASSED') acc.passed++;
      else acc.failed++;
      return acc;
    }, { total: 0, passed: 0, failed: 0 });

    summary.successRate = ((summary.passed / summary.total) * 100).toFixed(1);

    console.log('\n📊 СВОДНАЯ СТАТИСТИКА:');
    console.log(`Всего тестов: ${summary.total}`);
    console.log(`Пройдено: ${summary.passed}`);
    console.log(`Провалено: ${summary.failed}`);
    console.log(`Успешность: ${summary.successRate}%`);

    // Оценка готовности архитектуры
    if (result.success && summary.successRate >= 80) {
      console.log('🎉 АРХИТЕКТУРА ГОТОВА! Pyodide успешно работает в offscreen context.');
    } else {
      console.warn('⚠️ Обнаружены проблемы в архитектуре. Проверьте логи выше.');
    }

    return result;
  })
  .catch(error => {
    console.error('\n❌ Критическая ошибка тестирования:', error);
    console.error('Подробности:', error.stack);
  });

// === 4. ПОШАГОВОЕ ИСПОЛЬЗОВАНИЕ CLASS API ===

console.log('\n🔧 Альтернативный способ: использование Class API');

/*
// Для пошагового тестирования раскомментировать:

// Создать экземпляр тестера
const tester = new PyodideOffscreenManualTester();
console.log('Создан экземпляр тестера:', tester);

// Запустить тестирование
tester.startManualTesting()
  .then(result => {
    console.log('Результаты через Class API:', result);

    // Получить результаты отдельно
    const detailedResults = tester.getTestResults();
    console.log('Детальные результаты:', detailedResults);

    // Вывести результаты в консоль
    tester.logResultsToConsole();
  });
*/

// === 5. КОМАНДЫ ДЛЯ ОТЛАДКИ ===

console.log('\n🔍 КОМАНДЫ ДЛЯ ОТЛАДКИ:');

// Проверить версию Chrome
console.log('Chrome версия:', navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Неизвестно');

// Проверить поддержку Offscreen API
console.log('Offscreen API поддержка:', {
  'chrome.offscreen': typeof chrome?.offscreen,
  'hasDocument': typeof chrome?.offscreen?.hasDocument,
  'createDocument': typeof chrome?.offscreen?.createDocument
});

// Проверить время выполнения тестов
console.time('Мониторинг тестов');

setTimeout(() => {
  console.timeEnd('Мониторинг тестов');
  console.log('⏱️ Мониторинг завершен');
}, 1000);

// === 6. ПРИМЕРЫ ДОПОЛНИТЕЛЬНЫХ КОМАНД ===

console.log('\n📋 ПРИМЕРЫ ДОПОЛНИТЕЛЬНЫХ КОМАНД:');

/*
# Примеры команд для копирования в консоль:

// 1. Мониторинг работы Offscreen API
setInterval(() => {
  chrome.offscreen.hasDocument()
    .then(exists => console.log('Offscreen exists:', exists))
    .catch(err => console.error('Offscreen check error:', err));
}, 5000);

// 2. Тестирование communication с background
chrome.runtime.sendMessage({ type: 'PING' })
  .then(response => console.log('Background ping response:', response))
  .catch(error => console.error('Background communication error:', error));

// 3. Проверка загрузки Pyodide скриптов
fetch(chrome.runtime.getURL('pyodide/pyodide.js'), { method: 'HEAD' })
  .then(response => console.log('Pyodide.js available:', response.ok))
  .catch(error => console.error('Pyodide.js check error:', error));

// 4. Benchmark тествующей системы
(async () => {
  console.time('Pyodide Integration Benchmark');
  const result = await startPyodideManualTest();
  console.timeEnd('Pyodide Integration Benchmark');
  console.log('Benchmark result:', result.success ? 'OK' : 'FAILED');
})();
*/

// === 7. ЛОГИЧЕСКАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАПУСКА ===

console.log('\n📚 ЛОГИЧЕСКАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАПУСКА ТЕСТИРОВАНИЯ:');
console.log('1. ✅ Проверка возможности ("getPyodideTestStats")');
console.log('2. ✅ Запуск тестирования ("startPyodideManualTest")');
console.log('3. ✅ Ожидание завершения');
console.log('4. ✅ Анализ результатов');
console.log('5. ✅ Проверка Success Rate >= 80%');
console.log('6. ✅ Проверьте логи Profiler для timings');

// === 8. СОВЕТЫ ПО РАЗРАБОТКЕ ===

console.log('\n💡 СОВЕТЫ ПО РАЗРАБОТКЕ:');
console.log('• Всегда проверяйте консоль на ошибки');
console.log('• Используйте Chrome 109+ для полной функциональности');
console.log('• Мониторьте производительность с помощью Performance Tab');
console.log('• При проблемах очищайте localStorage и перезагружайте extension');

// === НИЧЕГО НЕ ЗАПУСКАТЬ АВТОМАТИЧЕСКИ ===

console.log('\n⏸️ Команды подготовлены.Выполните их вручную в консоли браузера.');
console.log('🏁 Для начала скопируйте команду:');
console.log('startPyodideManualTest()');