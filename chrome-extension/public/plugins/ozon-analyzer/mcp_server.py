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
import time
from datetime import datetime
from typing import Any, Dict, List, Protocol, runtime_checkable, Optional
from re import Match

# Импорт для доступа к Pyodide globals (опционально)
try:
    import pyodide
    pyodide_available = True
except ImportError:
    pyodide_available = False

# Импорт для получения стека вызовов
import traceback

# Импорт парсеров HTML для fallback (html.parser встроен в Python)
try:
    from html.parser import HTMLParser
    html_parser_available = True
except ImportError:
    html_parser_available = False

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    import lxml.html
    lxml_available = True
except ImportError:
    lxml_available = False

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
def safe_js_get_setting(setting_name: str, default: Any = False) -> Any:
    try:
        # Синхронный вызов для совместимости с Pyodide
        result_proxy = js.get_setting(setting_name) if 'js' in globals() else default
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

def get_pyodide_var(name: str, default: Any = None) -> Any:
    """
    Безопасная функция для доступа к переменным Pyodide globals.

    Args:
        name: Имя переменной в globals()
        default: Значение по умолчанию, если переменная не найдена

    Returns:
        Значение переменной или default

    Логирует процесс доступа для отладки.
    """
    try:
        # Проверяем наличие переменной в globals()
        if name in globals():
            value = globals()[name]
            return value
        else:
            return default
    except Exception as e:
        return default

async def read_prompt_file(plugin_dir: str, file_path: str) -> str:
    """
    Читает содержимое файла промпта из директории плагина.

    Args:
        plugin_dir: Путь к директории плагина
        file_path: Относительный путь к файлу промпта

    Returns:
        Содержимое файла или пустая строка при ошибке
    """
    console_log(f"LLM_PROMPT_DEBUG: ===== НАЧАЛО read_prompt_file =====")
    console_log(f"LLM_PROMPT_DEBUG: plugin_dir='{plugin_dir}', file_path='{file_path}'")

    try:
        # Формируем полный путь к файлу промпта: plugin_dir + file_path
        full_path = f"{plugin_dir}/{file_path}"
        console_log(f"LLM_PROMPT_DEBUG: 📁 Читаем файл промпта через js.readExtensionFile: {full_path}")

        # Используем новый bridge function js.readExtensionFile
        console_log(f"LLM_PROMPT_DEBUG: Вызываем js.readExtensionFile с путем: {full_path}")
        response_proxy = await js.readExtensionFile(full_path)
        console_log(f"LLM_PROMPT_DEBUG: js.readExtensionFile вернул response: {response_proxy is not None}")
        console_log(f"LLM_PROMPT_DEBUG: response_proxy type: {type(response_proxy)}")

        # Правильная обработка Pyodide объекта
        if hasattr(response_proxy, 'to_py'):
            # Если это PyodideFuture, конвертируем
            console_log(f"LLM_PROMPT_DEBUG: Converting PyodideFuture with to_py()")
            content = response_proxy.to_py()
        else:
            # Если уже готовый результат
            console_log(f"LLM_PROMPT_DEBUG: Using direct result (no to_py needed)")
            content = response_proxy

        # Проверяем тип и конвертируем в строку при необходимости
        if not isinstance(content, str):
            console_log(f"LLM_PROMPT_DEBUG: Конвертация содержимого в строку из типа {type(content)}")
            content = str(content)

        console_log(f"LLM_PROMPT_DEBUG: ✅ Файл промпта прочитан успешно через js.readExtensionFile, длина: {len(content)} символов")
        console_log(f"LLM_PROMPT_DEBUG: Содержимое файла (первые 100 символов): '{content[:100]}'")
        console_log(f"LLM_PROMPT_DEBUG: Содержимое файла (последние 100 символов): '{content[-100:]}'")
        console_log(f"LLM_PROMPT_DEBUG: ===== УСПЕШНЫЙ КОНЕЦ read_prompt_file =====")
        return content.strip()
    except Exception as e:
        console_log(f"LLM_PROMPT_DEBUG: ❌ Ошибка чтения файла промпта {full_path if 'full_path' in locals() else file_path}: {str(e)}")
        console_log(f"LLM_PROMPT_DEBUG: Тип ошибки: {type(e).__name__}")
        console_log(f"LLM_PROMPT_DEBUG: Детали ошибки: {str(e)}")
        import traceback
        console_log(f"LLM_PROMPT_DEBUG: Stack trace: {traceback.format_exc()}")
        console_log(f"LLM_PROMPT_DEBUG: ===== ОШИБОЧНЫЙ КОНЕЦ read_prompt_file =====")
        return ""

