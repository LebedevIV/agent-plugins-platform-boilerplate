// Команды для отладки чата в консоли браузера
// Вставьте эти команды в консоль браузера для тестирования

console.log('=== КОМАНДЫ ОТЛАДКИ ЧАТА ===');

// 1. Проверка доступности API чата
window.testChatAPI = async function() {
  console.log('Проверка API чата...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_PLUGIN_CHAT',
      pluginId: 'debug-plugin',
      pageKey: window.location.href
    });

    console.log('Ответ API:', response);
    return response;
  } catch (error) {
    console.error('Ошибка API:', error);
    return null;
  }
};

// 2. Создание тестового чата
window.createTestChat = async function(pluginId = 'test-plugin') {
  console.log('Создание тестового чата...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_PLUGIN_CHAT',
      pluginId,
      pageKey: window.location.href
    });

    console.log('Чат создан:', response);
    return response;
  } catch (error) {
    console.error('Ошибка создания чата:', error);
    return null;
  }
};

// 3. Отправка тестового сообщения
window.sendTestMessage = async function(pluginId = 'test-plugin', content = 'Тестовое сообщение') {
  console.log('Отправка тестового сообщения...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_MESSAGE',
      pluginId,
      pageKey: window.location.href,
      message: {
        role: 'user',
        content: content,
        timestamp: Date.now()
      }
    });

    console.log('Сообщение отправлено:', response);
    return response;
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    return null;
  }
};

// 4. Получение всех чатов плагина
window.getAllChats = async function(pluginId = 'test-plugin') {
  console.log('Получение всех чатов плагина...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'LIST_PLUGIN_CHATS',
      pluginId
    });

    console.log('Все чаты плагина:', response);
    return response;
  } catch (error) {
    console.error('Ошибка получения чатов:', error);
    return null;
  }
};

// 5. Проверка черновиков
window.testDrafts = async function(pluginId = 'test-plugin') {
  console.log('Тестирование черновиков...');

  const testText = 'Тест черновика ' + Date.now();

  try {
    // Сохраняем черновик
    await chrome.runtime.sendMessage({
      type: 'SAVE_PLUGIN_CHAT_DRAFT',
      pluginId,
      pageKey: window.location.href,
      draftText: testText
    });
    console.log('Черновик сохранен');

    // Получаем черновик
    const response = await chrome.runtime.sendMessage({
      type: 'GET_PLUGIN_CHAT_DRAFT',
      pluginId,
      pageKey: window.location.href
    });

    console.log('Полученный черновик:', response);

    if (response?.draftText === testText) {
      console.log('✅ Черновик работает корректно');
    } else {
      console.log('❌ Черновик не совпадает');
    }

    return response;
  } catch (error) {
    console.error('Ошибка тестирования черновиков:', error);
    return null;
  }
};

// 6. Очистка всех данных чата
window.clearAllChatData = async function(pluginId = 'test-plugin') {
  console.log('Очистка всех данных чата...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DELETE_PLUGIN_CHAT',
      pluginId,
      pageKey: window.location.href
    });

    console.log('Чат очищен:', response);
    return response;
  } catch (error) {
    console.error('Ошибка очистки чата:', error);
    return null;
  }
};

// 7. Комплексный тест
window.runFullChatTest = async function() {
  console.log('🚀 Запуск комплексного теста чата...');

  const pluginId = 'full-test-' + Date.now();

  try {
    // 1. Создаем чат
    console.log('1. Создание чата...');
    await window.createTestChat(pluginId);

    // 2. Отправляем несколько сообщений
    console.log('2. Отправка сообщений...');
    await window.sendTestMessage(pluginId, 'Первое тестовое сообщение');
    await window.sendTestMessage(pluginId, 'Второе тестовое сообщение');

    // 3. Проверяем черновики
    console.log('3. Тестирование черновиков...');
    await window.testDrafts(pluginId);

    // 4. Получаем все чаты
    console.log('4. Получение всех чатов...');
    const chats = await window.getAllChats(pluginId);
    console.log('Количество чатов:', chats?.length || 0);

    // 5. Очищаем данные
    console.log('5. Очистка данных...');
    await window.clearAllChatData(pluginId);

    console.log('✅ Комплексный тест завершен успешно!');
    return true;

  } catch (error) {
    console.error('❌ Ошибка комплексного теста:', error);
    return false;
  }
};

// 8. Мониторинг изменений в storage
window.monitorStorage = function() {
  console.log('🔍 Мониторинг изменений в chrome.storage.local...');

  chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('📦 Изменения в storage:', changes);
    for (let key in changes) {
      console.log(`  ${key}:`, changes[key]);
    }
  });

  console.log('✅ Мониторинг включен');
};

// 9. Проверка текущего состояния storage
window.checkStorage = async function() {
  console.log('📊 Проверка текущего состояния storage...');

  try {
    const allData = await new Promise(resolve => {
      chrome.storage.local.get(null, resolve);
    });

    const chatKeys = Object.keys(allData).filter(key => key.includes('::'));
    console.log(`Всего ключей: ${Object.keys(allData).length}`);
    console.log(`Ключей чатов: ${chatKeys.length}`);

    if (chatKeys.length > 0) {
      console.log('Примеры ключей чатов:');
      chatKeys.slice(0, 5).forEach(key => {
        console.log(`  ${key}:`, allData[key]);
      });
    }

    return allData;
  } catch (error) {
    console.error('Ошибка проверки storage:', error);
    return null;
  }
};

console.log('📋 Доступные команды:');
console.log('  window.testChatAPI() - проверка API');
console.log('  window.createTestChat() - создание чата');
console.log('  window.sendTestMessage() - отправка сообщения');
console.log('  window.getAllChats() - получение всех чатов');
console.log('  window.testDrafts() - тестирование черновиков');
console.log('  window.clearAllChatData() - очистка данных');
console.log('  window.runFullChatTest() - комплексный тест');
console.log('  window.monitorStorage() - мониторинг storage');
console.log('  window.checkStorage() - проверка storage');
console.log('');
console.log('💡 Для запуска комплексного теста выполните: window.runFullChatTest()');