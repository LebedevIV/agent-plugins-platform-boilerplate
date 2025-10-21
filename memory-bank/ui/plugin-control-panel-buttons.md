# Plugin Control Panel Buttons - Кнопки управления плагином

## Обзор

Система кнопок управления плагином в `PluginControlPanel` предоставляет интерфейс для запуска, приостановки, остановки и закрытия плагинов. Каждая кнопка вызывает свою цепочку действий, которая затрагивает различные компоненты расширения - от UI до background скрипта и MCP сервера.

## Архитектура и поток данных

### Диаграмма последовательности действий кнопок

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant PCP as PluginControlPanel
    participant SP as SidePanel
    participant BG as Background Script
    participant Off as Offscreen Document
    participant MCP as MCP Server

    %% Кнопка ▶️ ЗАПУСК (СТАРТ)
    User->>PCP: Нажатие кнопки ▶️ (старт)
    PCP->>PCP: handleStart() → onStart()
    PCP->>SP: Вызов handleStartPlugin()
    SP->>SP: setRunningPlugin(plugin.id)
    SP->>BG: Отправка RUN_WORKFLOW
    BG->>BG: handleRunWorkflow() - извлечение HTML страницы
    BG->>Off: Передача HTML (direct/chunks)
    Off->>Off: Сборка HTML и отправка HTML_ASSEMBLED
    Off->>MCP: EXECUTE_WORKFLOW с полным HTML
    MCP->>MCP: Анализ страницы
    MCP->>Off: WORKFLOW_COMPLETED с результатами
    Off->>SP: Обновление UI через сообщения
    SP->>PCP: Обновление состояния плагина

    %% Кнопка ⏸️ ПАУЗА
    User->>PCP: Нажатие кнопки ⏸️ (пауза)
    PCP->>PCP: onPause() → handlePausePlugin()
    SP->>SP: Переключение pausedPlugin состояния (локально)
    Note over SP: ⚠️ НЕ ОТПРАВЛЯЕТСЯ сообщение в background!<br/>Только изменение UI состояния

    %% Кнопка ⏹️ ОСТАНОВКА (СТОП)
    User->>PCP: Нажатие кнопки ⏹️ (стоп)
    PCP->>PCP: onStop() → handleStopPlugin()
    SP->>BG: Отправка STOP_WORKFLOW
    BG->>BG: handleStopWorkflow() - остановка процессов
    BG->>Off: Остановка workflow в offscreen
    BG->>SP: Подтверждение остановки
    SP->>SP: setRunningPlugin(null), setPausedPlugin(null)

    %% Кнопка ✕ ЗАКРЫТИЕ
    User->>PCP: Нажатие кнопки ✕ (закрыть)
    PCP->>PCP: onClose() → handleClosePanel()
    SP->>SP: setShowControlPanel(false)
    SP->>SP: setSelectedPlugin(null)
    SP->>SP: Очистка состояния плагина в localStorage
```

## Расположение кнопок и их обработчиков

### Основные файлы

**PluginControlPanel.tsx** - `pages/side-panel/src/components/PluginControlPanel.tsx`
```typescript
// Определение кнопок в JSX
<div className="control-buttons">
  <button onClick={handleStart} disabled={isRunning || isPaused} title="Запустить">
    {isRunning ? '⏹️' : '▶️'}
  </button>
  <button onClick={onPause} disabled={!isRunning || isPaused} title="Пауза">
    ⏸️
  </button>
  <button onClick={onStop} disabled={!isRunning} title="Остановить">
    ⏹️
  </button>
  <button onClick={onClose} title="Закрыть">
    ✕
  </button>
</div>

// Обработчик handleStart
const handleStart = () => {
  // Удалить все вызовы setStopped(...)
  onStart();
};
```

**SidePanel.tsx** - `pages/side-panel/src/SidePanel.tsx`
```typescript
// Props передаваемые в PluginControlPanel
<PluginControlPanel
  onStart={handleStartPlugin}
  onPause={handlePausePlugin}
  onStop={handleStopPlugin}
  onClose={handleClosePanel}
