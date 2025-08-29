# ==============================================================================
# MCP Server (Библиотека Инструментов) для плагина "Ozon Analyzer"
# ==============================================================================
# Этот скрипт НЕ является самостоятельным сервером. Он представляет собой
# набор Python-функций ("инструментов"), которые вызываются по требованию
# движком `workflow-engine.js` нашей платформы.
# Вся коммуникация с внешним миром (UI, Browser API, LLM) происходит
# опосредованно, через вызовы JavaScript-функций, доступных в глобальном
# объекте `js`.
# ------------------------------------------------------------------------------

# Стандартные импорты
import json
from typing import Any, Dict, List, Protocol, runtime_checkable

# --- "Контракт" с JavaScript: Объявление типов для `js` моста ---
# Этот блок кода критически важен для статических анализаторов (Pyright, MyPy)
# и для автодополнения в IDE (Cursor, VS Code). Он "объясняет" анализатору,
# какие методы существуют у глобального объекта `js`, который предоставляет
# среда Pyodide. В реальной среде выполнения этот блок не создает новых
# переменных, так как `js` уже будет определен.
try:
    @runtime_checkable
    class JsBridge(Protocol):
        """Описывает "контракт" API, который предоставляет JavaScript-хост."""
        def sendMessageToChat(self, message: Dict[str, Any]) -> None: ...
        def llm_call(self, model_alias: str, params: Dict[str, Any]) -> Any: ...
        def get_setting(self, setting_name: str) -> Any: ...
    js: JsBridge
except ImportError:
    # В минимальной среде Python `Protocol` может отсутствовать.
    # В Pyodide это не вызовет проблем.
    pass

# ==============================================================================
# Секция 1: "Публичные" Инструменты
# ------------------------------------------------------------------------------
# Эти функции являются точками входа для `workflow-engine.js`.
# Имя каждой функции соответствует значению `tool` в `workflow.json`,
# например, "python.analyze_ozon_product".
# ==============================================================================

