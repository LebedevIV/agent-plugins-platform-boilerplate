# Chrome Extension MV3 с Pyodide в Offscreen Document

Этот пример демонстрирует, как создать Chrome расширение Manifest V3, которое использует Pyodide для выполнения Python-кода в offscreen документе с безопасным обменом данными через background script.

## Архитектура

```
┌─────────────┐    ├──────────────┤    ┌─────────────────┐    ├───────────────────┤
│   popup.js  │───▶│ background.js │───▶│ offscreen.html  │───▶│     pyodide       │
│  (UI слой)  │    │ (посредник)   │    │ (Python среда)  │    │ (Python runtime)  │
└─────────────┘    ├──────────────┤    └─────────────────┘    ├───────────────────┤
```

## Установка и запуск

1. **Создайте папку проекта** и скопируйте все файлы
2. **Откройте Chrome** и перейдите в `chrome://extensions/`
3. **Включите режим разработчика**
4. **Нажмите "Загрузить распакованное расширение"** и выберите папку проекта
5. **Закрепите расширение** для удобного доступа

## Ключевые особенности

### 🔒 Безопасность
- **CSP-совместимый**: Настроена Content Security Policy для работы с WebAssembly
- **Фильтрация кода**: Блокировка потенциально опасных Python команд
- **Изоляция**: Python код выполняется в отдельном offscreen документе

### ⚡ Производительность
- **Ленивая инициализация**: Pyodide загружается только при необходимости
- **Управление памятью**: Автоматическая очистка после выполнения
- **Таймауты**: Защита от зависших скриптов

### 🛠 Функциональность
- **Полноценный Python**: Поддержка NumPy, Pandas и других пакетов
- **Захват вывода**: Полное перехватывание stdout/stderr
- **Обработка ошибок**: Подробная диагностика с трассировкой стека

## Примеры Python кода

### Базовый пример
```python
# Простые вычисления
x = 42
y = x * 2
print(f"Результат: {y}")
```

### Работа с NumPy
```python
import numpy as np

# Создание массива и базовые операции
arr = np.array([1, 2, 3, 4, 5])
print(f"Массив: {arr}")
print(f"Среднее: {np.mean(arr)}")
print(f"Сумма: {np.sum(arr)}")

# Матричные операции
matrix = np.random.rand(3, 3)
print(f"Случайная матрица:\n{matrix}")
print(f"Определитель: {np.linalg.det(matrix)}")
```

### Анализ данных
```python
import pandas as pd
import numpy as np

# Создание DataFrame
data = {
    'name': ['Alice', 'Bob', 'Charlie'],
    'age': [25, 30, 35],
    'salary': [50000, 60000, 70000]
}

df = pd.DataFrame(data)
print("Исходные данные:")
print(df)

print("\nСтатистика:")
print(df.describe())

# Группировка и агрегация
print(f"\nСредний возраст: {df['age'].mean()}")
print(f"Максимальная зарплата: {df['salary'].max()}")
```

### Математические вычисления
```python
import math
import numpy as np

# Тригонометрические функции
angles = np.linspace(0, 2*np.pi, 10)
sin_values = np.sin(angles)

print("Углы и их синусы:")
for angle, sin_val in zip(angles, sin_values):
    print(f"sin({angle:.2f}) = {sin_val:.3f}")

# Статистические расчеты
data = np.random.normal(0, 1, 1000)
print(f"\nСлучайная выборка (n=1000):")
print(f"Среднее: {np.mean(data):.3f}")
print(f"Стд. отклонение: {np.std(data):.3f}")
```

## Техническая документация

### Обмен сообщениями

#### 1. Popup → Background
```javascript
// Отправка кода на выполнение
const response = await chrome.runtime.sendMessage({
  type: 'EXECUTE_PYTHON',
  target: 'background',
  code: pythonCode,
  timeout: 30000
});
```

#### 2. Background → Offscreen
```javascript
// Пересылка в offscreen документ
const result = await chrome.runtime.sendMessage({
  type: 'RUN_PYTHON',
  target: 'offscreen',
  code: message.code,
  timeout: message.timeout
});
```

