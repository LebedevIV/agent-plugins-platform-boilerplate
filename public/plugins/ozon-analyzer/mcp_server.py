import sys
import json
from typing import Any, Dict

# `input_data` сюда придет как специальный объект Pyodide `JsProxy`,
# который оборачивает наш JavaScript-объект.
# Мы должны работать с ним, используя синтаксис доступа через точку,
# а не методы словаря Python.
def analyze_product_data(input_data) -> Dict[str, Any]:
    """
    Анализирует контент страницы, полученный как JsProxy.
    """
    
    # --- ▼▼▼ РЕШАЮЩЕЕ ИЗМЕНЕНИЕ ▼▼▼ ---
    # Получаем доступ к полям, как к свойствам JavaScript-объекта,
    # а не через метод .get()
    page_title = input_data.page_title
    page_content_text = input_data.page_content_text
    # --- ▲▲▲ КОНЕЦ ИЗМЕНЕНИЯ ▲▲▲ ---

    # `js` - это глобальный объект для вызова JS-функций.
    js.sendMessageToChat({"content": f"Python: Начинаю анализ страницы '{page_title[:30]}...'"}) # type: ignore

    word_count = len(page_content_text.split())
    has_ozon_in_title = "ozon" in page_title.lower()

    final_message = f"Python: Анализ завершен. Слов на странице: ~{word_count}. 'Ozon' в заголовке: {has_ozon_in_title}."
    js.sendMessageToChat({"content": final_message}) # type: ignore

    # Возвращаем НАСТОЯЩИЙ Python-словарь. Он будет корректно
    # преобразован обратно в JS-объект.
    return {
        "status": "success",
        "analyzed_words": word_count,
        "ozon_in_title": has_ozon_in_title,
        "summary": final_message
    }