/>
```

## Детальная цепь действий для каждой кнопки

### 1. Кнопка ▶️ ЗАПУСК (СТАРТ)

**Полная цепочка действий:**

1. **UI уровень** (`PluginControlPanel.tsx`):
   - Пользователь нажимает кнопку ▶️
   - Вызывается `handleStart()` → `onStart()` (prop функция)

2. **SidePanel уровень** (`SidePanel.tsx`):
   - Вызывается `handleStartPlugin()`
   - Устанавливается состояние: `setRunningPlugin(selectedPlugin.id)`
   - Сбрасывается пауза: `setPausedPlugin(null)`
   - Отправляется сообщение в background: `RUN_WORKFLOW`

3. **Background уровень** (`background.ts`):
   - Получается активная вкладка через `chrome.tabs.query()`
   - Извлекается HTML страницы через `chrome.scripting.executeScript()`
   - Читаются глобальные настройки передачи HTML
   - Выбирается метод передачи: direct или chunks
   - Создается transfer и отправляется в offscreen

4. **Offscreen уровень** (`offscreen.js`):
   - Получает HTML через `EXECUTE_WORKFLOW` или собирает из чанков
   - Передает данные в MCP сервер через Pyodide

5. **MCP сервер уровень** (`mcp_server.py`):
   - Выполняет анализ страницы через `analyze_ozon_product()`
   - Возвращает результаты через `WORKFLOW_COMPLETED`

6. **Обратная связь**:
   - Результаты отображаются в чате через сообщения
   - UI обновляется через runtime сообщения

### 2. Кнопка ⏸️ ПАУЗА

**Текущая реализация (НЕПОЛНАЯ):**

1. **UI уровень** (`PluginControlPanel.tsx`):
   - Пользователь нажимает кнопку ⏸️
   - Вызывается `onPause()` (prop функция напрямую)

2. **SidePanel уровень** (`SidePanel.tsx`):
   - Вызывается `handlePausePlugin()`
   - **ЛОКАЛЬНОЕ ИЗМЕНЕНИЕ ТОЛЬКО UI:**
     ```typescript
     if (pausedPlugin === selectedPlugin.id) {
       // Возобновляем
       setPausedPlugin(null);
       addToastWithDeps(`Плагин ${selectedPlugin.name} возобновлен`, 'success');
     } else {
       // Приостанавливаем
       setPausedPlugin(selectedPlugin.id);
       addToastWithDeps(`Плагин ${selectedPlugin.name} приостановлен`, 'warning');
     }
     ```

3. **ПРОБЛЕМА: НЕ ОТПРАВЛЯЕТСЯ СООБЩЕНИЕ В BACKGROUND!**
   - Background скрипт не получает информацию о паузе
   - Workflow продолжает выполняться в offscreen/MCP
   - Только визуальное состояние UI изменяется

### 3. Кнопка ⏹️ ОСТАНОВКА (СТОП)

**Полная цепочка действий:**

1. **UI уровень** (`PluginControlPanel.tsx`):
   - Пользователь нажимает кнопку ⏹️
   - Вызывается `onStop()` (prop функция напрямую)

2. **SidePanel уровень** (`SidePanel.tsx`):
   - Вызывается `handleStopPlugin()`
   - Отправляется сообщение `STOP_WORKFLOW` в background

3. **Background уровень** (`background.ts`):
   - Получает `STOP_WORKFLOW` сообщение
   - Вызывается `handleStopWorkflow()` (требует реализации)
   - Должен остановить активные процессы в offscreen

4. **Offscreen уровень**:
   - Получает сигнал остановки
   - Прерывает выполнение workflow
   - Очищает ресурсы

5. **UI обновление**:
   - SidePanel сбрасывает состояния: `setRunningPlugin(null)`, `setPausedPlugin(null)`
   - Показывается уведомление об успешной остановке

### 4. Кнопка ✕ ЗАКРЫТИЕ

**Цепочка действий:**

1. **UI уровень** (`PluginControlPanel.tsx`):
   - Пользователь нажимает кнопку ✕
   - Вызывается `onClose()` (prop функция напрямую)

2. **SidePanel уровень** (`SidePanel.tsx`):
   - Вызывается `handleClosePanel()`
   - Закрывается панель: `setShowControlPanel(false)`
   - Сбрасывается выбранный плагин: `setSelectedPlugin(null)`
   - Очищается сохраненное состояние в localStorage по pageKey

3. **Сохранение состояния**:
   - Для текущей страницы очищается состояние в `chrome.storage.local`
   - При следующем открытии страницы панель будет закрыта

## Состояние кнопок и условия активации

```typescript
// PluginControlPanel.tsx - логика состояний кнопок

