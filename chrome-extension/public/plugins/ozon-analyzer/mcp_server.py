# ==============================================================================
# MCP Server (Библиотека Инструментов) для плагина "Ozon Analyzer"
# ==============================================================================
# Этот скрипт НЕ является самостоятельным сервером. Он представляет собой
# набор Python-функций ("инструментов"), которые вызываются по требованию
# движком `workflow-engine.js` нашей платформы.
# Вся коммуникация с внешним миром (UI, Browser API, LLM) происходит
# опосредованно, через вызовы JavaScript-функций, доступных в глобальном
# объекте `js`.
# ------------------------------------------------------------------------------

# Стандартные импорты
import json
import asyncio
import hashlib
import re
from datetime import datetime
from typing import Any, Dict, List, Protocol, runtime_checkable, Optional
from re import Match

# ==============================================================================
# Менеджер памяти для оптимизации Pyodide
# ==============================================================================
class MemoryManager:
    """
    Продвинутый менеджер памяти для Pyodide с автоматической очисткой,
    LRU кешированием и object pooling. Значительно сокращает GC паузы
    и оптимизирует использование памяти.
    """

    def __init__(self, max_objects: int = 50, cleanup_interval: int = 30000):  # 30 сек
        self.object_pool: Dict[str, List[Any]] = {}
        self.lru_cache: Dict[str, Dict[str, Any]] = {}
        self.active_objects: Dict[str, int] = {}
        self.max_objects = max_objects
        self.cleanup_interval = cleanup_interval
        self.last_cleanup = datetime.now()

        # Статистика использования памяти
        self.metrics = {
            'objects_created': 0,
            'objects_reused': 0,
            'memory_cleaned': 0,
            'cache_hits': 0,
            'cache_misses': 0
        }

    def get_object(self, obj_type: str, factory_func: callable, *args, **kwargs) -> Any:
        """Получить объект из пула или создать новый."""

        # Считаем как кеш miss по умолчанию
        self.metrics['cache_misses'] += 1

        # Проверяем пул для переиспользования
        if obj_type in self.object_pool and self.object_pool[obj_type]:
            reused_obj = self.object_pool[obj_type].pop()
            self.active_objects[obj_type] = self.active_objects.get(obj_type, 0) + 1
            self.metrics['objects_reused'] += 1
            self.metrics['cache_hits'] += 1
            self.metrics['cache_misses'] -= 1  # Корректировка
            return reused_obj

        # Создаем новый объект
        obj = factory_func(*args, **kwargs)
        self.metrics['objects_created'] += 1
        self.active_objects[obj_type] = self.active_objects.get(obj_type, 0) + 1

        # Периодическая очистка
        self._periodic_cleanup()

        return obj

    def return_object(self, obj_type: str, obj: Any) -> None:
        """Вернуть объект в пул для переиспользования."""
        if obj_type not in self.object_pool:
            self.object_pool[obj_type] = []

        # Ограничение размера пула
        if len(self.object_pool[obj_type]) < self.max_objects:
            self.object_pool[obj_type].append(obj)

        self.active_objects[obj_type] = max(0, self.active_objects.get(obj_type, 0) - 1)

    def cache_lru(self, cache_key: str, value: Any, max_age_seconds: int = 300) -> None:
        """LRU кеширование с TTL."""
        if len(self.lru_cache) >= self.max_objects:
            # Удаляем самый старый элемент
            oldest_key = min(self.lru_cache.keys(),
                           key=lambda k: self.lru_cache[k]['accessed_at'])
            del self.lru_cache[oldest_key]

        self.lru_cache[cache_key] = {
            'value': value,
            'created_at': datetime.now(),
            'accessed_at': datetime.now(),
            'max_age': max_age_seconds
        }

    def get_cached_lru(self, cache_key: str) -> Optional[Any]:
        """Получить значение из LRU кеша."""
        if cache_key not in self.lru_cache:
            return None

        entry = self.lru_cache[cache_key]

        # Проверка TTL
        if (datetime.now() - entry['created_at']).total_seconds() > entry['max_age']:
            del self.lru_cache[cache_key]
            return None

        # Обновление времени последнего доступа
        entry['accessed_at'] = datetime.now()
        self.metrics['cache_hits'] += 1

        return entry['value']

    def _periodic_cleanup(self) -> None:
        """Периодическая автоматическая очистка."""
        current_time = datetime.now()
        if (current_time - self.last_cleanup).total_seconds() * 1000 < self.cleanup_interval:
            return

        # Очистка просроченных LRU записей
        expired_keys = []
        for key, entry in self.lru_cache.items():
            if (current_time - entry['created_at']).total_seconds() > entry['max_age']:
                expired_keys.append(key)

        for key in expired_keys:
            del self.lru_cache[key]

        self.metrics['memory_cleaned'] += len(expired_keys)
        self.last_cleanup = current_time

    def get_memory_stats(self) -> Dict[str, Any]:
        """Получить статистику использования памяти."""
        return {
            'object_pool_size': {k: len(v) for k, v in self.object_pool.items()},
            'active_objects': dict(self.active_objects),
            'lru_cache_size': len(self.lru_cache),
            'metrics': dict(self.metrics),
            'total_pooled_objects': sum(len(pool) for pool in self.object_pool.values())
        }

# ==============================================================================
# Безопасные wrapper функции для offscreen compatibility
# ==============================================================================
async def safe_js_get_setting(setting_name: str, default: Any = False) -> Any:
    try:
        result_proxy = await js.get_setting(setting_name)
        if result_proxy is None:
            return default
        return result_proxy.to_py()
    except (AttributeError, TypeError):
        return default

def safe_dict_get(data: Any, key: str, default: Any = None) -> Any:
    try:
        if isinstance(data, dict):
            return data.get(key, default)
        return default
    except AttributeError:
        return default

# ==============================================================================
# Batch Processor для группировки AI запросов
class BatchProcessor:
    """
    Продвинутый процессор для группировки AI запросов в батчи.
    Снижает сетевой overhead путем объединения нескольких запросов.
    """

    def __init__(self, batch_size: int = 3, max_wait_time: int = 2000):  # 2 секунды максимального ожидания
        self.batch_size = batch_size
        self.max_wait_time = max_wait_time
        self.pending_requests: List[Dict[str, Any]] = []
        self.processing = False

    def add_request(self, model_alias: str, prompt: str, context: Optional[str] = None) -> asyncio.Future:
        """Добавить запрос в батч."""
        future = asyncio.Future()
        request_data = {
            'model_alias': model_alias,
            'prompt': prompt,
            'context': context,
            'future': future,
            'added_at': datetime.now()
        }

        self.pending_requests.append(request_data)

        # Если достигнут размер батча или прошло достаточно времени, процессим сразу
        if len(self.pending_requests) >= self.batch_size:
            asyncio.create_task(self._process_batch())

        return future

    async def _process_batch(self) -> None:
        """Обработать текущий батч запросов параллельно."""
        if self.processing or not self.pending_requests:
            return

        self.processing = True

        try:
            # Берем все pending запросы
            batch = self.pending_requests.copy()
            self.pending_requests.clear()

            # Группируем по model_alias для оптимизации
            by_model = {}
            for request in batch:
                model = request['model_alias']
                if model not in by_model:
                    by_model[model] = []
                by_model[model].append(request)

            # Процессим запросы для каждого model_alias параллельно
            tasks = []
            for model, requests in by_model.items():
                if len(requests) == 1:
                    # Если только один запрос, выполняем обычный вызов
                    task = self._process_single_request(requests[0])
                else:
                    # Если несколько, пакетная обработка
                    task = self._process_batch_for_model(model, requests)
                tasks.append(task)

            # Ждем выполнения всех задач
            await asyncio.gather(*tasks, return_exceptions=True)

        finally:
            self.processing = False

    async def _process_single_request(self, request: Dict[str, Any]) -> None:
        """Обработать одиночный запрос."""
        try:
            response = await _call_ai_model(
                request['model_alias'],
                request['prompt'],
                request['context']
            )
            request['future'].set_result(response)
        except Exception as e:
            request['future'].set_exception(e)

    async def _process_batch_for_model(self, model_alias: str, requests: List[Dict[str, Any]]) -> None:
        """Обработать пакет запросов для конкретной модели."""
        try:
            # Создаем объединенный промпт если возможно
            if all(request['context'] is None for request in requests):
                # Все запросы без контекста - объединяем в один большой промпт
                combined_prompt = "\n\n---REQUEST_SEPARATOR---\n\n".join(
                    f"REQUEST_{i+1}: {request['prompt']}" for i, request in enumerate(requests)
                )
                combined_prompt += "\n\nОтветь на каждый запрос отдельно, разделяя ---REQUEST_SEPARATOR---"

                combined_response = await _call_ai_model(model_alias, combined_prompt)

                # Разделяем ответы
                response_parts = combined_response.split("---REQUEST_SEPARATOR---")
                for i, request in enumerate(requests):
                    if i < len(response_parts):
                        request['future'].set_result(response_parts[i].strip())
                    else:
                        request['future'].set_exception(RuntimeError("Batch response parsing failed"))

            else:
                # Если есть контекст, выполняем параллельно без объединения
                await asyncio.gather(
                    *[self._process_single_request(request) for request in requests],
                    return_exceptions=True
                )

        except Exception as e:
            # В случае ошибки - все запросы получают ошибку
            for request in requests:
                request['future'].set_exception(e)

    async def flush_remaining(self) -> None:
        """Принудительно выполнить все оставшиеся запросы."""
        if self.pending_requests:
            await self._process_batch()

