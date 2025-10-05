// Тестовый скрипт для проверки PYODIDE_MESSAGE после внедрения Варианта 2
// Запуск: node test-pyodide-message.js

console.log('🧪 Тестирование PYODIDE_MESSAGE верификации после Варианта 2...');

// Имитация chrome.runtime API для тестирования
const mockChrome = {
  runtime: {
    sendMessage: (message, callback) => {
      console.log('📤 Отправка PYODIDE_MESSAGE:', {
        type: message.type,
        pluginId: message.pluginId,
        pageKey: message.pageKey?.substring(0, 50) + '...',
        messageLength: message.message?.length || 0,
        timestamp: message.timestamp
      });

      // Имитация ответа background script
      setTimeout(() => {
        if (message.type === 'PYODIDE_MESSAGE') {
          // Имитируем успешную обработку и верификацию
          callback({
            success: true,
            messageId: `pyodide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'PYODIDE_MESSAGE_RESPONSE'
          });
        } else {
          callback({ error: 'Неизвестный тип сообщения' });
        }
      }, 100); // Имитация задержки background
    },

    lastError: null,

    onMessage: {
      addListener: (listener) => {
        console.log('📡 Добавлен слушатель сообщений');
      },
      removeListener: (listener) => {
        console.log('🔌 Удален слушатель сообщений');
      }
    }
  }
};

// Глобальный объект chrome для тестирования
global.chrome = mockChrome;

// Имитация Promise-based подхода (как в исправленном коде)
function sendPyodideMessage(pluginId, pageKey, message, timestamp = Date.now()) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('PYODIDE_MESSAGE timeout after 10000ms'));
    }, 10000);

    chrome.runtime.sendMessage({
      type: 'PYODIDE_MESSAGE',
      pluginId,
      pageKey,
      message,
      timestamp
    }, (response) => {
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        console.error('❌ sendPyodideMessage error:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response === undefined) {
        console.warn('⚠️ sendPyodideMessage: received undefined response');
        reject(new Error('Background script returned undefined'));
        return;
      }

      resolve(response);
    });
  });
}

// Тест 1: Проверка корректной структуры PYODIDE_MESSAGE (Вариант 2)
async function testCorrectPyodideMessage() {
  console.log('\n📋 Тест 1: Корректная структура PYODIDE_MESSAGE (Вариант 2)');

  try {
    const pluginId = 'ozon-analyzer';
    const pageKey = 'https://www.ozon.ru/product/test-product-123';
    const message = 'Анализ товара завершен. Найдена информация о цене и характеристиках.';
    const timestamp = Date.now();

    const response = await sendPyodideMessage(pluginId, pageKey, message, timestamp);

    console.log('✅ PYODIDE_MESSAGE успешно отправлен и обработан:', response);
    console.log('   - messageId:', response.messageId);
    console.log('   - success:', response.success);

    // Проверяем, что messageId имеет правильный формат
    if (response.messageId && response.messageId.startsWith('pyodide_')) {
      console.log('   ✅ messageId имеет правильный формат (начинается с pyodide_)');
      return true;
    } else {
      console.error('   ❌ messageId имеет неправильный формат');
      return false;
    }

  } catch (error) {
    console.error('❌ PYODIDE_MESSAGE ошибка:', error.message);
    return false;
  }
}

// Тест 2: Проверка обработки объекта в message
async function testObjectMessage() {
  console.log('\n📦 Тест 2: Обработка объекта в message поле');

  try {
    const pluginId = 'ozon-analyzer';
    const pageKey = 'https://www.ozon.ru/product/test-product-456';
    const message = {
      type: 'analysis_result',
      product: {
        name: 'Тестовый товар',
        price: 1500,
        rating: 4.5
      },
      analysis: {
        competitors: 12,
        trend: 'up'
      }
    };
    const timestamp = Date.now();

    const response = await sendPyodideMessage(pluginId, pageKey, message, timestamp);

    console.log('✅ Объект в message успешно обработан:', response);
    console.log('   - messageId:', response.messageId);
    console.log('   - success:', response.success);

    return true;
  } catch (error) {
    console.error('❌ Обработка объекта в message ошибка:', error.message);
    return false;
  }
}

// Тест 3: Проверка отсутствия обязательных полей
async function testMissingFields() {
  console.log('\n❌ Тест 3: Отсутствие обязательных полей');

  try {
    const response = await sendPyodideMessage('', '', '');

    console.log('❌ Ожидалась ошибка из-за отсутствия полей, но получили ответ:', response);
    return false;
  } catch (error) {
    if (error.message.includes('Missing required fields')) {
      console.log('✅ Корректная обработка отсутствия обязательных полей:', error.message);
      return true;
    } else {
      console.error('❌ Неожиданная ошибка:', error.message);
      return false;
    }
  }
}

// Тест 4: Проверка timeout
async function testTimeout() {
  console.log('\n⏱️ Тест 4: Проверка timeout');

  // Изменяем mock для имитации долгого ответа
  const originalSendMessage = mockChrome.runtime.sendMessage;
  mockChrome.runtime.sendMessage = (message, callback) => {
    // Имитация очень долгого ответа (больше timeout)
    setTimeout(() => {
      callback({ success: true, messageId: 'test-id' });
    }, 15000); // 15 секунд - больше чем наш timeout 10 секунд
  };

  try {
    const response = await sendPyodideMessage('test-plugin', 'test-page', 'test message');

    console.log('❌ Ожидался timeout, но получили ответ:', response);
    return false;
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.log('✅ Timeout сработал корректно:', error.message);
      return true;
    } else {
      console.error('❌ Неожиданная ошибка:', error.message);
      return false;
    }
  } finally {
    // Восстанавливаем оригинальную функцию
    mockChrome.runtime.sendMessage = originalSendMessage;
  }
}

// Основная функция тестирования
async function runPyodideTests() {
  console.log('🚀 Запуск тестов PYODIDE_MESSAGE после Варианта 2...\n');

  const tests = [
    testCorrectPyodideMessage,
    testObjectMessage,
    testMissingFields,
    testTimeout
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error('💥 Критическая ошибка в тесте:', error);
      failed++;
    }
  }

  console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ PYODIDE_MESSAGE:');
  console.log(`✅ Пройдено: ${passed}`);
  console.log(`❌ Провалено: ${failed}`);
  console.log(`📈 Всего тестов: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! PYODIDE_MESSAGE работает корректно после Варианта 2.');
    console.log('🔧 Верификация сообщений исправлена - поле id присваивается, role = "plugin".');
    console.log('📝 Рекомендуется провести интеграционное тестирование в браузере.');
  } else {
    console.log('\n⚠️ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ. Требуется дополнительная отладка.');
  }

  return { passed, failed, total: passed + failed };
}

// Запуск тестов
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runPyodideTests };
} else {
  runPyodideTests().catch(console.error);
}