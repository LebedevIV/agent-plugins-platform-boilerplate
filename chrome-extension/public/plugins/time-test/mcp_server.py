import sys
import json
import asyncio
# import aiohttp  # Не доступен в Pyodide
from typing import Any, Dict
from datetime import datetime
import time

async def main():
    """Основная функция MCP сервера для тестового плагина времени"""
    try:
        while True:
            line = sys.stdin.readline()
            if not line:
                break
                
            request = json.loads(line)
            response = await process_request(request)
            
            sys.stdout.write(json.dumps(response) + '\n')
            sys.stdout.flush()
            
    except Exception as e:
        error_response = {
            "error": {
                "code": -32603,
                "message": f"Internal error: {str(e)}"
            }
        }
        sys.stdout.write(json.dumps(error_response) + '\n')
        sys.stdout.flush()

async def process_request(request: Dict[str, Any]) -> Dict[str, Any]:
    """Обработка MCP запросов"""
    method = request.get('method')
    params = request.get('params', {})
    
    if method == 'get_time':
        return await get_current_time(params)
    elif method == 'ping':
        return {"result": "pong"}
    else:
        return {
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}"
            }
        }

async def get_current_time(params: Dict[str, Any]) -> Dict[str, Any]:
    """Получение текущего времени (локальное)"""
    try:
        timezone = params.get('timezone', 'Europe/Moscow')
        
        # Используем локальное время вместо сетевого запроса
        current_time = datetime.now()
        
        return {
            "result": {
                "datetime": current_time.isoformat(),
                "timezone": timezone,
                "utc_offset": "+03:00",  # Примерное значение для Москвы
                "day_of_week": current_time.strftime("%A"),
                "message": f"Локальное время: {current_time.strftime('%Y-%m-%d %H:%M:%S')}",
                "note": "Используется локальное время (сетевые запросы недоступны в Pyodide)"
            }
        }
    except Exception as e:
        return {
            "error": {
                "code": -32603,
                "message": f"Ошибка получения времени: {str(e)}"
            }
        }

if __name__ == "__main__":
    asyncio.run(main()) 