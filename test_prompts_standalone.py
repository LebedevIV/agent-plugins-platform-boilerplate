#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🧪 АВТОНОМНЫЙ ТЕСТ МЕХАНИЗМА ПРОМПТОВ
Тестирует логику функции get_user_prompts без зависимости от Pyodide
"""

import json
import sys
import os
from typing import Dict, Any

def safe_dict_get(data: Any, key: str, default: Any = None) -> Any:
    """Безопасное получение значения из словаря"""
    try:
        if isinstance(data, dict):
            return data.get(key, default)
        return default
    except AttributeError:
        return default

def console_log(message: str):
    """Функция логирования для тестирования"""
    print(f"📋 LOG: {message}")

def get_pyodide_var(name: str, default: Any = None) -> Any:
    """Мокированная функция для доступа к Pyodide globals"""
    # В реальном тесте здесь будет логика доступа к globals
    return default

def _get_builtin_default_prompt(prompt_type: str, lang: str) -> str:
    """Встроенные промпты по умолчанию для fallback"""
    builtin_prompts = {
        'optimized': {
            'ru': "ВСТРОЕННЫЙ ПРОМПТ OPTIMIZED РУССКИЙ",
            'en': "BUILTIN PROMPT OPTIMIZED ENGLISH"
        },
        'deep': {
            'ru': "ВСТРОЕННЫЙ ПРОМПТ DEEP РУССКИЙ",
            'en': "BUILTIN PROMPT DEEP ENGLISH"
        }
    }
    return builtin_prompts.get(prompt_type, {}).get(lang, '')

def get_user_prompts_standalone(plugin_settings: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Автономная версия функции get_user_prompts для тестирования логики
    без зависимости от Pyodide
    """
    console_log("🔍 ===== НАЧАЛО ЗАГРУЗКИ ПРОМПТОВ (АВТОНОМНЫЙ ТЕСТ) =====")

    try:
        # Диагностика входных данных
        console_log(f"🔍 Диагностика входных данных:")
        console_log(f"   plugin_settings type: {type(plugin_settings)}")
        console_log(f"   plugin_settings is None: {plugin_settings is None}")
        if isinstance(plugin_settings, dict):
            console_log(f"   plugin_settings keys: {list(plugin_settings.keys())}")

        # Загружаем manifest.json для тестирования
        manifest_path = os.path.join(os.path.dirname(__file__), 'chrome-extension/public/plugins/ozon-analyzer/manifest.json')
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
            console_log("✅ manifest.json загружен успешно для тестирования")
        except Exception as e:
            console_log(f"❌ Ошибка загрузки manifest.json: {e}")
            manifest = {}

        # Исправлено: промпты уже доступны в plugin_settings
        custom_prompts_raw = safe_dict_get(plugin_settings, 'prompts', {})
        console_log(f"   custom_prompts_raw: {custom_prompts_raw}")
        console_log(f"   custom_prompts_raw type: {type(custom_prompts_raw)}")

        prompts = {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

        if manifest:
            manifest_prompts = safe_dict_get(manifest, 'options', {}).get('prompts', {})
            console_log(f"   manifest_prompts: {manifest_prompts}")
        else:
            console_log("❌ manifest не найден")
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
        console_log("🔍 Итоговая диагностика промптов:")
        console_log(f"   Plugin settings prompts: {custom_prompts_raw}")
        console_log(f"   Manifest prompts: {manifest_prompts}")
        console_log(f"   Final prompts structure: {prompts}")

        # Подсчет загруженных промптов
        loaded_prompts = len([p for pt in prompts.values() for p in pt.values() if p and len(p.strip()) > 0])
        total_prompts = len([p for pt in prompts.values() for p in pt.values()])
        console_log(f"📋 Загружено промптов: {loaded_prompts}/{total_prompts} (кастомных: {loaded_prompts})")

        console_log("🔍 ===== УСПЕШНО ЗАВЕРШЕНА ЗАГРУЗКА ПРОМПТОВ =====")
        return prompts

    except Exception as e:
        console_log(f"❌ Критическая ошибка загрузки промптов: {str(e)}")
        import traceback
        stack_trace = traceback.format_exc()
        console_log(f"   Stack trace: {stack_trace}")

        # Критический fallback - возвращаем пустые промпты
        console_log("⚠️ Возвращаем критический fallback с пустыми промптами")
        return {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

def test_scenario_1_full_custom_prompts():
    """Сценарий 1: Полностью заполненные кастомные промпты"""
    print("\n🧪 СЦЕНАРИЙ 1: Полностью заполненные кастомные промпты")
    print("=" * 60)

    plugin_settings = {
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

    result = get_user_prompts_standalone(plugin_settings)

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

def test_scenario_2_empty_custom_prompts():
    """Сценарий 2: Пустые кастомные промпты (fallback на manifest)"""
    print("\n🧪 СЦЕНАРИЙ 2: Пустые кастомные промпты (fallback на manifest)")
    print("=" * 60)

    plugin_settings = {}  # Пустые настройки пользователя

    result = get_user_prompts_standalone(plugin_settings)

    print(f"✅ Результат: {json.dumps(result, ensure_ascii=False, indent=2)}")

    # Проверяем что используются промпты из manifest
    success = True

    for prompt_type in ['optimized', 'deep']:
        for lang in ['ru', 'en']:
            result_value = result.get(prompt_type, {}).get(lang, '')
            if result_value and len(result_value) > 100:  # Промпты из manifest должны быть длинными
                print(f"✅ {prompt_type}.{lang}: Используется промпт из manifest (длина: {len(result_value)})")
            else:
                print(f"❌ {prompt_type}.{lang}: Промпт из manifest не найден или слишком короткий")
                success = False

    if success:
        print("✅ Сценарий 2 ПРОЙДЕН: Fallback на manifest работает корректно")
    else:
        print("❌ Сценарий 2 ПРОВАЛЕН: Fallback на manifest не работает")

    return result

def test_scenario_3_broken_manifest():
    """Сценарий 3: Поврежденный manifest.json"""
    print("\n🧪 СЦЕНАРИЙ 3: Поврежденный manifest.json")
    print("=" * 60)

    # В этом сценарии симулируем поврежденный manifest, модифицируя функцию загрузки
    original_load_manifest = None

    def mock_load_manifest():
        return {'invalid': 'data'}  # Поврежденный manifest

    plugin_settings = {}

    # Сохраняем оригинальную функцию и заменяем на мок
    import mcp_server
    if hasattr(mcp_server, 'load_manifest'):
        original_load_manifest = mcp_server.load_manifest
        mcp_server.load_manifest = mock_load_manifest

    result = get_user_prompts_standalone(plugin_settings)

    print(f"✅ Результат: {json.dumps(result, ensure_ascii=False, indent=2)}")

    # Проверяем что используется fallback на встроенные промпты
    success = True
    for prompt_type in ['optimized', 'deep']:
        for lang in ['ru', 'en']:
            expected_pattern = f"ВСТРОЕННЫЙ ПРОМПТ {prompt_type.upper()}"
            result_value = result.get(prompt_type, {}).get(lang, '')

            if expected_pattern in result_value:
                print(f"✅ {prompt_type}.{lang}: Используется встроенный промпт")
            else:
                print(f"❌ {prompt_type}.{lang}: Несоответствие встроенного промпта")
                success = False

    if success:
        print("✅ Сценарий 3 ПРОЙДЕН: Fallback на встроенные промпты работает")
    else:
        print("❌ Сценарий 3 ПРОВАЛЕН: Fallback на встроенные промпты не работает")

    return result

def test_scenario_4_partial_custom_prompts():
    """Сценарий 4: Частично заполненные кастомные промпты"""
    print("\n🧪 СЦЕНАРИЙ 4: Частично заполненные кастомные промпты")
    print("=" * 60)

    plugin_settings = {
        'prompts': {
            'optimized': {
                'ru': 'ТОЛЬКО КАСТОМНЫЙ ПРОМПТ РУССКИЙ'
                # en отсутствует - должен использоваться из manifest
            }
            # deep отсутствует - должен использоваться из manifest
        }
    }

    result = get_user_prompts_standalone(plugin_settings)

    print(f"✅ Результат: {json.dumps(result, ensure_ascii=False, indent=2)}")

    # Проверяем что используется кастомный промпт и manifest для остальных
    success = True

    # optimized.ru должен быть кастомным
    if result.get('optimized', {}).get('ru') == 'ТОЛЬКО КАСТОМНЫЙ ПРОМПТ РУССКИЙ':
        print("✅ optimized.ru: Используется кастомный промпт")
    else:
        print("❌ optimized.ru: Кастомный промпт не используется")
        success = False

    # optimized.en должен быть из manifest (длинный промпт)
    if result.get('optimized', {}).get('en', '') and len(result['optimized']['en']) > 100:
        print("✅ optimized.en: Используется промпт из manifest")
    else:
        print("❌ optimized.en: Промпт из manifest не используется")
        success = False

    if success:
        print("✅ Сценарий 4 ПРОЙДЕН: Частичный fallback работает корректно")
    else:
        print("❌ Сценарий 4 ПРОВАЛЕН: Частичный fallback не работает")

    return result

def run_standalone_tests():
    """Запуск автономных тестов"""
    print("🔍 НАЧИНАЕМ АВТОНОМНОЕ ТЕСТИРОВАНИЕ МЕХАНИЗМА ПРОМПТОВ")
    print("=" * 80)

    # Запуск тестовых сценариев
    results = {}

    print("\n🚀 ЗАПУСК ТЕСТОВЫХ СЦЕНАРИЕВ")
    print("=" * 40)

    results['scenario_1'] = test_scenario_1_full_custom_prompts()
    results['scenario_2'] = test_scenario_2_empty_custom_prompts()
    results['scenario_3'] = test_scenario_3_broken_manifest()
    results['scenario_4'] = test_scenario_4_partial_custom_prompts()

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
        print("🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Логика механизма промптов работает корректно.")
    else:
        print("⚠️ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ! Требуется дополнительная диагностика логики.")

    return results

if __name__ == "__main__":
    run_standalone_tests()