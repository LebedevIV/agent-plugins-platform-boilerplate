#!/usr/bin/env python3
"""
Тестовый скрипт для проверки парсинга JSON ответов Gemini API
"""

import json
import re

def test_gemini_response_parsing():
    """Тестирование обработки ответа Gemini с markdown обёрткой."""

    # Тестовые данные из логов
    gemini_response = '''```json
{
  "score": 9,
  "reasoning": "Описание товара полностью соответствует предоставленным структурированным данным. Анализ показал высокий уровень соответствия между заявленными свойствами продукта и его фактическим составом. Отмечается наличие ключевых активных ингредиентов, которые действительно способны оказывать заявленное воздействие на кожу.",
  "confidence": 1
}
```'''

    print("=== ТЕСТИРОВАНИЕ ОБРАБОТКИ ОТВЕТА GEMINI ===")
    print(f"Исходный ответ ({len(gemini_response)} символов):")
    print(repr(gemini_response))
    print()

    # Текущая логика обработки
    print("1. Текущая логика обработки:")
    cleaned_str = gemini_response.strip().replace('```json', '').replace('```', '')
    print(f"После очистки ({len(cleaned_str)} символов):")
    print(repr(cleaned_str))
    print()

    try:
        parsed = json.loads(cleaned_str)
        print("✅ JSON успешно распарсен:")
        print(json.dumps(parsed, indent=2, ensure_ascii=False))
        return True
    except json.JSONDecodeError as je:
        print(f"❌ Ошибка парсинга JSON: {je}")
        print(f"Позиция ошибки: {je.pos}")
        if je.pos is not None and je.pos < len(cleaned_str):
            start = max(0, je.pos - 20)
            end = min(len(cleaned_str), je.pos + 20)
            print(f"Контекст ошибки: ...{cleaned_str[start:end]}...")
        print()

    # Улучшенная логика обработки
    print("2. Улучшенная логика обработки:")

    # Шаг 1: Более тщательная очистка markdown
    improved_cleaned = gemini_response.strip()

    # Убираем ```json в начале
    if improved_cleaned.startswith('```json'):
        improved_cleaned = improved_cleaned[7:]  # len('```json')
    elif improved_cleaned.startswith('```'):
        improved_cleaned = improved_cleaned[3:]  # len('```')

    # Убираем ``` в конце
    if improved_cleaned.endswith('```'):
        improved_cleaned = improved_cleaned[:-3]

    # Финальная очистка пробелов
    improved_cleaned = improved_cleaned.strip()

    print(f"После улучшенной очистки ({len(improved_cleaned)} символов):")
    print(repr(improved_cleaned))
    print()

    try:
        parsed = json.loads(improved_cleaned)
        print("✅ JSON успешно распарсен после улучшения:")
        print(json.dumps(parsed, indent=2, ensure_ascii=False))
        return True
    except json.JSONDecodeError as je:
        print(f"❌ Ошибка парсинга даже после улучшения: {je}")
        print()

    # Шаг 3: Использование регулярных выражений для извлечения JSON
    print("3. Извлечение JSON с помощью regex:")

    # Паттерн для поиска JSON блока
    json_pattern = r'```(?:json)?\s*\n?(\{.*?\})\s*\n?```'
    match = re.search(json_pattern, gemini_response, re.DOTALL | re.IGNORECASE)

    if match:
        extracted_json = match.group(1).strip()
        print(f"Извлечено с помощью regex ({len(extracted_json)} символов):")
        print(repr(extracted_json))
        print()

        try:
            parsed = json.loads(extracted_json)
            print("✅ JSON успешно распарсен с помощью regex:")
            print(json.dumps(parsed, indent=2, ensure_ascii=False))
            return True
        except json.JSONDecodeError as je:
            print(f"❌ Ошибка парсинга извлечённого JSON: {je}")
    else:
        print("❌ Не удалось извлечь JSON с помощью regex")

    return False

def test_edge_cases():
    """Тестирование edge cases с экранированием кавычек."""

    print("\n=== ТЕСТИРОВАНИЕ EDGE CASES ===")

    # Edge case 1: Экранированные кавычки (как при передаче JS->Python)
    escaped_response = '"```json\\n{\\n  \\"score\\": 9,\\n  \\"reasoning\\": \\"test\\",\\n  \\"confidence\\": 1\\n}\\n```"'

    print("Edge case 1: Экранированные кавычки")
    print(f"Исходный ответ: {repr(escaped_response)}")

    try:
        # Попытка парсинга как JSON строки
        unescaped = json.loads(escaped_response)
        print(f"После json.loads: {repr(unescaped)}")

        # Теперь применяем обычную очистку
        cleaned = unescaped.strip().replace('```json', '').replace('```', '')
        print(f"После очистки: {repr(cleaned)}")

        parsed = json.loads(cleaned)
        print(f"✅ Успешно распарсен: {parsed}")

    except Exception as e:
        print(f"❌ Ошибка: {e}")

    # Edge case 2: Двойная обёртка
    double_wrapped = '```json\n```json\n{\n  "score": 9,\n  "reasoning": "test",\n  "confidence": 1\n}\n```\n```'

    print("\nEdge case 2: Двойная обёртка")
    print(f"Исходный ответ: {repr(double_wrapped)}")

    try:
        cleaned = double_wrapped.strip().replace('```json', '').replace('```', '')
        print(f"После очистки: {repr(cleaned)}")

        parsed = json.loads(cleaned)
        print(f"✅ Успешно распарсен: {parsed}")

    except Exception as e:
        print(f"❌ Ошибка: {e}")

    # Edge case 3: Неправильная структура markdown
    malformed = '```json{\n  "score": 9,\n  "reasoning": "test",\n  "confidence": 1\n}```'

    print("\nEdge case 3: Неправильная структура markdown")
    print(f"Исходный ответ: {repr(malformed)}")

    try:
        cleaned = malformed.strip().replace('```json', '').replace('```', '')
        print(f"После очистки: {repr(cleaned)}")

        parsed = json.loads(cleaned)
        print(f"✅ Успешно распарсен: {parsed}")

    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    success = test_gemini_response_parsing()
    test_edge_cases()
    print(f"\n{'✅ ОСНОВНОЙ ТЕСТ ПРОШЁЛ' if success else '❌ ОСНОВНОЙ ТЕСТ ПРОВАЛИЛСЯ'}")