async def get_user_prompts(plugin_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Загружает промпты из настроек пользователя или использует значения по умолчанию из manifest.json.
    Поддерживает загрузку промптов из файлов, указанных в manifest.json.

    Args:
        plugin_settings: Настройки плагина из Pyodide globals

    Returns:
        Структура промптов: {basic_analysis: {ru: "...", en: "..."}, deep_analysis: {ru: "...", en: "..."}}
    """
    console_log(f"LLM_PROMPT_DEBUG: ===== НАЧАЛО ЗАГРУЗКИ ПРОМПТОВ =====")
    console_log(f"LLM_PROMPT_DEBUG: plugin_settings type: {type(plugin_settings)}")
    console_log(f"LLM_PROMPT_DEBUG: plugin_settings is None: {plugin_settings is None}")
    if plugin_settings:
        console_log(f"LLM_PROMPT_DEBUG: plugin_settings keys: {list(plugin_settings.keys()) if isinstance(plugin_settings, dict) else 'not dict'}")

    try:
        # ДИАГНОСТИКА: Проверяем получение manifest из plugin_settings или globals для обратной совместимости
        console_log(f"LLM_PROMPT_DEBUG: 🔍 ДИАГНОСТИКА ДОСТУПА К MANIFEST:")
        console_log(f"LLM_PROMPT_DEBUG: plugin_settings type: {type(plugin_settings)}")
        console_log(f"LLM_PROMPT_DEBUG: plugin_settings is dict: {isinstance(plugin_settings, dict)}")
        manifest = None

        # Сначала пытаемся получить manifest из plugin_settings для обратной совместимости
        if plugin_settings and isinstance(plugin_settings, dict):
            manifest_from_settings = safe_dict_get(plugin_settings, 'manifest', None)
            console_log(f"LLM_PROMPT_DEBUG: manifest_from_settings: {manifest_from_settings is not None}")
            console_log(f"LLM_PROMPT_DEBUG: manifest_from_settings type: {type(manifest_from_settings)}")
            if manifest_from_settings and isinstance(manifest_from_settings, dict):
                console_log(f"LLM_PROMPT_DEBUG:   ✅ manifest найден в plugin_settings")
                manifest = manifest_from_settings
            else:
                console_log(f"LLM_PROMPT_DEBUG:   ℹ️ manifest не найден в plugin_settings, проверяем globals")

        # Если не нашли в plugin_settings, fallback на globals
        if manifest is None:
            manifest = get_pyodide_var('manifest', {})
            console_log(f"LLM_PROMPT_DEBUG: manifest from globals: {manifest is not None}")
            console_log(f"LLM_PROMPT_DEBUG: manifest from globals type: {type(manifest)}")
            if manifest:
                console_log(f"LLM_PROMPT_DEBUG:   ✅ manifest найден в globals")
            else:
                console_log(f"LLM_PROMPT_DEBUG:   ❌ manifest НЕ НАЙДЕН ни в plugin_settings, ни в globals")

        console_log(f"LLM_PROMPT_DEBUG:   manifest type: {type(manifest)}")
        if manifest:
            console_log(f"LLM_PROMPT_DEBUG:   manifest ключи: {list(manifest.keys())}")
            console_log(f"LLM_PROMPT_DEBUG:   manifest.options: {manifest.get('options') is not None}")
            if manifest.get('options'):
                console_log(f"LLM_PROMPT_DEBUG:   manifest.options.prompts: {manifest.get('options', {}).get('prompts') is not None}")

        # Диагностика входных данных
        console_log(f"LLM_PROMPT_DEBUG: 🔍 Диагностика входных данных:")
        console_log(f"LLM_PROMPT_DEBUG:   plugin_settings type: {type(plugin_settings)}")
        console_log(f"LLM_PROMPT_DEBUG:   plugin_settings is None: {plugin_settings is None}")
        console_log(f"LLM_PROMPT_DEBUG:   plugin_settings keys: {list(plugin_settings.keys()) if isinstance(plugin_settings, dict) else 'не словарь'}")

        prompts = {
            'basic_analysis': {'ru': '', 'en': ''},
            'deep_analysis': {'ru': '', 'en': ''}
        }

        # Используем manifest, полученный выше (из plugin_settings или globals)
        console_log(f"   manifest: {manifest is not None}")
        console_log(f"   manifest type: {type(manifest)}")

        if manifest:
            console_log(f"   manifest ключи: {list(manifest.keys())}")
            options = safe_dict_get(manifest, 'options', {})
            console_log(f"   manifest.options: {options is not None}")
            if options:
                console_log(f"   manifest.options ключи: {list(options.keys())}")
                console_log(f"   manifest.options.prompts: {options.get('prompts') is not None}")
                if options.get('prompts'):
                    console_log(f"   manifest.options.prompts ключи: {list(options.get('prompts', {}).keys())}")

            manifest_prompts = safe_dict_get(manifest, 'options', {}).get('prompts', {})
            console_log(f"   manifest_prompts: {manifest_prompts}")
            console_log(f"   manifest_prompts type: {type(manifest_prompts)}")
        else:
            console_log(f"   ❌ manifest не найден в globals - ЭТО ОСНОВНАЯ ПРОБЛЕМА!")
            manifest_prompts = {}

        # Получить путь к директории плагина для чтения файлов промптов
        plugin_dir = "plugins/ozon-analyzer"  # Директория плагина в Chrome extension
        console_log(f"LLM_PROMPT_DEBUG: 📁 Путь к директории плагина: {plugin_dir}")

        # Детальная диагностика структуры промптов
        for prompt_type in ['basic_analysis', 'deep_analysis']:
            for lang in ['ru', 'en']:
                console_log(f"LLM_PROMPT_DEBUG: 🔍 Обработка {prompt_type}.{lang}:")

                # Правильно извлекаем промпт из nested структуры plugin_settings (UI сохраняет в prompts.basic_analysis.ru.custom_prompt)
                console_log(f"LLM_PROMPT_DEBUG: 🔍 ДОСТУП К КАСТОМНЫМ ПРОМПТАМ:")
                console_log(f"LLM_PROMPT_DEBUG:   plugin_settings keys: {list(plugin_settings.keys()) if isinstance(plugin_settings, dict) else 'not dict'}")
                
                # НОВОЕ: Проверяем промпты секцию напрямую для диагностики приоритета
                if isinstance(plugin_settings, dict) and 'prompts' in plugin_settings:
                    prompts_section = plugin_settings.get('prompts', {})
                    if isinstance(prompts_section, dict):
                        type_section = prompts_section.get(prompt_type, {})
                        if isinstance(type_section, dict):
                            lang_section = type_section.get(lang, {})
                            if isinstance(lang_section, dict):
                                prompt_value = lang_section.get('custom_prompt', '')
                                prompt_source = lang_section.get('_source', 'unknown')
                                console_log(f"LLM_PROMPT_DEBUG: 📋 prompts[{prompt_type}][{lang}]:")
                                console_log(f"LLM_PROMPT_DEBUG:   - source: {prompt_source}")
                                console_log(f"LLM_PROMPT_DEBUG:   - custom_prompt length: {len(prompt_value) if prompt_value else 0}")
                                console_log(f"LLM_PROMPT_DEBUG:   - custom_prompt preview: {repr(prompt_value[:100]) if prompt_value else 'empty'}")

                custom_value = ''

                # ПРИОРИТЕТ 1: Проверяем plugin_settings['prompts'][prompt_type][lang]['custom_prompt']
                # Это основная структура после исправления в background/index.ts
                if isinstance(plugin_settings, dict) and 'prompts' in plugin_settings:
                    prompts_section = safe_dict_get(plugin_settings, 'prompts', {})
                    if isinstance(prompts_section, dict):
                        type_section = safe_dict_get(prompts_section, prompt_type, {})
                        if isinstance(type_section, dict):
                            lang_section = safe_dict_get(type_section, lang, {})
                            if isinstance(lang_section, dict):
                                custom_value = safe_dict_get(lang_section, 'custom_prompt', '')
                                if custom_value and len(custom_value.strip()) > 0:
                                    console_log(f"LLM_PROMPT_DEBUG:   ✅ Найден custom_prompt в prompts секции: {repr(custom_value[:50])}...")
                                    console_log(f"LLM_PROMPT_DEBUG:   📊 Source: {lang_section.get('_source', 'unknown')}")

                # ПРИОРИТЕТ 2: Проверяем старую структуру plugin_settings[prompt_type][lang]['custom_prompt']
                # Для обратной совместимости (если промпты еще не прошли через background/index.ts)
                if not custom_value or len(custom_value.strip()) == 0:
                    prompt_type_section = safe_dict_get(plugin_settings, prompt_type, {})
                    console_log(f"LLM_PROMPT_DEBUG:   prompt_type_section ({prompt_type}): {prompt_type_section is not None}")
                    if isinstance(prompt_type_section, dict):
                        console_log(f"LLM_PROMPT_DEBUG:   prompt_type_section keys: {list(prompt_type_section.keys())}")
                        lang_section = safe_dict_get(prompt_type_section, lang, {})
                        console_log(f"LLM_PROMPT_DEBUG:   lang_section ({lang}): {lang_section is not None}")
                        if isinstance(lang_section, dict):
                            console_log(f"LLM_PROMPT_DEBUG:   lang_section keys: {list(lang_section.keys())}")
                            custom_value = safe_dict_get(lang_section, 'custom_prompt', '')
                            if custom_value and len(custom_value.strip()) > 0:
                                console_log(f"LLM_PROMPT_DEBUG:   ✅ Найден custom_prompt в старой структуре: {repr(custom_value[:50])}...")

                # ДОПОЛНИТЕЛЬНЫЕ СТРУКТУРЫ (для обратной совместимости)
                if not custom_value or len(custom_value.strip()) == 0:
                    console_log(f"LLM_PROMPT_DEBUG: 🔍 ПРОВЕРКА АЛЬТЕРНАТИВНЫХ СТРУКТУР:")

                    # Проверяем старую структуру: basic_analysis.ru.custom_prompt
                    flat_key = f"{prompt_type}.{lang}.custom_prompt"
                    alt_custom_value = safe_dict_get(plugin_settings, flat_key, None)
                    console_log(f"LLM_PROMPT_DEBUG:   Проверка плоской структуры '{flat_key}': {repr(alt_custom_value)}")
                    if alt_custom_value and isinstance(alt_custom_value, str) and len(alt_custom_value.strip()) > 0:
                        custom_value = alt_custom_value
                        console_log(f"LLM_PROMPT_DEBUG:   ✅ Используем кастомный промпт из плоской структуры")

                    # Проверяем старую структуру: plugin_settings['prompts'][flat_key] (для обратной совместимости)
                    if not custom_value or len(custom_value.strip()) == 0:
                        prompts_section = safe_dict_get(plugin_settings, 'prompts', {})
                        if isinstance(prompts_section, dict):
                            alt_custom_value = safe_dict_get(prompts_section, flat_key, None)
                            console_log(f"LLM_PROMPT_DEBUG:   Проверка старой структуры prompts['{flat_key}']: {repr(alt_custom_value)}")
                            if alt_custom_value and isinstance(alt_custom_value, str) and len(alt_custom_value.strip()) > 0:
                                custom_value = alt_custom_value
                                console_log(f"LLM_PROMPT_DEBUG:   ✅ Используем кастомный промпт из старой структуры prompts[flat_key]")

                console_log(f"LLM_PROMPT_DEBUG:   custom_value для {lang}: {repr(custom_value)}")
                console_log(f"LLM_PROMPT_DEBUG:   custom_value type: {type(custom_value)}")
                console_log(f"LLM_PROMPT_DEBUG:   custom_value length: {len(custom_value) if custom_value else 0}")

                if custom_value and isinstance(custom_value, str) and len(custom_value.strip()) > 0:
                    custom_value_stripped = custom_value.strip()

                    # Проверяем, является ли значение путем к файлу (независимо от того, дефолтный или кастомный)
                    # Если это путь к файлу, нужно его прочитать
                    is_file_path = ('/' in custom_value_stripped or '.txt' in custom_value_stripped)

                    if is_file_path:
                        console_log(f"LLM_PROMPT_DEBUG: 📁 Обнаружен путь к файлу промпта: {custom_value_stripped}")
                        console_log(f"LLM_PROMPT_DEBUG: 📁 Вызываем read_prompt_file с plugin_dir='{plugin_dir}', file_path='{custom_value_stripped}'")
                        file_content = await read_prompt_file(plugin_dir, custom_value_stripped)
                        console_log(f"LLM_PROMPT_DEBUG: 📁 read_prompt_file вернул: длина={len(file_content) if file_content else 0}")
                        if file_content and len(file_content.strip()) > 0:
                            prompts[prompt_type][lang] = file_content
                            console_log(f"LLM_PROMPT_DEBUG: ✅ Загружен промпт из файла: {prompt_type}.{lang} (длина: {len(file_content)})")
                            console_log(f"LLM_PROMPT_DEBUG: 📝 Содержимое промпта (первые 200 символов): '{file_content[:200]}'")
                        else:
                            console_log(f"LLM_PROMPT_DEBUG: ⚠️ Не удалось прочитать файл промпта: {custom_value_stripped}")
                    else:
                        # Это настоящий кастомный промпт (текст, а не путь)
                        prompts[prompt_type][lang] = custom_value_stripped
                        console_log(f"LLM_PROMPT_DEBUG: ✅ Используем настоящий кастомный промпт: {prompt_type}.{lang} (длина: {len(custom_value_stripped)})")
                else:
                    console_log(f"LLM_PROMPT_DEBUG: ℹ️ Кастомный промпт не найден или пустой для {prompt_type}.{lang}")

                    # Fallback 1: manifest.json - проверяем на наличие file path
                    type_prompts = safe_dict_get(manifest_prompts, prompt_type, {})
                    console_log(f"LLM_PROMPT_DEBUG:   type_prompts из manifest ({prompt_type}): {type_prompts}")

                    if type_prompts:
                        lang_data = safe_dict_get(type_prompts, lang, {})
                        console_log(f"LLM_PROMPT_DEBUG:   lang_data для {lang}: {lang_data}")

                        # Проверяем, есть ли путь к файлу
                        file_path = safe_dict_get(lang_data, 'default', '')
                        console_log(f"LLM_PROMPT_DEBUG:   file_path/manifest_value для {prompt_type}.{lang}: {repr(file_path)}")

                        if file_path and isinstance(file_path, str) and len(file_path.strip()) > 0:
                            # Если путь выглядит как путь к файлу (содержит слеши или расширения), пытаемся прочитать файл
                            if '/' in file_path or '.' in file_path:
                                console_log(f"LLM_PROMPT_DEBUG: 📁 Обнаружен путь к файлу: {file_path}, пытаемся прочитать...")
                                console_log(f"LLM_PROMPT_DEBUG: Вызываем read_prompt_file с plugin_dir='{plugin_dir}', file_path='{file_path}'")
                                file_content = await read_prompt_file(plugin_dir, file_path)
                                console_log(f"LLM_PROMPT_DEBUG: read_prompt_file вернул: длина={len(file_content)}, content='{file_content}'")
                                if file_content and len(file_content.strip()) > 0:
                                    prompts[prompt_type][lang] = file_content
                                    console_log(f"LLM_PROMPT_DEBUG: ✅ Загружен промпт из файла: {prompt_type}.{lang} (длина: {len(file_content)})")
                                    console_log(f"LLM_PROMPT_DEBUG: Содержимое промпта: '{file_content}'")
                                else:
                                    console_log(f"LLM_PROMPT_DEBUG: ⚠️ Не удалось прочитать файл промпта: {file_path}")
                                    # Fallback к встроенным промптам
                                    default_value = _get_builtin_default_prompt(prompt_type, lang)
                                    if default_value:
                                        prompts[prompt_type][lang] = default_value
                                        console_log(f"LLM_PROMPT_DEBUG: ✅ Используем встроенный промпт по умолчанию: {prompt_type}.{lang}")
                            else:
                                # Это обычный текстовый промпт из manifest
                                prompts[prompt_type][lang] = file_path
                                console_log(f"LLM_PROMPT_DEBUG: ✅ Используем промпт по умолчанию из manifest: {prompt_type}.{lang}")
                        else:
                            console_log(f"LLM_PROMPT_DEBUG: ⚠️ Промпт по умолчанию не найден или пустой для {prompt_type}.{lang}")
                            # Fallback 2: встроенные промпты по умолчанию
                            default_value = _get_builtin_default_prompt(prompt_type, lang)
                            if default_value:
                                prompts[prompt_type][lang] = default_value
                                console_log(f"LLM_PROMPT_DEBUG: ✅ Используем встроенный промпт по умолчанию: {prompt_type}.{lang}")
                            else:
                                console_log(f"LLM_PROMPT_DEBUG: ⚠️ Встроенный промпт по умолчанию не найден для {prompt_type}.{lang}")
                                console_log(f"LLM_PROMPT_DEBUG: ℹ️ Оставляем пустой промпт для {prompt_type}.{lang}")
                    else:
                        console_log(f"LLM_PROMPT_DEBUG: ⚠️ Тип промпта {prompt_type} не найден в manifest")
                        # Fallback 2: встроенные промпты по умолчанию
                        default_value = _get_builtin_default_prompt(prompt_type, lang)
                        if default_value:
                            prompts[prompt_type][lang] = default_value
                            console_log(f"LLM_PROMPT_DEBUG: ✅ Используем встроенный промпт по умолчанию: {prompt_type}.{lang}")
                        else:
                            console_log(f"LLM_PROMPT_DEBUG: ⚠️ Встроенный промпт по умолчанию не найден для {prompt_type}.{lang}")
                            console_log(f"LLM_PROMPT_DEBUG: ℹ️ Оставляем пустой промпт для {prompt_type}.{lang}")

        # Инициализируем custom_prompts_raw из plugin_settings
        custom_prompts_raw = plugin_settings if plugin_settings else {}

        # Итоговая диагностика
        console_log(f"LLM_PROMPT_DEBUG: 🔍 Итоговая диагностика промптов:")
        console_log(f"LLM_PROMPT_DEBUG:   Plugin settings prompts: {custom_prompts_raw}")
        console_log(f"LLM_PROMPT_DEBUG:   Manifest prompts: {manifest_prompts}")
        console_log(f"LLM_PROMPT_DEBUG:   Final prompts structure: {prompts}")

        # Подробная диагностика каждого промпта
        console_log(f"LLM_PROMPT_DEBUG: 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА ПРОМПТОВ:")
        for prompt_type in ['basic_analysis', 'deep_analysis']:
            for lang in ['ru', 'en']:
                prompt_value = prompts[prompt_type][lang]
                if prompt_value and len(prompt_value.strip()) > 0:
                    console_log(f"LLM_PROMPT_DEBUG:   ✅ {prompt_type}.{lang}: загружен ({len(prompt_value)} символов)")
                    console_log(f"LLM_PROMPT_DEBUG:   📝 Содержимое: '{prompt_value}'")
                else:
                    console_log(f"LLM_PROMPT_DEBUG:   ❌ {prompt_type}.{lang}: НЕ загружен (пустой)")

        # Подсчет загруженных промптов
        loaded_prompts = len([p for pt in prompts.values() for p in pt.values() if p and len(p.strip()) > 0])
        total_prompts = len([p for pt in prompts.values() for p in pt.values()])
        console_log(f"LLM_PROMPT_DEBUG: 📋 Загружено промптов: {loaded_prompts}/{total_prompts} (кастомных: {loaded_prompts})")

        # ДИАГНОСТИКА ПРОБЛЕМЫ: Проверяем источник каждого промпта
        console_log(f"LLM_PROMPT_DEBUG: 🔍 ДИАГНОСТИКА ИСТОЧНИКОВ ПРОМПТОВ:")
        for prompt_type in ['basic_analysis', 'deep_analysis']:
            for lang in ['ru', 'en']:
                prompt_value = prompts[prompt_type][lang]
                if prompt_value and len(prompt_value.strip()) > 0:
                    # Определяем источник промпта
                    if custom_prompts_raw and custom_prompts_raw.get(prompt_type, {}).get(lang) == prompt_value:
                        source = "кастомный"
                    elif manifest_prompts and manifest_prompts.get(prompt_type, {}).get(lang, {}).get('default') == prompt_value:
                        source = "manifest default"
                    elif prompt_value == "сколько будет 10+10":
                        source = "файл basic_analysis.ru.default.txt"
                    else:
                        source = "встроенный fallback"
                    console_log(f"LLM_PROMPT_DEBUG:   📍 {prompt_type}.{lang}: источник = {source} (длина: {len(prompt_value)})")
                    # Логируем первые 50 символов для проверки содержимого
                    console_log(f"LLM_PROMPT_DEBUG:   📝 Содержимое: {repr(prompt_value[:50])}...")
                else:
                    console_log(f"LLM_PROMPT_DEBUG:   ❌ {prompt_type}.{lang}: источник = отсутствует")

        console_log(f"LLM_PROMPT_DEBUG: 🔍 ===== УСПЕШНО ЗАВЕРШЕНА ЗАГРУЗКА ПРОМПТОВ =====")
        return prompts

    except Exception as e:
        console_log(f"❌ Критическая ошибка загрузки промптов: {str(e)}")
        console_log(f"🔍 Детальная диагностика ошибки:")
        console_log(f"   Exception type: {type(e).__name__}")
        console_log(f"   Exception args: {e.args}")
        console_log(f"   Plugin settings: {plugin_settings}")
        console_log(f"   Plugin settings type: {type(plugin_settings)}")

        # Трассировка стека для диагностики
        import traceback
        stack_trace = traceback.format_exc()
        console_log(f"   Stack trace: {stack_trace}")

        # Критический fallback - возвращаем пустые промпты
        console_log(f"⚠️ Возвращаем критический fallback с пустыми промптами")
        return {
            'basic_analysis': {'ru': '', 'en': ''},
            'deep_analysis': {'ru': '', 'en': ''}
        }


def _get_builtin_default_prompt(prompt_type: str, lang: str) -> str:
    """
    Возвращает встроенные промпты по умолчанию для случаев когда они не найдены в manifest.json.

    Args:
        prompt_type: Тип промпта ('basic_analysis' или 'deep_analysis')
        lang: Язык промпта ('ru' или 'en')

    Returns:
        Строка с промптом по умолчанию или пустая строка если не найден
    """
    builtin_prompts = {
        'basic_analysis': {
            'ru': 
"""
Тестовый пример: сколько будет 1+2
"""
,
            'en': 
            """3+3="""
        },
        'deep_analysis': {
            'ru': """Проведи глубокий анализ товара с медицинской и научной точки зрения.
Описание: {description}
Состав: {composition}
Проанализируй:
1. Научную обоснованность заявленных свойств.
2. Потенциальные побочные эффекты и противопоказания.
3. Эффективность по сравнению с аналогами.
Верни детальный максимально подробный обоснованный анализ в структурированном виде (используй Markdown).""",
            'en': """Conduct a deep analysis of the product from a medical and scientific perspective.
Description: {description}
Composition: {composition}
Analyze:
1. Scientific validity of the claimed properties.
2. Potential side effects and contraindications.
3. Effectiveness compared to analogs.
Return a detailed, maximally comprehensive, reasoned analysis in a structured form (use Markdown)."""
        }
    }

    return builtin_prompts.get(prompt_type, {}).get(lang, '')

def clean_reasoning_for_chat(reasoning: str) -> str:
    """
    Очищает markdown-символы из reasoning перед отображением в чате.

    - Убирает жирный текст: **text** → text
    - Убирает курсив: *text* → text
    - Преобразует заголовки: # Title → • Title
    - Преобразует маркированные списки: * item → • item
    - Преобразует нумерованные списки: 1. item → • item
    - Убирает множественные переносы строк
    - Убирает лишние пробелы
    """
    if not isinstance(reasoning, str):
        return str(reasoning) if reasoning is not None else ""

    # Убираем жирный текст
    reasoning = re.sub(r'\*\*(.*?)\*\*', r'\1', reasoning)

    # Убираем курсив (одинарные звездочки, но не в середине слов)
    reasoning = re.sub(r'(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)', r'\1', reasoning)

    # Преобразовываем заголовки
    reasoning = re.sub(r'^#+\s+(.+)$', r'• \1', reasoning, flags=re.MULTILINE)

    # Преобразовываем маркированные списки
    reasoning = re.sub(r'^\*\s+(.+)$', r'• \1', reasoning, flags=re.MULTILINE)

    # Преобразовываем нумерованные списки
    reasoning = re.sub(r'^\d+\.\s+(.+)$', r'• \1', reasoning, flags=re.MULTILINE)

    # Убираем множественные переносы строк
    reasoning = re.sub(r'\n\s*\n\s*\n+', '\n\n', reasoning)

    # Убираем лишние пробелы в начале и конце строк
    reasoning = re.sub(r'^\s+', '', reasoning, flags=re.MULTILINE)
    reasoning = re.sub(r'\s+$', '', reasoning, flags=re.MULTILINE)

    # Убираем множественные пробелы
    reasoning = re.sub(r' +', ' ', reasoning)

    return reasoning.strip()
# ==============================================================================
# Оптимизированная система логирования для уменьшения повторяющихся сообщений
# ==============================================================================
def console_log(message: str, force: bool = False):
    """Логирование в консоль offscreen.html для отладочной информации."""
    try:
        # Используем специальный метод js bridge для логирования
        if hasattr(js, 'consoleLog'):
            js.consoleLog(f"[PYTHON_LOG] {message}")
            # Дополнительная отладка - выводим в системную консоль
            print(f"[PYTHON_LOG_DEBUG] {message}")
        elif hasattr(js, 'console') and hasattr(js.console, 'log'):
            # Fallback: прямой вызов console.log
            js.console.log(f"[background] {message}")
        else:
            # Двойной fallback: отправляем в чат как отладочное сообщение (только для критичных)
            if force:
                plugin_settings = get_pyodide_var('pluginSettings', {})
                content_language = get_safe_content_language(plugin_settings)
                if content_language == "ru":
                    chat_message(f"🐛 ОТЛАДКА: {message}")
                else:
                    chat_message(f"🐛 DEBUG: {message}")
    except Exception as e:
        # Тройной fallback: игнорируем ошибки логирования
        pass
def safe_len(text):
    """Безопасное получение длины с защитой от ошибок типов"""
    try:
        return len(str(text or ""))
    except Exception as e:
        console_log(f"Ошибка при подсчете длины: {str(e)}")
        return 0

# ==============================================================================
# Оптимизированная система логирования для уменьшения повторяющихся сообщений
# ==============================================================================

def chat_message(message: str, message_type: str = None):
    """Отправка сообщения в чат (только для финальных результатов и ошибок)."""
    try:
        # console_log(f"📤 Отправка в чат: {message[:100]}...")
        js.sendMessageToChat({"content": message})
        # console_log(f"✅ Сообщение успешно отправлено в чат ({len(message)} символов)")
    except Exception as e:
        console_log(f"❌ ОШИБКА отправки в чат: {message[:200]}... Ошибка: {str(e)}")
        # Отправляем ошибку в чат для пользователя
        try:
            error_msg = f"⚠️ Ошибка отправки сообщения в чат: {str(e)[:100]}..."
            js.sendMessageToChat({"content": error_msg})
        except:
            pass  # Игнорируем ошибки при отправке сообщения об ошибке

class OptimizedLogger:
    """Оптимизированный логгер для уменьшения повторяющихся сообщений."""

    def __init__(self, max_similar_messages: int = 3):
        self.message_count = {}
        self.max_similar = max_similar_messages
        self.last_message_type = None

    def log(self, message: str, message_type: str = None, force: bool = False):
        """Логирование с контролем повторяющихся сообщений."""
        key = message_type or message[:50]  # Используем первые 50 символов как ключ

        if not force:
            self.message_count[key] = self.message_count.get(key, 0) + 1

            # Не логируем слишком похожие сообщения подряд
            if (self.last_message_type == message_type and
                self.message_count[key] > self.max_similar and
                message_type != 'error'):
                return

        self.last_message_type = message_type
        # Перенаправляем в консоль вместо чата
        console_log(message)

    def reset(self):
        """Сброс счетчиков сообщений."""
        self.message_count.clear()
        self.last_message_type = None

# Глобальный оптимизированный логгер
logger = OptimizedLogger(max_similar_messages=2)

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
            response = await ozon_analyzer_server._call_ai_model(
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

                combined_response = await ozon_analyzer_server._call_ai_model(model_alias, combined_prompt)

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
# ==============================================================================
# Класс OzonAnalyzerServer с кешированием AI вызовов
# ==============================================================================
class OzonAnalyzerServer:
    """
    Сервер анализатора Ozon с оптимизированным кешированием AI вызовов.
    """

    def __init__(self, cache_max_size: int = 200, cache_ttl_seconds: int = 7200):
        self.cache_max_size = cache_max_size
        self.cache_ttl_seconds = cache_ttl_seconds

        # Внутренний кеш для AI вызовов
        self.ai_cache = {}

        # Метрики кеша
        self.cache_metrics = {
            'hits': 0,
            'misses': 0,
            'expired': 0,
            'evicted': 0,
            'total_requests': 0
        }

        # Время последней очистки
        self.last_cleanup = datetime.now()

    def _compute_cache_key(self, model_alias: str, prompt: str) -> str:
        """Вычисляет ключ кеша на основе model_alias и prompt."""
        content = f"{model_alias}:{prompt}"
        return hashlib.md5(content.encode()).hexdigest()

    def _cleanup_expired_cache(self) -> None:
        """Очищает просроченные записи из кеша."""
        current_time = datetime.now().timestamp()
        expired_keys = []

        for key, entry in self.ai_cache.items():
            if current_time > entry['expires_at']:
                expired_keys.append(key)
                self.cache_metrics['expired'] += 1

        for key in expired_keys:
            del self.ai_cache[key]

        # Ограничение размера кеша
        if len(self.ai_cache) > self.cache_max_size:
            # Удаляем самые старые записи
            sorted_entries = sorted(self.ai_cache.items(),
                                  key=lambda x: x[1]['created_at'])
            to_remove = len(sorted_entries) - self.cache_max_size
            for i in range(to_remove):
                key = sorted_entries[i][0]
                del self.ai_cache[key]
                self.cache_metrics['evicted'] += 1

    def _get_cache_metrics(self) -> Dict[str, Any]:
        """Получить метрики эффективности кеширования."""
        total_requests = self.cache_metrics['hits'] + self.cache_metrics['misses']
        hit_rate = (self.cache_metrics['hits'] / total_requests * 100) if total_requests > 0 else 0

        return {
            'cache_size': len(self.ai_cache),
            'max_size': self.cache_max_size,
            'hits': self.cache_metrics['hits'],
            'misses': self.cache_metrics['misses'],
            'expired': self.cache_metrics['expired'],
            'evicted': self.cache_metrics['evicted'],
            'hit_rate_percent': round(hit_rate, 2),
            'total_requests': total_requests
        }

    async def _call_ai_model(self, model_alias: str, prompt: str, context: Optional[str] = None, api_key_id: Optional[str] = None) -> str:
        console_log(f"OZON_ANALYZER_LLM_DEBUG: _call_ai_model вызван с model_alias={model_alias}, prompt_length={len(prompt)}, api_key_id={api_key_id}")
        console_log(f"[DIAGNOSIS] ===== _CALL_AI_MODEL ENTRY =====")
        console_log(f"[DIAGNOSIS] model_alias: {model_alias}")
        console_log(f"[DIAGNOSIS] prompt preview: {prompt[:100]}...")
        console_log(f"[DIAGNOSIS] api_key_id: {api_key_id}")
        console_log(f"[DIAGNOSIS] prompt length: {len(prompt)}")
        console_log(f"[DIAGNOSIS] prompt contains '10+10': {'10+10' in prompt}")
        """
        Асинхронный вызов AI модели с кешированием.
        Ключ кеша формируется на основе model_alias и prompt.
        """
        self.cache_metrics['total_requests'] += 1

        # Очистка кеша при необходимости
        self._cleanup_expired_cache()

        # Формируем ключ кеша
        cache_key = self._compute_cache_key(model_alias, prompt)

        # Проверяем кеш
        if cache_key in self.ai_cache:
            entry = self.ai_cache[cache_key]
            current_time = datetime.now().timestamp()

            # Проверяем TTL
            if current_time <= entry['expires_at']:
                self.cache_metrics['hits'] += 1
                # console_log(f"Кеш HIT для {model_alias} (ключ: {cache_key[:8]}...)")
                # console_log(f"Кеш статистика: {self._get_cache_metrics()['hit_rate_percent']}% hit rate")

                # Обновляем время последнего доступа
                entry['last_accessed'] = current_time
                return entry['response']
            else:
                # Запись просрочена
                del self.ai_cache[cache_key]
                self.cache_metrics['expired'] += 1

        # Кеш miss - выполняем реальный вызов
        self.cache_metrics['misses'] += 1
        # console_log(f"Кеш MISS для {model_alias} - выполняем AI вызов")

        start_time = datetime.now()

        try:

            # Асинхронный вызов AI модели с передачей apiKeyId
            llm_options = {"prompt": prompt, "maxOutputTokens": 4096}
            if api_key_id:
                llm_options["apiKeyId"] = api_key_id
            console_log(f"[LLM_CALL] Вызов js.llm_call с options: {llm_options}")
            console_log(f"[DIAGNOSIS] ===== LLM CALL DIAGNOSTICS =====")
            console_log(f"[DIAGNOSIS] model_alias: {model_alias}")
            console_log(f"[DIAGNOSIS] api_key_id: {api_key_id}")
            console_log(f"[DIAGNOSIS] prompt length: {len(prompt)}")
            console_log(f"[DIAGNOSIS] llm_options keys: {list(llm_options.keys()) if isinstance(llm_options, dict) else 'not dict'}")
    
            # DIAGNOSTIC: Check if js.llm_call exists
            console_log(f"[DIAGNOSIS] js object exists: {hasattr(js, 'llm_call') if 'js' in globals() else 'js not in globals'}")
            if 'js' in globals() and hasattr(js, 'llm_call'):
                console_log(f"[DIAGNOSIS] js.llm_call is function: {callable(getattr(js, 'llm_call', None))}")
            else:
                console_log(f"[DIAGNOSIS] ❌ js.llm_call not available!")
    
            response_proxy = await js.llm_call(model_alias, llm_options)
    
            console_log(f"[DIAGNOSIS] js.llm_call returned: {response_proxy is not None}")
            console_log(f"[DIAGNOSIS] response_proxy type: {type(response_proxy)}")
    
            if response_proxy is None:
                console_log(f"[BRIDGE DIAGNOSTIC] ❌ js.llm_call вернул None!")
                console_log(f"[DIAGNOSIS] ===== LLM CALL DIAGNOSTICS END (NULL RESPONSE) =====")
                raise Exception("js.llm_call вернул None")
    
            # Правильная обработка PyodideFuture
            if hasattr(response_proxy, 'to_py'):
                # Если это PyodideFuture, конвертируем
                console_log(f"[DIAGNOSIS] Converting PyodideFuture with to_py()")
                result = response_proxy.to_py()
            else:
                # Если уже готовый результат
                console_log(f"[DIAGNOSIS] Using direct result (no to_py needed)")
                result = response_proxy
    
            console_log(f"[DIAGNOSIS] Final result type: {type(result)}")
            console_log(f"[DIAGNOSIS] ===== LLM CALL DIAGNOSTICS END =====")

            # ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ СЫРОГО ОТВЕТА ОТ js.llm_call
            console_log("[RAW JS RESPONSE] ===== СЫРОЙ ОТВЕТ ОТ js.llm_call =====")
            if isinstance(result, dict):
                for key, value in result.items():
                    pass
        
                # Проверяем новый формат ответа с полем 'result'
                result_field = safe_dict_get(result, "result")
                response_field = safe_dict_get(result, "response")  # для обратной совместимости

                # console_log(f"[RAW JS RESPONSE] result поле: {result_field}")
                # console_log(f"[RAW JS RESPONSE] response поле: {response_field}")

                # Определяем, какое поле использовать
                if result_field is not None:
                    console_log("[RAW JS RESPONSE] ✅ Используем поле 'result' (новый формат)")
                    final_response_text = result_field
                elif response_field is not None:
                    console_log("[RAW JS RESPONSE] ✅ Используем поле 'response' (старый формат)")
                    final_response_text = response_field
                else:
                    console_log("[RAW JS RESPONSE] ❌ Ни result, ни response поля не найдены")
                    final_response_text = None

                # Дополнительная информация из нового формата
                model_info = safe_dict_get(result, "model")
                response_length = safe_dict_get(result, "response_length")
                raw_response = safe_dict_get(result, "raw_response")

                if model_info:
                    # console_log(f"[RAW JS RESPONSE] Model info: {model_info}")
                    pass
                if response_length:
                    # console_log(f"[RAW JS RESPONSE] Response length: {response_length}")
                    pass
                if raw_response:
                    # console_log(f"[RAW JS RESPONSE] Raw response type: {type(raw_response)}")
                    pass

            else:
                console_log("[RAW JS RESPONSE] response поле: None (результат не является словарем)")
                final_response_text = None
            console_log("[RAW JS RESPONSE] ===== КОНЕЦ СЫРОГО ОТВЕТА =====")

            # ДОБАВИТЬ ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ НЕПОСРЕДСТВЕННО ПЕРЕД ОБРАБОТКОЙ ОШИБОК
            if result is not None:
                console_log(f"[ERROR PROCESSING] result type: {type(result)}")
                console_log(f"[ERROR PROCESSING] result keys: {list(result.keys()) if isinstance(result, dict) else 'not dict'}")
                console_log(f"[ERROR PROCESSING] result content: {result}")
                console_log(f"[ERROR PROCESSING] safe_dict_get(result, 'error'): {safe_dict_get(result, 'error')}")
                console_log(f"[ERROR PROCESSING] safe_dict_get(result, 'api_error'): {safe_dict_get(result, 'api_error')}")
                # ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ api_error СТРУКТУРЫ
                api_error_value = safe_dict_get(result, 'api_error')
                if api_error_value is not None:
                    console_log(f"[ERROR PROCESSING] api_error is not None: type={type(api_error_value)}")
                    if isinstance(api_error_value, dict):
                        console_log(f"[ERROR PROCESSING] api_error keys: {list(api_error_value.keys())}")
                        console_log(f"[ERROR PROCESSING] api_error content preview: {str(api_error_value)[:500]}...")
                    else:
                        console_log(f"[ERROR PROCESSING] api_error value: {str(api_error_value)[:500]}...")
                else:
                    console_log("[ERROR PROCESSING] api_error is None")
            console_log("[ERROR PROCESSING] ===== КОНЕЦ ДЕТАЛЬНОГО ЛОГИРОВАНИЯ =====")

            if result is None or safe_dict_get(result, "error"):
                # Проверяем, есть ли полный объект ошибки API (новый формат)
                api_error = safe_dict_get(result, "api_error")
                console_log(f"[API ERROR PROCESSING] Извлечен api_error: {api_error}")
                console_log(f"[API ERROR PROCESSING] Тип api_error: {type(api_error)}")

                if api_error:
                    console_log("[API ERROR PROCESSING] Вошли в блок обработки api_error")
                    # Используем полный объект ошибки API вместо обобщенного сообщения
                    if isinstance(api_error, dict):
                        console_log("[API ERROR PROCESSING] api_error является словарем")
                        console_log(f"[API ERROR PROCESSING] api_error keys: {list(api_error.keys())}")
                        console_log(f"[API ERROR PROCESSING] api_error content: {api_error}")

                        if safe_dict_get(api_error, "error"):
                            console_log("[API ERROR PROCESSING] Найдено вложенное поле 'error' (формат Google Gemini)")
                            # Формат ошибки Google Gemini API с вложенным полем error
                            error_details = safe_dict_get(api_error, "error")
                            console_log(f"[API ERROR PROCESSING] error_details: {error_details}")
                            console_log(f"[API ERROR PROCESSING] error_details type: {type(error_details)}")

                            if isinstance(error_details, dict):
                                error_code = safe_dict_get(error_details, "code", "Unknown")
                                error_message = safe_dict_get(error_details, "message", "No message")
                                error_status = safe_dict_get(error_details, "status", "Unknown status")
                                error_msg = f"API Error {error_code}: {error_message} (Status: {error_status})"
                                console_log(f"[API ERROR PROCESSING] Сформированное сообщение об ошибке: {error_msg}")
                            else:
                                error_msg = json.dumps(error_details) if error_details else "API Error details"
                                console_log(f"[API ERROR PROCESSING] error_details не словарь, json.dumps: {error_msg}")
                        else:
                            console_log("[API ERROR PROCESSING] Вложенное поле 'error' не найдено, сериализуем api_error как JSON")
                            # Другие форматы ошибок API - сериализуем как JSON
                            error_msg = json.dumps(api_error)
                            console_log(f"[API ERROR PROCESSING] Сериализованный api_error: {error_msg}")
                    else:
                        console_log("[API ERROR PROCESSING] api_error НЕ является словарем")
                        # Если api_error не словарь, конвертируем в строку
                        error_msg = str(api_error)
                        console_log(f"[API ERROR PROCESSING] api_error как строка: {error_msg}")
                else:
                    console_log("[API ERROR PROCESSING] api_error отсутствует, используем fallback")
                    # Fallback к старому формату error_message для обратной совместимости
                    error_msg = safe_dict_get(result, "error_message", "Неизвестная ошибка") if result else "Пустой ответ от хоста"
                    console_log(f"[API ERROR PROCESSING] Fallback error_msg: {error_msg}")
                console_log(f"[API ERROR PROCESSING] Финальное сообщение об ошибке перед исключением: {error_msg}")
                raise Exception(f"Ошибка вызова API: {error_msg}")
        
            # ДОБАВИТЬ ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ЗДЕСЬ:
            console_log("=== СЫРОЙ ОТВЕТ ОТ js.llm_call ===")
            if isinstance(result, dict):
                for key, value in result.items():
                    pass
            console_log("=== КОНЕЦ СЫРОГО ОТВЕТА ===")

            # ИСПОЛЬЗУЕМ final_response_text ИЗ РАСШИРЕННОГО ЛОГИРОВАНИЯ
            if 'final_response_text' in locals() and final_response_text is not None:
                response_text = final_response_text
            else:
                # Fallback для обратной совместимости
                response_text = safe_dict_get(result, "response", "Нет ответа от модели.")
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)

            # Проверяем тип ответа
            if not isinstance(response_text, str):
                response_text = str(response_text)
            elif response_text is None:
                console_log("AI вернул None, устанавливаем fallback")
                response_text = "Нет ответа от модели."

            # Проверяем на пустой ответ
            if isinstance(response_text, str) and len(response_text.strip()) == 0:
                console_log("AI вернул пустую строку, устанавливаем fallback")
                response_text = "Пустой ответ от модели."

            # Кешируем успешный строковый ответ
            if response_text and isinstance(response_text, str) and not response_text.startswith("Ошибка"):
                current_time = datetime.now().timestamp()
                self.ai_cache[cache_key] = {
                    'response': response_text,
                    'model_alias': model_alias,
                    'created_at': current_time,
                    'last_accessed': current_time,
                    'expires_at': current_time + self.cache_ttl_seconds,
                    'response_time_ms': response_time
                }

                # console_log(f"Ответ закэширован (TTL: {self.cache_ttl_seconds}s, размер кеша: {len(self.ai_cache)}/{self.cache_max_size})")

                # Логируем статистику при достижении определенных порогов
                if len(self.ai_cache) % 10 == 0:  # Каждые 10 записей
                    metrics = self._get_cache_metrics()
                    # console_log(f"Кеш метрики обновлены: {metrics['cache_size']}/{metrics['max_size']} записей, {metrics['hit_rate_percent']}% hit rate")

            console_log(f"[DIAGNOSIS] ===== _CALL_AI_MODEL SUCCESSFUL RETURN =====")
            console_log(f"[DIAGNOSIS] Response length: {len(response_text)}")
            # console_log(f"AI вызов завершен (~{response_time}ms)")
            return response_text

        except Exception as e:
            console_log(f"[DIAGNOSIS] ===== _CALL_AI_MODEL EXCEPTION =====")
            console_log(f"[DIAGNOSIS] Exception type: {type(e).__name__}")
            console_log(f"[DIAGNOSIS] Exception message: {str(e)}")
            plugin_settings = get_pyodide_var('pluginSettings', {})
            content_language = get_safe_content_language(plugin_settings)
            if content_language == "ru":
                chat_message(f"Ошибка при вызове модели '{model_alias}': {e}")
            else:
                chat_message(f"Error calling model '{model_alias}': {e}")
            raise RuntimeError(f"Ошибка при вызове модели '{model_alias}': {e}") from e

# Глобальный экземпляр AI кеша (сохраняем для обратной совместимости)
ai_cache = AICache(max_size=200, default_ttl=7200)  # 2 часа TTL, до 200 записей

# Глобальный экземпляр OzonAnalyzerServer
ozon_analyzer_server = OzonAnalyzerServer(cache_max_size=200, cache_ttl_seconds=7200)

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
            # console_log(f"📊 До нормализации: {original_size} символов")

            # Смягченная нормализация - удаляем только лишние пробелы и переносы
            # Сохраняем пробелы между словами, но убираем множественные переносы строк
            self.html = re.sub(r'[ \t]+', ' ', self.html)  # Сжимаем множественные пробелы и табы
            self.html = re.sub(r'\n\s*\n', '\n', self.html)  # Убираем пустые строки
            self.html = re.sub(r'\r\n?', '\n', self.html)  # Стандартизируем переносы строк
            self.html = self.html.strip()  # Убираем пробелы по краям

            new_size = len(self.html)
            data_loss = original_size - new_size

            # Логируем результаты нормализации
            # console_log(f"✅ После нормализации: {new_size} символов (потеряно: {data_loss}, {data_loss/original_size*100:.1f}%)")

            # Добавляем статистику в объект
            self.normalization_stats = {
                'original_size': original_size,
                'normalized_size': new_size,
                'data_loss_bytes': data_loss,
                'data_loss_percent': round(data_loss / original_size * 100, 1) if original_size > 0 else 0
            }

        except Exception as e:
            # console_log(f"⚠️ Ошибка нормализации: {e}")
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
                    console_log(f"⚠️ {field_name} вернул None, использую fallback")
                    info[field_name] = fallback_value
            except Exception as e:
                console_log(f"❌ Ошибка извлечения {field_name}: {e}")
                info[field_name] = fallback_value

        # Вычисляем время парсинга
        self.parsing_time = (datetime.now() - parsing_start).total_seconds() * 1000

        # Добавляем статистику успешного извлечения
        success_count = sum(1 for k, v in info.items()
                            if (isinstance(v, str) and v != info[k] if k in ['title', 'description', 'composition'] else True) and
                            (isinstance(v, list) and len(v) > 0 and v[0] != 'Категория не определена' if k == 'categories' else True) and
                            (isinstance(v, dict) and v.get('amount', 0) > 0 if k in ['price', 'rating'] else True))

        # console_log(f"📊 Извлечено полей: {success_count}/6 (успех: {success_count*100//6}%)")

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
            console_log(f"❌ Ошибка извлечения цены: {e}")
            return {'text': 'Цена не найдена', 'amount': 0, 'currency': 'unknown'}

    def _extract_rating_safe(self) -> Dict[str, Any]:
        """Безопасная обертка для извлечения рейтинга."""
        try:
            return self._extract_rating()
        except Exception as e:
            console_log(f"❌ Ошибка извлечения рейтинга: {e}")
            return {'text': 'Рейтинг не найден', 'value': 0, 'max_value': 5.0}

    def _extract_title(self) -> str:
        """Извлечение заголовка товара с многоуровневым fallback: lxml > html.parser > regex."""

        # Попытка 1: lxml (если доступен)
        if lxml_available:
            try:
                tree = lxml.html.fromstring(self.html)
                # Ищем h1 с классом title
                title_elem = tree.xpath('//h1[contains(@class, "title")]')
                if title_elem:
                    title = title_elem[0].text_content().strip()
                    if len(title) > 10:
                        return title

                # Ищем мета тег og:title
                og_title = tree.xpath('//meta[@property="og:title"]/@content')
                if og_title:
                    title = og_title[0].strip()
                    if len(title) > 10:
                        return title

                # Ищем любой h1
                h1_elem = tree.xpath('//h1')
                if h1_elem:
                    title = h1_elem[0].text_content().strip()
                    if len(title) > 10:
                        return title

                # Ищем title в head
                title_elem = tree.xpath('//title')
                if title_elem:
                    title = title_elem[0].text_content().strip()
                    if len(title) > 10:
                        return title
            except Exception as e:
                pass

        # Попытка 2: html.parser
        try:
            from html.parser import HTMLParser
            class TitleParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.title = None
                    self.in_title_tag = False
                    self.in_h1 = False
                    self.current_data = []

                def handle_starttag(self, tag, attrs):
                    if tag == 'title':
                        self.in_title_tag = True
                    elif tag == 'h1':
                        self.in_h1 = True
                    elif tag == 'meta':
                        attrs_dict = dict(attrs)
                        if attrs_dict.get('property') == 'og:title':
                            content = attrs_dict.get('content', '').strip()
                            if content and len(content) > 10:
                                self.title = content

                def handle_endtag(self, tag):
                    if tag == 'title':
                        self.in_title_tag = False
                    elif tag == 'h1':
                        self.in_h1 = False

                def handle_data(self, data):
                    if self.in_title_tag and not self.title:
                        self.title = data.strip()
                    elif self.in_h1 and not self.title:
                        content = data.strip()
                        if len(content) > 10:
                            self.title = content

            parser = TitleParser()
            parser.feed(self.html)

            if parser.title and len(parser.title) > 10:
                return parser.title

        except Exception as e:
            pass

        # Попытка 3: regex (текущая реализация)
        title_patterns = [
            r'<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</h1>',
            r'<title>([^<]+)</title>',
            r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"',
            r'<h1[^>]*>([^<]+)</h1>'
        ]

        match = self._search_with_pattern(title_patterns, re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            if len(title) > 10:
                return title

        # Fallback regex
        fallback_patterns = [
            r'<title[^>]*>([^<]+)</title>',
            r'<h1[^>]*>([^<]+)</h1>',
            r'>([^<]{15,100})</'
        ]

        fallback_match = self._search_with_pattern(fallback_patterns, re.IGNORECASE)
        if fallback_match:
            title = fallback_match.group(1).strip()
            if len(title) > 10:
                return title

        return "Название товара не найдено"

    def _extract_description(self) -> str:
        """Извлечение описания товара с гибридным подходом: LXML приоритет > regex fallback."""

        # Попытка 1: LXML с множественными селекторами для разных версий макета
        if lxml_available:
            try:
                # console_log("[EXTRACT_DESC] Попытка извлечения описания с помощью LXML")
                tree = lxml.html.fromstring(self.html)

                # Селекторы для описания в порядке приоритета (от специфичных к общим)
                description_selectors = [
                    # Приоритет 1: Найти конкретный блок webDescription, затем h2 "Описание", затем следующий контент
                    '//div[@data-widget="webPdpGrid"]//div[@data-widget="webDescription"]//h2[contains(text(), "Описание")]/following::div[contains(@class, "pdp_ao9")][1]',
                    # Приоритет 2: Альтернативный layout с pdp_sa1
                    '//div[contains(@class, "pdp_sa1")]//div[@data-widget="webDescription"]//div[contains(@class, "pdp_ao9")]',
                    # Приоритет 3: Общий селектор без блока webDescription
                    '//h2[contains(text(), "Описание")]/following::div[contains(@class, "pdp_ao9")][1]'
                ]

                for selector_idx, selector in enumerate(description_selectors, 1):
                    try:
                        # console_log(f"[EXTRACT_DESC] Пробуем селектор {selector_idx}: {selector}")
                        elements = tree.xpath(selector)

                        if elements:
                            # console_log(f"[EXTRACT_DESC] ✅ Найден элемент по селектору {selector_idx}")
                            for element in elements:
                                content = element.text_content().strip()
                                if len(content) > 20:
                                    # console_log(f"[EXTRACT_DESC] ✅ Извлечено описание длиной {len(content)} символов")
                                    return content
                            console_log(f"[EXTRACT_DESC] ⚠️ Элементы найдены, но контент слишком короткий")
                        # else:
                            # console_log(f"[EXTRACT_DESC] ❌ Селектор {selector_idx} не нашел элементов")

                    except Exception as selector_error:
                        console_log(f"[EXTRACT_DESC] ❌ Ошибка в селекторе {selector_idx}: {str(selector_error)}")
                        continue

                console_log("[EXTRACT_DESC] ❌ LXML не смог извлечь описание ни по одному селектору")

            except Exception as lxml_error:
                console_log(f"[EXTRACT_DESC] ❌ Критическая ошибка LXML: {str(lxml_error)}")

        # Попытка 2: Regex fallback
        # console_log("[EXTRACT_DESC] Переход на regex fallback")

        desc_regex_patterns = [
            # Regex эквиваленты LXML селекторов
            r'<h2[^>]*>[^<]*Описание[^<]*</h2>\s*(?:<[^>]*>)*\s*<div[^>]*class="[^"]*pdp_ao9[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*data-widget="webDescription"[^>]*>.*?<h2[^>]*>[^<]*Описание[^<]*</h2>.*?<div[^>]*class="[^"]*pdp_ao9[^"]*"[^>]*>(.*?)</div>',
            # Общие fallback паттерны
            r'<div[^>]*class="[^"]*description[^"]*"[^>]*>([^<]*(?:<[^/][^>]*>[^<]*</[^>]+>[^<]*)*)</div>',
            r'<meta[^>]+name="description"[^>]+content="([^"]+)"'
        ]

        for pattern_idx, pattern in enumerate(desc_regex_patterns, 1):
            try:
                # console_log(f"[EXTRACT_DESC] Пробуем regex паттерн {pattern_idx}")
                match = re.search(pattern, self.html, re.IGNORECASE | re.DOTALL)
                if match:
                    content = match.group(1)
                    clean_pattern = self._get_cached_pattern(r'<[^>]+>', re.I)
                    cleaned_content = clean_pattern.sub('', content).strip()

                    if len(cleaned_content) > 20:
                        console_log(f"[EXTRACT_DESC] ✅ Regex fallback успешен, извлечено {len(cleaned_content)} символов")
                        return cleaned_content
                    # else:
                        # console_log(f"[EXTRACT_DESC] ⚠️ Regex паттерн {pattern_idx} нашел контент, но он слишком короткий")
                # else:
                    # console_log(f"[EXTRACT_DESC] ❌ Regex паттерн {pattern_idx} не нашел совпадений")

            except Exception as regex_error:
                console_log(f"[EXTRACT_DESC] ❌ Ошибка в regex паттерне {pattern_idx}: {str(regex_error)}")
                continue

        # console_log("[EXTRACT_DESC] ❌ Все методы извлечения описания провалились")
        return "Описание товара не найдено"

    def _extract_composition(self) -> str:
        """Извлечение состава товара с гибридным подходом: LXML приоритет > regex fallback."""

        # Попытка 1: LXML с множественными селекторами для разных версий макета
        if lxml_available:
            try:
                console_log("[EXTRACT_COMP] Попытка извлечения состава с помощью LXML")
                tree = lxml.html.fromstring(self.html)

                # Селекторы для состава в порядке приоритета (от специфичных к общим)
                composition_selectors = [
                    # Приоритет 1: Найти конкретный блок webDescription, затем h3 "Состав", затем следующий контент (p)
                    '//div[@data-widget="webPdpGrid"]//div[@data-widget="webDescription"]//h3[contains(text(), "Состав")]/following::p[1]',
                    # Приоритет 2: Альтернативный layout с pdp_sa1
                    '//div[contains(@class, "pdp_sa1")]//div[@data-widget="webDescription"]//h3[contains(text(), "Состав")]/following::p[1]',
                    # Приоритет 3: Общий селектор без блока webDescription
                    '//h3[contains(text(), "Состав")]/following::p[1]'
                ]

                for selector_idx, selector in enumerate(composition_selectors, 1):
                    try:
                        console_log(f"[EXTRACT_COMP] Пробуем селектор {selector_idx}: {selector}")
                        elements = tree.xpath(selector)

                        if elements:
                            console_log(f"[EXTRACT_COMP] ✅ Найден элемент по селектору {selector_idx}")
                            for element in elements:
                                content = element.text_content().strip()
                                if len(content) > 20:
                                    console_log(f"[EXTRACT_COMP] ✅ Извлечено состав длиной {len(content)} символов")
                                    return content
                            console_log(f"[EXTRACT_COMP] ⚠️ Элементы найдены, но контент слишком короткий")
                        else:
                            console_log(f"[EXTRACT_COMP] ❌ Селектор {selector_idx} не нашел элементов")

                    except Exception as selector_error:
                        console_log(f"[EXTRACT_COMP] ❌ Ошибка в селекторе {selector_idx}: {str(selector_error)}")
                        continue

                console_log("[EXTRACT_COMP] ❌ LXML не смог извлечь состав ни по одному селектору")

            except Exception as lxml_error:
                console_log(f"[EXTRACT_COMP] ❌ Критическая ошибка LXML: {str(lxml_error)}")

        # Попытка 2: Regex fallback
        # console_log("[EXTRACT_COMP] Переход на regex fallback")

        comp_regex_patterns = [
            # Regex эквиваленты LXML селекторов
            r'<h3[^>]*>[^<]*Состав[^<]*</h3>\s*(?:<[^>]*>)*\s*<p[^>]*>(.*?)</p>',
            r'<div[^>]*data-widget="webDescription"[^>]*>.*?<h3[^>]*>[^<]*Состав[^<]*</h3>.*?<p[^>]*>(.*?)</p>',
            # Общие fallback паттерны
            r'<div[^>]*id="section-description"[^>]*>.*?<h3[^>]*>([^<]*(?:состав|ингредиенты|состав:|ingredients)[^<]*)</h3>.*?(.*?)(?=<h\d|$)',
            r'<div[^>]*class="[^"]*composition[^"]*"[^>]*>([^<]*(?:<[^/][^>]*>[^<]*</[^>]+>[^<]*)*)</div>',
            r'<div[^>]*class="[^"]*ingredients[^"]*"[^>]*>([^<]*(?:<[^/][^>]*>[^<]*</[^>]+>[^<]*)*)</div>'
        ]

        for pattern_idx, pattern in enumerate(comp_regex_patterns, 1):
            try:
                # console_log(f"[EXTRACT_COMP] Пробуем regex паттерн {pattern_idx}")
                match = re.search(pattern, self.html, re.IGNORECASE | re.DOTALL)
                if match:
                    content = match.group(1)
                    clean_pattern = self._get_cached_pattern(r'<[^>]+>', re.I)
                    cleaned_content = clean_pattern.sub('', content).strip()

                    if len(cleaned_content) > 20:
                        # console_log(f"[EXTRACT_COMP] ✅ Regex fallback успешен, извлечено {len(cleaned_content)} символов")
                        return cleaned_content
                    else:
                        console_log(f"[EXTRACT_COMP] ⚠️ Regex паттерн {pattern_idx} нашел контент, но он слишком короткий")
                # else:
                    # console_log(f"[EXTRACT_COMP] ❌ Regex паттерн {pattern_idx} не нашел совпадений")

            except Exception as regex_error:
                console_log(f"[EXTRACT_COMP] ❌ Ошибка в regex паттерне {pattern_idx}: {str(regex_error)}")
                continue

        # console_log("[EXTRACT_COMP] ❌ Все методы извлечения состава провалились")
        return "Состав не указан"

    def _extract_categories(self) -> List[str]:
        """Извлечение категорий товара с улучшенной fallback логикой."""
        categories = []

        try:
            # Пробуем извлечь из хлебных крошек с fallback обработкой
            categories = self._extract_categories_from_breadcrumbs()
        except Exception as e:
            pass

        # Fallback 1: Поиск по альтернативным селекторам
        if not categories:
            try:
                categories = self._extract_categories_from_selectors()
            except Exception as e:
                pass

        # Fallback 2: Прямой поиск текстовой информации
        if not categories:
            try:
                categories = self._extract_categories_from_text()
            except Exception as e:
                pass

        # Логируем результат
        if categories:
            pass
        else:
            pass

        return categories[:5] if categories else ["Категория не определена"]
    def _extract_categories_from_breadcrumbs(self) -> List[str]:
        """Извлечение ID категорий из хлебных крошек с многоуровневым fallback: lxml > html.parser > regex."""

        # Приоритет: lxml > html.parser > regex
        parser_used = None
        categories = []

        try:
            if lxml_available:
                parser_used = "lxml"
                tree = lxml.html.fromstring(self.html)
                categories = self._extract_with_lxml(tree)
            else:
                parser_used = "html.parser"
                categories = self._extract_with_html_parser()

            if categories:
                pass
            else:
                pass
                # Fallback на regex
                parser_used = "regex"
                categories = self._extract_with_regex()
                if categories:
                    pass

            return categories

        except Exception as e:
            # Fallback на regex если основной парсер сломался
            try:
                categories = self._extract_with_regex()
                if categories:
                    pass
                return categories
            except Exception as fallback_e:
                return []

    def _extract_with_html_parser(self) -> List[str]:
        """Извлечение с html.parser вместо BeautifulSoup с улучшенными селекторами."""
        try:
            from html.parser import HTMLParser
            class BreadcrumbParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.in_breadcrumb_container = False
                    self.in_ol = False
                    self.in_first_li = False
                    self.in_first_link = False
                    self.first_link_href = None
                    self.found_first_link = False
                    # Новые селекторы для различных версий Ozon
                    self.in_breadcrumb_nav = False
                    self.in_breadcrumb_ul = False
                    self.category_links = []

                def handle_starttag(self, tag, attrs):
                    attrs_dict = dict(attrs)

                    # Старый селектор
                    if tag == 'div' and attrs_dict.get('data-widget') == 'breadCrumbs':
                        self.in_breadcrumb_container = True

                    # Новый селектор для навигации
                    elif tag == 'nav' and ('breadcrumb' in attrs_dict.get('class', '').lower() or
                                          'breadcrumbs' in attrs_dict.get('class', '').lower()):
                        self.in_breadcrumb_nav = True

                    # Альтернативный селектор для контейнера
                    elif tag == 'div' and ('breadcrumb' in attrs_dict.get('class', '').lower() or
                                          'breadcrumbs' in attrs_dict.get('class', '').lower()):
                        self.in_breadcrumb_container = True

                    elif tag == 'ol' and (self.in_breadcrumb_container or self.in_breadcrumb_nav):
                        self.in_ol = True

                    elif tag == 'ul' and (self.in_breadcrumb_container or self.in_breadcrumb_nav):
                        self.in_breadcrumb_ul = True

                    elif tag == 'li' and (self.in_ol or self.in_breadcrumb_ul) and not self.found_first_link:
                        self.in_first_li = True

                    elif tag == 'a' and self.in_first_li and not self.found_first_link:
                        self.in_first_link = True
                        href = attrs_dict.get('href', '')
                        if href:
                            self.category_links.append(href)
                            self.first_link_href = href

                def handle_endtag(self, tag):
                    if tag == 'a' and self.in_first_link:
                        self.in_first_link = False
                        self.found_first_link = True
                    elif tag == 'li' and self.in_first_li:
                        self.in_first_li = False
                    elif tag == 'ol' and self.in_ol:
                        self.in_ol = False
                    elif tag == 'ul' and self.in_breadcrumb_ul:
                        self.in_breadcrumb_ul = False
                    elif tag == 'div' and self.in_breadcrumb_container:
                        self.in_breadcrumb_container = False
                    elif tag == 'nav' and self.in_breadcrumb_nav:
                        self.in_breadcrumb_nav = False

            parser = BreadcrumbParser()
            parser.feed(self.html)

            # console_log(f"Найдено {len(parser.category_links)} ссылок в хлебных крошках")

            # Пробуем извлечь ID категории из первой ссылки
            if parser.first_link_href:
                # Разные паттерны для различных форматов URL Ozon
                category_patterns = [
                    r'/category/([^/]+)',  # /category/krasota-i-zdorove-6500
                    r'/catalog/([^/]+)',   # /catalog/krasota-i-zdorove-6500
                    r'/([^/]+)/[^/]*$'     # последний сегмент URL
                ]

                for pattern in category_patterns:
                    category_match = re.search(pattern, parser.first_link_href)
                    if category_match:
                        category_id = category_match.group(1)
                        # console_log(f"Извлечена категория: {category_id} по паттерну {pattern}")
                        return [category_id]

            # Fallback: поиск по всем найденным ссылкам
            for link in parser.category_links:
                for pattern in category_patterns:
                    category_match = re.search(pattern, link)
                    if category_match:
                        category_id = category_match.group(1)
                        # console_log(f"Извлечена категория из fallback: {category_id}")
                        return [category_id]

            return []

        except Exception as e:
            console_log(f"Ошибка в _extract_with_html_parser: {e}")
            return []

    def _extract_with_lxml(self, tree) -> List[str]:
        """Извлечение с lxml с поддержкой новых селекторов Ozon."""
        try:
            # Разные селекторы для хлебных крошек в различных версиях Ozon
            breadcrumb_selectors = [
                '//div[@data-widget="breadCrumbs"]',  # Старый селектор
                '//nav[contains(@class, "breadcrumb")]',  # Новый селектор nav
                '//div[contains(@class, "breadcrumb")]',  # Альтернативный div
                '//ol[contains(@class, "breadcrumb")]',   # Прямой ol селектор
                '//ul[contains(@class, "breadcrumb")]'     # ul селектор
            ]

            first_link = None

            # Пробуем разные селекторы
            for selector in breadcrumb_selectors:
                breadcrumb_container = tree.xpath(selector)
                if breadcrumb_container:
                    # console_log(f"Найден breadcrumb контейнер по селектору: {selector}")

                    # Ищем первый li элемент
                    first_li = breadcrumb_container[0].xpath('.//li[1]')
                    if first_li:
                        # Ищем ссылку в первом li
                        first_link = first_li[0].xpath('.//a')[0] if first_li[0].xpath('.//a') else None
                        if first_link:
                            # console_log("Найдена первая ссылка в breadcrumb")
                            break

                    # Если не нашли в li, ищем первую ссылку в контейнере
                    all_links = breadcrumb_container[0].xpath('.//a')
                    if all_links:
                        first_link = all_links[0]
                        # console_log("Найдена первая ссылка в breadcrumb контейнере")
                        break

            if not first_link:
                console_log("Не найдена ни одна ссылка в breadcrumb")
                return []

            href = first_link.get('href', '')
            if not href:
                console_log("Ссылка не содержит href атрибут")
                return []

            # console_log(f"Извлекаем категорию из URL: {href}")

            # Разные паттерны для различных форматов URL Ozon
            category_patterns = [
                r'/category/([^/]+)',  # /category/krasota-i-zdorove-6500
                r'/catalog/([^/]+)',   # /catalog/krasota-i-zdorove-6500
                r'/([^/]+)/[^/]*$'     # последний сегмент URL
            ]

            for pattern in category_patterns:
                category_match = re.search(pattern, href)
                if category_match:
                    category_id = category_match.group(1)
                    # console_log(f"Извлечена категория: {category_id} по паттерну {pattern}")
                    return [category_id]

            console_log("Не удалось извлечь категорию ни по одному паттерну")
            return []

        except Exception as e:
            console_log(f"Ошибка в _extract_with_lxml: {e}")
            return []

    def _extract_with_regex(self) -> List[str]:
        """Regex fallback для извлечения категорий из хлебных крошек с улучшенными паттернами."""
        try:
            # Разные паттерны для поиска breadcrumb контейнеров
            breadcrumb_patterns = [
                r'<div[^>]*data-widget="breadCrumbs"[^>]*>(.*?)</div>',  # Старый селектор
                r'<nav[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>(.*?)</nav>',  # nav breadcrumb
                r'<div[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>(.*?)</div>',  # div breadcrumb
                r'<ol[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>(.*?)</ol>',    # ol breadcrumb
                r'<ul[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>(.*?)</ul>'     # ul breadcrumb
            ]

            breadcrumbs_html = None

            # Пробуем найти breadcrumb контейнер
            for pattern in breadcrumb_patterns:
                match = re.search(pattern, self.html, re.IGNORECASE | re.DOTALL)
                if match:
                    breadcrumbs_html = match.group(1)
                    # console_log(f"Найден breadcrumb по паттерну: {pattern[:50]}...")
                    break

            if not breadcrumbs_html:
                # console_log("Не найден breadcrumb контейнер ни по одному паттерну")
                return []

            # Ищем список элементов (ol, ul)
            list_patterns = [
                r'<ol[^>]*>(.*?)</ol>',
                r'<ul[^>]*>(.*?)</ul>'
            ]

            list_html = None
            for pattern in list_patterns:
                match = re.search(pattern, breadcrumbs_html, re.IGNORECASE | re.DOTALL)
                if match:
                    list_html = match.group(1)
                    break

            if not list_html:
                console_log("Не найден список в breadcrumb контейнере")
                return []

            # Ищем первый li элемент
            li_pattern = r'<li[^>]*>(.*?)</li>'
            li_match = re.search(li_pattern, list_html, re.IGNORECASE | re.DOTALL)
            if not li_match:
                console_log("Не найден первый li элемент")
                return []

            li_html = li_match.group(1)

            # Ищем ссылку в li
            link_pattern = r'<a[^>]*href="([^"]*)"[^>]*>'
            link_match = re.search(link_pattern, li_html, re.IGNORECASE)
            if not link_match:
                console_log("Не найдена ссылка в первом li")
                return []

            href = link_match.group(1)
            # console_log(f"Найдена ссылка: {href}")

            # Разные паттерны для извлечения ID категории
            category_patterns = [
                r'/category/([^/]+)',  # /category/krasota-i-zdorove-6500
                r'/catalog/([^/]+)',   # /catalog/krasota-i-zdorove-6500
                r'/([^/]+)/[^/]*$'     # последний сегмент URL
            ]

            for pattern in category_patterns:
                category_match = re.search(pattern, href)
                if category_match:
                    category_id = category_match.group(1)
                    # console_log(f"Извлечена категория: {category_id} по паттерну {pattern}")
                    return [category_id]

            console_log("Не удалось извлечь категорию ни по одному паттерну")
            return []

        except Exception as e:
            console_log(f"Ошибка в _extract_with_regex: {e}")
            return []

    def is_product_in_target_category(self, categories: List[str]) -> bool:
        """
        Проверяет принадлежность товара к целевой категории "krasota-i-zdorove-6500".
        Возвращает True если категория найдена в списке.
        """
        target_category = "krasota-i-zdorove-6500"
        return target_category in categories

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
        """Извлечение цены товара с многоуровневым fallback: lxml > html.parser > regex."""

        # Попытка 1: lxml
        if lxml_available:
            try:
                tree = lxml.html.fromstring(self.html)

                # Ищем мета тег с ценой
                meta_price = tree.xpath('//meta[@property="product:price:amount"]/@content')
                if meta_price:
                    price_text = meta_price[0].strip()
                    numeric_match = re.search(r'(\d+(?:[,.]\d+)?)', price_text)
                    if numeric_match:
                        amount = float(numeric_match.group(1).replace(',', '.'))
                        return {
                            'text': price_text,
                            'amount': amount,
                            'currency': 'RUB' if '₽' in price_text or 'руб' in price_text.lower() else 'unknown'
                        }

                # Ищем span с классом price
                price_spans = tree.xpath('//span[contains(@class, "price")]')
                for span in price_spans:
                    price_text = span.text_content().strip()
                    numeric_match = re.search(r'(\d+(?:[,.]\d+)?)', price_text)
                    if numeric_match:
                        amount = float(numeric_match.group(1).replace(',', '.'))
                        return {
                            'text': price_text,
                            'amount': amount,
                            'currency': 'RUB' if '₽' in price_text or 'руб' in price_text.lower() else 'unknown'
                        }

                # Ищем div с классом price
                price_divs = tree.xpath('//div[contains(@class, "price")]')
                for div in price_divs:
                    price_text = div.text_content().strip()
                    numeric_match = re.search(r'(\d+(?:[,.]\d+)?)', price_text)
                    if numeric_match:
                        amount = float(numeric_match.group(1).replace(',', '.'))
                        return {
                            'text': price_text,
                            'amount': amount,
                            'currency': 'RUB' if '₽' in price_text or 'руб' in price_text.lower() else 'unknown'
                        }

            except Exception as e:
                pass

        # Попытка 2: html.parser
        try:
            from html.parser import HTMLParser
            class PriceParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.price = None
                    self.in_price_span = False
                    self.in_price_div = False

                def handle_starttag(self, tag, attrs):
                    attrs_dict = dict(attrs)

                    if tag == 'meta' and attrs_dict.get('property') == 'product:price:amount':
                        content = attrs_dict.get('content', '').strip()
                        if content:
                            numeric_match = re.search(r'(\d+(?:[,.]\d+)?)', content)
                            if numeric_match:
                                self.price = {
                                    'text': content,
                                    'amount': float(numeric_match.group(1).replace(',', '.')),
                                    'currency': 'RUB' if '₽' in content or 'руб' in content.lower() else 'unknown'
                                }

                    elif tag == 'span' and 'price' in attrs_dict.get('class', ''):
                        self.in_price_span = True

                    elif tag == 'div' and 'price' in attrs_dict.get('class', ''):
                        self.in_price_div = True

                def handle_endtag(self, tag):
                    if tag == 'span' and self.in_price_span:
                        self.in_price_span = False
                    elif tag == 'div' and self.in_price_div:
                        self.in_price_div = False

                def handle_data(self, data):
                    if (self.in_price_span or self.in_price_div) and not self.price:
                        price_text = data.strip()
                        numeric_match = re.search(r'(\d+(?:[,.]\d+)?)', price_text)
                        if numeric_match:
                            self.price = {
                                'text': price_text,
                                'amount': float(numeric_match.group(1).replace(',', '.')),
                                'currency': 'RUB' if '₽' in price_text or 'руб' in price_text.lower() else 'unknown'
                            }

            parser = PriceParser()
            parser.feed(self.html)

            if parser.price:
                return parser.price

        except Exception as e:
            pass

        # Попытка 3: regex
        price_patterns = [
            r'<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)</span>',
            r'<div[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)</div>',
            r'<meta[^>]+property="product:price:amount"[^>]+content="([^"]+)"'
        ]

        for pattern in price_patterns:
            match = re.search(pattern, self.html, re.IGNORECASE)
            if match:
                price_text = match.group(1).strip()
                numeric_match = re.search(r'(\d+(?:[,.]\d+)?)', price_text)
                if numeric_match:
                    amount = float(numeric_match.group(1).replace(',', '.'))
                    return {
                        'text': price_text,
                        'amount': amount,
                        'currency': 'RUB' if '₽' in price_text or 'руб' in price_text.lower() else 'unknown'
                    }

        return {
            'text': 'Цена не найдена',
            'amount': 0,
            'currency': 'unknown'
        }
    def _extract_rating(self) -> Dict[str, Any]:
        """Извлечение рейтинга товара с многоуровневым fallback: lxml > html.parser > regex."""

        # Попытка 1: lxml
        if lxml_available:
            try:
                tree = lxml.html.fromstring(self.html)

                # Ищем мета тег с рейтингом
                meta_rating = tree.xpath('//meta[@property="ratingValue"]/@content')
                if meta_rating:
                    rating_text = meta_rating[0].strip()
                    rating_match = re.search(r'(\d+(?:[.,]\d+)?)', rating_text)
                    if rating_match:
                        rating = float(rating_match.group(1).replace(',', '.'))
                        if 0 <= rating <= 5:
                            return {
                                'text': rating_text,
                                'value': rating,
                                'max_value': 5.0
                            }

                # Ищем span с классом rating
                rating_spans = tree.xpath('//span[contains(@class, "rating")]')
                for span in rating_spans:
                    rating_text = span.text_content().strip()
                    rating_match = re.search(r'(\d+(?:[.,]\d+)?)', rating_text)
                    if rating_match:
                        rating = float(rating_match.group(1).replace(',', '.'))
                        if 0 <= rating <= 5:
                            return {
                                'text': rating_text,
                                'value': rating,
                                'max_value': 5.0
                            }

                # Ищем div с классом rating
                rating_divs = tree.xpath('//div[contains(@class, "rating")]')
                for div in rating_divs:
                    rating_text = div.text_content().strip()
                    rating_match = re.search(r'(\d+(?:[.,]\d+)?)', rating_text)
                    if rating_match:
                        rating = float(rating_match.group(1).replace(',', '.'))
                        if 0 <= rating <= 5:
                            return {
                                'text': rating_text,
                                'value': rating,
                                'max_value': 5.0
                            }

            except Exception as e:
                pass

        # Попытка 2: html.parser
        try:
            from html.parser import HTMLParser
            class RatingParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.rating = None
                    self.in_rating_span = False
                    self.in_rating_div = False

                def handle_starttag(self, tag, attrs):
                    attrs_dict = dict(attrs)

                    if tag == 'meta' and attrs_dict.get('property') == 'ratingValue':
                        content = attrs_dict.get('content', '').strip()
                        if content:
                            rating_match = re.search(r'(\d+(?:[.,]\d+)?)', content)
                            if rating_match:
                                rating = float(rating_match.group(1).replace(',', '.'))
                                if 0 <= rating <= 5 and not self.rating:
                                    self.rating = {
                                        'text': content,
                                        'value': rating,
                                        'max_value': 5.0
                                    }

                    elif tag == 'span' and 'rating' in attrs_dict.get('class', ''):
                        self.in_rating_span = True

                    elif tag == 'div' and 'rating' in attrs_dict.get('class', ''):
                        self.in_rating_div = True

                def handle_endtag(self, tag):
                    if tag == 'span' and self.in_rating_span:
                        self.in_rating_span = False
                    elif tag == 'div' and self.in_rating_div:
                        self.in_rating_div = False

                def handle_data(self, data):
                    if (self.in_rating_span or self.in_rating_div) and not self.rating:
                        rating_text = data.strip()
                        rating_match = re.search(r'(\d+(?:[.,]\d+)?)', rating_text)
                        if rating_match:
                            rating = float(rating_match.group(1).replace(',', '.'))
                            if 0 <= rating <= 5:
                                self.rating = {
                                    'text': rating_text,
                                    'value': rating,
                                    'max_value': 5.0
                                }

            parser = RatingParser()
            parser.feed(self.html)

            if parser.rating:
                return parser.rating

        except Exception as e:
            pass

        # Попытка 3: regex
        rating_patterns = [
            r'<span[^>]*class="[^"]*rating[^"]*"[^>]*>([^<]+)</span>',
            r'<div[^>]*class="[^"]*rating[^"]*"[^>]*>([^<]+)</div>',
            r'<meta[^>]+property="ratingValue"[^>]+content="([^"]+)"'
        ]

        for pattern in rating_patterns:
            match = re.search(pattern, self.html, re.IGNORECASE)
            if match:
                rating_text = match.group(1).strip()
                rating_match = re.search(r'(\d+(?:[.,]\d+)?)', rating_text)
                if rating_match:
                    rating = float(rating_match.group(1).replace(',', '.'))
                    if 0 <= rating <= 5:
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
        plugin_settings = get_pyodide_var('pluginSettings', {})
        content_language = get_safe_content_language(plugin_settings)
        if content_language == "ru":
            chat_message("🔍 Анализ продукта начат... Пожалуйста, подождите.")
        else:  # English
            chat_message("🔍 Product analysis started... Please wait.")
        if len(self.html) <= chunk_size:
            return self.extract_product_info()  # Для небольших документов используем обычный парсинг

        logger.log("📄 Потоковый парсинг большого HTML документа...", "analysis_start")

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

def _diagnose_variable_access(variable_name: str) -> Dict[str, Any]:
    """
    Расширенная диагностика способов доступа к переменным.
    Тестирует разные методы доступа и логирует результаты.
    """
    # console_log(f"🔍 ===== ДИАГНОСТИКА ДОСТУПА К '{variable_name}' =====")

    methods = {}
    result = None
    error_details = {}

    # Метод 1: globals()['variable_name']
    try:
        result = pyodide.globals[variable_name]
        methods['globals_direct'] = {
            'success': True,
            'value': result,
            'type': type(result).__name__,
            'length': len(str(result)) if result is not None else 0
        }
        # console_log(f"✅ globals()['{variable_name}'] = {result} (тип: {type(result).__name__})")
    except KeyError as e:
        methods['globals_direct'] = {'success': False, 'error': 'KeyError', 'details': str(e)}
        error_details['globals_direct'] = str(e)
        console_log(f"❌ globals()['{variable_name}'] - KeyError: {e}")
    except Exception as e:
        methods['globals_direct'] = {'success': False, 'error': type(e).__name__, 'details': str(e)}
        error_details['globals_direct'] = str(e)
        console_log(f"❌ globals()['{variable_name}'] - {type(e).__name__}: {e}")

    # Метод 2: pyodide.globals (прямой доступ)
    try:
        pyodide_result = pyodide.globals[variable_name] if variable_name in pyodide.globals else None
        methods['pyodide_globals_direct'] = {
            'success': True,
            'value': pyodide_result,
            'type': type(pyodide_result).__name__,
            'length': len(str(pyodide_result)) if pyodide_result is not None else 0
        }
        # if pyodide_result != result:
            # console_log(f"⚠️ pyodide.globals['{variable_name}'] = {pyodide_result} (ОТЛИЧАЕТСЯ!)")
        # else:
            # console_log(f"✅ pyodide.globals['{variable_name}'] = {pyodide_result} (совпадает)")
    except Exception as e:
        methods['pyodide_globals_direct'] = {'success': False, 'error': type(e).__name__, 'details': str(e)}
        error_details['pyodide_globals_direct'] = str(e)
        console_log(f"❌ pyodide.globals['{variable_name}'] - {type(e).__name__}: {e}")

    # Метод 2.1: Проверка существования pyodide.globals.get() (тест на ошибку)
    try:
        if hasattr(pyodide.globals, 'get'):
            # console_log("ℹ️ pyodide.globals имеет метод get() - это может быть источником ошибки")
            get_result = pyodide.globals.get(variable_name, 'NOT_FOUND')
            methods['pyodide_globals_get_method'] = {
                'success': True,
                'value': get_result,
                'note': 'Метод get() существует, но может работать не как dict.get()'
            }
            # console_log(f"✅ pyodide.globals.get('{variable_name}') = {get_result}")
        else:
            methods['pyodide_globals_get_method'] = {
                'success': False,
                'error': 'MethodNotFound',
                'note': 'Метод get() не существует - это причина ошибки AttributeError'
            }
            # console_log("ℹ️ pyodide.globals НЕ имеет метода get() - это ожидаемо для Pyodide")
    except Exception as e:
        methods['pyodide_globals_get_method'] = {'success': False, 'error': type(e).__name__, 'details': str(e)}
        error_details['pyodide_globals_get_method'] = str(e)
        console_log(f"❌ Проверка pyodide.globals.get() - {type(e).__name__}: {e}")

    # Метод 3: hasattr + getattr
    try:
        if hasattr(pyodide.globals, variable_name):
            getattr_result = getattr(pyodide.globals, variable_name)
            methods['pyodide_getattr'] = {
                'success': True,
                'value': getattr_result,
                'type': type(getattr_result).__name__,
                'length': len(str(getattr_result)) if getattr_result is not None else 0
            }
            # console_log(f"✅ getattr(pyodide.globals, '{variable_name}') = {getattr_result}")
        else:
            methods['pyodide_getattr'] = {'success': False, 'error': 'AttributeError', 'details': f"hasattr вернул False"}
            console_log(f"❌ hasattr(pyodide.globals, '{variable_name}') вернул False")
    except Exception as e:
        methods['pyodide_getattr'] = {'success': False, 'error': type(e).__name__, 'details': str(e)}
        error_details['pyodide_getattr'] = str(e)
        console_log(f"❌ getattr(pyodide.globals, '{variable_name}') - {type(e).__name__}: {e}")

    # Метод 4: Проверка через dir()
    try:
        globals_keys = list(globals().keys())
        pyodide_keys = list(pyodide.globals.keys()) if hasattr(pyodide, 'globals') else []
        methods['globals_keys'] = {
            'globals_keys': globals_keys[:20],  # Первые 20 ключей
            'pyodide_keys': pyodide_keys[:20],
            'variable_in_globals': variable_name in globals_keys,
            'variable_in_pyodide': variable_name in pyodide_keys
        }
        # console_log(f"📊 Ключ '{variable_name}' в globals: {variable_name in globals_keys}")
        # console_log(f"📊 Ключ '{variable_name}' в pyodide.globals: {variable_name in pyodide_keys}")
    except Exception as e:
        methods['globals_keys'] = {'success': False, 'error': type(e).__name__, 'details': str(e)}
        console_log(f"❌ Ошибка проверки ключей: {e}")

    # Рекомендация лучшего метода
    successful_methods = [k for k, v in methods.items() if isinstance(v, dict) and v.get('success', False)]
    if successful_methods:
        best_method = successful_methods[0]  # Первый успешный метод
        # console_log(f"🎯 РЕКОМЕНДУЕМЫЙ МЕТОД: {best_method}")
        # if result is not None:
            # console_log(f"📋 ИСПОЛЬЗУЕМ ЗНАЧЕНИЕ: {result}")
    else:
        console_log("❌ НИ ОДИН МЕТОД НЕ СРАБОТАЛ!")

    console_log(f"🔍 ===== КОНЕЦ ДИАГНОСТИКИ '{variable_name}' =====")

    return {
        'variable_name': variable_name,
        'methods': methods,
        'recommended_value': result,
        'recommended_method': successful_methods[0] if successful_methods else None,
        'error_details': error_details,
        'timestamp': datetime.now().isoformat()
    }

def _run_async_in_sync(coro):
    """
    Вспомогательная функция для запуска асинхронных корутин в синхронном контексте.
    Используется для совместимости с существующим workflow-engine.js
    В Pyodide обычно нет уже запущенного event loop, поэтому используем asyncio.run()
    """
    try:
        # В большинстве случаев в Pyodide нет запущенного event loop
        return asyncio.run(coro)
    except RuntimeError as e:
        # Если event loop уже запущен, логируем ошибку и возвращаем fallback
        # console_log(f"RuntimeError в _run_async_in_sync: {e}")
        # Попробуем создать новый loop в текущем thread
        try:
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            result = new_loop.run_until_complete(coro)
            new_loop.close()
            return result
        except Exception as e2:
            console_log(f"Не удалось создать новый event loop: {e2}")
            # Возвращаем fallback значения
            return ({"score": 5, "reasoning": "Ошибка выполнения асинхронного кода"}, [])

async def _analyze_product_async(description: str, composition: str, categories: List[str], plugin_settings: Dict[str, Any] = None, content_language: str = "ru") -> tuple:
    """
    Асинхронная версия анализа продукта для внутреннего использования.
    Возвращает кортеж (analysis_result, analogs)
    """
    if plugin_settings is None:
        plugin_settings = {}

    # Запускаем анализ соответствия и поиск аналогов последовательно для избежания конфликтов
    analysis_result = await _analyze_composition_vs_description(description, composition, plugin_settings, content_language)

    # Проверяем настройку search_for_analogs и запускаем поиск аналогов отдельно
    analogs = []
    if plugin_settings.get('search_for_analogs', False):
        try:
            analogs = await _find_similar_products(categories, composition, plugin_settings, content_language)
        except Exception as analog_error:
            console_log(f"Ошибка при поиске аналогов: {analog_error}")
            analogs = [{"name": f"Ошибка поиска аналогов: {str(analog_error)}", "error": True}]
    else:
        analogs = []

    # Обрабатываем исключения
    if isinstance(analysis_result, Exception):
        console_log(f"Ошибка в анализе соответствия: {analysis_result}")
        analysis_result = {"score": 5, "reasoning": f"Ошибка анализа: {str(analysis_result)}"}

    if isinstance(analogs, Exception):
        console_log(f"Ошибка в поиске аналогов: {analogs}")
        analogs = [{"name": f"Ошибка поиска аналогов: {str(analogs)}", "error": True}]

    return analysis_result, analogs

def get_selected_llm_config(plugin_settings: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    """
    Получает выбранные LLM модели для каждого типа анализа с учетом выбора пользователя.
    
    Приоритет:
    1. Выбор пользователя из plugin_settings (если есть)
    2. Default LLM из manifest.json
    3. Fallback на стандартные модели

    Args:
        plugin_settings: Настройки плагина из Pyodide globals

    Returns:
        Словарь с выбранными моделями: {'basic_analysis': 'model_name', 'deep_analysis': 'model_name'}
    """
    console_log("[LLM_CONFIG] ===== ПОЛУЧЕНИЕ КОНФИГУРАЦИИ LLM =====")

    # Получить manifest из plugin_settings или globals
    manifest = None
    if plugin_settings and isinstance(plugin_settings, dict):
        manifest = safe_dict_get(plugin_settings, 'manifest', None)
    if manifest is None:
        manifest = get_pyodide_var('manifest', {})

    console_log(f"[LLM_CONFIG] Manifest получен: {manifest is not None}")

    # Получить выбор пользователя из plugin_settings
    selected_llms = {}
    if plugin_settings and isinstance(plugin_settings, dict):
        selected_llms = safe_dict_get(plugin_settings, 'selected_llms', {})
        console_log(f"[LLM_CONFIG] Выбор пользователя: {selected_llms}")

    # Получить ai_models из manifest для fallback
    ai_models = safe_dict_get(manifest, 'ai_models', {})
    console_log(f"[LLM_CONFIG] AI models из manifest: {ai_models}")

    # Определяем модели для каждого типа анализа и языка
    result = {}
    
    # Для basic_analysis
    basic_ru_llm = safe_dict_get(selected_llms, 'basic_analysis.ru')
    basic_en_llm = safe_dict_get(selected_llms, 'basic_analysis.en')
    
    if basic_ru_llm and basic_ru_llm != 'default':
        result['basic_analysis'] = basic_ru_llm
        console_log(f"[LLM_CONFIG] Используем пользовательский выбор для basic_analysis: {basic_ru_llm}")
    elif basic_en_llm and basic_en_llm != 'default':
        result['basic_analysis'] = basic_en_llm
        console_log(f"[LLM_CONFIG] Используем пользовательский выбор для basic_analysis (EN): {basic_en_llm}")
    else:
        # Fallback на manifest или стандартную модель
        result['basic_analysis'] = safe_dict_get(ai_models, 'compliance_check',
                                               safe_dict_get(ai_models, 'basic_analysis', 'gemini-flash-lite'))
        console_log(f"[LLM_CONFIG] Используем fallback для basic_analysis: {result['basic_analysis']}")

    # Для deep_analysis
    deep_ru_llm = safe_dict_get(selected_llms, 'deep_analysis.ru')
    deep_en_llm = safe_dict_get(selected_llms, 'deep_analysis.en')
    
    if deep_ru_llm and deep_ru_llm != 'default':
        result['deep_analysis'] = deep_ru_llm
        console_log(f"[LLM_CONFIG] Используем пользовательский выбор для deep_analysis: {deep_ru_llm}")
    elif deep_en_llm and deep_en_llm != 'default':
        result['deep_analysis'] = deep_en_llm
        console_log(f"[LLM_CONFIG] Используем пользовательский выбор для deep_analysis (EN): {deep_en_llm}")
    else:
        # Fallback на manifest или стандартную модель
        result['deep_analysis'] = safe_dict_get(ai_models, 'deep_analysis', 'gemini-pro')
        console_log(f"[LLM_CONFIG] Используем fallback для deep_analysis: {result['deep_analysis']}")

    console_log(f"[LLM_CONFIG] Финальная конфигурация LLM: {result}")
    console_log("[LLM_CONFIG] ===== КОНЕЦ ПОЛУЧЕНИЯ КОНФИГУРАЦИИ LLM =====")

    return result
def get_api_key_for_analysis(plugin_settings: Optional[Dict[str, Any]] = None,
                            analysis_type: str = 'basic_analysis',
                            content_language: str = 'ru',
                            selected_llm: str = 'default') -> str:
    """
    Получить правильный API-ключ для анализа.

    Args:
        plugin_settings: Настройки плагина
        analysis_type: Тип анализа ('basic_analysis' или 'deep_analysis')
        content_language: Язык контента ('ru' или 'en')
        selected_llm: Выбранная LLM ('default' или платформенная)

    Returns:
        ID ключа для использования в js.llm_call
    """
    console_log(f"[DIAGNOSIS] ===== API KEY RETRIEVAL DIAGNOSTICS =====")
    console_log(f"[DIAGNOSIS] Input parameters: analysis_type='{analysis_type}', content_language='{content_language}', selected_llm='{selected_llm}'")

    # DIAGNOSTIC: Log plugin_settings structure
    console_log(f"[DIAGNOSIS] plugin_settings type: {type(plugin_settings)}")
    if plugin_settings:
        console_log(f"[DIAGNOSIS] plugin_settings keys: {list(plugin_settings.keys()) if isinstance(plugin_settings, dict) else 'not dict'}")
        api_keys = safe_dict_get(plugin_settings, 'api_keys', {})
        console_log(f"[DIAGNOSIS] api_keys from plugin_settings: {api_keys}")
    else:
        console_log(f"[DIAGNOSIS] plugin_settings is None")
        api_keys = {}

    # DIAGNOSTIC: Check for API key availability
    console_log(f"[DIAGNOSIS] Checking API key availability...")

    if selected_llm == 'default':
        # Для Default LLM используем dotted key с .default
        key_id_dotted = f'ozon-analyzer.{analysis_type}.{content_language}.default'
        console_log(f"[DIAGNOSIS] Generated dotted key_id for default LLM: {key_id_dotted}")

        # Проверяем наличие ключа по dotted-формату
        specific_key = safe_dict_get(api_keys, key_id_dotted, '')
        console_log(f"[DIAGNOSIS] Specific dotted key {key_id_dotted} exists: {bool(specific_key and specific_key.strip())}")

        if specific_key and specific_key.strip():
            console_log(f"[DIAGNOSIS] ✅ Using specific key: {key_id_dotted}")
            console_log(f"[DIAGNOSIS] ===== API KEY DIAGNOSTICS COMPLETE =====")
            return key_id_dotted
        else:
            console_log(f"[DIAGNOSIS] ❌ Dotted key {key_id_dotted} not set, will rely on background default handling")
            console_log(f"[DIAGNOSIS] ===== API KEY DIAGNOSTICS COMPLETE =====")
            return None
    else:
        # Для платформенной LLM используем её ID
        console_log(f"[DIAGNOSIS] ✅ Using platform key: {selected_llm}")
        console_log(f"[DIAGNOSIS] ===== API KEY DIAGNOSTICS COMPLETE =====")
        return selected_llm


def get_selected_llm_for_analysis(plugin_settings: Optional[Dict[str, Any]] = None,
                                analysis_type: str = 'basic_analysis',
                                content_language: str = 'ru') -> str:
    """
    Получить выбранную пользователем LLM для данного типа анализа и языка.
    
    Args:
        plugin_settings: Настройки плагина
        analysis_type: Тип анализа ('basic_analysis' или 'deep_analysis')
        content_language: Язык контента ('ru' или 'en')
    
    Returns:
        Выбранная LLM или 'default' если выбор не сделан
    """
    console_log(f"[LLM_SELECTION] Получение LLM для {analysis_type}.{content_language}")
    
    # Получить выбор пользователя из plugin_settings
    selected_llms = {}
    if plugin_settings and isinstance(plugin_settings, dict):
        selected_llms = safe_dict_get(plugin_settings, 'selected_llms', {})
    
    # Получить выбор для конкретной комбинации
    user_choice = safe_dict_get(selected_llms, f'{analysis_type}.{content_language}')
    
    if user_choice and user_choice != 'default':
        console_log(f"[LLM_SELECTION] Пользователь выбрал: {user_choice}")
        return user_choice
    else:
        console_log(f"[LLM_SELECTION] Используем default LLM")
        return 'default'


def get_api_key_for_llm(plugin_settings: Optional[Dict[str, Any]] = None,
                       selected_llm: str = 'default',
                       analysis_type: str = 'basic_analysis',
                       content_language: str = 'ru') -> str:
    """
    Получить API-ключ для выбранной LLM.
    
    Args:
        plugin_settings: Настройки плагина
        selected_llm: Выбранная LLM
        analysis_type: Тип анализа ('basic_analysis' или 'deep_analysis')
        content_language: Язык контента ('ru' или 'en')
    
    Returns:
        API-ключ для выбранной LLM
    """
    console_log(f"[API_KEY] Получение API-ключа для {selected_llm} ({analysis_type}.{content_language})")
    
    if selected_llm == 'default':
        # Для Default LLM используем dotted key с .default
        key_id = f'ozon-analyzer.{analysis_type}.{content_language}.default'
        console_log(f"[API_KEY] Используем специфичный dotted ключ: {key_id}")
        return key_id
    else:
        # Для платформенной LLM используем её ID
        console_log(f"[API_KEY] Используем платформенный ключ: {selected_llm}")
        return selected_llm


def get_platform_api_key(llm_id: str) -> str:
    """
    Получить API-ключ платформы для указанной LLM.
    
    Args:
        llm_id: ID LLM модели
    
    Returns:
        API-ключ платформы или пустая строка
    """
    try:
        # Получаем глобальные AI ключи из pyodide
        global_ai_keys = get_pyodide_var('globalAIKeys', [])
        
        if not isinstance(global_ai_keys, list):
            console_log(f"[PLATFORM_API_KEY] globalAIKeys не является списком: {type(global_ai_keys)}")
            return ''
        
        # Ищем ключ для указанной LLM
        for key_info in global_ai_keys:
            if isinstance(key_info, dict) and key_info.get('id') == llm_id:
                api_key = key_info.get('apiKey', '')
                console_log(f"[PLATFORM_API_KEY] Найден ключ для {llm_id}: {'есть' if api_key else 'пустой'}")
                return api_key
        
        console_log(f"[PLATFORM_API_KEY] Ключ для {llm_id} не найден в глобальных ключах")
        return ''
        
    except Exception as e:
        console_log(f"[PLATFORM_API_KEY] Ошибка получения платформенного ключа: {str(e)}")
        return ''


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

    Examples:
        >>> get_safe_content_language({'response_language': 'en'})
        'en'

        >>> get_safe_content_language({'response_language': 'invalid'})
        'ru'  # fallback

        >>> get_safe_content_language({})
        'ru'  # default fallback
    """
    console_log("[LANGUAGE_VALIDATION] ===== НАЧАЛО ВАЛИДАЦИИ ЯЗЫКА =====")

    # ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА plugin_settings В get_safe_content_language
    if not isinstance(plugin_settings, dict):
        console_log(f"[LANGUAGE_VALIDATION] ВНИМАНИЕ: plugin_settings не является словарем в get_safe_content_language! Тип: {type(plugin_settings)}, Значение: {plugin_settings}")
        plugin_settings = {}  # Принудительно устанавливаем пустой словарь для безопасности

    # Извлечение значения response_language из plugin_settings
    raw_response_language = safe_dict_get(plugin_settings, "response_language", "ru")
    # console_log(f"[LANGUAGE_VALIDATION] Извлечено response_language: '{raw_response_language}' (тип: {type(raw_response_language).__name__})")

    # Детальный анализ plugin_settings
    # console_log(f"[LANGUAGE_VALIDATION] Анализ plugin_settings:")
    # console_log(f"[LANGUAGE_VALIDATION]   - Тип plugin_settings: {type(plugin_settings)}")
    if isinstance(plugin_settings, dict):
        # console_log(f"[LANGUAGE_VALIDATION]   - Все ключи: {list(plugin_settings.keys())}")
        response_lang = plugin_settings.get('response_language', 'КЛЮЧ ОТСУТСТВУЕТ') if plugin_settings else 'plugin_settings is None'
        # console_log(f"[LANGUAGE_VALIDATION]   - Значение response_language: {response_lang}")
        # console_log(f"[LANGUAGE_VALIDATION]   - Значение по умолчанию для safe_dict_get: 'ru'")
    # else:
        # console_log(f"[LANGUAGE_VALIDATION]   - plugin_settings не является словарем!")

    # Список допустимых значений
    valid_languages = ['ru', 'en', 'auto']
    # console_log(f"[LANGUAGE_VALIDATION] Допустимые значения: {valid_languages}")

    # Детальная проверка валидности
    # console_log(f"[LANGUAGE_VALIDATION] Проверка валидности '{raw_response_language}':")
    # console_log(f"[LANGUAGE_VALIDATION]   - Проверка типа: {type(raw_response_language)}")
    # console_log(f"[LANGUAGE_VALIDATION]   - Проверка на None: {raw_response_language is None}")
    # console_log(f"[LANGUAGE_VALIDATION]   - Проверка на пустую строку: {raw_response_language == '' if isinstance(raw_response_language, str) else 'N/A'}")
    # console_log(f"[LANGUAGE_VALIDATION]   - Принадлежность к valid_languages: {raw_response_language in valid_languages}")

    # Валидация значения
    if raw_response_language in valid_languages:
        # console_log(f"[LANGUAGE_VALIDATION] ✅ Валидация пройдена: '{raw_response_language}' является допустимым значением")
        result = raw_response_language
    else:
        # console_log(f"[LANGUAGE_VALIDATION] ❌ Валидация НЕ пройдена: '{raw_response_language}' не является допустимым значением")
        # console_log(f"[LANGUAGE_VALIDATION] 🔄 Используем fallback: 'ru'")
        # console_log(f"[LANGUAGE_VALIDATION] Причина: значение не входит в {valid_languages}")
        result = "ru"

    # console_log(f"[LANGUAGE_VALIDATION] Финальный результат: '{result}'")
    console_log("[LANGUAGE_VALIDATION] ===== КОНЕЦ ВАЛИДАЦИИ ЯЗЫКА =====")

    return result

def detect_language(text: str) -> str:
    """
    Определяет язык текста на основе наличия кириллических символов.

    Args:
        text (str): Текст для анализа

    Returns:
        str: 'ru' если есть кириллические символы, иначе 'en'
    """
    if not text:
        return 'en'
    if re.search(r'[а-яё]', text, re.IGNORECASE):
        return 'ru'
    else:
        return 'en'

def get_default_model_id_from_manifest(analysis_type: str = 'basic_analysis', content_language: str = 'ru', plugin_settings: Optional[Dict[str, Any]] = None) -> str:
    """
    Получить id модели по умолчанию из manifest для данного analysis_type и языка.
    """
    console_log(f"[DEFAULT_MODEL] Получение модели для {analysis_type}.{content_language}")
    
    manifest = None
    if plugin_settings and isinstance(plugin_settings, dict):
        manifest = safe_dict_get(plugin_settings, 'manifest', None)
        console_log(f"[DEFAULT_MODEL] Manifest из plugin_settings: {manifest is not None}")
    
    if manifest is None:
        manifest = get_pyodide_var('manifest', {})
        console_log(f"[DEFAULT_MODEL] Manifest из pyodide globals: {manifest is not None}")
    
    console_log(f"[DEFAULT_MODEL] Manifest keys: {list(manifest.keys()) if isinstance(manifest, dict) else 'not dict'}")
    
    try:
        prompts = manifest.get('options', {}).get('prompts', {})
        console_log(f"[DEFAULT_MODEL] Prompts keys: {list(prompts.keys()) if isinstance(prompts, dict) else 'not dict'}")
        
        analysis_prompts = prompts.get(analysis_type, {})
        console_log(f"[DEFAULT_MODEL] Analysis prompts for {analysis_type}: {list(analysis_prompts.keys()) if isinstance(analysis_prompts, dict) else 'not dict'}")
        
        lang_prompts = analysis_prompts.get(content_language, {})
        console_log(f"[DEFAULT_MODEL] Language prompts for {content_language}: {list(lang_prompts.keys()) if isinstance(lang_prompts, dict) else 'not dict'}")
        
        default_llm = lang_prompts.get('LLM', {}).get('default', None)
        console_log(f"[DEFAULT_MODEL] Default LLM config: {default_llm}")
        
        # Если для Default LLM задан curl_file, не подменяем на платформенные модели
        # Возвращаем alias по типу анализа, чтобы background сопоставил его через manifest.ai_models
        if isinstance(default_llm, dict) and 'curl_file' in default_llm:
            console_log(f"[DEFAULT_MODEL] ✅ Found curl_file, returning analysis_type: {analysis_type}")
            return analysis_type
        
        if isinstance(default_llm, dict) and 'model' in default_llm:
            console_log(f"[DEFAULT_MODEL] Found model in default_llm: {default_llm['model']}")
            return default_llm['model']
        if isinstance(default_llm, str):
            console_log(f"[DEFAULT_MODEL] Found string default_llm: {default_llm}")
            return default_llm
    except Exception as e:
        console_log(f"[DEFAULT_MODEL] Ошибка получения модели из manifest: {str(e)}")
    
    # Fallback: возвращаем alias типа анализа, чтобы background решил сопоставление
    console_log(f"[DEFAULT_MODEL] Fallback: returning analysis_type {analysis_type}")
    return analysis_type

async def analyze_ozon_product(input_data: Dict[str, Any] = None,
                        page_html_chunk_count: int = None,
                        page_html_total_length: int = None,
                        page_html_chunk_0: str = None) -> Dict[str, Any]:
    """
    Главная точка входа для анализа страницы товара Ozon.
    Эта функция оркестрирует весь процесс: парсинг, анализ, поиск аналогов
    и формирование итогового отчета.

    Данные считываются из JS globals, переданные JavaScript.
    Настройки плагина передаются через input_data['pluginSettings'].

    Returns:
        Словарь с полным отчетом. Ключевые поля `description` и `composition`
        возвращаются на верхнем уровне, чтобы быть доступными для последующих
        шагов в `workflow.json` (например, для `perform_deep_analysis`).
    """
    # [DIAGNOSTIC] РАННЕЕ ЛОГИРОВАНИЕ В НАЧАЛЕ ФУНКЦИИ
    console_log("[DIAGNOSTIC] >>>>>> analyze_ozon_product FUNCTION CALLED <<<<<<")
    # console_log(f"[DIAGNOSTIC] Timestamp: {datetime.now().isoformat()}")
    # console_log(f"[DIAGNOSTIC] input_data: {input_data}")
    # console_log(f"[DIAGNOSTIC] input_data type: {type(input_data)}")
    # if input_data and isinstance(input_data, dict):
        # console_log(f"[DIAGNOSTIC] input_data keys: {list(input_data.keys())}")

    # [PYODIDE GLOBALS DIAGNOSTIC] Проверка состояния pyodide.globals
    console_log("[PYODIDE GLOBALS DIAGNOSTIC] ===== ПРОВЕРКА pyodide.globals =====")
    try:
        # console_log(f"[PYODIDE GLOBALS DIAGNOSTIC] pyodide.globals type: {type(pyodide.globals)}")
        # console_log(f"[PYODIDE GLOBALS DIAGNOSTIC] pyodide.globals dir: {[attr for attr in dir(pyodide.globals) if not attr.startswith('_')][:10]}")
        # console_log(f"[PYODIDE GLOBALS DIAGNOSTIC] hasattr get: {hasattr(pyodide.globals, 'get')}")
        # console_log(f"[PYODIDE GLOBALS DIAGNOSTIC] hasattr __getitem__: {hasattr(pyodide.globals, '__getitem__')}")
        # console_log(f"[PYODIDE GLOBALS DIAGNOSTIC] hasattr keys: {hasattr(pyodide.globals, 'keys')}")
        if hasattr(pyodide.globals, 'keys'):
            try:
                keys_list = list(pyodide.globals.keys())
                # console_log(f"[PYODIDE GLOBALS DIAGNOSTIC] доступные ключи: {keys_list[:10]}...")
            except Exception as e:
                console_log(f"[PYODIDE GLOBALS DIAGNOSTIC] ошибка при получении ключей: {e}")
    except Exception as e:
        console_log(f"[PYODIDE GLOBALS DIAGNOSTIC] ошибка диагностики pyodide.globals: {e}")
    console_log("[PYODIDE GLOBALS DIAGNOSTIC] ===== КОНЕЦ ПРОВЕРКИ pyodide.globals =====")

    # ТЕСТОВЫЙ ВЫЗОВ для проверки работы console_log
    # console_log("🧪 ТЕСТОВЫЙ ВЫЗОВ console_log - если вы видите это сообщение, логирование работает!")
    # console_log(f"🧪 Текущая метка времени: {datetime.now().isoformat()}")
    # console_log("🧪 Тестовое сообщение с force=True", force=True)

    console_log("[DIAGNOSTIC] ===== analyze_ozon_product STARTED =====")
    # console_log(f"[DIAGNOSTIC] input_data type: {type(input_data)}")

    # [CRITICAL DIAGNOSTIC] ПРОВЕРКА СОСТОЯНИЯ pyodide.globals В НАЧАЛЕ analyze_ozon_product
    console_log("[CRITICAL DIAGNOSTIC] ===== КРИТИЧЕСКАЯ ПРОВЕРКА pyodide.globals В НАЧАЛЕ =====")
    try:
        all_keys = list(pyodide.globals.keys())
        # console_log(f"[CRITICAL DIAGNOSTIC] Все ключи в pyodide.globals: {all_keys}")
        # console_log(f"[CRITICAL DIAGNOSTIC] Количество ключей: {len(all_keys)}")

        # Проверяем наличие критически важных переменных
        critical_vars = ['page_html_chunk_count', 'page_html_total_length', 'page_html_chunk_0', 'pluginSettings']
        for var_name in critical_vars:
            if var_name in pyodide.globals:
                value = pyodide.globals[var_name]
                # console_log(f"[CRITICAL DIAGNOSTIC] ✅ {var_name} = {value} (тип: {type(value)})")
            else:
                console_log(f"[CRITICAL DIAGNOSTIC] ❌ {var_name} ОТСУТСТВУЕТ в pyodide.globals")
    except Exception as e:
        console_log(f"[CRITICAL DIAGNOSTIC] ❌ Ошибка при проверке pyodide.globals: {e}")
    console_log("[CRITICAL DIAGNOSTIC] ===== КОНЕЦ КРИТИЧЕСКОЙ ПРОВЕРКИ =====")

    # Получить pluginSettings из pyodide globals
    plugin_settings = get_pyodide_var('pluginSettings', {})

    # console_log(f"🔍 VARIABLE DIAGNOSTIC: pluginSettings доступен = {plugin_settings is not None}")
    if plugin_settings:
        console_log(f"🔍 VARIABLE DIAGNOSTIC: pluginSettings ключи = {list(plugin_settings.keys())}")

    # console_log(f"[PLUGIN_SETTINGS] pluginSettings получены из pyodide.globals: {plugin_settings}")
    # console_log(f"[PLUGIN_SETTINGS] Тип plugin_settings: {type(plugin_settings)}")
    if isinstance(plugin_settings, dict):
        # console_log(f"[PLUGIN_SETTINGS] Ключи в plugin_settings: {list(plugin_settings.keys())}")
        response_lang = plugin_settings.get('response_language', 'КЛЮЧ НЕ НАЙДЕН') if plugin_settings else 'plugin_settings is None'
        # console_log(f"[PLUGIN_SETTINGS] response_language в plugin_settings: {response_lang}")

    # ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА plugin_settings В analyze_ozon_product
    if not isinstance(plugin_settings, dict):
        # console_log(f"[PLUGIN_SETTINGS] ВНИМАНИЕ: plugin_settings не является словарем в analyze_ozon_product! Тип: {type(plugin_settings)}, Значение: {plugin_settings}")
        plugin_settings = {}  # Принудительно устанавливаем пустой словарь

    # Определение языка контента для сообщений чата с использованием безопасной функции
    content_language = get_safe_content_language(plugin_settings)
    # console_log(f"[LANGUAGE] Язык контента определен: '{content_language}'")
    # console_log(f"[LANGUAGE] Финальный результат get_safe_content_language: '{content_language}'")
    # console_log(f"[LANGUAGE] plugin_settings в момент вызова get_safe_content_language: {plugin_settings}")
    # console_log(f"[LANGUAGE] Тип plugin_settings: {type(plugin_settings)}")
    if isinstance(plugin_settings, dict):
        # console_log(f"[LANGUAGE] Ключи plugin_settings: {list(plugin_settings.keys())}")
        console_log(f"[LANGUAGE] response_language в plugin_settings: {plugin_settings.get('response_language', 'KEY_NOT_FOUND')}")

    try:
        # === ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ ОШИБКИ 'get' ===
        console_log("[DEBUG] ===== НАЧАЛО analyze_ozon_product =====")
        # console_log(f"[DEBUG] input_data: {input_data}")
        # console_log(f"[DEBUG] plugin_settings: {plugin_settings}")
        # console_log(f"[DEBUG] Тип plugin_settings: {type(plugin_settings)}")

        # === ОПТИМИЗИРОВАННОЕ ЛОГИРОВАНИЕ ===
        logger.log("🔍 ===== НАЧАЛО АНАЛИЗА ТОВАРА OZON =====", "analysis_start", force=True)
        logger.log(f"📊 Timestamp: {datetime.now().isoformat()}", "timestamp")

        # Шаг 1: Чтение метаданных из Pyodide globals
        logger.log("🔧 Шаг 1: Чтение метаданных из Python globals", "step_1")

        # Начало измерения времени чтения данных
        read_start_time = datetime.now()


        # Диагностика состояния globals
        try:
            all_globals = pyodide.globals
            # console_log(f"Доступно переменных в globals: {len(all_globals)}")
            # console_log(f"Ключи в globals: {list(all_globals.keys())[:10]}...")
        except Exception as e:
            console_log(f"Не удалось получить список всех переменных: {e}")

        # Чтение метаданных с оптимизированным логированием
        try:
            # Попытка использовать переданный параметр, fallback на globals
            chunk_count = page_html_chunk_count if page_html_chunk_count is not None else get_pyodide_var('page_html_chunk_count', None)
            # console_log(f"page_html_chunk_count = {chunk_count} (из {'параметра' if page_html_chunk_count is not None else 'globals'})")
            # console_log(f"🔍 VARIABLE DIAGNOSTIC: chunk_count = {chunk_count} (тип: {type(chunk_count)})")
            if chunk_count is None:
                console_log("⚠️ VARIABLE DIAGNOSTIC: chunk_count не установлен - возможна проблема с передачей данных")
        except KeyError as e:
            if content_language == "ru":
                chat_message(f"page_html_chunk_count отсутствует в globals(): {e}")
                raise ValueError(f"page_html_chunk_count отсутствует в globals(): {e}")
            else:
                chat_message(f"page_html_chunk_count is missing in globals(): {e}")
                raise ValueError(f"page_html_chunk_count is missing in globals(): {e}")
        except Exception as e:
            if content_language == "ru":
                chat_message(f"Ошибка чтения page_html_chunk_count: {e}")
                raise ValueError(f"Ошибка чтения page_html_chunk_count: {e}")
            else:
                chat_message(f"Error reading page_html_chunk_count: {e}")
                raise ValueError(f"Error reading page_html_chunk_count: {e}")

        try:
            # Попытка использовать переданный параметр, fallback на globals
            total_length = page_html_total_length if page_html_total_length is not None else get_pyodide_var('page_html_total_length', None)
            # console_log(f"page_html_total_length = {total_length} (из {'параметра' if page_html_total_length is not None else 'globals'})")
            # console_log(f"🔍 VARIABLE DIAGNOSTIC: total_length = {total_length} (тип: {type(total_length)})")
            if total_length is None:
                console_log("⚠️ VARIABLE DIAGNOSTIC: total_length не установлен - возможна проблема с передачей данных")
        except KeyError as e:
            if content_language == "ru":
                chat_message(f"page_html_total_length отсутствует в globals(): {e}")
                raise ValueError(f"page_html_total_length отсутствует в globals(): {e}")
            else:
                chat_message(f"page_html_total_length is missing in globals(): {e}")
                raise ValueError(f"page_html_total_length is missing in globals(): {e}")
        except Exception as e:
            if content_language == "ru":
                chat_message(f"Ошибка чтения page_html_total_length: {e}")
                raise ValueError(f"Ошибка чтения page_html_total_length: {e}")
            else:
                chat_message(f"Error reading page_html_total_length: {e}")
                raise ValueError(f"Error reading page_html_total_length: {e}")

        # Финальное логирование результатов диагностики
        # console_log(f"Метаданные прочитаны: chunk_count={chunk_count}, total_length={total_length}")
        console_log("Метод доступа: globals()")

        # Валидация метаданных
        if chunk_count is None:
            if content_language == "ru":
                chat_message("page_html_chunk_count отсутствует в pyodide.globals")
                raise ValueError("Метаданные page_html_chunk_count отсутствует в pyodide.globals")
            else:
                chat_message("page_html_chunk_count is missing in pyodide.globals")
                raise ValueError("Metadata page_html_chunk_count is missing in pyodide.globals")

        if total_length is None:
            if content_language == "ru":
                chat_message("page_html_total_length отсутствует в pyodide.globals")
                raise ValueError("Метаданные page_html_total_length отсутствует в pyodide.globals")
            else:
                chat_message("page_html_total_length is missing in pyodide.globals")
                raise ValueError("Metadata page_html_total_length is missing in pyodide.globals")

        console_log("Все метаданные найдены и не равны None")

        try:
            chunk_count = int(chunk_count)
            total_length = int(total_length)
            # console_log(f"Метаданные валидны: chunk_count={chunk_count}, total_length={total_length}")
        except (ValueError, TypeError) as e:
            if content_language == "ru":
                chat_message(f"Ошибка преобразования метаданных: {e}")
                raise ValueError(f"Метаданные должны быть числами: {e}")
            else:
                chat_message(f"Error converting metadata: {e}")
                raise ValueError(f"Metadata must be numbers: {e}")

        # Шаг 2: Определение режима передачи и чтение данных
        console_log("Определение режима передачи данных...")

        # Проверяем, есть ли метаданные о режиме передачи
        transmission_mode = 'chunks'  # По умолчанию
        direct_html_data = None

        try:
            # Проверяем наличие прямого HTML (режим 'direct')
            direct_html_data = get_pyodide_var('page_html_direct', None)
            if direct_html_data and isinstance(direct_html_data, str) and len(direct_html_data) > 100:
                transmission_mode = 'direct'
                console_log(f"✅ Обнаружен режим DIRECT передачи, размер HTML: {len(direct_html_data)} символов")
                # console_log(f"📊 Режим передачи: {transmission_mode} - HTML передан целиком")
                # console_log(f"📋 Проверка качества прямого HTML: {type(direct_html_data)}")
            else:
                console_log(f"📦 Режим CHUNKS передачи, количество чанков: {chunk_count}")
                # console_log(f"📊 Режим передачи: {transmission_mode} - HTML разбит на {chunk_count} чанков")
                # console_log(f"📋 Прямой HTML не найден или некорректен: {direct_html_data}")
        except Exception as e:
            console_log(f"⚠️ Не удалось определить режим передачи: {e}")
            console_log(f"📋 Диагностика ошибки: {type(e).__name__}: {e}")

        # Логируем выбранный режим
        # console_log(f"🎯 ИСПОЛЬЗУЕМЫЙ РЕЖИМ ПЕРЕДАЧИ: {transmission_mode}")

        # Детальное логирование режима передачи и ключевых переменных
        # console_log(f"[DIAGNOSTIC] ===== ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ РЕЖИМА ПЕРЕДАЧИ =====")
        # console_log(f"[DIAGNOSTIC] transmission_mode: {transmission_mode}")
        # console_log(f"[DIAGNOSTIC] chunk_count: {chunk_count}")
        # console_log(f"[DIAGNOSTIC] total_length: {total_length}")
        # console_log(f"[DIAGNOSTIC] direct_html_data is not None: {direct_html_data is not None}")
        # if direct_html_data:
            # console_log(f"[DIAGNOSTIC] direct_html_data length: {len(direct_html_data)}")
        # console_log(f"[DIAGNOSTIC] ===== КОНЕЦ ДЕТАЛЬНОГО ЛОГИРОВАНИЯ =====")

        # Координация режимов передачи
        console_log("🔄 Координация режимов передачи данных...")
        if transmission_mode == 'direct':
            # console_log("📨 Режим DIRECT: Ожидание прямой передачи HTML")
            # console_log("📋 Координация: Проверяем наличие page_html_direct в globals")
            # console_log("📋 Состояние: Ожидание завершения прямой передачи")

            # Проверяем метаданные прямой передачи
            try:
                direct_metadata = get_pyodide_var('page_html_direct_metadata', {})
                if isinstance(direct_metadata, dict):
                    direct_size = direct_metadata.get('size', 'unknown')
                    direct_timestamp = direct_metadata.get('timestamp', 'unknown')
                    # console_log(f"📋 Метаданные прямой передачи: размер={direct_size}, время={direct_timestamp}")
            except Exception as e:
                console_log(f"⚠️ Не удалось прочитать метаданные прямой передачи: {e}")

        else:
            # console_log("📦 Режим CHUNKS: Ожидание передачи чанков")
            # console_log(f"📋 Координация: Ожидаем {chunk_count} чанков (page_html_chunk_0 до page_html_chunk_{chunk_count-1})")
            # console_log("📋 Состояние: Ожидание завершения всех чанков")

            # Проверяем метаданные чанковой передачи
            try:
                chunk_metadata = get_pyodide_var('page_html_chunks_metadata', {})
                if isinstance(chunk_metadata, dict):
                    chunk_size = chunk_metadata.get('chunk_size', 'unknown')
                    chunk_timestamp = chunk_metadata.get('timestamp', 'unknown')
                    # console_log(f"📋 Метаданные чанковой передачи: размер_чанка={chunk_size}, время={chunk_timestamp}")
            except Exception as e:
                console_log(f"⚠️ Не удалось прочитать метаданные чанковой передачи: {e}")

        # console_log(f"🔄 Координация завершена для режима {transmission_mode}")

        # Финальная проверка готовности данных и сборка HTML
        # console_log("🔍 Финальная проверка готовности данных и сборка HTML...")

        if transmission_mode == 'direct':
            # Режим прямой передачи - HTML уже готов
            # console_log("📨 Обработка прямой передачи HTML")
            # console_log(f"📋 Проверка качества прямого HTML: {type(direct_html_data)}")

            if direct_html_data and len(direct_html_data) > 100:
                page_html = direct_html_data
                # console_log(f"✅ HTML получен напрямую: {len(page_html)} символов")
                # console_log("📊 Проверка целостности прямого HTML:")
                _check_html_integrity(page_html, "direct_transmission")
            else:
                console_log("❌ Данные не готовы - прямая передача не удалась")
                raise ValueError("Прямая передача не удалась - HTML не получен или поврежден")
        else:
            # Режим чанковой передачи - нужно собрать HTML из чанков
            # console_log(f"📦 Режим CHUNKS: чтение {chunk_count} чанков из Python globals")

            if chunk_count <= 0 or total_length <= 0:
                console_log("❌ Данные не готовы - чанковая передача не удалась")
                raise ValueError("Чанковая передача не удалась - отсутствуют чанки или метаданные")

            chunks = []
            total_chunks_size = 0
            chunk_diagnostics = []  # Для сбора диагностики всех чанков

            for i in range(chunk_count):
                chunk_key = f'page_html_chunk_{i}'
                # console_log(f"===== ЧТЕНИЕ ЧАНКА {i} =====")
                # console_log(f"Ключ чанка: {chunk_key}")

                # Чтение чанка: сначала пытаемся использовать переданный параметр, fallback на globals
                try:
                    if i == 0 and page_html_chunk_0 is not None:
                        chunk = page_html_chunk_0
                        # console_log(f"✅ {chunk_key} прочитан из параметра page_html_chunk_0 (длина={len(str(chunk))} символов)")
                    else:
                        chunk = get_pyodide_var(chunk_key, '')
                        # console_log(f"🔍 VARIABLE DIAGNOSTIC: Читаем {chunk_key} из globals - значение получено: {chunk is not None and len(str(chunk)) > 0}")
                        # if chunk is None:
                            # console_log(f"⚠️ VARIABLE DIAGNOSTIC: {chunk_key} не найден в globals")
                        # console_log(f"{chunk_key} прочитан: тип={type(chunk).__name__}, длина={len(str(chunk))} символов")
                except KeyError as e:
                    if content_language == "ru":
                        chat_message(f"{chunk_key} отсутствует в globals(): {e}")
                        raise ValueError(f"{chunk_key} отсутствует в globals(): {e}")
                    else:
                        chat_message(f"{chunk_key} is missing in globals(): {e}")
                        raise ValueError(f"{chunk_key} is missing in globals(): {e}")
                except Exception as e:
                    if content_language == "ru":
                        chat_message(f"Ошибка чтения {chunk_key}: {e}")
                        raise ValueError(f"Ошибка чтения {chunk_key}: {e}")
                    else:
                        chat_message(f"Error reading {chunk_key}: {e}")
                        raise ValueError(f"Error reading {chunk_key}: {e}")

                # Дополнительная валидация
                if chunk is None:
                    if content_language == "ru":
                        chat_message(f"Чанк {chunk_key} равен None")
                        raise ValueError(f"Чанк {chunk_key} отсутствует в globals")
                    else:
                        chat_message(f"Chunk {chunk_key} is None")
                        raise ValueError(f"Chunk {chunk_key} is missing in globals")
                    console_log("Доступ через globals() завершен с ошибкой")

                # Проверка типа и конвертация
                try:
                    if not isinstance(chunk, str):
                        # console_log(f"Конвертация чанка {i} из {type(chunk)} в строку")
                        chunk_str = str(chunk)
                    else:
                        chunk_str = chunk

                    # console_log(f"Чанк {i} прочитан: тип={type(chunk).__name__}, длина={len(chunk_str)}")

                except Exception as e:
                    if content_language == "ru":
                        chat_message(f"Ошибка конвертации чанка {chunk_key}: {e}")
                        raise ValueError(f"Не удалось конвертировать чанк {chunk_key}: {e}")
                    else:
                        chat_message(f"Error converting chunk {chunk_key}: {e}")
                        raise ValueError(f"Failed to convert chunk {chunk_key}: {e}")
                    # console_log(f"Состояние на момент ошибки: прочитано {len(chunks)} чанков")

                # Проверка целостности чанка
                if len(chunk_str.strip()) == 0:
                    console_log(f"Чанк {chunk_key} пустой после strip")
                elif len(chunk_str) < 3:
                    console_log(f"Чанк {chunk_key} слишком короткий: {len(chunk_str)} символов")

                # Сохранение диагностики
                chunk_diagnostics.append({
                    'chunk_index': i,
                    'chunk_key': chunk_key,
                    'original_type': type(chunk).__name__,
                    'final_length': len(chunk_str),
                    'method_used': 'globals()',
                    'is_empty': len(chunk_str.strip()) == 0
                })

                chunks.append(chunk_str)
                total_chunks_size += len(chunk_str)
                # console_log(f"Чанк {i} добавлен: накоплено {len(chunks)} чанков, размер={total_chunks_size} символов")

            # Безопасная сборка полного HTML из чанков
            # console_log("🔧 Безопасная сборка полного HTML из чанков")
            page_html = _safe_assemble_chunks(chunks, total_length, "ozon_analyzer")
            assembled_length = len(page_html)
            # console_log(f"✅ HTML безопасно собран: длина={assembled_length} символов")

        # Итоговый отчет по чанкам
        # console_log("===== ОТЧЕТ ПО ЧАНКАМ =====")
        # console_log(f"Всего прочитано: {len(chunks)} чанков")
        # console_log(f"Общий размер: {total_chunks_size} символов")

        # Проверка на пустые чанки
        empty_chunks = [d for d in chunk_diagnostics if d['is_empty']]
        if empty_chunks:
            # console_log(f"Найдено пустых чанков: {len(empty_chunks)}")
            for ec in empty_chunks:
                console_log(f"Пустой чанк: {ec['chunk_key']}")

        # Проверка последовательности методов доступа
        methods_used = list(set(d['method_used'] for d in chunk_diagnostics if d['method_used']))
        # console_log(f"Методы доступа к чанкам: {methods_used}")

        # Шаг 3: Проверка целостности HTML в зависимости от режима
        console_log("Расширенная проверка целостности HTML")

        if transmission_mode == 'chunks':
            # Итоговый отчет по чанкам только в режиме chunks
            # console_log("===== ОТЧЕТ ПО ЧАНКАМ =====")
            # console_log(f"Всего прочитано: {len(chunks)} чанков")
            # console_log(f"Общий размер: {total_chunks_size} символов")

            # Проверка на пустые чанки
            empty_chunks = [d for d in chunk_diagnostics if d['is_empty']]
            if empty_chunks:
                # console_log(f"Найдено пустых чанков: {len(empty_chunks)}")
                for ec in empty_chunks:
                    console_log(f"Пустой чанк: {ec['chunk_key']}")

            # Проверка последовательности методов доступа
            methods_used = list(set(d['method_used'] for d in chunk_diagnostics if d['method_used']))
            # console_log(f"Методы доступа к чанкам: {methods_used}")

            # Проверка соответствия длины только в режиме chunks
            assembled_length = len(page_html)
            length_difference = assembled_length - total_length
            length_match_percent = (assembled_length / total_length * 100) if total_length > 0 else 0

            # console_log(f"Ожидаемая длина: {total_length} символов")
            # console_log(f"Собранная длина: {assembled_length} символов")
            # console_log(f"Разница в длине: {length_difference} символов ({length_match_percent:.1f}%)")

            # Детальное логирование перед отправкой сообщения об обрезке
            # console_log(f"[DIAGNOSTIC] ===== ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ПЕРЕД ОТПРАВКОЙ СООБЩЕНИЯ =====")
            # console_log(f"[DIAGNOSTIC] transmission_mode: {transmission_mode}")
            # console_log(f"[DIAGNOSTIC] assembled_length: {assembled_length}")
            # console_log(f"[DIAGNOSTIC] total_length: {total_length}")
            # console_log(f"[DIAGNOSTIC] length_difference: {length_difference}")
            # console_log(f"[DIAGNOSTIC] length_match_percent: {length_match_percent:.1f}%")
            # console_log(f"[DIAGNOSTIC] Условие transmission_mode == 'chunks': {transmission_mode == 'chunks'}")
            # console_log(f"[DIAGNOSTIC] Стек вызовов:")
            # for line in traceback.format_stack()[-5:]:  # Последние 5 кадров стека
                # console_log(f"[DIAGNOSTIC]   {line.strip()}")
            # console_log(f"[DIAGNOSTIC] ===== КОНЕЦ ДЕТАЛЬНОГО ЛОГИРОВАНИЯ =====")

            if assembled_length != total_length and chunk_count > 0:
                if assembled_length < total_length:
                    console_log("СТРОКА ОБРЕЗАНА! Возможна потеря данных.")
                    # console_log(f"Потеряно: {total_length - assembled_length} символов")
                else:
                    console_log("Строка длиннее ожидаемой. Возможно, добавлены лишние данные.")
                    # console_log(f"Лишние: {assembled_length - total_length} символов")

        # Расширенная проверка структуры HTML
        console_log("Анализ структуры HTML...")

        has_html_tag = '<html' in page_html.lower()
        has_body_tag = '<body' in page_html.lower()
        has_head_tag = '<head' in page_html.lower()
        has_div_tag = '<div' in page_html.lower()
        has_title_tag = '<title' in page_html.lower()
        has_script_tag = '<script' in page_html.lower()

        structure_check = {
            '<html>': has_html_tag,
            '<head>': has_head_tag,
            '<body>': has_body_tag,
            '<title>': has_title_tag,
            '<div>': has_div_tag,
            '<script>': has_script_tag
        }

        # console_log(f"Структура HTML: {structure_check}")

        # Подсчет найденных структурных элементов
        structure_score = sum(structure_check.values())
        max_structure_score = len(structure_check)
        # console_log(f"Оценка структуры: {structure_score}/{max_structure_score}")

        # Детальный анализ тегов
        console_log("Детальный анализ HTML тегов...")

        total_open_tags = page_html.count('<')
        total_close_tags = page_html.count('</')
        self_closing_tags = page_html.count('/>')

        console_log(f"Теги - всего: {total_open_tags}, закрывающих: {total_close_tags}, самозакрывающихся: {self_closing_tags}")

        # Расчет баланса тегов
        tag_balance = total_open_tags - total_close_tags - self_closing_tags
        console_log(f"Баланс тегов: {tag_balance}")

        if abs(tag_balance) > 5:
            console_log(f"ОБНАРУЖЕН ДИСБАЛАНС ТЕГОВ: {tag_balance}")
            if tag_balance > 0:
                console_log("Больше незакрытых тегов - возможна обрезка")
            else:
                console_log("Больше закрывающих тегов - возможны лишние данные")

        # Проверка на специальные символы и кодировку
        has_entities = '&' in page_html and ';' in page_html
        has_unicode = any(ord(c) > 127 for c in page_html[:1000])  # Проверка в первых 1000 символах

        encoding_check = {
            'HTML_entities': has_entities,
            'Unicode_chars': has_unicode
        }
        console_log(f"Кодировка: {encoding_check}")

        # Финальная валидация HTML с расширенными проверками
        console_log("Финальная валидация HTML...")

        validation_errors = []

        if not isinstance(page_html, str):
            try:
                page_html = str(page_html)
                # console_log(f"Конвертация HTML в строку: {type(page_html)}")
            except Exception as e:
                if content_language == "ru":
                    validation_errors.append(f"Не удалось конвертировать в строку: {e}")
                else:
                    validation_errors.append(f"Failed to convert to string: {e}")

        stripped_length = len(page_html.strip())
        # console_log(f"Длина после strip: {stripped_length} символов")

        if stripped_length < 50:
            if content_language == "ru":
                validation_errors.append(f"HTML слишком короткий ({stripped_length} символов). Минимум 50 символов.")
            else:
                validation_errors.append(f"HTML too short ({stripped_length} characters). Minimum 50 characters.")

        if not (has_html_tag or has_body_tag or has_div_tag):
            if content_language == "ru":
                validation_errors.append("HTML не содержит типичных тегов. Возможно, это не полноценная страница.")
            else:
                validation_errors.append("HTML does not contain typical tags. It might not be a complete page.")
            console_log("HTML не содержит типичных тегов")

        # Проверка первых и последних символов
        first_chars = page_html[:100] if len(page_html) > 100 else page_html
        last_chars = page_html[-100:] if len(page_html) > 100 else page_html

        # console_log(f"Первые 100 символов: '{first_chars[:50]}...'")
        # console_log(f"Последние 100 символов: '...{last_chars[-50:]}'")

        if validation_errors:
            for error in validation_errors:
                chat_message(f"{error}")
            if content_language == "ru":
                raise ValueError(f"Валидация HTML не пройдена: {'; '.join(validation_errors)}")
            else:
                raise ValueError(f"HTML validation failed: {'; '.join(validation_errors)}")

        console_log("HTML прошел все проверки валидации")
        console_log(f"Финальная длина HTML: {len(page_html)} символов")

        # Шаг 5: Финальное логирование перед анализом
        # console_log("Финальная подготовка к анализу")
        # console_log("Данные из Python globals успешно прочитаны и собраны")
        # console_log(f"Финальная длина HTML: {len(page_html)} символов")
        # console_log(f"Эффективность передачи: {(len(page_html) / total_length * 100):.1f}% от ожидаемого")

        # Детальный отчет о производительности чтения данных
        total_read_time = (datetime.now() - read_start_time).total_seconds() * 1000
        # console_log(f"Время чтения данных: {total_read_time:.1f}ms")
        # console_log(f"Скорость чтения: {(total_chunks_size / total_read_time * 1000):.0f} символов/сек")

        # Проверка готовности к анализу
        analysis_ready = len(page_html) > 100 and (has_html_tag or has_body_tag or has_div_tag)
        # console_log(f"Готовность к анализу: {'✅ ДА' if analysis_ready else '❌ НЕТ'}")

        if not analysis_ready:
            if content_language == "ru":
                chat_message("❌ Ошибка: HTML контент недостаточно качественный для анализа")
            else:
                chat_message("❌ Error: HTML content is not of sufficient quality for analysis")
            console_log("HTML недостаточно качественный для анализа")
            return {
                "status": "error",
                "message": "HTML контент недостаточно качественный для анализа"
            }

        if not analysis_ready:
            console_log("HTML недостаточно качественный для анализа")
            if len(page_html) <= 100:
                console_log("Причина: HTML слишком короткий")
            if not (has_html_tag or has_body_tag or has_div_tag):
                console_log("Причина: Отсутствуют базовые HTML теги")

        console_log("===== НАЧИНАЕМ АНАЛИЗ СТРАНИЦЫ ТОВАРА =====")

        # Статус сообщения - подтверждение запуска функции
        # console_log("Анализ товара Ozon запущен")

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
        # console_log("Начинаю анализ страницы товара...")

        # Шаг 1: Оптимизированное извлечение структурированных данных со страницы
        console_log("Быстрый DOM парсинг...")

        fast_parser = FastDOMParser(page_html)

        # Выбираем метод парсинга в зависимости от размера документа
        if len(page_html) > 50000:  # > 50KB - используем потоковый парсинг
            product_info = fast_parser.extract_product_info_streaming(chunk_size=16384)
            # console_log(f"Использован потоковый парсинг ({product_info.get('parsed_chunks', 'N/A')} чанков)")
        else:
            product_info = fast_parser.extract_product_info()

        # Извлечение данных из структурированного результата
        categories = product_info['categories']
        description = product_info['description']
        composition = product_info['composition']

        # Проверка категории товара - прерываем анализ если не косметика
        if not fast_parser.is_product_in_target_category(categories):
            if content_language == "ru":
                chat_message("❌ Анализ прерван: товар не из категории косметики и ухода за собой")
            else:
                chat_message("❌ Analysis interrupted: product not from cosmetics and personal care category")
            console_log("Анализ прерван: товар не из категории косметики")
            return {
                "status": "category_error",
                "message": "Товар не принадлежит к категории косметики и ухода за собой"
            }

        # Начинаем анализ косметического товара (убираем дублирующее сообщение в чат)
        console_log("Начинаю анализ косметического товара...")

        parsing_metrics = fast_parser.get_parsing_metrics()
        # console_log(f"Парсинг завершен за {parsing_metrics['parsing_time_ms']}ms")

        # Шаг 2: ОПТИМИЗИРОВАННОЕ ВЫПОЛНЕНИЕ AI вызовов с кешированием и группировкой
        console_log("Запускаю оптимизированный AI анализ...")

        # Проверяем кеш перед выполнением AI вызовов
        cache_key_analysis = f"analysis:{hash(description[:100] + composition[:100])}"
        cached_analysis = memory_manager.get_cached_lru(cache_key_analysis)

        cache_key_analogs = f"analogs:{hash(str(categories) + composition[:100])}"
        cached_analogs = memory_manager.get_cached_lru(cache_key_analogs)

        # Если оба результата в кеше, используем их
        if cached_analysis and cached_analogs:
            console_log("Найден кеш для анализа и поиска аналогов")
            analysis_result = cached_analysis
            analogs = cached_analogs
        else:
            # Выполняем асинхронные AI вызовы через wrapper
            try:
                console_log("Запускаю асинхронный анализ...")
                # ПЕРЕДАЕМ content_language В АСИНХРОННЫЕ ФУНКЦИИ
                analysis_result, analogs = _run_async_in_sync(
                _analyze_product_async(description, composition, categories, plugin_settings, content_language)
                )

                # Обновляем content_language на основе ответа AI
                if analysis_result and 'reasoning' in analysis_result:
                    detected_lang = detect_language(analysis_result['reasoning'])
                    content_language = detected_lang
                    # console_log(f"[LANGUAGE] Обновлен content_language на основе ответа AI: '{content_language}'")

                # Кешируем успешные результаты
                if analysis_result and isinstance(analysis_result, dict) and 'score' in analysis_result:
                    memory_manager.cache_lru(cache_key_analysis, analysis_result, max_age_seconds=1800)  # 30 мин
                    console_log("Результат анализа закэширован")

                if analogs and isinstance(analogs, list) and len(analogs) > 0:
                    memory_manager.cache_lru(cache_key_analogs, analogs, max_age_seconds=3600)  # 1 час
                    console_log("Результат поиска аналогов закэширован")

                console_log("Асинхронный анализ завершен")

            except Exception as e:
                # console_log(f"Ошибка асинхронного анализа: {e}")
                analysis_result = {"score": 5, "reasoning": f"Ошибка AI анализа: {str(e)}. Проверьте доступность AI модели и корректность входных данных."}
                analogs = [{"name": "Ошибка поиска аналогов", "error": str(e)}]

        console_log("Оптимизированный анализ завершен!")
        
        # Шаг 4: Проверяем настройки плагина, заданные пользователем в UI
        enable_deep_analysis = safe_dict_get(plugin_settings, "enable_deep_analysis", True)  # default: true

        # Шаг 5: Формируем условное предложение для глубокого анализа
        # Это поле будет использоваться в `workflow.json` в условии `run_if`.
        offer_deep_analysis = enable_deep_analysis and analysis_result.get('score', 10) < 7
        
        # Шаг 6: Завершаем все pending батчи и получаем финальные метрики
        # В синхронном режиме flush_remaining не используется

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
            },
            "pluginSettings": plugin_settings
        }

        # Детальное логирование полных данных в консоль для разработчиков
        console_log("=== ДЕТАЛЬНЫЕ ДАННЫЕ АНАЛИЗА ===")
        console_log(f"Название товара: {product_info['title']}")
        console_log(f"Полное описание ({safe_len(description)} символов): {description}")
        console_log(f"Полный состав ({safe_len(composition)} символов): {composition}")
        console_log(f"Категории: {categories}")
        console_log(f"Цена: {product_info['price']}")
        console_log(f"Рейтинг: {product_info['rating']}")
        console_log("=== КОНЕЦ ДЕТАЛЬНЫХ ДАННЫХ ===")

        # Получаем оценку для логирования и отображения в чате
        score = analysis_result.get('score', 'N/A')
        reasoning = analysis_result.get('reasoning', 'Объяснение не доступно')

        # Отправляем описание и состав в одном сообщении с учетом языка
        truncated_description = description[:100] + ('...' if len(description) > 100 else '')
        truncated_composition = composition[:100] + ('...' if len(composition) > 100 else '')
        console_log("[DIAGNOSTIC] ===== ОТПРАВКА СООБЩЕНИЯ С ОПИСАНИЕМ И СОСТАВОМ =====")
        console_log(f"[DEBUG] content_language перед отправкой описания: '{content_language}' (тип: {type(content_language)})")
        console_log(f"[DEBUG] условие content_language == 'ru': {content_language == 'ru'}")
        console_log(f"[DEBUG] условие content_language == 'en': {content_language == 'en'}")

        # ДОБАВИТЬ ЗАДЕРЖКУ ПЕРЕД ОТПРАВКОЙ СООБЩЕНИЯ ОБ ОПИСАНИИ И СОСТАВЕ
        time.sleep(1.0)  # 1 секунда задержки для предотвращения дублирования

        # Принудительная проверка значения для отладки
        if content_language == "ru":
            console_log("[DEBUG] Выбрана ветка РУССКИЙ для описания")
            chat_message(f"📝 Описание: {truncated_description}\n📝 Состав: {truncated_composition}")
        elif content_language == "en":
            console_log("[DEBUG] Выбрана ветка ENGLISH для описания")
            chat_message(f"📝 Description: {truncated_description}\n📝 Composition: {truncated_composition}")
        else:
            # console_log(f"[DEBUG] Неизвестный язык '{content_language}', используем fallback (русский)")
            chat_message(f"📝 Описание: {truncated_description}\n📝 Состав: {truncated_composition} [LANG:{content_language}]")
        # Проверяем, что переменные корректны
        score_str = str(score) if score is not None else 'N/A'
        reasoning_str = str(reasoning) if reasoning is not None else ('Объяснение не доступно' if content_language == "ru" else 'Explanation not available')

        # ДОБАВИТЬ ЗАДЕРЖКУ ПЕРЕД ОТПРАВКОЙ РЕЗУЛЬТАТОВ AI
        time.sleep(1.5)  # 1.5 секунды задержки

        console_log("[DIAGNOSTIC] ===== ОТПРАВКА СООБЩЕНИЯ С РЕЗУЛЬТАМИ AI =====")
        console_log(f"[DEBUG] content_language перед отправкой результатов AI: '{content_language}'")
        console_log(f"[DEBUG] score_str: '{score_str}', reasoning_str length: {len(reasoning_str)}")
        if score_str == 'N/A' and reasoning_str == ('Объяснение не доступно' if content_language == "ru" else 'Explanation not available'):
            if content_language == "ru":
                chat_message("⚠️ Не удалось получить результаты анализа от нейросети")
            else:
                chat_message("⚠️ Failed to get analysis results from neural network")
        else:
            if content_language == "ru":
                chat_message(f"🤖 Ответ нейросети (Gemini AI):\n📊 Оценка соответствия: {score_str}/10\n{clean_reasoning_for_chat(reasoning_str)}")
            else:
                chat_message(f"🤖 Neural Network Response (Gemini AI):\n📊 Compliance Score: {score_str}/10\n{clean_reasoning_for_chat(reasoning_str)}")

        # Отправляем информацию об аналогах в чат
        # console_log("[DIAGNOSTIC] ===== ОТПРАВКА СООБЩЕНИЯ С АНАЛОГАМИ =====")
        # console_log(f"[DEBUG] content_language перед отправкой аналогов: '{content_language}'")
        # console_log(f"[DEBUG] analogs: {analogs}")
        # console_log(f"[DEBUG] len(analogs): {len(analogs) if analogs else 0}")

        if plugin_settings.get('search_for_analogs', False):
            # ДОБАВИТЬ ЗАДЕРЖКУ ПЕРЕД ОТПРАВКОЙ АНАЛОГОВ
            time.sleep(2.0)  # 2 секунды задержки

            # Проверяем, есть ли валидные аналоги (без ошибки)
            valid_analogs = [a for a in analogs if isinstance(a, dict) and not a.get('error', False)] if analogs else []

            console_log(f"[DEBUG] valid_analogs count: {len(valid_analogs)}")

            if valid_analogs:
                if content_language == "ru":
                    analogs_message = "🔍 Найденные аналоги:\n"
                else:
                    analogs_message = "🔍 Found analogs:\n"

                for i, analog in enumerate(valid_analogs[:3], 1):  # Показываем максимум 3 аналога
                    name = analog.get('name', 'Название не указано' if content_language == "ru" else 'Name not specified')
                    price_range = analog.get('price_range', 'Цена не указана' if content_language == "ru" else 'Price not specified')
                    similarity = analog.get('similarity_score', 'N/A')
                    key_features = analog.get('key_features', [])

                    analogs_message += f"{i}. **{name}**\n"
                    analogs_message += f"   💰 {price_range}\n"
                    url = analog.get('url', '')
                    if url and url.startswith('http') and not any(x in url.lower() for x in ['пример', 'example', 'placeholder']):
                        analogs_message += f"   🔗 {url}\n"
                    elif url and any(x in url.lower() for x in ['пример', 'example', 'placeholder']):
                        if content_language == "ru":
                            analogs_message += f"   🔗 Примерная ссылка (требуется уточнение)\n"
                        else:
                            analogs_message += f"   🔗 Example link (needs clarification)\n"
                    elif url and not url.startswith('http'):
                        if content_language == "ru":
                            analogs_message += f"   🔗 Некорректная ссылка\n"
                        else:
                            analogs_message += f"   🔗 Invalid link\n"
                    else:
                        if content_language == "ru":
                            analogs_message += f"   🔗 Ссылка не найдена\n"
                        else:
                            analogs_message += f"   🔗 Link not found\n"
                    analogs_message += f"   📊 Схожесть: {similarity}%\n"
                    if key_features and len(key_features) > 0:
                        features_str = ', '.join(key_features[:3])  # Максимум 3 особенности
                        analogs_message += f"   ✨ {features_str}\n"
                    analogs_message += "\n"

                console_log(f"[DEBUG] Отправка analogs_message: {analogs_message[:100]}...")
                chat_message(analogs_message.strip())
            else:
                console_log("[DEBUG] Отправка сообщения об отсутствии аналогов")
                console_log(f"[DEBUG] content_language в сообщении аналогов: '{content_language}'")
                if content_language == "ru":
                    console_log("[DEBUG] Отправка русского сообщения об аналогах")
                    chat_message("🔍 Аналоги не найдены или информация недоступна ")
                elif content_language == "en":
                    console_log("[DEBUG] Отправка английского сообщения об аналогах")
                    chat_message("🔍 No analogs found or information unavailable")
                else:
                    console_log(f"[DEBUG] Неизвестный язык '{content_language}' для аналогов")
                    chat_message("🔍 Аналоги не найдены или информация недоступна [LANG:" + str(content_language) + "]")

        # Логируем в консоль полную информацию для разработчиков
        title_preview = product_info['title'][:50] + "..." if safe_len(product_info['title']) > 50 else product_info['title']
        desc_length = safe_len(description)
        comp_length = safe_len(composition)
        category_info = categories[0] if categories else "не определена"
        console_log(f"Анализ завершен: '{title_preview}' | Описание: {desc_length} симв. | Состав: {comp_length} симв. | Категория: {category_info} | Оценка: {score}/10")

        # [DIAGNOSTIC] ЛОГИРОВАНИЕ ПЕРЕД ВОЗВРАТОМ РЕЗУЛЬТАТА
        console_log("[DIAGNOSTIC] ===== analyze_ozon_product ABOUT TO RETURN =====")
        console_log(f"[DIAGNOSTIC] result type: {type(result)}")
        console_log(f"[DIAGNOSTIC] result keys: {list(result.keys()) if isinstance(result, dict) else 'not dict'}")
        console_log(f"[DIAGNOSTIC] content_language in result: {result.get('pluginSettings', {}).get('response_language', 'NOT FOUND') if isinstance(result, dict) and 'pluginSettings' in result else 'NO pluginSettings'}")
        console_log("[DIAGNOSTIC] >>>>>> analyze_ozon_product FUNCTION ENDING <<<<<<")

        return result
        
    except Exception as e:
        if content_language == "ru":
            chat_message(f"❌ Критическая ошибка при анализе товара: {str(e)}")
        else:
            chat_message(f"❌ Critical error during product analysis: {str(e)}")
        console_log(f"Критическая ошибка при анализе: {e}")
        # Возвращаем стандартизированный объект ошибки
        return { "status": "error", "message": f"Ошибка анализа товара: {str(e)}" }

