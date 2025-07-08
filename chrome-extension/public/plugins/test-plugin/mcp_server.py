#!/usr/bin/env python3
"""
Test Plugin MCP Server
Простой тестовый плагин для демонстрации sidebar
"""

import sys
import json
import asyncio
from typing import Any, Dict

class TestPlugin:
    def __init__(self):
        self.name = "Test Plugin"
        self.version = "1.0.0"
        
    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Обрабатывает входящие запросы"""
        method = request.get('method', '')
        
        if method == 'ping':
            return await self.ping()
        elif method == 'analyze_page':
            return await self.analyze_page(request.get('params', {}))
        else:
            return {
                'error': {
                    'code': -32601,
                    'message': f'Method {method} not found'
                }
            }
    
    async def ping(self) -> Dict[str, Any]:
        """Простой ping для проверки работы плагина"""
        return {
            'result': {
                'message': 'Test Plugin is working!',
                'status': 'ok'
            }
        }
    
    async def analyze_page(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Анализирует текущую страницу"""
        url = params.get('url', 'unknown')
        
        # Имитируем анализ
        await asyncio.sleep(2)
        
        return {
            'result': {
                'url': url,
                'analysis': {
                    'title': 'Test Analysis',
                    'summary': 'This is a test analysis of the page',
                    'recommendations': [
                        'Test recommendation 1',
                        'Test recommendation 2'
                    ]
                }
            }
        }

async def main():
    """Основная функция"""
    plugin = TestPlugin()
    
    # Отправляем приветственное сообщение
    welcome = {
        'type': 'notification',
        'method': 'plugin_ready',
        'params': {
            'name': plugin.name,
            'version': plugin.version,
            'message': 'Test Plugin готов к работе!'
        }
    }
    
    sys.stdout.write(json.dumps(welcome) + '\n')
    sys.stdout.flush()
    
    # Основной цикл обработки запросов
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
                
            request = json.loads(line.strip())
            response = await plugin.handle_request(request)
            
            # Добавляем ID запроса к ответу
            if 'id' in request:
                response['id'] = request['id']
            
            sys.stdout.write(json.dumps(response) + '\n')
            sys.stdout.flush()
            
        except json.JSONDecodeError as e:
            error_response = {
                'error': {
                    'code': -32700,
                    'message': f'Parse error: {str(e)}'
                }
            }
            if 'id' in request:
                error_response['id'] = request['id']
            sys.stdout.write(json.dumps(error_response) + '\n')
            sys.stdout.flush()
            
        except Exception as e:
            error_response = {
                'error': {
                    'code': -32603,
                    'message': f'Internal error: {str(e)}'
                }
            }
            if 'id' in request:
                error_response['id'] = request['id']
            sys.stdout.write(json.dumps(error_response) + '\n')
            sys.stdout.flush()

if __name__ == '__main__':
    asyncio.run(main()) 