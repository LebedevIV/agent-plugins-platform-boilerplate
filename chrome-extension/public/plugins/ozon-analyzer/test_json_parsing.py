#!/usr/bin/env python3
"""
Тестовый скрипт для проверки функций парсинга JSON из ответов AI.
Проверяет работу функций _extract_json_from_ai_response и _attempt_json_repair.
"""

import sys
import os
import json
import re

# Добавляем путь к основному модулю
sys.path.insert(0, os.path.dirname(__file__))

def _extract_json_from_ai_response(ai_response: str):
    """
    Альтернативная функция извлечения JSON из ответа AI с множественными стратегиями.
    Использует различные подходы для поиска и извлечения JSON из ответа модели.
    """
    if not isinstance(ai_response, str) or not ai_response.strip():
        return None

    print(f"🔍 Начинаем альтернативное извлечение JSON из ответа длиной {len(ai_response)} символов")

    # Стратегия 1: Прямой поиск JSON объекта
    print("Стратегия 1: Прямой поиск JSON объекта")
    try:
        # Ищем самый длинный валидный JSON объект в ответе
        json_pattern = r'\{[^{}]*\{[^{}]*\}[^{}]*\}|\{[^{}]*\}'
        matches = re.findall(json_pattern, ai_response, re.DOTALL)

        if matches:
            # Сортируем по длине и пробуем парсить
            matches.sort(key=len, reverse=True)
            for match in matches[:3]:  # Проверяем топ-3 самых длинных
                try:
                    parsed = json.loads(match)
                    if isinstance(parsed, dict) and 'score' in parsed:
                        print(f"✅ Найден валидный JSON по стратегии 1: {len(match)} символов")
                        return parsed
                except json.JSONDecodeError:
                    continue

    except Exception as e:
        print(f"Ошибка в стратегии 1: {e}")

    # Стратегия 2: Поиск между маркерами кода
    print("Стратегия 2: Поиск между маркерами кода")
    try:
        code_block_patterns = [
            r'```json\s*(\{.*?\})\s*```',
            r'```\s*(\{.*?\})\s*```',
            r'```[^\n]*\s*(\{.*?\})\s*```'
        ]

        for pattern in code_block_patterns:
            matches = re.findall(pattern, ai_response, re.IGNORECASE | re.DOTALL)
            for match in matches:
                try:
                    parsed = json.loads(match)
                    if isinstance(parsed, dict) and 'score' in parsed:
                        print(f"✅ Найден валидный JSON в код-блоке по стратегии 2: {len(match)} символов")
                        return parsed
                except json.JSONDecodeError:
                    continue

    except Exception as e:
        print(f"Ошибка в стратегии 2: {e}")

    # Стратегия 3: Поиск по ключевым словам и извлечение структуры
    print("Стратегия 3: Поиск по ключевым словам")
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

                print(f"✅ Извлечена структура JSON по стратегии 3: score={score}")
                return result

    except Exception as e:
        print(f"Ошибка в стратегии 3: {e}")

    print("❌ Ни одна стратегия извлечения JSON не сработала")
    return None

