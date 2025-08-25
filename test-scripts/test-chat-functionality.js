// Тест функциональности чата - проверка исправлений
// Этот скрипт тестирует все аспекты работы чата после исправлений

console.log('=== ТЕСТИРОВАНИЕ ФУНКЦИОНАЛЬНОСТИ ЧАТА ===');

// Тест 1: Проверка работы plugin-chat-api
async function testPluginChatAPI() {
  console.log('\n--- Тест 1: Проверка plugin-chat-api ---');

  try {
    // Проверяем доступность API
    const response = await chrome.runtime.sendMessage({
      type: 'GET_PLUGIN_CHAT',
      pluginId: 'test-plugin',
      pageKey: 'test-page'
    });

    console.log('✓ API доступен, ответ:', response);

    // Проверяем структуру ответа
    if (response && typeof response === 'object') {
      console.log('✓ Структура ответа корректна');
      if (Array.isArray(response.messages)) {
        console.log('✓ messages - массив');
      } else {
        console.log('⚠ messages не является массивом:', response.messages);
      }
    } else {
      console.log('⚠ Ответ не является объектом');
    }

  } catch (error) {
    console.error('✗ Ошибка при тестировании API:', error);
  }
}

// Тест 2: Проверка механизма кэширования
async function testCachingMechanism() {
  console.log('\n--- Тест 2: Проверка механизма кэширования ---');

  try {
    const pluginId = 'test-plugin-' + Date.now();
    const pageKey = 'test-page-' + Date.now();

    // Создаем чат
    await chrome.runtime.sendMessage({
      type: 'CREATE_PLUGIN_CHAT',
      pluginId,
      pageKey
    });

    // Получаем чат
    const chat1 = await chrome.runtime.sendMessage({
      type: 'GET_PLUGIN_CHAT',
      pluginId,
      pageKey
    });

    console.log('✓ Чат создан и получен:', chat1);

    // Сохраняем сообщение
    await chrome.runtime.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_MESSAGE',
      pluginId,
      pageKey,
      message: {
        role: 'user',
        content: 'Тестовое сообщение для проверки кэширования',
        timestamp: Date.now()
      }
    });

    // Получаем чат снова
    const chat2 = await chrome.runtime.sendMessage({
      type: 'GET_PLUGIN_CHAT',
      pluginId,
      pageKey
    });

    console.log('✓ Сообщение сохранено, обновленный чат:', chat2);

    // Проверяем, что сообщение добавлено
    if (chat2 && chat2.messages && chat2.messages.length > 0) {
      console.log('✓ Сообщение успешно сохранено в кэше');
    } else {
      console.log('⚠ Сообщение не найдено в кэше');
    }

  } catch (error) {
    console.error('✗ Ошибка при тестировании кэширования:', error);
  }
}

// Тест 3: Проверка работы черновиков
async function testDraftFunctionality() {
  console.log('\n--- Тест 3: Проверка работы черновиков ---');

  try {
    const pluginId = 'draft-test-' + Date.now();
    const pageKey = 'draft-page-' + Date.now();
    const draftText = 'Тестовый черновик для проверки';

    // Сохраняем черновик
    await chrome.runtime.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_DRAFT',
      pluginId,
      pageKey,
      draftText
    });

    console.log('✓ Черновик сохранен');

    // Получаем черновик
    const response = await chrome.runtime.sendMessage({
      type: 'GET_PLUGIN_CHAT_DRAFT',
      pluginId,
      pageKey
    });

    console.log('✓ Черновик получен:', response);

    if (response && response.draftText === draftText) {
      console.log('✓ Черновик корректно сохранен и получен');
    } else {
      console.log('⚠ Черновик не совпадает с ожидаемым значением');
    }

  } catch (error) {
    console.error('✗ Ошибка при тестировании черновиков:', error);
  }
}

// Тест 4: Проверка localStorage
async function testLocalStorage() {
  console.log('\n--- Тест 4: Проверка localStorage ---');

  try {
    // Проверяем доступ к chrome.storage.local
    const allData = await new Promise(resolve => {
      chrome.storage.local.get(null, resolve);
    });

    console.log('✓ chrome.storage.local доступен, общее количество ключей:', Object.keys(allData).length);

    // Ищем ключи чатов
    const chatKeys = Object.keys(allData).filter(key => key.includes('::'));
    console.log('✓ Найдено ключей чатов:', chatKeys.length);

    if (chatKeys.length > 0) {
      console.log('✓ Примеры ключей чатов:', chatKeys.slice(0, 3));
    }

  } catch (error) {
    console.error('✗ Ошибка при тестировании localStorage:', error);
  }
}

// Тест 5: Проверка компонентов интерфейса
function testUIComponents() {
  console.log('\n--- Тест 5: Проверка компонентов интерфейса ---');

  // Проверяем наличие элементов в DOM
  setTimeout(() => {
    const chatMessages = document.querySelector('.chat-messages');
    const chatInput = document.querySelector('.chat-input-container textarea');

    if (chatMessages) {
      console.log('✓ Элемент .chat-messages найден');
    } else {
      console.log('⚠ Элемент .chat-messages не найден');
    }

    if (chatInput) {
      console.log('✓ Элемент .chat-input-container textarea найден');
    } else {
      console.log('⚠ Элемент .chat-input-container textarea не найден');
    }
  }, 1000);
}

// Основная функция запуска тестов
async function runAllTests() {
  console.log('🚀 Запуск тестирования функциональности чата...');

  await testPluginChatAPI();
  await testCachingMechanism();
  await testDraftFunctionality();
  await testLocalStorage();
  testUIComponents();

  console.log('\n✅ Тестирование завершено!');
  console.log('📊 Проверьте консоль для детальных результатов');
}

// Запускаем тесты при загрузке страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runAllTests);
} else {
  runAllTests();
}