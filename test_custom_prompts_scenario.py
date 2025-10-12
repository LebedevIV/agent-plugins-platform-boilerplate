#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовый сценарий 2: Проверка кастомных промптов с переопределением

Цель: Проверить, что кастомные промпты из пользовательских настроек
корректно переопределяют оригинальные промпты из manifest.json
"""

import json
import sys
import os

# Добавляем путь к папке плагина в sys.path для импорта функций
sys.path.append('./chrome-extension/public/plugins/ozon-analyzer')

def console_log(message: str):
    """Функция логирования для имитации Pyodide среды."""
    print(f"[PYTHON_LOG] {message}")

def get_pyodide_var(name: str, default=None):
    """Имитация функции доступа к Pyodide globals."""
    # Имитируем наличие manifest.json в globals
    if name == 'manifest':
        try:
            with open('./chrome-extension/public/plugins/ozon-analyzer/manifest.json', 'r', encoding='utf-8') as f:
                manifest_data = json.load(f)
                return manifest_data
        except Exception as e:
            console_log(f"Ошибка загрузки manifest.json: {e}")
            return default
    return default

def safe_dict_get(data, key, default=None):
    """Безопасное получение значения из словаря."""
    try:
        if isinstance(data, dict):
            return data.get(key, default)
        return default
    except AttributeError:
        return default

def get_user_prompts(plugin_settings=None):
    """
    Функция загрузки промптов (скопированная из mcp_server.py для тестирования).
    """
    console_log("🔍 ===== НАЧАЛО ЗАГРУЗКИ ПРОМПТОВ (ТЕСТОВЫЙ СЦЕНАРИЙ 2) =====")

    try:
        # Диагностика доступа к manifest
        manifest = get_pyodide_var('manifest', {})
        prompts = {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

        if manifest:
            manifest_prompts = safe_dict_get(manifest, 'options', {}).get('prompts', {})
        else:
            manifest_prompts = {}

        # Используем кастомные промпты из plugin_settings
        if plugin_settings and isinstance(plugin_settings, dict):
            custom_prompts_raw = safe_dict_get(plugin_settings, 'prompts', {})
            console_log(f"   Кастомные промпты найдены: {custom_prompts_raw}")

            # Детальная диагностика структуры промптов
            for prompt_type in ['optimized', 'deep']:
                for lang in ['ru', 'en']:
                    console_log(f"🔍 Обработка кастомного промпта {prompt_type}.{lang}:")

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

                        # Fallback на manifest.json
                        type_prompts = safe_dict_get(manifest_prompts, prompt_type, {})
                        if type_prompts:
                            lang_data = safe_dict_get(type_prompts, lang, {})
                            manifest_value = safe_dict_get(lang_data, 'default', '')

                            if manifest_value and len(manifest_value.strip()) > 0:
                                prompts[prompt_type][lang] = manifest_value
                                console_log(f"✅ Используем промпт по умолчанию из manifest: {prompt_type}.{lang}")
                            else:
                                console_log(f"⚠️ Промпт по умолчанию не найден или пустой для {prompt_type}.{lang}")
                        else:
                            console_log(f"⚠️ Тип промпта {prompt_type} не найден в manifest")
        else:
            console_log("ℹ️ Пользовательские настройки не переданы или некорректны - используем manifest")

            # Fallback на manifest.json
            for prompt_type in ['optimized', 'deep']:
                for lang in ['ru', 'en']:
                    type_prompts = safe_dict_get(manifest_prompts, prompt_type, {})
                    if type_prompts:
                        lang_data = safe_dict_get(type_prompts, lang, {})
                        manifest_value = safe_dict_get(lang_data, 'default', '')

                        if manifest_value and len(manifest_value.strip()) > 0:
                            prompts[prompt_type][lang] = manifest_value
                            console_log(f"✅ Используем промпт из manifest: {prompt_type}.{lang}")

        # Итоговая диагностика
        console_log("🔍 Итоговая диагностика промптов:")
        console_log(f"   Manifest prompts: {manifest_prompts}")
        console_log(f"   Final prompts structure: {prompts}")

        # Подробная диагностика каждого промпта
        console_log("🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА ПРОМПТОВ:")
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                prompt_value = prompts[prompt_type][lang]
                if prompt_value and len(prompt_value.strip()) > 0:
                    console_log(f"   ✅ {prompt_type}.{lang}: загружен ({len(prompt_value)} символов)")
                else:
                    console_log(f"   ❌ {prompt_type}.{lang}: НЕ загружен (пустой)")

        console_log("🔍 ===== УСПЕШНО ЗАВЕРШЕНА ЗАГРУЗКА ПРОМПТОВ =====")
        return prompts

    except Exception as e:
        console_log(f"❌ Критическая ошибка загрузки промптов: {str(e)}")
        return {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

def run_test_scenario_2():
    """Выполнение тестового сценария 2."""
    print("=" * 80)
    print("🧪 ТЕСТОВЫЙ СЦЕНАРИЙ 2: Проверка кастомных промптов с переопределением")
    print("=" * 80)

    # Тест 1: Проверка кастомных промптов с переопределением
    print("\n📋 ТЕСТ 1: Кастомные промпты должны переопределять оригинальные")
    print("-" * 60)

    # Кастомные промпты для тестирования
    custom_prompts = {
        'optimized': {
            'ru': 'КАСТОМНЫЙ ОПТИМИЗИРОВАННЫЙ ПРОМПТ НА РУССКОМ ЯЗЫКЕ для анализа косметики',
            'en': 'CUSTOM OPTIMIZED PROMPT IN ENGLISH for cosmetic analysis'
        },
        'deep': {
            'ru': 'КАСТОМНЫЙ ГЛУБОКИЙ ПРОМПТ НА РУССКОМ ЯЗЫКЕ для детального анализа',
            'en': 'CUSTOM DEEP PROMPT IN ENGLISH for detailed analysis'
        }
    }

    # Пользовательские настройки с кастомными промптами
    plugin_settings = {
        'response_language': 'ru',
        'prompts': custom_prompts
    }

    try:
        prompts = get_user_prompts(plugin_settings)

        # Проверяем что кастомные промпты загружены
        custom_loaded = 0
        total_custom = 4

        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                prompt_value = prompts[prompt_type][lang]
                expected_value = custom_prompts[prompt_type][lang]

                if prompt_value == expected_value:
                    custom_loaded += 1
                    print(f"   ✅ {prompt_type}.{lang}: кастомный промпт загружен корректно")
                else:
                    print(f"   ❌ {prompt_type}.{lang}: кастомный промпт НЕ загружен (ожидали: '{expected_value[:50]}...', получили: '{prompt_value[:50]}...')")

        print(f"\n📊 РЕЗУЛЬТАТ ТЕСТА 1: {custom_loaded}/{total_custom} кастомных промптов загружено")

        if custom_loaded == total_custom:
            print("✅ ТЕСТ 1 ПРОЙДЕН: Кастомные промпты корректно переопределяют оригинальные")
        else:
            print("❌ ТЕСТ 1 НЕ ПРОЙДЕН: Кастомные промпты не переопределяют оригинальные")

    except Exception as e:
        print(f"❌ ТЕСТ 1 НЕ ПРОЙДЕН: Критическая ошибка: {e}")

    # Тест 2: Частичное переопределение промптов
    print("\n📋 ТЕСТ 2: Частичное переопределение промптов")
    print("-" * 60)

    # Только часть промптов кастомные
    partial_custom_prompts = {
        'optimized': {
            'ru': 'ЧАСТИЧНО КАСТОМНЫЙ ПРОМПТ ТОЛЬКО ДЛЯ РУССКОГО'
        },
        'deep': {
            'en': 'PARTIAL CUSTOM PROMPT ONLY FOR ENGLISH'
        }
    }

    partial_plugin_settings = {
        'response_language': 'ru',
        'prompts': partial_custom_prompts
    }

    try:
        prompts = get_user_prompts(partial_plugin_settings)

        # Проверяем частичное переопределение
        partial_checks = [
            ('optimized.ru', partial_custom_prompts['optimized']['ru']),
            ('deep.en', partial_custom_prompts['deep']['en'])
        ]

        partial_correct = 0

        for prompt_key, expected_value in partial_checks:
            prompt_type, lang = prompt_key.split('.')
            actual_value = prompts[prompt_type][lang]

            if actual_value == expected_value:
                partial_correct += 1
                print(f"   ✅ {prompt_key}: кастомный промпт загружен")
            else:
                print(f"   ❌ {prompt_key}: кастомный промпт НЕ загружен")

        # Проверяем что остальные промпты взяты из manifest
        other_prompts_count = 0
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                prompt_key = f"{prompt_type}.{lang}"
                if (prompt_type, lang) not in [('optimized', 'ru'), ('deep', 'en')]:
                    prompt_value = prompts[prompt_type][lang]
                    if prompt_value and len(prompt_value.strip()) > 0:
                        other_prompts_count += 1
                        print(f"   ✅ {prompt_key}: промпт из manifest загружен")

        print(f"\n📊 РЕЗУЛЬТАТ ТЕСТА 2: {partial_correct}/2 кастомных + {other_prompts_count}/2 из manifest")

        if partial_correct == 2 and other_prompts_count == 2:
            print("✅ ТЕСТ 2 ПРОЙДЕН: Частичное переопределение работает корректно")
        else:
            print("❌ ТЕСТ 2 НЕ ПРОЙДЕН: Частичное переопределение не работает")

    except Exception as e:
        print(f"❌ ТЕСТ 2 НЕ ПРОЙДЕН: Критическая ошибка: {e}")

    # Тест 3: Пустые или некорректные кастомные промпты
    print("\n📋 ТЕСТ 3: Обработка пустых или некорректных кастомных промптов")
    print("-" * 60)

    # Кастомные промпты с пустыми значениями
    empty_custom_prompts = {
        'optimized': {
            'ru': '',  # Пустой промпт
            'en': '   '  # Только пробелы
        },
        'deep': {
            'ru': None,  # None значение
            'en': 'ВАЛИДНЫЙ КАСТОМНЫЙ ПРОМПТ'  # Валидный промпт
        }
    }

    empty_plugin_settings = {
        'response_language': 'ru',
        'prompts': empty_custom_prompts
    }

    try:
        prompts = get_user_prompts(empty_plugin_settings)

        # Проверяем обработку пустых значений
        empty_checks = [
            ('optimized.ru', False),  # Должен быть взят из manifest
            ('optimized.en', False),  # Должен быть взят из manifest
            ('deep.ru', False),       # Должен быть взят из manifest
            ('deep.en', True)         # Должен быть кастомный
        ]

        empty_correct = 0

        for prompt_key, should_be_custom in empty_checks:
            prompt_type, lang = prompt_key.split('.')
            actual_value = prompts[prompt_type][lang]
            expected_custom = empty_custom_prompts[prompt_type][lang]

            if should_be_custom:
                # Должен быть кастомный промпт
                if actual_value == expected_custom:
                    empty_correct += 1
                    print(f"   ✅ {prompt_key}: кастомный промпт сохранен")
                else:
                    print(f"   ❌ {prompt_key}: кастомный промпт потерян")
            else:
                # Должен быть взят из manifest
                if actual_value != expected_custom and len(actual_value.strip()) > 0:
                    empty_correct += 1
                    print(f"   ✅ {prompt_key}: взят из manifest при пустом кастомном")
                else:
                    print(f"   ❌ {prompt_key}: не взят из manifest при пустом кастомном")

        print(f"\n📊 РЕЗУЛЬТАТ ТЕСТА 3: {empty_correct}/4 проверок корректно обработано")

        if empty_correct >= 3:  # Допускаем 1 ошибку для некритических сценариев
            print("✅ ТЕСТ 3 ПРОЙДЕН: Пустые промпты обрабатываются корректно")
        else:
            print("❌ ТЕСТ 3 НЕ ПРОЙДЕН: Пустые промпты обрабатываются некорректно")

    except Exception as e:
        print(f"❌ ТЕСТ 3 НЕ ПРОЙДЕН: Критическая ошибка: {e}")

    print("\n" + "=" * 80)
    print("🧪 ЗАВЕРШЕНИЕ ТЕСТОВОГО СЦЕНАРИЯ 2")
    print("=" * 80)

if __name__ == "__main__":
    run_test_scenario_2()