def _attempt_json_repair(broken_json: str):
    """
    Комплексная функция ремонта поврежденного JSON с множественными стратегиями.
    Используется когда стандартный json.loads() не может распарсить ответ AI.
    """
    if not isinstance(broken_json, str) or not broken_json.strip():
        return None

    print(f"🔧 Начинаем ремонт JSON длиной {len(broken_json)} символов")

    original_json = broken_json

    # Шаг 1: Очистка от Markdown и лишних символов
    print("Шаг 1: Очистка от Markdown")
    try:
        # Убираем Markdown обертки
        cleaned = broken_json.replace('```json', '').replace('```', '').strip()

        # Убираем лишние пробелы и переносы
        cleaned = re.sub(r'\s+', ' ', cleaned)

        # Убираем BOM и невидимые символы
        cleaned = cleaned.replace('\ufeff', '').replace('\u200b', '')

        print(f"После очистки: {len(cleaned)} символов (было {len(broken_json)})")

        if len(cleaned) != len(broken_json):
            print("✅ Выполнена очистка Markdown")
        else:
            print("ℹ️ Очистка Markdown не изменила содержимое")

    except Exception as e:
        print(f"Ошибка в шаге 1: {e}")
        cleaned = broken_json

    # Шаг 2: Исправление кавычек
    print("Шаг 2: Исправление кавычек")
    try:
        # Исправляем неправильные кавычки
        fixed_quotes = cleaned.replace('"', '"').replace('"', '"')

        # Исправляем отсутствующие кавычки в ключах
        fixed_quotes = re.sub(r'([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', fixed_quotes)

        # Исправляем отсутствующие кавычки в строковых значениях
        fixed_quotes = re.sub(r':\s*([a-zA-Zа-яА-Я][^",}]+)', r': "\1"', fixed_quotes)

        print("✅ Исправлены кавычки")

    except Exception as e:
        print(f"Ошибка в шаге 2: {e}")
        fixed_quotes = cleaned

    # Шаг 3: Исправление структуры
    print("Шаг 3: Исправление структуры")
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

        print("✅ Исправлена структура JSON")

    except Exception as e:
        print(f"Ошибка в шаге 3: {e}")

    # Шаг 4: Попытка парсинга
    print("Шаг 4: Попытка парсинга исправленного JSON")
    try:
        parsed = json.loads(fixed_quotes)

        if isinstance(parsed, dict) and 'score' in parsed:
            print("✅ JSON успешно отремонтирован и распарсен")
            return parsed
        else:
            print("❌ Отремонтированный JSON не содержит ожидаемой структуры")

    except json.JSONDecodeError as je:
        print(f"❌ Парсинг отремонтированного JSON не удался: {str(je)}")

        # Шаг 5: Агрессивный ремонт
        print("Шаг 5: Агрессивный ремонт JSON")
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

                print(f"✅ Создан fallback JSON: score={score}")
                return fallback_json

        except Exception as e:
            print(f"❌ Агрессивный ремонт не удался: {e}")

    print("❌ Все стратегии ремонта JSON провалились")
    return None

def test_json_parsing():
    """Тестирование функций парсинга JSON."""
    print("=" * 60)
    print("🧪 ТЕСТИРОВАНИЕ ФУНКЦИЙ ПАРСИНГА JSON")
    print("=" * 60)

    # Тестовые случаи
    test_cases = [
        {
            "name": "Валидный JSON",
            "input": '{"score": 8, "reasoning": "Отличное соответствие"}',
            "expected": True
        },
        {
            "name": "JSON в Markdown блоке",
            "input": '```json\n{"score": 7, "reasoning": "Хорошее соответствие"}\n```',
            "expected": True
        },
        {
            "name": "Поврежденный JSON с отсутствующими кавычками",
            "input": '{score: 6, reasoning: "Среднее соответствие"}',
            "expected": True
        },
        {
            "name": "JSON с лишним текстом",
            "input": 'Вот мой анализ: {"score": 9, "reasoning": "Превосходное соответствие"} и это все.',
            "expected": True
        },
        {
            "name": "Некорректный JSON",
            "input": 'Это не JSON вообще',
            "expected": False
        }
    ]

    passed = 0
    total = len(test_cases)

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🧪 Тест {i}: {test_case['name']}")
        print(f"📝 Вход: {test_case['input'][:100]}{'...' if len(test_case['input']) > 100 else ''}")

        # Тестируем _extract_json_from_ai_response
        result1 = _extract_json_from_ai_response(test_case['input'])
        print(f"🔍 _extract_json_from_ai_response: {'✅' if result1 else '❌'} {'Найдено' if result1 else 'Не найдено'}")

        if result1:
            print(f"   Результат: {result1}")

        # Тестируем _attempt_json_repair
        result2 = _attempt_json_repair(test_case['input'])
        print(f"🔧 _attempt_json_repair: {'✅' if result2 else '❌'} {'Успешно' if result2 else 'Не удалось'}")

        if result2:
            print(f"   Результат: {result2}")

        # Проверяем успешность теста
        success = (result1 is not None or result2 is not None) == test_case['expected']
        if success:
            passed += 1
            print(f"🎉 Тест пройден!")
        else:
            print(f"💥 Тест провален!")

    print("\n" + "=" * 60)
    print(f"📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ: {passed}/{total} тестов пройдено")
    print("=" * 60)

    if passed == total:
        print("🎉 Все тесты пройдены! Функции парсинга JSON работают корректно.")
        return True
    else:
        print("⚠️ Некоторые тесты провалились. Требуется дополнительная настройка.")
        return False

if __name__ == "__main__":
    success = test_json_parsing()
    sys.exit(0 if success else 1)