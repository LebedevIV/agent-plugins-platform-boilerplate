#!/usr/bin/env node

/**
 * Анализатор recovery механизма для тестирования исправлений
 * Проверяет код background.ts на правильность реализации recovery
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 АНАЛИЗАТОР RECOVERY МЕХАНИЗМА');
console.log('================================');

// Читаем код background.ts
const backgroundCode = fs.readFileSync('src/background/background.ts', 'utf8');

console.log('✅ Код background.ts прочитан успешно');

// Проверки recovery механизма
const checks = [
  {
    name: '✅ Сохранение метаданных перед завершением transfer',
    pattern: /saveTransferMetadataBeforeCompletion/,
    description: 'Функция должна сохранять pluginId и pageKey перед завершением transfer'
  },
  {
    name: '✅ Восстановление pluginId из chrome.storage',
    pattern: /pluginId.*savedMetadata.*pluginId/,
    description: 'Recovery должен восстанавливать pluginId из сохранённых метаданных'
  },
  {
    name: '✅ Восстановление pageKey из chrome.storage',
    pattern: /pageKey.*savedMetadata.*pageKey/,
    description: 'Recovery должен восстанавливать pageKey из сохранённых метаданных'
  },
  {
    name: '✅ Multi-layer recovery стратегия',
    pattern: /Strategy [1-5]/,
    description: 'Должно быть 5 стратегий recovery (emergency_backup, global_scope, chrome_storage, offscreen_requery, partial_recovery)'
  },
  {
    name: '✅ TransferPersistenceManager',
    pattern: /class TransferPersistenceManager/,
    description: 'Должен быть класс для сохранения/загрузки метаданных transfer в chrome.storage'
  },
  {
    name: '✅ TransferRecoveryManager',
    pattern: /class TransferRecoveryManager/,
    description: 'Должен быть класс для выполнения recovery операций'
  },
  {
    name: '✅ Multi-layer storage verification',
    pattern: /verifyMultiLayerStorage/,
    description: 'Должна быть функция проверки сохранения transfer во всех storage слоях'
  },
  {
    name: '✅ Recovery из emergency backup',
    pattern: /recoverFromEmergencyBackup/,
    description: 'Должна быть стратегия recovery из emergency backup'
  },
  {
    name: '✅ Recovery из global scope',
    pattern: /recoverFromGlobalScope/,
    description: 'Должна быть стратегия recovery из global scope'
  },
  {
    name: '✅ Recovery из chrome storage',
    pattern: /recoverFromChromeStorage/,
    description: 'Должна быть стратегия recovery из chrome.storage'
  },
  {
    name: '✅ Обработка HTML_ASSEMBLED с recovery',
    pattern: /HTML_ASSEMBLED.*recovery/,
    description: 'Обработка HTML_ASSEMBLED должна включать recovery логику'
  }
];

console.log('\n📋 ПРОВЕРКА ВАЖНЫХ КОМПОНЕНТОВ RECOVERY:');
console.log('=====================================');

let passedChecks = 0;
let failedChecks = 0;

checks.forEach(check => {
  const found = check.pattern.test(backgroundCode);
  if (found) {
    console.log(`✅ ${check.name}`);
    console.log(`   ${check.description}`);
    passedChecks++;
  } else {
    console.log(`❌ ${check.name}`);
    console.log(`   ${check.description}`);
    failedChecks++;
  }
  console.log('');
});

console.log(`📊 РЕЗУЛЬТАТЫ АНАЛИЗА:`);
console.log(`✅ Пройдено проверок: ${passedChecks}`);
console.log(`❌ Провалено проверок: ${failedChecks}`);
console.log(`📈 Общий результат: ${passedChecks}/${passedChecks + failedChecks} (${Math.round(passedChecks / (passedChecks + failedChecks) * 100)}%)`);

// Анализ ключевых строк кода
console.log('\n🔍 АНАЛИЗ КЛЮЧЕВЫХ СТРОК КОДА:');
console.log('===============================');

// Ищем критические строки для recovery
const criticalPatterns = [
  {
    name: 'Строка сохранения pluginId в метаданные',
    pattern: /pluginId.*pendingWorkflow\.pluginId/
  },
  {
    name: 'Строка сохранения pageKey в метаданные',
    pattern: /pageKey.*transfer_/
  },
  {
    name: 'Строка восстановления pluginId',
    pattern: /pluginId.*savedMetadata.*pluginId/
  },
  {
    name: 'Строка использования recovered pluginId',
    pattern: /workflowPluginId.*recoveredMetadata\.pluginId/
  }
];

criticalPatterns.forEach(pattern => {
  const match = backgroundCode.match(pattern.pattern);
  if (match) {
    console.log(`✅ Найдена: ${pattern.name}`);
    console.log(`   Совпадение: ${match[0].substring(0, 100)}...`);
  } else {
    console.log(`❌ НЕ НАЙДЕНА: ${pattern.name}`);
  }
});

// Проверка на наличие проблемных паттернов
console.log('\n🚨 ПРОВЕРКА НА ПРОБЛЕМНЫЕ ПАТТЕРНЫ:');
console.log('=====================================');

const problemPatterns = [
  {
    name: 'Отсутствие проверки на undefined pluginId',
    pattern: /pluginId.*undefined/
  },
  {
    name: 'Отсутствие проверки на undefined pageKey',
    pattern: /pageKey.*undefined/
  }
];

problemPatterns.forEach(pattern => {
  const match = backgroundCode.match(pattern.pattern);
  if (match) {
    console.log(`⚠️  ВОЗМОЖНАЯ ПРОБЛЕМА: ${pattern.name}`);
    console.log(`   Найдено: ${match[0]}`);
  } else {
    console.log(`✅ OK: ${pattern.name}`);
  }
});

// Итоговые рекомендации
console.log('\n📋 РЕКОМЕНДАЦИИ ПО ТЕСТИРОВАНИЮ:');
console.log('================================');

if (passedChecks >= 8) {
  console.log('✅ Recovery механизм выглядит полноценно реализованным');
  console.log('Рекомендуется провести интеграционное тестирование с реальным браузером');
} else {
  console.log('⚠️  Recovery механизм требует доработки');
  console.log('Необходимо проверить отсутствующие компоненты');
}

console.log('\n🎯 СЛЕДУЮЩИЕ ШАГИ ТЕСТИРОВАНИЯ:');
console.log('1. Запустить расширение в браузере');
console.log('2. Открыть страницу с большим HTML (1MB+)');
console.log('3. Запустить RUN_WORKFLOW для ozon-analyzer плагина');
console.log('4. Мониторить логи на предмет:');
console.log('   - "🔍 Starting enhanced multi-layer transfer check"');
console.log('   - "✅ PluginId restored: ozon-analyzer"');
console.log('   - "✅ PageKey restored: [URL]"');
console.log('   - "🎉 Transfer recovery successful"');
console.log('5. Убедиться в отсутствии ошибок:');
console.log('   - "Cannot determine pluginId for recovered transfer"');
console.log('   - "Failed to process recovered transfer: Error: Missing pluginId"');

console.log('\n🏁 АНАЛИЗ ЗАВЕРШЕН');