#!/usr/bin/env python3
"""
Тестовый скрипт для проверки исправленной логики clean_ai_response
с реальными данными из логов Gemini API.
"""

import json
import re

def test_clean_ai_response_logic(ai_response: str) -> dict:
    """
    Моделирует логику clean_ai_response из mcp_server.py
    """
    print(f"\n=== ТЕСТИРОВАНИЕ ОТВЕТА ===")
    print(f"Исходный ответ: {ai_response}")

    # Шаг 1: Улучшенная очистка markdown обёртки
    original_length = len(ai_response)

    # Регулярное выражение для удаления markdown обёртки ```json...```
    markdown_pattern = re.compile(r'```\s*json\s*\n?(.*?)\n?\s*```', re.IGNORECASE | re.DOTALL)
    cleaned_str = markdown_pattern.sub(r'\1', ai_response.strip())

    # Дополнительная очистка на случай если остались одиночные ```
    cleaned_str = cleaned_str.replace('```', '').strip()

    print(f"После очистки: {cleaned_str}")
    print(f"Удалено символов: {original_length - len(cleaned_str)}")

    # Шаг 1.5: Попытка парсинга очищенного ответа напрямую
    try:
        parsed = json.loads(cleaned_str)
        print(f"✅ JSON успешно распарсен напрямую: {parsed}")

        # Валидация формата ответа
        if isinstance(parsed, dict) and 'score' in parsed:
            score = parsed.get('score')
            reasoning = parsed.get('reasoning')
            print(f"✅ Прямой парсинг успешен: score={score}")
            return parsed
        else:
            print(f"⚠️ Парсинг вернул словарь без поля 'score': {parsed}")
    except json.JSONDecodeError as je:
        print(f"❌ Прямой JSON парсинг провалился: {str(je)}")

    # Шаг 2: Попытка парсинга исходного ответа напрямую
    try:
        parsed = json.loads(ai_response.strip())
        print(f"✅ Исходный ответ успешно распарсен: {parsed}")
        if isinstance(parsed, dict) and 'score' in parsed:
            return parsed
    except json.JSONDecodeError:
        print("❌ Парсинг исходного ответа провалился")

    # Шаг 3: Альтернативное извлечение JSON
    print("🔄 ШАГ 3: Альтернативное извлечение JSON")
    alternative_result = extract_json_from_ai_response(ai_response)
    if alternative_result:
        print(f"✅ Альтернативное извлечение успешно: {alternative_result}")
        return alternative_result

    # Шаг 4: Попытка ремонта JSON
    print("🔧 ШАГ 4: Попытка ремонта JSON")
    repair_result = attempt_json_repair(cleaned_str)
    if repair_result:
        print(f"✅ Ремонт JSON успешен: {repair_result}")
        return repair_result

    # Финальный fallback
    print("❌ Все методы провалились, используем fallback")
    fallback_result = {
        "score": 5,
        "reasoning": f"Не удалось распарсить JSON. Исходный ответ: {cleaned_str[:100]}..."
    }
    return fallback_result

def extract_json_from_ai_response(ai_response: str) -> dict:
    """Альтернативная функция извлечения JSON из ответа AI."""
    print("  Стратегия 2: Поиск между маркерами кода")

    # Улучшенные паттерны для поиска JSON в markdown блоках
    code_block_patterns = [
        r'```\s*json\s*\n?\s*(\{.*?\})\s*\n?\s*```',  # ```json\n{...}\n```
        r'```\s*(\{.*?\})\s*```',  # ```\n{...}\n```
        r'```[^\n]*\s*\n?\s*(\{.*?\})\s*\n?\s*```',  # ```language\n{...}\n```
    ]

    for pattern_idx, pattern in enumerate(code_block_patterns):
        matches = re.findall(pattern, ai_response, re.IGNORECASE | re.DOTALL)
        print(f"  Стратегия 2.{pattern_idx + 1}: найдено {len(matches)} совпадений")

        for match_idx, match in enumerate(matches):
            try:
                print(f"  Попытка парсинга совпадения {match_idx + 1}: {match[:50]}...")
                parsed = json.loads(match)
                if isinstance(parsed, dict) and 'score' in parsed:
                    score = parsed.get('score')
                    print(f"  ✅ Найден валидный JSON: score={score}")
                    return parsed
            except json.JSONDecodeError as e:
                print(f"  Парсинг совпадения {match_idx + 1} провалился: {e}")
                continue

    print("  ❌ Ни одна стратегия не сработала")
    return None

def attempt_json_repair(broken_json: str) -> dict:
    """Функция ремонта поврежденного JSON."""
    print("  Шаг 1: Очистка от Markdown")

    original_json = broken_json
    cleaned = original_json

    # Проверяем, является ли JSON уже чистым
    try:
        parsed_clean = json.loads(cleaned.strip())
        if isinstance(parsed_clean, dict) and 'score' in parsed_clean:
            print("  ✅ JSON уже чистый")
            return parsed_clean
    except json.JSONDecodeError:
        pass

    # Убираем Markdown обертки
    markdown_patterns = [
        r'```\s*json\s*\n?\s*',
        r'```\s*',
        r'\s*```',
    ]

    for pattern in markdown_patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

    cleaned = cleaned.strip()

    # Проверяем после очистки
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and 'score' in parsed:
            print("  ✅ После очистки Markdown получился валидный JSON")
            return parsed
    except json.JSONDecodeError:
        pass

    print("  ❌ Ремонт JSON не удался")
    return None

def main():
    """Основная функция тестирования."""
    print("🧪 ТЕСТИРОВАНИЕ ИСПРАВЛЕННОЙ ЛОГИКИ clean_ai_response")
    print("=" * 60)

    # Тестовый кейс из логов
    test_cases = [
        {
            "name": "Gemini API с markdown обёрткой",
            "input": """```json
{
  "score": 9,
  "reasoning": "Описание товара и состав хорошо согласуются...",
  "confidence": 0.95
}
```""",
            "expected_score": 9
        },
        {
            "name": "Чистый JSON без markdown",
            "input": """{
  "score": 7,
  "reasoning": "Хорошее соответствие состава описанию"
}""",
            "expected_score": 7
        },
        {
            "name": "JSON с пробелами после json",
            "input": """```json
{
  "score": 8,
  "reasoning": "Тест с пробелами"
}
```""",
            "expected_score": 8
        }
    ]

    for test_case in test_cases:
        print(f"\n🔍 ТЕСТ: {test_case['name']}")
        print("-" * 40)

        try:
            result = test_clean_ai_response_logic(test_case['input'])
            actual_score = result.get('score', 'N/A')
            expected_score = test_case['expected_score']

            if actual_score == expected_score:
                print(f"✅ ТЕСТ ПРОЙДЕН: score={actual_score} (ожидалось {expected_score})")
            else:
                print(f"❌ ТЕСТ ПРОВАЛЕН: score={actual_score} (ожидалось {expected_score})")

            print(f"Полный результат: {result}")

        except Exception as e:
            print(f"❌ ОШИБКА ТЕСТИРОВАНИЯ: {e}")

    print("\n" + "=" * 60)
    print("🏁 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО")

if __name__ == "__main__":
    main()