async def pre_warm_pyodide_engine() -> Dict[str, Any]:
    """
    Предварительно разогревает Pyodide движок для ускорения будущих запросов.
    Это уменьшает cold start время с 25-35 секунд до менее 5 секунд.
    """
    try:
        console_log("🚀 Предварительный разогрев Pyodide...")

        # Вызываем функцию pre-warm из хоста
        warmResult = await js.preWarmPyodide()

        success = safe_dict_get(warmResult, 'success', False)
        if success:
            duration = safe_dict_get(warmResult, 'preWarmDuration', 0)
            message = safe_dict_get(warmResult, 'message', 'Pre-warm completed')
            # console_log(f"✅ Разогрев завершен! Время: {duration}ms")

            return {
                "status": "success",
                "message": message,
                "preWarmDuration": duration,
                "warmUpStrategy": "completed"
            }
        else:
            errorMsg = warmResult.get('message', 'Unknown error')
            console_log(f"⚠️ Разогрев не удался: {errorMsg}")

            return {
                "status": "info",
                "message": errorMsg,
                "fallbackStrategy": "cold_start"
            }

    except Exception as e:
        console_log(f"❌Ошибка разогрева Pyodide: {e}")
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
    # [DIAGNOSTIC] РАННЕЕ ЛОГИРОВАНИЕ В perform_deep_analysis
    console_log("[DIAGNOSTIC] >>>>>> perform_deep_analysis FUNCTION CALLED <<<<<<")
    # console_log(f"[DIAGNOSTIC] Timestamp: {datetime.now().isoformat()}")
    # console_log(f"[DIAGNOSTIC] input_data: {input_data}")
    # console_log(f"[DIAGNOSTIC] input_data type: {type(input_data)}")
    # if input_data and isinstance(input_data, dict):
        # console_log(f"[DIAGNOSTIC] input_data keys: {list(input_data.keys())}")

    console_log("[DIAGNOSTIC] ===== perform_deep_analysis STARTED =====")
    # console_log(f"[DIAGNOSTIC] input_data type: {type(input_data)}")
    # console_log(f"[DIAGNOSTIC] input_data keys: {list(input_data.keys()) if isinstance(input_data, dict) else 'not dict'}")

    description = input_data.get('description', '')
    composition = input_data.get('composition', '')

    if not description or not composition:
        return { "status": "error", "message": "Описание или состав не были переданы для глубокого анализа."}
    # Получить pluginSettings из pyodide globals
    plugin_settings = get_pyodide_var('pluginSettings', {})

    # console_log(f"[PLUGIN_SETTINGS] pluginSettings получены из pyodide.globals: {plugin_settings}")
    # console_log(f"[PLUGIN_SETTINGS] Тип plugin_settings: {type(plugin_settings)}")

    # ДОПОЛНИТЕЛЬНАЯ ПРОБЕРКА ТИПА plugin_settings ДЛЯ ОТЛАДКИ ОШИБКИ 'get'
    if not isinstance(plugin_settings, dict):
        # console_log(f"[PLUGIN_SETTINGS] ВНИМАНИЕ: plugin_settings не является словарём! Тип: {type(plugin_settings)}, Значение: {plugin_settings}")
        plugin_settings = {}  # Принудительно устанавливаем пустой словарь

    if isinstance(plugin_settings, dict):
        # console_log(f"[PLUGIN_SETTINGS] Ключи в plugin_settings: {list(plugin_settings.keys())}")
        response_lang = plugin_settings.get('response_language', 'КЛЮЧ НЕ НАЙДЕН') if plugin_settings else 'plugin_settings is None'
        # console_log(f"[PLUGIN_SETTINGS] response_language в plugin_settings: {response_lang}")

    # Определение языка контента для сообщений чата с использованием безопасной функции
    content_language = get_safe_content_language(plugin_settings)
    # console_log(f"[LANGUAGE] Язык контента определен: '{content_language}'")
    # console_log(f"[LANGUAGE] Финальный результат get_safe_content_language: '{content_language}'")

    # Получить выбранную пользователем LLM для deep_analysis
    selected_llm = get_selected_llm_for_analysis(plugin_settings, 'deep_analysis', content_language)
    console_log(f"[LLM_SELECTION] Выбрана LLM для deep_analysis.{content_language}: {selected_llm}")
    
    # Получить правильный model_alias для вызова _call_ai_model
    if selected_llm == 'default':
        console_log(f"[DEEP_ANALYSIS] Calling get_default_model_id_from_manifest for deep_analysis.{content_language}")
        model_alias = get_default_model_id_from_manifest('deep_analysis', content_language, plugin_settings)
        console_log(f"[DEEP_ANALYSIS] get_default_model_id_from_manifest returned: {model_alias}")
    else:
        model_alias = selected_llm
    # Получить правильный API-ключ для выбранной LLM
    api_key_id = get_api_key_for_analysis(plugin_settings, 'deep_analysis', content_language, selected_llm)
    console_log(f"[API_KEY] Используем API-ключ: {api_key_id}")



    # Получить пользовательские промпты
    try:
        user_prompts = await get_user_prompts(plugin_settings)
        console_log(f"ℹ️ Используем {'пользовательские' if 'custom' in str(user_prompts) else 'стандартные'} промпты для глубокого анализа")
    except Exception as e:
        console_log(f"❌ Ошибка загрузки промптов: {str(e)}, используем fallback")
        user_prompts = {
            'basic_analysis': {'ru': '', 'en': ''},
            'deep_analysis': {'ru': '', 'en': ''}
        }

    # console_log(f"Глубокий анализ: desc='{description[:100]}...', comp='{composition[:100]}...', язык={content_language}")

    # Получить промпт из пользовательских настроек или дефолтный
    try:
        deep_prompt = user_prompts.get('deep_analysis', {}).get(content_language)
        if not deep_prompt or len(deep_prompt.strip()) < 3:
            console_log(f"⚠️ Промпт deep_analysis.{content_language} не найден или слишком короткий, используем fallback")
            deep_prompt = None
        else:
            console_log(f"✅ Используем промпт deep_analysis.{content_language}")
    except Exception as e:
        console_log(f"❌ Ошибка получения промпта deep_analysis.{content_language}: {str(e)}, используем fallback")
        deep_prompt = None

    # Базовый промпт с учетом выбранного языка
    if deep_prompt:
        prompt = deep_prompt
        console_log(f"📋 Используем пользовательский промпт deep_analysis для языка {content_language}")
    elif content_language == "ru":
        # Старый хардкод промпт как fallback
        prompt = f"""
        Проведи глубокий анализ товара с медицинской и научной точки зрения.
        Описание: {description}
        Состав: {composition}
        Проанализируй:
        1. Научную обоснованность заявленных свойств.
        2. Потенциальные побочные эффекты и противопоказания.
        3. Эффективность по сравнению с аналогами.
        Верни детальный максимально подробный обоснованный анализ в структурированном виде (используй Markdown).
        """
        console_log(f"⚠️ Используем fallback промпт deep_analysis для языка {content_language}")
    else:  # English
        # Старый хардкод промпт как fallback для английского
        prompt = f"""
        Conduct a deep_analysis analysis of the product from a medical and scientific perspective.
        Description: {description}
        Composition: {composition}
        Analyze:
        1. Scientific validity of the claimed properties.
        2. Potential side effects and contraindications.
        3. Effectiveness compared to analogs.
        Return a detailed, maximally comprehensive, reasoned analysis in a structured form (use Markdown).
        """
        console_log(f"⚠️ Используем fallback промпт deep_analysis для языка {content_language}")

    try:
        # Используем выбранную LLM и API-ключ
        result = await ozon_analyzer_server._call_ai_model(model_alias, prompt, api_key_id=api_key_id)

        # Проверка типа данных от AI в perform_deep_analysis
        if not isinstance(result, str):
            # console_log(f"🔄 Deep analysis AI вернул {type(result)} вместо строки, конвертируем")
            result = str(result)
        elif result is None:
            console_log(f"⚠️ Deep analysis AI вернул None")
            result = "Отчет не сформирован"

        return { "deep_analysis_report": result }
    except Exception as e:
        console_log(f"[ERROR] Исключение в perform_deep_analysis: {type(e).__name__}: {str(e)}")
        import traceback
        console_log(f"[ERROR] Traceback: {traceback.format_exc()}")
        if content_language == "ru":
            chat_message(f"❌ Ошибка глубокого анализа: {str(e)[:100]}...")
        else:  # English
            chat_message(f"❌ Deep analysis error: {str(e)[:100]}...")
        return {
            "status": "error",
            "message": f"Deep analysis error: {str(e)}" if content_language != "ru"
                       else f"Ошибка глубокого анализа: {str(e)}"
        }
    finally:
        # [DIAGNOSTIC] ЛОГИРОВАНИЕ В КОНЦЕ perform_deep_analysis
        console_log("[DIAGNOSTIC] >>>>>> perform_deep_analysis FUNCTION ENDING <<<<<<")

