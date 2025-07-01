import sys
import json
from typing import Any, Dict, List

# `js` - это глобальный объект, который предоставляет Pyodide для вызова
# JavaScript-функций, определенных в `pyodide-worker.js`.
# Мы используем `# type: ignore`, чтобы редактор не ругался на неопределенный `js`.

def analyze_headings(input_data) -> Dict[str, Any]:
    """
    Анализирует список заголовков, полученный со страницы.
    Эта функция вызывается из нашего workflow-движка.
    
    Args:
        input_data: Это специальный объект Pyodide `JsProxy`, который
                    оболочка над JavaScript-объектом. Он содержит поле 
                    'headings_list', которое само является JsProxy-оболочкой
                    над JavaScript-массивом.
    """
    
    # Получаем JsProxy-массив заголовков
    headings_proxy = input_data.headings_list
    
    # Превращаем JsProxy-массив в настоящий Python-список строк
    headings_list = headings_proxy.to_py()
    
    number_of_headings = len(headings_list)
    js.sendMessageToChat({"content": f"Python: Получил на анализ {number_of_headings} заголовков."}) # type: ignore

    keywords = ["news", "новости", "статей", "articles"]
    found_headings = []
    
    # Перебираем полученные заголовки
    for h in headings_list:
        # Нормализуем строку:
        # 1. .strip() - убирает лишние пробелы, табуляции и переносы строк по краям.
        # 2. .lower() - приводит все к нижнему регистру для нечувствительного к регистру поиска.
        # Это критически важный шаг для работы с "грязными" данными из HTML.
        normalized_h = h.strip().lower()
        
        # Ищем ключевые слова уже в очищенной строке
        for keyword in keywords:
            if keyword in normalized_h:
                # В результат добавляем оригинальный, "грязный" заголовок для наглядности
                found_headings.append(h)
                # Прерываем внутренний цикл, так как мы уже нашли ключевое слово в этом заголовке
                break
    
    summary = f"Python: Анализ завершен. Найдено {len(found_headings)} заголовков по ключевым словам."
    js.sendMessageToChat({"content": summary}) # type: ignore

    # Возвращаем настоящий Python-словарь. Он будет корректно
    # преобразован обратно в JS-объект в `pyodide-worker.js`.
    return {
        "status": "success",
        "total_headings": number_of_headings,
        "found_headings_with_keywords": found_headings,
        "summary": summary
    }


def analyze_product_data(input_data) -> Dict[str, Any]:
    """
    Старая функция для анализа общего контента страницы.
    Оставляем ее для примера или возможного будущего использования.
    """
    page_title = input_data.page_title
    page_content_text = input_data.page_content_text
    
    word_count = len(page_content_text.split())
    has_ozon_in_title = "ozon" in page_title.lower()

    summary = f"Анализ (старый) завершен. Слов: {word_count}, 'Ozon' в заголовке: {has_ozon_in_title}."
    
    return {
        "status": "success",
        "analyzed_words": word_count,
        "ozon_in_title": has_ozon_in_title,
        "summary": summary
    }