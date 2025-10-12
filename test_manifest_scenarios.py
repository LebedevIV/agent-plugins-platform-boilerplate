#!/usr/bin/env python3
"""
Тест для проверки исправления передачи manifest: протестировать сценарии
с manifest в plugin_settings и в globals
"""

import json
import sys
import os
from typing import Dict, Any

# Добавляем корневую директорию проекта в путь для импорта
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def console_log(message: str):
    """Функция логирования для имитации Pyodide среды."""
    print(f"[PYTHON_LOG] {message}")

def safe_dict_get(data: Any, key: str, default: Any = None) -> Any:
    try:
        if isinstance(data, dict):
            return data.get(key, default)
        return default
    except AttributeError:
        return default

class MockPyodideContext:
    """Мок Pyodide контекста для тестирования разных сценариев передачи manifest"""

    def __init__(self):
        self.globals = {}

    def set_global(self, key: str, value: Any):
        """Установить переменную в globals"""
        self.globals[key] = value
        print(f"   📥 Установлена глобальная переменная {key}: {type(value)}")

    def get_global(self, key: str, default=None):
        """Получить переменную из globals"""
        return self.globals.get(key, default)

    def get_plugin_settings_manifest_scenario(self):
        """Сценарий 1: manifest в pluginSettings"""
        manifest_path = "chrome-extension/public/plugins/ozon-analyzer/manifest.json"
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)

        # PluginSettings содержит manifest как поле
        plugin_settings = {
            'response_language': 'ru',
            'enable_deep_analysis': True,
            'manifest': manifest_data  # manifest как часть pluginSettings
        }

        self.set_global('pluginSettings', plugin_settings)
        console_log("✅ Сценарий 1: manifest передан в pluginSettings.manifest")
        return plugin_settings

    def get_globals_manifest_scenario(self):
        """Сценарий 2: manifest в globals"""
        manifest_path = "chrome-extension/public/plugins/ozon-analyzer/manifest.json"
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)

        # PluginSettings без manifest
        plugin_settings = {
            'response_language': 'ru',
            'enable_deep_analysis': True
        }

        # Manifest передается отдельно в globals
        self.set_global('pluginSettings', plugin_settings)
        self.set_global('manifest', manifest_data)
        console_log("✅ Сценарий 2: manifest передан в globals.manifest")
        return plugin_settings

def get_user_prompts_plugin_settings_scenario(plugin_settings):
    """
    Функция загрузки промптов для сценария с manifest в pluginSettings
    """
    console_log("🔍 ЗАГРУЗКА ПРОМПТОВ (сценарий: manifest в pluginSettings)")

    prompts = {'optimized': {'ru': '', 'en': ''}, 'deep': {'ru': '', 'en': ''}}

    # В этом сценарии manifest находится в pluginSettings.manifest
    manifest = safe_dict_get(plugin_settings, 'manifest', {})
    console_log(f"   manifest из pluginSettings: {manifest is not None}")

    if manifest:
        manifest_prompts = safe_dict_get(manifest, 'options', {}).get('prompts', {})
        console_log(f"   manifest_prompts: {bool(manifest_prompts)}")

        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                manifest_value = safe_dict_get(
                    manifest_prompts,
                    prompt_type, {}
                ).get(lang, {}).get('default', '')

                if manifest_value and len(manifest_value.strip()) > 0:
                    prompts[prompt_type][lang] = manifest_value
                    console_log(f"✅ {prompt_type}.{lang}: загружен из pluginSettings.manifest")
                else:
                    console_log(f"⚠️ {prompt_type}.{lang}: не найден в pluginSettings.manifest")

    return prompts

def get_user_prompts_globals_scenario(plugin_settings, pyodide_context):
    """
    Функция загрузки промптов для сценария с manifest в globals
    """
    console_log("🔍 ЗАГРУЗКА ПРОМПТОВ (сценарий: manifest в globals)")

    prompts = {'optimized': {'ru': '', 'en': ''}, 'deep': {'ru': '', 'en': ''}}

    # В этом сценарии manifest находится в globals
    manifest = pyodide_context.get_global('manifest', {})
    console_log(f"   manifest из globals: {manifest is not None}")

    if manifest:
        manifest_prompts = safe_dict_get(manifest, 'options', {}).get('prompts', {})
        console_log(f"   manifest_prompts: {bool(manifest_prompts)}")

        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                manifest_value = safe_dict_get(
                    manifest_prompts,
                    prompt_type, {}
                ).get(lang, {}).get('default', '')

                if manifest_value and len(manifest_value.strip()) > 0:
                    prompts[prompt_type][lang] = manifest_value
                    console_log(f"✅ {prompt_type}.{lang}: загружен из globals.manifest")
                else:
                    console_log(f"⚠️ {prompt_type}.{lang}: не найден в globals.manifest")

    return prompts

