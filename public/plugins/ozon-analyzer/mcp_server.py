from typing import Any, Dict

# Никаких `requests` или `pyodide_http`. Вся работа с сетью делегирована.
# `js` - это глобальный объект, который предоставляет Pyodide для вызова
# JavaScript-функций, определенных в `pyodide-worker.js`.
# Мы используем `# type: ignore`, чтобы редактор не ругался на неопределенный `js`.

# --- Наш главный асинхронный инструмент ---

async def fetch_current_time(input_data: Any) -> Dict[str, Any]:
    """
    Асинхронно просит хост-систему (JavaScript) сделать сетевой запрос
    и дожидается результата.

    Args:
        input_data: JsProxy-объект, содержащий поле 'timezone'.
    
    Returns:
        Словарь с результатом операции.
    """
    # 1. Получаем входные данные из JsProxy
    timezone = input_data.timezone
    api_url = f"https://worldtimeapi.org/api/timezone/{timezone}"
    
    # 2. Логируем наши намерения в UI
    js.sendMessageToChat({"content": f"Python: Прошу хост сделать GET-запрос на {api_url}"}) # type: ignore
    
    try:
        js.sendMessageToChat({"content": f"Python: Ожидаю (await) ответ от хоста..."}) # type: ignore
        
        # 3. КЛЮЧЕВОЙ МОМЕНТ:
        #    - `js.host_fetch(api_url)` возвращает JS Promise, который в Python видится как PyodideFuture.
        #    - `await` дожидается выполнения этого Promise.
        #    - Pyodide автоматически конвертирует результат (JS-объект) в Python-объект (dict).
        #    - Поэтому мы сразу получаем готовый словарь, и .to_py() больше не нужен.
        response_dict = await js.host_fetch(api_url)
        
        # 4. Логируем то, что получили, для отладки
        js.sendMessageToChat({"content": f"Python: Получен ответ от хоста: {response_dict}"}) # type: ignore

        # 5. Проверяем, что результат действительно является словарем
        if not isinstance(response_dict, dict):
            raise Exception(f"Хост вернул не словарь, а {type(response_dict)}")
        
        # 6. Проверяем, не вернул ли хост ошибку в структурированном виде
        if response_dict.get("error"):
             raise Exception(response_dict.get("error_message", "Неизвестная ошибка от хоста"))

        # 7. Обрабатываем успешный результат
        time_data = response_dict.get("data")
        if not time_data:
            raise Exception("В ответе от хоста отсутствует ключ 'data'")

        current_time = time_data.get("datetime")
        summary = f"Python: Запрос успешен! Текущее время в {timezone}: {current_time}"
        js.sendMessageToChat({"content": summary}) # type: ignore
        
        # 8. Возвращаем финальный результат движку воркфлоу
        return {
            "status": "success",
            "data": time_data
        }
        
    except Exception as e:
        # Ловим любые ошибки: от хоста, при парсинге, и т.д.
        error_message = f"Python: Ошибка при выполнении запроса через хост: {e}"
        js.sendMessageToChat({"content": error_message}) # type: ignore
        return { "status": "error", "error": str(e) }

# --- Старая синхронная функция для примера и обратной совместимости ---

def analyze_headings(input_data: Any) -> Dict[str, Any]:
    """
    Стабильная синхронная функция для анализа заголовков.
    Не имеет внешних зависимостей и не делает асинхронных вызовов.
    """
    headings_list = input_data.headings_list.to_py()
    number_of_headings = len(headings_list)
    js.sendMessageToChat({"content": f"Python: (analyze_headings) получил {number_of_headings} заголовков."}) # type: ignore
    summary = f"Python: Анализ заголовков завершен."
    js.sendMessageToChat({"content": summary}) # type: ignore
    return {"status": "success", "total_headings": number_of_headings}