// ▶️ ЗАПУСК: disabled когда уже запущен или на паузе
<button disabled={isRunning || isPaused} title="Запустить">
  ▶️
</button>

// ⏸️ ПАУЗА: disabled когда не запущен или уже на паузе
<button disabled={!isRunning || isPaused} title="Пауза">
  ⏸️
</button>

// ⏹️ СТОП: disabled когда не запущен
<button disabled={!isRunning} title="Остановить">
  ⏹️
</button>

// ✕ ЗАКРЫТЬ: всегда активна
<button title="Закрыть">
  ✕
</button>
```

## Текущее состояние и известные проблемы

### Реализованная функциональность

- ✅ **Запуск плагина**: Полная цепочка от UI до MCP сервера
- ✅ **Остановка плагина**: Полная цепочка с отправкой STOP_WORKFLOW
- ✅ **Закрытие панели**: Полная очистка состояния и сохранение
- ❌ **Пауза/возобновление**: Только UI состояние, нет коммуникации с background

### Критические проблемы

#### 1. Неполная реализация кнопки ПАУЗА

**Симптомы:**
- При нажатии ⏸️ изменяется только локальное состояние UI
- Background скрипт продолжает выполнение workflow
- MCP сервер не получает сигнал о приостановке
- Пользователь видит "приостановлено", но процесс фактически продолжается

**Технические детали:**
- В `handlePausePlugin()` нет отправки сообщений в background
- Отсутствует тип сообщения `PAUSE_WORKFLOW` в системе коммуникации
- Offscreen document не имеет механизма приостановки workflow

**Последствия:**
- Вводит пользователя в заблуждение о состоянии плагина
- Ресурсы продолжают расходоваться в фоне
- Возможны конфликты при повторном запуске

#### 2. Отсутствие реализации STOP_WORKFLOW

**Текущее состояние:**
- Сообщение `STOP_WORKFLOW` отправляется из SidePanel
- В background.ts отсутствует обработчик `handleStopWorkflow()`
- Нет механизма прерывания выполнения в offscreen/MCP

**Необходимые доработки:**
```typescript
// Требуется добавить в background.ts
private async handleStopWorkflow(message: { pluginId: string }): Promise<void> {
  // 1. Найти активный workflow для pluginId
  // 2. Отправить сигнал остановки в offscreen
  // 3. Очистить ресурсы и transfer
  // 4. Подтвердить остановку в UI
}
```

### Рекомендации по исправлению

#### Для кнопки ПАУЗА:
1. **Добавить тип сообщения:** `PAUSE_WORKFLOW` / `RESUME_WORKFLOW`
2. **Реализовать в background:** Обработчик с передачей сигнала в offscreen
3. **Доработать offscreen:** Механизм приостановки/возобновления Pyodide процессов
4. **Добавить в MCP:** Сигналы паузы для длительных операций анализа

#### Для кнопки СТОП:
1. **Реализовать `handleStopWorkflow()` в background.ts**
2. **Добавить прерывание в offscreen:** `AbortController` или флаги отмены
3. **Обеспечить очистку ресурсов:** Прерывание передачи чанков, очистка памяти

#### Для кнопки ЗАКРЫТЬ:
- Функциональность реализована корректно
- Возможно добавить подтверждение закрытия при активном workflow

## Недавние изменения и исправления

### Анализ состояния кнопок (2025-10-02)

**Обнаруженные проблемы:**
1. **Кнопка паузы полностью не реализована** - только UI состояние без передачи в background
2. **Обработчик остановки отсутствует** в background скрипте
3. **Нет механизма прерывания workflow** в offscreen/MCP цепочке

**Рекомендации:**
- Приоритизировать реализацию полноценной паузы и остановки
- Добавить обработчики в background для STOP_WORKFLOW
- Реализовать механизм прерывания в offscreen document
- Рассмотреть возможность graceful shutdown для MCP процессов

---

**Создано:** 2025-10-02
**Обновлено:** 2025-10-02
**Ответственный:** Frontend Team, Background Team
**Статус:** Требует доработки паузы и остановки