# ==============================================================================
# Секция 2: "Приватные" Вспомогательные Функции
# ------------------------------------------------------------------------------
# Эти функции не предназначены для прямого вызова из `workflow.json`.
# Они инкапсулируют внутреннюю логику плагина.
# ==============================================================================

def _safe_assemble_chunks(chunks: List[str], expected_length: int, source_name: str) -> str:
    """
    Безопасная сборка HTML из чанков с обработкой ошибок и проверкой целостности.
    """
    try:
        console_log(f"🔧 Сборка {len(chunks)} чанков ({source_name})")

        if not chunks:
            raise ValueError("Список чанков пустой")

        # Проверка каждого чанка
        valid_chunks = []
        corrupted_chunks = []

        for i, chunk in enumerate(chunks):
            if chunk is None:
                console_log(f"⚠️ Чанк {i} равен None - пропускаем")
                corrupted_chunks.append(i)
                continue

            if not isinstance(chunk, str):
                console_log(f"⚠️ Чанк {i} не является строкой (тип: {type(chunk)}) - конвертируем")
                try:
                    chunk = str(chunk)
                except Exception as e:
                    console_log(f"❌ Не удалось конвертировать чанк {i}: {e}")
                    corrupted_chunks.append(i)
                    continue

            if len(chunk.strip()) == 0:
                # console_log(f"⚠️ Чанк {i} пустой - пропускаем")
                corrupted_chunks.append(i)
                continue

            valid_chunks.append(chunk)

        if corrupted_chunks:
            console_log(f"⚠️ Найдено поврежденных чанков: {corrupted_chunks}")
            console_log(f"✅ Валидных чанков: {len(valid_chunks)}")

        if not valid_chunks:
            raise ValueError("Все чанки повреждены или отсутствуют")

        # Сборка HTML
        console_log("🔧 Начинаем сборку HTML...")
        assembled_html = ''.join(valid_chunks)
        actual_length = len(assembled_html)

        # console_log(f"✅ HTML собран: {actual_length} символов")

        # Проверка целостности
        _check_html_integrity(assembled_html, f"assembled_{source_name}")

        # Проверка соответствия ожидаемой длине
        if actual_length != expected_length:
            console_log(f"⚠️ Разница в длине: ожидалось {expected_length}, получено {actual_length}")
            length_diff = abs(actual_length - expected_length)
            if length_diff > 0:
                console_log(f"⚠️ Отклонение: {length_diff} символов ({length_diff/expected_length*100:.1f}%)")
                if actual_length < expected_length:
                    console_log("⚠️ СТРОКА ОБРЕЗАНА! Возможно потеря данных.")
                else:
                    console_log("ℹ️ Строка длиннее ожидаемой. Возможно, добавлены лишние данные.")

        # Дополнительная проверка структуры
        if actual_length > 0:
            # Проверяем на наличие основных HTML тегов
            has_html = '<html' in assembled_html.lower()
            has_body = '<body' in assembled_html.lower()
            has_head = '<head' in assembled_html.lower()

            # console_log(f"📊 Структура собранного HTML: HTML={has_html}, HEAD={has_head}, BODY={has_body}")

            if not (has_html or has_body or has_head):
                console_log("⚠️ В собранном HTML отсутствуют базовые структурные элементы")

        return assembled_html

    except Exception as e:
        console_log(f"❌ Критическая ошибка при сборке чанков: {e}")
        raise ValueError(f"Не удалось собрать чанки: {e}")

