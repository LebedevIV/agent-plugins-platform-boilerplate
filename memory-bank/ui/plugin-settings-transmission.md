# Механизм передачи значений настроек плагина от UI до Python-скрипта

## Обзор

Данная документация подробно описывает полный механизм передачи значений от элементов управления в настройках плагина браузерного расширения до Python-скрипта, выполняющегося в среде Pyodide. На примере плагина "Ozon Analyzer" рассматривается поток данных от страницы настроек `chrome-extension://nmbnfojfmelmoocokegobbdpngnobela/options/index.html` до скрипта `chrome-extension/public/plugins/ozon-analyzer/mcp_server.py`.

## Архитектурные компоненты

### 1. Страница настроек (Options Page)
**Путь:** `chrome-extension://nmbnfojfmelmoocokegobbdpngnobela/options/index.html`

Страница настроек представляет собой React-приложение, загружаемое через Vite. Ключевые файлы:
- `pages/options/index.html` - HTML shell с React-монтированием
- `pages/options/src/components/PluginDetails.tsx` - основной компонент настроек
- `pages/options/src/hooks/usePlugins.ts` - хук для работы с плагинами

### 2. Манифест плагина
**Путь:** `chrome-extension/public/plugins/ozon-analyzer/manifest.json`

Содержит определение настроек плагина в секции `options`:

```json
"options": {
  "response_language": {
    "type": "select",
    "default": "ru",
    "values": ["ru", "en", "auto"],
    "labels": {
      "ru": {"ru": "Русский", "en": "Russian"},
      "en": {"ru": "Английский", "en": "English"},
      "auto": {"ru": "Автоопределение", "en": "Auto-detect"}
    },
    "label": {
      "ru": "Язык ответа",
      "en": "Response language"
    }
  }
}
```

### 3. Background Script
**Путь:** `chrome-extension/public/background.js`

Отвечает за координацию между UI, хранилищем и offscreen документом.

### 4. Offscreen Document
**Путь:** `chrome-extension/public/offscreen.js`

Выполняет Python-код в среде Pyodide и обеспечивает мост между JavaScript и Python.

### 5. Python MCP Server
**Путь:** `chrome-extension/public/plugins/ozon-analyzer/mcp_server.py`

Основная логика плагина, выполняющаяся в Pyodide.

## Поток передачи данных

### Шаг 1: Определение настроек в манифесте

Настройки плагина определяются в файле `manifest.json` в секции `options`. Каждый параметр имеет:

- `type`: тип элемента управления (`boolean`, `select`, `text`, `number`)
- `default`: значение по умолчанию
- `label`: локализованная метка
- `values`: допустимые значения (для `select`)
- `labels`: локализованные метки для значений

### Шаг 2: Рендеринг элементов управления

В компоненте `PluginDetails.tsx` настройки преобразуются в HTML-элементы:

```typescript
const renderCustomSetting = (key: string, config: CustomSetting): ReactNode | null => {
  // Для response_language это будет <select> элемент
  if (config.type === 'select') {
    return (
      <select
        id={key}
        value={value as string}
        onChange={e => handleSettingChange(key, e.target.value)}
      >
        {config.values?.map((optionValue: string) => (
          <option key={optionValue} value={optionValue}>
            {getLocalizedText(config.labels?.[optionValue]) || optionValue}
          </option>
        ))}
      </select>
    );
  }
};
```

### Шаг 3: Сохранение в chrome.storage.local

При изменении значения вызывается функция `handleSettingChange`, которая сохраняет данные:

```typescript
const saveCustomSetting = async (setting: string, value: boolean | string | number) => {
  const key = `${selectedPlugin.id}_${setting}`; // "ozon-analyzer_response_language"
  await chrome.storage.local.set({ [key]: value });
};
```

### Шаг 4: Загрузка настроек при запуске workflow

В `background.js` при запуске плагина настройки загружаются:

```javascript
const settings = await getPluginSettings(msg.pluginId);
```

Функция `getPluginSettings` извлекает настройки из chrome.storage и возвращает объект:

```javascript
{
  enabled: true,
  autorun: false,
  response_language: "ru",
  enable_deep_analysis: true,
  // ...
}
```

### Шаг 5: Передача настроек в offscreen документ

Настройки передаются в offscreen документ через сообщение:

```javascript
const workflowPayload = {
  type: "EXECUTE_WORKFLOW",
  pluginId: msg.pluginId,
  pageKey,
  pluginSettings: settings, // <-- настройки здесь
  // ...
};
```

### Шаг 6: Установка в Pyodide globals

В offscreen документе настройки устанавливаются в глобальные переменные Pyodide:

```javascript
// КРИТИЧЕСКАЯ ДИАГНОСТИКА НЕПОСРЕДСТВЕННО ПЕРЕД ВЫЗОВОМ PYTHON ФУНКЦИИ
logInfo('PYODIDE', '🚨 КРИТИЧЕСКИЙ МОМЕНТ: Непосредственно перед вызовом Python функции');

// Установка pluginSettings
const pyPluginSettings = pyodide.toPy(pluginSettings);
pyodide.globals.set('pluginSettings', pyPluginSettings);

// Установка input_data
const inputData = { pluginSettings: pluginSettings };
pyodide.globals.set('input_data', inputData);

// Вызов Python функции
resultProxy = await analyzeOzonProduct.callPromising(
  pyodide.globals.get('input_data'), // <-- содержит pluginSettings
  1, // chunk_count
  workflowPayload.page_html.length, // total_length
  workflowPayload.page_html // chunk_0
);
```

### Шаг 7: Чтение настроек в Python-скрипте

В `mcp_server.py` настройки извлекаются из Pyodide globals:

```python
def get_pyodide_var(name: str, default: Any = None) -> Any:
    """Безопасная функция для доступа к переменным Pyodide globals."""
    try:
        if name in globals():
            value = globals()[name]
            return value
        else:
            return default
    except Exception as e:
        return default

# Получение настроек плагина
plugin_settings = get_pyodide_var('pluginSettings', {})

# Определение языка контента
content_language = get_safe_content_language(plugin_settings)
```

Функция `get_safe_content_language` извлекает и валидирует значение `response_language`:

```python
def get_safe_content_language(plugin_settings: Dict[str, Any]) -> str:
    """
    Безопасная функция определения языка контента для сообщений чата.

    Выполняет валидацию настройки response_language из plugin_settings и возвращает
    безопасное значение языка, гарантируя соответствие допустимым значениям.

    Args:
        plugin_settings (Dict[str, Any]): Настройки плагина, содержащие response_language

    Returns:
        str: Валидное значение языка ('ru', 'en', 'auto')

    Behavior:
        - Извлекает response_language из plugin_settings
        - Валидирует значение против допустимых: ['ru', 'en', 'auto']
        - Возвращает fallback 'ru' если значение некорректное или отсутствует
        - Логирует весь процесс валидации для диагностики
    """
    console_log("[LANGUAGE_VALIDATION] ===== НАЧАЛО ВАЛИДАЦИИ ЯЗЫКА =====")

    # ДОПОЛНИТЕЛЬНАЯ ПРОБЕРКА plugin_settings
    if not isinstance(plugin_settings, dict):
        console_log(f"[LANGUAGE_VALIDATION] ВНИМАНИЕ: plugin_settings не является словарем! Тип: {type(plugin_settings)}")
        plugin_settings = {}  # Принудительно устанавливаем пустой словарь

    # Извлечение значения response_language из plugin_settings
    raw_response_language = safe_dict_get(plugin_settings, "response_language", "ru")
    console_log(f"[LANGUAGE_VALIDATION] Извлечено response_language: '{raw_response_language}'")

    # Список допустимых значений
    valid_languages = ['ru', 'en', 'auto']
    console_log(f"[LANGUAGE_VALIDATION] Допустимые значения: {valid_languages}")

    # Детальная проверка валидности
    if raw_response_language in valid_languages:
        console_log(f"[LANGUAGE_VALIDATION] ✅ Валидация пройдена: '{raw_response_language}' допустим")
        result = raw_response_language
    else:
        console_log(f"[LANGUAGE_VALIDATION] ❌ Валидация НЕ пройдена: '{raw_response_language}' не допустим")
        console_log(f"[LANGUAGE_VALIDATION] 🔄 Используем fallback: 'ru'")
        result = "ru"

    console_log(f"[LANGUAGE_VALIDATION] Финальный результат: '{result}'")
    console_log("[LANGUAGE_VALIDATION] ===== КОНЕЦ ВАЛИДАЦИИ ЯЗЫКА =====")

    return result
```

Эта функция выполняет детальную валидацию значения `response_language` из настроек плагина, обеспечивая безопасность и корректность работы с языковыми настройками. Включает обширное логирование для диагностики проблем.

## Ключевые технические детали

### Хранение данных
- **Формат ключа:** `{pluginId}_{settingName}` (например: `ozon-analyzer_response_language`)
- **Хранилище:** `chrome.storage.local`
- **Тип данных:** string, boolean, или number в зависимости от типа настройки

### Передача данных
- **Формат:** JavaScript объект → Pyodide proxy object → Python dict
- **Кодировка:** UTF-8, автоматическая конвертация типов
- **Валидация:** Каждый шаг включает проверки типов и значений

### Синхронизация
- **Обновление:** Изменения в UI немедленно сохраняются в chrome.storage
- **Чтение:** Настройки загружаются при каждом запуске workflow
- **Кеширование:** Нет дополнительного кеширования, данные всегда свежие

## Диагностика и отладка

### Логирование ключевых моментов

1. **Сохранение настройки:**
   ```
   [background] Updated plugin setting for ozon-analyzer: response_language = "en"
   ```

2. **Передача в offscreen:**
   ```
   [PYODIDE] 🔧 Plugin settings to set: {"response_language": "en", ...}
   [PYODIDE] ✅ pluginSettings set in Pyodide globals FIRST
   ```

3. **Чтение в Python:**
   ```
   [LANGUAGE_VALIDATION] Извлечено response_language: 'en'
   [LANGUAGE] Язык контента определен: 'en'
   ```

### Возможные проблемы

1. **Задержка синхронизации:** Изменения в UI могут не сразу отразиться в выполняющихся workflow
2. **Типизация:** JavaScript объекты могут терять типы при конвертации в Python
3. **Кодировка:** Некорректная обработка не-ASCII символов

### Отладочные функции

```python
# В Python можно проверить доступные переменные
def _diagnose_variable_access(variable_name: str) -> Dict[str, Any]:
    """Расширенная диагностика доступа к переменным."""
    # Проверяет наличие переменной в globals, pyodide.globals и т.д.
```

## Заключение

Механизм передачи настроек представляет собой многоуровневую систему с преобразованиями данных между JavaScript и Python. Ключевыми компонентами являются:

1. **Определение настроек** в manifest.json
2. **UI компоненты** для редактирования значений
3. **Хранилище chrome.storage** для персистентности
4. **Background script** для координации
5. **Offscreen document** как мост к Pyodide
6. **Python скрипт** с функциями чтения настроек

Каждый шаг включает валидацию и обработку ошибок, обеспечивая надежность передачи данных от пользовательского интерфейса до исполняемого кода плагина.