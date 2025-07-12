# DevTools Testing Guide

## 🎯 Тестирование чатов через DevTools Panel

### Предварительные требования
- ✅ DevTools panel "Agent Platform Tools" работает корректно
- ✅ Расширение загружено и активно
- ✅ Открыта страница Ozon (или любая другая страница)

## Пошаговая инструкция

### 1. Открытие DevTools Panel
1. Откройте DevTools (F12 или Ctrl+Shift+I)
2. Найдите вкладку **"Agent Platform Tools"** в верхней панели
3. Кликните на неё для открытия панели

### 2. Открытие консоли DevTools Panel
1. В открывшейся панели "Agent Platform Tools" кликните правой кнопкой мыши
2. Выберите **"Inspect"** или **"Просмотреть код"**
3. Откроется DevTools для панели расширения
4. Перейдите на вкладку **"Console"**

### 3. Загрузка тестового скрипта
В консоли DevTools Panel выполните:

```javascript
// Загружаем тестовый скрипт
fetch('/test-scripts/ozon-test.js')
  .then(response => response.text())
  .then(script => {
    eval(script);
    console.log('✅ Тестовый скрипт загружен');
  })
  .catch(error => {
    console.error('❌ Ошибка загрузки скрипта:', error);
  });
```

### 4. Альтернативный способ - копирование скрипта
Если fetch не работает, скопируйте содержимое `test-scripts/ozon-test.js` и вставьте в консоль.

### 5. Запуск тестов
После загрузки скрипта автоматически запустятся тесты, или выполните:

```javascript
// Запуск всех тестов
ozonTestSystem.runOzonTests();

// Или отдельные функции:
ozonTestSystem.createOzonChat();
ozonTestSystem.createTestPluginChat();
ozonTestSystem.sendTestLogs();
ozonTestSystem.getAllData();
```

## Проверка результатов

### В DevTools Panel
1. **Вкладка "Чаты плагинов"**:
   - Должны появиться чаты для `ozon-analyzer` и `test-chat-plugin`
   - Черновики должны отображаться с индикаторами статуса

2. **Вкладка "Логи"**:
   - Должны появиться логи с уровнями info, success, debug
   - Логи должны быть привязаны к соответствующим плагинам

### В консоли DevTools Panel
Должны появиться сообщения:
```
🎯 Тестирование чатов на странице Ozon...
📝 Создание чата для ozon-analyzer...
✅ Чат создан: {...}
✅ Сообщение пользователя сохранено: {...}
✅ Ответ плагина сохранен: {...}
✅ Черновик сохранен
...
```

## Доступные функции тестирования

### Основные функции
- `ozonTestSystem.runOzonTests()` - запуск всех тестов
- `ozonTestSystem.createOzonChat()` - создание чата для ozon-analyzer
- `ozonTestSystem.createTestPluginChat()` - создание чата для test-chat-plugin
- `ozonTestSystem.sendTestLogs()` - отправка тестовых логов
- `ozonTestSystem.getAllData()` - получение всех данных

### Вспомогательные функции
- `ozonTestSystem.getCurrentUrl()` - получение текущего URL

## Тестирование на разных страницах

### Ozon (рекомендуется)
```javascript
// Откройте страницу товара на Ozon
// Например: https://www.ozon.ru/product/...
ozonTestSystem.runOzonTests();
```

### Любая другая страница
```javascript
// Скрипт автоматически адаптируется к любой странице
ozonTestSystem.runOzonTests();
```

## Диагностика проблем

### Если DevTools Panel не открывается
1. Перезагрузите расширение в chrome://extensions/
2. Закройте и откройте DevTools заново
3. Проверьте, что вкладка "Agent Platform Tools" появилась

### Если скрипт не загружается
1. Проверьте, что вы в консоли DevTools Panel, а не основной страницы
2. Убедитесь, что `chrome.runtime` доступен
3. Попробуйте скопировать скрипт напрямую в консоль

### Если тесты не работают
1. Проверьте консоль на ошибки
2. Убедитесь, что background script работает
3. Проверьте, что расширение имеет необходимые разрешения

## Ожидаемые результаты

### Успешное тестирование
- ✅ Чаты созданы для обоих плагинов
- ✅ Сообщения сохранены в чатах
- ✅ Черновики созданы и отображаются
- ✅ Логи отправлены и видны в панели
- ✅ Все данные доступны через API

### В DevTools Panel должны появиться
- **Чаты**: 2 чата (ozon-analyzer, test-chat-plugin)
- **Черновики**: 1 черновик для ozon-analyzer
- **Логи**: 3 лога разных уровней

## Дополнительное тестирование

### Тестирование черновиков
```javascript
// Создание дополнительного черновика
chrome.runtime.sendMessage({
  type: 'SAVE_PLUGIN_CHAT_DRAFT',
  pluginId: 'test-chat-plugin',
  pageKey: window.location.href,
  draftText: 'Дополнительный тестовый черновик',
});
```

### Тестирование логов
```javascript
// Создание дополнительного лога
chrome.runtime.sendMessage({
  type: 'LOG_EVENT',
  pluginId: 'test-chat-plugin',
  pageKey: window.location.href,
  level: 'warning',
  stepId: 'test-warning',
  message: 'Тестовое предупреждение',
  logData: { test: true },
});
```

## Полезные команды для отладки

```javascript
// Проверка доступности API
console.log('chrome.runtime:', !!chrome.runtime);

// Получение текущего URL
ozonTestSystem.getCurrentUrl().then(url => console.log('URL:', url));

// Проверка всех данных
ozonTestSystem.getAllData().then(data => console.log('All data:', data));
``` 