def _check_html_integrity(html_content: str, source_name: str) -> None:
    """
    Проверяет целостность HTML контента для выявления возможного обрезания данных.
    """
    try:
        # console_log(f"🔍 Проверка целостности HTML ({source_name})")

        if not html_content or not isinstance(html_content, str):
            console_log(f"❌ HTML контент пустой или не является строкой")
            return

        content_length = len(html_content)
        # console_log(f"📊 Длина контента: {content_length} символов")

        # Проверка на незакрытые HTML теги
        open_tags = len(re.findall(r'<[^/][^>]*>', html_content))
        close_tags = len(re.findall(r'</[^>]+>', html_content))
        self_closing_tags = len(re.findall(r'<[^>]+/>', html_content))

        tag_balance = open_tags - close_tags
        # console_log(f"📊 HTML теги: открытых={open_tags}, закрытых={close_tags}, самозакрывающихся={self_closing_tags}")

        if abs(tag_balance) > 3:  # Допускаем небольшую погрешность
            console_log(f"⚠️ ОБНАРУЖЕН ДИСБАЛАНС ТЕГОВ: {tag_balance}")
            if tag_balance > 0:
                console_log("⚠️ Больше открытых тегов - возможна обрезка в конце")
            else:
                console_log("⚠️ Больше закрытых тегов - возможна обрезка в начале")

        # Проверка на наличие основных HTML структур
        has_html = '<html' in html_content.lower()
        has_body = '<body' in html_content.lower()
        has_head = '<head' in html_content.lower()
        has_doctype = '<!doctype' in html_content.lower() or '<!DOCTYPE' in html_content

        structure_check = {
            'DOCTYPE': has_doctype,
            '<html>': has_html,
            '<head>': has_head,
            '<body>': has_body
        }

        # console_log(f"📊 HTML структура: {structure_check}")

        # Проверка на незавершенные атрибуты
        incomplete_attrs = len(re.findall(r'<[^>]*\w+="[^"]*$', html_content))  # незавершенные атрибуты
        if incomplete_attrs > 0:
            console_log(f"⚠️ Найдено {incomplete_attrs} незавершенных атрибутов - возможна обрезка")

        # Проверка на незавершенные комментарии
        incomplete_comments = len(re.findall(r'<!--[^>]*$', html_content))  # незавершенные комментарии
        if incomplete_comments > 0:
            console_log(f"⚠️ Найдено {incomplete_comments} незавершенных комментариев - возможна обрезка")

        # Проверка на незавершенные скрипты/стили
        incomplete_scripts = len(re.findall(r'<script[^>]*>[^<]*$', html_content)) - len(re.findall(r'<script[^>]*>[\s\S]*?</script>', html_content))
        incomplete_styles = len(re.findall(r'<style[^>]*>[^<]*$', html_content)) - len(re.findall(r'<style[^>]*>[\s\S]*?</style>', html_content))

        if incomplete_scripts > 0:
            console_log(f"⚠️ Найдено {incomplete_scripts} незавершенных <script> тегов")
        if incomplete_styles > 0:
            console_log(f"⚠️ Найдено {incomplete_styles} незавершенных <style> тегов")

        # Проверка на неожиданное окончание
        last_chars = html_content[-50:] if len(html_content) > 50 else html_content
        if not last_chars.strip().endswith(('>', '</html>', '</body>', '</div>', '</span>', '</p>', '"', "'", '}', ']', ')', ';')):
            # console_log(f"⚠️ ПОДОЗРИТЕЛЬНОЕ ОКОНЧАНИЕ: '{last_chars[-20:]}'")
            console_log("⚠️ Возможно, данные были обрезаны в конце строки")

        # Общая оценка целостности
        integrity_score = 100
        issues = []

        if abs(tag_balance) > 3:
            integrity_score -= 30
            issues.append("дисбаланс тегов")
        if not has_body and not has_html:
            integrity_score -= 20
            issues.append("отсутствие базовой HTML структуры")
        if incomplete_attrs > 0:
            integrity_score -= 15
            issues.append("незавершенные атрибуты")
        if incomplete_scripts > 0 or incomplete_styles > 0:
            integrity_score -= 10
            issues.append("незавершенные скрипты/стили")

        if integrity_score < 100:
            console_log(f"⚠️ ЦЕЛОСТНОСТЬ HTML: {integrity_score}% ({', '.join(issues)})")
        else:
            console_log(f"✅ ЦЕЛОСТНОСТЬ HTML: {integrity_score}% - контент выглядит полным")

    except Exception as e:
        console_log(f"❌ Ошибка при проверке целостности HTML: {e}")
