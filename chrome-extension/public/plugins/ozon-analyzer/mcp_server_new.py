def get_user_prompts(plugin_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Загружает промпты из настроек пользователя или использует значения по умолчанию из manifest.json.
    Улучшенная версия с многоуровневой fallback логикой для повышения надежности.

    Args:
        plugin_settings: Настройки плагина из Pyodide globals

    Returns:
        Структура промптов: {optimized: {ru: "...", en: "..."}, deep: {ru: "...", en: "..."}}
    """
    try:
        # Шаг 1: Загружаем кастомные промпты из настроек пользователя
        custom_prompts_raw = safe_dict_get(plugin_settings, 'prompts', {})

        # Структура промптов по умолчанию
        prompts = {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

        # Шаг 2: Получаем manifest с многоуровневым fallback
        manifest = _get_manifest_with_fallback()

        if manifest:
            manifest_prompts = safe_dict_get(manifest, 'options.prompts', {})

            # Шаг 3: Загружаем промпты с fallback логикой
            for prompt_type in ['optimized', 'deep']:
                for lang in ['ru', 'en']:
                    # 3.1 Сначала пробуем кастомные промпты пользователя
                    prompt_type_data = safe_dict_get(custom_prompts_raw, prompt_type, {})
                    custom_value = safe_dict_get(prompt_type_data, lang, '')

                    if custom_value and isinstance(custom_value, str) and len(custom_value.strip()) > 0:
                        prompts[prompt_type][lang] = custom_value
                        console_log(f"✅ Используем кастомный промпт: {prompt_type}.{lang} (длина: {len(custom_value)})")
                        continue

                    # 3.2 Fallback на manifest.json
                    lang_data = safe_dict_get(manifest_prompts, f'{prompt_type}.{lang}', {})
                    manifest_value = safe_dict_get(lang_data, 'default', '')

                    if manifest_value and isinstance(manifest_value, str) and len(manifest_value.strip()) > 0:
                        prompts[prompt_type][lang] = manifest_value
                        console_log(f"ℹ️ Используем промпт из manifest: {prompt_type}.{lang}")
                        continue

                    # 3.3 Fallback на встроенные промпты по умолчанию
                    builtin_value = _get_builtin_default_prompt(prompt_type, lang)
                    if builtin_value:
                        prompts[prompt_type][lang] = builtin_value
                        console_log(f"⚠️ Используем встроенный промпт по умолчанию: {prompt_type}.{lang}")
                        continue

                    # 3.4 Критический fallback - минимальные промпты
                    minimal_value = _get_minimal_fallback_prompt(prompt_type, lang)
                    prompts[prompt_type][lang] = minimal_value
                    console_log(f"🚨 Используем минимальный промпт: {prompt_type}.{lang}")

        else:
            # Если manifest недоступен вообще, используем встроенные промпты
            console_log("❌ Manifest недоступен, используем встроенные промпты по умолчанию")
            for prompt_type in ['optimized', 'deep']:
                for lang in ['ru', 'en']:
                    builtin_value = _get_builtin_default_prompt(prompt_type, lang)
                    if builtin_value:
                        prompts[prompt_type][lang] = builtin_value
                        console_log(f"✅ Используем встроенный промпт: {prompt_type}.{lang}")
                    else:
                        # Абсолютный минимум для продолжения работы
                        prompts[prompt_type][lang] = _get_minimal_fallback_prompt(prompt_type, lang)
                        console_log(f"🚨 Используем минимальный промпт: {prompt_type}.{lang}")

        # Шаг 4: Диагностика и логирование результатов
        _log_prompts_diagnostics(custom_prompts_raw, manifest, prompts)

        return prompts

    except Exception as e:
        console_log(f"❌ Критическая ошибка загрузки промптов: {str(e)}")
        console_log(f"🔍 Диагностика ошибки:")
        console_log(f"   Plugin settings: {plugin_settings}")
        console_log(f"   Plugin settings type: {type(plugin_settings)}")

        # Абсолютный критический fallback
        return {
            'optimized': {
                'ru': 'Проанализируй соответствие описания и состава продукта.',
                'en': 'Analyze the compliance of product description and composition.'
            },
            'deep': {
                'ru': 'Проведи глубокий анализ продукта с научной точки зрения.',
                'en': 'Conduct a deep analysis of the product from a scientific perspective.'
            }
        }

def _get_manifest_with_fallback() -> Optional[Dict[str, Any]]:
    """
    Получает manifest с многоуровневым fallback:
    1. Из pyodide.globals (основной метод)
    2. Загрузка напрямую из файла manifest.json
    3. Встроенные значения по умолчанию

    Returns:
        Dict с manifest данными или None если ничего не доступно
    """
    try:
        # Fallback 1: Попытка получить из pyodide.globals
        console_log("🔄 Fallback 1: Попытка загрузки manifest из pyodide.globals")
        manifest = get_pyodide_var('manifest', None)

        if manifest and isinstance(manifest, dict) and _validate_manifest_structure(manifest):
            console_log("✅ Manifest успешно загружен из pyodide.globals")
            return manifest

        console_log("⚠️ Manifest из pyodide.globals недоступен или поврежден")

        # Fallback 2: Попытка загрузки напрямую из файла
        console_log("🔄 Fallback 2: Попытка загрузки manifest из файла manifest.json")
        try:
            file_manifest = _load_manifest_from_file()
            if file_manifest and _validate_manifest_structure(file_manifest):
                console_log("✅ Manifest успешно загружен из файла")
                return file_manifest
        except Exception as e:
            console_log(f"❌ Ошибка загрузки manifest из файла: {e}")

        # Fallback 3: Встроенные значения по умолчанию
        console_log("🔄 Fallback 3: Используем встроенные значения manifest по умолчанию")
        builtin_manifest = _get_builtin_manifest()
        if builtin_manifest:
            console_log("✅ Используем встроенный manifest по умолчанию")
            return builtin_manifest

        console_log("❌ Все методы загрузки manifest провалились")
        return None

    except Exception as e:
        console_log(f"❌ Критическая ошибка при загрузке manifest: {e}")
        return None

def _load_manifest_from_file() -> Optional[Dict[str, Any]]:
    """
    Загружает manifest.json напрямую из файла.

    Returns:
        Dict с данными manifest или None при ошибке
    """
    try:
        # Путь к manifest файлу относительно текущего плагина
        manifest_path = 'manifest.json'

        # Проверяем доступность JavaScript bridge для чтения файлов
        if hasattr(js, 'readFile'):
            console_log(f"📁 Загружаем manifest из файла: {manifest_path}")
            file_content = js.readFile(manifest_path)

            if file_content:
                # Парсим JSON
                manifest_data = json.loads(file_content)
                console_log(f"✅ Manifest загружен из файла ({len(file_content)} символов)")
                return manifest_data

        console_log("⚠️ Не удалось загрузить manifest из файла")
        return None

    except Exception as e:
        console_log(f"❌ Ошибка загрузки manifest из файла: {e}")
        return None

def _validate_manifest_structure(manifest: Any) -> bool:
    """
    Валидирует структуру manifest для обнаружения поврежденных данных.

    Args:
        manifest: Данные для валидации

    Returns:
        True если структура корректна, False иначе
    """
    try:
        if not isinstance(manifest, dict):
            console_log(f"❌ Manifest не является словарем: {type(manifest)}")
            return False

        # Проверяем наличие обязательных полей
        required_fields = ['name', 'version', 'options']
        for field in required_fields:
            if field not in manifest:
                console_log(f"❌ В manifest отсутствует обязательное поле: {field}")
                return False

        # Проверяем структуру options.prompts
        options = manifest.get('options', {})
        if not isinstance(options, dict):
            console_log("❌ Поле options не является словарем")
            return False

        prompts = options.get('prompts', {})
        if not isinstance(prompts, dict):
            console_log("❌ Поле options.prompts не является словарем")
            return False

        # Проверяем наличие типов промптов
        for prompt_type in ['optimized', 'deep']:
            if prompt_type not in prompts:
                console_log(f"❌ В prompts отсутствует тип: {prompt_type}")
                return False

            prompt_type_data = prompts.get(prompt_type, {})
            if not isinstance(prompt_type_data, dict):
                console_log(f"❌ Тип промпта {prompt_type} не является словарем")
                return False

            # Проверяем языковые версии
            for lang in ['ru', 'en']:
                if lang not in prompt_type_data:
                    console_log(f"❌ В типе {prompt_type} отсутствует язык: {lang}")
                    return False

                lang_data = prompt_type_data.get(lang, {})
                if not isinstance(lang_data, dict):
                    console_log(f"❌ Данные языка {lang} в типе {prompt_type} не являются словарем")
                    return False

                # Проверяем наличие default значения
                if 'default' not in lang_data:
                    console_log(f"❌ В данных языка {lang} типа {prompt_type} отсутствует default")
                    return False

        console_log("✅ Структура manifest валидна")
        return True

    except Exception as e:
        console_log(f"❌ Ошибка валидации структуры manifest: {e}")
        return False

def _get_builtin_default_prompt(prompt_type: str, lang: str) -> str:
    """
    Возвращает встроенные промпты по умолчанию для указанного типа и языка.

    Args:
        prompt_type: Тип промпта ('optimized' или 'deep')
        lang: Язык ('ru' или 'en')

    Returns:
        Строка с промптом или пустая строка если не найден
    """
    builtin_prompts = {
        'optimized': {
            'ru': """Ты - токсиколог и химик-косметолог с 15-летним опытом. Твоя задача: провести КРИТИЧЕСКИЙ анализ косметического продукта, разоблачая маркетинговые уловки.

        ДАННЫЕ:
        Описание: {description}
        Состав: {composition}

        ОБЯЗАТЕЛЬНАЯ МЕТОДОЛОГИЯ АНАЛИЗА:

        1. ПРОВЕРКА МАРКЕТИНГОВЫХ ЗАЯВЛЕНИЙ:
        - Термины типа "3D/4D/5D", "революционный", "инновационный" - ТРЕБУЮТ доказательств
        - Для каждого заявления ("лифтинг", "против морщин"):
            * Найди КОНКРЕТНЫЙ активный компонент
            * Оцени его ПОЗИЦИЮ в списке (начало = высокая концентрация, конец = маркетинг)
            * Укажи ЭФФЕКТИВНУЮ концентрацию из исследований vs вероятную в продукте

        2. ТОКСИКОЛОГИЧЕСКИЙ СКРИНИНГ (приоритет №1):
        - Проверь КАЖДЫЙ компонент на:
            * Формальдегид-релизеры (DMDM Hydantoin, Quaternium-15, и т.д.)
            * Парабены (особенно butyl-, propyl-)
            * Устаревшие УФ-фильтры (Octinoxate, Oxybenzone)
            * Потенциальные эндокринные дизрапторы
        - Если найдено ≥3 проблемных компонента → оценка НЕ МОЖЕТ быть >5/10

        ФОРМАТ ОТВЕТА - ТОЛЬКО JSON:
        {{
        "score": число_от_1_до_10,
        "reasoning": "ДЕТАЛЬНЫЙ анализ маркетинга и токсикологии",
        "confidence": число_от_0_до_1,
        "red_flags": ["список проблемных компонентов"],
        "marketing_lies": ["неподтвержденные заявления"]
        }}

        ЯЗЫК: Русский, технический стиль.""",

            'en': """You are a board-certified toxicologist and cosmetic chemist with 15 years of experience in ingredient safety assessment. Your task: conduct a CRITICAL, evidence-based analysis of this cosmetic product, exposing marketing manipulation.

        DATA:
        Description: {description}
        Composition: {composition}

        MANDATORY ANALYSIS PROTOCOL:

        1. TOXICOLOGICAL SCREENING (highest priority):
        - Screen EVERY ingredient for:
            * Formaldehyde-releasers (DMDM Hydantoin, Quaternium-15, Diazolidinyl Urea, Imidazolidinyl Urea)
            * Parabens (particularly butylparaben, propylparaben - EU restricted)
            * Obsolete UV filters (Octinoxate/Ethylhexyl Methoxycinnamate, Oxybenzone)
            * Known/suspected endocrine disruptors
        - HARD RULE: ≥3 high-concern ingredients → score CAPPED at 5/10 maximum

        OUTPUT FORMAT - VALID JSON ONLY:
        {{
        "score": integer_1_to_10,
        "reasoning": "COMPREHENSIVE ANALYSIS of toxicological profile and marketing claims",
        "confidence": float_0_to_1,
        "red_flags": ["comprehensive list of problematic ingredients"],
        "marketing_lies": ["specific unsubstantiated marketing claims"]
        }}

        RESPONSE LANGUAGE: English, using precise technical terminology."""
        },
        'deep': {
            'ru': """Проведи глубокий анализ товара с медицинской и научной точки зрения.
        Описание: {description}
        Состав: {composition}
        Проанализируй:
        1. Научную обоснованность заявленных свойств.
        2. Потенциальные побочные эффекты и противопоказания.
        3. Эффективность по сравнению с аналогами.
        Верни детальный максимально подробный обоснованный анализ в структурированном виде (используй Markdown).""",

            'en': """Conduct a deep analysis of the product from a medical and scientific perspective.
        Description: {description}
        Composition: {composition}
        Analyze:
        1. Scientific validity of the claimed properties.
        2. Potential side effects and contraindications.
        3. Effectiveness compared to analogs.
        Return a detailed, maximally comprehensive, reasoned analysis in a structured form (use Markdown)."""
        }
    }

    return builtin_prompts.get(prompt_type, {}).get(lang, '')

def _get_minimal_fallback_prompt(prompt_type: str, lang: str) -> str:
    """
    Возвращает минимальные промпты для продолжения работы в критических ситуациях.

    Args:
        prompt_type: Тип промпта ('optimized' или 'deep')
        lang: Язык ('ru' или 'en')

    Returns:
        Строка с минимальным промптом
    """
    minimal_prompts = {
        'optimized': {
            'ru': 'Проанализируй соответствие описания и состава продукта. Описание: {description} Состав: {composition}',
            'en': 'Analyze the compliance of product description and composition. Description: {description} Composition: {composition}'
        },
        'deep': {
            'ru': 'Проведи глубокий анализ продукта. Описание: {description} Состав: {composition}',
            'en': 'Conduct a deep analysis of the product. Description: {description} Composition: {composition}'
        }
    }

    return minimal_prompts.get(prompt_type, {}).get(lang, f'Analyze product: {prompt_type}')

def _get_builtin_manifest() -> Optional[Dict[str, Any]]:
    """
    Возвращает встроенный manifest по умолчанию как последний уровень fallback.

    Returns:
        Dict с минимальными данными manifest или None
    """
    try:
        return {
            "name": "Ozon Analyzer",
            "version": "1.0.0",
            "description": "Анализатор товаров Ozon",
            "options": {
                "prompts": {
                    "optimized": {
                        "ru": {
                            "default": _get_builtin_default_prompt('optimized', 'ru')
                        },
                        "en": {
                            "default": _get_builtin_default_prompt('optimized', 'en')
                        }
                    },
                    "deep": {
                        "ru": {
                            "default": _get_builtin_default_prompt('deep', 'ru')
                        },
                        "en": {
                            "default": _get_builtin_default_prompt('deep', 'en')
                        }
                    }
                }
            }
        }
    except Exception as e:
        console_log(f"❌ Ошибка создания встроенного manifest: {e}")
        return None

def _log_prompts_diagnostics(custom_prompts_raw: Any, manifest: Any, final_prompts: Dict[str, Any]) -> None:
    """
    Логирует диагностическую информацию о промптах для отладки.

    Args:
        custom_prompts_raw: Исходные кастомные промпты
        manifest: Данные manifest
        final_prompts: Финальные промпты после обработки
    """
    try:
        console_log(f"🔍 Диагностика промптов:")
        console_log(f"   Кастомные промпты: {type(custom_prompts_raw)}")
        console_log(f"   Manifest доступен: {manifest is not None}")
        console_log(f"   Финальная структура промптов: {final_prompts}")

        # Подсчет загруженных промптов
        loaded_count = len([p for pt in final_prompts.values() for p in pt.values() if p])
        total_count = len([p for pt in final_prompts.values() for p in pt.values()])

        console_log(f"📋 Загружено промптов: {loaded_count}/{total_count}")

        if loaded_count == 0:
            console_log("⚠️ ВНИМАНИЕ: Ни один промпт не был загружен!")

        # Детальная информация по каждому типу
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                prompt_content = final_prompts.get(prompt_type, {}).get(lang, '')
                if prompt_content:
                    console_log(f"   ✅ {prompt_type}.{lang}: {len(prompt_content)} символов")
                else:
                    console_log(f"   ❌ {prompt_type}.{lang}: пустой")

    except Exception as e:
        console_log(f"❌ Ошибка диагностики промптов: {e}")

# ВСТАВЬТЕ ОСТАЛЬНЫЙ КОД ИЗ ОРИГИНАЛЬНОГО ФАЙЛА ЗДЕСЬ
# (все остальные функции остаются без изменений)
