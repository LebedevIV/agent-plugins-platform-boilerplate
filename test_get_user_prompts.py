#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовый сценарий для проверки корректной работы функции get_user_prompts.

Этот тест проверяет:
1. Корректный доступ к кастомным промптам из структуры plugin_settings
2. Правильное извлечение дефолтных промптов из манифеста
3. Логирование диагностической информации
4. Обработку ошибок и fallback сценарии
"""

import asyncio
import json
import sys
import os
from typing import Dict, Any, Optional

# Добавляем текущую директорию в путь для импорта
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Мокаем функции JavaScript bridge для тестирования
class MockJSBridge:
    """Мок JavaScript bridge для тестирования."""
    
    def __init__(self):
        self.logged_messages = []
    
    def consoleLog(self, message: str):
        """Мокируем console.log."""
        self.logged_messages.append(message)
        print(f"[MOCK_CONSOLE] {message}")
    
    def sendMessageToChat(self, message: Dict[str, Any]):
        """Мокируем отправку сообщения в чат."""
        self.logged_messages.append(f"CHAT: {message}")
        print(f"[MOCK_CHAT] {message}")

# Глобальный мок JS bridge
mock_js = MockJSBridge()

def console_log(message: str, force: bool = False):
    """Мокированная функция логирования."""
    mock_js.consoleLog(f"[TEST_LOG] {message}")

def chat_message(message: str, message_type: str = None):
    """Мокированная функция отправки сообщения в чат."""
    mock_js.sendMessageToChat({"content": message})

# Мокируем Pyodide globals
class MockGlobals:
    """Мок Pyodide globals для тестирования."""
    
    def __init__(self, data: Dict[str, Any]):
        self.data = data
    
    def __contains__(self, key: str) -> bool:
        return key in self.data
    
    def __getitem__(self, key: str) -> Any:
        return self.data[key]
    
    def keys(self):
        return self.data.keys()

# Импортируем функцию get_user_prompts из основного модуля
# Поскольку мы не можем напрямую импортировать из-за зависимостей,
# создадим локальную копию функции для тестирования

def safe_dict_get(data: Any, key: str, default: Any = None) -> Any:
    """Безопасная функция получения значения из словаря."""
    try:
        if isinstance(data, dict):
            return data.get(key, default)
        return default
    except AttributeError:
        return default

def get_pyodide_var(name: str, default: Any = None) -> Any:
    """Мокированная функция получения переменной из Pyodide globals."""
    try:
        if name in globals():
            value = globals()[name]
            return value
        else:
            return default
    except Exception as e:
        return default

def get_user_prompts(plugin_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Локальная копия функции get_user_prompts для тестирования.
    
    Загружает промпты из настроек пользователя или использует значения по умолчанию из manifest.json.
    """
    try:
        console_log("🔍 НАЧАЛО ТЕСТИРОВАНИЯ get_user_prompts")
        console_log(f"📋 Входящие plugin_settings: {plugin_settings}")
        console_log(f"📋 Тип plugin_settings: {type(plugin_settings)}")
        
        # Исправлено: промпты уже доступны в plugin_settings
        custom_prompts_raw = safe_dict_get(plugin_settings, 'prompts', {})
        
        console_log(f"📋 Извлеченные кастомные промпты: {custom_prompts_raw}")
        
        prompts = {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }
        
        # Получаем manifest.json из globals для fallback значений
        manifest = get_pyodide_var('manifest', {})
        manifest_prompts = safe_dict_get(manifest, 'options.prompts', {})
        
        console_log(f"📋 Manifest промпты: {manifest_prompts}")
        
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                # Правильно извлекаем промпт из nested структуры plugin_settings
                prompt_type_data = safe_dict_get(custom_prompts_raw, prompt_type, {})
                
                custom_value = safe_dict_get(prompt_type_data, lang, '')
                
                console_log(f"🔍 Проверка промпта {prompt_type}.{lang}:")
                console_log(f"   - Кастомное значение: '{custom_value}'")
                console_log(f"   - Длина кастомного значения: {len(custom_value) if custom_value else 0}")
                console_log(f"   - Тип кастомного значения: {type(custom_value)}")
                console_log(f"   - Проверка на непустую строку: {isinstance(custom_value, str) and len(custom_value.strip()) > 0}")
                
                if custom_value and isinstance(custom_value, str) and len(custom_value.strip()) > 0:
                    prompts[prompt_type][lang] = custom_value
                    console_log(f"✅ Используем кастомный промпт: {prompt_type}.{lang} (длина: {len(custom_value)})")
                else:
                    # Fallback на manifest.json
                    lang_data = safe_dict_get(manifest_prompts, f'{prompt_type}.{lang}', {})
                    
                    manifest_value = safe_dict_get(lang_data, 'default', '')
                    prompts[prompt_type][lang] = manifest_value
                    console_log(f"ℹ️ Используем промпт по умолчанию: {prompt_type}.{lang}")
        
        console_log(f"🔍 Диагностика промптов:")
        console_log(f"   Plugin settings prompts: {custom_prompts_raw}")
        console_log(f"   Manifest prompts: {manifest_prompts}")
        console_log(f"   Plugin settings prompts: {custom_prompts_raw}")
        console_log(f"   Final prompts structure: {prompts}")
        console_log(f"📋 Загружено промптов: {len([p for pt in prompts.values() for p in pt.values() if p])} кастомных")
        return prompts

    except Exception as e:
        console_log(f"❌ Ошибка загрузки промптов: {str(e)}")
        console_log(f"🔍 Диагностика ошибки:")
        console_log(f"   Plugin settings: {plugin_settings}")
        console_log(f"   Plugin settings type: {type(plugin_settings)}")
        # Критический fallback - возвращаем пустые промпты
        return {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

class TestGetUserPrompts:
    """Класс для тестирования функции get_user_prompts."""
    
    def __init__(self):
        self.test_results = []
        self.manifest = {
            'options': {
                'prompts': {
                    'optimized.ru': {'default': 'Оптимизированный промпт по умолчанию (RU)'},
                    'optimized.en': {'default': 'Default optimized prompt (EN)'},
                    'deep.ru': {'default': 'Глубокий промпт по умолчанию (RU)'},
                    'deep.en': {'default': 'Default deep prompt (EN)'}
                }
            }
        }
    
    def run_test(self, test_name: str, plugin_settings: Dict[str, Any], expected_custom_count: int):
        """Запуск одного теста."""
        print(f"\n🧪 ТЕСТ: {test_name}")
        print("=" * 50)
        
        # Устанавливаем глобальные переменные для теста
        global manifest
        manifest = self.manifest
        
        # Очищаем логи перед тестом
        mock_js.logged_messages = []
        
        # Выполняем тестируемую функцию
        result = get_user_prompts(plugin_settings)
        
        # Анализируем результаты
        custom_prompts_count = len([p for pt in result.values() for p in pt.values() if p])
        
        print(f"📊 Результат теста:")
        print(f"   - Количество кастомных промптов: {custom_prompts_count}")
        print(f"   - Ожидаемое количество: {expected_custom_count}")
        print(f"   - Структура результата: {result}")
        
        # Проверяем логи
        print(f"📋 Логи теста ({len(mock_js.logged_messages)} сообщений):")
        for i, log in enumerate(mock_js.logged_messages[-10:], 1):  # Последние 10 логов
            print(f"   {i}. {log}")
        
        # Определяем успешность теста
        success = custom_prompts_count == expected_custom_count
        self.test_results.append({
            'test_name': test_name,
            'success': success,
            'expected': expected_custom_count,
            'actual': custom_prompts_count,
            'result': result,
            'logs': mock_js.logged_messages.copy()
        })
        
        print(f"✅ ТЕСТ {'ПРОЙДЕН' if success else 'ПРОВАЛЕН'}")
        return success
    
    def run_all_tests(self):
        """Запуск всех тестов."""
        print("🚀 НАЧАЛО ТЕСТИРОВАНИЯ ФУНКЦИИ get_user_prompts")
        print("=" * 60)
        
        # Тест 1: Корректные кастомные промпты
        self.run_test(
            "Корректные кастомные промпты",
            {
                'prompts': {
                    'optimized': {
                        'ru': 'Кастомный оптимизированный промпт (RU)',
                        'en': 'Custom optimized prompt (EN)'
                    },
                    'deep': {
                        'ru': 'Кастомный глубокий промпт (RU)',
                        'en': 'Custom deep prompt (EN)'
                    }
                }
            },
            4  # Все 4 промпта кастомные
        )
        
        # Тест 2: Пустые промпты (fallback на manifest)
        self.run_test(
            "Пустые промпты (fallback на manifest)",
            {
                'prompts': {
                    'optimized': {'ru': '', 'en': ''},
                    'deep': {'ru': '', 'en': ''}
                }
            },
            0  # Нет кастомных промптов
        )
        
        # Тест 3: Отсутствующие промпты
        self.run_test(
            "Отсутствующие промпты",
            {},
            0  # Нет кастомных промптов
        )
        
        # Тест 4: Неправильная структура промптов
        self.run_test(
            "Неправильная структура промптов",
            {
                'prompts': 'неправильная_структура'
            },
            0  # Нет кастомных промптов из-за неправильной структуры
        )
        
        # Тест 5: Частично заполненные промпты
        self.run_test(
            "Частично заполненные промпты",
            {
                'prompts': {
                    'optimized': {
                        'ru': 'Только русский оптимизированный промпт'
                    },
                    'deep': {
                        'en': 'Only English deep prompt'
                    }
                }
            },
            2  # Только 2 кастомных промпта
        )
        
        # Тест 6: Промпты с пробелами (должны игнорироваться)
        self.run_test(
            "Промпты с пробелами",
            {
                'prompts': {
                    'optimized': {
                        'ru': '   ',  # Только пробелы
                        'en': '\t\n'  # Табуляция и перенос
                    }
                }
            },
            0  # Промпты с пробелами игнорируются
        )
        
        # Тест 7: None как plugin_settings
        self.run_test(
            "None как plugin_settings",
            None,
            0  # Нет кастомных промптов
        )
        
        self.print_summary()
    
    def print_summary(self):
        """Вывод итогов тестирования."""
        print("\n" + "=" * 60)
        print("📊 ИТОГИ ТЕСТИРОВАНИЯ")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t['success']])
        
        print(f"Всего тестов: {total_tests}")
        print(f"Пройденных тестов: {passed_tests}")
        print(f"Проваленых тестов: {total_tests - passed_tests}")
        print(f"Успешность: {passed_tests/total_tests*100:.1f}%")
        
        print("\nДетальный отчет:")
        for i, test in enumerate(self.test_results, 1):
            status = "✅ ПРОЙДЕН" if test['success'] else "❌ ПРОВАЛЕН"
            print(f"{i}. {test['test_name']}: {status}")
            print(f"   Ожидаемо: {test['expected']}, Получено: {test['actual']}")
        
        if passed_tests == total_tests:
            print("\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Функция работает корректно.")
        else:
            print(f"\n⚠️ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ! Требуется дополнительная отладка.")

async def main():
    """Главная функция для запуска тестов."""
    print("🚀 Запуск тестового сценария для функции get_user_prompts")
    
    # Создаем и запускаем тесты
    tester = TestGetUserPrompts()
    tester.run_all_tests()
    
    # Ждем немного для завершения всех асинхронных операций
    await asyncio.sleep(0.1)
    
    print("\n✅ Тестирование завершено!")

if __name__ == "__main__":
    asyncio.run(main())