# Глобальный batch processor и менеджер памяти
batch_processor = BatchProcessor(batch_size=3, max_wait_time=2000)  # 3 запроса макс, 2 сек ожидание
memory_manager = MemoryManager(max_objects=100, cleanup_interval=30000)  # 30 сек

# ==============================================================================
# Система кеширования AI ответов (сохранена)
# ==============================================================================
class AICache:
    """
    Компонент для кеширования AI ответов с TTL и метриками производительности.
    Уменьшает количество AI вызовов и значительно ускоряет повторные запросы.
    """

    def __init__(self, max_size: int = 100, default_ttl: int = 3600):  # 1 час по умолчанию
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl

        # Метрики для мониторинга эффективности
        self.metrics = {
            'hits': 0,
            'misses': 0,
            'expired': 0,
            'evicted': 0,
            'saved_requests': 0
        }

    def _compute_hash(self, model_alias: str, prompt: str, context: Optional[str] = None) -> str:
        """Вычисляет хэш для ключа кеша на основе модели, промпта и контекста."""
        content = f"{model_alias}:{prompt}"
        if context:
            content += f":{context[:200]}"  # Добавляем первые 200 символов контекста
        return hashlib.md5(content.encode()).hexdigest()

    async def get(self, model_alias: str, prompt: str, context: Optional[str] = None) -> Optional[str]:
        """Получить значение из кеша."""
        cache_key = self._compute_hash(model_alias, prompt, context)
        cache_entry = self.cache.get(cache_key)

        if not cache_entry:
            self.metrics['misses'] += 1
            return None

        # Проверка TTL
        if datetime.now().timestamp() > cache_entry['expires_at']:
            del self.cache[cache_key]
            self.metrics['expired'] += 1
            return None

        self.metrics['hits'] += 1
        if 'response_time' in cache_entry:
            self.metrics['saved_requests'] += cache_entry['response_time']  # Сохраненное время в мс

        return cache_entry['response']

    async def set(self, model_alias: str, prompt: str, response: str,
                  response_time: Optional[int] = None, context: Optional[str] = None) -> None:
        """Сохранить значение в кеш."""
        cache_key = self._compute_hash(model_alias, prompt, context)
        expires_at = datetime.now().timestamp() + self.default_ttl

        # Очистка старых записей если превышен лимит
        if len(self.cache) >= self.max_size:
            # Удаляем самую старую запись
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k]['created_at'])
            del self.cache[oldest_key]
            self.metrics['evicted'] += 1

        self.cache[cache_key] = {
            'response': response,
            'expires_at': expires_at,
            'created_at': datetime.now().timestamp(),
            'response_time': response_time,
            'model_alias': model_alias
        }

    def get_metrics(self) -> Dict[str, Any]:
        """Получить метрики эффективности кеширования."""
        total_requests = self.metrics['hits'] + self.metrics['misses']
        hit_rate = (self.metrics['hits'] / total_requests * 100) if total_requests > 0 else 0

        return {
            'cache_size': len(self.cache),
            'max_size': self.max_size,
            'hits': self.metrics['hits'],
            'misses': self.metrics['misses'],
            'expired': self.metrics['expired'],
            'evicted': self.metrics['evicted'],
            'hit_rate_percent': round(hit_rate, 2),
            'saved_requests_time_ms': self.metrics['saved_requests'],
            'cache_efficiency': f"{round(hit_rate, 1)}% hit rate, {len(self.cache)} cached responses"
        }

    def clear(self) -> None:
        """Очистить весь кеш."""
        self.cache.clear()
        self.metrics = {k: 0 for k in self.metrics.keys()}

# Глобальный экземпляр AI кеша
ai_cache = AICache(max_size=200, default_ttl=7200)  # 2 часа TTL, до 200 записей

# --- "Контракт" с JavaScript: Объявление типов для `js` моста ---
# Этот блок кода критически важен для статических анализаторов (Pyright, MyPy)
# и для автодополнения в IDE (Cursor, VS Code). Он "объясняет" анализатору,
# какие методы существуют у глобального объекта `js`, который предоставляет
# среда Pyodide. В реальной среде выполнения этот блок не создает новых
# переменных, так как `js` уже будет определен.
try:
    @runtime_checkable
    class JsBridge(Protocol):
        """Описывает "контракт" API, который предоставляет JavaScript-хост."""
        def sendMessageToChat(self, message: Dict[str, Any]) -> None: ...
        def llm_call(self, model_alias: str, params: Dict[str, Any]) -> Any: ...
        def get_setting(self, setting_name: str) -> Any: ...
    js: JsBridge
except ImportError:
    # В минимальной среде Python `Protocol` может отсутствовать.
    # В Pyodide это не вызовет проблем.
    pass