async def analyze_ozon_product(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Главная точка входа для анализа страницы товара Ozon.
    Эта функция оркестрирует весь процесс: парсинг, анализ, поиск аналогов
    и формирование итогового отчета.

    Args:
        input_data: Словарь, содержащий `page_html` текущей страницы.

    Returns:
        Словарь с полным отчетом. Ключевые поля `description` и `composition`
        возвращаются на верхнем уровне, чтобы быть доступными для последующих
        шагов в `workflow.json` (например, для `perform_deep_analysis`).
    """
    try:
        page_html = input_data.get('page_html', '')
        if not page_html:
            raise ValueError("HTML страницы не предоставлен для анализа.")
        
        # Временная заглушка для парсера. В будущем здесь будет использоваться
        # библиотека `beautifulsoup4`, которая будет установлена как зависимость
        # плагина через `micropip`.
        soup = SimpleHTMLParser(page_html)

        # Простая проверка, что мы находимся на странице продукта.
        # Более надежная проверка потребует реального парсинга.
        if 'ozon.ru/product' not in page_html:
            return {
                "status": "info",
                "message": "Это не страница товара Ozon. Плагин работает только на страницах товаров."
            }
        
        js.sendMessageToChat({"content": "Python: Начинаю анализ страницы товара..."})

        # Шаг 1: Извлечение структурированных данных со страницы
        categories = _extract_categories(soup)
        description, composition = _extract_description_and_composition(soup)
        
        # Шаг 2: Анализ соответствия с помощью "быстрой" AI-модели
        js.sendMessageToChat({"content": f"Python: Описание и состав извлечены. Анализирую соответствие с помощью AI..."})
        analysis_result = await _analyze_composition_vs_description(description, composition)
        
        # Шаг 3: Поиск аналогов (в данной версии - заглушка)
        analogs = await _find_similar_products(categories, composition)
        
        # Шаг 4: Проверяем настройки плагина, заданные пользователем в UI
        enable_deep_analysis = await js.get_setting("enable_deep_analysis").to_py()
        
        # Шаг 5: Формируем условное предложение для глубокого анализа
        # Это поле будет использоваться в `workflow.json` в условии `run_if`.
        offer_deep_analysis = enable_deep_analysis and analysis_result.get('score', 10) < 7
        
        # Шаг 6: Собираем финальный результат
        result = {
            # Эти два поля дублируются на верхнем уровне специально для того,
            # чтобы следующий шаг в воркфлоу (`perform_deep_analysis`)
            # мог легко получить к ним доступ через `{{steps.analyze.output.description}}`.
            "description": description,
            "composition": composition,
            # Вся остальная информация для отображения в UI
            "categories": categories,
            "analysis": analysis_result,
            "analogs": analogs,
            "message": f"Анализ завершен. Оценка соответствия: {analysis_result.get('score', 'N/A')}/10",
            # Этот объект используется `workflow-engine` для принятия решения,
            # запускать ли следующий шаг.
            "deep_analysis_offer": {
                "available": offer_deep_analysis,
                "message": "Обнаружены несоответствия. Хотите провести более глубокий анализ?" if offer_deep_analysis else ""
            }
        }
        
        return result
        
    except Exception as e:
        js.sendMessageToChat({"content": f"Python: Критическая ошибка при анализе - {e}"})
        # Возвращаем стандартизированный объект ошибки
        return { "status": "error", "message": f"Ошибка анализа товара: {str(e)}" }

async def perform_deep_analysis(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Выполняет глубокий, ресурсоемкий анализ с помощью самой мощной
    AI-модели, доступной платформе.
    """
    description = input_data.get('description', '')
    composition = input_data.get('composition', '')
    
    if not description or not composition:
        return { "status": "error", "message": "Описание или состав не были переданы для глубокого анализа."}

    js.sendMessageToChat({"content": "Python: Запускаю глубокий анализ..."})
    
    # Промпт для "экспертного" анализа.
    prompt = f"""
    Проведи глубокий анализ товара с медицинской и научной точки зрения.
    Описание: {description}
    Состав: {composition}
    Проанализируй:
    1. Научную обоснованность заявленных свойств.
    2. Потенциальные побочные эффекты и противопоказания.
    3. Эффективность по сравнению с аналогами.
    Верни детальный анализ в структурированном виде (используй Markdown).
    """
    
    try:
        # "deep_analysis" - это псевдоним из `manifest.json` этого плагина.
        # Платформа сама определит, какую реальную модель (например, gemini-pro)
        # использовать, и подставит соответствующий API-ключ.
        result = await _call_ai_model("deep_analysis", prompt)
        return { "deep_analysis_report": result }
    except Exception as e:
        return { "status": "error", "message": f"Ошибка глубокого анализа: {str(e)}" }

# ==============================================================================
# Секция 2: "Приватные" Вспомогательные Функции
# ------------------------------------------------------------------------------
# Эти функции не предназначены для прямого вызова из `workflow.json`.
# Они инкапсулируют внутреннюю логику плагина.
# ==============================================================================

async def _analyze_composition_vs_description(description: str, composition: str) -> Dict[str, Any]:
    """Использует "быструю" AI-модель для базовой оценки соответствия."""
    if not description or not composition:
        return { "score": 0, "reasoning": "Не удалось извлечь описание или состав товара." }

    prompt = f"""
    Проанализируй соответствие описания товара и его состава.
    Описание: {description}
    Состав: {composition}
    Оцени по шкале от 1 до 10, где 1 - полное несоответствие, 10 - полное соответствие.
    Верни ТОЛЬКО JSON в формате: {{"score": число, "reasoning": "краткое объяснение оценки"}}
    """

    try:
        # Используем псевдоним "basic_analysis", который в манифесте
        # сопоставлен с быстрой и дешевой моделью типа `gemini-flash`.
        result_str = await _call_ai_model("basic_analysis", prompt)
        
        # Очистка и парсинг ответа от AI. Модели часто "оборачивают"
        # JSON в Markdown, который нужно удалить.
        cleaned_str = result_str.strip().replace('```json', '').replace('```', '')
        
        # Используем стандартный и безопасный `json.loads` для парсинга.
        try:
            parsed = json.loads(cleaned_str)
            # Простая валидация формата ответа
            if isinstance(parsed, dict) and 'score' in parsed:
                return parsed
            else:
                return {"score": 5, "reasoning": "Неверный формат ответа от AI (отсутствует 'score')."}
        except json.JSONDecodeError:
            return {"score": 5, "reasoning": f"Не удалось распарсить JSON от AI: {cleaned_str[:100]}..."}

    except Exception as e:
        return { "score": 0, "reasoning": f"Ошибка анализа AI: {str(e)}" }

async def _call_ai_model(model_alias: str, prompt: str) -> str:
    """
    Централизованная обертка для всех вызовов LLM.
    Делегирует всю сложную работу (управление ключами, лимитами, разрешениями)
    платформе через `js.llm_call`.
    """
    try:
        # Вызываем функцию хоста, передавая псевдоним модели и параметры.
        response_proxy = await js.llm_call(model_alias, {"prompt": prompt})
        # `await` дожидается выполнения JS Promise. `.to_py()` конвертирует
        # результат (JS-объект) в Python-словарь.
        result = response_proxy.to_py()

        # Стандартизированная обработка ошибок от хоста
        if result is None or result.get("error"):
            error_msg = result.get("error_message", "Неизвестная ошибка") if result else "Пустой ответ от хоста"
            raise Exception(f"Ошибка вызова API: {error_msg}")

        return result.get("response", "Нет ответа от модели.")

    except Exception as e:
        # Пробрасываем ошибку выше, чтобы вызывающая функция могла ее перехватить
        # и обработать в своей бизнес-логике.
        raise RuntimeError(f"Ошибка при вызове модели '{model_alias}': {e}") from e

def _extract_categories(soup: 'SimpleHTMLParser') -> List[str]:
    """Заглушка для извлечения категорий."""
    return ["Пример", "Категории"]

def _extract_description_and_composition(soup: 'SimpleHTMLParser') -> tuple:
    """Заглушка для извлечения описания и состава."""
    return "Пример описания", "Пример состава"

async def _find_similar_products(categories: List[str], composition: str) -> List[Dict[str, Any]]:
    """Заглушка для поиска аналогов."""
    return [{"name": "Пример аналога", "price": "1000 ₽"}]

# ==============================================================================
# Секция 3: Временные Заглушки
# ------------------------------------------------------------------------------
# Этот код будет заменен, когда мы добавим поддержку установки `beautifulsoup4`.
# ==============================================================================
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