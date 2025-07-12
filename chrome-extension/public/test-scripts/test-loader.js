/* eslint-disable no-undef */
// Test Loader Module - безопасная загрузка тестовых скриптов
// Используется в DevTools панели для загрузки тестов без нарушения CSP

class TestLoader {
  constructor() {
    this.loadedScripts = new Map();
    this.testFunctions = {};
  }

  // Безопасная загрузка скрипта через script тег
  async loadScriptSafely(scriptPath) {
    return new Promise((resolve, reject) => {
      try {
        // Проверяем, не загружен ли уже скрипт
        const existingScript = document.querySelector(`script[src*="${scriptPath}"]`);
        if (existingScript) {
          console.log(`Скрипт уже загружен: ${scriptPath}`);
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(scriptPath);
        script.type = 'text/javascript';

        script.onload = () => {
          console.log(`✅ Скрипт загружен успешно: ${scriptPath}`);
          this.loadedScripts.set(scriptPath, {
            timestamp: Date.now(),
            loaded: true,
          });
          resolve();
        };

        script.onerror = error => {
          console.error(`❌ Ошибка загрузки скрипта ${scriptPath}:`, error);
          reject(new Error(`Failed to load script: ${scriptPath}`));
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('Ошибка создания script тега:', error);
        reject(error);
      }
    });
  }

  // Загрузка Ozon тестов
  async loadOzonTests() {
    try {
      console.log('🎯 Загрузка тестов Ozon...');

      await this.loadScriptSafely('test-scripts/ozon-test.js');

      // Проверяем, что функции доступны
      if (window.ozonTestSystem) {
        console.log('✅ Тесты Ozon загружены успешно');
        console.log('📋 Доступные функции:');
        console.log('- ozonTestSystem.createOzonChat()');
        console.log('- ozonTestSystem.createTestPluginChat()');
        console.log('- ozonTestSystem.sendTestLogs()');
        console.log('- ozonTestSystem.getAllData()');
        console.log('- ozonTestSystem.runOzonTests()');
        console.log('- ozonTestSystem.getCurrentUrl()');

        return window.ozonTestSystem;
      } else {
        throw new Error('Функции ozonTestSystem не найдены после загрузки скрипта');
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки тестов Ozon:', error);
      throw error;
    }
  }

  // Запуск всех тестов Ozon
  async runOzonTests() {
    try {
      const testSystem = await this.loadOzonTests();

      console.log('🚀 Запуск всех тестов Ozon...');

      // Запускаем тесты по порядку
      await testSystem.createOzonChat();
      await testSystem.createTestPluginChat();
      await testSystem.sendTestLogs();
      await testSystem.getAllData();

      console.log('✅ Все тесты Ozon завершены успешно!');
      return true;
    } catch (error) {
      console.error('❌ Ошибка выполнения тестов Ozon:', error);
      return false;
    }
  }

  // Получение списка загруженных скриптов
  getLoadedScripts() {
    return Array.from(this.loadedScripts.keys());
  }

  // Очистка загруженных скриптов
  clearLoadedScripts() {
    this.loadedScripts.clear();
    console.log('🧹 Загруженные скрипты очищены');
  }
}

// Создаем глобальный экземпляр загрузчика
window.testLoader = new TestLoader();

// Экспортируем для использования в консоли
console.log('🎯 TestLoader доступен:');
console.log('- testLoader.loadOzonTests() - загрузить тесты Ozon');
console.log('- testLoader.runOzonTests() - запустить все тесты Ozon');
console.log('- testLoader.getLoadedScripts() - список загруженных скриптов');
console.log('- testLoader.clearLoadedScripts() - очистить загруженные скрипты');

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TestLoader;
}

if (typeof exports !== 'undefined') {
  exports.TestLoader = TestLoader;
}
