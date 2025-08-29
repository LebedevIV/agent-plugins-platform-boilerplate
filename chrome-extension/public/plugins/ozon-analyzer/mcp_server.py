import json
from typing import Any, Dict, List

# --- "КОНТРАКТ" ДЛЯ АНАЛИЗАТОРА ТИПОВ ---
# Этот блок помогает редактору кода понимать, какие JS-функции доступны.
# В реальной среде он не выполняется, так как `js` предоставляется Pyodide.
try:
    from typing import Protocol, runtime_checkable

    @runtime_checkable
    class JsBridge(Protocol):
        def sendMessageToChat(self, message: Dict[str, Any]) -> None: ...
        def llm_call(self, model_alias: str, params: Dict[str, Any]) -> Any: ...
        def get_setting(self, setting_name: str) -> Any: ...

    js: JsBridge
except ImportError:
    # В среде Pyodide `Protocol` может отсутствовать, это нормально.
    pass

# --- ГЛАВНЫЕ ИНСТРУМЕНТЫ (вызываются из workflow.json) ---

async def analyze_ozon_product(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Главная точка входа. Анализирует HTML-контент страницы товара Ozon.
    """
    try:
        page_html = input_data.get('page_html', '')
        if not page_html:
            raise ValueError("HTML страницы не предоставлен")
        
        # В будущем здесь будет использоваться `beautifulsoup4`
        # soup = BeautifulSoup(page_html, 'html.parser')
        soup = SimpleHTMLParser(page_html) # Временная заглушка

        # Валидация (оставлено для примера, в реальности может быть сложнее)
        is_product_page = soup.find('div', {'data-widget': 'webProductHeading'}) is not None
        if not is_product_page:
            return {
                "status": "info",
                "message": "Это не страница товара Ozon. Перейдите на страницу товара для анализа."
            }
        
        js.sendMessageToChat({"content": "Python: Начинаю анализ страницы товара..."})

        categories = _extract_categories(soup)
        description, composition = _extract_description_and_composition(soup)
        
        js.sendMessageToChat({"content": f"Python: Описание и состав извлечены. Анализирую соответствие с помощью AI..."})
        analysis_result = await _analyze_composition_vs_description(description, composition)
        
        analogs = await _find_similar_products(categories, composition)
        
        # Проверяем, разрешен ли "глубокий анализ" в настройках плагина
        enable_deep_analysis = await js.get_setting("enable_deep_analysis").to_py()

        result = {
            "categories": categories,
            "description": description,
            "composition": composition,
            "analysis": analysis_result,
            "analogs": analogs,
            "message": f"Анализ завершен. Оценка соответствия: {analysis_result.get('score', 'N/A')}/10"
        }
        
        # Предлагаем глубокий анализ, только если он включен и оценка низкая
        if enable_deep_analysis and analysis_result.get('score', 10) < 7:
            result["deep_analysis_offer"] = {
                "available": True,
                "message": "Обнаружены несоответствия. Хотите провести более глубокий анализ?",
            }
        
        return result
        
    except Exception as e:
        js.sendMessageToChat({"content": f"Python: Ошибка при анализе - {e}"})
        return { "status": "error", "message": f"Ошибка анализа товара: {str(e)}" }

async def perform_deep_analysis(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Выполняет глубокий анализ с помощью самой мощной модели.
    """
    description = input_data.get('description', '')
    composition = input_data.get('composition', '')
    
    js.sendMessageToChat({"content": "Python: Запускаю глубокий анализ с помощью Gemini Pro..."})
    
    prompt = f"""
    Проведи глубокий анализ товара с медицинской и научной точки зрения.
    Описание: {description}
    Состав: {composition}
    Проанализируй:
    1. Научную обоснованность заявленных свойств.
    2. Потенциальные побочные эффекты и противопоказания.
    3. Эффективность по сравнению с аналогами.
    Верни детальный анализ в структурированном виде (Markdown).
    """
    
    try:
        # "deep_analysis" - это псевдоним из manifest.json плагина.
        # Наша платформа сама подставит нужную модель (gemini-pro или gemini-25).
        result = await _call_ai_model("deep_analysis", prompt)
        
        return {
            "deep_analysis_report": result,
        }
    except Exception as e:
        return { "status": "error", "message": f"Ошибка глубокого анализа: {str(e)}" }


# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (приватная логика плагина) ---
# Начинаются с `_`, чтобы показать, что они не предназначены для вызова извне.

async def _analyze_composition_vs_description(description: str, composition: str) -> Dict[str, Any]:
    if not description or not composition:
        return { "score": 0, "reasoning": "Не удалось извлечь описание или состав товара." }
    
    prompt = f"""
    Проанализируй соответствие описания товара и его состава.
    Описание: {description}
    Состав: {composition}
    Оцени по шкале от 1 до 10, где 1 - полное несоответствие, 10 - полное соответствие.
    Верни JSON в формате: {{"score": число, "reasoning": "краткое объяснение оценки"}}
    """
    
    try:
        # Используем "basic_analysis", псевдоним для gemini-flash
        result_str = await _call_ai_model("basic_analysis", prompt)
        # Убираем "обертку" Markdown, если она есть
        cleaned_str = result_str.strip().replace('```json', '').replace('```', '')
        return json.loads(cleaned_str)
    except Exception as e:
        return { "score": 0, "reasoning": f"Ошибка анализа AI: {str(e)}" }

async def _call_ai_model(model_alias: str, prompt: str) -> str:
    """Обертка для вызова AI через Host-API."""
    try:
        # Мы больше не управляем ключами или лимитами в Python.
        # Мы просто просим платформу выполнить запрос с псевдонимом модели.
        # Платформа сама обработает ключи, лимиты и разрешения.
        params = {"prompt": prompt}
        response_proxy = await js.llm_call(model_alias, params)
        result = response_proxy.to_py()

        if result.get("error"):
            raise Exception(result.get("error_message", "Неизвестная ошибка от AI API"))
        
        return result.get("response", "Нет ответа от модели.")

    except Exception as e:
        # Пробрасываем ошибку выше, чтобы вызывающая функция могла ее обработать.
        raise RuntimeError(f"Ошибка при вызове модели '{model_alias}': {e}") from e

def _extract_categories(soup: 'SimpleHTMLParser') -> List[str]:
    # Ваша логика извлечения категорий (без изменений)
    return ["Пример", "Категории"]

def _extract_description_and_composition(soup: 'SimpleHTMLParser') -> tuple:
    # Ваша логика извлечения описания (без изменений)
    return "Пример описания", "Пример состава"

async def _find_similar_products(categories: List[str], composition: str) -> List[Dict[str, Any]]:
    # Ваша логика поиска аналогов (без изменений)
    return [{"name": "Пример аналога", "price": "1000 ₽"}]


# --- ЗАГЛУШКА ДЛЯ ПАРСЕРА (временно) ---
class SimpleHTMLParser:
    def __init__(self, html: str): self.html = html
    def find(self, tag: str, attrs: Dict = None) -> 'SimpleHTMLElement': return SimpleHTMLElement(self.html, tag, attrs)
    def find_all(self, tag: str, attrs: Dict = None) -> List['SimpleHTMLElement']: return [SimpleHTMLElement(self.html, tag, attrs)]
class SimpleHTMLElement:
    def __init__(self, html: str, tag: str, attrs: Dict): self.html, self.tag, self.attrs = html, tag, attrs or {}
    def get(self, attr: str, default: str = '') -> str: return self.attrs.get(attr, default)
    def find(self, tag: str, attrs: Dict = None) -> 'SimpleHTMLElement': return SimpleHTMLElement(self.html, tag, attrs)
    def find_all(self, tag: str, attrs: Dict = None) -> List['SimpleHTMLElement']: return [SimpleHTMLElement(self.html, tag, attrs)]
    def get_text(self, strip: bool = False) -> str: return "Пример текста"
    @property
    def text(self) -> str: return "Пример текста"