# Исправление контекста чатов - привязка к активной вкладке

## Проблема

**Описание:** При переключении между вкладками с разными сайтами чат плагина продолжал отображаться с содержимым предыдущей страницы.

**Пример воспроизведения:**
1. Открыть https://www.ozon.ru/product/... 
2. Открыть чат плагина Ozon в сайдпанели
3. Переключиться на https://www.perplexity.ai/search/...
4. **Проблема:** Чат Ozon продолжал отображаться вместо списка плагинов для Perplexity

## Причина

Функция `getPageKey()` в `PluginControlPanel.tsx` использовала `window.location.href`, который в контексте side panel всегда возвращает URL самой side panel, а не активной вкладки.

```typescript
// НЕПРАВИЛЬНО - использовало URL side panel
const getPageKey = (): string => {
  try {
    const url = new URL(window.location.href); // ❌ window.location.href
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return window.location.origin;
  }
};
```

## Решение

### 1. Передача URL активной вкладки

Добавлен пропс `currentTabUrl` в `PluginControlPanel`:

```typescript
interface PluginControlPanelProps {
  // ... другие пропсы
  currentTabUrl: string | null; // ✅ URL активной вкладки
}
```

### 2. Обновление функции getPageKey

```typescript
// ПРАВИЛЬНО - использует URL активной вкладки
const getPageKey = (currentTabUrl: string | null): string => {
  if (!currentTabUrl) {
    return 'unknown-page';
  }
  
  try {
    const url = new URL(currentTabUrl); // ✅ currentTabUrl
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return currentTabUrl;
  }
};
```

### 3. Сброс состояния при смене страницы

Добавлен эффект в `useLazyChatSync` для сброса состояния черновика:

```typescript
// Сброс состояния при изменении pageKey (смена страницы)
useEffect(() => {
  setMessageState('');
  setIsDraftSaved(false);
  setIsDraftLoading(false);
  setDraftError(null);
  lastSavedText.current = '';
  
  // Очищаем таймер при смене страницы
  if (debounceRef.current) {
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }
}, [pageKey]);
```

## Результат

✅ **Исправлено:** Теперь чаты корректно привязаны к конкретным страницам
✅ **Контекст:** При переключении вкладок отображается правильный контекст
✅ **Черновики:** Автоматически сбрасываются при смене страницы
✅ **Производительность:** Оптимизирована загрузка данных

## Тестирование

**Сценарий тестирования:**
1. Открыть Ozon → открыть чат плагина → написать сообщение
2. Переключиться на Perplexity → должен отображаться список плагинов
3. Вернуться на Ozon → должен отображаться чат с сохраненными сообщениями
4. Переключиться на другой сайт → черновик должен очиститься

## Файлы изменений

- `pages/side-panel/src/SidePanel.tsx` - передача currentTabUrl
- `pages/side-panel/src/components/PluginControlPanel.tsx` - использование currentTabUrl
- `pages/side-panel/src/hooks/useLazyChatSync.ts` - сброс состояния при смене страницы

## Коммиты

- `fix(chat): исправление контекста чатов - привязка к активной вкладке`
- `docs: обновление прогресса - исправление контекста чатов` 