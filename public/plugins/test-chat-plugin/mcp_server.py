import sys
import json
import asyncio
from datetime import datetime

async def main():
    """Основная функция MCP сервера для тестирования чатов"""
    print("Test Chat Plugin MCP Server started", file=sys.stderr)
    
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
                
            request = json.loads(line)
            print(f"Received request: {request}", file=sys.stderr)
            
            response = await process_request(request)
            print(f"Sending response: {response}", file=sys.stderr)
            
            sys.stdout.write(json.dumps(response) + '\n')
            sys.stdout.flush()
            
        except Exception as e:
            print(f"Error processing request: {e}", file=sys.stderr)
            error_response = {
                "error": {
                    "code": -1,
                    "message": str(e)
                }
            }
            sys.stdout.write(json.dumps(error_response) + '\n')
            sys.stdout.flush()

async def process_request(request):
    """Обработка запросов MCP"""
    method = request.get('method', '')
    
    if method == 'initialize':
        return {
            "jsonrpc": "2.0",
            "id": request.get('id'),
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "test-chat-plugin",
                    "version": "1.0.0"
                }
            }
        }
    
    elif method == 'tools/call':
        return await handle_tool_call(request)
    
    elif method == 'notifications/cancel':
        return {"jsonrpc": "2.0", "id": request.get('id'), "result": None}
    
    else:
        return {
            "jsonrpc": "2.0",
            "id": request.get('id'),
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}"
            }
        }

async def handle_tool_call(request):
    """Обработка вызовов инструментов"""
    params = request.get('params', {})
    arguments = params.get('arguments', [])
    
    # Создаем тестовые сообщения чата
    test_messages = [
        {
            "role": "user",
            "content": "Привет! Как дела?",
            "timestamp": int(datetime.now().timestamp() * 1000)
        },
        {
            "role": "plugin", 
            "content": "Привет! У меня все хорошо, спасибо что спросили!",
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
    ]
    
    # Отправляем логи для отладки
    for i, msg in enumerate(test_messages):
        log_message = {
            "type": "LOG_EVENT",
            "pluginId": "test-chat-plugin",
            "pageKey": "https://example.com/test",
            "level": "info",
            "stepId": f"chat-message-{i}",
            "message": f"Создано сообщение чата: {msg['role']} - {msg['content'][:50]}...",
            "logData": msg
        }
        print(json.dumps(log_message), file=sys.stderr)
    
    return {
        "jsonrpc": "2.0",
        "id": request.get('id'),
        "result": {
            "content": [
                {
                    "type": "text",
                    "text": f"Создано {len(test_messages)} тестовых сообщений чата"
                }
            ]
        }
    }

if __name__ == "__main__":
    asyncio.run(main()) 