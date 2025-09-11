/* eslint-disable no-undef */
// Тестовый скрипт для тестирования recovery механизма
// Запускать в консоли DevTools расширения (не в консоли браузера!)

console.log('🧪 Тестирование RECOVERY МЕХАНИЗМА для ozon-analyzer плагина...');

// Функция для запуска RUN_WORKFLOW теста
async function runRecoveryTest() {
  try {
    console.log('🚀 Запуск тестового сценария recovery механизма...');
    console.log('📋 План тестирования:');
    console.log('1. Открыть тестовую страницу с большим HTML');
    console.log('2. Запустить RUN_WORKFLOW для ozon-analyzer');
    console.log('3. Мониторить процесс передачи данных в чанках');
    console.log('4. Ждать обработки HTML_ASSEMBLED');
    console.log('5. Проверить восстановление pluginId и pageKey');

    // Открываем тестовую страницу с большим HTML
    const testPageUrl = chrome.runtime.getURL('test-recovery-large-html.html');
    console.log('📄 Открываем тестовую страницу:', testPageUrl);

    // Создаем новую вкладку с тестовой страницей
    const tab = await chrome.tabs.create({
      url: testPageUrl,
      active: true
    });

    console.log('✅ Тестовая страница открыта, tab ID:', tab.id);

    // Ждем загрузки страницы
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Теперь переключаемся на эту вкладку и запускаем RUN_WORKFLOW
    await chrome.tabs.update(tab.id, { active: true });

    console.log('🔄 Запуск RUN_WORKFLOW для ozon-analyzer...');

    // Запускаем RUN_WORKFLOW
    const workflowResult = await chrome.runtime.sendMessage({
      type: 'RUN_WORKFLOW',
      pluginId: 'ozon-analyzer',
      requestId: `test_recovery_${Date.now()}`
    });

    console.log('✅ RUN_WORKFLOW завершен:', workflowResult);

    // Мониторим процесс
    console.log('📊 Мониторинг процесса передачи данных...');
    console.log('🔍 Ищем логи:');
    console.log('- "🔍 Starting enhanced multi-layer transfer check"');
    console.log('- "🔄 Found potential global storage keys"');
    console.log('- "✅ Transfer metadata recovered from chrome.storage"');
    console.log('- "✅ PluginId restored: ozon-analyzer"');
    console.log('- "✅ PageKey restored: ..."');
    console.log('- "✅ Recovery transfer completion flag set"');
    console.log('- "🎉 Transfer recovery successful"');

    // Ждем завершения процесса
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('🏁 Тест завершен. Проверьте логи выше на наличие ошибок recovery.');

    return {
      success: workflowResult?.success || false,
      requestId: workflowResult?.requestId,
      tabId: tab.id,
      testPageUrl
    };

  } catch (error) {
    console.error('❌ Ошибка во время тестирования recovery:', error);

    // Проверяем на специфические ошибки recovery
    if (error.message.includes('Cannot determine pluginId for recovered transfer')) {
      console.error('🚨 ОБНАРУЖЕНА ОШИБКА RECOVERY: "Cannot determine pluginId for recovered transfer"');
      console.error('Это означает проблему с восстановлением pluginId из метаданных');
    }

    if (error.message.includes('Failed to process recovered transfer')) {
      console.error('🚨 ОБНАРУЖЕНА ОШИБКА RECOVERY: "Failed to process recovered transfer"');
      console.error('Это означает проблему с обработкой восстановленного transfer');
    }

    return {
      success: false,
      error: error.message
    };
  }
}

// Функция для проверки статуса transfer'а
async function checkTransferStatus(transferId) {
  try {
    console.log('🔍 Проверка статуса transfer:', transferId);

    const status = await chrome.runtime.sendMessage({
      type: 'CHECK_TRANSFER_STATUS',
      transferId
    });

    console.log('📊 Статус transfer:', status);
    return status;
  } catch (error) {
    console.error('❌ Ошибка проверки статуса transfer:', error);
    return null;
  }
}

// Функция для тестирования с разными размерами HTML
async function runMultipleRecoveryTests() {
  console.log('🔬 Запуск серии тестов recovery с разными размерами HTML...');

  const testSizes = [
    { name: 'Small HTML', size: 50000 },
    { name: 'Medium HTML', size: 500000 },
    { name: 'Large HTML', size: 1000000 },
    { name: 'Extra Large HTML', size: 2000000 }
  ];

  const results = [];

  for (const testCase of testSizes) {
    console.log(`\n🧪 Тестирование: ${testCase.name} (${testCase.size} chars)`);

    try {
      const result = await runRecoveryTest();
      results.push({
        testCase: testCase.name,
        size: testCase.size,
        success: result.success,
        error: result.error
      });

      console.log(`✅ Тест ${testCase.name}: ${result.success ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);

      // Пауза между тестами
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      console.error(`❌ Тест ${testCase.name} завершился с ошибкой:`, error);
      results.push({
        testCase: testCase.name,
        size: testCase.size,
        success: false,
        error: error.message
      });
    }
  }

  console.log('\n📋 РЕЗУЛЬТАТЫ СЕРИИ ТЕСТОВ:');
  results.forEach(result => {
    console.log(`${result.testCase}: ${result.success ? '✅' : '❌'} ${result.error || 'OK'}`);
  });

  return results;
}

// Экспортируем функции для использования в консоли
window.recoveryTestSystem = {
  runRecoveryTest,
  checkTransferStatus,
  runMultipleRecoveryTests,
  getCurrentUrl: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.url;
  }
};

console.log('🎯 Функции тестирования recovery доступны:');
console.log('- recoveryTestSystem.runRecoveryTest() - запуск основного теста recovery');
console.log('- recoveryTestSystem.checkTransferStatus(transferId) - проверка статуса transfer');
console.log('- recoveryTestSystem.runMultipleRecoveryTests() - серия тестов с разными размерами');
console.log('- recoveryTestSystem.getCurrentUrl() - получение текущего URL');

// Автоматический запуск основного теста
console.log('🚀 Автоматический запуск теста recovery через 3 секунды...');
setTimeout(() => {
  runRecoveryTest().then(result => {
    console.log('🏁 Автоматический тест завершен:', result);
  }).catch(error => {
    console.error('💥 Автоматический тест завершился с ошибкой:', error);
  });
}, 3000);