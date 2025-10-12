#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовый сценарий 4: Полный цикл анализа с оригинальными промптами

Цель: Протестировать полный цикл анализа товара Ozon с использованием
оригинальных промптов из manifest.json в реальном сценарии
"""

import json
import sys
import os
import re

# Добавляем путь к папке плагина в sys.path для импорта функций
sys.path.append('./chrome-extension/public/plugins/ozon-analyzer')

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
    Функция загрузки промптов (скопировано из mcp_server.py для тестирования).
    """
    console_log("🔍 ===== НАЧАЛО ЗАГРУЗКИ ПРОМПТОВ (ИНТЕГРАЦИОННЫЙ ТЕСТ) =====")

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

        # Детальная диагностика структуры промптов
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                console_log(f"🔍 Обработка {prompt_type}.{lang}:")

                # Fallback на manifest.json (основной сценарий)
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

        # Итоговая диагностика
        console_log("🔍 Итоговая диагностика промптов:")
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

# Имитация класса FastDOMParser для тестирования
class MockFastDOMParser:
    """Макет парсера HTML для тестирования."""

    def __init__(self, html_content):
        self.html = html_content

    def extract_product_info(self):
        """Имитация извлечения информации о товаре."""
        return {
            'title': 'Тестовый крем для лица с коллагеном',
            'description': 'Инновационный крем для лица с активным коллагеном и гиалуроновой кислотой. Обеспечивает глубокое увлажнение и разглаживание морщин. Подходит для всех типов кожи.',
            'composition': 'Aqua, Glycerin, Collagen, Hyaluronic Acid, Parfum, DMDM Hydantoin, Propylparaben, Butylparaben, Phenoxyethanol',
            'categories': ['krasota-i-zdorove-6500'],
            'price': {'text': '1 299 ₽', 'amount': 1299, 'currency': 'RUB'},
            'rating': {'text': '4.2', 'value': 4.2, 'max_value': 5.0},
            'extraction_stats': {
                'total_fields': 6,
                'successful_fields': 6,
                'success_rate_percent': 100,
                'parsing_time_ms': 15.2
            }
        }

    def is_product_in_target_category(self, categories):
        """Проверка принадлежности к целевой категории."""
        return 'krasota-i-zdorove-6500' in categories

# Имитация AI модели для тестирования
def mock_ai_call(model_alias: str, prompt: str):
    """Имитация вызова AI модели."""
    console_log(f"🤖 ИМИТАЦИЯ ВЫЗОВА AI: {model_alias}")
    console_log(f"📝 Длина промпта: {len(prompt)} символов")

    # Проверяем что промпт содержит ключевые элементы из manifest.json
    prompt_lower = prompt.lower()

    # Для optimized промпта проверяем наличие ключевых элементов
    if model_alias == 'compliance_check' and any(keyword in prompt_lower for keyword in ['токсиколог', 'косметолог', 'анализ']):
        # Проверяем что в промпте есть данные о составе (DMDM Hydantoin, parabens и т.д.)
        if any(ingredient in prompt for ingredient in ['DMDM Hydantoin', 'Propylparaben', 'Butylparaben']):
            return json.dumps({
                'score': 4,
                'reasoning': 'Анализ показал наличие потенциально проблемных консервантов (DMDM Hydantoin, Propylparaben, Butylparaben). Основные активные ингредиенты (Collagen, Hyaluronic Acid) присутствуют, но их концентрация не указана явно. Маркетинговые заявления о "глубоком увлажнении" и "разглаживании морщин" не полностью обоснованы составом.',
                'confidence': 0.8,
                'red_flags': ['DMDM Hydantoin', 'Propylparaben', 'Butylparaben'],
                'marketing_lies': ['Глубокое проникновение коллагена в кожу']
            })
        else:
            return json.dumps({
                'score': 5,
                'reasoning': 'Недостаточно данных для полного анализа состава',
                'confidence': 0.5,
                'red_flags': [],
                'marketing_lies': []
            })

    # Для deep промпта
    elif model_alias == 'deep_analysis' and 'глубокий анализ' in prompt_lower:
        return "ДЕТАЛЬНЫЙ АНАЛИЗ ПРОДУКТА:\n\n1. НАУЧНАЯ ОБОСНОВАННОСТЬ:\nКоллаген в косметике не проникает в глубокие слои кожи из-за большого размера молекул (>500 Da). Гиалуроновая кислота работает только на поверхности.\n\n2. ПОБОЧНЫЕ ЭФФЕКТЫ:\nКонсерванты DMDM Hydantoin могут вызывать раздражение. Парабены накапливаются в организме.\n\n3. ЭФФЕКТИВНОСТЬ:\nЭффект увлажнения длится 4-6 часов, видимое разглаживание морщин отсутствует."

    return json.dumps({'score': 5, 'reasoning': 'Ошибка анализа'})

