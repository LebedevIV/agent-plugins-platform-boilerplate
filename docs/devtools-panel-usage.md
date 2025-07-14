# DevTools Panel Usage Guide

## ✅ Проблема решена!

Custom DevTools panel "Agent Platform Tools" теперь должна работать корректно после исправления конфигурации манифеста.

## Как открыть DevTools Panel

### Метод 1: Через браузер DevTools
1. Откройте DevTools (F12 или Ctrl+Shift+I)
2. В верхней панели DevTools найдите вкладку **"Agent Platform Tools"**
3. Кликните на неё для открытия панели

### Метод 2: Через контекстное меню
1. Откройте DevTools (F12)
2. Правой кнопкой мыши нажмите на вкладки DevTools
3. В контекстном меню выберите **"Agent Platform Tools"**

## Как открыть консоль расширения

### Для Side Panel:
1. Кликните на иконку расширения в панели инструментов
2. Откроется side panel
3. Правой кнопкой мыши кликните внутри side panel
4. Выберите **"Inspect"** или **"Просмотреть код"**
5. Откроется DevTools для side panel

### Для DevTools Panel:
1. Откройте DevTools Panel (см. выше)
2. Правой кнопкой мыши кликните внутри панели
3. Выберите **"Inspect"** или **"Просмотреть код"**
4. Откроется DevTools для DevTools Panel

### Для Background Script:
1. Откройте chrome://extensions/
2. Найдите расширение "Agent Plugins Platform"
3. Нажмите **"Service Worker"** (если есть)
4. Или используйте chrome://extensions/ и нажмите **"background page"**

## Запуск тестовых скриптов

### В DevTools Panel:
```javascript
// Тестовый скрипт для создания чатов
ozonTestSystem();
```

### В Side Panel:
```javascript
// Тестовый скрипт для Ozon
ozonTestSystem();
```

## Важные замечания

- **F12** открывает DevTools только для основной страницы
- Для расширения используйте ПКМ → "Inspect" внутри панелей
- DevTools Panel называется "Agent Platform Tools" (не путать с системными DevTools)
- Все тестовые скрипты должны запускаться в контексте расширения

## Устранение неполадок

Если панель не появляется:
1. Перезагрузите расширение в chrome://extensions/
2. Очистите кэш браузера
3. Перезапустите браузер
4. Убедитесь, что сборка прошла успешно (`npm run build`)

## Дополнительная документация

- [Troubleshooting Guide](devtools-panel-troubleshooting.md) - подробное описание проблем и решений
- [Gemini Delegation Summary](gemini-delegation-summary.md) - резюме для AI-ассистентов 