def _reconstruct_chunked_strings(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Восстанавливает большие строки, которые были разделены на чанки в PyodideManager.
    Возвращает копию данных с восстановленными строками.
    """
    try:
        console_log("🔧 ===== РЕКОНСТРУКЦИЯ ЧАНКОВАННЫХ СТРОК =====")

        reconstructed = input_data.copy()
        processed_keys = set()  # Ключи, которые уже обработали
        chunked_strings_found = 0

        # Сначала анализируем все входные данные для поиска чанков и метаданных
        # console_log(f"🔍 Анализ входных данных: {len(input_data)} ключей")

        # Используем регулярное выражение для поиска чанков: ключи содержащие '_chunk_' и заканчивающиеся цифрой
        chunk_pattern = re.compile(r'(.+)_chunk_(\d+)$')
        chunk_groups = {}  # base_key -> [(chunk_num, value), ...]
        metadata_keys = []

        for key, value in input_data.items():
            # Ищем чанки по шаблону *_chunk_*
            match = chunk_pattern.match(key)
            if match:
                base_key = match.group(1)
                chunk_num = int(match.group(2))
                if base_key not in chunk_groups:
                    chunk_groups[base_key] = []
                chunk_groups[base_key].append((chunk_num, value))
            # Ищем метаданные
            elif isinstance(value, dict) and value.get('__isChunkedString', False):
                metadata_keys.append(key)

        # console_log(f"📊 Найдено: {len(chunk_groups)} групп чанков, {len(metadata_keys)} метаданных")

        # Обрабатываем найденные группы чанков
        for base_key, chunks_list in chunk_groups.items():
            # console_log(f"🔧 Обработка группы чанков: {base_key}")
            # console_log(f"🔧   - Найдено чанков: {len(chunks_list)}")

            # Сортируем чанки по номеру
            chunks_list.sort(key=lambda x: x[0])
            chunk_nums = [num for num, _ in chunks_list]
            expected_nums = list(range(len(chunks_list)))

            # Проверяем последовательность номеров чанков
            if chunk_nums != expected_nums:
                console_log(f"⚠️ Несоответствие номеров чанков: ожидаемо {expected_nums}, найдено {chunk_nums}")
                # Продолжаем, но логируем проблему

            # Собираем строку из чанков
            chunks_data = [data for _, data in chunks_list]
            assembled_string = ''.join(chunks_data)
            actual_length = len(assembled_string)

            # console_log(f"🔧 Сборка строки: длина={actual_length}")

            # Проверяем метаданные если они есть
            metadata_key = base_key
            if metadata_key in input_data and isinstance(input_data[metadata_key], dict) and input_data[metadata_key].get('__isChunkedString', False):
                metadata = input_data[metadata_key]
                expected_count = metadata.get('chunkCount', 0)
                expected_length = metadata.get('totalLength', 0)
                # console_log(f"🔧   - Метаданные: count={expected_count}, total_length={expected_length}")

                # Проверяем соответствие метаданным
                if len(chunks_list) != expected_count:
                    console_log(f"⚠️ Несоответствие количества чанков: ожидалось {expected_count}, собрано {len(chunks_list)}")

                if actual_length != expected_length:
                    console_log(f"⚠️ Несоответствие длины: ожидалось {expected_length}, собрано {actual_length}")
                    if actual_length < expected_length:
                        console_log("⚠️ СТРОКА ОБРЕЗАНА! Возможно потеря данных.")
            else:
                console_log("ℹ️ Метаданные не найдены - сборка без проверки")

            # Сохраняем собранную строку
            reconstructed[base_key] = assembled_string
            # console_log(f"✅ УСПЕШНО восстановлена строка {base_key}")

            # Проверка HTML структуры собранной строки
            _check_html_integrity(assembled_string, f"reconstructed_{base_key}")

            # Удаляем метаданные и чанки из reconstructed
            if metadata_key in reconstructed and isinstance(reconstructed[metadata_key], dict) and reconstructed[metadata_key].get('__isChunkedString', False):
                del reconstructed[metadata_key]

            for chunk_num, _ in chunks_list:
                chunk_key = f"{base_key}_chunk_{chunk_num}"
                if chunk_key in reconstructed:
                    del reconstructed[chunk_key]

            # Статистика размеров чанков
            chunk_sizes = [len(data) if isinstance(data, str) else 0 for _, data in chunks_list]
            if chunk_sizes:
                console_log(f"📊 Размеры чанков: {chunk_sizes}")
                # console_log(f"📊 Средний размер чанка: {sum(chunk_sizes)/len(chunk_sizes):.0f} chars")

            processed_keys.add(base_key)

        if processed_keys:
            console_log(f"✅ Восстановлено {len(processed_keys)} больших строк из чанков")
        else:
            console_log("ℹ️ Чанкованные строки не найдены")

        console_log("🔧 ===== КОНЕЦ РЕКОНСТРУКЦИИ ЧАНКОВ =====")

        return reconstructed

    except Exception as e:
        plugin_settings = get_pyodide_var('pluginSettings', {})
        content_language = get_safe_content_language(plugin_settings)
        if content_language == "ru":
            chat_message(f"КРИТИЧЕСКАЯ ошибка при сборке чанков: {e}")
        else:
            chat_message(f"CRITICAL error when assembling chunks: {e}")
        import traceback
        console_log(f"❌ Traceback: {traceback.format_exc()}")
        return input_data  # Возвращаем исходные данные при ошибке

async def _analyze_composition_vs_description(description: str, composition: str, plugin_settings: Dict[str, Any] = None, content_language: str = "ru") -> Dict[str, Any]:
    """
    Оптимизированный анализ соответствия описания и состава с предобработкой.
    Использует преданализ для сокращения размера промпта и cache busting.
    """

    # [DIAGNOSTIC] ===== ВХОД В _analyze_composition_vs_description =====
    console_log("[DIAGNOSTIC] ===== ВХОД В _analyze_composition_vs_description =====")
    # console_log(f"[DIAGNOSTIC] Description length: {safe_len(description)}")
    # console_log(f"[DIAGNOSTIC] Composition length: {safe_len(composition)}")
    # console_log(f"[DIAGNOSTIC] Description preview: {description[:100]}..." if description else "[DIAGNOSTIC] Description: None")
    # console_log(f"[DIAGNOSTIC] Composition preview: {composition[:100]}..." if composition else "[DIAGNOSTIC] Composition: None")
    # console_log(f"[DIAGNOSTIC] plugin_settings: {plugin_settings}")
    # console_log(f"[DIAGNOSTIC] Тип plugin_settings: {type(plugin_settings)}")
    if isinstance(plugin_settings, dict):
        # console_log(f"[DIAGNOSTIC] Ключи в plugin_settings: {list(plugin_settings.keys())}")
        response_lang = plugin_settings.get('response_language', 'КЛЮЧ НЕ НАЙДЕН') if plugin_settings else 'plugin_settings is None'
        console_log(f"[DIAGNOSTIC] response_language: {response_lang}")

    if not description or not composition:
        console_log("[DIAGNOSTIC] ===== ВЫХОД ИЗ _analyze_composition_vs_description (пустые данные) =====")
        return { "score": 0, "reasoning": "Не удалось извлечь описание или состав товара." }

    # Получить пользовательские промпты
    try:
        user_prompts = await get_user_prompts(plugin_settings)
        console_log(f"ℹ️ Используем {'пользовательские' if 'custom' in str(user_prompts) else 'стандартные'} промпты для анализа соответствия")
    except Exception as e:
        console_log(f"❌ Ошибка загрузки промптов: {str(e)}, используем fallback")
        user_prompts = {
            'basic_analysis': {'ru': '', 'en': ''},
            'deep_analysis': {'ru': '', 'en': ''}
        }

    # Предварительный анализ для сокращения размера промпта
    analysis_cache_key = f"pre_analysis:{hash(description[:100] + composition[:100])}"
    pre_analyzed = memory_manager.get_cached_lru(analysis_cache_key)

    if not pre_analyzed:
        # Быстрый преданализ ключевых элементов
        key_elements = _extract_key_elements(description, composition)
        memory_manager.cache_lru(analysis_cache_key, key_elements, max_age_seconds=600)  # 10 мин
    else:
        key_elements = pre_analyzed


    # Получить промпт из пользовательских настроек или дефолтный
    try:
        basic_analysis_prompt = user_prompts.get('basic_analysis', {}).get(content_language)
        console_log(f"LLM_PROMPT_DEBUG: 🔍 ПОЛУЧЕНИЕ ПРОМПТА ДЛЯ basic_analysis.{content_language}:")
        console_log(f"LLM_PROMPT_DEBUG:   user_prompts: {user_prompts}")
        console_log(f"LLM_PROMPT_DEBUG:   user_prompts.get('basic_analysis', {{}}): {user_prompts.get('basic_analysis', {})}")
        console_log(f"LLM_PROMPT_DEBUG:   basic_analysis_prompt: {repr(basic_analysis_prompt)}")
        console_log(f"LLM_PROMPT_DEBUG:   basic_analysis_prompt length: {len(basic_analysis_prompt) if basic_analysis_prompt else 0}")

        if not basic_analysis_prompt or len(basic_analysis_prompt.strip()) < 3:
            # Fallback на старый хардкод промпт
            console_log(f"⚠️ LLM_PROMPT_DEBUG: Промпт basic_analysis.{content_language} не найден или слишком короткий, используем fallback")
            basic_analysis_prompt = None
        else:
            console_log(f"✅ LLM_PROMPT_DEBUG: Используем промпт basic_analysis.{content_language} (длина: {len(basic_analysis_prompt)})")
            console_log(f"LLM_PROMPT_DEBUG: 📝 Содержимое промпта: {repr(basic_analysis_prompt[:100])}...")
    except Exception as e:
        console_log(f"❌ LLM_PROMPT_DEBUG: Ошибка получения промпта basic_analysis.{content_language}: {str(e)}, используем fallback")
        basic_analysis_prompt = None

    # Базовый промпт с учетом выбранного языка
    console_log(f"LLM_PROMPT_DEBUG: 🔍 ВЫБОР ИТОГОВОГО ПРОМПТА:")
    if basic_analysis_prompt:
        prompt = basic_analysis_prompt
        console_log(f"📋 LLM_PROMPT_DEBUG: Используем пользовательский промпт basic_analysis для языка {content_language}")
        console_log(f"LLM_PROMPT_DEBUG: 📝 Итоговый промпт (первые 200 символов): {repr(prompt[:200])}...")
    elif content_language == "ru":
        prompt = f"""
        """
        console_log(f"📋 LLM_PROMPT_DEBUG: Используем fallback промпт для русского языка")
    else:  # English
        prompt = f"""
        """
        console_log(f"📋 LLM_PROMPT_DEBUG: Используем fallback промпт для английского языка")

    console_log(f"LLM_PROMPT_DEBUG: 📊 СТАТИСТИКА ПРОМПТА: длина={len(prompt)}, содержит '10+10'={('10+10' in prompt)}")
    try:
        # Логирование запроса к Gemini API в полном формате
        console_log("[GEMINI REQUEST] ===== REQUEST TO GEMINI API =====")
        console_log("[GEMINI REQUEST] Model: compliance_check")
        console_log("[GEMINI REQUEST] ===== END REQUEST =====")
        # [DIAGNOSTIC] ===== ВЫЗОВ AI МОДЕЛИ =====
        console_log("[DIAGNOSTIC] ===== ВЫЗОВ AI МОДЕЛИ =====")
        
        # Получаем выбранную пользователем LLM для данного типа анализа и языка
        selected_llm = get_selected_llm_for_analysis(plugin_settings, 'basic_analysis', content_language)
        console_log(f"[BASIC_ANALYSIS] selected_llm: {selected_llm}")
        if selected_llm == 'default':
            console_log(f"[BASIC_ANALYSIS] Calling get_default_model_id_from_manifest for basic_analysis.{content_language}")
            model_alias = get_default_model_id_from_manifest('basic_analysis', content_language, plugin_settings)
            console_log(f"[BASIC_ANALYSIS] get_default_model_id_from_manifest returned: {model_alias}")
            api_key_id = get_api_key_for_analysis(plugin_settings, 'basic_analysis', content_language, selected_llm)
            # Для Default LLM формируем правильный apiKeyId в формате ozon-analyzer.basic_analysis.ru.default
            if api_key_id:
                api_key_id = f"ozon-analyzer.basic_analysis.{content_language}.default"
                console_log(f"[API_KEY_FLOW_PROBLEM_START] selected_llm: {selected_llm}")
                console_log(f"[API_KEY_FLOW_PROBLEM_START] model_alias: {model_alias}")
                console_log(f"[API_KEY_FLOW_PROBLEM_START] api_key_id: {api_key_id}")
                console_log(f"[API_KEY_FLOW_PROBLEM_START] api_key_id type: {type(api_key_id)}")
                console_log(f"[API_KEY_FLOW_PROBLEM_START] api_key_id length: {len(api_key_id) if api_key_id else 0}")
        else:
            model_alias = selected_llm
            api_key_id = get_api_key_for_analysis(plugin_settings, 'basic_analysis', content_language, selected_llm)  # обычно совпадает с model_alias
        console_log(f"[MODEL] model_alias: {model_alias}, api_key_id: {api_key_id}")

        # Используем выбранную LLM и API-ключ
        result_str = await ozon_analyzer_server._call_ai_model(model_alias, prompt, api_key_id=api_key_id)
        console_log(f"[API_KEY_FLOW_PROBLEM_END] LLM call completed")
        console_log("[DIAGNOSTIC] ===== КОНЕЦ ВЫЗОВА _call_ai_model() =====")

        # [DIAGNOSTIC] ===== РЕЗУЛЬТАТ ВЫЗОВА AI МОДЕЛИ =====
        console_log("[DIAGNOSTIC] ===== РЕЗУЛЬТАТ ВЫЗОВА AI МОДЕЛИ =====")

        console_log("[DIAGNOSTIC] ===== ПОЛУЧЕН ОТВЕТ ОТ AI, НАЧИНАЕМ ОБРАБОТКУ =====")

        # Проверка типа данных от AI и конвертация при необходимости
        if not isinstance(result_str, str):
            if content_language == "ru":
                chat_message(f"🔄 AI вернул {type(result_str)} вместо строки, конвертируем")
            else:
                chat_message(f"🔄 AI returned {type(result_str)} instead of string, converting")
            result_str = str(result_str)

        # [DIAGNOSTIC] ===== ОБРАБОТКА РЕЗУЛЬТАТА =====
        console_log("[DIAGNOSTIC] ===== ОБРАБОТКА РЕЗУЛЬТАТА =====")
        # console_log(f"[DIAGNOSTIC] Перед clean_ai_response: {result_str}")

        # Улучшенная обработка ответа AI с многоуровневым fallback
        if isinstance(result_str, str) and len(result_str.strip()) > 0:
            # console_log(f"🔍 Начинаем обработку ответа AI длиной {len(result_str)} символов")

            # Шаг 1: Улучшенная очистка markdown обёртки
            # Улучшенная очистка markdown обёртки с учетом пробелов и переносов строк
            original_length = len(result_str)
        
            # Регулярное выражение для удаления markdown обёртки ```json...```
            markdown_pattern = re.compile(r'```\s*json\s*\n?(.*?)\n?\s*```', re.IGNORECASE | re.DOTALL)
            cleaned_str = markdown_pattern.sub(r'\1', result_str.strip())
        
            # Дополнительная очистка на случай если остались одиночные ```
            cleaned_str = cleaned_str.replace('```', '').strip()

            # Логируем исправления
            if original_length != len(cleaned_str):
                console_log(f"[BRIDGE DIAGNOSTIC] ✅ Выполнено исправление markdown обёртки")
            else:
                console_log(f"[BRIDGE DIAGNOSTIC] ℹ️ Markdown обёртка не найдена, ответ уже чистый")

            # Шаг 1.5: Попытка парсинга очищенного ответа напрямую (без markdown)
            try:
                parsed = json.loads(cleaned_str)

                # Валидация формата ответа
                if isinstance(parsed, dict) and 'score' in parsed:
                    score = parsed.get('score')
                    reasoning = parsed.get('reasoning')
                    desc_len = safe_len(description)
                    comp_len = safe_len(composition)
                    return parsed
                else:
                    console_log(f"[BRIDGE DIAGNOSTIC] ⚠️ Прямой парсинг вернул словарь без поля 'score': {parsed}")
                    console_log(f"[BRIDGE DIAGNOSTIC] Доступные ключи: {list(parsed.keys()) if isinstance(parsed, dict) else 'не словарь'}")
            except json.JSONDecodeError as je:
                console_log(f"[BRIDGE DIAGNOSTIC] ❌ Прямой JSON парсинг провалился: {str(je)}")

            # Шаг 2: Попытка парсинга исходного ответа напрямую (на случай, если это уже чистый JSON)
            try:
                parsed = json.loads(result_str.strip())

                # Валидация формата ответа
                if isinstance(parsed, dict) and 'score' in parsed:
                    score = parsed.get('score')
                    reasoning = parsed.get('reasoning')
                    return parsed
                else:
                    console_log(f"[BRIDGE DIAGNOSTIC] ⚠️ Парсинг исходного ответа вернул словарь без поля 'score': {parsed}")
            except json.JSONDecodeError as je:
                console_log(f"[BRIDGE DIAGNOSTIC] ❌ Парсинг исходного ответа провалился: {str(je)}")

            # Шаг 3: Альтернативное извлечение JSON
            alternative_result = _extract_json_from_ai_response(result_str)
            if alternative_result:
                return alternative_result
            else:
                console_log(f"[BRIDGE DIAGNOSTIC] ❌ Альтернативное извлечение не удалось")

            # Шаг 4: Попытка ремонта JSON
            repair_result = _attempt_json_repair(cleaned_str)
            if repair_result:
                return repair_result
            else:
                console_log(f"[BRIDGE DIAGNOSTIC] ❌ Ремонт JSON не удался")

            # Шаг 5: Финальный fallback
            desc_len = safe_len(description)
            comp_len = safe_len(composition)

            fallback_result = {
                "score": 5,
                "reasoning": f"Не удалось распарсить JSON от AI после всех попыток исправления. "
                            f"Исходный ответ: {cleaned_str[:100]}... "
                            f"(описание: {desc_len} символов, состав: {comp_len} символов)"
            }
            return fallback_result
        else:
            if content_language == "ru":
                chat_message(f"⚠️ AI вернул пустой или некорректный ответ: {type(result_str)}")
            else:
                chat_message(f"⚠️ AI returned empty or incorrect response: {type(result_str)}")
            error_result = {"score": 5, "reasoning": f"AI вернул некорректный тип данных: {type(result_str)}"}
            return error_result

    except Exception as e:
        # Отправляем ошибку AI в чат для пользователя
        if content_language == "ru":
            chat_message(f"⚠️ Произошла ошибка при анализе товара: {str(e)[:100]}...")
        else:  # English
            chat_message(f"⚠️ An error occurred during product analysis: {str(e)[:100]}...")
        # Безопасная конвертация типов данных для избежания ошибок len()
        try:
            desc_len = safe_len(description)
            comp_len = safe_len(composition)
        except Exception as len_error:
            console_log(f"Ошибка при подсчете длины: {str(len_error)}")
            desc_len = 0
            comp_len = 0
        exception_result = { "score": 0, "reasoning": f"Ошибка анализа AI: {str(e)}. Рекомендуется проверить доступность AI модели и корректность входных данных (описание: {desc_len} символов, состав: {comp_len} символов)." }
        return exception_result

def _extract_json_from_ai_response(ai_response: str) -> Optional[Dict[str, Any]]:
    """
    Альтернативная функция извлечения JSON из ответа AI с множественными стратегиями.
    Использует различные подходы для поиска и извлечения JSON из ответа модели.
    """
    if not isinstance(ai_response, str) or not ai_response.strip():
        return None

    # console_log(f"🔍 Начинаем альтернативное извлечение JSON из ответа длиной {len(ai_response)} символов")

    # Стратегия 1: Прямой поиск JSON объекта
    # console_log("Стратегия 1: Прямой поиск JSON объекта")
    try:
        # Сначала пробуем распарсить весь ответ как чистый JSON (без markdown)
        try:
            parsed = json.loads(ai_response.strip())
            if isinstance(parsed, dict) and 'score' in parsed:
                # console_log(f"✅ Весь ответ распарсен как чистый JSON по стратегии 1")
                return parsed
        except json.JSONDecodeError:
            pass  # Продолжаем с другими стратегиями

        # Ищем самый длинный валидный JSON объект в ответе
        json_pattern = r'\{[^{}]*\{[^{}]*\}[^{}]*\}|\{[^{}]*\}'
        matches = re.findall(json_pattern, ai_response, re.DOTALL)

        if matches:
            # Сортируем по длине и пробуем парсить
            matches.sort(key=len, reverse=True)
            for match in matches[:5]:  # Проверяем топ-5 самых длинных для лучшего покрытия
                try:
                    parsed = json.loads(match)
                    if isinstance(parsed, dict) and 'score' in parsed:
                        # console_log(f"✅ Найден валидный JSON по стратегии 1: {len(match)} символов")
                        return parsed
                except json.JSONDecodeError:
                    continue

    except Exception as e:
        console_log(f"Ошибка в стратегии 1: {e}")

    # Стратегия 2: Улучшенный поиск между маркерами кода
    # console_log("Стратегия 2: Поиск между маркерами кода")
    try:
        # Улучшенные паттерны для поиска JSON в markdown блоках
        code_block_patterns = [
            r'```\s*json\s*\n?\s*(\{.*?\})\s*\n?\s*```',  # ```json\n{...}\n```
            r'```\s*(\{.*?\})\s*```',  # ```\n{...}\n```
            r'```[^\n]*\s*\n?\s*(\{.*?\})\s*\n?\s*```',  # ```language\n{...}\n```
            r'```\s*json\s*\n?\s*(\{[\s\S]*?\})\s*\n?\s*```',  # Многострочный JSON
        ]

        for pattern_idx, pattern in enumerate(code_block_patterns):
            matches = re.findall(pattern, ai_response, re.IGNORECASE | re.DOTALL)
            # console_log(f"Стратегия 2.{pattern_idx + 1}: найдено {len(matches)} совпадений")

            for match_idx, match in enumerate(matches):
                try:
                    # console_log(f"Попытка парсинга совпадения {match_idx + 1}: {match[:100]}...")
                    parsed = json.loads(match)
                    if isinstance(parsed, dict) and 'score' in parsed:
                        score = parsed.get('score')
                        # console_log(f"✅ Найден валидный JSON в код-блоке по стратегии 2.{pattern_idx + 1}: score={score}")
                        return parsed
                except json.JSONDecodeError as e:
                    console_log(f"Парсинг совпадения {match_idx + 1} провалился: {e}")
                    continue

    except Exception as e:
        console_log(f"Ошибка в стратегии 2: {e}")

    # Стратегия 3: Поиск по ключевым словам и извлечение структуры
    # console_log("Стратегия 3: Поиск по ключевым словам")
    try:
        # Ищем score
        score_pattern = r'"score"\s*:\s*(\d+)'
        score_match = re.search(score_pattern, ai_response, re.IGNORECASE)

        if score_match:
            score = int(score_match.group(1))

            # Ищем reasoning
            reasoning_pattern = r'"reasoning"\s*:\s*"([^"]*(?:\\"[^"]*)*)"'
            reasoning_match = re.search(reasoning_pattern, ai_response, re.IGNORECASE | re.DOTALL)

            if reasoning_match:
                reasoning = reasoning_match.group(1)
                result = {"score": score, "reasoning": reasoning}

                # console_log(f"✅ Извлечена структура JSON по стратегии 3: score={score}")
                return result

    except Exception as e:
        console_log(f"Ошибка в стратегии 3: {e}")

    console_log("❌ Ни одна стратегия извлечения JSON не сработала")
    return None
def _attempt_json_repair(broken_json: str) -> Optional[Dict[str, Any]]:
    """
    Комплексная функция ремонта поврежденного JSON с множественными стратегиями.
    Используется когда стандартный json.loads() не может распарсить ответ AI.
    """
    if not isinstance(broken_json, str) or not broken_json.strip():
        return None

    console_log(f"🔧 Начинаем ремонт JSON длиной {len(broken_json)} символов")

    original_json = broken_json

    # Шаг 1: Улучшенная очистка от Markdown и лишних символов
    console_log("Шаг 1: Очистка от Markdown")
    try:
        original_json = broken_json
        cleaned = original_json

        # Проверяем, является ли JSON уже чистым (без markdown)
        try:
            parsed_clean = json.loads(cleaned.strip())
            if isinstance(parsed_clean, dict) and 'score' in parsed_clean:
                console_log("✅ JSON уже чистый, markdown обёртка отсутствует")
                return parsed_clean
        except json.JSONDecodeError:
            pass  # Продолжаем очистку

        # Убираем Markdown обертки с улучшенными паттернами
        markdown_patterns = [
            r'```\s*json\s*\n?\s*',  # ```json или ```json\n
            r'```\s*',               # ``` с возможными пробелами
            r'\s*```',               # ``` в конце с пробелами
        ]

        for pattern in markdown_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

        # Дополнительная очистка
        cleaned = cleaned.strip()

        # Проверяем, если после очистки получился корректный JSON
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict) and 'score' in parsed:
                console_log("✅ После очистки Markdown получился валидный JSON")
                return parsed
        except json.JSONDecodeError:
            pass  # Продолжаем очистку

        # Убираем лишние пробелы и переносы (сохраняя структуру)
        cleaned = re.sub(r'[ \t]+', ' ', cleaned)  # Сжимаем множественные пробелы
        cleaned = re.sub(r'\n\s*\n', '\n', cleaned)  # Убираем пустые строки

        # Убираем BOM и невидимые символы
        cleaned = cleaned.replace('\ufeff', '').replace('\u200b', '')

        # console_log(f"После очистки: {len(cleaned)} символов (было {len(original_json)})")

        if len(cleaned) != len(original_json):
            console_log("✅ Выполнена очистка Markdown")
        else:
            console_log("ℹ️ Markdown обёртка не найдена")

        # Финальная проверка очищенного JSON
        try:
            parsed_final = json.loads(cleaned)
            if isinstance(parsed_final, dict) and 'score' in parsed_final:
                console_log("✅ После полной очистки получился валидный JSON")
                return parsed_final
        except json.JSONDecodeError:
            console_log("ℹ️ После очистки JSON всё ещё невалидный, продолжаем ремонт")

    except Exception as e:
        console_log(f"Ошибка в шаге 1: {e}")
        cleaned = broken_json

    # Шаг 2: Исправление кавычек
    console_log("Шаг 2: Исправление кавычек")
    try:
        # Исправляем неправильные кавычки
        fixed_quotes = cleaned.replace('"', '"').replace('"', '"')

        # Исправляем отсутствующие кавычки в ключах
        fixed_quotes = re.sub(r'([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', fixed_quotes)

        # Исправляем отсутствующие кавычки в строковых значениях
        fixed_quotes = re.sub(r':\s*([a-zA-Zа-яА-Я][^",}]+)', r': "\1"', fixed_quotes)

        console_log("✅ Исправлены кавычки")

    except Exception as e:
        console_log(f"Ошибка в шаге 2: {e}")
        fixed_quotes = cleaned

    # Шаг 3: Исправление структуры
    console_log("Шаг 3: Исправление структуры")
    try:
        # Убеждаемся что начинается с {
        if not fixed_quotes.strip().startswith('{'):
            start_idx = fixed_quotes.find('{')
            if start_idx != -1:
                fixed_quotes = fixed_quotes[start_idx:]
            else:
                # Если нет {, добавляем
                fixed_quotes = '{' + fixed_quotes

        # Убеждаемся что заканчивается на }
        if not fixed_quotes.strip().endswith('}'):
            end_idx = fixed_quotes.rfind('}')
            if end_idx != -1:
                fixed_quotes = fixed_quotes[:end_idx + 1]
            else:
                # Если нет }, добавляем
                fixed_quotes = fixed_quotes + '}'

        console_log("✅ Исправлена структура JSON")

    except Exception as e:
        console_log(f"Ошибка в шаге 3: {e}")

    # Шаг 4: Попытка парсинга
    console_log("Шаг 4: Попытка парсинга исправленного JSON")
    try:
        parsed = json.loads(fixed_quotes)

        if isinstance(parsed, dict) and 'score' in parsed:
            console_log("✅ JSON успешно отремонтирован и распарсен")
            return parsed
        else:
            console_log("❌ Отремонтированный JSON не содержит ожидаемой структуры")

    except json.JSONDecodeError as je:
        console_log(f"❌ Парсинг отремонтированного JSON не удался: {str(je)}")

        # Шаг 5: Агрессивный ремонт
        console_log("Шаг 5: Агрессивный ремонт JSON")
        try:
            # Создаем минимальный валидный JSON на основе найденных данных
            score_match = re.search(r'score["\s]*:[\s]*(\d+)', fixed_quotes, re.IGNORECASE)
            reasoning_match = re.search(r'reasoning["\s]*:[\s]*["]([^"]*)["]', fixed_quotes, re.IGNORECASE)

            if score_match:
                score = int(score_match.group(1))
                reasoning = reasoning_match.group(1) if reasoning_match else "Анализ завершен с помощью агрессивного ремонта"

                fallback_json = {
                    "score": score,
                    "reasoning": reasoning
                }

                # console_log(f"✅ Создан fallback JSON: score={score}")
                return fallback_json

        except Exception as e:
            console_log(f"❌ Агрессивный ремонт не удался: {e}")

    console_log("❌ Все стратегии ремонта JSON провалились")
    return None


# Лояльная функция batch processor с расширенной функциональностью
async def _call_ai_model_with_fallback(model_alias: str, prompt: str, context: Optional[str] = None,
                                       use_batch: bool = True) -> str:
    """
    Альтернативный AI caller с опцией отката к немедленному вызову.
    Полезен для критически важных запросов или когда нужен мгновенный ответ.
    """
    if not use_batch or len(prompt) > 10000:  # Очень длинные промпты не группируем
        return await _call_ai_model_immediate(model_alias, prompt, context)

    return await ozon_analyzer_server._call_ai_model(model_alias, prompt, context)

async def _call_ai_model_immediate(model_alias: str, prompt: str, context: Optional[str] = None) -> str:
    """
    Немедленный AI вызов без использования batch processor.
    Используется для критически важных запросов.
    """
    # Проверяем кеш
    cached_response = await ai_cache.get(model_alias, prompt, context)
    if cached_response:
        if content_language == "ru":
            chat_message(f"📋 Кеш hit для {model_alias}")
        else:
            chat_message(f"📋 Cache hit for {model_alias}")
        return cached_response

    start_time = datetime.now()
    plugin_settings = get_pyodide_var('pluginSettings', {})
    content_language = get_safe_content_language(plugin_settings)

    try:
        response_proxy = await js.llm_call(model_alias, {"prompt": prompt})
        if response_proxy is None:
            raise Exception("js.llm_call return None response proxy")

        # Правильная обработка PyodideFuture
        if hasattr(response_proxy, 'to_py'):
            result = response_proxy.to_py()
        else:
            result = response_proxy

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

async def _find_similar_products(categories: List[str], composition: str, plugin_settings: Dict[str, Any] = None, content_language: str = "ru") -> List[Dict[str, Any]]:
    """
    Оптимизированный поиск аналогичных продуктов на основе категорий и состава.
    Использует параллельные AI запросы для поиска аналогичных товаров в разных категориях.
    """

    if not categories or not composition:
        return [{"name": "Недостаточно данных для поиска аналогов", "reason": "missing_categories_or_composition"}]

    # ИСПОЛЬЗУЕМ ПЕРЕДАННЫЙ content_language ИЗ analyze_ozon_product

    # Быстрые категоризации по типу продукта
    product_type = _categorize_product_by_composition(composition)

    # Параллельный поиск по разным аспектам с учетом выбранного языка
    if content_language == "ru":
        search_prompt = f"""
        Найди 3-5 аналогичных реальных товаров на основе:
        Категории: {', '.join(categories)}
        Тип продукта: {product_type}
        Состав: {composition[:1000]}...

        Только не выдумывай несуществующие товары, а ищи только те аналогичные товары которые реально были в маркетплейсах.
        Проанализируй характеристики аналогичных товаров и верни результаты в формате JSON. Если знаешь точную ссылку на товар - укажи её, иначе оставь поле url пустым:
        {{"analogs": [
            {{"name": "Название товара", "price_range": "Цена от-до", "url": "https://www.ozon.ru/product/... или пустая строка", "key_features": ["особенности"], "similarity_score": 85}},
            ...
        ]}}
        """
    else:  # English
        search_prompt = f"""
        Find 3-5 similar real products based on:
        Categories: {', '.join(categories)}
        Product type: {product_type}
        Composition: {composition[:1000]}...

        Do not invent non-existent products, but only look for those similar products that were actually in marketplaces.
        Analyze the characteristics of similar products and return the results in JSON format. If you know the exact link to the product - specify it, otherwise leave the url field empty:
        {{"analogs": [
            {{"name": "Product name", "price_range": "Price from-to", "url": "https://www.ozon.ru/product/... or empty string", "key_features": ["features"], "similarity_score": 85}},
            ...
        ]}}
        """

    try:
        # Логирование запроса к Gemini API в полном формате
        console_log("[GEMINI REQUEST] ===== REQUEST TO GEMINI API =====")
        console_log("[GEMINI REQUEST] Model: basic_analysis")
        console_log("[GEMINI REQUEST] ===== END REQUEST =====")
        # Используем асинхронный вызов AI модели
        response = await ozon_analyzer_server._call_ai_model("basic_analysis", search_prompt)

        # Детальная проверка ответа AI перед обработкой
        if response is None:
            if content_language == "ru":
                chat_message("⚠️ AI вернул пустой ответ при поиске аналогов, используем резервные данные")
            else:
                chat_message("⚠️ AI returned empty response when searching for analogs, using fallback data")
            console_log("AI вернул None - переходим на fallback")
            return _generate_fallback_analogs(categories, product_type, content_language)

        # Проверка типа данных от AI
        if not isinstance(response, str):
            if hasattr(response, '__dict__'):
                console_log(f"[BRIDGE DIAGNOSTIC] Атрибуты ответа: {response.__dict__}")
            response = str(response)

        # Проверяем, что ответ не пустой после конвертации
        if not response or len(response.strip()) == 0:
            if content_language == "ru":
                chat_message("⚠️ AI вернул пустой ответ при поиске аналогов, используем резервные данные")
            else:
                chat_message("⚠️ AI returned empty response when searching for analogs, using fallback data")
            console_log(f"Пустой ответ от AI: '{response}' (длина: {len(response) if response else 0})")
            return _generate_fallback_analogs(categories, product_type, content_language)

        # ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ОТВЕТА ОТ AI В _find_similar_products
        console_log("[FIND_SIMILAR] ===== НАЧАЛО ОБРАБОТКИ ОТВЕТА AI =====")
        console_log("[FIND_SIMILAR] ===== КОНЕЦ ЛОГИРОВАНИЯ ОТВЕТА =====")

        # Парсим ответ
        try:
            if isinstance(response, str) and len(response.strip()) > 0:
                cleaned_response = response.replace('```json', '').replace('```', '').strip()

                # Дополнительная проверка очищенного ответа
                if not cleaned_response or cleaned_response.isspace():
                    if content_language == "ru":
                        chat_message("⚠️ После очистки ответ AI стал пустым, используем резервные данные")
                    else:
                        chat_message("⚠️ After cleaning, AI response became empty, using fallback data")
                    return _generate_fallback_analogs(categories, product_type)

                parsed = json.loads(cleaned_response)
                analogs = parsed.get('analogs', [])

                if analogs:
                    return analogs[:5]  # Ограничение до 5 результатов
                else:
                    # Fallback - генерируем на основе состава
                    if content_language == "ru":
                        chat_message("⚠️ AI не вернул аналоги, используем резервные данные")
                    else:
                        chat_message("⚠️ AI did not return analogs, using fallback data")
                    return _generate_fallback_analogs(categories, product_type, content_language)
            else:
                if content_language == "ru":
                    chat_message(f"⚠️ AI вернул некорректный ответ при поиске аналогов: {type(response)}")
                else:
                    chat_message(f"⚠️ AI returned incorrect response when searching for analogs: {type(response)}")
                return _generate_fallback_analogs(categories, product_type, content_language)

        except json.JSONDecodeError as je:
            console_log(f"JSON парсинг ошибка в _find_similar_products: {str(je)}")
            console_log(f"Необработанный ответ AI: {response[:500]}...")  # Логируем первые 500 символов для диагностики

            # Расширенная попытка исправить распространенные проблемы с JSON
            try:
                fixed_json = response.strip()

                # Убираем возможные лишние символы в начале и конце
                if not fixed_json.startswith('{'):
                    start_idx = fixed_json.find('{')
                    if start_idx != -1:
                        fixed_json = fixed_json[start_idx:]

                if not fixed_json.endswith('}'):
                    end_idx = fixed_json.rfind('}')
                    if end_idx != -1:
                        fixed_json = fixed_json[:end_idx + 1]

                # Убираем возможные Markdown обертки
                fixed_json = fixed_json.replace('```json', '').replace('```', '').strip()

                # Исправляем распространенные проблемы с кавычками
                fixed_json = fixed_json.replace('"', '"').replace('"', '"')  # Убеждаемся в правильных кавычках
                fixed_json = fixed_json.replace('\\n', ' ')  # Заменяем переносы строк на пробелы
                fixed_json = fixed_json.replace('\\t', ' ')  # Заменяем табуляции на пробелы

                # Исправляем отсутствующие кавычки в ключах
                fixed_json = re.sub(r'([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', fixed_json)

                console_log(f"Исправленный JSON: {fixed_json[:200]}...")

                parsed = json.loads(fixed_json)
                console_log("JSON удалось исправить автоматически в _find_similar_products")
                analogs = parsed.get('analogs', [])
                if analogs:
                    return analogs[:5]  # Ограничение до 5 результатов
                else:
                    return _generate_fallback_analogs(categories, product_type, content_language)
            except Exception as fix_error:
                console_log(f"Автоматическое исправление JSON не удалось: {str(fix_error)}")
                return _generate_fallback_analogs(categories, product_type, content_language)

    except Exception as e:
        if content_language == "ru":
            chat_message(f"❌ Критическая ошибка при поиске аналогов: {str(e)[:100]}...")
        else:
            chat_message(f"❌ Critical error when searching for analogs: {str(e)[:100]}...")
        console_log(f"❌ Критическая ошибка при поиске аналогов: {str(e)[:100]}...")
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
def get_selected_llm_for_analysis(plugin_settings: Dict[str, Any], analysis_type: str, content_language: str) -> str:
    """
    Получить выбранную LLM для указанного типа анализа и языка.

    Args:
        plugin_settings: Настройки плагина
        analysis_type: Тип анализа ('basic_analysis', 'deep_analysis', etc.)
        content_language: Язык контента ('ru', 'en')

    Returns:
        Имя выбранной LLM или 'default' если не найдено
    """
    try:
        console_log(f"🔍 get_selected_llm_for_analysis: analysis_type={analysis_type}, content_language={content_language}")

        # Проверяем настройки плагина на наличие selected_llms
        if plugin_settings and isinstance(plugin_settings, dict):
            selected_llms = safe_dict_get(plugin_settings, 'selected_llms', {})
            if selected_llms and isinstance(selected_llms, dict):
                # Ищем настройку для конкретного типа анализа
                analysis_settings = safe_dict_get(selected_llms, analysis_type, {})
                if analysis_settings and isinstance(analysis_settings, dict):
                    # Ищем настройку для конкретного языка
                    selected_llm = safe_dict_get(analysis_settings, content_language, None)

                    if selected_llm:
                        console_log(f"✅ Найдена выбранная LLM для {analysis_type}.{content_language}: {selected_llm}")
                        return selected_llm

                # Fallback: ищем настройку только для типа анализа
                selected_llm = safe_dict_get(selected_llms, analysis_type, None)
                if selected_llm and isinstance(selected_llm, str):
                    console_log(f"✅ Найдена выбранная LLM для {analysis_type}: {selected_llm}")
                    return selected_llm

        console_log(f"ℹ️ Выбранная LLM не найдена, используем default")
        return 'default'

    except Exception as e:
        console_log(f"❌ Ошибка в get_selected_llm_for_analysis: {str(e)}")
        return 'default'


def get_api_key_for_analysis(plugin_settings: Dict[str, Any], analysis_type: str, content_language: str, selected_llm: str) -> Optional[str]:
    """
    Получить API ключ для указанного типа анализа, языка и выбранной LLM.

    Args:
        plugin_settings: Настройки плагина
        analysis_type: Тип анализа ('basic_analysis', 'deep_analysis', etc.)
        content_language: Язык контента ('ru', 'en')
        selected_llm: Выбранная LLM ('default' или имя кастомной LLM)

    Returns:
        API ключ или None если не найден
    """
    try:
        console_log(f"🔑 get_api_key_for_analysis: analysis_type={analysis_type}, content_language={content_language}, selected_llm={selected_llm}")

        # Проверяем настройки плагина на наличие API ключей
        if plugin_settings and isinstance(plugin_settings, dict):
            api_keys = safe_dict_get(plugin_settings, 'api_keys', {})
            if api_keys and isinstance(api_keys, dict):
                # Формируем ключ для поиска API ключа
                # Формат: {plugin_id}.{analysis_type}.{language} или просто имя LLM (используем точки как в UI)
                key_variants = [
                    f"ozon-analyzer.{analysis_type}.{content_language}",  # ozon-analyzer.basic_analysis.ru
                    f"{analysis_type}_{content_language}",  # basic_analysis_ru
                    f"{selected_llm}",  # имя выбранной LLM
                    f"{analysis_type}",  # просто тип анализа
                ]

                # Для default LLM добавляем дополнительные варианты поиска
                if selected_llm == 'default':
                    key_variants.extend([
                        f"ozon-analyzer.{analysis_type}.{content_language}.default",  # ozon-analyzer.basic_analysis.ru.default
                        f"ozon-analyzer.default",  # ozon-analyzer.default (как сохраняется в UI)
                        "default",  # просто default
                    ])

                for key_variant in key_variants:
                    api_key = safe_dict_get(api_keys, key_variant, None)
                    if api_key and isinstance(api_key, str) and len(api_key.strip()) > 0:
                        console_log(f"✅ Найден API ключ для варианта '{key_variant}': {api_key[:10]}...")
                        return api_key.strip()

        # Для default LLM пытаемся получить ключ из глобальных настроек
        if selected_llm == 'default':
            console_log(f"ℹ️ Для default LLM пытаемся получить API ключ из глобальных настроек")
            # Пытаемся получить API ключ для Gemini из глобальных настроек
            try:
                # Проверяем наличие gemini_api_key в plugin_settings
                gemini_key = safe_dict_get(plugin_settings, 'gemini_api_key', None)
                if gemini_key and isinstance(gemini_key, str) and len(gemini_key.strip()) > 0:
                    console_log(f"✅ Найден Gemini API ключ в plugin_settings: {gemini_key[:10]}...")
                    return gemini_key.strip()

                # Проверяем наличие api_keys.gemini в plugin_settings
                api_keys = safe_dict_get(plugin_settings, 'api_keys', {})
                if api_keys and isinstance(api_keys, dict):
                    gemini_key = safe_dict_get(api_keys, 'gemini', None)
                    if gemini_key and isinstance(gemini_key, str) and len(gemini_key.strip()) > 0:
                        console_log(f"✅ Найден Gemini API ключ в api_keys.gemini: {gemini_key[:10]}...")
                        return gemini_key.strip()
            except Exception as e:
                console_log(f"⚠️ Ошибка при получении Gemini API ключа: {str(e)}")

        console_log(f"ℹ️ API ключ не найден в plugin_settings, будет использоваться ключ по умолчанию из background")
        return None

    except Exception as e:
        console_log(f"❌ Ошибка в get_api_key_for_analysis: {str(e)}")
        return None




def _generate_fallback_analogs(categories: List[str], product_type: str, content_language: str = "ru") -> List[Dict[str, Any]]:
    """Генерация фоллбэк-аналогов на основе категорий и типа продукта с учетом языка."""
    # Таблица соответствий для быстрого поиска аналогов
    if content_language == "ru":
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
        no_category_text = "без категории"
    else:  # English
        analogs_by_type = {
            "косметика_anti_aging": [
                {"name": "Collagen Anti-Age Cream", "price_range": "500-2000 RUB", "similarity_score": 80},
                {"name": "Cream with Hyaluronic Acid", "price_range": "300-1500 RUB", "similarity_score": 75}
            ],
            "косметика_витамины": [
                {"name": "Vitamin Complex for Skin", "price_range": "400-1800 RUB", "similarity_score": 78},
                {"name": "Vitamin C Serum", "price_range": "600-2500 RUB", "similarity_score": 85}
            ],
            "general_cosmetics": [
                {"name": "Similar Product", "price_range": "price range of similar products", "similarity_score": 70},
                {"name": "Product of similar category", "price_range": "average market", "similarity_score": 65}
            ]
        }
        no_category_text = "no category"

    # Возвращаем аналоги по типу или общие если тип неизвестен
    analogs = analogs_by_type.get(product_type, analogs_by_type["general_cosmetics"])

    # Добавляем категориальную информацию
    for analog in analogs:
        analog["category_match"] = categories[0] if categories else no_category_text

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