#### 3. Структура ответа
```javascript
{
  success: true/false,
  result: any,           // Возвращаемое значение
  output: string,        // Вывод print()
  stderr: string,        // Предупреждения
  error: string          // Текст ошибки
}
```

### Управление жизненным циклом

#### Создание offscreen документа
```javascript
await chrome.offscreen.createDocument({
  url: 'offscreen.html',
  reasons: ['DOM_SCRAPING', 'WORKERS'],
  justification: 'Выполнение Python через Pyodide'
});
```

#### Закрытие для экономии памяти
```javascript
// Автоматическое закрытие при необходимости
await chrome.offscreen.closeDocument();
```

## Ограничения и рекомендации

### Ограничения Pyodide
- **Размер**: Pyodide довольно большой (~10-15 MB)
- **Скорость**: Медленнее нативного Python
- **Пакеты**: Не все Python пакеты доступны

### Ограничения Chrome MV3
- **API**: В offscreen доступен только `chrome.runtime`
- **CSP**: Строгая Content Security Policy
- **Память**: Ограничения на потребление ресурсов

### Рекомендации по использованию
1. **Кешируйте инициализацию**: Pyodide долго загружается
2. **Ограничивайте время выполнения**: Используйте таймауты
3. **Очищайте память**: Регулярно вызывайте cleanup()
4. **Обрабатывайте ошибки**: Предусмотрите fallback сценарии

## Расширение функциональности

### Добавление новых Python пакетов
```javascript
// В offscreen.js добавьте:
await pyodide.loadPackage(["scipy", "matplotlib", "scikit-learn"]);
```

### Кастомные Python функции
```python
# Добавьте в инициализацию Pyodide
pyodide.runPython(`
def custom_function(data):
    # Ваша логика здесь
    return processed_data

# Сделать функцию доступной глобально
import builtins
builtins.custom_function = custom_function
`);
```

### Сохранение состояния
```javascript
// Сохранение в chrome.storage
await chrome.storage.local.set({
  pythonVariables: pyodide.runPython('globals()')
});
```

## Отладка

### Включение подробных логов
```javascript
// В offscreen.js
const DEBUG = true;
if (DEBUG) {
  console.log('Детальная информация:', data);
}
```

### Мониторинг производительности
```javascript
// Измерение времени выполнения
const startTime = performance.now();
const result = await executePython(code);
const endTime = performance.now();
console.log(`Execution time: ${endTime - startTime}ms`);
```

## Альтернативные подходы

### Использование Web Workers
```javascript
// Вместо offscreen документа можно использовать Web Worker
const worker = new Worker('pyodide-worker.js');
worker.postMessage({ code: pythonCode });
```

### Серверное выполнение
```javascript
// Отправка кода на сервер для выполнения
const response = await fetch('/execute-python', {
  method: 'POST',
  body: JSON.stringify({ code: pythonCode })
});
```

Анализ и предложения по улучшению
Проактивное улучшение системы:
Рассматривая созданное решение с точки зрения архитектуры и эффективности, я предлагаю несколько ключевых улучшений:
1. Кеширование и оптимизация загрузки
javascript// Предзагрузка Pyodide при установке расширения
chrome.runtime.onInstalled.addListener(() => {
  chrome.offscreen.createDocument({...}).then(() => {
    // Преинициализация в фоне
  });
});
2. Модульная архитектура
Текущий код можно разбить на отдельные модули:

pyodide-manager.js - управление Pyodide
message-router.js - маршрутизация сообщений
security-validator.js - проверка безопасности кода

3. Streaming выполнения
Для длительных операций можно реализовать потоковый вывод:
javascript// Отправка промежуточных результатов
pyodide.runPython(`
import sys
sys.stdout.write = lambda x: send_intermediate_result(x)
`);
Этот пример представляет собой complete, production-ready решение для интеграции Pyodide с Chrome Extension MV3. Основные преимущества:
✅ Полная совместимость с MV3
✅ Безопасное выполнение Python кода
✅ Эффективное управление ресурсами
✅ Подробная обработка ошибок
✅ Готовые примеры использования