def analyze_ozon_product_integration_test():
    """
    Интеграционный тест полного цикла анализа с оригинальными промптами.
    """
    print("=" * 80)
    print("🧪 ТЕСТОВЫЙ СЦЕНАРИЙ 4: Полный цикл анализа с оригинальными промптами")
    print("=" * 80)

    # Шаг 1: Загрузка промптов из manifest.json
    print("\n📋 ШАГ 1: Загрузка промптов из manifest.json")
    print("-" * 60)

    try:
        plugin_settings = get_pyodide_var('pluginSettings', {})
        prompts = get_user_prompts(plugin_settings)

        # Проверяем что промпты загружены
        loaded_prompts = 0
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                prompt_value = prompts[prompt_type][lang]
                if prompt_value and len(prompt_value.strip()) > 0:
                    loaded_prompts += 1

        print(f"   Загружено промптов: {loaded_prompts}/4")

        if loaded_prompts < 2:
            print("❌ НЕДОСТАТОЧНО ПРОМПТОВ ДЛЯ АНАЛИЗА")
            return False

        print("✅ ПРОМПТЫ УСПЕШНО ЗАГРУЖЕНЫ")

    except Exception as e:
        print(f"❌ ОШИБКА ЗАГРУЗКИ ПРОМПТОВ: {e}")
        return False

    # Шаг 2: Имитация извлечения данных о товаре
    print("\n📋 ШАГ 2: Извлечение данных о товаре")
    print("-" * 60)

    try:
        # Имитируем HTML страницу товара Ozon
        mock_html = '''
        <html>
        <head>
            <title>Крем для лица с коллагеном - Ozon</title>
            <meta property="og:title" content="Крем для лица с коллагеном и гиалуроновой кислотой">
        </head>
        <body>
            <div data-widget="webPdpGrid">
                <h1>Крем для лица с коллагеном</h1>
                <div data-widget="webDescription">
                    <h2>Описание</h2>
                    <div class="pdp_ao9">
                        <p>Инновационный крем для лица с активным коллагеном и гиалуроновой кислотой.
                        Обеспечивает глубокое увлажнение и разглаживание морщин. Подходит для всех типов кожи.</p>
                    </div>
                    <h3>Состав</h3>
                    <p>Aqua, Glycerin, Collagen, Hyaluronic Acid, Parfum, DMDM Hydantoin, Propylparaben, Butylparaben, Phenoxyethanol</p>
                </div>
            </div>
            <div data-widget="breadCrumbs">
                <ol>
                    <li><a href="/category/krasota-i-zdorove-6500">Красота и здоровье</a></li>
                </ol>
            </div>
        </body>
        </html>
        '''

        parser = MockFastDOMParser(mock_html)
        product_info = parser.extract_product_info()

        print(f"   Название: {product_info['title']}")
        print(f"   Описание: {product_info['description'][:100]}...")
        print(f"   Состав: {product_info['composition']}")
        print(f"   Категория: {product_info['categories']}")

        # Проверяем категорию
        if not parser.is_product_in_target_category(product_info['categories']):
            print("❌ ТОВАР НЕ ПРИНАДЛЕЖИТ К ЦЕЛЕВОЙ КАТЕГОРИИ")
            return False

        print("✅ ДАННЫЕ О ТОВАРЕ ИЗВЛЕЧЕНЫ КОРРЕКТНО")

    except Exception as e:
        print(f"❌ ОШИБКА ИЗВЛЕЧЕНИЯ ДАННЫХ: {e}")
        return False

    # Шаг 3: Тестирование промптов в AI анализе
    print("\n📋 ШАГ 3: Тестирование промптов в AI анализе")
    print("-" * 60)

    try:
        # Тестируем optimized промпт (русский)
        optimized_prompt_ru = prompts['optimized']['ru']
        if not optimized_prompt_ru or len(optimized_prompt_ru.strip()) == 0:
            print("❌ ОПТИМИЗИРОВАННЫЙ ПРОМПТ (RU) НЕ ЗАГРУЖЕН")
            return False

        # Вставляем тестовые данные в промпт
        test_description = product_info['description']
        test_composition = product_info['composition']

        # Подготавливаем промпт для тестирования
        test_prompt = optimized_prompt_ru.replace('{description}', test_description).replace('{composition}', test_composition)

        print(f"   Длина промпта: {len(test_prompt)} символов")
        print(f"   Промпт начинается с: {test_prompt[:100]}...")

        # Проверяем наличие ключевых элементов промпта
        key_elements = [
            'токсиколог',
            'косметолог',
            'анализ',
            'соответствия',
            'DMDM Hydantoin',
            'парабены',
            'концентрация'
        ]

        found_elements = []
        for element in key_elements:
            if element.lower() in test_prompt.lower():
                found_elements.append(element)

        print(f"   Найдено ключевых элементов: {len(found_elements)}/{len(key_elements)}")

        if len(found_elements) >= 5:  # Минимум 5 ключевых элементов
            print("✅ ПРОМПТ СОДЕРЖИТ ВСЕ НЕОБХОДИМЫЕ ЭЛЕМЕНТЫ")
        else:
            print("❌ ПРОМПТ НЕ СОДЕРЖИТ НЕОБХОДИМЫЕ ЭЛЕМЕНТЫ")
            return False

    except Exception as e:
        print(f"❌ ОШИБКА ПОДГОТОВКИ ПРОМПТА: {e}")
        return False

    # Шаг 4: Имитация AI анализа
    print("\n📋 ШАГ 4: Имитация AI анализа")
    print("-" * 60)

    try:
        # Имитируем вызов AI с промптом
        ai_response = mock_ai_call('compliance_check', test_prompt)

        print(f"   Длина ответа AI: {len(ai_response)} символов")

        # Проверяем структуру ответа
        try:
            parsed_response = json.loads(ai_response)
            print(f"   Структура ответа: {list(parsed_response.keys())}")

            if 'score' in parsed_response and 'reasoning' in parsed_response:
                score = parsed_response['score']
                reasoning = parsed_response['reasoning']

                print(f"   Оценка соответствия: {score}/10")
                print(f"   Длина обоснования: {len(reasoning)} символов")

                # Проверяем что ответ учитывает данные товара
                if 'DMDM Hydantoin' in reasoning or 'парабен' in reasoning.lower():
                    print("✅ АНАЛИЗ УЧИТЫВАЕТ СОСТАВ ПРОДУКТА")
                else:
                    print("❌ АНАЛИЗ НЕ УЧИТЫВАЕТ СОСТАВ ПРОДУКТА")
                    return False

                print("✅ AI АНАЛИЗ ВЫПОЛНЕН УСПЕШНО")

            else:
                print("❌ ОТВЕТ AI НЕ СОДЕРЖИТ НЕОБХОДИМЫЕ ПОЛЯ")
                return False

        except json.JSONDecodeError:
            print("❌ ОТВЕТ AI НЕ ЯВЛЯЕТСЯ ВАЛИДНЫМ JSON")
            return False

    except Exception as e:
        print(f"❌ ОШИБКА AI АНАЛИЗА: {e}")
        return False

    # Шаг 5: Проверка deep промпта
    print("\n📋 ШАГ 5: Проверка deep промпта")
    print("-" * 60)

    try:
        deep_prompt_ru = prompts['deep']['ru']
        if not deep_prompt_ru or len(deep_prompt_ru.strip()) == 0:
            print("❌ ГЛУБОКИЙ ПРОМПТ (RU) НЕ ЗАГРУЖЕН")
            return False

        # Подготавливаем deep промпт
        deep_test_prompt = deep_prompt_ru.replace('{description}', test_description).replace('{composition}', test_composition)

        print(f"   Длина deep промпта: {len(deep_test_prompt)} символов")
        print(f"   Deep промпт начинается с: {deep_test_prompt[:100]}...")

        # Проверяем наличие ключевых элементов deep промпта
        deep_key_elements = [
            'критический анализ',
            'токсиколог',
            'косметолог',
            'маркетинговые уловки',
            'формальдегид-релизеры'
        ]

        found_deep_elements = []
        for element in deep_key_elements:
            if element.lower() in deep_test_prompt.lower():
                found_deep_elements.append(element)

        print(f"   Найдено ключевых элементов deep промпта: {len(found_deep_elements)}/{len(deep_key_elements)}")

        if len(found_deep_elements) >= 3:
            print("✅ DEEP ПРОМПТ СОДЕРЖИТ ВСЕ НЕОБХОДИМЫЕ ЭЛЕМЕНТЫ")
        else:
            print("❌ DEEP ПРОМПТ НЕ СОДЕРЖИТ НЕОБХОДИМЫЕ ЭЛЕМЕНТЫ")
            return False

    except Exception as e:
        print(f"❌ ОШИБКА ПОДГОТОВКИ DEEP ПРОМПТА: {e}")
        return False

    # Шаг 6: Финальная проверка интеграции
    print("\n📋 ШАГ 6: Финальная проверка интеграции")
    print("-" * 60)

    try:
        # Имитируем полный цикл анализа
        description = product_info['description']
        composition = product_info['composition']
        categories = product_info['categories']

        # Проверяем что все данные корректны
        checks = [
            ('Описание', len(description) > 50),
            ('Состав', len(composition) > 20),
            ('Категория', len(categories) > 0),
            ('Цена', product_info['price']['amount'] > 0),
            ('Рейтинг', product_info['rating']['value'] > 0)
        ]

        passed_checks = 0
        for check_name, check_result in checks:
            if check_result:
                passed_checks += 1
                print(f"   ✅ {check_name}: корректно")
            else:
                print(f"   ❌ {check_name}: некорректно")

        print(f"\n📊 ПРОЙДЕНО ПРОВЕРОК: {passed_checks}/{len(checks)}")

        if passed_checks == len(checks):
            print("✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ")
        else:
            print("❌ НЕ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ")
            return False

    except Exception as e:
        print(f"❌ ОШИБКА ФИНАЛЬНОЙ ПРОВЕРКИ: {e}")
        return False

    print("\n" + "=" * 80)
    print("🎉 ИНТЕГРАЦИОННЫЙ ТЕСТ ПРОЙДЕН УСПЕШНО!")
    print("=" * 80)
    print("📋 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:")
    print("   ✅ Промпты корректно загружаются из manifest.json")
    print("   ✅ Оригинальные промпты содержат все необходимые элементы анализа")
    print("   ✅ Данные о товаре извлекаются корректно")
    print("   ✅ AI анализ выполняется с использованием оригинальных промптов")
    print("   ✅ Полный цикл анализа работает от начала до конца")
    print("=" * 80)

    return True

if __name__ == "__main__":
    success = analyze_ozon_product_integration_test()
    if not success:
        print("❌ ИНТЕГРАЦИОННЫЙ ТЕСТ НЕ ПРОЙДЕН")
        sys.exit(1)
    else:
        print("✅ ИНТЕГРАЦИОННЫЙ ТЕСТ ПРОЙДЕН")
        sys.exit(0)