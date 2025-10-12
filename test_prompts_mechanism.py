#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🧪 ТЕСТОВЫЙ СКРИПТ ДЛЯ ДИАГНОСТИКИ МЕХАНИЗМА ПРОМПТОВ
Диагностирует проблемы передачи промптов из manifest.json в Pyodide контекст
"""

import json
import sys
import os
from typing import Dict, Any

# Добавляем путь к плагину в sys.path для импорта функций
plugin_path = os.path.join(os.path.dirname(__file__), 'chrome-extension/public/plugins/ozon-analyzer')
sys.path.insert(0, plugin_path)

# Загружаем manifest.json для тестирования
def load_manifest():
    """Загружает manifest.json для тестирования"""
    manifest_path = os.path.join(plugin_path, 'manifest.json')
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Ошибка загрузки manifest.json: {e}")
        return None

def simulate_pyodide_globals(manifest: Dict[str, Any]) -> Dict[str, Any]:
    """Симулирует Pyodide globals для тестирования"""
    return {
        'manifest': manifest,
        'pluginSettings': {
            'prompts': {
                'optimized': {
                    'ru': 'КАСТОМНЫЙ ПРОМПТ РУССКИЙ',
                    'en': 'CUSTOM PROMPT ENGLISH'
                },
                'deep': {
                    'ru': 'ГЛУБОКИЙ АНАЛИЗ РУССКИЙ',
                    'en': 'DEEP ANALYSIS ENGLISH'
                }
            }
        }
    }

def simulate_empty_plugin_settings(manifest: Dict[str, Any]) -> Dict[str, Any]:
    """Симулирует пустые настройки пользователя"""
    return {
        'manifest': manifest,
        'pluginSettings': {}
    }

def simulate_broken_manifest() -> Dict[str, Any]:
    """Симулирует поврежденный manifest"""
    return {
        'manifest': {'invalid': 'data'},
        'pluginSettings': {}
    }

def simulate_none_manifest() -> Dict[str, Any]:
    """Симулирует отсутствие manifest"""
    return {
        'pluginSettings': {
            'prompts': {
                'optimized': {
                    'ru': 'ТОЛЬКО КАСТОМНЫЙ ПРОМПТ'
                }
            }
        }
    }

def test_scenario_1_full_custom_prompts():
    """Сценарий 1: Полностью заполненные кастомные промпты"""
    print("\n🧪 СЦЕНАРИЙ 1: Полностью заполненные кастомные промпты")
    print("=" * 60)

    manifest = load_manifest()
    if not manifest:
        print("❌ Не удалось загрузить manifest.json")
        return None

    # Симулируем Pyodide globals
    globals_data = simulate_pyodide_globals(manifest)

    # Импортируем и тестируем функцию
    try:
        from mcp_server import get_user_prompts

        # Мокаем функции для симуляции Pyodide окружения
        def mock_get_pyodide_var(name, default=None):
            return globals_data.get(name, default)

        def mock_safe_dict_get(data, key, default=None):
            if isinstance(data, dict):
                return data.get(key, default)
            return default

        def mock_console_log(message):
            print(f"📋 LOG: {message}")

        # Внедряем моки в глобальное пространство
        import mcp_server
        mcp_server.get_pyodide_var = mock_get_pyodide_var
        mcp_server.safe_dict_get = mock_safe_dict_get
        mcp_server.console_log = mock_console_log

        # Выполняем тест
        plugin_settings = globals_data['pluginSettings']
        result = get_user_prompts(plugin_settings)

        print(f"✅ Результат: {json.dumps(result, ensure_ascii=False, indent=2)}")

        # Проверяем ожидаемые результаты
        expected_results = {
            'optimized': {'ru': 'КАСТОМНЫЙ ПРОМПТ РУССКИЙ', 'en': 'CUSTOM PROMPT ENGLISH'},
            'deep': {'ru': 'ГЛУБОКИЙ АНАЛИЗ РУССКИЙ', 'en': 'DEEP ANALYSIS ENGLISH'}
        }

        success = True
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                if result.get(prompt_type, {}).get(lang) != expected_results[prompt_type][lang]:
                    print(f"❌ Несоответствие в {prompt_type}.{lang}")
                    success = False

        if success:
            print("✅ Сценарий 1 ПРОЙДЕН: Кастомные промпты корректно используются")
        else:
            print("❌ Сценарий 1 ПРОВАЛЕН: Кастомные промпты не используются правильно")

        return result

    except Exception as e:
        print(f"❌ Ошибка при тестировании сценария 1: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_scenario_2_empty_custom_prompts():
    """Сценарий 2: Пустые кастомные промпты (fallback на manifest)"""
    print("\n🧪 СЦЕНАРИЙ 2: Пустые кастомные промпты (fallback на manifest)")
    print("=" * 60)

    manifest = load_manifest()
    if not manifest:
        print("❌ Не удалось загрузить manifest.json")
        return None

    # Симулируем Pyodide globals с пустыми промптами
    globals_data = simulate_empty_plugin_settings(manifest)

    try:
        from mcp_server import get_user_prompts

        # Мокаем функции
        def mock_get_pyodide_var(name, default=None):
            return globals_data.get(name, default)

        def mock_safe_dict_get(data, key, default=None):
            if isinstance(data, dict):
                return data.get(key, default)
            return default

        def mock_console_log(message):
            print(f"📋 LOG: {message}")

        # Внедряем моки
        import mcp_server
        mcp_server.get_pyodide_var = mock_get_pyodide_var
        mcp_server.safe_dict_get = mock_safe_dict_get
        mcp_server.console_log = mock_console_log

        # Выполняем тест
        plugin_settings = globals_data['pluginSettings']
        result = get_user_prompts(plugin_settings)

        print(f"✅ Результат: {json.dumps(result, ensure_ascii=False, indent=2)}")

        # Проверяем что используются промпты из manifest
        manifest_prompts = manifest.get('options', {}).get('prompts', {})
        success = True

        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                manifest_value = manifest_prompts.get(prompt_type, {}).get(lang, {}).get('default', '')
                result_value = result.get(prompt_type, {}).get(lang, '')

                if manifest_value and result_value == manifest_value:
                    print(f"✅ {prompt_type}.{lang}: Используется промпт из manifest")
                else:
                    print(f"❌ {prompt_type}.{lang}: Несоответствие промпта из manifest")
                    success = False

        if success:
            print("✅ Сценарий 2 ПРОЙДЕН: Fallback на manifest работает корректно")
        else:
            print("❌ Сценарий 2 ПРОВАЛЕН: Fallback на manifest не работает")

        return result

    except Exception as e:
        print(f"❌ Ошибка при тестировании сценария 2: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_scenario_3_broken_manifest():
    """Сценарий 3: Поврежденный manifest.json"""
    print("\n🧪 СЦЕНАРИЙ 3: Поврежденный manifest.json")
    print("=" * 60)

    globals_data = simulate_broken_manifest()

    try:
        from mcp_server import get_user_prompts

        # Мокаем функции
        def mock_get_pyodide_var(name, default=None):
            return globals_data.get(name, default)

        def mock_safe_dict_get(data, key, default=None):
            if isinstance(data, dict):
                return data.get(key, default)
            return default

        def mock_console_log(message):
            print(f"📋 LOG: {message}")

        def mock_get_builtin_default_prompt(prompt_type, lang):
            return f"ВСТРОЕННЫЙ ПРОМПТ {prompt_type}.{lang}"

        # Внедряем моки
        import mcp_server
        mcp_server.get_pyodide_var = mock_get_pyodide_var
        mcp_server.safe_dict_get = mock_safe_dict_get
        mcp_server.console_log = mock_console_log
        mcp_server._get_builtin_default_prompt = mock_get_builtin_default_prompt

        # Выполняем тест
        plugin_settings = globals_data['pluginSettings']
        result = get_user_prompts(plugin_settings)

        print(f"✅ Результат: {json.dumps(result, ensure_ascii=False, indent=2)}")

        # Проверяем что используется fallback на встроенные промпты
        success = True
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                expected_value = f"ВСТРОЕННЫЙ ПРОМПТ {prompt_type}.{lang}"
                result_value = result.get(prompt_type, {}).get(lang, '')

                if result_value == expected_value:
                    print(f"✅ {prompt_type}.{lang}: Используется встроенный промпт")
                else:
                    print(f"❌ {prompt_type}.{lang}: Несоответствие встроенного промпта")
                    success = False

        if success:
            print("✅ Сценарий 3 ПРОЙДЕН: Fallback на встроенные промпты работает")
        else:
            print("❌ Сценарий 3 ПРОВАЛЕН: Fallback на встроенные промпты не работает")

        return result

    except Exception as e:
        print(f"❌ Ошибка при тестировании сценария 3: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_scenario_4_missing_manifest():
    """Сценарий 4: Отсутствующий manifest в globals"""
    print("\n🧪 СЦЕНАРИЙ 4: Отсутствующий manifest в globals")
    print("=" * 60)

    globals_data = simulate_none_manifest()

    try:
        from mcp_server import get_user_prompts

        # Мокаем функции
        def mock_get_pyodide_var(name, default=None):
            return globals_data.get(name, default)

        def mock_safe_dict_get(data, key, default=None):
            if isinstance(data, dict):
                return data.get(key, default)
            return default

        def mock_console_log(message):
            print(f"📋 LOG: {message}")

        def mock_get_builtin_default_prompt(prompt_type, lang):
            return f"ВСТРОЕННЫЙ ПРОМПТ {prompt_type}.{lang}"

        # Внедряем моки
        import mcp_server
        mcp_server.get_pyodide_var = mock_get_pyodide_var
        mcp_server.safe_dict_get = mock_safe_dict_get
        mcp_server.console_log = mock_console_log
        mcp_server._get_builtin_default_prompt = mock_get_builtin_default_prompt

        # Выполняем тест
        plugin_settings = globals_data['pluginSettings']
        result = get_user_prompts(plugin_settings)

        print(f"✅ Результат: {json.dumps(result, ensure_ascii=False, indent=2)}")

        # Проверяем что используется кастомный промпт и встроенные для остальных
        success = True

        # optimized.ru должен быть кастомным
        if result.get('optimized', {}).get('ru') == 'ТОЛЬКО КАСТОМНЫЙ ПРОМПТ':
            print("✅ optimized.ru: Используется кастомный промпт")
        else:
            print("❌ optimized.ru: Кастомный промпт не используется")
            success = False

        # optimized.en должен быть встроенным (отсутствует в кастомных)
        if result.get('optimized', {}).get('en') == 'ВСТРОЕННЫЙ ПРОМПТ optimized.en':
            print("✅ optimized.en: Используется встроенный промпт")
        else:
            print("❌ optimized.en: Встроенный промпт не используется")
            success = False

        if success:
            print("✅ Сценарий 4 ПРОЙДЕН: Частичный fallback работает корректно")
        else:
            print("❌ Сценарий 4 ПРОВАЛЕН: Частичный fallback не работает")

        return result

    except Exception as e:
        print(f"❌ Ошибка при тестировании сценария 4: {e}")
        import traceback
        traceback.print_exc()
        return None

def run_diagnostic_tests():
    """Запуск всех диагностических тестов"""
    print("🔍 НАЧИНАЕМ ДИАГНОСТИКУ МЕХАНИЗМА ПРОМПТОВ")
    print("=" * 80)

    # Тест 1: Анализ структуры manifest.json
    print("\n📋 АНАЛИЗ СТРУКТУРЫ MANIFEST.JSON")
    print("=" * 40)

    manifest = load_manifest()
    if manifest:
        print("✅ manifest.json загружен успешно")

        # Анализируем структуру промптов
        options = manifest.get('options', {})
        prompts = options.get('prompts', {})

        print(f"📊 Структура промптов в manifest:")
        print(f"   Типы промптов: {list(prompts.keys())}")

        for prompt_type in ['optimized', 'deep']:
            if prompt_type in prompts:
                print(f"   {prompt_type}:")
                type_prompts = prompts[prompt_type]
                for lang in ['ru', 'en']:
                    if lang in type_prompts:
                        lang_data = type_prompts[lang]
                        default_value = lang_data.get('default', '')
                        print(f"     {lang}: длина={len(default_value)} символов")
                        print(f"       Предварительный просмотр: {default_value[:100]}...")
                    else:
                        print(f"     {lang}: ОТСУТСТВУЕТ")
            else:
                print(f"   {prompt_type}: ОТСУТСТВУЕТ")
    else:
        print("❌ Не удалось загрузить manifest.json")

    # Запуск тестовых сценариев
    results = {}

    print("\n🚀 ЗАПУСК ТЕСТОВЫХ СЦЕНАРИЕВ")
    print("=" * 40)

    results['scenario_1'] = test_scenario_1_full_custom_prompts()
    results['scenario_2'] = test_scenario_2_empty_custom_prompts()
    results['scenario_3'] = test_scenario_3_broken_manifest()
    results['scenario_4'] = test_scenario_4_missing_manifest()

    # Анализ результатов
    print("\n📊 АНАЛИЗ РЕЗУЛЬТАТОВ ТЕСТИРОВАНИЯ")
    print("=" * 50)

    passed = 0
    total = 0

    for scenario_name, result in results.items():
        total += 1
        if result is not None:
            passed += 1
            print(f"✅ {scenario_name}: ПРОЙДЕН")
        else:
            print(f"❌ {scenario_name}: ПРОВАЛЕН")

    print(f"\n📈 ИТОГ: {passed}/{total} сценариев пройдено")

    if passed == total:
        print("🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Механизм промптов работает корректно.")
    else:
        print("⚠️ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ! Требуется дополнительная диагностика.")

    return results

if __name__ == "__main__":
    run_diagnostic_tests()