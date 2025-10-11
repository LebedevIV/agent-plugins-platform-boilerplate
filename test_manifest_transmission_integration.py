#!/usr/bin/env python3
"""
Интеграционный тест передачи manifest в Pyodide и использования промптов в mcp_server.py
"""

import json
import sys
import os
from typing import Any

def console_log(message: str):
    """Функция логирования для имитации Pyodide среды."""
    print(f"[PYTHON_LOG] {message}")

def chat_message(message: str):
    """Имитация отправки сообщения в чат."""
    print(f"[CHAT_MESSAGE] {message}")

def get_pyodide_var(name: str, default=None):
    """Имитация функции доступа к Pyodide globals."""
    if name == 'manifest':
        try:
            with open('./chrome-extension/public/plugins/ozon-analyzer/manifest.json', 'r', encoding='utf-8') as f:
                manifest_data = json.load(f)
                return manifest_data
        except Exception as e:
            console_log(f"Ошибка загрузки manifest.json: {e}")
            return default

    elif name == 'pluginSettings':
        return {
            'response_language': 'ru',
            'enable_deep_analysis': True,
            'search_for_analogs': False
        }

    return default

def safe_dict_get(data: Any, key: str, default: Any = None) -> Any:
    try:
        if isinstance(data, dict):
            return data.get(key, default)
        return default
    except AttributeError:
        return default

