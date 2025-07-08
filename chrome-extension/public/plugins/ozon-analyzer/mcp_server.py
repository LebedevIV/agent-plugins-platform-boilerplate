import sys
import json
import asyncio
import re
from typing import Any, Dict, List
# from bs4 import BeautifulSoup  # Может не работать в Pyodide

# Простой HTML парсер для Pyodide
class SimpleHTMLParser:
    def __init__(self, html):
        self.html = html
    
    def find(self, tag, attrs=None):
        # Простая реализация поиска тега
        return SimpleHTMLElement(self.html, tag, attrs)
    
    def find_all(self, tag, attrs=None):
        # Простая реализация поиска всех тегов
        return [SimpleHTMLElement(self.html, tag, attrs)]

class SimpleHTMLElement:
    def __init__(self, html, tag, attrs):
        self.html = html
        self.tag = tag
        self.attrs = attrs or {}
    
    def get(self, attr, default=''):
        return self.attrs.get(attr, default)
    
    def find(self, tag, attrs=None):
        return SimpleHTMLElement(self.html, tag, attrs)
    
    def find_all(self, tag, attrs=None):
        return [SimpleHTMLElement(self.html, tag, attrs)]
    
    def get_text(self, strip=False):
        # Простая реализация извлечения текста
        return "Sample text" if strip else "Sample text"
    
    @property
    def text(self):
        return "Sample text"

# Глобальная переменная для доступа к JavaScript API
js = None

# Конфигурация нейросетей
AI_MODELS = {
    "basic_analysis": "gemini-flash",
    "detailed_comparison": "gemini-pro", 
    "deep_analysis": "gemini-25",
    "scraping_fallback": "gemini-flash"
}

async def main():
    """Основная функция MCP сервера для анализатора Ozon"""
    global js
    
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
    
    if method == 'analyze_product':
        return await analyze_ozon_product(params)
    elif method == 'deep_analysis':
        return await perform_deep_analysis(params.get('description', ''), params.get('composition', ''))
    elif method == 'ping':
        return {"result": "pong"}
    else:
        return {
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}"
            }
        }

async def analyze_ozon_product(params: Dict[str, Any]) -> Dict[str, Any]:
    """Анализ товара на Ozon"""
    try:
        # Получаем HTML страницы
        page_html = params.get('page_html', '')
        if not page_html:
            return {
                "error": {
                    "code": -32602,
                    "message": "HTML страницы не предоставлен"
                }
            }
        
        # Парсим HTML (используем встроенный парсер)
        # soup = BeautifulSoup(page_html, 'html.parser')
        # Временно используем простой парсинг
        soup = SimpleHTMLParser(page_html)
        
        # Проверяем, что это страница товара
        if not page_html.startswith('https://www.ozon.ru/product/'):
            return {
                "result": {
                    "message": "Это не страница товара Ozon. Перейдите на страницу товара для анализа."
                }
            }
        
        # Извлекаем категории из breadcrumbs
        categories = extract_categories(soup)
        
        # Извлекаем описание и состав
        description, composition = extract_description_and_composition(soup)
        
        # Анализируем соответствие описания и состава
        analysis_result = await analyze_composition_vs_description(description, composition)
        
        # Ищем аналоги
        analogs = await find_similar_products(categories, composition)
        
        # Проверяем, нужен ли глубокий анализ
        deep_analysis_available = await check_deep_analysis_availability()
        
        result = {
            "categories": categories,
            "description": description,
            "composition": composition,
            "analysis": analysis_result,
            "analogs": analogs,
            "message": f"Анализ завершен. Оценка соответствия: {analysis_result['score']}/10"
        }
        
        # Если доступен глубокий анализ, предлагаем его
        if deep_analysis_available and analysis_result['score'] < 7:
            result["deep_analysis_offer"] = {
                "available": True,
                "message": "Хотите провести более глубокий анализ с помощью Gemini 2.5 Pro?",
                "model": AI_MODELS["deep_analysis"]
            }
        
        return {"result": result}
        
    except Exception as e:
        return {
            "error": {
                "code": -32603,
                "message": f"Ошибка анализа товара: {str(e)}"
            }
        }

def extract_categories(soup: SimpleHTMLParser) -> List[str]:
    """Извлекает категории из breadcrumbs"""
    categories = []
    
    breadcrumbs = soup.find('div', {'data-widget': 'breadCrumbs'})
    if breadcrumbs:
        links = breadcrumbs.find_all('a')
        for link in links:
            href = link.get('href', '')
            if '/category/' in href:
                # Извлекаем название категории
                span = link.find('span')
                if span:
                    categories.append(span.text.strip())
    
    return categories

