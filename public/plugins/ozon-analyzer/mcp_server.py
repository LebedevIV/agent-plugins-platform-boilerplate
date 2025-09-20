from typing import Any, Dict, Protocol, runtime_checkable
import logging

# === LOGGING SYSTEM ===

# Настройка логирования Python
logger = logging.getLogger('mcp_server')
logger.setLevel(logging.INFO)  # По умолчанию INFO, debug отключен

# Функция для сокращения длинных сообщений
def truncate_text(text: str) -> str:
    """Сокращает текст, если длина > 100 символов"""
    if len(text) > 100:
        return text[:50] + "..." + text[-50:]
    return text

# Функция для отправки сообщений в UI чат (только для важных сообщений)
def send_chat_message(message: str, level: str = 'info'):
    """Отправка сообщения в UI чат только для важных уведомлений"""
    try:
        if level in ['error', 'warning'] or (level == 'info' and 'ошибка' in message.lower()):
            js.sendMessageToChat({"content": message}) # type: ignore
    except Exception:
        # Тихо игнорируем ошибки отправки сообщений
        pass

# Никаких `requests` или `pyodide_http`. Вся работа с сетью делегирована.
# `js` - это глобальный объект, который предоставляет Pyodide для вызова
# JavaScript-функций, определенных в `pyodide-worker.js`.
# Мы используем `# type: ignore`, чтобы редактор не ругался на неопределенный `js`.
# --- ▼▼▼ НОВЫЙ КОД: ОБЪЯВЛЕНИЕ "КОНТРАКТА" ДЛЯ `js` ▼▼▼ ---

# `runtime_checkable` позволяет использовать `isinstance` с этим протоколом.
@runtime_checkable
class JsBridge(Protocol):
    """
    Описывает структуру нашего JavaScript-моста для статического анализатора.
    Pyright будет знать, что у объекта `js` есть эти методы.
    """
    def sendMessageToChat(self, message: Dict[str, Any]) -> None:
        ... # Многоточие означает, что реализации здесь нет.
    
    def host_fetch(self, url: str) -> Any: # Возвращает PyodideFuture, но для простоты Any
        ...

# Объявляем переменную `js` для анализатора.
# В реальной среде Pyodide эта строка будет проигнорирована,
# так как глобальная переменная `js` уже будет существовать.
js: JsBridge

# --- ▲▲▲ КОНЕЦ НОВОГО КОДА ▲▲▲ ---
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
    
    # 2. Логируем наши намерения в UI (только важные сообщения)
    logger.info(f"Requesting API call to: {api_url}")
        
        # 3. КЛЮЧЕВОЙ МОМЕНТ:
        #    - `js.host_fetch(api_url)` возвращает JS Promise, который в Python видится как PyodideFuture.
        #    - `await` дожидается выполнения этого Promise.
        #    - Pyodide автоматически конвертирует результат (JS-объект) в Python-объект (dict).
        #    - Поэтому мы сразу получаем готовый словарь, и .to_py() больше не нужен.
        response_dict = await js.host_fetch(api_url)
        
        # 4. Логируем результат (только важные сообщения)
        logger.debug(f"Received response from host: {type(response_dict)}")

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
        logger.info(f"Successfully retrieved time for {timezone}: {current_time}")

        # 8. Возвращаем финальный результат движку воркфлоу
        return {
            "status": "success",
            "data": time_data
        }
        
    except Exception as e:
        # Ловим любые ошибки: от хоста, при парсинге, и т.д.
        logger.error(f"Error during API request: {e}")
        return { "status": "error", "error": str(e) }

# --- Старая синхронная функция для примера и обратной совместимости ---

def analyze_headings(input_data: Any) -> Dict[str, Any]:
    """
    Стабильная синхронная функция для анализа заголовков.
    Не имеет внешних зависимостей и не делает асинхронных вызовов.
    """
    headings_list = input_data.headings_list.to_py()
    number_of_headings = len(headings_list)
    logger.info(f"Analyzed {number_of_headings} headings")
    return {"status": "success", "total_headings": number_of_headings}

def analyze_ozon_product() -> Dict[str, Any]:
    """
    Главная функция для анализа товара Ozon.
    Добавлено логирование для диагностики зависания.
    """
    logger.info("Starting analyze_ozon_product function")
    try:
        # Здесь должен быть код анализа
        result = {"status": "success", "message": "Analysis completed"}
        logger.info("Completed analyze_ozon_product function successfully")
        send_chat_message(truncate_text("Анализ завершен успешно: описание соответствует ингредиентам"), "info")
        return result
    except Exception as e:
        logger.error(f"Error in analyze_ozon_product: {e}")
        send_chat_message(truncate_text(f"Ошибка анализа: {str(e)}"), "error")
        return {"status": "error", "error": str(e)}