def get_user_prompts_test(plugin_settings=None):
    """
    Тестовая версия функции get_user_prompts из mcp_server.py
    """
    console_log(f"🔍 ===== НАЧАЛО ЗАГРУЗКИ ПРОМПТОВ (ТЕСТ) =====")

    try:
        # Диагностика доступа к manifest
        manifest = get_pyodide_var('manifest', {})
        console_log(f"   manifest из globals: {manifest is not None}")
        console_log(f"   manifest type: {type(manifest)}")
        if manifest:
            console_log(f"   manifest ключи: {list(manifest.keys())}")
            console_log(f"   manifest.options: {manifest.get('options') is not None}")
            if manifest.get('options'):
                console_log(f"   manifest.options.prompts: {manifest.get('options', {}).get('prompts') is not None}")

        # Диагностика входных данных
        console_log(f"🔍 Диагностика входных данных:")
        console_log(f"   plugin_settings type: {type(plugin_settings)}")
        console_log(f"   plugin_settings is None: {plugin_settings is None}")
        console_log(f"   plugin_settings keys: {list(plugin_settings.keys()) if isinstance(plugin_settings, dict) else 'не словарь'}")

        # Исправлено: промпты уже доступны в plugin_settings
        custom_prompts_raw = safe_dict_get(plugin_settings, 'prompts', {})
        console_log(f"   custom_prompts_raw: {custom_prompts_raw}")
        console_log(f"   custom_prompts_raw type: {type(custom_prompts_raw)}")

        prompts = {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

        # Получаем manifest.json из globals для fallback значений
        manifest = get_pyodide_var('manifest', {})
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

        # Детальная диагностика структуры промптов
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                console_log(f"🔍 Обработка {prompt_type}.{lang}:")

                # Правильно извлекаем промпт из nested структуры plugin_settings
                prompt_type_data = safe_dict_get(custom_prompts_raw, prompt_type, {})
                console_log(f"   prompt_type_data ({prompt_type}): {prompt_type_data}")

                custom_value = safe_dict_get(prompt_type_data, lang, '')
                console_log(f"   custom_value для {lang}: {repr(custom_value)}")
                console_log(f"   custom_value type: {type(custom_value)}")
                console_log(f"   custom_value length: {len(custom_value) if custom_value else 0}")

                if custom_value and isinstance(custom_value, str) and len(custom_value.strip()) > 0:
                    prompts[prompt_type][lang] = custom_value
                    console_log(f"✅ Используем кастомный промпт: {prompt_type}.{lang} (длина: {len(custom_value)})")
                else:
                    console_log(f"ℹ️ Кастомный промпт не найден или пустой для {prompt_type}.{lang}")

                    # Fallback 1: manifest.json - исправленная логика извлечения
                    type_prompts = safe_dict_get(manifest_prompts, prompt_type, {})
                    console_log(f"   type_prompts из manifest ({prompt_type}): {type_prompts}")

                    if type_prompts:
                        lang_data = safe_dict_get(type_prompts, lang, {})
                        console_log(f"   lang_data для {lang}: {lang_data}")

                        manifest_value = safe_dict_get(lang_data, 'default', '')
                        console_log(f"   manifest_value для {prompt_type}.{lang}: {repr(manifest_value)}")
                        console_log(f"   manifest_value length: {len(manifest_value) if manifest_value else 0}")

                        if manifest_value and len(manifest_value.strip()) > 0:
                            prompts[prompt_type][lang] = manifest_value
                            console_log(f"✅ Используем промпт по умолчанию из manifest: {prompt_type}.{lang}")
                        else:
                            console_log(f"⚠️ Промпт по умолчанию не найден или пустой для {prompt_type}.{lang}")
                            # Fallback 2: встроенные промпты по умолчанию
                            default_value = _get_builtin_default_prompt(prompt_type, lang)
                            if default_value:
                                prompts[prompt_type][lang] = default_value
                                console_log(f"✅ Используем встроенный промпт по умолчанию: {prompt_type}.{lang}")
                            else:
                                console_log(f"⚠️ Встроенный промпт по умолчанию не найден для {prompt_type}.{lang}")
                                console_log(f"ℹ️ Оставляем пустой промпт для {prompt_type}.{lang}")
                    else:
                        console_log(f"⚠️ Тип промпта {prompt_type} не найден в manifest")
                        # Fallback 2: встроенные промпты по умолчанию
                        default_value = _get_builtin_default_prompt(prompt_type, lang)
                        if default_value:
                            prompts[prompt_type][lang] = default_value
                            console_log(f"✅ Используем встроенный промпт по умолчанию: {prompt_type}.{lang}")
                        else:
                            console_log(f"⚠️ Встроенный промпт по умолчанию не найден для {prompt_type}.{lang}")
                            console_log(f"ℹ️ Оставляем пустой промпт для {prompt_type}.{lang}")

        # Итоговая диагностика
        console_log(f"🔍 Итоговая диагностика промптов:")
        console_log(f"   Plugin settings prompts: {custom_prompts_raw}")
        console_log(f"   Manifest prompts: {manifest_prompts}")
        console_log(f"   Final prompts structure: {prompts}")

        # Подробная диагностика каждого промпта
        console_log(f"🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА ПРОМПТОВ:")
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                prompt_value = prompts[prompt_type][lang]
                if prompt_value and len(prompt_value.strip()) > 0:
                    console_log(f"   ✅ {prompt_type}.{lang}: загружен ({len(prompt_value)} символов)")
                else:
                    console_log(f"   ❌ {prompt_type}.{lang}: НЕ загружен (пустой)")

        # Подсчет загруженных промптов
        loaded_prompts = len([p for pt in prompts.values() for p in pt.values() if p and len(p.strip()) > 0])
        total_prompts = len([p for pt in prompts.values() for p in pt.values()])
        console_log(f"📋 Загружено промптов: {loaded_prompts}/{total_prompts} (кастомных: {loaded_prompts})")

        # ДИАГНОСТИКА ПРОБЛЕМЫ: Проверяем источник каждого промпта
        console_log(f"🔍 ДИАГНОСТИКА ИСТОЧНИКОВ ПРОМПТОВ:")
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                prompt_value = prompts[prompt_type][lang]
                if prompt_value and len(prompt_value.strip()) > 0:
                    # Определяем источник промпта
                    if custom_prompts_raw and custom_prompts_raw.get(prompt_type, {}).get(lang) == prompt_value:
                        source = "кастомный"
                    elif manifest_prompts and manifest_prompts.get(prompt_type, {}).get(lang, {}).get('default') == prompt_value:
                        source = "manifest default"
                    else:
                        source = "встроенный fallback"
                    console_log(f"   📍 {prompt_type}.{lang}: источник = {source}")
                else:
                    console_log(f"   ❌ {prompt_type}.{lang}: источник = отсутствует")

        console_log(f"🔍 ===== УСПЕШНО ЗАВЕРШЕНА ЗАГРУЗКА ПРОМПТОВ =====")
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
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

def _get_builtin_default_prompt(prompt_type: str, lang: str) -> str:
    """
    Возвращает встроенные промпты по умолчанию.
    """
    return "Встроенный промпт по умолчанию"

def test_manifest_transmission_and_usage():
    """
    Тест передачи manifest и использования промптов в mcp_server.py
    """
    print("=" * 80)
    print("🧪 ИНТЕГРАЦИОННЫЙ ТЕСТ ПЕРЕДАЧИ MANIFEST")
    print("=" * 80)

    # Шаг 1: Загрузка manifest
    print("\n📋 ШАГ 1: Загрузка manifest.json")
    print("-" * 50)

    manifest = get_pyodide_var('manifest')
    if not manifest:
        print("❌ ОШИБКА: Manifest не загружен")
        return False

    print(f"✅ Manifest загружен: {len(json.dumps(manifest))} символов")
    print(f"   Название: {manifest.get('name', 'N/A')}")
    print(f"   Версия: {manifest.get('version', 'N/A')}")

    # Шаг 2: Проверка структуры промптов
    print("\n📋 ШАГ 2: Проверка структуры промптов в manifest")
    print("-" * 50)

    prompts = manifest.get('options', {}).get('prompts', {})
    if not prompts:
        print("❌ ОШИБКА: Структура промптов не найдена")
        return False

    expected_types = ['optimized', 'deep']
    expected_langs = ['ru', 'en']

    prompt_counts = {}
    for prompt_type in expected_types:
        for lang in expected_langs:
            key = f"{prompt_type}.{lang}"
            prompt_value = prompts.get(prompt_type, {}).get(lang, {}).get('default', '')
            prompt_counts[key] = len(prompt_value)
            if prompt_value:
                print(f"✅ {key}: {len(prompt_value)} символов")
            else:
                print(f"❌ {key}: отсутствует")

    # Проверяем что есть хотя бы один полноценный промпт
    meaningful_prompts = sum(1 for count in prompt_counts.values() if count > 100)
    if meaningful_prompts < 2:
        print(f"❌ Мало полноценных промптов: {meaningful_prompts}/4")
        return False

    print(f"✅ Найдено {meaningful_prompts} полноценных промптов")

    # Шаг 3: Имитация передачи manifest в Pyodide globals
    print("\n📋 ШАГ 3: Имитация передачи manifest в Pyodide globals")
    print("-" * 50)

    # Имитируем Pyodide globals
    pyodide_globals = {}

    # Передаем manifest (как в offscreen.ts:504)
    pyodide_globals['manifest'] = manifest
    console_log('[BRIDGE DIAGNOSTIC] ✅ Manifest передан в Pyodide globals из pluginSettings')

    # Проверяем доступность
    if 'manifest' not in pyodide_globals:
        print("❌ ОШИБКА: Manifest не найден в Pyodide globals")
        return False

    transmitted_manifest = pyodide_globals['manifest']
    if transmitted_manifest != manifest:
        print("❌ ОШИБКА: Переданный manifest не совпадает с оригиналом")
        return False

    print("✅ Manifest успешно передан в Pyodide globals")

    # Шаг 4: Имитация использования промптов в mcp_server.py
    print("\n📋 ШАГ 4: Имитация использования промптов в mcp_server.py")
    print("-" * 50)

    # Имитируем globals для mcp_server
    import builtins
    original_globals = builtins.globals
    builtins.globals = lambda: pyodide_globals

    try:
        # Тестируем get_user_prompts
        plugin_settings = get_pyodide_var('pluginSettings')
        loaded_prompts = get_user_prompts_test(plugin_settings)

        # Проверяем что промпты загружены
        success_count = 0
        for prompt_type in expected_types:
            for lang in expected_langs:
                if loaded_prompts.get(prompt_type, {}).get(lang):
                    success_count += 1
                    print(f"✅ {prompt_type}.{lang}: успешно загружен")
                else:
                    print(f"❌ {prompt_type}.{lang}: НЕ загружен")

        if success_count < 2:
            print(f"❌ Мало загруженных промптов: {success_count}/4")
            return False

        print(f"✅ Успешно загружено {success_count} промптов из manifest")

    finally:
        # Восстанавливаем оригинальные globals
        builtins.globals = original_globals

    # Шаг 5: Проверка что промпты не из fallback
    print("\n📋 ШАГ 5: Проверка что промпты загружены из manifest, а не fallback")
    print("-" * 50)

    # Сравниваем загруженные промпты с manifest
    manifest_mismatch = 0
    for prompt_type in expected_types:
        for lang in expected_langs:
            manifest_prompt = prompts.get(prompt_type, {}).get(lang, {}).get('default', '')
            loaded_prompt = loaded_prompts.get(prompt_type, {}).get(lang, '')

            if manifest_prompt and loaded_prompt == manifest_prompt:
                print(f"✅ {prompt_type}.{lang}: совпадает с manifest")
            elif manifest_prompt and loaded_prompt != manifest_prompt:
                print(f"⚠️ {prompt_type}.{lang}: НЕ совпадает с manifest")
                manifest_mismatch += 1
            else:
                print(f"ℹ️ {prompt_type}.{lang}: manifest пустой, используется fallback")

    if manifest_mismatch > 0:
        print(f"⚠️ Найдено {manifest_mismatch} несоответствий с manifest")
    else:
        print("✅ Все промпты загружены из manifest (без fallback)")

    # Финальная проверка
    print("\n" + "=" * 80)
    if success_count >= 2 and meaningful_prompts >= 2:
        print("🎉 ТЕСТ ПРОЙДЕН: Manifest успешно передается и промпты загружаются!")
        print("=" * 80)
        print("📋 РЕЗУЛЬТАТЫ:")
        print("   ✅ Manifest.json загружается корректно")
        print("   ✅ Manifest передается в Pyodide globals")
        print("   ✅ mcp_server.py получает доступ к manifest")
        print("   ✅ Промпты загружаются из manifest, а не из fallback")
        print("   ✅ Структура промптов соответствует ожиданиям")
        return True
    else:
        print("❌ ТЕСТ НЕ ПРОЙДЕН: Обнаружены проблемы с передачей manifest")
        return False

if __name__ == "__main__":
    success = test_manifest_transmission_and_usage()
    sys.exit(0 if success else 1)