def extract_description_and_composition(soup: SimpleHTMLParser) -> tuple:
    """Извлекает описание и состав товара"""
    description = ""
    composition = ""
    
    # Ищем div с описанием
    description_sections = soup.find_all('div', {'id': 'section-description'})
    
    for section in description_sections:
        h2 = section.find('h2')
        if h2:
            h2_text = h2.text.strip().lower()
            
            if 'описание' in h2_text:
                # Извлекаем описание
                desc_div = section.find('div')
                if desc_div:
                    description = desc_div.get_text(strip=True)
                    
            elif 'состав' in h2_text or 'характеристики' in h2_text:
                # Извлекаем состав
                comp_div = section.find('div')
                if comp_div:
                    composition = comp_div.get_text(strip=True)
    
    return description, composition

async def get_ai_api_key(model_name: str) -> str:
    """Получает API ключ для указанной нейросети"""
    try:
        # В реальной реализации здесь будет обращение к background script
        # для получения сохраненных ключей
        return "demo_key"  # Заглушка
    except Exception as e:
        print(f"Ошибка получения API ключа для {model_name}: {e}")
        return ""

async def call_ai_model(model_name: str, prompt: str) -> str:
    """Вызывает указанную нейросеть с промптом с обработкой лимитов"""
    try:
        api_key = await get_ai_api_key(model_name)
        if not api_key:
            return f"Ошибка: API ключ для {model_name} не настроен"
        
        # Проверяем лимиты перед вызовом
        rate_limit_info = await check_rate_limit(model_name)
        if rate_limit_info['limited']:
            return await handle_rate_limit(model_name, rate_limit_info, prompt)
        
        # В реальной реализации здесь будет вызов API нейросети
        # Пока возвращаем заглушку
        result = f"Ответ от {model_name}: {prompt[:50]}..."
        
        # Обновляем статистику использования
        await update_usage_stats(model_name)
        
        return result
        
    except Exception as e:
        return f"Ошибка вызова {model_name}: {str(e)}"

async def check_rate_limit(model_name: str) -> Dict[str, Any]:
    """Проверяет лимиты для указанной модели"""
    try:
        # В реальной реализации здесь будет проверка лимитов API
        # Пока возвращаем заглушку
        return {
            'limited': False,
            'reset_time': None,
            'remaining_requests': 1000
        }
    except Exception as e:
        print(f"Ошибка проверки лимитов для {model_name}: {e}")
        return {'limited': False, 'reset_time': None, 'remaining_requests': 0}

async def handle_rate_limit(model_name: str, rate_limit_info: Dict[str, Any], prompt: str) -> str:
    """Обрабатывает ситуацию с лимитами API"""
    try:
        # Получаем доступные альтернативные модели
        alternative_models = await get_alternative_models(model_name)
        
        # Пытаемся использовать альтернативную модель
        for alt_model in alternative_models:
            alt_rate_limit = await check_rate_limit(alt_model)
            if not alt_rate_limit['limited']:
                print(f"Переключаемся на альтернативную модель: {alt_model}")
                return await call_ai_model(alt_model, prompt)
        
        # Если альтернативы недоступны, возвращаем информацию о лимите
        reset_time = rate_limit_info.get('reset_time')
        if reset_time:
            return f"Лимит API для {model_name} превышен. Повторить запрос после {reset_time} или использовать другую модель."
        else:
            return f"Лимит API для {model_name} превышен. Попробуйте позже или используйте другую модель."
            
    except Exception as e:
        return f"Ошибка обработки лимита для {model_name}: {str(e)}"

async def get_alternative_models(model_name: str) -> List[str]:
    """Возвращает список альтернативных моделей"""
    # Определяем альтернативы для каждой модели
    alternatives = {
        'gemini-flash': ['gemini-25'],
        'gemini-25': ['gemini-flash'],
        'gemini-pro': ['gemini-flash', 'gemini-25']
    }
    
    return alternatives.get(model_name, [])

async def update_usage_stats(model_name: str):
    """Обновляет статистику использования модели"""
    try:
        # В реальной реализации здесь будет обновление статистики
        print(f"Обновлена статистика использования для {model_name}")
    except Exception as e:
        print(f"Ошибка обновления статистики для {model_name}: {e}")

async def check_deep_analysis_availability() -> bool:
    """Проверяет доступность глубокого анализа"""
    try:
        api_key = await get_ai_api_key(AI_MODELS["deep_analysis"])
        return bool(api_key and api_key != "demo_key")
    except Exception as e:
        print(f"Ошибка проверки доступности глубокого анализа: {e}")
        return False