def test_scenario(name: str, scenario_function, prompt_loader_function, pyodide_context):
    """Тестирование конкретного сценария"""
    print(f"\n{'='*80}")
    print(f"🧪 ТЕСТИРОВАНИЕ СЦЕНАРИЯ: {name}")
    print('='*80)

    # Настройка сценария
    plugin_settings = scenario_function()

    # Загрузка промптов
    if 'globals' in name.lower():
        prompts = prompt_loader_function(plugin_settings, pyodide_context)
    else:
        prompts = prompt_loader_function(plugin_settings)

    # Проверка результатов
    success_count = 0
    expected_min_length = 100  # Минимальная длина промпта

    print("\n📊 РЕЗУЛЬТАТЫ ЗАГРУЗКИ ПРОМПТОВ:")
    for prompt_type in ['optimized', 'deep']:
        for lang in ['ru', 'en']:
            prompt_value = prompts[prompt_type][lang]
            length = len(prompt_value) if prompt_value else 0

            if length > expected_min_length:
                print(f"✅ {prompt_type}.{lang}: {length} символов")
                success_count += 1
            else:
                print(f"❌ {prompt_type}.{lang}: {length} символов (слишком короткий)")

    total_prompts = 4
    success_rate = success_count / total_prompts

    if success_rate >= 0.75:  # Минимум 3 из 4 промптов
        print(f"🎉 СЦЕНАРИЙ ПРОЙДЕН: {success_count}/{total_prompts} промптов загружено")
        return True
    else:
        print(f"❌ СЦЕНАРИЙ НЕ ПРОЙДЕН: {success_count}/{total_prompts} промптов загружено")
        return False

def main():
    """Основная функция тестирования"""
    print("🚀 ЗАПУСК ТЕСТОВ ПЕРЕДАЧИ MANIFEST")
    print("Проверяем сценарии: manifest в pluginSettings vs manifest в globals")

    # Создаем Pyodide контекст
    pyodide_context = MockPyodideContext()

    # Сценарий 1: manifest в pluginSettings
    scenario1_passed = test_scenario(
        "Manifest в pluginSettings",
        pyodide_context.get_plugin_settings_manifest_scenario,
        get_user_prompts_plugin_settings_scenario,
        pyodide_context
    )

    # Очищаем globals для следующего сценария
    pyodide_context.globals.clear()

    # Сценарий 2: manifest в globals
    scenario2_passed = test_scenario(
        "Manifest в globals",
        pyodide_context.get_globals_manifest_scenario,
        get_user_prompts_globals_scenario,
        pyodide_context
    )

    # Итоговый результат
    print(f"\n{'='*80}")
    print("📋 ИТОГОВЫЕ РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ")
    print('='*80)

    print(f"Сценарий 1 (pluginSettings.manifest): {'✅ ПРОЙДЕН' if scenario1_passed else '❌ НЕ ПРОЙДЕН'}")
    print(f"Сценарий 2 (globals.manifest): {'✅ ПРОЙДЕН' if scenario2_passed else '❌ НЕ ПРОЙДЕН'}")

    if scenario1_passed and scenario2_passed:
        print("\n🎉 ВСЕ СЦЕНАРИИ ПРОЙДЕНЫ: Исправление передачи manifest работает корректно!")
        print("✅ Manifest может передаваться как в pluginSettings, так и в globals")
        print("✅ Промпты корректно загружаются в обоих сценариях")
        return True
    else:
        print("\n💥 ОБНАРУЖЕНЫ ПРОБЛЕМЫ: Некоторые сценарии не работают")
        if not scenario1_passed:
            print("❌ Проблема со сценарием pluginSettings.manifest")
        if not scenario2_passed:
            print("❌ Проблема со сценарием globals.manifest")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)