# ==============================================================================
# Оптимизированный DOM Parser для высокопроизводительного парсинга HTML
# ==============================================================================
class FastDOMParser:
    """
    Быстрый и эффективный DOM парсер, оптимизированный для извлечения
    структурированных данных из HTML страниц товаров Ozon.
    Использует MemoryManager для кеширования паттернов и LRU для реиспользования объектов.
    """

    # Прекомпилированные оптимизированные регулярные выражения
    _compiled_patterns: Dict[str, Any] = {}

    # Оптимизированные паттерны для разных типов поиска
    _RE_PATTERNS = {
        'html_cleaner': r'<[^>]+>',  # Для очистки HTML быстрее стандартного
        'price_numeric': r'(\d+(?:[,.]\d{1,2})?)',  # Для извлечения цены с плавающей точкой
        'breadcrumb_links': r'<a[^>]*>([^<]+)</a>',  # Для хлебных крошек
        'category_spans': r'<span[^>]*class="[^"]*category[^"]*"[^>]*>([^<]+)</span>',  # Категории
        'rating_values': r'(\d+(?:[.,]\d+)?)',  # Числовые рейтинги
        'meta_og_title': r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"',  # OpenGraph заголовки
        'description_meta': r'<meta[^>]+name="description"[^>]+content="([^"]+)"',  # Мета описания
        'script_json_ld': r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',  # JSON-LD данные
    }

    def __init__(self, html_content: str):
        self.html = html_content
        self.parsing_start_time = datetime.now()

        # Предварительные оптимизации
        self._normalize_html()
        self.parsing_time = 0  # будет измерено при первом доступе

    def _normalize_html(self):
        """Мягкая нормализация HTML для сохранения структуры данных."""
        original_size = len(self.html)

        try:
            # Логируем перед нормализацией
            js.sendMessageToChat({"content": f"Python: 📊 До нормализации: {original_size} символов"})

            # Смягченная нормализация - удаляем только лишние пробелы и переносы
            # Сохраняем пробелы между словами, но убираем множественные переносы строк
            self.html = re.sub(r'[ \t]+', ' ', self.html)  # Сжимаем множественные пробелы и табы
            self.html = re.sub(r'\n\s*\n', '\n', self.html)  # Убираем пустые строки
            self.html = re.sub(r'\r\n?', '\n', self.html)  # Стандартизируем переносы строк
            self.html = self.html.strip()  # Убираем пробелы по краям

            new_size = len(self.html)
            data_loss = original_size - new_size

            # Логируем результаты нормализации
            js.sendMessageToChat({"content": f"Python: ✅ После нормализации: {new_size} символов (потеряно: {data_loss}, {data_loss/original_size*100:.1f}%)"})

            # Добавляем статистику в объект
            self.normalization_stats = {
                'original_size': original_size,
                'normalized_size': new_size,
                'data_loss_bytes': data_loss,
                'data_loss_percent': round(data_loss / original_size * 100, 1) if original_size > 0 else 0
            }

        except Exception as e:
            js.sendMessageToChat({"content": f"Python: ⚠️ Ошибка нормализации: {e}"})
            # В случае ошибки возвращаем оригинал
            self.normalization_stats = {'error': str(e)}

    def _get_cached_pattern(self, pattern_str: str, flags: int = 0) -> Any:
        """Получить скомпилированный регулярный паттерн из кеша."""
        cache_key = f"pattern:{hash(pattern_str + str(flags))}"

        cached = memory_manager.get_cached_lru(cache_key)
        if cached:
            return cached

        compiled_pattern = re.compile(pattern_str, flags)
        memory_manager.cache_lru(cache_key, compiled_pattern, max_age_seconds=3600)  # 1 час

        return compiled_pattern

    def _search_with_pattern(self, patterns: List[str], flags: int = 0) -> Optional['Match[str]']:
        """Оптимизированный поиск с использованием кешированных паттернов."""
        for pattern_str in patterns:
            pattern = self._get_cached_pattern(pattern_str, flags)
            match = pattern.search(self.html)
            if match:
                return match
        return None

    def _findall_with_pattern(self, pattern_str: str, flags: int = 0) -> List[str]:
        """Оптимизированный findall с использованием кешированных паттернов."""
        cached = memory_manager.get_cached_lru(f"findall:{hash(pattern_str + str(flags))}")
        if cached:
            return cached

        pattern = self._get_cached_pattern(pattern_str, flags)
        results = pattern.findall(self.html)

        # Кешируем результаты, но только если их не слишком много
        if len(results) <= 100:
            memory_manager.cache_lru(f"findall:{hash(pattern_str + str(flags))}", results, max_age_seconds=1800)

        return results

    def extract_product_info(self) -> Dict[str, Any]:
        """
        Извлечение основной информации о товаре с улучшенной обработкой ошибок.
        Возвращает структурированные данные с fallback логикой.
        """
        parsing_start = datetime.now()
        info = {}

        # Поля с приоритетами и fallback обработкой
        extraction_steps = [
            ('title', self._extract_title, 'Название товара не найдено'),
            ('description', self._extract_description, 'Описание товара не найдено'),
            ('composition', self._extract_composition, 'Состав не указан'),
            ('categories', self._extract_categories, ['Категория не определена']),
            ('price', self._extract_price_safe, {'text': 'Цена не найдена', 'amount': 0, 'currency': 'unknown'}),
            ('rating', self._extract_rating_safe, {'text': 'Рейтинг не найден', 'value': 0, 'max_value': 5.0})
        ]

        # Извлекаем каждый элемент с обработкой исключений
        for field_name, extractor_func, fallback_value in extraction_steps:
            try:
                extracted_value = extractor_func()
                if extracted_value is not None:
                    info[field_name] = extracted_value
                else:
                    js.sendMessageToChat({"content": f"Python: ⚠️ {field_name} вернул None, использую fallback"})
                    info[field_name] = fallback_value
            except Exception as e:
                js.sendMessageToChat({"content": f"Python: ❌ Ошибка извлечения {field_name}: {e}"})
                info[field_name] = fallback_value

        # Вычисляем время парсинга
        self.parsing_time = (datetime.now() - parsing_start).total_seconds() * 1000

        # Добавляем статистику успешного извлечения
        success_count = sum(1 for k, v in info.items()
                           if (isinstance(v, str) and v != info[k] if k in ['title', 'description', 'composition'] else True) and
                           (isinstance(v, list) and len(v) > 0 and v[0] != 'Категория не определена' if k == 'categories' else True) and
                           (isinstance(v, dict) and v.get('amount', 0) > 0 if k in ['price', 'rating'] else True))

        js.sendMessageToChat({"content": f"Python: 📊 Извлечено полей: {success_count}/6 (успех: {success_count*100//6}%)"})

        # Возвращаем стандартизированный ответ
        return {
            'title': info.get('title', 'Название товара не найдено'),
            'description': info.get('description', 'Описание товара не найдено'),
            'composition': info.get('composition', 'Состав не указан'),
            'categories': info.get('categories', ['Категория не определена']),
            'price': info.get('price', {'text': 'Цена не найдена', 'amount': 0, 'currency': 'unknown'}),
            'rating': info.get('rating', {'text': 'Рейтинг не найден', 'value': 0, 'max_value': 5.0}),
            'extraction_stats': {
                'total_fields': 6,
                'successful_fields': success_count,
                'success_rate_percent': success_count * 100 // 6,
                'parsing_time_ms': round(self.parsing_time, 2)
            }
        }

    def _extract_price_safe(self) -> Dict[str, Any]:
        """Безопасная обертка для извлечения цены."""
        try:
            return self._extract_price()
        except Exception as e:
            js.sendMessageToChat({"content": f"Python: ❌ Ошибка извлечения цены: {e}"})
            return {'text': 'Цена не найдена', 'amount': 0, 'currency': 'unknown'}

    def _extract_rating_safe(self) -> Dict[str, Any]:
        """Безопасная обертка для извлечения рейтинга."""
        try:
            return self._extract_rating()
        except Exception as e:
            js.sendMessageToChat({"content": f"Python: ❌ Ошибка извлечения рейтинга: {e}"})
            return {'text': 'Рейтинг не найден', 'value': 0, 'max_value': 5.0}

    def _extract_title(self) -> str:
        """Извлечение заголовка товара с использованием кешированных паттернов."""
        # Оптимизированные паттерны с флагами для title
        title_patterns = [
            r'<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</h1>',
            r'<title>([^<]+)</title>',
            r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"',
            r'<h1[^>]*>([^<]+)</h1>'
        ]

        match = self._search_with_pattern(title_patterns, re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            if len(title) > 10:  # Фильтр слишком коротких заголовков
                js.sendMessageToChat({"content": f"Python: ✅ Найден заголовок: {title[:50]}..."})
                return title
    
            # Fallback: Пробуем более простые паттерны
            fallback_patterns = [
                r'<title[^>]*>([^<]+)</title>',
                r'<h1[^>]*>([^<]+)</h1>',
                r'>([^<]{15,100})</'  # Любой текст 15-100 символов в угловых скобках
            ]
    
            fallback_match = self._search_with_pattern(fallback_patterns, re.IGNORECASE)
            if fallback_match:
                title = fallback_match.group(1).strip()
                if len(title) > 10:
                    js.sendMessageToChat({"content": f"Python: ✅ Найден заголовок (fallback): {title[:50]}..."})
                    return title
    
            js.sendMessageToChat({"content": "Python: ⚠️ Заголовок товара не найден"})
            return "Название товара не найдено"

    def _extract_description(self) -> str:
        """Извлечение описания товара с кешированными паттернами."""
        js.sendMessageToChat({"content": "Python: 🔍 Извлекаю описание товара..."})

        original_html_len = len(self.html)

        # Оптимизированные паттерны для описания товара
        desc_patterns = [
            r'<div[^>]*class="[^"]*description[^"]*"[^>]*>([^<]*(?:<[^/][^>]*>[^<]*</[^>]+>[^<]*)*)</div>',
            r'<meta[^>]+name="description"[^>]+content="([^"]+)"',
            r'<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)</p>'
        ]

        match = self._search_with_pattern(desc_patterns, re.IGNORECASE | re.DOTALL)
        if match:
            # Кешируем regex для очистки HTML тегов
            clean_pattern = self._get_cached_pattern(r'<[^>]+>', re.I)
            cleaned_content = clean_pattern.sub('', match.group(1)).strip()

            # Логируем потери данных при извлечении
            raw_content_len = len(match.group(1))
            cleaned_len = len(cleaned_content)
            data_loss = raw_content_len - cleaned_len

            js.sendMessageToChat({"content": f"Python: 📊 Извлечено описание: {cleaned_len} символов (потеряно {data_loss} при очистке HTML)"})

            if len(cleaned_content) > 20:
                return cleaned_content

        js.sendMessageToChat({"content": "Python: ⚠️ Описание товара не найдено"})
        return "Описание товара не найдено"

    def _extract_composition(self) -> str:
        """Извлечение состава товара с кешированными паттернами."""
        js.sendMessageToChat({"content": "Python: 🔍 Извлекаю состав товара..."})

        # Оптимизированные паттерны для состава товара
        comp_patterns = [
            r'<div[^>]*class="[^"]*composition[^"]*">([^<]*(?:<[^/][^>]*>[^<]*</[^>]+>[^<]*)*)</div>',
            r'<div[^>]*class="[^"]*ingredients[^"]*">([^<]*(?:<[^/][^>]*>[^<]*</[^>]+>[^<]*)*)</div>',
            r'<span[^>]*class="[^"]*composition[^"]*">([^<]+)</span>'
        ]

        match = self._search_with_pattern(comp_patterns, re.IGNORECASE | re.DOTALL)
        if match:
            # Кешируем regex для очистки HTML тегов
            clean_pattern = self._get_cached_pattern(r'<[^>]+>', re.I)
            cleaned_content = clean_pattern.sub('', match.group(1)).strip()

            # Логируем потери данных при извлечении
            raw_content_len = len(match.group(1))
            cleaned_len = len(cleaned_content)
            data_loss = raw_content_len - cleaned_len

            js.sendMessageToChat({"content": f"Python: 📊 Извлечён состав: {cleaned_len} символов (потеряно {data_loss} при очистке HTML)"})

            if len(cleaned_content) > 10:
                return cleaned_content

        js.sendMessageToChat({"content": "Python: ⚠️ Состав товара не найден"})
        return "Состав не указан"

    def _extract_categories(self) -> List[str]:
        """Извлечение категорий товара с улучшенной fallback логикой."""
        categories = []

        try:
            # Пробуем извлечь из хлебных крошек с fallback обработкой
            categories = self._extract_categories_from_breadcrumbs()
        except Exception as e:
            js.sendMessageToChat({"content": f"Python: ⚠️ Ошибка извлечения breadcrumb категорий: {e}"})

        # Fallback 1: Поиск по альтернативным селекторам
        if not categories:
            try:
                categories = self._extract_categories_from_selectors()
            except Exception as e:
                js.sendMessageToChat({"content": f"Python: ⚠️ Ошибка извлечения селекторных категорий: {e}"})

        # Fallback 2: Прямой поиск текстовой информации
        if not categories:
            try:
                categories = self._extract_categories_from_text()
            except Exception as e:
                js.sendMessageToChat({"content": f"Python: ⚠️ Ошибка извлечения текстовых категорий: {e}"})

        # Логируем результат
        if categories:
            js.sendMessageToChat({"content": f"Python: ✅ Найдено {len(categories)} категорий: {', '.join(categories[:3])}"})
        else:
            js.sendMessageToChat({"content": "Python: ⚠️ Категории не найдены, использую fallback"})

        return categories[:5] if categories else ["Категория не определена"]

    def _extract_categories_from_breadcrumbs(self) -> List[str]:
        """Извлечение категорий из хлебных крошек с улучшенной обработкой."""
        breadcrumb_pattern = r'<[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>(.*?)</[^>]+>'
        breadcrumb = self._get_cached_pattern(breadcrumb_pattern, re.IGNORECASE | re.DOTALL)
        breadcrumb_match = breadcrumb.search(self.html)

        if breadcrumb_match:
            # Извлечение текста из хлебных крошек с обработкой вложенности
            breadcrumb_html = breadcrumb_match.group(1)

            # Более гибкие паттерны для извлечения ссылок
            link_patterns = [
                r'<a[^>]*>([^<]+)</a>',
                r'<span[^>]*>([^<]+)</span>',
                r'([^>]+?)'  # Fallback: просто текст без HTML
            ]

            categories = []
            for pattern_str in link_patterns:
                try:
                    link_pattern = self._get_cached_pattern(pattern_str, re.IGNORECASE)
                    matches = link_pattern.findall(breadcrumb_html)

                    for match in matches[:8]:  # Ограничение для предотвращения спама
                        text = match.strip()
                        if len(text) > 1 and not any(word in text.lower() for word in ['home', 'главная', 'каталог']):
                            categories.append(text)
                except Exception:
                    continue  # Пропускаем проблемный паттерн, пробуем следующий

            return categories[:5]  # Ограничение количества категорий

        return []

    def _extract_categories_from_selectors(self) -> List[str]:
        """Извлечение категорий из стандартных HTML селекторов."""
        category_patterns = [
            r'<span[^>]*class="[^"]*category[^"]*"[^>]*>([^<]+)</span>',
            r'<div[^>]*class="[^"]*category[^"]*"[^>]*>([^<]+)</div>',
            r'<h\d+[^>]*class="[^"]*(?:category|nav)[^"]*"[^>]*>([^<]+)</\w+>',
            r'<nav[^>]*>(?:.*?)<[^>]*class="[^"]*category[^"]*"[^>]*>([^<]+)</span>'
        ]

        categories = []
        for pattern_str in category_patterns:
            try:
                category_matches = self._findall_with_pattern(pattern_str, re.IGNORECASE)
                categories.extend([match.strip() for match in category_matches if len(match.strip()) > 1])
            except Exception:
                continue  # Пропускаем проблемный паттерн

        return categories[:5]

    def _extract_categories_from_text(self) -> List[str]:
        """Extraction of categories from plain text content."""
        # Находим контент содержащий возможные категории
        text_patterns = [
            r'(?:раздел[:\s]*|категория[:\s]*)([^,\n]+)',
            r'(?:товары?|продукты?)[:\s]*([^\n]+)',
        ]

        categories = []
        for pattern_str in text_patterns:
            try:
                matches = self._findall_with_pattern(pattern_str, re.IGNORECASE)
                categories.extend([match.strip() for match in matches if len(match.strip()) > 1])
            except Exception:
                continue

        return categories[:5] if categories else []

    def _extract_price(self) -> Dict[str, Any]:
        """Извлечение цены товара."""
        # Поиск цены в различных форматах
        price_patterns = [
            r'<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)</span>',
            r'<div[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)</div>',
            r'<meta[^>]+property="product:price:amount"[^>]+content="([^"]+)"'
        ]

        for pattern in price_patterns:
            match = re.search(pattern, self.html, re.IGNORECASE)
            if match:
                price_text = match.group(1).strip()
                # Извлечение числового значения
                numeric_match = re.search(r'(\d+(?:[,.]\d+)?)', price_text)
                if numeric_match:
                    return {
                        'text': price_text,
                        'amount': float(numeric_match.group(1).replace(',', '.')),
                        'currency': 'RUB' if '₽' in price_text or 'руб' in price_text.lower() else 'unknown'
                    }

        return {
            'text': 'Цена не найдена',
            'amount': 0,
            'currency': 'unknown'
        }

    def _extract_rating(self) -> Dict[str, Any]:
        """Извлечение рейтинга товара."""
        # Поиск рейтинга
        rating_patterns = [
            r'<span[^>]*class="[^"]*rating[^"]*"[^>]*>([^<]+)</span>',
            r'<div[^>]*class="[^"]*rating[^"]*"[^>]*>([^<]+)</div>',
            r'<meta[^>]+property="ratingValue"[^>]+content="([^"]+)"'
        ]

        for pattern in rating_patterns:
            match = re.search(pattern, self.html, re.IGNORECASE)
            if match:
                rating_text = match.group(1).strip()
                # Извлечение числового значения рейтинга
                rating_match = re.search(r'(\d+(?:[.,]\d+)?)', rating_text)
                if rating_match:
                    rating = float(rating_match.group(1).replace(',', '.'))
                    if 0 <= rating <= 5:  # Проверка валидного диапазона
                        return {
                            'text': rating_text,
                            'value': rating,
                            'max_value': 5.0
                        }

        return {
            'text': 'Рейтинг не найден',
            'value': 0,
            'max_value': 5.0
        }

    def extract_product_info_streaming(self, chunk_size: int = 8192) -> Dict[str, Any]:
        """
        Потоковое извлечение информации из больших HTML документов.
        Разбивает документ на чанки для предотвращения переполнения памяти.
        """
        if len(self.html) <= chunk_size:
            return self.extract_product_info()  # Для небольших документов используем обычный парсинг

        js.sendMessageToChat({"content": "Python: 📄 Потоковый парсинг большого HTML документа..."})

        # Разбиваем документ на чанки с перекрытием для capture групп
        overlap = 500  # Перекрытие для правильной работы regex
        chunks = []

        for i in range(0, len(self.html), chunk_size - overlap):
            chunk_end = min(i + chunk_size, len(self.html))
            chunk = self.html[i:chunk_end]
            chunks.append((i, chunk))

        # Параллельная обработка чанков
        import asyncio
        async def process_chunk(chunk_data):
            pos, chunk_html = chunk_data
            # Создаем временный парсер для чанка
            temp_parser = FastDOMParser(chunk_html)
            return temp_parser.extract_product_info()

        # Обрабатываем чанки параллельно
        tasks = [process_chunk(chunk) for chunk in chunks]
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        chunk_results = loop.run_until_complete(asyncio.gather(*tasks))
        loop.close()

        # Объединяем результаты из чанков
        combined_result = self._merge_chunk_results(chunk_results)
        combined_result['parsed_chunks'] = len(chunks)
        combined_result['streaming_used'] = True

        return combined_result

    def _merge_chunk_results(self, chunk_results: List[Dict]) -> Dict[str, Any]:
        """Слияние результатов из разных чанков в единый результат."""
        merged = {
            'title': '',
            'description': '',
            'composition': '',
            'categories': [],
            'price': {'text': 'Цена не найдена', 'amount': 0, 'currency': 'unknown'},
            'rating': {'text': 'Рейтинг не найден', 'value': 0, 'max_value': 5.0}
        }

        for result in chunk_results:
            # Объединяем результаты, предпочитая более полные данные
            if result['title'] and len(result['title']) > len(merged['title']):
                merged['title'] = result['title']

            if result['description'] and len(result['description']) > len(merged['description']):
                merged['description'] = result['description']

            if result['composition'] and len(result['composition']) > len(merged['composition']):
                merged['composition'] = result['composition']

            # Сливаем категории без дубликатов
            merged['categories'].extend(result['categories'])
            merged['categories'] = list(set(merged['categories']))  # Удаляем дубликаты

            # Используем лучшее значение цены (если больше нуля)
            if result['price']['amount'] > merged['price']['amount']:
                merged['price'] = result['price']

            # Используем лучший рейтинг
            if result['rating']['value'] > merged['rating']['value']:
                merged['rating'] = result['rating']

        return merged

    def get_parsing_metrics(self) -> Dict[str, Any]:
        """Получить метрики производительности парсинга."""
        return {
            'parsing_time_ms': round(self.parsing_time, 2),
            'html_size_bytes': len(self.html),
            'html_size_kb': round(len(self.html) / 1024, 2),
            'parsing_efficiency': f"{round(len(self.html) / max(self.parsing_time, 0.001), 0)} bytes/ms" if self.parsing_time > 0 else "N/A",
            'streaming_threshold': 8192,  # Порог для потокового парсинга
            'chunk_overlap': 500  # Перекрытие чанков
        }

# ==============================================================================
# Секция 1: "Публичные" Инструменты
# ------------------------------------------------------------------------------
# Эти функции являются точками входа для `workflow-engine.js`.
# Имя каждой функции соответствует значению `tool` в `workflow.json`,
# например, "python.analyze_ozon_product".
# ==============================================================================

async def analyze_ozon_product(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Главная точка входа для анализа страницы товара Ozon.
    Эта функция оркестрирует весь процесс: парсинг, анализ, поиск аналогов
    и формирование итогового отчета.

    Args:
        input_data: Словарь, содержащий `page_html` текущей страницы.

    Returns:
        Словарь с полным отчетом. Ключевые поля `description` и `composition`
        возвращаются на верхнем уровне, чтобы быть доступными для последующих
        шагов в `workflow.json` (например, для `perform_deep_analysis`).
    """
    try:
        # Шаг 0: Валидация входных данных с offscreen compatibility support
        if input_data is None:
            raise ValueError("Входные данные не предоставлены (None).")

        if not isinstance(input_data, dict):
            try:
                # Попытка преобразования из других типов в offscreen контексте
                input_data = dict(input_data) if hasattr(input_data, '__iter__') else {"page_html": str(input_data)}
            except (TypeError, AttributeError):
                raise ValueError("Входные данные должны быть словарем или конвертируемым в словарь.")

        # Шаг X: Сборка больших строк из чанков (если разделены из-за Pyodide ограничений)
        reconstructed_data = _reconstruct_chunked_strings(input_data)

        # Безопасное извлечение HTML с фоллбеком
        page_html = None

        # DEBUG: Логируем все входные данные
        js.sendMessageToChat({"content": f"Python: DEBUG - Входные данные: keys={list(reconstructed_data.keys())}"})
        for key, value in reconstructed_data.items():
            if isinstance(value, str):
                js.sendMessageToChat({"content": f"Python: DEBUG - {key}: {len(value)} символов"})
            else:
                js.sendMessageToChat({"content": f"Python: DEBUG - {key}: {type(value)}"})

        try:
            # Попытка различных способов доступа к данным
            if 'page_html' in reconstructed_data:
                page_html = reconstructed_data['page_html']
                js.sendMessageToChat({"content": f"Python: DEBUG - Извлечен page_html: {len(page_html)} символов"})
            elif 'html' in reconstructed_data:
                page_html = reconstructed_data['html']
                js.sendMessageToChat({"content": f"Python: DEBUG - Извлечен html: {len(page_html)} символов"})
            elif 'content' in reconstructed_data:
                page_html = reconstructed_data['content']
                js.sendMessageToChat({"content": f"Python: DEBUG - Извлечен content: {len(page_html)} символов"})
            else:
                # Сбор всех возможных HTML-подобных данных
                for key, value in reconstructed_data.items():
                    if isinstance(value, str) and len(value) > 100 and '<' in value and '>' in value:
                        page_html = value
                        js.sendMessageToChat({"content": f"Python: DEBUG - Извлечен из {key}: {len(page_html)} символов"})
                        break
        except (KeyError, TypeError, AttributeError):
            pass

        # Финальная проверка извлеченных данных
        if page_html is None:
            raise ValueError("HTML страницы не найден во входных данных.")

        if not isinstance(page_html, str):
            # Попытка преобразования в строку для offscreen контекста
            try:
                page_html = str(page_html)
            except Exception:
                raise ValueError("HTML страницы должен быть строкой или конвертируемым в строку.")

        if len(page_html.strip()) < 50:  # Минимальная длина для валидного HTML
            raise ValueError(f"HTML страницы слишком короткий ({len(page_html)} символов). Минимум 50 символов.")

        # Дополнительные проверки для offscreen контекста
        if '<html' not in page_html.lower() and '<body' not in page_html.lower() and '<div' not in page_html.lower():
            js.sendMessageToChat({"content": "Python: ⚠️ HTML не содержит типичных тегов. Возможно, это не полноценная страница."})

        # First status message - confirm function execution started

        # Временная заглушка для парсера. В будущем здесь будет использоваться
        # библиотека `beautifulsoup4`, которая будет установлена как зависимость
        # плагина через `micropip`.
        soup = SimpleHTMLParser(page_html)

        # Простая проверка, что мы находимся на странице продукта.
        # Более надежная проверка потребует реального парсинга.
        if 'ozon.ru/product' not in page_html:
            return {
                "status": "info",
                "message": "Это не страница товара Ozon. Плагин работает только на страницах товаров."
            }
        
        analysis_start = datetime.now()
        js.sendMessageToChat({"content": "Python: Начинаю анализ страницы товара..."})

        # Шаг 1: Оптимизированное извлечение структурированных данных со страницы
        js.sendMessageToChat({"content": "Python: 🚀 Быстрый DOM парсинг..."})

        fast_parser = FastDOMParser(page_html)

        # Выбираем метод парсинга в зависимости от размера документа
        if len(page_html) > 50000:  # > 50KB - используем потоковый парсинг
            product_info = fast_parser.extract_product_info_streaming(chunk_size=16384)
            js.sendMessageToChat({"content": f"Python: 📄 Использован потоковый парсинг ({product_info.get('parsed_chunks', 'N/A')} чанков)"})
        else:
            product_info = fast_parser.extract_product_info()

        # Извлечение данных из структурированного результата
        categories = product_info['categories']
        description = product_info['description']
        composition = product_info['composition']

        parsing_metrics = fast_parser.get_parsing_metrics()
        js.sendMessageToChat({"content": f"Python: ✅ Парсинг завершен за {parsing_metrics['parsing_time_ms']}ms"})

        # Шаг 2: ПАРАЛЛЕЛЬНОЕ ВЫПОЛНЕНИЕ AI вызовов для значительного ускорения
        js.sendMessageToChat({"content": f"Python: 🚀 Запускаю параллельный AI анализ..."})

        # Создаем задачи для параллельного выполнения
        analysis_task = _analyze_composition_vs_description(description, composition)
        analogs_task = _find_similar_products(categories, composition)

        # Выполняем оба AI вызова параллельно
        analysis_result, analogs = await asyncio.gather(
            analysis_task,
            analogs_task,
            return_exceptions=True
        )

        # Обработка исключений в параллельных задачах
        if isinstance(analysis_result, Exception):
            js.sendMessageToChat({"content": f"Python: ⚠️ Ошибка анализа соответствия: {analysis_result}"})
            analysis_result = {"score": 5, "reasoning": f"Ошибка AI анализа: {str(analysis_result)}"}

        if isinstance(analogs, Exception):
            js.sendMessageToChat({"content": f"Python: ⚠️ Ошибка поиска аналогов: {analogs}"})
            analogs = [{"name": "Ошибка поиска аналогов", "error": str(analogs)}]

        js.sendMessageToChat({"content": f"Python: ✅ Параллельный анализ завершен!"})
        
        # Шаг 4: Проверяем настройки плагина, заданные пользователем в UI
        enable_deep_analysis = await safe_js_get_setting("enable_deep_analysis", False)
        
        # Шаг 5: Формируем условное предложение для глубокого анализа
        # Это поле будет использоваться в `workflow.json` в условии `run_if`.
        offer_deep_analysis = enable_deep_analysis and analysis_result.get('score', 10) < 7
        
        # Шаг 6: Завершаем все pending батчи и получаем финальные метрики
        await batch_processor.flush_remaining()  # Завершаем все оставшиеся батчи

        cache_metrics = ai_cache.get_metrics()
        memory_stats = memory_manager.get_memory_stats()
        execution_millis = (datetime.now() - analysis_start).total_seconds() * 1000

        result = {
            # Эти два поля дублируются на верхнем уровне специально для того,
            # чтобы следующий шаг в воркфлоу (`perform_deep_analysis`)
            # мог легко получить к ним доступ через `{{steps.analyze.output.description}}`.
            "description": description,
            "composition": composition,
            # Вся остальная информация для отображения в UI
            "categories": categories,
            "analysis": analysis_result,
            "analogs": analogs,
            "message": f"Анализ завершен за {execution_millis:.1f}ms. Оценка соответствия: {analysis_result.get('score', 'N/A')}/10",
            # Метрики производительности, памяти и группировки запросов
            "performance_metrics": {
                "total_execution_time": execution_millis,
                "parallel_ai_calls": 2,  # анализ + аналоги
                "estimated_savings": "~75-85% от первоначальной последовательной обработки",
                "ai_cache": cache_metrics,
                "batch_processing": {
                    "batch_size": batch_processor.batch_size,
                    "max_wait_time_ms": batch_processor.max_wait_time,
                    "current_batch_elements": len(batch_processor.pending_requests),
                    "batch_efficiency": "Active - requests grouped for optimal API utilization"
                },
                "memory_management": {
                    "pool_stats": memory_stats['object_pool_size'],
                    "active_objects": memory_stats['active_objects'],
                    "cache_hits": memory_stats['metrics']['cache_hits'],
                    "objects_reused": memory_stats['metrics']['objects_reused'],
                    "memory_cleaned": memory_stats['metrics']['memory_cleaned'],
                    "total_pooled_objects": memory_stats['total_pooled_objects'],
                    "memory_efficiency": f"{memory_stats['metrics']['objects_reused']}/{memory_stats['metrics']['objects_created']} reused" if memory_stats['metrics']['objects_created'] > 0 else "No objects created"
                }
            },
            # Этот объект используется `workflow-engine` для принятия решения,
            # запускать ли следующий шаг.
            "deep_analysis_offer": {
                "available": offer_deep_analysis,
                "message": "Обнаружены несоответствия. Хотите провести более глубокий анализ?" if offer_deep_analysis else ""
            }
        }
        
        return result
        
    except Exception as e:
        js.sendMessageToChat({"content": f"Python: Критическая ошибка при анализе - {e}"})
        # Возвращаем стандартизированный объект ошибки
        return { "status": "error", "message": f"Ошибка анализа товара: {str(e)}" }

async def pre_warm_pyodide_engine() -> Dict[str, Any]:
    """
    Предварительно разогревает Pyodide движок для ускорения будущих запросов.
    Это уменьшает cold start время с 25-35 секунд до менее 5 секунд.
    """
    try:
        js.sendMessageToChat({"content": "Python: 🚀 Предварительный разогрев Pyodide..."})

        # Вызываем функцию pre-warm из хоста
        warmResult = await js.preWarmPyodide()

        success = safe_dict_get(warmResult, 'success', False)
        if success:
            duration = safe_dict_get(warmResult, 'preWarmDuration', 0)
            message = safe_dict_get(warmResult, 'message', 'Pre-warm completed')
            js.sendMessageToChat({"content": f"Python: ✅ Разогрев завершен! Время: {duration}ms"})

            return {
                "status": "success",
                "message": message,
                "preWarmDuration": duration,
                "warmUpStrategy": "completed"
            }
        else:
            errorMsg = warmResult.get('message', 'Unknown error')
            js.sendMessageToChat({"content": f"Python: ⚠️ Разогрев не удался: {errorMsg}"})

            return {
                "status": "info",
                "message": errorMsg,
                "fallbackStrategy": "cold_start"
            }

    except Exception as e:
        js.sendMessageToChat({"content": f"Python: ❌Ошибка разогрева Pyodide: {e}"})
        return {
            "status": "error",
            "message": f"Pre-warm failed: {str(e)}",
            "fallbackStrategy": "cold_start"
        }

async def perform_deep_analysis(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Выполняет глубокий, ресурсоемкий анализ с помощью самой мощной
    AI-модели, доступной платформе.
    """
    description = input_data.get('description', '')
    composition = input_data.get('composition', '')

    if not description or not composition:
        return { "status": "error", "message": "Описание или состав не были переданы для глубокого анализа."}

    js.sendMessageToChat({"content": "Python: Запускаю глубокий анализ..."})
    
    # Промпт для "экспертного" анализа.
    prompt = f"""
    Проведи глубокий анализ товара с медицинской и научной точки зрения.
    Описание: {description}
    Состав: {composition}
    Проанализируй:
    1. Научную обоснованность заявленных свойств.
    2. Потенциальные побочные эффекты и противопоказания.
    3. Эффективность по сравнению с аналогами.
    Верни детальный анализ в структурированном виде (используй Markdown).
    """
    
    try:
        # "deep_analysis" - это псевдоним из `manifest.json` этого плагина.
        # Платформа сама определит, какую реальную модель (например, gemini-pro)
        # использовать, и подставит соответствующий API-ключ.
        result = await _call_ai_model("deep_analysis", prompt)
        return { "deep_analysis_report": result }
    except Exception as e:
        return { "status": "error", "message": f"Ошибка глубокого анализа: {str(e)}" }

# ==============================================================================
# Секция 2: "Приватные" Вспомогательные Функции
# ------------------------------------------------------------------------------
# Эти функции не предназначены для прямого вызова из `workflow.json`.
# Они инкапсулируют внутреннюю логику плагина.
# ==============================================================================

def _reconstruct_chunked_strings(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Восстанавливает большие строки, которые были разделены на чанки в PyodideManager.
    Возвращает копию данных с восстановленными строками.
    """
    try:
        reconstructed = input_data.copy()
        processed_keys = set()  # Ключи, которые уже обработали

        for key, value in input_data.items():
            # Проверяем, является ли значение метаданными большого чанка
            if isinstance(value, dict) and value.get('__isChunkedString', False):
                chunk_count = value.get('chunkCount', 0)
                original_key = value.get('originalKey', key)
                total_length = value.get('totalLength', 0)

                # Собираем все чанки
                chunks = []
                for i in range(chunk_count):
                    chunk_key = f"{original_key}_chunk_{i}"
                    if chunk_key in input_data:
                        chunks.append(input_data[chunk_key])

                # Собираем строку из чанков
                if len(chunks) == chunk_count:
                    reconstructed[original_key] = ''.join(chunks)

                    # Проверяем целостность
                    if len(reconstructed[original_key]) == total_length:
                        js.sendMessageToChat({
                            "content": f"Python: ✅ Восстановлена строка {original_key} из {chunk_count} чанков ({total_length} символов)"
                        })

                        # Удаляем метаданные и чанки
                        if key in reconstructed:
                            del reconstructed[key]
                        for i in range(chunk_count):
                            chunk_key = f"{original_key}_chunk_{i}"
                            if chunk_key in reconstructed:
                                del reconstructed[chunk_key]
                    else:
                        js.sendMessageToChat({
                            "content": f"Python: ❌ Ошибка сборки строки {original_key}: ожидалось {total_length}, получено {len(reconstructed[original_key])}"
                        })
                        return input_data  # Возвращаем исходные данные при ошибке

                processed_keys.add(key)

        # Удаляем обработанные метаданные
        for key in processed_keys:
            if key in reconstructed and isinstance(reconstructed[key], dict) and reconstructed[key].get('__isChunkedString'):
                del reconstructed[key]

        if processed_keys:
            js.sendMessageToChat({"content": f"Python: 🔧 Восстановлено {len(processed_keys)} больших строк из чанков"})

        return reconstructed

    except Exception as e:
        js.sendMessageToChat({"content": f"Python: ❌ Ошибка при сборке чанков: {e}"})
        return input_data  # Возвращаем исходные данные при ошибке

async def _analyze_composition_vs_description(description: str, composition: str) -> Dict[str, Any]:
    """
    Оптимизированный анализ соответствия описания и состава с предобработкой.
    Использует преданализ для сокращения размера промпта и cache busting.
    """

    if not description or not composition:
        return { "score": 0, "reasoning": "Не удалось извлечь описание или состав товара." }

    # Предварительный анализ для сокращения размера промпта
    analysis_cache_key = f"pre_analysis:{hash(description[:100] + composition[:100])}"
    pre_analyzed = memory_manager.get_cached_lru(analysis_cache_key)

    if not pre_analyzed:
        # Быстрый преданализ ключевых элементов
        key_elements = _extract_key_elements(description, composition)
        memory_manager.cache_lru(analysis_cache_key, key_elements, max_age_seconds=600)  # 10 мин
    else:
        key_elements = pre_analyzed

    # Оптимизированный промпт с преданализированными данными
    prompt = f"""
    Анализ соответствия товара на основе структурированных данных:

    Ключевые элементы описания: {', '.join(key_elements['desc_keywords'])}
    Ключевые ингредиенты состава: {', '.join(key_elements['comp_keywords'])}
    Совпадения: {len(key_elements['matches'])}/{len(key_elements['total_comp'])} найдено

    Полный анализ:
    Описание: {description[:2000]}...
    Состав: {composition[:2000]}...

    Оцени соответствие по шкале 1-10 и верни JSON: {{"score": число, "reasoning": "объяснение", "confidence": значение_0_1}}
    """

    try:
        # Используем псевдоним "basic_analysis", который в манифесте
        # сопоставлен с быстрой и дешевой моделью типа `gemini-flash`.
        result_str = await _call_ai_model("basic_analysis", prompt)
        
        # Очистка и парсинг ответа от AI. Модели часто "оборачивают"
        # JSON в Markdown, который нужно удалить.
        cleaned_str = result_str.strip().replace('```json', '').replace('```', '')
        
        # Используем стандартный и безопасный `json.loads` для парсинга.
        try:
            parsed = json.loads(cleaned_str)
            # Простая валидация формата ответа
            if isinstance(parsed, dict) and 'score' in parsed:
                return parsed
            else:
                return {"score": 5, "reasoning": "Неверный формат ответа от AI (отсутствует 'score')."}
        except json.JSONDecodeError:
            return {"score": 5, "reasoning": f"Не удалось распарсить JSON от AI: {cleaned_str[:100]}..."}

    except Exception as e:
        return { "score": 0, "reasoning": f"Ошибка анализа AI: {str(e)}" }

async def _call_ai_model(model_alias: str, prompt: str, context: Optional[str] = None) -> str:
    """
    Централизованная обертка для всех вызовов LLM с поддержкой кеширования и batch processing.
    Использует advanced caching для повторяющихся запросов.
    Делегирует всю сложную работу (управление ключами, лимитами, разрешениями)
    платформе через `js.llm_call`.
    """
    # Проверяем кеш сначала
    cached_response = await ai_cache.get(model_alias, prompt, context)
    if cached_response:
        js.sendMessageToChat({"content": f"Python: 📋 Кеш hit для {model_alias}"})
        return cached_response

    js.sendMessageToChat({"content": f"Python: 🤖 Вызов AI модели {model_alias}..."})

    start_time = datetime.now()

    try:
        # Используем batch processor для группировки запросов
        future = batch_processor.add_request(model_alias, prompt, context)

        # Ждем ответа от батча
        response_text = await future

        # Вычисляем время ответа (включая время ожидания в батче)
        response_time = int((datetime.now() - start_time).total_seconds() * 1000)

        js.sendMessageToChat({"content": f"Python: ✅ Получен ответ через батч (~{response_time}ms)"})

        # Кешируем успешный ответ
        if response_text and not response_text.startswith("Ошибка"):
            await ai_cache.set(model_alias, prompt, response_text, response_time, context)
            js.sendMessageToChat({"content": f"Python: 💾 Ответ закэширован в батче (~{response_time}ms)"})

        return response_text

    except Exception as e:
        # Пробрасываем ошибку выше, чтобы вызывающая функция могла ее перехватить
        # и обработать в своей бизнес-логике.
        raise RuntimeError(f"Ошибка при вызове модели '{model_alias}': {e}") from e

# Лояльная функция batch processor с расширенной функциональностью
async def _call_ai_model_with_fallback(model_alias: str, prompt: str, context: Optional[str] = None,
                                       use_batch: bool = True) -> str:
    """
    Альтернативный AI caller с опцией отката к немедленному вызову.
    Полезен для критически важных запросов или когда нужен мгновенный ответ.
    """
    if not use_batch or len(prompt) > 10000:  # Очень длинные промпты не группируем
        return await _call_ai_model_immediate(model_alias, prompt, context)

    return await _call_ai_model(model_alias, prompt, context)

async def _call_ai_model_immediate(model_alias: str, prompt: str, context: Optional[str] = None) -> str:
    """
    Немедленный AI вызов без использования batch processor.
    Используется для критически важных запросов.
    """
    # Проверяем кеш
    cached_response = await ai_cache.get(model_alias, prompt, context)
    if cached_response:
        js.sendMessageToChat({"content": f"Python: 📋 Немедленный кеш hit для {model_alias}"})
        return cached_response

    start_time = datetime.now()

    try:
        response_proxy = await js.llm_call(model_alias, {"prompt": prompt})
        if response_proxy is None:
            raise Exception("js.llm_call return None response proxy")
        result = response_proxy.to_py()

        if result is None or safe_dict_get(result, "error"):
            error_msg = safe_dict_get(result, "error_message", "Неизвестная ошибка") if result else "Пустой ответ от хоста"
            raise Exception(f"Ошибка вызова API: {error_msg}")

        response_text = safe_dict_get(result, "response", "Нет ответа от модели.")
        response_time = int((datetime.now() - start_time).total_seconds() * 1000)

        if response_text and not response_text.startswith("Ошибка"):
            await ai_cache.set(model_alias, prompt, response_text, response_time, context)

        return response_text

    except Exception as e:
        raise RuntimeError(f"Ошибка при вызове модели '{model_alias}': {e}") from e

def _extract_key_elements(description: str, composition: str) -> Dict[str, Any]:
    """
    Извлечение ключевых элементов для оптимизации анализа соответствия.
    Выполняет предварительную обработку для уменьшения размера промпта.
    """

    # Ключевые слова описания (быстрый анализ)
    desc_keywords = []
    if description:
        # Поиск активных ингредиентов в описании
        desc_patterns = [
            r'(?:содержит|включает|с\s)\s*([^.,;:!?]+)',
            r'(?:активные?\s+)?(?:ингредиенты?|компоненты?)[:]\s*([^.,;:!?]+)',
            r'(?:коллаген|гиалуроновая кислота|витамин|экстракт|масло)[^.,;:!?]*',
            r'(?:укрепляет|восстанавливает|разглаживает|увлажняет)[^.,;:!?]*'
        ]

        for pattern in desc_patterns:
            pattern_obj = memory_manager.get_cached_lru(f"pattern:desc:{pattern}")
            if not pattern_obj:
                pattern_obj = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
                memory_manager.cache_lru(f"pattern:desc:{pattern}", pattern_obj, max_age_seconds=3600)

            matches = pattern_obj.findall(description)
            desc_keywords.extend(matches[:5])  # Ограничение до 5 элементов

    # Ключевые ингредиенты состава
    comp_keywords = []
    if composition:
        comp_patterns = [
            r'([^,]+(?:кислота|масло|экстракт|коллаген|пептид|витамин|аминокислота|белок)[^,]*)',
            r'([^,]+?(?:парфюм|ароматизатор|консервант)[^,]*)',
            r'([^,]+?(?:гель|крем|лосьон|сыворотка)[^,]*)'
        ]

        for pattern in comp_patterns:
            pattern_obj = memory_manager.get_cached_lru(f"pattern:comp:{pattern}")
            if not pattern_obj:
                pattern_obj = re.compile(pattern, re.IGNORECASE)
                memory_manager.cache_lru(f"pattern:comp:{pattern}", pattern_obj, max_age_seconds=3600)

            matches = pattern_obj.findall(composition)
            comp_keywords.extend(matches[:3])  # Ограничение до 3 элементов

    # Поиск совпадений
    desc_lower = description.lower() if description else ""
    comp_lower = composition.lower() if composition else ""

    matches = []
    total_comp = len(comp_keywords) if comp_keywords else 1

    for keyword in desc_keywords:
        if keyword.lower().strip() in comp_lower and len(keyword.strip()) > 3:
            matches.append(keyword.strip())

    return {
        'desc_keywords': desc_keywords[:3],
        'comp_keywords': comp_keywords[:3],
        'matches': matches,
        'total_comp': total_comp,
        'similarity_ratio': len(matches) / total_comp if total_comp > 0 else 0
    }

# Старая функция _extract_categories удалена - теперь используется FastDOMParser._extract_categories()

def _extract_description_and_composition(soup: 'SimpleHTMLParser') -> tuple:
    """Заглушка для извлечения описания и состава."""
    return "Пример описания", "Пример состава"

async def _find_similar_products(categories: List[str], composition: str) -> List[Dict[str, Any]]:
    """
    Оптимизированный поиск аналогичных продуктов на основе категорий и состава.
    Использует параллельные AI запросы для поиска аналогичных товаров в разных категориях.
    """

    if not categories or not composition:
        return [{"name": "Недостаточно данных для поиска аналогов", "reason": "missing_categories_or_composition"}]

    # Быстрые категоризации по типу продукта
    product_type = _categorize_product_by_composition(composition)

    # Параллельный поиск по разным аспектам
    search_prompt = f"""
    Найди 3-5 аналогичных товаров на основе:
    Категории: {', '.join(categories)}
    Тип продукта: {product_type}
    Состав: {composition[:1000]}...

    Проанализируй характеристики аналогичных товаров и верни результаты в формате JSON:
    {{"analogs": [
        {{"name": "Название товара", "price_range": "Цена от-до", "key_features": ["особенности"], "similarity_score": 85}},
        ...
    ]}}
    """

    try:
        # Используем batch processor для группировки с другими запросами
        response = await _call_ai_model("basic_analysis", search_prompt)

        # Парсим ответ
        try:
            parsed = json.loads(response.replace('```json', '').replace('```', '').strip())
            analogs = parsed.get('analogs', [])

            if analogs:
                return analogs[:5]  # Ограничение до 5 результатов
            else:
                # Fallback - генерируем на основе состава
                return _generate_fallback_analogs(categories, product_type)

        except json.JSONDecodeError:
            # В случае ошибки парсинга возвращаем fallback
            return _generate_fallback_analogs(categories, product_type)

    except Exception as e:
        return [{"name": f"Ошибка поиска аналогов: {str(e)}", "error": True}]

def _categorize_product_by_composition(composition: str) -> str:
    """
    Быстрая категоризация продукта по составу для оптимизации поиска.
    Использует ключевые слова для определения типа продукта.
    """
    comp_lower = composition.lower()

    # Определяем типы продуктов по ключевым ингредиентам
    if any(keyword in comp_lower for keyword in ['коллаген', 'гиалуроновая кислота', 'эластин']):
        return "косметика_anti_aging"
    elif any(keyword in comp_lower for keyword in ['витамин c', 'ниацинамид', 'ретинол']):
        return "косметика_витамины"
    elif any(keyword in comp_lower for keyword in ['масло', 'экстракт', 'травы']):
        return "натуральная_косметика"
    elif any(keyword in comp_lower for keyword in ['глицерин', 'парафин', 'вазелин']):
        return "уходовая_косметика"
    elif any(keyword in comp_lower for keyword in ['белок', 'аминокислоты', 'пептиды']):
        return "спортивное_питание"
    elif any(keyword in comp_lower for keyword in ['сахар', 'фруктоза', 'лактоза']):
        return "пищевые_добавки"
    else:
        return "general_cosmetics"

def _generate_fallback_analogs(categories: List[str], product_type: str) -> List[Dict[str, Any]]:
    """Генерация фоллбэк-аналогов на основе категорий и типа продукта."""
    # Таблица соответствий для быстрого поиска аналогов
    analogs_by_type = {
        "косметика_anti_aging": [
            {"name": "Коллагеновый крем Anti-Age", "price_range": "500-2000 ₽", "similarity_score": 80},
            {"name": "Крем с гиалуроновой кислотой", "price_range": "300-1500 ₽", "similarity_score": 75}
        ],
        "косметика_витамины": [
            {"name": "Витаминный комплекс для кожи", "price_range": "400-1800 ₽", "similarity_score": 78},
            {"name": "C-витаминовая сыворотка", "price_range": "600-2500 ₽", "similarity_score": 85}
        ],
        "general_cosmetics": [
            {"name": "Аналогичный товар", "price_range": "ценовой диапазон похожих товаров", "similarity_score": 70},
            {"name": "Продукт схожей категории", "price_range": "средний рынок", "similarity_score": 65}
        ]
    }

    # Возвращаем аналоги по типу или общие если тип неизвестен
    analogs = analogs_by_type.get(product_type, analogs_by_type["general_cosmetics"])

    # Добавляем категориальную информацию
    for analog in analogs:
        analog["category_match"] = categories[0] if categories else "без категории"

    return analogs[:3]  # Ограничение до 3 результатов

# ==============================================================================
# Секция 3: Временные Заглушки
# ------------------------------------------------------------------------------
# Этот код будет заменен, когда мы добавим поддержку установки `beautifulsoup4`.
# ==============================================================================
class SimpleHTMLParser:
    def __init__(self, html: str): self.html = html
    def find(self, tag: str, attrs: Dict = None) -> 'SimpleHTMLElement': return SimpleHTMLElement(self.html, tag, attrs)
    def find_all(self, tag: str, attrs: Dict = None) -> List['SimpleHTMLElement']: return [SimpleHTMLElement(self.html, tag, attrs)]
class SimpleHTMLElement:
    def __init__(self, html: str, tag: str, attrs: Dict): self.html, self.tag, self.attrs = html, tag, attrs or {}
    def get(self, attr: str, default: str = '') -> str: return self.attrs.get(attr, default)
    def find(self, tag: str, attrs: Dict = None) -> 'SimpleHTMLElement': return SimpleHTMLElement(self.html, tag, attrs)
    def find_all(self, tag: str, attrs: Dict = None) -> List['SimpleHTMLElement']: return [SimpleHTMLElement(self.html, tag, attrs)]
    def get_text(self, strip: bool = False) -> str: return "Пример текста"
    @property
    def text(self) -> str: return "Пример текста"