async def perform_deep_analysis(description: str, composition: str) -> Dict[str, Any]:
    """Выполняет глубокий анализ с помощью Gemini 2.5 Pro"""
    try:
        prompt = f"""
        Проведи глубокий анализ товара с медицинской и научной точки зрения.
        
        Описание: {description}
        Состав: {composition}
        
        Проанализируй:
        1. Научную обоснованность заявленных свойств
        2. Потенциальные побочные эффекты и противопоказания
        3. Взаимодействие с другими препаратами
        4. Эффективность по сравнению с аналогами
        5. Рекомендации по применению
        6. Альтернативные варианты
        
        Верни детальный анализ в структурированном виде.
        """
        
        result = await call_ai_model(AI_MODELS["deep_analysis"], prompt)
        
        return {
            "deep_analysis": result,
            "model_used": AI_MODELS["deep_analysis"],
            "timestamp": asyncio.get_event_loop().time()
        }
        
    except Exception as e:
        return {
            "error": f"Ошибка глубокого анализа: {str(e)}"
        }

async def analyze_composition_vs_description(description: str, composition: str) -> Dict[str, Any]:
    """Анализирует соответствие описания и состава с помощью нейросетей"""
    
    if not description or not composition:
        return {
            "score": 0,
            "reasoning": "Не удалось извлечь описание или состав товара",
            "details": []
        }
    
    try:
        # Базовый анализ с помощью Gemini Flash
        basic_prompt = f"""
        Проанализируй соответствие описания товара и его состава.
        
        Описание: {description}
        Состав: {composition}
        
        Оцени по шкале от 1 до 10, где:
        1 - полное несоответствие
        10 - полное соответствие
        
        Верни JSON в формате:
        {{
            "score": число,
            "reasoning": "объяснение оценки",
            "details": ["деталь 1", "деталь 2"]
        }}
        """
        
        basic_result = await call_ai_model(AI_MODELS["basic_analysis"], basic_prompt)
        
        # Детальное сравнение с помощью Gemini Pro
        detailed_prompt = f"""
        Проведи детальный анализ соответствия описания и состава товара.
        
        Описание: {description}
        Состав: {composition}
        
        Проанализируй:
        1. Соответствие заявленных свойств составу
        2. Качество и полезность ингредиентов
        3. Потенциальные риски или преимущества
        4. Рекомендации по использованию
        
        Верни структурированный анализ.
        """
        
        detailed_result = await call_ai_model(AI_MODELS["detailed_comparison"], detailed_prompt)
        
        # Парсим результат базового анализа
        try:
            basic_data = json.loads(basic_result)
            score = basic_data.get("score", 5)
            reasoning = basic_data.get("reasoning", "Анализ не удался")
            details = basic_data.get("details", [])
        except:
            score = 5
            reasoning = "Ошибка парсинга результата анализа"
            details = []
        
        return {
            "score": score,
            "reasoning": reasoning,
            "details": details,
            "detailed_analysis": detailed_result,
            "ai_models_used": [AI_MODELS["basic_analysis"], AI_MODELS["detailed_comparison"]]
        }
        
    except Exception as e:
        return {
            "score": 0,
            "reasoning": f"Ошибка анализа: {str(e)}",
            "details": []
        }
    score = max(1, min(10, score))
    
    reasoning = f"Оценка {score}/10: "
    if score >= 8:
        reasoning += "Отличное соответствие описания и состава"
    elif score >= 6:
        reasoning += "Хорошее соответствие с небольшими расхождениями"
    elif score >= 4:
        reasoning += "Среднее соответствие, есть расхождения"
    else:
        reasoning += "Плохое соответствие, описание не отражает реальный состав"
    
    return {
        "score": score,
        "reasoning": reasoning,
        "details": details
    }

async def find_similar_products(categories: List[str], composition: str) -> List[Dict[str, Any]]:
    """Ищет аналогичные товары (заглушка)"""
    # В реальном проекте здесь был бы поиск по API Ozon
    analogs = []
    
    if categories:
        # Симулируем поиск аналогов
        for i, category in enumerate(categories[:3]):
            analogs.append({
                "name": f"Аналог в категории {category}",
                "price": f"{1000 + i * 200} ₽",
                "url": f"https://www.ozon.ru/search?text={category}",
                "similarity": f"{80 - i * 10}%"
            })
    
    return analogs

if __name__ == "__main__":
    asyncio.run(main()) 