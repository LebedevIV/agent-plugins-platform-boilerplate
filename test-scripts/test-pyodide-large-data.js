/* eslint-disable no-undef */
// Тестовый скрипт для проверки передачи больших данных в Pyodide
// Запускать в консоли DevTools расширения

console.log('🧪 Тестирование передачи больших данных в Pyodide...');

// Функция для создания тестовых больших данных
function generateLargeHtml(sizeInChars = 1052461) {
  console.log(`📊 Генерация HTML данных размером ${sizeInChars} символов...`);

  let html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Тестовый товар Ozon - Большой HTML</title>
</head>
<body>
    <div class="product-page">
        <h1>Тестовый товар для анализа Pyodide</h1>
        <div class="price">₽ 1,999</div>
        <div class="description">
            <p>Это тестовый товар для проверки передачи больших данных в Pyodide через глобальное пространство.</p>
        </div>
        <div class="specifications">
            <h2>Характеристики</h2>
            <ul>`;

  // Добавляем много характеристик для достижения нужного размера
  for (let i = 0; i < 1000; i++) {
    html += `
                <li>Характеристика ${i + 1}: Значение характеристики номер ${i + 1} с подробным описанием для увеличения размера данных</li>`;
  }

  html += `
            </ul>
        </div>
        <div class="reviews">
            <h2>Отзывы покупателей</h2>`;

  // Добавляем много отзывов
  for (let i = 0; i < 500; i++) {
    html += `
            <div class="review">
                <h3>Отзыв ${i + 1}</h3>
                <p>Это тестовый отзыв номер ${i + 1} от покупателя. Товар пришел в отличном состоянии, все работает как надо. Качество на высоте, рекомендую всем знакомым. Доставка была быстрой, упаковка надежной. Буду покупать еще.</p>
                <div class="rating">★★★★★</div>
                <div class="author">Покупатель ${i + 1}</div>
                <div class="date">2024-01-${String((i % 28) + 1).padStart(2, '0')}</div>
            </div>`;
  }

  // Добавляем дополнительные разделы для достижения размера
  html += `
        </div>
        <div class="additional-info">
            <h2>Дополнительная информация</h2>
            <div class="shipping">
                <h3>Доставка</h3>
                <p>Бесплатная доставка при заказе от 1000 рублей. Срок доставки 1-3 дня.</p>
            </div>
            <div class="warranty">
                <h3>Гарантия</h3>
                <p>Гарантия производителя 1 год. Возможен возврат в течение 30 дней.</p>
            </div>
        </div>
        <div class="faq">
            <h2>Часто задаваемые вопросы</h2>`;

  // Добавляем много FAQ
  for (let i = 0; i < 300; i++) {
    html += `
            <div class="faq-item">
                <h3>Вопрос ${i + 1}: Как использовать этот товар?</h3>
                <p>Ответ на вопрос ${i + 1}: Для использования этого товара следуйте инструкции производителя. Подробное описание с множеством деталей для увеличения размера данных и тестирования передачи в Pyodide.</p>
            </div>`;
  }

  html += `
        </div>
    </div>
</body>
</html>`;

  // Если размер меньше нужного, добавляем повторяющийся контент
  while (html.length < sizeInChars) {
    html += `
        <div class="extra-content">
            <p>Дополнительный контент для увеличения размера: ${html.length}/${sizeInChars}. ${'Тестовые данные для проверки передачи больших строк в Pyodide. '.repeat(10)}</p>
        </div>`;
  }

  // Обрезаем до точного размера
  if (html.length > sizeInChars) {
    html = html.substring(0, sizeInChars);
    // Убеждаемся, что HTML остается валидным
    if (!html.endsWith('</html>')) {
      html += '</html>';
    }
  }

  console.log(`✅ Сгенерирован HTML размером ${html.length} символов`);
  return html;
}

// Функция для тестирования EXECUTE_WORKFLOW с большими данными
async function testExecuteWorkflowWithLargeData() {
  try {
    console.log('🚀 Запуск теста EXECUTE_WORKFLOW с большими данными...');

    // Генерируем большие тестовые данные
    const largeHtml = generateLargeHtml(1052461);
    console.log(`📊 Размер тестовых данных: ${largeHtml.length} символов`);

    // Получаем текущий URL для теста
    const currentUrl = window.location.href;
    console.log('📍 Текущий URL:', currentUrl);

    // Создаем сообщение для EXECUTE_WORKFLOW
    const message = {
      type: 'EXECUTE_WORKFLOW',
      pluginId: 'ozon-analyzer',
      pageKey: currentUrl,
      requestId: `test_large_data_${Date.now()}`,
      pageHtml: largeHtml, // Передаем большие данные напрямую
      useChunks: false
    };

    console.log('📤 Отправка сообщения EXECUTE_WORKFLOW в background...');

    // Отправляем сообщение в background script
    const response = await chrome.runtime.sendMessage(message);

    console.log('📥 Получен ответ от background:', response);

    if (response && response.success) {
      console.log('✅ Тест прошел успешно!');
      console.log('📊 Результат анализа:', response.result);
      console.log('📊 Размер обработанных данных:', largeHtml.length, 'символов');
    } else {
      console.error('❌ Тест провален:', response?.error || 'Неизвестная ошибка');
    }

    return response;

  } catch (error) {
    console.error('❌ Критическая ошибка при тестировании:', error);
    return { success: false, error: error.message };
  }
}

// Функция для тестирования с разными размерами данных
async function testMultipleSizes() {
  const sizes = [10000, 50000, 100000, 500000, 1000000, 1052461];

  console.log('🧪 Запуск серии тестов с разными размерами данных...');

  for (const size of sizes) {
    console.log(`\n📏 Тестирование с размером ${size} символов...`);

    try {
      const largeHtml = generateLargeHtml(size);
      const startTime = Date.now();

      const message = {
        type: 'EXECUTE_WORKFLOW',
        pluginId: 'ozon-analyzer',
        pageKey: window.location.href,
        requestId: `test_size_${size}_${Date.now()}`,
        pageHtml: largeHtml,
        useChunks: false
      };

      const response = await chrome.runtime.sendMessage(message);
      const endTime = Date.now();

      console.log(`⏱️ Время обработки: ${endTime - startTime}ms`);
      console.log(`📊 Статус: ${response?.success ? '✅ УСПЕХ' : '❌ ПРОВАЛ'}`);

      if (!response?.success) {
        console.error('❌ Ошибка:', response?.error);
        break; // Прерываем тест при первой ошибке
      }

    } catch (error) {
      console.error(`❌ Ошибка при тестировании размера ${size}:`, error);
      break;
    }
  }

  console.log('🏁 Серия тестов завершена');
}

// Экспортируем функции для использования в консоли
window.pyodideTest = {
  testExecuteWorkflowWithLargeData,
  testMultipleSizes,
  generateLargeHtml,
};

console.log('🎯 Функции тестирования Pyodide доступны:');
console.log('- pyodideTest.testExecuteWorkflowWithLargeData() - тест с большими данными (1M+ символов)');
console.log('- pyodideTest.testMultipleSizes() - серия тестов с разными размерами');
console.log('- pyodideTest.generateLargeHtml(size) - генерация HTML заданного размера');

console.log('💡 Рекомендуется начать с: pyodideTest.testExecuteWorkflowWithLargeData()');