import sys
import json
from typing import Any, Dict
import asyncio

# --- Эта функция остается асинхронной и правильной ---
async def analyze_ozon_product(data: Dict[str, Any]) -> Dict[str, Any]:
    await js.sendMessageToChat_bridge({"content": "Начинаю анализ страницы..."}) # type: ignore

    page_content_proxy = await js.getActivePageContent_bridge({"title": "h1"}) # type: ignore
    page_content: Dict[str, Any] = page_content_proxy.to_py()

    await js.sendMessageToChat_bridge({"content": f"Получен заголовок: {page_content.get('title')}"}) # type: ignore
    
    final_message = f"Анализ завершен. Найдено {page_content.get('reviews_count', 0)} отзывов."
    await js.sendMessageToChat_bridge({"content": final_message}) # type: ignore

    return { "status": "success", "message": "Done." }

# --- Главная функция теперь тоже асинхронна ---
async def main() -> None:
    try:
        line = sys.stdin.readline()
        if not line: return
        request: Dict[str, Any] = json.loads(line)
        tool_name = request.get("tool")
        tool_input = request.get("input")
        result = None
        if tool_name == "analyze-ozon-product":
            result = await analyze_ozon_product(tool_input or {})
        else:
            result = {"error": f"Unknown tool: {tool_name}"}
        response = {"id": request.get("id"), "result": result}
        sys.stdout.write(json.dumps(response) + '\n')
    except Exception as e:
        import traceback
        error_info = traceback.format_exc()
        sys.stdout.write(json.dumps({"error": error_info}) + '\n')

# ▼▼▼ ГЛАВНОЕ: НЕТ НИКАКОГО ВЫЗОВА В КОНЦЕ ФАЙЛА! ▼▼▼
# Файл просто определяет функции и заканчивается.