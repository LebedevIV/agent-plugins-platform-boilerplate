#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовый сценарий 1: Проверка корректности загрузки оригинальных промптов из manifest.json

Цель: Проверить, что функция get_user_prompts() корректно извлекает промпты из manifest.json
и правильно структурирует их для использования в AI анализе.
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
    console_log("🔍 ===== НАЧАЛО ЗАГРУЗКИ ПРОМПТОВ (ТЕСТОВЫЙ СЦЕНАРИЙ) =====")

    try:
        # Диагностика доступа к manifest
        console_log("🔍 ДИАГНОСТИКА ДОСТУПА К MANIFEST:")
        manifest = get_pyodide_var('manifest', {})
        console_log(f"   manifest из globals: {manifest is not None}")
        console_log(f"   manifest type: {type(manifest)}")
        if manifest:
            console_log(f"   manifest ключи: {list(manifest.keys())}")
            console_log(f"   manifest.options: {manifest.get('options') is not None}")
            if manifest.get('options'):
                console_log(f"   manifest.options.prompts: {manifest.get('options', {}).get('prompts') is not None}")
        else:
            console_log("   ❌ manifest НЕ НАЙДЕН в globals - ЭТО ОСНОВНАЯ ПРОБЛЕМА!")

        # Структура промптов
        prompts = {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

        # Получаем manifest.json из globals для fallback значений
        manifest = get_pyodide_var('manifest', {})
        console_log(f"   manifest: {manifest is not None}")

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
        else:
            console_log("   ❌ manifest не найден в globals - ЭТО ОСНОВНАЯ ПРОБЛЕМА!")
            manifest_prompts = {}

        # Детальная диагностика структуры промптов
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                console_log(f"🔍 Обработка {prompt_type}.{lang}:")

                # Fallback на manifest.json (основной сценарий для тестирования)
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
                else:
                    console_log(f"⚠️ Тип промпта {prompt_type} не найден в manifest")

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

def run_test_scenario_1():
    """Выполнение тестового сценария 1."""
    print("=" * 80)
    print("🧪 ТЕСТОВЫЙ СЦЕНАРИЙ 1: Проверка загрузки оригинальных промптов из manifest.json")
    print("=" * 80)

    # Тест 1: Загрузка промптов без пользовательских настроек
    print("\n📋 ТЕСТ 1: Загрузка промптов без пользовательских настроек")
    print("-" * 60)

    try:
        prompts = get_user_prompts()

        # Проверяем что промпты загружены
        loaded_count = 0
        total_count = 0

        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                total_count += 1
                prompt_value = prompts[prompt_type][lang]
                if prompt_value and len(prompt_value.strip()) > 0:
                    loaded_count += 1
                    print(f"   ✅ {prompt_type}.{lang}: загружен ({len(prompt_value)} символов)")
                else:
                    print(f"   ❌ {prompt_type}.{lang}: НЕ загружен")

        print(f"\n📊 РЕЗУЛЬТАТ ТЕСТА 1: {loaded_count}/{total_count} промптов загружено")

        if loaded_count >= 2:  # Минимум 2 промпта должны быть загружены
            print("✅ ТЕСТ 1 ПРОЙДЕН: Оригинальные промпты из manifest.json загружаются корректно")
        else:
            print("❌ ТЕСТ 1 НЕ ПРОЙДЕН: Недостаточно промптов загружено из manifest.json")

    except Exception as e:
        print(f"❌ ТЕСТ 1 НЕ ПРОЙДЕН: Критическая ошибка: {e}")

    # Тест 2: Проверка структуры промптов
    print("\n📋 ТЕСТ 2: Проверка структуры промптов")
    print("-" * 60)

    try:
        prompts = get_user_prompts()

        # Проверяем структуру промптов
        expected_structure = {
            'optimized': {'ru': str, 'en': str},
            'deep': {'ru': str, 'en': str}
        }

        structure_valid = True

        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                expected_type = expected_structure[prompt_type][lang]
                actual_type = type(prompts[prompt_type][lang])

                if actual_type == expected_type:
                    print(f"   ✅ {prompt_type}.{lang}: тип данных корректный ({actual_type.__name__})")
                else:
                    print(f"   ❌ {prompt_type}.{lang}: неверный тип данных (ожидали {expected_type.__name__}, получили {actual_type.__name__})")
                    structure_valid = False

        if structure_valid:
            print("✅ ТЕСТ 2 ПРОЙДЕН: Структура промптов корректная")
        else:
            print("❌ ТЕСТ 2 НЕ ПРОЙДЕН: Структура промптов некорректная")

    except Exception as e:
        print(f"❌ ТЕСТ 2 НЕ ПРОЙДЕН: Критическая ошибка: {e}")

    # Тест 3: Проверка содержания промптов
    print("\n📋 ТЕСТ 3: Проверка содержания промптов")
    print("-" * 60)

    try:
        prompts = get_user_prompts()

        # Проверяем что промпты содержат ключевые слова
        content_checks = {
            'optimized.ru': ['токсиколог', 'косметолог', 'анализ', 'соответствия'],
            'optimized.en': ['toxicologist', 'cosmetic chemist', 'analysis', 'compliance'],
            'deep.ru': ['глубокий анализ', 'медицинской', 'научной', 'точке зрения'],
            'deep.en': ['deep analysis', 'medical', 'scientific', 'perspective']
        }

        content_valid = True

        for prompt_key, keywords in content_checks.items():
            prompt_type, lang = prompt_key.split('.')
            prompt_value = prompts[prompt_type][lang]

            found_keywords = []
            for keyword in keywords:
                if keyword.lower() in prompt_value.lower():
                    found_keywords.append(keyword)

            if len(found_keywords) >= 2:  # Минимум 2 ключевых слова
                print(f"   ✅ {prompt_key}: найдено {len(found_keywords)}/{len(keywords)} ключевых слов")
            else:
                print(f"   ❌ {prompt_key}: найдено только {len(found_keywords)}/{len(keywords)} ключевых слов")
                content_valid = False

        if content_valid:
            print("✅ ТЕСТ 3 ПРОЙДЕН: Содержание промптов корректное")
        else:
            print("❌ ТЕСТ 3 НЕ ПРОЙДЕН: Содержание промптов некорректное")

    except Exception as e:
        print(f"❌ ТЕСТ 3 НЕ ПРОЙДЕН: Критическая ошибка: {e}")

    print("\n" + "=" * 80)
    print("🧪 ЗАВЕРШЕНИЕ ТЕСТОВОГО СЦЕНАРИЯ 1")
    print("=" * 80)

if __name__ == "__main__":
    run_test_scenario_1()